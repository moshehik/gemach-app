// lib/customerCreateValidation.js - ולידציית "לקוח חדש" שמבוססת הגדרות (שדות חובה + תבנית), משותפת ל:
//   * POST /api/customers (טופס לקוח חדש של העובדת) - הוצא לכאן מהנתיב בלי שינוי התנהגות (אותו סדר הודעות בדיוק);
//   * POST /api/public-kiosk/register (רישום עצמי בעמדת הלקוח) - אותם כללים בדיוק, כדי שלא יהיה "טופס מנוון" שעוקף שדות חובה.
// פונקציה טהורה: בלי DB ובלי React. sMap = Map(key -> value) של SystemSetting. כשל ב-DB (בדיקת כפילות ת"ז) נשאר בנתיבים עצמם.
import { customerBankFieldsEnabled, validateCustomerBankFields } from '@/lib/customerBankFields';
import { validateCustomerFieldFormats, parseFieldGroups, unsatisfiedFieldGroupErrors } from '@/lib/customerValidation';
import { requiredFieldErrors, requiredFieldsFromSettings } from '@/lib/customerRequiredFields';

const STRICT_ALIASES = {
  firstname: 'firstName', 'שם פרטי': 'firstName', 'שם_פרטי': 'firstName',
  lastname: 'lastName', 'שם משפחה': 'lastName', 'שם_משפחה': 'lastName',
  phone1: 'phone1', 'טלפון ראשי (נייד)': 'phone1', 'טלפון_1': 'phone1',
  email: 'email', 'אימייל': 'email',
  city: 'city', 'עיר': 'city',
  street: 'street', 'רחוב': 'street',
  housenum: 'houseNum', 'מספר בית': 'houseNum', 'מספר_בית': 'houseNum',
};

/**
 * מחזיר { errors: string[], bankOn: boolean } - הודעות שגיאה בעברית (ריק = תקין) וסטטוס שדות הבנק (customer_bank_fields_enabled).
 * body: גוף הבקשה (firstName/lastName/phone1/phone2/email/emailSuffix/city/street/houseNum/zeout|idNumber/marketingConsent/...).
 * opts.a5Required: להחיל גם את customer_required_fields (רק הכרטיס החדש של העובדת - cardVariant:'a5').
 * opts.bankFields: לבדוק גם שדות בנק (הנתיב של העובדת; הרישום הציבורי לא אוסף שדות בנק ולכן false).
 */
export function collectNewCustomerErrors(body, sMap, { a5Required = false, bankFields = true } = {}) {
  const errors = [];
  const bankOn = customerBankFieldsEnabled(sMap);
  if (sMap.get('require_customer_email') === 'true') {
    const rawEmail = String(body.email || (body.emailSuffix && String(body.emailSuffix).includes('@') ? body.emailSuffix : '') || '').trim();
    if (!rawEmail || !rawEmail.includes('@')) errors.push('מייל חובה');
  }
  if (sMap.get('require_full_address') === 'true') {
    if (!String(body.city || '').trim()) errors.push('עיר חובה');
    if (!String(body.street || '').trim()) errors.push('רחוב חובה');
    if (!String(body.houseNum || '').trim()) errors.push('מספר בית חובה');
  }
  if (sMap.get('hide_marketing_consent_field') !== 'true' && sMap.get('require_marketing_consent') === 'true') {
    if (!body.marketingConsent) errors.push('חובה לאשר קבלת דיוורים');
  }
  // "לפחות שדה אחד מהקבוצה" (mandatory_field_groups, ר' lib/customerValidation.js)
  errors.push(...unsatisfiedFieldGroupErrors(body, parseFieldGroups(sMap.get('mandatory_field_groups'))));
  // require_customer_id_number - הגדרה ייעודית לגמח נווה יעקב (ברירת מחדל: ת"ז אופציונלית)
  if (sMap.get('require_customer_id_number') === 'true') {
    const zeoutVal = String(body.zeout || body.idNumber || '').trim();
    if (!zeoutVal) errors.push('תעודת זהות חובה');
  }
  // strict_mandatory_fields + mandatory_fields
  if (sMap.get('strict_mandatory_fields') === 'true') {
    const mandatory = (sMap.get('mandatory_fields') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const m of mandatory) {
      const field = STRICT_ALIASES[m.toLowerCase()] || STRICT_ALIASES[m] || null;
      if (field && !String(body[field] || '').trim()) {
        const label = field === 'firstName' ? 'שם פרטי' : field === 'lastName' ? 'שם משפחה' : field === 'phone1' ? 'טלפון' : field;
        if (!errors.includes(`${label} חובה`)) errors.push(`${label} חובה`);
      }
    }
  }
  if (a5Required) {
    for (const e of requiredFieldErrors(body, requiredFieldsFromSettings(sMap))) if (!errors.includes(e)) errors.push(e);
  }
  // ולידציית תבנית (טלפון/מייל/ת"ז/כפילות טלפונים)
  errors.push(...validateCustomerFieldFormats(body));
  if (bankFields && bankOn === true) errors.push(...validateCustomerBankFields(body));
  return { errors, bankOn };
}
