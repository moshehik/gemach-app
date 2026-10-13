// lib/customerCompleteness.js - "לקוח תקין" = לקוח שיש לו את כל הפרטים שהמערכת דורשת ביצירת לקוח חדש באותו גמ"ח.
// משמש את בורר "לקוח קיים" בהזמנה חדשה (GET /api/customers?pickerFor=new-order, מאחורי ההגדרה new_order_customer_list_filter = 'complete').
//
// איך נקבע מי תקין - בלי רשימת שדות קשיחה, אלא מאותן פונקציות שכבר אוכפות ביצירת לקוח:
//   1. getMissingMandatoryCustomerFields (app/components/new-order/newOrderLogic.js; העותק של האשף שבו נמצא "לקוח חדש"): שם פרטי, שם משפחה
//      וטלפון תמיד; mandatory_fields; require_customer_email; require_full_address; אישור דיוור (require_marketing_consent, כשלא מוסתר).
//      השדות נגזרים מהפונקציה הזו עצמה - קוראים לה על לקוח ריק, ומה שחסר = מה שנדרש. כל שינוי בה משתקף כאן אוטומטית.
//   2. require_customer_id_number = 'true' (נווה יעקב) -> ת"ז (zeout). הפונקציה בסעיף 1 לא כוללת אותה בכוונה (Q7b: ת"ז לא "חסרה" בלקוח
//      קיים שכבר נבחר) - אבל ביצירת לקוח חדש היא חובה, והיא חלק מהגדרת "תקין".
//   3. mandatory_field_groups (lib/customerValidation.js, parseFieldGroups; "אחד מספיק", ברירת מחדל טלפון נוסף / אימייל).
//   4. customer_required_fields (lib/customerRequiredFields.js, requiredFieldsFromSettings) - שדות החובה של כרטיס הלקוח החדש.
// לא נבדק כאן: תקינות תבנית (טלפון/מייל/ספרת ביקורת של ת"ז - validateCustomerFieldFormats) - זו בדיקה בעת הקלדה, לא "האם מולא".
//
// שלוש צורות של אותה ההגדרה (נוצרות כולן מאותו spec, ונבדקות זו מול זו ב-scripts/new-order-tests/customer-filter.test.mjs
// ו-scripts/test_customer_completeness_db.mjs):
//   isCustomerComplete(customer, spec)   - בדיקה בזיכרון (שורה אחת)
//   prismaCompleteConditions(spec)       - תנאי where של Prisma (סינון בשרת, עימוד וספירה נשארים נכונים) - "גס": לא-null ולא-ריק
//   completeEdgeSql(spec)                - שאילתת SQL שמחזירה את הלקוחות שעוברים את הסינון הגס אבל לא את הבדיקה המדויקת
//                                          (ערך של רווחים בלבד, מייל "@" וכד') - מוחרגים עם id NOT IN, כך שהתוצאה זהה בדיוק לבדיקה בזיכרון.
//
// מודול טהור (בלי prisma/Next) - נטען גם ב-node לבדיקות.
import { getMissingMandatoryCustomerFields } from '../app/components/new-order/newOrderLogic';
import { parseFieldGroups, getUnsatisfiedFieldGroups } from './customerValidation';
import { requiredFieldsFromSettings } from './customerRequiredFields';
import { normalizeEmail } from './emailUtils';

const TEXT_KEYS = new Set(['firstName', 'lastName', 'phone1', 'phone2', 'city', 'street', 'zeout', 'notes', 'officeNotes',
  'bankName', 'bankBranch', 'bankAccount', 'bankAccountName']);

/**
 * @param {Record<string,string>} settings  מפה {key: value} של SystemSetting
 * @returns {{ keys: string[], groups: string[][] }}  keys = שדות שכולם חובה; groups = קבוצות "לפחות אחד מ..." (כל קבוצה: מערך מפתחות)
 */
export function buildCompletenessSpec(settings) {
  const s = settings || {};
  const keys = new Set(getMissingMandatoryCustomerFields(s, {}));
  if (s.require_customer_id_number === 'true') keys.add('zeout');
  for (const k of requiredFieldsFromSettings(s)) keys.add(k);
  const groups = getUnsatisfiedFieldGroups({}, parseFieldGroups(s.mandatory_field_groups)).map((g) => [...g]);
  return { keys: [...keys].sort(), groups };
}

const filledText = (v) => String(v ?? '').trim().length > 0;

// האם שדה `key` מולא אצל הלקוח. email: אותו כלל כמו התצוגה (normalizeEmail על email + emailSuffix - null = אין מייל).
// houseNum: 0 נחשב ריק (כמו getMissingMandatoryCustomerFields: String(0 || '')). marketingConsent: חייב להיות מסומן.
export function isFieldFilled(customer, key) {
  const c = customer || {};
  if (key === 'email') return !!normalizeEmail(c.email, c.emailSuffix);
  if (key === 'houseNum') return filledText(c.houseNum || '');
  if (key === 'marketingConsent') return !!c.marketingConsent;
  return filledText(c[key]);
}

export function isCustomerComplete(customer, spec) {
  return spec.keys.every((k) => isFieldFilled(customer, k)) && spec.groups.every((g) => g.some((k) => isFieldFilled(customer, k)));
}

export function missingCompleteFields(customer, spec) {
  return [...spec.keys.filter((k) => !isFieldFilled(customer, k)), ...spec.groups.filter((g) => !g.some((k) => isFieldFilled(customer, k))).map((g) => g.join('|'))];
}

// ---------- Prisma: סינון גס (לא-null ולא-ריק) ----------
function coarseCond(key) {
  if (key === 'email') {
    return { OR: [{ AND: [{ email: { not: null } }, { email: { not: '' } }] }, { AND: [{ emailSuffix: { not: null } }, { emailSuffix: { not: '' } }] }] };
  }
  if (key === 'houseNum') return { AND: [{ houseNum: { not: null } }, { houseNum: { not: 0 } }] };
  if (key === 'marketingConsent') return { marketingConsent: true };
  if (TEXT_KEYS.has(key)) return { AND: [{ [key]: { not: null } }, { [key]: { not: '' } }] };
  throw new Error(`customerCompleteness: unknown field "${key}"`);
}

/** מערך תנאים ל-AND בשאילתת Customer (סינון גס; ר' completeEdgeSql להשלמה המדויקת). ריק כשאין שום דרישה. */
export function prismaCompleteConditions(spec) {
  return [...spec.keys.map(coarseCond), ...spec.groups.map((g) => ({ OR: g.map(coarseCond) }))];
}

// ---------- SQL: הבדיקה המדויקת (אותו כלל כמו isFieldFilled) והגסה ----------
// רווח לבן כמו String.prototype.trim של JS (לא כולל סימני כיווניות U+200E/F - ב-JS הם נחשבים תו)
const WS = '[:space:]\\u00a0\\ufeff\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const q = (col) => `"${col}"`;
const trimmedSql = (col) => `regexp_replace(COALESCE(${q(col)}, ''), '^[${WS}]+|[${WS}]+$', '', 'g')`;

function exactSql(key) {
  if (key === 'email') {
    const e = trimmedSql('email');
    const x = trimmedSql('emailSuffix');
    return `((${e} <> '' AND ${e} NOT IN ('@', '.') AND ${e} !~* '^@gmail(\\.com)?$') OR (${e} = '' AND ${x} <> '' AND ${x} NOT IN ('@', '.') AND lower(${x}) NOT LIKE '%gmail.com%'))`;
  }
  if (key === 'houseNum') return `(${q('houseNum')} IS NOT NULL AND ${q('houseNum')} <> 0)`;
  if (key === 'marketingConsent') return `${q('marketingConsent')} = true`;
  if (TEXT_KEYS.has(key)) return `${trimmedSql(key)} <> ''`;
  throw new Error(`customerCompleteness: unknown field "${key}"`);
}

function coarseSql(key) {
  if (key === 'email') return `((${q('email')} IS NOT NULL AND ${q('email')} <> '') OR (${q('emailSuffix')} IS NOT NULL AND ${q('emailSuffix')} <> ''))`;
  if (key === 'houseNum') return `(${q('houseNum')} IS NOT NULL AND ${q('houseNum')} <> 0)`;
  if (key === 'marketingConsent') return `${q('marketingConsent')} = true`;
  if (TEXT_KEYS.has(key)) return `(${q(key)} IS NOT NULL AND ${q(key)} <> '')`;
  throw new Error(`customerCompleteness: unknown field "${key}"`);
}

const allOf = (spec, fn) => [...spec.keys.map(fn), ...spec.groups.map((g) => `(${g.map(fn).join(' OR ')})`)].join(' AND ') || 'true';

export const EDGE_ID_CAP = 5000;

/** SQL (בלי פרמטרים; כל המפתחות מ-spec בלבד, לא מקלט משתמש) לשורות שעוברות את הסינון הגס אבל נכשלות בבדיקה המדויקת. */
export function completeEdgeSql(spec) {
  if (!spec.keys.length && !spec.groups.length) return null;
  return `SELECT "id" FROM "Customer" WHERE "isDeleted" = false AND (${allOf(spec, coarseSql)}) AND NOT (${allOf(spec, exactSql)}) LIMIT ${EDGE_ID_CAP + 1}`;
}

/** SQL שמחזיר את ה-id של כל הלקוחות הפעילים התקינים (מדויק) - לבדיקות ולספירות בלבד, לא לשימוש בבקשות משתמש. */
export function completeIdsSql(spec) {
  return `SELECT "id" FROM "Customer" WHERE "isDeleted" = false AND (${allOf(spec, exactSql)})`;
}
