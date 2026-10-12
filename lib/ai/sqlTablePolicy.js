// Table allow-list for LLM-written SQL (security-audit.md R4b, 2026-10-11).
//
// The generic AI endpoints (/api/ai chat, /api/ai/statistics, /api/ai/smart-search for customers / orders / dresses / rentals) let the model
// write SQL over the FULL schema. lib/sqlGuard.js only keeps the statement read-only and hides credential columns, so a holder of
// feature:ai could still read - or probe with yes / no questions - tables that have nothing to do with the question asked
// (EmailLog.body, AuditLog.changesJson, SystemSetting, permissions, error reports ...).
//
// This module adds the missing barrier: every table named in the SQL must be on the list for the caller's tier (chat / statistics) or for the
// page context (smart search). It is deliberately a TABLE-level list: the models are free to join and sub-select inside the list, which is what
// the real questions need.
//
// Pure (no Next / Prisma) so it can be unit-tested. It is defence in depth, not a SQL parser: it tokenises just enough to ignore string
// literals and to see every quoted identifier. Postgres folds unquoted names to lower case and keeps the case of quoted ones, so only the exact
// quoted spelling "EmailLog" can ever reach the EmailLog table - that is what is matched.

// Every Prisma model (kept in sync with prisma/schema.prisma by scripts/test_ai_sql_table_policy.mjs).
export const ALL_TABLES = [
  'Customer', 'AuditLog', 'BackupRun', 'AuditReport', 'Employee', 'TrustedDevice', 'ApiKey', 'Notification', 'Shift', 'DressModel',
  'DressItem', 'Order', 'Payment', 'PaymentObligation', 'OrderItem', 'PriceList', 'SystemSetting', 'PriceRule', 'PageVisitLog',
  'SearchHistory', 'SavedSearch', 'EmailLog', 'QueryLog', 'NotificationTag', 'Department', 'DepartmentPermission',
  'EmployeePermissionOverride', 'PermissionPageGroup', 'AIChatSession', 'Refund', 'ErrorReport', 'ErrorReportReply', 'Attachment',
  'NedarimHok', 'ScheduleStageMark', 'DeliveryJoin', 'CustomerConsent', 'StationEvent', 'AuthThrottle',
];

// The business data every AI user may ask about.
const BUSINESS = [
  'Customer', 'Order', 'OrderItem', 'Payment', 'PaymentObligation', 'Refund', 'DressModel', 'DressItem', 'PriceList', 'PriceRule',
  'DeliveryJoin', 'ScheduleStageMark', 'NedarimHok',
];
// Staff data (who worked / who changed what): head management and the programmer.
const MANAGEMENT_EXTRA = ['Employee', 'Shift', 'Department', 'AuditLog'];
// System / operations data: the programmer only (the same audience as /admin/site-settings and the email-log page).
const PROGRAMMER_EXTRA = ['EmailLog', 'PageVisitLog', 'ErrorReport', 'ErrorReportReply', 'Attachment', 'Notification', 'NotificationTag', 'AuditReport', 'BackupRun'];
// Never reachable from AI-written SQL, whoever asks: secrets, permissions, other people's saved searches / chats, the admin SQL log.
export const NEVER_TABLES = [
  'SystemSetting', 'ApiKey', 'TrustedDevice', 'DepartmentPermission', 'EmployeePermissionOverride', 'PermissionPageGroup',
  'AIChatSession', 'SearchHistory', 'SavedSearch', 'QueryLog',
  // אינטגרציה 12.10.2026: יומן ההסכמות (ראיה משפטית, feature/customer-consent) ואירועי העמדה הציבורית (sidHash, feature/station-analytics) - לא לשאילתות AI
  'CustomerConsent', 'StationEvent',
  // #273: מונה ניסיונות סיסמה ונעילות לפי כתובת IP / עובד (verify-pin) - אבטחה, לא לשאילתות AI
  'AuthThrottle',
];

export const TIER_STANDARD = 'standard';
export const TIER_MANAGEMENT = 'management';
export const TIER_PROGRAMMER = 'programmer';

const TIER_TABLES = {
  [TIER_STANDARD]: new Set(BUSINESS),
  [TIER_MANAGEMENT]: new Set([...BUSINESS, ...MANAGEMENT_EXTRA]),
  [TIER_PROGRAMMER]: new Set([...BUSINESS, ...MANAGEMENT_EXTRA, ...PROGRAMMER_EXTRA]),
};

/** roleId -> tier. 2 = מתכנת, 0 = הנהלה ראשית (lib/roles.js). Anyone else - and an unknown caller - is standard. */
export function aiTierForRole(roleId) {
  if (roleId === 2) return TIER_PROGRAMMER;
  if (roleId === 0) return TIER_MANAGEMENT;
  return TIER_STANDARD;
}
export function tablesForTier(tier) {
  return TIER_TABLES[tier] || TIER_TABLES[TIER_STANDARD];
}

// smart-search page contexts: just what the page's own question can need (the SCHEMA_MAP "Related Table" lines plus the sub-selects the
// prompt rules ask for: customer names, barcodes, phones, sizes).
const CTX = {
  customers: ['Customer', 'Order'],
  orders: ['Order', 'OrderItem', 'Customer', 'DressItem', 'DressModel', 'DeliveryJoin'],
  dresses: ['DressItem', 'DressModel', 'OrderItem', 'Order', 'Customer'],
  rentals: ['OrderItem', 'Order', 'Customer', 'DressItem', 'DressModel'],
};
const CTX_FINANCIAL = ['Payment', 'PaymentObligation', 'Refund'];
/** @param {string} ctx smart-search pageContext @param {{financial?: boolean}} [opts] financial = the caller may see money columns */
export function tablesForSmartSearchContext(ctx, { financial = false } = {}) {
  const base = CTX[ctx] || CTX.customers;
  return new Set(financial && (ctx === 'orders' || ctx === 'rentals') ? [...base, ...CTX_FINANCIAL] : base);
}

// Anything that reads the catalog, the file system or the session, or burns time on purpose. No legitimate business question needs them.
const DANGEROUS = /\b(?:pg_[a-z_]+|information_schema|dblink[a-z_]*|lo_[a-z_]+|current_setting|set_config|current_user|session_user|current_database|current_schema|inet_server_addr|inet_client_addr|version)\s*(?:\(|\.|\b)/i;
const ALL_SET = new Set(ALL_TABLES);

/**
 * @param {string} sql a full SELECT statement
 * @param {Set<string>|string[]} allowed table names the caller may touch
 * @returns {{ok:true}|{ok:false,reason:string,table?:string}}
 */
export function checkSqlTables(sql, allowed) {
  if (typeof sql !== 'string' || !sql.trim()) return { ok: false, reason: 'Empty or invalid SQL string' };
  const allow = allowed instanceof Set ? allowed : new Set(allowed || []);

  // Dollar quoting and E'' / U&'' strings (checked below) change how the text below would tokenise - refuse them (no business query needs them).
  if (/\$[A-Za-z0-9_]*\$/.test(sql)) return { ok: false, reason: 'Dollar-quoted strings are not allowed' };

  // Remove '...' literals ('' is the only escape), keeping quoted identifiers untouched.
  let out = '';
  let i = 0;
  const n = sql.length;
  const idents = [];
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      if (/(?:^|[^A-Za-z0-9_])[EeUuBbXxNn]&?$/.test(out)) return { ok: false, reason: 'Prefixed string literals are not allowed' };
      let j = i + 1;
      for (;;) {
        if (j >= n) return { ok: false, reason: 'Unterminated string literal' };
        if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue; } break; }
        j++;
      }
      out += ' ';
      i = j + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= n) return { ok: false, reason: 'Unterminated quoted identifier' };
        if (sql[j] === '"') { if (sql[j + 1] === '"') return { ok: false, reason: 'Escaped quotes in identifiers are not allowed' }; break; }
        j++;
      }
      idents.push(sql.slice(i + 1, j));
      out += ' Q ';
      i = j + 1;
      continue;
    }
    out += ch;
    i++;
  }

  if (DANGEROUS.test(out)) return { ok: false, reason: 'Catalog / system functions are not available to AI queries' };
  if (/\bpublic\s*\./i.test(out)) return { ok: false, reason: 'Schema-qualified table names are not allowed' };

  for (const id of idents) {
    const low = id.toLowerCase();
    if (low === 'public' || low.startsWith('pg_') || low.startsWith('_prisma') || low === 'information_schema') {
      return { ok: false, reason: `Identifier "${id.slice(0, 40)}" is not available to AI queries`, table: id };
    }
    // Exact, case-sensitive: Postgres keeps the case of a quoted identifier, so only "EmailLog" can ever be the EmailLog table
    // (and a column such as PriceRule."refund" must not be mistaken for the "Refund" table).
    if (ALL_SET.has(id) && !allow.has(id)) {
      return { ok: false, reason: `Table "${id}" is not available to this AI query`, table: id };
    }
  }
  return { ok: true };
}

/** Throws (Error with .rejectedSql and .tablePolicy = true) when the SQL touches a table outside `allowed`. */
export function assertSqlTables(sql, allowed) {
  const r = checkSqlTables(sql, allowed);
  if (!r.ok) {
    const err = new Error(r.reason);
    err.rejectedSql = sql;
    err.tablePolicy = true;
    throw err;
  }
}
