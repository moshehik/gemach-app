// lib/adminEmailLogs.js - הלוגיקה הטהורה של יומן שליחת המיילים החדש (/admin/site-settings/email-logs, API: /api/admin/email-logs).
// בלי prisma ובלי imports עם alias: נקרא גם מ-node רגיל (scripts/test_a5_email_logs.mjs) וגם מהלקוח (מפתחות הסינון / המיון).
//
// מה כאן:
//  * EMAIL_TYPES / classifyEmail - "סוג המייל". ב-EmailLog אין עמודת סוג (ואסור DDL), לכן הסוג נגזר מהנושא (כל הנושאים מוגדרים במקום אחד, lib/emailCatalog.js).
//    אותם כללים (ביטוי רגולרי על הנושא) משמשים גם ב-JS (תצוגה, בדיקות) וגם ב-SQL (סינון / ספירות / מיון) - `~` של Postgres, תחביר משותף בלבד.
//  * parseEmailLogsParams - קלט (query או JSON) -> פרמטרים מנורמלים ובטוחים (עימוד עד 100, מיון מותר, מפתחות סינון מוכרים בלבד).
//  * buildWhere / listSql / countSql / countsSql - בניית SQL עם פרמטרים מוצמדים ($n); שמות עמודות וביטויי מיון הם קבועים מהקוד, לעולם לא קלט משתמש.
//  * mapEmailLogRow - שורה גולמית מה-DB (+ שמות לקוח / עובד) -> שורת הרשימה.
//
// פרטיות: גוף המייל של איפוס סיסמה מכיל סיסמה זמנית (app/api/auth/forgot-password, employees/[id]/reset-password) - ה-SQL לעולם לא מחזיר אותו ולא מחפש בו.

import { DEFAULT_LIMIT, EXPORT_PAGE_LIMIT, MAX_LIST_LIMIT } from './adminListGuards.js';

export const EMAIL_LOGS_PAGE_SIZE = DEFAULT_LIMIT;
export const BODY_PREVIEW_CHARS = 300;
export const SENDER_OPTIONS_MAX = 25;
// ב-EmailLog של כרטיס הזמנה (app/api/orders/[id]/email) גוף המייל נרשם כמחרוזת ממלאת - לא תוכן אמיתי, לא מוצגת
export const ORDER_PDF_BODY_FILLER = 'HTML body sent to App Script for PDF conversion';

/* --------------------------------- סוגי מיילים --------------------------------- */

// סדר = סדר הבדיקה (הראשון שמתאים). re = ביטוי רגולרי על הנושא (תחביר משותף ל-JS ול-Postgres ARE: עוגנים, מחלקות תווים, +, *, \[ \]).
// file: true / false = מוסיף תנאי על קיום קובץ מצורף (כרטיס הזמנה = עם PDF; אישור אוטומטי = בלי). catalog = מזהי lib/emailCatalog.js שהסוג מכסה.
export const EMAIL_TYPES = Object.freeze([
  { id: 'passwordReset', label: 'איפוס סיסמה', icon: 'lock', re: '^איפוס סיסמה - מערכת הגמ"ח$', catalog: ['passwordResetSelf', 'passwordResetManager'], secret: true },
  { id: 'orderCard', label: 'כרטיס הזמנה', icon: 'file', re: '^הזמנה #[0-9]+ - ', file: true, catalog: ['orderCard'] },
  { id: 'orderCreated', label: 'אישור הזמנה', icon: 'check', re: '^הזמנה #[0-9]+ - ', file: false, catalog: ['orderCreatedAuto'] },
  { id: 'pickupReminder', label: 'תזכורת איסוף', icon: 'bell', re: '^תזכורת איסוף - הזמנה #[0-9]+', catalog: ['pickupReminder'] },
  { id: 'lateReturnReminder', label: 'תזכורת החזרה', icon: 'clock', re: '^תזכורת החזרה - הזמנה #[0-9]+', catalog: ['lateReturnReminder'] },
  { id: 'refund', label: 'אישור זיכוי', icon: 'cash', re: '^אישור ביצוע זיכוי', catalog: ['refundExecuted'] },
  { id: 'bulk', label: 'הודעה המונית', icon: 'send', re: '\\[bulk-.*\\]$', catalog: ['bulkEventDate'] },
  { id: 'dailyReport', label: 'דוח יומי', icon: 'sn-chart', re: '^דוח יומי ', catalog: ['dailyManagerReport'] },
  { id: 'barcodesReport', label: 'ברקודים ידניים', icon: 'scan', re: '^ברקודים ידניים ', catalog: ['manualBarcodesReport'] },
  { id: 'courier', label: 'נתוני משלוחים', icon: 'truck', re: '^נתוני משלוחים - [0-9]+ קבוצות$', catalog: ['courierDeliveries'] },
  { id: 'errorReport', label: 'דיווח תקלה', icon: 'sn-bug', re: '^דיווח תקלה ממערכת הגמח| מבקש/ת מענה אנושי - דיווח תקלה$', catalog: ['errorReportNew', 'errorReportHumanRequested'] },
  { id: 'agentDigest', label: 'סיכום שינויי קוד', icon: 'sparkles', re: '^[0-9]+ שינויים ממתינים לאישור מיזוג', catalog: ['agentDigest'] },
  { id: 'policyQuestionnaire', label: 'שאלון מדיניות', icon: 'note', re: '^שאלון מדיניות ביטולים וזיכויים', catalog: ['policyQuestionnaireSubmitted'] },
]);
// נגזרים מהסטטוס ולא מהנושא / ברירת המחדל
export const MAILING_LIST_TYPE = Object.freeze({ id: 'mailingList', label: 'רישום לרשימת תפוצה', icon: 'inbox', catalog: [] });
export const OTHER_TYPE = Object.freeze({ id: 'other', label: 'מייל חופשי או אחר', icon: 'mail', catalog: ['managerFreeText', 'internalMessageAlert'] });
export const ALL_TYPES = Object.freeze([...EMAIL_TYPES, MAILING_LIST_TYPE, OTHER_TYPE]);
export const TYPE_IDS = Object.freeze(ALL_TYPES.map((t) => t.id));
export const typeById = (id) => ALL_TYPES.find((t) => t.id === id) || OTHER_TYPE;
export const typeLabel = (id) => typeById(id).label;
export const typeIcon = (id) => typeById(id).icon;

// מיילים בקטלוג שאין להם סוג משלהם (נושא חופשי): נבדק ב-scripts/test_a5_email_logs.mjs שכל מזהה בקטלוג מכוסה
export const MAILING_LIST_STATUS = 'subscribed';

/** סוג המייל לפי נושא / סטטוס / קובץ מצורף (אותם כללים כמו typeCaseSql). */
export function classifyEmail({ subject, status, fileName } = {}) {
  if (status === MAILING_LIST_STATUS) return MAILING_LIST_TYPE.id;
  const s = typeof subject === 'string' ? subject : '';
  const hasFile = !!(fileName && String(fileName).trim());
  for (const t of EMAIL_TYPES) {
    if (!new RegExp(t.re).test(s)) continue;
    if (t.file === true && !hasFile) continue;
    if (t.file === false && hasFile) continue;
    return t.id;
  }
  return OTHER_TYPE.id;
}

/* --------------------------------- סטטוס / תקופה --------------------------------- */

export const STATUS_KEYS = Object.freeze(['sent', 'failed', 'subscribed']);
export const STATUS_WORD = Object.freeze({ sent: 'נשלח', failed: 'נכשל', subscribed: 'נרשם' });
export const STATUS_ICON = Object.freeze({ sent: 'check', failed: 'alert', subscribed: 'inbox' });
/** סטטוס ה-DB ('success' / 'error' / 'subscribed' / כל ערך אחר) -> מפתח תצוגה. כל מה שלא הצלחה ולא רישום = כשל (כמו הדף הישן). */
export const statusKeyOf = (status) => (status === 'success' ? 'sent' : status === MAILING_LIST_STATUS ? 'subscribed' : 'failed');

export const PERIOD_KEYS = Object.freeze(['today', 'past7', 'past30', 'pastYear', 'custom']);
export const PRESET_PERIOD_KEYS = Object.freeze(['today', 'past7', 'past30', 'pastYear']);

export const EMAIL_SORT_KEYS = Object.freeze(['sentAt', 'to', 'subject', 'type', 'status', 'files', 'order']);

const clampInt = (v, def, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};
const csv = (v) => (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map((x) => String(x).trim()).filter(Boolean);
const pickKnown = (v, known) => [...new Set(csv(v).filter((x) => known.includes(x)))];
const dateKey = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : '');
const isTrue = (v) => v === true || v === '1' || v === 1 || v === 'true';
const SENDER_RE = /^(none|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/** קלט גולמי -> פרמטרים מנורמלים. מפתחות לא מוכרים נזרקים; ערכים מחוץ לתחום נחתכים. */
export function parseEmailLogsParams(input) {
  const p = input && typeof input === 'object' ? input : {};
  const exportMode = isTrue(p.export);
  return {
    page: clampInt(p.page, 1, 1, 100000),
    export: exportMode,
    limit: clampInt(p.limit, EMAIL_LOGS_PAGE_SIZE, 1, exportMode ? EXPORT_PAGE_LIMIT : MAX_LIST_LIMIT),
    search: typeof p.search === 'string' ? p.search.replace(/\u0000/g, '').trim().slice(0, 200) : '', // NUL: Postgres rejects it in a text parameter (was a 500, security audit 2026-10-11)
    sort: EMAIL_SORT_KEYS.includes(p.sort) ? p.sort : 'sentAt',
    dir: p.dir === 'asc' ? 'asc' : 'desc',
    types: pickKnown(p.types, TYPE_IDS),
    statuses: pickKnown(p.statuses, STATUS_KEYS),
    period: pickKnown(p.period, PERIOD_KEYS),
    from: dateKey(p.from),
    to: dateKey(p.to),
    senders: csv(p.senders).filter((x) => SENDER_RE.test(x)).slice(0, 20),
  };
}

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** מפתח תקופה -> טווח ימים { from, to } ('YYYY-MM-DD', כולל; todayKey = היום בישראל); null = אין / טווח מותאם חסר. */
export function resolvePeriod(key, todayKey, from = '', to = '') {
  switch (key) {
    case 'today': return { from: todayKey, to: todayKey };
    case 'past7': return { from: addDays(todayKey, -6), to: todayKey };
    case 'past30': return { from: addDays(todayKey, -29), to: todayKey };
    case 'pastYear': return { from: addDays(todayKey, -364), to: todayKey };
    case 'custom': return from || to ? { from: from || '', to: to || '' } : null;
    default: return null;
  }
}

/**
 * טווחי הזמן (UTC, ISO) של התקופות שנבחרו (OR ביניהן). dayRange(key) = { start: Date, end: Date } של יום בישראל (getIsraelDayRange).
 * מחזיר מערך { from: ISO|null, to: ISO|null }.
 */
export function periodTimeRanges(keys, todayKey, from, to, dayRange) {
  const out = [];
  for (const k of keys || []) {
    const r = resolvePeriod(k, todayKey, from, to);
    if (!r) continue;
    out.push({ from: r.from ? dayRange(r.from).start.toISOString() : null, to: r.to ? dayRange(r.to).end.toISOString() : null });
  }
  return out;
}

/* ------------------------------------- SQL ------------------------------------- */

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const E = 'e'; // כינוי הטבלה

/** ביטוי SQL של סוג המייל (אותם כללים כמו classifyEmail). */
export function typeCaseSql(a = E) {
  const whens = EMAIL_TYPES.map((t) => {
    let cond = `${a}."subject" ~ ${q(t.re)}`;
    if (t.file === true) cond += ` AND NULLIF(${a}."fileName", '') IS NOT NULL`;
    if (t.file === false) cond += ` AND NULLIF(${a}."fileName", '') IS NULL`;
    return `WHEN ${cond} THEN ${q(t.id)}`;
  });
  return `(CASE WHEN ${a}."status" = ${q(MAILING_LIST_STATUS)} THEN ${q(MAILING_LIST_TYPE.id)} ${whens.join(' ')} ELSE ${q(OTHER_TYPE.id)} END)`;
}
/** מספר סידורי של הסוג (למיון לפי סדר הרשימה, לא לפי האלף-בית). */
export function typeOrdinalSql(a = E) {
  const whens = ALL_TYPES.map((t, i) => `WHEN ${q(t.id)} THEN ${i}`);
  return `(CASE ${typeCaseSql(a)} ${whens.join(' ')} ELSE ${ALL_TYPES.length} END)`;
}
export const statusCaseSql = (a = E) => `(CASE WHEN ${a}."status" = 'success' THEN 'sent' WHEN ${a}."status" = ${q(MAILING_LIST_STATUS)} THEN 'subscribed' ELSE 'failed' END)`;
const statusOrdinalSql = (a = E) => `(CASE WHEN ${a}."status" = 'success' THEN 0 WHEN ${a}."status" = ${q(MAILING_LIST_STATUS)} THEN 2 ELSE 1 END)`;
export const orderNoSql = (a = E) => `substring(${a}."subject" from 'הזמנה #([0-9]{1,9})')`;
const filesCountSql = (a = E) => `COALESCE(cardinality(string_to_array(NULLIF(${a}."fileName", ''), ', ')), 0)`;
const isSecretSql = (a = E) => `(${EMAIL_TYPES.filter((t) => t.secret).map((t) => `${a}."subject" ~ ${q(t.re)}`).join(' OR ') || 'FALSE'})`;

const SORT_SQL = {
  sentAt: (a) => `${a}."sentAt"`,
  to: (a) => `lower(${a}."to")`,
  subject: (a) => `lower(${a}."subject")`,
  type: (a) => typeOrdinalSql(a),
  status: (a) => statusOrdinalSql(a),
  files: (a) => filesCountSql(a),
  order: (a) => `(${orderNoSql(a)})::int`,
};

/** escape ל-LIKE: \ % _ -> עם backslash (ברירת המחדל של Postgres). */
export const likeEscape = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

function argBuilder() {
  const args = [];
  return { args, add: (v) => { args.push(v); return `$${args.length}`; } };
}

/**
 * תנאי WHERE: חיפוש + קבוצות הסינון (types / statuses / period / senders). omit = קבוצה שמדלגים עליה (לספירות האפשרויות שלה).
 * ranges = טווחי זמן { from, to } (ISO) של period (מחושבים בשרת לפי שעון ישראל). מחזיר { sql, args } - `args` מקושרים ל-$n לפי הסדר.
 */
export function buildWhere(params, { omit = '', ranges = [], ab = null, a = E } = {}) {
  const b = ab || argBuilder();
  const w = [];
  if (params.search) {
    const p = b.add(`%${likeEscape(params.search)}%`);
    // גוף המייל נחפש רק במיילים רגילים (בגוף של איפוס סיסמה יש סיסמה זמנית)
    w.push(`(${a}."to" ILIKE ${p} OR ${a}."subject" ILIKE ${p} OR (${a}."body" ILIKE ${p} AND NOT ${isSecretSql(a)}))`);
  }
  if (omit !== 'types' && params.types.length) w.push(`${typeCaseSql(a)} = ANY(${b.add(params.types)}::text[])`);
  if (omit !== 'statuses' && params.statuses.length) w.push(`${statusCaseSql(a)} = ANY(${b.add(params.statuses)}::text[])`);
  if (omit !== 'period' && params.period.length && ranges.length) {
    const ors = ranges.map((r) => {
      const c = [];
      if (r.from) c.push(`${a}."sentAt" >= ${b.add(r.from)}::timestamp`);
      if (r.to) c.push(`${a}."sentAt" <= ${b.add(r.to)}::timestamp`);
      return c.length ? `(${c.join(' AND ')})` : 'TRUE';
    });
    w.push(`(${ors.join(' OR ')})`);
  }
  if (omit !== 'senders' && params.senders.length) {
    const ids = params.senders.filter((x) => x !== 'none');
    const parts = [];
    if (ids.length) parts.push(`${a}."employeeId" = ANY(${b.add(ids)}::text[])`);
    if (params.senders.includes('none')) parts.push(`${a}."employeeId" IS NULL`);
    w.push(`(${parts.join(' OR ')})`);
  }
  return { sql: w.length ? w.join(' AND ') : 'TRUE', args: b.args, ab: b };
}

const LIST_COLS = (exportMode) => [
  `${E}."id"`, `${E}."to"`, `${E}."cc"`, `${E}."subject"`, `${E}."fileName"`, `${E}."status"`,
  exportMode ? `CASE WHEN ${E}."status" = 'success' THEN NULL ELSE ${E}."errorMessage" END AS "errorMessage"` : `${E}."errorMessage"`,
  `${E}."customerId"`, `${E}."employeeId"`, `${E}."sentAt"`,
  `${typeCaseSql()} AS "type"`, `${orderNoSql()} AS "orderNo"`,
  ...(exportMode ? [] : [
    `${E}."acknowledgedAt"`, `(${E}."confirmToken" IS NOT NULL) AS "hasToken"`,
    `CASE WHEN ${isSecretSql()} THEN NULL ELSE left(${E}."body", ${BODY_PREVIEW_CHARS}) END AS "bodyPreview"`,
    `${isSecretSql()} AS "bodyHidden"`,
  ]),
].join(', ');

/** שאילתת עמוד הרשימה: { sql, args }. ORDER BY מקבוצת ביטויים קבועה בלבד; ההכרעה היציבה לפי sentAt ואז id. */
export function listSql(params, ranges = []) {
  const w = buildWhere(params, { ranges });
  const expr = SORT_SQL[params.sort](E);
  const dir = params.dir === 'asc' ? 'ASC' : 'DESC';
  const lim = w.ab.add(params.limit);
  const off = w.ab.add((params.page - 1) * params.limit);
  const sql = `SELECT ${LIST_COLS(params.export)} FROM "EmailLog" ${E} WHERE ${w.sql} ORDER BY ${expr} ${dir} NULLS LAST, ${E}."sentAt" DESC, ${E}."id" ASC LIMIT ${lim}::int OFFSET ${off}::int`;
  return { sql, args: w.args };
}

/** ספירת כל השורות התואמות (לעימוד). */
export function countSql(params, ranges = []) {
  const w = buildWhere(params, { ranges });
  return { sql: `SELECT count(*)::int AS "n" FROM "EmailLog" ${E} WHERE ${w.sql}`, args: w.args };
}

/**
 * ספירות האפשרויות (חלון "סינון"): לכל קבוצה - כל שאר הקבוצות והחיפוש מוחלים, והקבוצה עצמה מדולגת (כמו הערכה).
 * מחזיר מילון שאילתות { total, types, statuses, period, senders } - כל אחת { sql, args }.
 * presetRanges = { today: {from,to}, past7..., custom? } (ISO) לספירת תקופות.
 */
export function countsSql(params, ranges, presetRanges) {
  const out = {};
  const base = (omit) => buildWhere(params, { omit, ranges });
  const tot = base('');
  out.total = { sql: `SELECT count(*)::int AS "n" FROM "EmailLog" ${E} WHERE ${tot.sql}`, args: tot.args };
  const ty = base('types');
  out.types = { sql: `SELECT ${typeCaseSql()} AS "k", count(*)::int AS "n" FROM "EmailLog" ${E} WHERE ${ty.sql} GROUP BY 1`, args: ty.args };
  const st = base('statuses');
  out.statuses = { sql: `SELECT ${statusCaseSql()} AS "k", count(*)::int AS "n" FROM "EmailLog" ${E} WHERE ${st.sql} GROUP BY 1`, args: st.args };
  const pe = base('period');
  const keys = Object.keys(presetRanges || {});
  const cols = keys.map((k) => {
    const r = presetRanges[k];
    const c = [];
    if (r.from) c.push(`${E}."sentAt" >= ${pe.ab.add(r.from)}::timestamp`);
    if (r.to) c.push(`${E}."sentAt" <= ${pe.ab.add(r.to)}::timestamp`);
    return `(count(*) FILTER (WHERE ${c.length ? c.join(' AND ') : 'TRUE'}))::int AS ${q(k).replace(/'/g, '"')}`;
  });
  out.period = { sql: `SELECT ${cols.length ? cols.join(', ') : '0 AS "none"'} FROM "EmailLog" ${E} WHERE ${pe.sql}`, args: pe.args, keys };
  const se = base('senders');
  out.senders = {
    sql: `SELECT COALESCE(${E}."employeeId", 'none') AS "k", count(*)::int AS "n" FROM "EmailLog" ${E} WHERE ${se.sql} GROUP BY 1 ORDER BY 2 DESC LIMIT ${SENDER_OPTIONS_MAX}`,
    args: se.args,
  };
  return out;
}

/* ----------------------------------- שורות ----------------------------------- */

/** שם להצגה: fullName, אחרת פרטי + משפחה; ריק -> ''. */
export const personName = (p) => (p ? String(p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim() : '');

const DRIVE_LINK_RE = /^https:\/\/(drive|docs)\.google\.com\/[^\s]+$/;
/** errorMessage של שליחה שהצליחה = "Drive: url1, url2" (קישורי קבצים בדרייב), לא שגיאה. מחזיר מערך { text, url|null }. */
export function parseDriveLinks(errorMessage) {
  const m = typeof errorMessage === 'string' ? errorMessage.match(/^Drive:\s*(.+)$/s) : null;
  if (!m) return [];
  return m[1].split(', ').map((x) => x.trim()).filter(Boolean).map((text) => ({ text, url: DRIVE_LINK_RE.test(text) ? text : null }));
}

/** שמות הקבצים המצורפים ("a.pdf, b.pdf" -> מערך). */
export const fileNames = (fileName) => (typeof fileName === 'string' && fileName.trim() ? fileName.split(', ').map((x) => x.trim()).filter(Boolean) : []);

/**
 * שורה גולמית (listSql) + מילוני שמות -> שורת הרשימה לתצוגה.
 * customers = Map(id -> { legacyId, firstName, lastName }), employees = Map(id -> { fullName, firstName, lastName }).
 */
export function mapEmailLogRow(r, { customers = new Map(), employees = new Map() } = {}) {
  const state = statusKeyOf(r.status);
  const files = fileNames(r.fileName);
  const cust = r.customerId ? customers.get(r.customerId) : null;
  const sender = r.employeeId ? employees.get(r.employeeId) : null;
  const orderNo = r.orderNo != null && r.orderNo !== '' ? Number(r.orderNo) : null;
  return {
    id: r.id,
    to: r.to,
    cc: r.cc || '',
    subject: r.subject || '',
    type: r.type || classifyEmail({ subject: r.subject, status: r.status, fileName: r.fileName }),
    state,
    sentAt: r.sentAt instanceof Date ? r.sentAt.toISOString() : r.sentAt,
    files,
    fileCount: files.length,
    orderNo: Number.isFinite(orderNo) ? orderNo : null,
    customerId: r.customerId || null,
    customerName: personName(cust),
    customerNo: cust && cust.legacyId != null ? cust.legacyId : null,
    senderId: r.employeeId || null,
    senderName: personName(sender),
    error: state === 'failed' ? (r.errorMessage || '') : '',
    driveLinks: state === 'sent' ? parseDriveLinks(r.errorMessage) : [],
    bodyPreview: typeof r.bodyPreview === 'string' && r.bodyPreview !== ORDER_PDF_BODY_FILLER ? r.bodyPreview : '',
    bodyHidden: !!r.bodyHidden,
    acknowledgedAt: r.acknowledgedAt instanceof Date ? r.acknowledgedAt.toISOString() : (r.acknowledgedAt || null),
    hasToken: !!r.hasToken,
  };
}

/** ספירות הסינון: שורות הקבוצות (types / statuses: { k, n }) -> מילון; period -> מילון; senders -> [{ k, n }]. */
export function shapeCounts({ total, types, statuses, period, senders }) {
  const dict = (rows) => Object.fromEntries((rows || []).map((x) => [x.k, Number(x.n) || 0]));
  return {
    total: Number(total) || 0,
    types: dict(types),
    statuses: dict(statuses),
    period: Object.fromEntries(Object.entries(period || {}).map(([k, v]) => [k, Number(v) || 0])),
    senders: (senders || []).map((x) => ({ k: x.k, n: Number(x.n) || 0 })),
  };
}
