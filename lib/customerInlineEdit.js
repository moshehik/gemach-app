// השלמת פרטי לקוח קיים בתוך אשף "הזמנה חדשה" (דיווח f96f3952, נווה יעקב) - בלי לפתוח כרטיסייה חדשה.
// לוגיקה טהורה משותפת לשני האשפים (הישן: app/orders/new/CustomerCompleteModal.js, החדש: CompleteCustomerDialog ב-app/components/new-order/NoDialogs.js).
// מאחורי SystemSetting order_inline_customer_edit (כבוי = הקישור הקיים "עריכת פרטי לקוח" שנפתח בכרטיסייה נפרדת, כמו קודם).
//
// "רק מה שחסר, לא יותר ולא פחות" (בקשת הבעלים): השדות שמוצגים הם בדיוק השדות שהאשף כבר מציג כ"חסר ללקוח" - אותה פונקציה
// (getMissingMandatoryCustomerFields של כל אשף) + קבוצות "אחד מספיק" (mandatory_field_groups) שאף שדה בהן לא מולא.
// ת"ז לא נכללת (require_customer_id_number חל רק על לקוח חדש - ר' הערה בישן). השמירה = PUT /api/customers/[id] הקיים, בלי לוגיקת שרת חדשה.
import { isValidIsraeliPhone, isValidEmailFormat } from './customerValidation';
import { normalizeEmail } from './emailUtils';

export const INLINE_CUSTOMER_EDIT_SETTING = 'order_inline_customer_edit';
export const isInlineCustomerEditOn = (settings) => !!settings && settings[INLINE_CUSTOMER_EDIT_SETTING] === 'true';

// kind: text | tel | email | digits | switch.  ltr: שדה שמוקלד משמאל לימין (טלפון / מייל / ספרות).
const FIELD_META = {
  firstName: { label: 'שם פרטי', kind: 'text' },
  lastName: { label: 'שם משפחה', kind: 'text' },
  phone1: { label: 'טלפון', kind: 'tel', ltr: true },
  phone2: { label: 'טלפון נוסף', kind: 'tel', ltr: true },
  email: { label: 'אימייל', kind: 'email', ltr: true },
  city: { label: 'עיר', kind: 'text' },
  street: { label: 'רחוב', kind: 'text' },
  houseNum: { label: 'מספר בית', kind: 'digits', ltr: true },
  marketingConsent: { label: 'מאשר/ת קבלת דיוורים', kind: 'switch' },
  // שדות שיכולים להופיע רק בתוך קבוצת "אחד מספיק" שהוגדרה ידנית בהגדרות
  notes: { label: 'הערות לקוח', kind: 'text' },
  officeNotes: { label: 'נתוני משרד', kind: 'text' },
  bankName: { label: 'שם בנק', kind: 'text' },
  bankBranch: { label: 'סניף בנק', kind: 'digits', ltr: true },
  bankAccount: { label: 'חשבון בנק', kind: 'digits', ltr: true },
};
const metaOf = (key) => FIELD_META[key] || { label: key, kind: 'text' };
const filled = (v) => String(v ?? '').trim().length > 0;

// missingKeys = מערך המפתחות החסרים (הפונקציה של האשף); unsatisfiedGroups = getUnsatisfiedFieldGroups(customer, groups) (מערך של מערכי מפתחות).
// מחזיר { fields: [{key,label,kind,ltr,required}], groups: [[keys]] } - "groups" רק קבוצות שאף שדה בהן לא נדרש כבר בנפרד.
export function buildCompletionPlan(missingKeys, unsatisfiedGroups) {
  const fields = [];
  const seen = new Set();
  for (const key of missingKeys || []) {
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({ key, ...metaOf(key), required: true });
  }
  const groups = [];
  for (const g of unsatisfiedGroups || []) {
    if (!Array.isArray(g) || g.some((k) => seen.has(k))) continue; // שדה מהקבוצה כבר חובה בנפרד - הוא יספק גם את הקבוצה
    groups.push(g);
    for (const key of g) {
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push({ key, ...metaOf(key), required: false });
    }
  }
  return { fields, groups };
}

export const groupLabel = (g) => g.map((k) => metaOf(k).label).join(' / ');

// ערכי פתיחה: שדות חסרים מתחילים ריקים (switch = לא מסומן)
export function initialValues(plan) {
  const v = {};
  for (const f of plan.fields) v[f.key] = f.kind === 'switch' ? false : '';
  return v;
}

const digitsOf = (s) => String(s || '').replace(/\D/g, '');

// בדיקה לפני שליחה. מחזיר { errors: {key: טקסט}, groupErrors: [טקסט], ok }.
// בדיקות תבנית (טלפון/מייל/מספר בית) רק על מה שהוקלד עכשיו - ערך ישן של הלקוח לא נבדק מחדש.
export function validateCompletion(plan, values, customer) {
  const errors = {};
  const merged = { ...(customer || {}), ...values };
  for (const f of plan.fields) {
    const val = values[f.key];
    if (f.kind === 'switch') {
      if (f.required && !val) errors[f.key] = 'יש לסמן את האישור';
      continue;
    }
    const text = String(val ?? '').trim();
    if (!text) { if (f.required) errors[f.key] = 'שדה חובה'; continue; }
    if (f.kind === 'tel' && !isValidIsraeliPhone(text)) errors[f.key] = 'מספר הטלפון אינו תקין';
    else if (f.kind === 'email' && !isValidEmailFormat(text)) errors[f.key] = 'כתובת האימייל אינה תקינה';
    else if (f.kind === 'digits' && !/^\d+$/.test(text)) errors[f.key] = 'ספרות בלבד';
  }
  if (!errors.phone2 && filled(values.phone2) && digitsOf(values.phone2) === digitsOf(merged.phone1)) errors.phone2 = 'הטלפון הנוסף זהה לטלפון הראשי';
  const groupErrors = [];
  for (const g of plan.groups) {
    if (!g.some((k) => filled(merged[k]))) groupErrors.push(`חובה למלא לפחות אחד מבין: ${groupLabel(g)}`);
  }
  return { errors, groupErrors, ok: Object.keys(errors).length === 0 && groupErrors.length === 0 };
}

const BODY_KEYS = ['firstName', 'lastName', 'phone1', 'phone2', 'email', 'city', 'street', 'zeout'];
// גוף ה-PUT: כמו שהכרטיס הישן שולח (שדות הטופס), כי השרת קורא את houseNum תמיד (parseInt) ובודק את שדות החובה על הגוף עצמו
// (strict_mandatory_fields). שדות שהלקוח לא נושא (undefined) לא נשלחים -> השרת משאיר אותם כמו שהם. בלי cardVariant: אותה אכיפה כמו בכרטיס הישן.
export function buildPutBody(customer, values) {
  const m = { ...(customer || {}), ...Object.fromEntries(Object.entries(values || {}).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) };
  const body = {};
  for (const k of BODY_KEYS) {
    const v = m[k];
    if (v === undefined || v === null) continue; // לא נשלח -> השרת משאיר כמו שהוא (null נשאר null)
    if (String(v).trim() === '' && (!customer || customer[k] === undefined || customer[k] === null)) continue; // שדה ריק שנשאר ריק - לא הופך null ל-''
    body[k] = v;
  }
  body.houseNum = (m.houseNum === undefined || m.houseNum === null || String(m.houseNum).trim() === '') ? '' : Number(m.houseNum);
  if (m.marketingConsent !== undefined) body.marketingConsent = !!m.marketingConsent;
  for (const k of ['notes', 'officeNotes', 'bankName', 'bankBranch', 'bankAccount']) if (values && values[k] !== undefined) body[k] = String(values[k]).trim();
  return body;
}

// שמירה דרך PUT /api/customers/[id]. מחזיר את אובייקט הלקוח המעודכן (אותו מבנה כמו תוצאת החיפוש) או זורק Error עם הודעה בעברית.
export async function saveCustomerCompletion(customer, values, fetchImpl) {
  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) throw new Error('אין חיבור לשרת');
  let res;
  try {
    res = await f(`/api/customers/${encodeURIComponent(customer.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPutBody(customer, values)),
    });
  } catch {
    throw new Error('אין חיבור לשרת - נסו שוב');
  }
  let data = null;
  try { data = await res.json(); } catch { /* גוף לא תקין */ }
  if (!res.ok) throw new Error((data && (data.error === 'Data Collision' ? data.message : data.error)) || 'שגיאה בשמירת פרטי הלקוח');
  const updated = { ...customer };
  for (const k of ['firstName', 'lastName', 'phone1', 'phone2', 'city', 'street', 'houseNum', 'zeout', 'marketingConsent', 'notes', 'officeNotes', 'bankName', 'bankBranch', 'bankAccount']) {
    if (data && k in data) updated[k] = data[k];
  }
  if (data && 'email' in data) updated.email = normalizeEmail(data.email, data.emailSuffix) || '';
  return updated;
}
