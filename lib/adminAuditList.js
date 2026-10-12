// lib/adminAuditList.js - הלוגיקה הטהורה של "היסטוריית נתונים" (/admin/data-history, API: /api/admin/data-history): יומן השינויים (AuditLog).
// בלי prisma ובלי alias: נקרא גם מ-node רגיל (scripts/test_a5_history_lists.mjs) וגם מהלקוח.
//
// מה כאן: ניקוי קלט, בניית ה-WHERE ב-SQL עם פרמטרים (סוג רשומה / פעולה / עובד / תקופה / חיפוש), המיונים המותרים, שמות הרשומות בעברית
// (איך קוראים לכל ישות + מגדר + אייקון), והפיכת changesJson לרשימת שינויים בטוחה לתצוגה: בלי מזהי UUID, בלי שדות פנימיים / רועשים,
// עם הסתרת סודות (סיסמה / PIN / מפתחות API / בנק / ת"ז / שכר לשאינו הנהלה) - אותם כללים כמו עשר שנות ההיסטוריה של כרטיס הלקוח וההזמנה.
//
// הרשאות: שורות ההיסטוריה של עובדים / משמרות / הרשאות / מכשירים / מפתחות (HEAD_ONLY_AUDIT_ENTITIES) נראות להנהלה ראשית / מתכנת בלבד - כמו ב-/api/audit.
// ה-API החדש שמור כולו להנהלה ראשית / מתכנת, אבל הכלל נאכף גם כאן בפונקציה הטהורה (visibleTypes / buildAuditWhere) ונבדק בנפרד.
import {
  COUNT_CAP, MAX_ID_LIST, SqlArgs, cleanSearch, csv, dateKey, likePattern, parsePaging, periodSql, pickKnown,
} from './adminLogList.js';
import { modelDisplayName } from './modelDisplay.js';
import { isSensitiveKey } from './redactSensitive.js';
import { cleanText } from './history/sanitize.js';

export { COUNT_CAP };

// אותה רשימה כמו HEAD_ONLY_AUDIT_ENTITIES ב-app/api/audit/route.js (נבדק בבדיקה שהן זהות)
export const HEAD_ONLY_AUDIT_ENTITIES = Object.freeze(['Employee', 'Shift', 'EmployeePermissionOverride', 'DepartmentPermission', 'PermissionPageGroup', 'TrustedDevice', 'ApiKey', 'Department']);
// עלויות שכר: מוסתרים מכל מי שאינו הנהלה ראשית גם בתוך שורות שמותר לראות
export const WAGE_KEYS = Object.freeze(['hourlyWage', 'hourlyWageSnapshot', 'travelExpenses', 'travelExpensesSnapshot', 'totalCalculated', 'paymentMethod']);

/* ------------------------------ שמות הרשומות בעברית ------------------------------ */

// l = שם, g = מגדר הפועל (m = נוצר / עודכן / נמחק, f = נוצרה / עודכנה / נמחקה), i = אייקון מה-sprite
export const ENTITY_META = Object.freeze({
  Order: { l: 'הזמנה', g: 'f', i: 'file' },
  OrderItem: { l: 'פריט בהזמנה', g: 'm', i: 'dress', short: 'פריט' },
  Customer: { l: 'לקוח', g: 'm', i: 'user' },
  Payment: { l: 'תשלום', g: 'm', i: 'cash', short: 'תשלום' },
  PaymentObligation: { l: 'חיוב', g: 'm', i: 'card', short: 'חיוב' },
  Refund: { l: 'זיכוי', g: 'm', i: 'wallet' },
  DressModel: { l: 'דגם', g: 'm', i: 'dress' },
  DressItem: { l: 'פריט דגם', g: 'm', i: 'tag' },
  Employee: { l: 'עובד', g: 'm', i: 'users' },
  Shift: { l: 'משמרת', g: 'f', i: 'clock' },
  Department: { l: 'מחלקה', g: 'f', i: 'building' },
  DepartmentPermission: { l: 'הרשאת מחלקה', g: 'f', i: 'lock' },
  EmployeePermissionOverride: { l: 'הרשאה אישית', g: 'f', i: 'lock' },
  PermissionPageGroup: { l: 'שורת הרשאה', g: 'f', i: 'lock' },
  TrustedDevice: { l: 'מכשיר מהימן', g: 'm', i: 'shield' },
  ApiKey: { l: 'מפתח גישה', g: 'm', i: 'key' },
  EmailLog: { l: 'מייל', g: 'm', i: 'mail' },
  Notification: { l: 'הודעה', g: 'f', i: 'bell' },
  ErrorReport: { l: 'דיווח שגיאה', g: 'm', i: 'sn-bug' },
  ErrorReportReply: { l: 'תגובה לדיווח', g: 'f', i: 'msg' },
  AIChatSession: { l: 'שיחת AI', g: 'f', i: 'sparkle' },
  QueryLog: { l: 'שאילתת AI', g: 'f', i: 'search' },
  Attachment: { l: 'קובץ מצורף', g: 'm', i: 'clip' },
  ScheduleStageMark: { l: 'סימון בלו״ז', g: 'm', i: 'check' },
  SystemSetting: { l: 'הגדרה', g: 'f', i: 'gear' },
  PricingRule: { l: 'כלל תמחור', g: 'm', i: 'cash' },
  PriceList: { l: 'מחירון', g: 'm', i: 'cash' },
  PriceCategory: { l: 'קטגוריית מחיר', g: 'f', i: 'tag' },
  SavedSearch: { l: 'חיפוש שמור', g: 'm', i: 'search' },
});
export const entityMeta = (type) => ENTITY_META[type] || { l: String(type || 'רשומה'), g: 'm', i: 'note' };
export const entityLabel = (type) => entityMeta(type).l;
export const entityIcon = (type) => entityMeta(type).i;

/* ------------------------------ פעולות ------------------------------ */

// קבוצות הפעולה בחלון הסינון -> תנאי SQL על עמודת action (קבועים בלבד, בלי קלט משתמש)
export const ACTION_GROUPS = Object.freeze({
  create: { l: 'יצירה', i: 'plus', sql: (c) => `${c} = 'CREATE'` },
  update: { l: 'עדכון', i: 'pencil', sql: (c) => `${c} IN ('UPDATE', 'UPDATE_ORDER')` },
  delete: { l: 'מחיקה', i: 'trash', sql: (c) => `${c} = 'DELETE'` },
  cancel: { l: 'ביטול', i: 'undo', sql: (c) => `${c} LIKE 'CANCEL\\_%' ESCAPE '\\'` },
  other: { l: 'פעולה אחרת', i: 'sliders', sql: (c) => `(${c} NOT IN ('CREATE', 'UPDATE', 'UPDATE_ORDER', 'DELETE') AND ${c} NOT LIKE 'CANCEL\\_%' ESCAPE '\\')` },
});
export const ACTION_GROUP_KEYS = Object.freeze(Object.keys(ACTION_GROUPS));
/** ביטוי CASE שמחזיר את מפתח הקבוצה של פעולה (לספירות). */
export const actionGroupCase = (c) => `CASE WHEN ${c} = 'CREATE' THEN 'create' WHEN ${c} IN ('UPDATE', 'UPDATE_ORDER') THEN 'update' WHEN ${c} = 'DELETE' THEN 'delete' WHEN ${c} LIKE 'CANCEL\\_%' ESCAPE '\\' THEN 'cancel' ELSE 'other' END`;

const BASIC_VERBS = { CREATE: ['נוצר', 'נוצרה'], UPDATE: ['עודכן', 'עודכנה'], UPDATE_ORDER: ['עודכן', 'עודכנה'], DELETE: ['נמחק', 'נמחקה'] };

/** הנושא של השורה: "הזמנה #53375" / "לקוח דוד כהן" / "פריט בהזמנה #53375" (בלי מזהה = סוג הרשומה בלבד). */
export function subjectOf(type, entity) {
  const meta = entityMeta(type);
  if (entity && entity.name) return `${meta.l} ${entity.name}`;
  if (entity && entity.ref) return entity.within ? `${meta.short || meta.l} בהזמנה #${entity.ref}` : `${meta.l} #${entity.ref}`;
  return meta.l;
}
/** הפועל / שם הפעולה: יצירה / עדכון / מחיקה בהטיית מגדר הרשומה ("עודכנה"), אחרת התרגום (actionLabels = ACTION_TRANSLATIONS, מוזרק מהלקוח). */
export function verbOf(type, action, actionLabels = {}) {
  const basic = BASIC_VERBS[action];
  return basic ? basic[entityMeta(type).g === 'f' ? 1 : 0] : (actionLabels[action] || humanizeAction(action));
}
/**
 * המשפט האנושי של שורה: "הזמנה #53375 · עודכנה" / "פריט בהזמנה #53375 · אישור השכרה".
 * entity = { ref?, name? } אחרי פתרון; actionLabels = ACTION_TRANSLATIONS (מוזרק מהלקוח). בלי מזהה = בלי ' #'.
 */
export function sentenceOf(type, action, entity, actionLabels = {}) {
  return `${subjectOf(type, entity)} · ${verbOf(type, action, actionLabels)}`;
}
/** פעולה בלי תרגום: CANCEL_SOMETHING -> "ביטול ..." לא ניתן לנחש; מחזיר את המפתח בלי קווים תחתונים (עדיף מאנגלית עם מקף). */
export function humanizeAction(action) {
  return String(action || '').toLowerCase().replace(/_/g, ' ');
}

/* ------------------------------ פרמטרים ------------------------------ */

export const AUDIT_SORT_KEYS = Object.freeze(['time', 'type', 'action', 'employee', 'size']);
const ID_RE = /^[0-9a-zA-Z-]{8,40}$/;
const TYPE_RE = /^[A-Za-z][A-Za-z0-9]{1,40}$/;

/** קלט גולמי (query או JSON) -> פרמטרים מנורמלים ובטוחים. מפתחות לא מוכרים נזרקים. */
export function parseAuditListParams(input) {
  const p = input && typeof input === 'object' ? input : {};
  const employees = [...new Set(csv(p.employees).filter((x) => x === 'system' || ID_RE.test(x)))].slice(0, MAX_ID_LIST);
  return {
    ...parsePaging(p),
    search: cleanSearch(p.search),
    sort: AUDIT_SORT_KEYS.includes(p.sort) ? p.sort : 'time',
    dir: p.dir === 'asc' ? 'asc' : 'desc',
    types: [...new Set(csv(p.types).filter((x) => TYPE_RE.test(x)))].slice(0, MAX_ID_LIST),
    actions: pickKnown(p.actions, ACTION_GROUP_KEYS),
    employees,
    period: pickKnown(p.period, ['today', 'd7', 'd30', 'year', 'custom']),
    from: dateKey(p.from),
    to: dateKey(p.to),
    variant: 0,
  };
}

// ביטוי Postgres (ARE) קבוע: סיסמה זמנית במייל, או password / pinHash / keyHash עם ערך שאינו המסכה '***' (גם בצורת {"from":...}). [{] במקום \{ - בלי backslash בתוך template.
export const SECRET_ROW_RE_SQL = `'(סיסמה זמנית|"(password|pinHash|keyHash)":([{]"from":)?"[^*"])'`;

/** סוגי הרשומות שהצופה רשאי לראות מבין הנבחרים. null = אין סינון סוג (הכול מותר) ; מערך = רק אלה. isHead=false: בלי HEAD_ONLY. */
export function visibleTypes(types, isHead) {
  if (isHead) return types.length ? types : null;
  return types.length ? types.filter((t) => !HEAD_ONLY_AUDIT_ENTITIES.includes(t)) : null;
}

/**
 * ה-WHERE של הרשימה / הספירות. ctx = { isHead, todayKey, dayRange }. skip = קבוצה שמדלגים עליה (ספירות האפשרויות של אותה קבוצה: 'types'|'actions'|'employees'|'period').
 * מחזיר { where: 'WHERE ...'|'', args, empty: true אם התנאי הוא בהכרח ריק (למשל סוג שאסור לצופה) }.
 */
export function buildAuditWhere(params, ctx, skip = '') {
  const a = new SqlArgs();
  const conds = [];
  let empty = false;
  const t = 'a."entityType"';
  if (skip !== 'types') {
    const vis = visibleTypes(params.types, ctx.isHead);
    if (vis && vis.length === 0) empty = true;
    else if (vis) conds.push(`${t} = ANY(${a.p(vis)}::text[])`);
  }
  if (!ctx.isHead) conds.push(`${t} <> ALL(${a.p([...HEAD_ONLY_AUDIT_ENTITIES])}::text[])`);
  if (skip !== 'actions' && params.actions.length) conds.push(`(${params.actions.map((k) => ACTION_GROUPS[k].sql('a."action"')).join(' OR ')})`);
  if (skip !== 'employees' && params.employees.length) {
    const ids = params.employees.filter((x) => x !== 'system');
    const parts = [];
    if (ids.length) parts.push(`a."employeeId" = ANY(${a.p(ids)}::text[])`);
    if (params.employees.includes('system')) parts.push('a."employeeId" IS NULL');
    conds.push(`(${parts.join(' OR ')})`);
  }
  if (skip !== 'period' && params.period.length) {
    const c = periodSql('a."createdAt"', params.period, params.from, params.to, ctx.todayKey, ctx.dayRange, a);
    if (c) conds.push(c);
  }
  if (params.search) {
    // חיפוש בתוך פרטי השינוי (הערך הישן / החדש) - כמו הדף הישן; מספר הזמנה מתאים גם למזהה הישות (שורות שנכתבו ידנית עם orderId)
    const like = a.p(likePattern(params.search));
    // ה-ILIKE קודם: הביטוי הרגולרי רץ רק על שורות שכבר תאמו (על 400 אלף שורות הוא מכפיל פי 3 את זמן החיפוש אם הוא רץ על כולן)
    const parts = [`(a."changesJson" ILIKE ${like} ESCAPE '\\' AND a."changesJson" !~ ${SECRET_ROW_RE_SQL})`];
    if (/^\d{1,9}$/.test(params.search)) parts.push(`a."entityId" = ${a.p(params.search)}`);
    if (ctx.searchEntityIds && ctx.searchEntityIds.length) parts.push(`a."entityId" = ANY(${a.p(ctx.searchEntityIds)}::text[])`);
    // החיפוש אינו אורקל לסודות: שורות שעדיין מחזיקות ערך סודי גלוי (סיסמה זמנית של מייל איפוס, או password / pinHash / keyHash שנכתבו לפני ההסתרה בכתיבה)
    // לא מחזירות תוצאות חיפוש טקסט, כך שאי אפשר לנחש את הערך תו אחר תו (הערכים עצמם מוסתרים בתצוגה - buildChangeList). קבוע בלבד, בלי קלט משתמש. (ממצא F10, 11.10.2026)
    conds.push(`(${parts.join(' OR ')})`);
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', args: a.args, empty };
}

/** ORDER BY (רק מפתחות מהרשימה הלבנה). employee דורש JOIN (join:true). */
export function auditOrderBy(sort, dir) {
  const d = dir === 'asc' ? 'ASC' : 'DESC';
  const tie = 'a."createdAt" DESC, a.id DESC';
  switch (sort) {
    case 'type': return { join: false, sql: `a."entityType" ${d}, ${tie}` };
    case 'action': return { join: false, sql: `a."action" ${d}, ${tie}` };
    case 'employee': return { join: true, sql: `e."fullName" ${d} NULLS LAST, ${tie}` };
    case 'size': return { join: false, sql: `length(a."changesJson") ${d}, ${tie}` };
    default: return { join: false, sql: `a."createdAt" ${d}, a.id ${d}` };
  }
}

/* ------------------------------ שינויים: JSON -> רשימה בטוחה ------------------------------ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v.trim());
const isFromTo = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v);
const isEmpty = (v) => v === null || v === undefined || v === '';

// שדות פנימיים / רועשים שלא נראה בהיסטוריה: מזהים, חותמות זמן שהמערכת מנהלת, מפתחות פונטיים, שדות שפורשו מחדש
export const NOISE_KEYS = Object.freeze(new Set([
  'id', 'legacyId', 'createdAt', 'updatedAt', 'deletedAt', 'firstNamePhoneticKey', 'lastNamePhoneticKey', 'emailSuffix', 'isWeekdayEvent',
  'clientEventId', 'approverId', 'serverBootId', 'lastUsedAt', 'themeColor',
]));
// ערכים ארוכים שאין בהם עניין בהיסטוריה ושעלולים להכיל סודות (גוף מייל עם סיסמה זמנית, שיחת AI)
export const HIDDEN_VALUE_KEYS = Object.freeze(new Set(['body', 'messagesJson', 'html', 'password', 'pinHash', 'keyHash']));
export const MASKED = 'מוסתר';
// שדות שהערך "לא" / 0 שלהם הוא חלק מהסיפור (ביטול סימון, שחזור מחיקה): נשארים גם בשורות שטוחות. בשאר השדות false / 0 הם ברירת מחדל רועשת (שורת CREATE מלאה).
export const MEANINGFUL_FALSE = Object.freeze(new Set(['isDeleted', 'isTaken', 'isReturned', 'returnedOk', 'isActive', 'isPaid', 'done', 'alterationDone', 'isRead', 'isArchived']));
export const REASSIGNED = Object.freeze({ set: 'נקבע', unset: 'הוסר', swap: 'הוחלף' });
const MAX_FIELDS = 60;
const MAX_TEXT = 300;

function cleanValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return cleanText(v, MAX_TEXT);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  try {
    const s = JSON.stringify(v);
    return cleanText(s, MAX_TEXT);
  } catch { return ''; }
}

/**
 * changesJson -> רשימת שינויים לתצוגה: [{ key, edit: boolean, from, to, masked? }].
 *  * UPDATE ({field:{from,to}}): רק שדות שהערך שלהם באמת השתנה. CREATE / שורות שטוחות ({field:value}): רק ערכים לא ריקים / לא ברירת-מחדל (false / 0 / [] לא נאמרים).
 *  * מזהה UUID לעולם לא מוצג: שדה שערכו UUID מוסתר; החלפת הפניה ({from:uuid,to:uuid}) הופכת ל"הוחלף / נקבע / הוסר" בלי המזהים.
 *  * סודות: מפתח רגיש (isSensitiveKey) / HIDDEN_VALUE_KEYS -> הערך מוסתר (masked), לא נשלח; שכר לשאינו הנהלה (canSeeWages=false) - לא מופיע בכלל.
 *  * טקסט: cleanText (בלי כרטיסי אשראי / ת"ז / חשבונות / UUID בתוך טקסט), עד 300 תווים.
 * מחזיר { list, n } - n = כמה שינויים יש בסך הכול (list חתוך ל-limit).
 */
export function buildChangeList(changesJson, { canSeeWages = false, limit = MAX_FIELDS } = {}) {
  let obj = null;
  if (changesJson && typeof changesJson === 'object') obj = changesJson;
  else if (typeof changesJson === 'string' && changesJson) {
    try { obj = JSON.parse(changesJson); } catch { obj = null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { list: [], n: 0 };
  const out = [];
  for (const [key, raw] of Object.entries(obj)) {
    if (NOISE_KEYS.has(key)) continue;
    if (!canSeeWages && WAGE_KEYS.includes(key)) continue;
    const secret = isSensitiveKey(key) || HIDDEN_VALUE_KEYS.has(key);
    if (isFromTo(raw)) {
      const { from, to } = raw;
      if (isEmpty(from) && isEmpty(to)) continue;
      if (String(from) === String(to)) continue;
      if (secret) { out.push({ key, edit: true, from: null, to: null, masked: true }); continue; }
      if (isUuid(from) || isUuid(to)) {
        out.push({ key, edit: true, from: null, to: isEmpty(from) ? REASSIGNED.set : isEmpty(to) ? REASSIGNED.unset : REASSIGNED.swap, ref: true });
        continue;
      }
      out.push({ key, edit: true, from: cleanValue(from), to: cleanValue(to) });
      continue;
    }
    // ערך שטוח (CREATE / עדכון בלי לפני-אחרי)
    if (isEmpty(raw) || (Array.isArray(raw) && raw.length === 0)) continue;
    if ((raw === false || raw === 0) && !MEANINGFUL_FALSE.has(key)) continue;
    if (isUuid(raw)) continue;
    if (secret) { out.push({ key, edit: false, from: null, to: null, masked: true }); continue; }
    out.push({ key, edit: false, from: null, to: cleanValue(raw) });
  }
  return { list: out.slice(0, limit), n: out.length };
}

/* ------------------------------ ישויות: מזהה -> שם קצר ------------------------------ */

/** מארגן את מזהי הישויות של עמוד שורות לפי סוג, למשיכה אחת לכל סוג. מחזיר { Order: {uuids:[], nums:[]}, Customer: [ids], ... } */
export function entityIdsByType(rows) {
  const by = {};
  for (const r of rows) {
    const id = String(r.entityId || '');
    if (!id) continue;
    const g = by[r.entityType] || (by[r.entityType] = new Set());
    g.add(id);
  }
  return by;
}

const fullName = (o) => [o && o.firstName, o && o.lastName].filter(Boolean).join(' ').trim();

/** שם קצר מתוך שורה שנמצאה (או null אם הישות נמחקה / לא נמצאה). href = קישור אל הישות (דף קיים); לעולם לא מציגים UUID. */
export function shapeEntity(type, found) {
  if (!found) return { ref: '', name: '', href: '' };
  switch (type) {
    case 'Order': return { ref: String(found.orderId), name: '', href: `/orders/${found.orderId}`, who: fullName(found.customer) };
    case 'OrderItem': case 'Payment': case 'PaymentObligation':
      return found.orderId ? { ref: String(found.orderId), name: '', href: `/orders/${found.orderId}`, within: true } : { ref: '', name: '', href: '' };
    case 'Customer': return { ref: found.legacyId ? String(found.legacyId) : '', name: fullName(found), href: `/customers/${found.id}` };
    case 'DressModel': return { ref: '', name: modelDisplayName(found, { fallback: '' }), href: `/dashboard/dresses/${found.id}` };
    case 'DressItem': return { ref: '', name: [found.dressModel && modelDisplayName(found.dressModel, { fallback: '' }), found.sizeText ? `(${found.sizeText})` : ''].filter(Boolean).join(' '), href: found.dressModelId ? `/dashboard/dresses/${found.dressModelId}` : '' };
    case 'Employee': return { ref: '', name: found.fullName || fullName(found), href: `/employees/${found.id}` };
    case 'ErrorReport': return { ref: String(found.id).slice(0, 8), name: '', href: '' };
    default: return { ref: '', name: '', href: '' };
  }
}

/** שם מתוך ה-changesJson לישויות שאין להן שורה לשלוף (או שנמחקו): שם שורת הרשאה / מפתח / מחלקה / נושא מייל. */
export function nameFromChanges(type, changesJson) {
  const key = { PermissionPageGroup: 'name', ApiKey: 'name', Department: 'name', EmailLog: 'subject', Notification: 'title' }[type];
  if (!key || !changesJson || changesJson.length > 20000) return '';
  try {
    const o = JSON.parse(changesJson);
    const v = o && o[key];
    return typeof v === 'string' ? cleanText(v, 60) : '';
  } catch { return ''; }
}

/** מספר הזמנה מתוך תיאור "שורה בהזמנה": OrderItem / Payment / PaymentObligation נושאים orderId בעמודה (ר' shapeEntity.within). */
export const WITHIN_ORDER_TYPES = Object.freeze(['OrderItem', 'Payment', 'PaymentObligation']);
