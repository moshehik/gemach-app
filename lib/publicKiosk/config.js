// lib/publicKiosk/config.js - הגדרות עמדת הלקוח הציבורית (/station + /api/public-kiosk/*).
// כל קריאה היא allow-list: רק המפתחות שכאן נקראים ויוצאים - לעולם לא שאר SystemSetting.
// ברירת מחדל בקוד כשהשורה חסרה = כבוי (בטוח לגמ"ח הראשי); ערך שונה מ-'true' בדיוק = כבוי.
import { getAllCachedSettings } from '@/lib/settingsCache';
import { parseFieldGroups } from '@/lib/customerValidation';

export const PUBLIC_KIOSK_SETTING_KEYS = Object.freeze([
  'kiosk_public_link_enabled',       // עמדת לקוח פתוחה בקישור כללי
  'kiosk_public_show_inventory',     // האם רואים מלאי/זמינות בקישור הכללי
  'kiosk_public_show_registration',  // האם רואים טופס רישום פרטים אישיים בקישור הכללי
  'hide_dress_images',               // קיימת: הסתרת תמונות שמלות
  // --- פנימי בלבד (לא יוצא בתשובה): מי רשאי לרשום דרך /register, ורמזים לטופס (נגזרים - לא ערכי ההגדרות עצמם)
  'kiosk_customer_self_service',
  'require_customer_email', 'require_full_address', 'require_customer_id_number', 'require_marketing_consent', 'hide_marketing_consent_field',
  'mandatory_field_groups', 'strict_mandatory_fields', 'mandatory_fields',
]);

// השדות שטופס הרישום הציבורי אוסף. שדה בקבוצת "אחד מהם" שאינו בטופס (למשל phone2) לא נספר.
const COLLECTED = new Set(['firstName', 'lastName', 'phone1', 'phone2', 'email', 'city', 'street', 'houseNum', 'zeout']);

/** רמזים לטופס: אילו שדות חובה כרגע (נגזר מההגדרות; השרת אוכף בכל מקרה - זה רק כדי שהטופס יסמן כוכביות). */
export function deriveRegistrationRules(get) {
  const on = (k) => get(k) === 'true';
  const req = { firstName: true, lastName: true, phone1: true, email: on('require_customer_email'), address: on('require_full_address'), idNumber: on('require_customer_id_number') };
  const oneOf = []; // קבוצות "לפחות אחד מהם" (למשל ["phone2","email"]) - רק החברים שבטופס
  for (const g of parseFieldGroups(get('mandatory_field_groups'))) {
    const inForm = g.filter((k) => COLLECTED.has(k));
    if (inForm.length === 1 && inForm[0] === 'email') req.email = true;
    else if (inForm.length === 1 && inForm[0] === 'zeout') req.idNumber = true;
    else if (inForm.length === 1) req[inForm[0]] = true;
    else if (inForm.length > 1) oneOf.push(inForm);
  }
  if (on('strict_mandatory_fields')) {
    for (const m of String(get('mandatory_fields') || '').split(',').map((x) => x.trim().toLowerCase())) {
      if (m === 'email' || m === 'אימייל') req.email = true;
      if (m === 'city' || m === 'עיר' || m === 'street' || m === 'רחוב' || m === 'housenum' || m === 'מספר בית') req.address = true;
    }
  }
  return {
    required: req,
    oneOf,
    // הסכמות: דיוור כן/לא תמיד נדרש כתשובה מפורשת; אישור פרטיות תמיד חובה; "חובה לאשר דיוור" רק לפי ההגדרה
    marketingMustBeYes: get('hide_marketing_consent_field') !== 'true' && on('require_marketing_consent'),
  };
}

/** פונקציה טהורה: Map/אובייקט של הגדרות -> הדגלים הציבוריים (כולם בוליאנים). */
export function derivePublicKioskConfig(get) {
  const on = (k) => get(k) === 'true';
  const linkEnabled = on('kiosk_public_link_enabled');
  return {
    linkEnabled,
    // שני הדגלים התלויים פעילים רק כשהקישור עצמו פעיל - הגנה כפולה, כדי ש-enabled=false לא ידליף שום דבר
    showInventory: linkEnabled && on('kiosk_public_show_inventory'),
    showRegistration: linkEnabled && on('kiosk_public_show_registration'),
    hideImages: on('hide_dress_images'),
    // פנימי (לא נשלח ללקוחה): העמדה הנעולה בחנות (kiosk_customer_self_service) רשאית לרשום גם כשהקישור הכללי כבוי
    storeSelfService: on('kiosk_customer_self_service'),
    registrationRules: deriveRegistrationRules(get),
  };
}

/** הקונפיג הציבורי הנוכחי (מטמון הגדרות של 30 שנ'). כשל DB = הכול כבוי (fail-closed). */
export async function loadPublicKioskConfig() {
  try {
    const rows = await getAllCachedSettings();
    const map = new Map();
    for (const r of rows) if (PUBLIC_KIOSK_SETTING_KEYS.includes(r.key)) map.set(r.key, r.value);
    return derivePublicKioskConfig((k) => map.get(k));
  } catch (e) {
    console.error('publicKiosk config load failed (fail-closed):', e && e.message ? e.message : e);
    return derivePublicKioskConfig(() => undefined);
  }
}
