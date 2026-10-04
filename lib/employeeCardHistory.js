// בניית שורות תצוגה להיסטוריית כרטיס העובד (טאב "היסטוריה" בכרטיס החדש) משורות AuditLog גולמיות.
// קובץ ESM טהור: בלי Next / Prisma / React, כדי שאפשר יהיה לבדוק אותו ב-node בלבד
// (scripts/test_employee_card_history.mjs). לעולם לא זורק - JSON פגום או שדות חסרים נותנים שורה
// בלי פירוט ולא קריסה. תאריכים לא מעוצבים כאן (ה-UI מעצב תאריך עברי) - עוברים כ-ISO בלבד.
//
// כללי הנרמול זהים לטאב הישן (components/employees/ModernEmployeeHistoryTab.js):
// צורת תמונת-מצב ישנה {from:{...}, to:{...}} של שורות משמרת, הסתרת שדות טכניים, והשמטת
// שינויים ריקים או שווים.
import { israelTime } from './attendance/summary.js';

// שדות טכניים שאין טעם להציג בהיסטוריה (מזהים/חותמות עדכון/יצירה)
const HIDDEN_FIELDS = ['id', 'employeeId', 'legacyId', 'updatedAt', 'createdAt'];

// שדות שמכילים סודות - הראוט כבר מסווה אותם, וכאן הגנה נוספת למקרה שהגיעו גולמיים
const SECRET_FIELDS = ['password', 'pinHash'];

export const FIELD_T = {
  firstName: 'שם פרטי',
  lastName: 'שם משפחה',
  phone1: 'טלפון 1',
  phone2: 'טלפון 2',
  city: 'עיר',
  street: 'רחוב',
  houseNum: 'מספר בית',
  email: 'דוא"ל',
  notes: 'הערות',
  isDeleted: 'נמחק/בוטל',
  joinDate: 'תאריך הצטרפות',
  fullName: 'שם מלא',
  roleId: 'מזהה תפקיד',
  isActive: 'פעיל',
  hourlyWage: 'שכר שעתי',
  hourlyWageSnapshot: 'שכר שעתי במשמרת',
  travelExpensesSnapshot: 'נסיעות במשמרת',
  profileImage: 'תמונת פרופיל',
  paymentMethod: 'אמצעי תשלום',
  travelExpenses: 'הוצאות נסיעה',
  date: 'תאריך',
  hebrewDate: 'תאריך עברי',
  entryTime: 'שעת כניסה',
  exitTime: 'שעת יציאה',
  totalMinutes: 'סה"כ דקות',
  totalCalculated: 'סה"כ לתשלום',
  subject: 'נושא',
  to: 'אל',
  cc: 'עותק',
  body: 'תוכן',
  sendMode: 'יעד הקבצים',
  password: 'סיסמה',
  pinHash: 'קוד כניסה',
};

const ACTION_LABELS = {
  CREATE: 'יצירה',
  UPDATE: 'עדכון',
  DELETE: 'מחיקה',
  EMAIL_SENT: 'שליחת מייל',
};

const SEND_MODE_LABELS = {
  email: 'צרופה למייל',
  drive: 'העלאה לדרייב + שיתוף',
  both: 'גם וגם',
};

const PERMISSION_ENTITY = 'EmployeePermissionOverride';
const PERMISSION_REMOVED_TEXT = 'חריגה אישית הוסרה (חזרה לברירת המחדל של המחלקה)';
const LONG_TEXT_LENGTH = 60;

const isEmpty = (v) => v === null || v === undefined || v === '';
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function parseJson(raw) {
  if (isPlainObject(raw) || Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

// ערך בודד לתצוגה: בוליאני כן/לא, ריק "-", מערך מחובר בפסיקים
function formatValue(v) {
  if (isEmpty(v)) return '-';
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  if (Array.isArray(v)) {
    const parts = v.map(formatValue).filter((x) => x !== '-');
    return parts.length ? parts.join(', ') : '-';
  }
  if (isPlainObject(v)) {
    try { return JSON.stringify(v); } catch (e) { return '-'; }
  }
  return String(v);
}

// שעות כניסה/יציאה נשמרות כ-ISO ב-UTC - מוצגות כשעה בלבד בשעון ישראל (בלי תאריך לועזי). ערך שאינו חותמת
// זמן מלאה (למשל "08:00" מצורת תמונת-מצב ישנה) עובר כמו שהוא.
const TIME_KEYS = new Set(['entryTime', 'exitTime']);
const FULL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;
function formatTimeValue(v) {
  if (v instanceof Date) return israelTime(v) || '-';
  if (typeof v === 'string' && FULL_TIMESTAMP.test(v)) return israelTime(v) || v;
  return formatValue(v);
}

// תמונת פרופיל נשמרת כ-data URL ענק (base64) - לעולם לא מוצגת; רק תווית.
const PROFILE_IMAGE_KEY = 'profileImage';
export const PROFILE_IMAGE_UPDATED_TEXT = 'תמונת פרופיל עודכנה';
export const PROFILE_IMAGE_REMOVED_TEXT = 'תמונת פרופיל הוסרה';
const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:');
// מה שהשרת מציב במקום ה-blob (data: נשמר כדי שהזיהוי כאן ימשיך לעבוד)
export const OMITTED_DATA_URL = 'data:omitted';

/**
 * מסיר (בצד שרת) data URL של profileImage מתוך changesJson של שורות יומן לפני סריאליזציה.
 * מחזיר עותקים - לא משנה את הקלט. שורה שאי אפשר לפענח נשארת כמו שהיא.
 */
export function stripProfileImages(logs) {
  if (!Array.isArray(logs)) return logs;
  const strip = (node, inProfile) => {
    if (isDataUrl(node) && inProfile) return OMITTED_DATA_URL;
    if (Array.isArray(node)) return node.map((x) => strip(x, inProfile));
    if (isPlainObject(node)) {
      const o = {};
      for (const k of Object.keys(node)) o[k] = strip(node[k], inProfile || k === PROFILE_IMAGE_KEY);
      return o;
    }
    return node;
  };
  return logs.map((log) => {
    if (!log || typeof log.changesJson !== 'string' || !log.changesJson.includes(PROFILE_IMAGE_KEY) || !log.changesJson.includes('data:')) return log;
    const parsed = parseJson(log.changesJson);
    if (parsed === null) return log;
    return { ...log, changesJson: JSON.stringify(strip(parsed, false)) };
  });
}

const isLong = (key, text) => key === 'body' || String(text).length > LONG_TEXT_LENGTH || String(text).includes('\n');

/**
 * מנרמל את changesJson של שורת משמרת/עובד ישנה שנכתבה כתמונת מצב עטופה תחת from/to
 * (ראו ModernEmployeeHistoryTab). כל צורה אחרת מוחזרת כמו שהיא.
 */
function normalizeSnapshotShape(changes, action) {
  if (!isPlainObject(changes)) return changes;
  const keys = Object.keys(changes);
  const toObj = isPlainObject(changes.to) ? changes.to : null;
  const fromObj = isPlainObject(changes.from) ? changes.from : null;
  const isSnapshot = keys.length > 0 && keys.every((k) => k === 'from' || k === 'to') && (toObj || fromObj);
  if (!isSnapshot) return changes;

  const result = {};
  if (toObj && fromObj) {
    const allKeys = new Set([...Object.keys(fromObj), ...Object.keys(toObj)]);
    allKeys.forEach((key) => {
      if (HIDDEN_FIELDS.includes(key)) return;
      if (String(fromObj[key]) === String(toObj[key])) return;
      result[key] = { from: fromObj[key], to: toObj[key] };
    });
  } else if (toObj) {
    Object.keys(toObj).forEach((key) => {
      if (HIDDEN_FIELDS.includes(key)) return;
      // ב"יצירה" אין טעם להציג דגלים בוליאניים במצב ברירת המחדל שלהם (למשל isDeleted: false)
      if (action === 'CREATE' && toObj[key] === false) return;
      result[key] = toObj[key];
    });
  }
  return result;
}

const isFromTo = (v) => isPlainObject(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => k === 'from' || k === 'to');

// שורת Employee / Shift רגילה -> רשימת שינויים
function genericChanges(log) {
  const parsed = parseJson(log.changesJson);
  const normalized = normalizeSnapshotShape(parsed, log.action);
  if (!isPlainObject(normalized)) return [];

  const out = [];
  for (const key of Object.keys(normalized)) {
    if (HIDDEN_FIELDS.includes(key)) continue;
    // {deleted:true} של מחיקה אוטומטית אינו פירוט שימושי
    if (key === 'deleted' && normalized[key] === true) continue;
    const label = FIELD_T[key] || key;
    let raw = normalized[key];
    if (key === PROFILE_IMAGE_KEY) {
      const pair = isFromTo(raw) ? raw : { to: raw };
      if (isDataUrl(pair.from) || isDataUrl(pair.to)) {
        if (String(pair.from) === String(pair.to)) continue;
        const text = isDataUrl(pair.to) ? PROFILE_IMAGE_UPDATED_TEXT : PROFILE_IMAGE_REMOVED_TEXT;
        out.push({ key, label, from: null, to: text, long: false, kind: 'value' });
        continue;
      }
    }
    const fmt = TIME_KEYS.has(key) ? formatTimeValue : formatValue;
    if (isFromTo(raw)) {
      let { from, to } = raw;
      if (isEmpty(from) && isEmpty(to)) continue;
      if (String(from) === String(to)) continue;
      if (SECRET_FIELDS.includes(key)) { from = '***'; to = '***'; }
      const f = fmt(from);
      const t = fmt(to);
      out.push({ key, label, from: f, to: t, long: isLong(key, f) || isLong(key, t), kind: 'change' });
    } else {
      if (isEmpty(raw)) continue;
      if (SECRET_FIELDS.includes(key)) raw = '***';
      const t = fmt(raw);
      out.push({ key, label, from: null, to: t, long: isLong(key, t), kind: 'value' });
    }
  }
  return out;
}

const listText = (v) => {
  if (Array.isArray(v)) return v.filter((x) => !isEmpty(x)).map(String).join(', ');
  return isEmpty(v) ? '' : String(v);
};

// שורת EMAIL_SENT -> שורות קריאות (בלי JSON גולמי, בלי כתובות דרייב, בלי גדלי קבצים)
function emailChanges(log) {
  const data = parseJson(log.changesJson);
  if (!isPlainObject(data)) return [];

  const out = [];
  const push = (key, label, text, long = false) => {
    if (isEmpty(text) || text === '') return;
    out.push({ key, label, from: null, to: text, long, kind: 'value' });
  };

  // הסדר של העיצוב המאושר (כרטיס-עובד-ניהול.html): נושא, אל, עותק, תוכן, יעד
  push('subject', FIELD_T.subject, listText(data.subject));
  push('to', FIELD_T.to, listText(data.to));
  push('cc', FIELD_T.cc, listText(data.cc));
  push('body', FIELD_T.body, isEmpty(data.body) ? '' : String(data.body), true);

  if (!isEmpty(data.sendMode)) {
    push('sendMode', FIELD_T.sendMode, SEND_MODE_LABELS[data.sendMode] || String(data.sendMode));
  }

  if (Array.isArray(data.files)) {
    const names = data.files
      .map((f) => (isPlainObject(f) ? f.fileName : f))
      .filter((n) => !isEmpty(n))
      .map(String);
    push('files', 'קבצים', names.join(', '));
  }

  if (Array.isArray(data.driveLinks) && data.driveLinks.length > 0) {
    const n = data.driveLinks.length;
    push('driveLinks', 'קישורי דרייב', n === 1 ? '1 קישור' : `${n} קישורים`);
  }
  return out;
}

// ערך חריגת הרשאה -> 'מותר' / 'לא מותר' / המספר
function permissionValueText(v) {
  if (v === true || v === 'true') return 'מותר';
  if (v === false || v === 'false') return 'לא מותר';
  if (isEmpty(v)) return '-';
  return String(v);
}

// מוציא מ-changesJson של שורת חריגה: מפתח ההרשאה ושינוי ערך. הצורות האפשריות:
//   CREATE: שורת החריגה המלאה {id, employeeId, key, value:'true', note...}
//   UPDATE: data של הכתיבה {value:'false'} / {value:{set:'false'}} / {value:{from,to}}
//   DELETE: {deleted:true} (בלי מפתח) או {key,...} אם נרשם תיאור מפורש
function readPermissionPayload(log) {
  const data = parseJson(log.changesJson);
  if (!isPlainObject(data)) return { key: null, hasValue: false };
  let key = typeof data.key === 'string' && data.key ? data.key : null;
  // תיאור מפורש מסוג {key: {from,to}} אינו קיים, אבל נגן גם על from/to עטוף
  const snapshot = isPlainObject(data.to) ? data.to : null;
  if (!key && snapshot && typeof snapshot.key === 'string') key = snapshot.key;

  let value = data.value;
  if (value === undefined && snapshot) value = snapshot.value;
  if (isPlainObject(value) && 'set' in value) value = value.set;
  if (isFromTo(value)) return { key, hasValue: true, from: value.from, to: value.to };
  return { key, hasValue: value !== undefined, to: value };
}

function permissionChanges(log, keyHint, catalogLabel) {
  const payload = readPermissionPayload(log);
  const key = payload.key || keyHint || null;
  let label = 'הרשאה אישית';
  if (key) {
    try { label = catalogLabel(key) || key; } catch (e) { label = key; }
  }

  if (log.action === 'DELETE') {
    return [{ key: key || 'permission', label, from: null, to: PERMISSION_REMOVED_TEXT, long: false, kind: 'value' }];
  }
  if (!payload.hasValue) return [];
  if (payload.from !== undefined) {
    return [{
      key: key || 'permission', label,
      from: permissionValueText(payload.from), to: permissionValueText(payload.to),
      long: false, kind: 'change',
    }];
  }
  return [{ key: key || 'permission', label, from: null, to: permissionValueText(payload.to), long: false, kind: 'value' }];
}

function entityLabelOf(entityType) {
  if (entityType === 'Employee') return 'עובד';
  if (entityType === 'Shift') return 'משמרת';
  if (entityType === PERMISSION_ENTITY) return 'הרשאה';
  return entityType || '';
}

function actionLabelOf(action, isPermission) {
  if (isPermission) return action === 'DELETE' ? 'הסרת חריגת הרשאה' : 'שינוי הרשאה';
  return ACTION_LABELS[action] || action || '';
}

function chipToneOf(action, isPermission) {
  if (isPermission) return 'blue';
  if (action === 'CREATE') return 'green';
  if (action === 'DELETE') return 'red';
  if (action === 'UPDATE') return 'blue';
  return 'gray';
}

function iconOf(log, isPermission) {
  if (isPermission) return 'shield';
  if (log.action === 'EMAIL_SENT') return 'mail';
  if (log.entityType === 'Shift') return 'clock';
  return 'user';
}

function firstChangeLabelOf(changes) {
  if (!changes.length) return '';
  const rest = changes.length - 1;
  return rest > 0 ? `${changes[0].label} ועוד ${rest}` : changes[0].label;
}

/**
 * הופך שורות AuditLog גולמיות (עם employeeName אם צורף ע"י attachEmployeeNames) לשורות תצוגה.
 * שומר על סדר הקלט. `catalogLabel(key)` מתרגם מפתח הרשאה לשם עברי (ברירת מחדל: המפתח עצמו).
 */
export function buildHistoryRows(logs, { catalogLabel = (key) => key } = {}) {
  const list = Array.isArray(logs) ? logs.filter((l) => l && typeof l === 'object') : [];

  // שורת מחיקה של חריגה לא נושאת את מפתח ההרשאה - משלימים אותו משורת CREATE של אותה חריגה
  const keyByEntityId = new Map();
  for (const log of list) {
    if (log.entityType !== PERMISSION_ENTITY || !log.entityId) continue;
    const { key } = readPermissionPayload(log);
    if (key && !keyByEntityId.has(log.entityId)) keyByEntityId.set(log.entityId, key);
  }

  return list.map((log) => {
    const isPermission = log.entityType === PERMISSION_ENTITY;
    let changes = [];
    try {
      if (isPermission) changes = permissionChanges(log, keyByEntityId.get(log.entityId), catalogLabel);
      else if (log.action === 'EMAIL_SENT') changes = emailChanges(log);
      else changes = genericChanges(log);
    } catch (e) {
      changes = [];
    }

    return {
      id: log.id,
      createdAt: toIso(log.createdAt),
      action: log.action,
      actionLabel: actionLabelOf(log.action, isPermission),
      entityType: log.entityType,
      entityLabel: entityLabelOf(log.entityType),
      actorName: log.employeeId ? (log.employeeName || 'עובד שנמחק') : 'מערכת',
      icon: iconOf(log, isPermission),
      chipTone: chipToneOf(log.action, isPermission),
      changes,
      firstChangeLabel: firstChangeLabelOf(changes),
    };
  });
}
