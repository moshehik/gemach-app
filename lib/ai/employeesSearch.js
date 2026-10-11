// lib/ai/employeesSearch.js - the "employees" context of POST /api/ai/smart-search (חיפוש חכם ברשימת העובדים).
//
// Why this exists: pageContext 'employees' used to have no schema, so the route silently fell back to the Customer table and the
// employees page showed CUSTOMER rows (security-audit.md R4). The fix is NOT only a prompt: the model writes just a WHERE fragment, and
// that fragment can reach only a SAFE PROJECTION of the employee data, enforced in code by three independent layers:
//   1. SOURCE   - the fragment is run against two CTEs built here (`emp`, `emp_shifts`), never against "Employee" / "Shift". Those CTEs
//                 select only the columns listed in EMP_COLUMNS / SHIFT_COLUMNS. password, pinHash, wages, bank/ID/address/notes, themeColor,
//                 roleId, trusted devices and API keys are simply not in them, so no SQL can read them.
//   2. GUARD    - checkEmployeesWhere() tokenises the fragment and accepts only allow-listed words, functions, operators and the quoted names
//                 of the safe columns. Any other table or column ("Employee", "Shift", "hourlyWage", pg_catalog, information_schema), any
//                 function (pg_sleep, set_config, generate_series...), comments, ';', dollar quoting, E'' strings, UNION/JOIN/WITH/LIMIT...
//                 and every FROM that is not `emp` / `emp_shifts` is refused before anything reaches the database.
//   3. RUNTIME  - the route runs it in a READ ONLY transaction with a statement_timeout, the outer SELECT is a fixed column list with a
//                 fixed ORDER BY and LIMIT, and rows are mapped through mapEmployeeRow() (a key allow-list) on the way out.
// Pure functions only (no imports from the app) so scripts/test_ai_employees_context.mjs can exercise them without Next or a DB.

export const EMPLOYEES_PAGE_SIZE = 200;
export const EMPLOYEES_MAX_PAGE = 10;
export const EMPLOYEES_STATEMENT_TIMEOUT_MS = 8000;
export const MAX_WHERE_LENGTH = 2000;
/** Service accounts (API keys, agent login) are not people - same cut-off as lib/apiKeys.js SERVICE_EMPLOYEE_LEGACY_ID_MIN. */
const SERVICE_LEGACY_ID_MIN = 900000;
/** "currently in a shift" = an open shift that started less than 16 hours ago (same rule as lib/menu/shiftClock.js and /api/employees/presence). */
const MAX_PLAUSIBLE_SHIFT_HOURS = 16;

/** The ONLY employee columns a generated condition may mention (case-sensitive, always double-quoted when camelCase). */
export const EMP_COLUMNS = ['id', 'legacyId', 'firstName', 'lastName', 'fullName', 'departmentName', 'isActive', 'phone1', 'email', 'lastEntryTime', 'lastEntryDay', 'inShiftNow'];
/** The ONLY shift columns (times only - no wages, totals, notes). */
export const SHIFT_COLUMNS = ['employeeId', 'entryTime', 'exitTime', 'entryDay', 'exitDay', 'isOpen'];
export const EMP_TABLE = 'emp';
export const SHIFT_TABLE = 'emp_shifts';

const IL = (col) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::date`;

/** The fixed WITH clause: the safe projection. Nothing the model writes is ever concatenated into it. */
export const SAFE_CTE_SQL = `WITH emp_shifts AS (
  SELECT s."employeeId" AS "employeeId", s."entryTime" AS "entryTime", s."exitTime" AS "exitTime",
    ${IL('s."entryTime"')} AS "entryDay", ${IL('s."exitTime"')} AS "exitDay", (s."exitTime" IS NULL) AS "isOpen"
  FROM "Shift" s
  WHERE s."isDeleted" = false AND s."entryTime" IS NOT NULL
), emp AS (
  SELECT e.id AS id, e."legacyId" AS "legacyId", e."firstName" AS "firstName", e."lastName" AS "lastName", e."fullName" AS "fullName",
    d."name" AS "departmentName", COALESCE(e."isActive", true) AS "isActive", e."phone1" AS "phone1", e."email" AS "email",
    (SELECT MAX(x."entryTime") FROM emp_shifts x WHERE x."employeeId" = e.id) AS "lastEntryTime",
    ${IL('(SELECT MAX(x."entryTime") FROM emp_shifts x WHERE x."employeeId" = e.id)')} AS "lastEntryDay",
    EXISTS (SELECT 1 FROM emp_shifts x WHERE x."employeeId" = e.id AND x."exitTime" IS NULL AND x."entryTime" > ((now() AT TIME ZONE 'UTC') - interval '${MAX_PLAUSIBLE_SHIFT_HOURS} hours')) AS "inShiftNow"
  FROM "Employee" e LEFT JOIN "Department" d ON d."roleId" = e."roleId"
  WHERE COALESCE(e."legacyId", 0) < ${SERVICE_LEGACY_ID_MIN}
)`;

const OUT_COLUMNS = ['id', 'legacyId', 'firstName', 'lastName', 'fullName', 'departmentName', 'isActive', 'phone1', 'email'];
const OUT_SELECT = OUT_COLUMNS.map((c) => `"${c}"`).join(', ');

/** SELECT page for a (guard-approved) condition. Fixed column list, fixed deterministic ORDER BY, constant LIMIT. */
export function buildEmployeesQuery(clause, page = 1) {
  const p = Math.min(EMPLOYEES_MAX_PAGE, Math.max(1, parseInt(page, 10) || 1));
  const offset = (p - 1) * EMPLOYEES_PAGE_SIZE;
  return `${SAFE_CTE_SQL}\nSELECT ${OUT_SELECT} FROM emp WHERE (${clause}) ORDER BY "lastName" ASC NULLS LAST, "firstName" ASC NULLS LAST, id ASC LIMIT ${EMPLOYEES_PAGE_SIZE} OFFSET ${offset};`;
}
export function buildEmployeesCountQuery(clause) {
  return `${SAFE_CTE_SQL}\nSELECT COUNT(*)::int AS count FROM emp WHERE (${clause});`;
}
/** What is returned to the browser as `query` (debug aid) - the readable part only, never the CTE internals. */
export function describeEmployeesQuery(clause, page = 1) {
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * EMPLOYEES_PAGE_SIZE;
  return `SELECT ${OUT_SELECT} FROM emp WHERE (${clause}) LIMIT ${EMPLOYEES_PAGE_SIZE} OFFSET ${offset};`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The allow-list guard
// ---------------------------------------------------------------------------------------------------------------------------------

/** Words allowed bare (no table / column / function can be spelled with them). */
const KEYWORDS = new Set([
  'and', 'or', 'not', 'in', 'is', 'null', 'true', 'false', 'like', 'ilike', 'between', 'exists', 'any', 'all', 'some',
  'select', 'from', 'where', 'group', 'by', 'having', 'as', 'case', 'when', 'then', 'else', 'end', 'distinct',
  'at', 'time', 'zone', 'interval', 'date', 'timestamp', 'timestamptz', 'text', 'int', 'integer', 'bigint', 'numeric', 'boolean',
  'current_date', 'current_timestamp', 'localtimestamp', 'localtime',
]);
/** Functions allowed (all pure; no pg_sleep, set_config, generate_series, pg_read_file, lo_*, dblink, query_to_xml...). */
const FUNCTIONS = new Set([
  'lower', 'upper', 'trim', 'ltrim', 'rtrim', 'btrim', 'coalesce', 'nullif', 'greatest', 'least', 'regexp_replace', 'replace', 'concat',
  'length', 'char_length', 'left', 'right', 'abs', 'round', 'floor', 'ceil', 'date_trunc', 'date_part', 'to_char', 'now',
  'count', 'min', 'max', 'similarity', 'word_similarity', 'date',
]);
const TYPE_WORDS = new Set(['date', 'timestamp', 'timestamptz', 'text', 'int', 'integer', 'bigint', 'numeric', 'boolean', 'time', 'interval']);
const ALLOWED_QUOTED = new Set([...EMP_COLUMNS, ...SHIFT_COLUMNS]);
const BARE_COLUMNS = new Set([...EMP_COLUMNS, ...SHIFT_COLUMNS].filter((c) => c === c.toLowerCase())); // id, email, phone1 - unquoted names fold to lower case
const MULTI_OPS = ['!~*', '!~', '~*', '::', '<>', '<=', '>=', '!=', '||'];
const SINGLE_OPS = new Set(['=', '<', '>', '+', '-', '*', '/', '%', '(', ')', ',', '~']);
const MAX_SELECTS = 3;
const MAX_DEPTH = 6;

const fail = (reason) => ({ ok: false, reason });

/**
 * Checks the WHERE fragment produced by the model (after the Hebrew-date macros / normalisation were applied).
 * Accepts only: comparisons / boolean logic / pure functions over the safe columns, string and number literals, and sub-selects of the
 * exact shape `SELECT <expr> FROM emp|emp_shifts [WHERE ...] [GROUP BY ...] [HAVING ...]`.
 * @returns {{ok:true}|{ok:false,reason:string}}
 */
export function checkEmployeesWhere(clause) {
  if (typeof clause !== 'string') return fail('Empty or invalid condition');
  const src = clause.trim();
  if (!src) return fail('Empty or invalid condition');
  if (src.length > MAX_WHERE_LENGTH) return fail('Condition is too long');

  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    // string literal: '' is the only escape. A word glued to the opening quote (E'..', U&'..', B'..', X'..') is a different literal syntax - refused.
    if (ch === "'") {
      const prev = toks[toks.length - 1];
      if (prev && prev.glued) return fail('Prefixed string literals are not allowed');
      let j = i + 1;
      for (;;) {
        if (j >= n) return fail('Unterminated string literal');
        if (src[j] === "'") { if (src[j + 1] === "'") { j += 2; continue; } break; }
        j++;
      }
      toks.push({ t: 'str' });
      i = j + 1;
      continue;
    }
    if (ch === '"') {
      const j = src.indexOf('"', i + 1);
      if (j < 0) return fail('Unterminated quoted identifier');
      const name = src.slice(i + 1, j);
      if (src[j + 1] === '"') return fail('Escaped quotes in identifiers are not allowed');
      if (!ALLOWED_QUOTED.has(name)) return fail(`Column or table "${name.slice(0, 40)}" is not available in the employees search`);
      toks.push({ t: 'col' });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const m = /^\d+(?:\.\d+)?/.exec(src.slice(i));
      i += m[0].length;
      if (/[A-Za-z_]/.test(src[i] || '')) return fail('Malformed number');
      toks.push({ t: 'num' });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      const word = m[0];
      i += word.length;
      const glued = src[i] === "'";
      toks.push({ t: 'word', w: word, lw: word.toLowerCase(), glued });
      continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    const op = MULTI_OPS.find((o) => (o.length === 3 ? three === o : two === o));
    if (op) { toks.push({ t: 'op', o: op }); i += op.length; continue; }
    if (SINGLE_OPS.has(ch)) { toks.push({ t: 'op', o: ch }); i++; continue; }
    // everything else: ; . \ $ [ ] { } @ # ? ` : ! | & ^ and any non-ASCII character outside a string literal
    return fail(`Character "${ch}" is not allowed in the condition`);
  }
  if (!toks.length) return fail('Empty or invalid condition');
  // comments never get here (a lone '-' pair is two operators): refuse them explicitly anyway.
  for (let k = 0; k + 1 < toks.length; k++) {
    if (toks[k].o === '-' && toks[k + 1].o === '-') return fail('SQL comments are not allowed');
    if (toks[k].o === '/' && toks[k + 1].o === '*') return fail('SQL comments are not allowed');
  }

  let depth = 0;
  let selects = 0;
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k];
    const next = toks[k + 1];
    const prev = toks[k - 1];
    if (tk.t === 'op') {
      if (tk.o === '(') { depth++; if (depth > MAX_DEPTH) return fail('Condition is nested too deeply'); }
      else if (tk.o === ')') { depth--; if (depth < 0) return fail('Unbalanced parentheses'); }
      else if (tk.o === '::') {
        if (!(next && next.t === 'word' && TYPE_WORDS.has(next.lw))) return fail('Only simple type casts are allowed');
      }
      continue;
    }
    if (tk.t !== 'word') continue;
    const w = tk.lw;
    if (w === 'select') {
      selects++;
      if (selects > MAX_SELECTS) return fail('Too many sub-selects');
      if (!(prev && prev.o === '(')) return fail('A SELECT is only allowed as a parenthesised sub-select');
      continue;
    }
    if (w === 'from') {
      const isDistinctFrom = prev && prev.t === 'word' && prev.lw === 'distinct';
      if (isDistinctFrom) continue;
      if (!(next && next.t === 'word' && (next.lw === EMP_TABLE || next.lw === SHIFT_TABLE) && next.w === next.lw)) {
        return fail('FROM is only allowed over the emp / emp_shifts views');
      }
      continue;
    }
    if (w === EMP_TABLE || w === SHIFT_TABLE) {
      if (!(prev && prev.t === 'word' && prev.lw === 'from')) return fail('emp / emp_shifts may only appear right after FROM');
      if (tk.w !== w) return fail('Table names must be lower case');
      continue;
    }
    const callsParen = !!(next && next.o === '(');
    if (KEYWORDS.has(w)) {
      // `date(` / `interval(` style calls are fine; but keywords that are also types may not be glued to a literal prefix (checked above).
      continue;
    }
    if (callsParen) {
      if (!FUNCTIONS.has(w)) return fail(`Function ${w}() is not allowed`);
      continue;
    }
    if (TYPE_WORDS.has(w)) continue; // e.g. `::time`
    if (BARE_COLUMNS.has(tk.w)) continue; // id / email / phone1 (no quotes needed)
    return fail(`Identifier ${tk.w.slice(0, 40)} is not allowed in the employees search`);
  }
  if (depth !== 0) return fail('Unbalanced parentheses');
  return { ok: true };
}

export function assertEmployeesWhere(clause) {
  const r = checkEmployeesWhere(clause);
  if (!r.ok) {
    const err = new Error(r.reason);
    err.rejectedSql = clause;
    err.employeesGuard = true;
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Rows -> the shape both employees pages render (same keys as GET /api/employees?all=true, minus everything sensitive)
// ---------------------------------------------------------------------------------------------------------------------------------

/** Key allow-list mapping: whatever else a row carries is dropped. Missing / empty values are absent. */
export function mapEmployeeRow(r) {
  if (!r || typeof r !== 'object') return null;
  const out = { id: r.id };
  if (r.legacyId != null) out.legacyId = Number(r.legacyId);
  if (r.firstName != null && r.firstName !== '') out.firstName = String(r.firstName);
  if (r.lastName != null && r.lastName !== '') out.lastName = String(r.lastName);
  if (r.fullName != null && r.fullName !== '') out.fullName = String(r.fullName);
  if (r.departmentName != null && r.departmentName !== '') out.department = { name: String(r.departmentName) };
  if (r.phone1 != null && r.phone1 !== '') out.phone1 = String(r.phone1);
  if (r.email != null && r.email !== '') out.email = String(r.email);
  out.isActive = r.isActive !== false;
  return out;
}
export const mapEmployeeRows = (rows) => (Array.isArray(rows) ? rows.map(mapEmployeeRow).filter(Boolean) : []);

// ---------------------------------------------------------------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------------------------------------------------------------

export const EMPLOYEES_SCHEMA_TEXT = `Views you can query (these are the ONLY objects that exist for you; there is no other table, column or function):

View: emp   (one row per employee - the "main table")
Columns: id (text), "legacyId" (integer, the employee CODE shown in the list), "firstName", "lastName", "fullName", "departmentName" (text, e.g. 'הנהלה ראשית', 'מכירות'),
"isActive" (boolean: true = active, false = inactive), phone1 (text), email (text),
"lastEntryTime" (timestamp, UTC - the last clock-in; NULL = never clocked in), "lastEntryDay" (date, Israel calendar day of the last clock-in),
"inShiftNow" (boolean: true = currently clocked in, with a shift that is still open)

View: emp_shifts   (one row per clock-in/out record)
Columns: "employeeId" (text, = emp.id), "entryTime" (timestamp UTC), "exitTime" (timestamp UTC, NULL while the shift is open), "entryDay" (date, Israel calendar day of the entry), "exitDay" (date, Israel day of the exit), "isOpen" (boolean)

Nothing else exists: no passwords, wages, pay, bank, ID numbers, addresses, notes, permissions, roles, devices or keys. If the request needs any of that, answer exactly: SQL: 1=0`;

export function buildEmployeesSystemPrompt() {
  return `You are a smart filtering assistant for the EMPLOYEES list of a dress-rental shop (Hebrew UI).
The user wants to find employees. Schema:
${EMPLOYEES_SCHEMA_TEXT}

Your task is to generate ONLY a valid PostgreSQL WHERE condition over the view "emp" (without the WHERE keyword), based on the user's request.

Rules:
1. Your response MUST START with the exact prefix "SQL: ". ONLY the condition - no markdown, no \`\`\`, no explanations.
2. Use only the columns listed above, camelCase names in double quotes ("firstName", "isActive"). Booleans are true/false. Do NOT write a semicolon or comments.
3. Text: NEVER use '=' on names or departments - use ILIKE '%value%' (or several ILIKE joined by OR for spelling variants). A full name typed in either order: require EVERY typed word to match "firstName" OR "lastName" OR "fullName".
4. "employee code" / "קוד עובד" / "מספר עובד" = "legacyId" (integer): "legacyId" = 12.
5. Department ("מחלקה"): "departmentName" ILIKE '%value%'.
6. Active / inactive ("פעילים", "לא פעילים", "פוטרו", "עזבו"): "isActive" = true / false. If the user does not mention it, do NOT filter on it.
7. "Who is clocked in / connected / in a shift right now" ("מי מחובר עכשיו", "מי במשמרת"): "inShiftNow" = true.
8. Entries ("מי נכנס", "מי הגיע", "מי עבד") for a period: use emp_shifts through a sub-select and compare the Israel-day column, for example employees who clocked in since a date: id IN (SELECT "employeeId" FROM emp_shifts WHERE "entryDay" >= '2026-10-04'). Employees who did NOT clock in: id NOT IN (SELECT "employeeId" FROM emp_shifts WHERE "entryDay" >= '2026-10-04') - this NOT IN is safe because "employeeId" is never NULL. A shift left open: "isOpen" = true.
9. The last clock-in: "lastEntryDay" (date) or "lastEntryTime" (timestamp). Never clocked in: "lastEntryTime" IS NULL. Never use NOT IN / <> on a nullable column ("lastEntryTime", phone1, email, "departmentName", "lastName") - use IS NULL / IS NOT NULL / COALESCE(col, '').
10. TIME ZONE: every date in the request is an ISRAEL date. Compare "entryDay" / "exitDay" / "lastEntryDay" (they are already Israel days) with 'YYYY-MM-DD' literals. "Today" in SQL = (now() AT TIME ZONE 'Asia/Jerusalem')::date. For a time of day convert first: ("entryTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem'). The week starts on Sunday: "this week" = from the most recent Sunday of the DATE CONTEXT below until today.
11. DATES: for Gregorian dates use 'YYYY-MM-DD'. If the user gives a Hebrew date DO NOT convert it yourself - use the macro HEBREW_DATE(day, 'MONTH', year), e.g. "entryDay" = HEBREW_DATE(10, 'SIVAN', 5786). A whole Hebrew month: "entryDay" >= HEBREW_MONTH_START('ELUL', 5786) AND "entryDay" <= HEBREW_MONTH_END('ELUL', 5786). Month names: ${'NISAN, IYYAR, SIVAN, TAMUZ, AV, ELUL, TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II'}. If the year is unknown use the current Hebrew year from the context.
12. PHONES: digits only: regexp_replace(phone1, '\\D', '', 'g') LIKE '%1234567%'.
13. If the request is impossible with these columns (passwords, salary, hourly rate, bank, ID number, address, notes, permissions...), output exactly: SQL: 1=0
14. A sub-select must read ONLY from emp or emp_shifts, in the form (SELECT col FROM emp_shifts WHERE ...). No JOIN, UNION, WITH, LIMIT, ORDER BY or aliases.

Example for "מי נכנס מאז ה-4 באוקטובר 2026 ופעיל":
SQL: "isActive" = true AND id IN (SELECT "employeeId" FROM emp_shifts WHERE "entryDay" >= '2026-10-04')
`;
}

/**
 * UX pre-check (NOT a security layer - the guard above is): a request that is plainly about data this search can never return gets a
 * clear Hebrew answer without spending an LLM call. Everything it misses is still stopped by the guard / the safe projection.
 */
const SENSITIVE_INTENT = /(סיסמ|פינקוד|קוד סודי|password|passwd|\bpin\b|שכר|משכורת|שעתי|תעריף|תלוש|wage|salary|payroll|בנק|חשבון בנק|תעודת זהות|ת"ז|ת\.ז|מספר זהות|כתובת(?!\s*(?:ה?מייל|ה?אימייל|ה?דוא|ה?דואר|email|e-mail|mail))|רחוב|הרשאות|מפתח api|api key|טוקן|token|מכשיר מהימן|הערות פנימיות)/i;
export function isSensitiveEmployeesRequest(prompt) {
  return SENSITIVE_INTENT.test(String(prompt || ''));
}
export const MSG_EMPLOYEES_FORBIDDEN = 'החיפוש החכם בעובדים זמין להנהלה ראשית בלבד.';
export const MSG_EMPLOYEES_LOGIN = 'יש להתחבר כדי לחפש בעובדים.';
export const MSG_EMPLOYEES_LIMITED = 'החיפוש החכם בעובדים מוגבל לשם, קוד עובד, מחלקה, פעיל / לא פעיל, טלפון, מייל וכניסות למשמרת. לא ניתן לחפש או להציג סיסמאות, שכר, פרטי בנק או פרטים אישיים אחרים.';
export const MSG_EMPLOYEES_REJECTED = 'לא הצלחתי לנסח חיפוש בטוח לבקשה הזו. נסו לנסח לפי שם, מחלקה, פעיל / לא פעיל, טלפון, מייל או כניסות למשמרת.';
