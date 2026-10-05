// שדות החובה של כרטיס הלקוח - הגדרה אחת לכל ארגון (SystemSetting `customer_required_fields`), נבדקת בכל שמירה של
// הכרטיס החדש (עריכה וגם יצירת לקוח) גם בצד הלקוח וגם בשרת (PUT /api/customers/[id], POST /api/customers כשהגוף נושא
// cardVariant:'a5'). תשובת הבעלים 4.10.2026 (כרטיס-לקוח, req): "אמורה להיות מקום בהגדרות לקבוע איזה שדות הם חובה ויסונכרן
// ויבדק בכל שמירה".
//
// מודול טהור (בלי imports) - משותף לשרת, לקליינט ולבדיקות node.
//
// ערך ההגדרה: רשימה מופרדת בפסיקים של מפתחות שדה (firstName,lastName,phone1,...). אפשר גם את השמות/הכינויים העבריים שמסך
// ההגדרות כותב (כמו mandatory_fields: "שם_פרטי", "טלפון_1"...). ערך חסר / ריק / לא מזוהה = ברירת המחדל = מה שחובה היום בעריכת
// לקוח (שם פרטי, שם משפחה, טלפון - ה-required של הטופס הישן). "[]"/"none" = אין שדות חובה בכלל (כיבוי מכוון).
// הכרטיס הישן לא שולח cardVariant ולכן לא מושפע (דיווח 48ff7055: אסור לחסום עריכה של לקוח ותיק בגלל שדה חסר שלא נגעו בו -
// ההגדרה נבדקת רק בכרטיס החדש, שמציג את השדה החסר בכוכבית ובסמן הלשונית ומאפשר להשלים אותו באותו מסך).

export const CUSTOMER_REQUIRED_FIELDS_KEY = 'customer_required_fields';

// השדות שאפשר לסמן כחובה בכרטיס (כל אחד מהם נערך בכרטיס החדש). הסדר = סדר ההודעות.
export const REQUIRABLE_CUSTOMER_FIELDS = [
  { key: 'firstName', label: 'שם פרטי', aliases: ['שם_פרטי', 'שם פרטי', 'firstname'] },
  { key: 'lastName', label: 'שם משפחה', aliases: ['שם_משפחה', 'שם משפחה', 'lastname'] },
  { key: 'phone1', label: 'טלפון', aliases: ['טלפון_1', 'טלפון ראשי (נייד)', 'טלפון ראשי', 'טלפון', 'phone1'] },
  { key: 'phone2', label: 'טלפון נוסף', aliases: ['טלפון_2', 'טלפון נוסף', 'phone2'] },
  { key: 'email', label: 'מייל', aliases: ['אימייל', 'מייל', 'דוא"ל', 'email'] },
  { key: 'city', label: 'עיר', aliases: ['עיר', 'city'] },
  { key: 'street', label: 'רחוב', aliases: ['רחוב', 'street'] },
  { key: 'houseNum', label: 'מספר בית', aliases: ['מספר_בית', 'מספר בית', 'housenum'] },
  { key: 'zeout', label: 'תעודת זהות', aliases: ['תעודת_זהות', 'תעודת זהות', 'ת"ז', 'ת״ז', 'zeout'] },
  { key: 'bankName', label: 'שם בנק', aliases: ['שם_בנק', 'שם בנק', 'bankname'] },
  { key: 'bankBranch', label: 'סניף בנק', aliases: ['סניף', 'סניף בנק', 'bankbranch'] },
  { key: 'bankAccount', label: 'מספר חשבון', aliases: ['חשבון', 'מספר חשבון', 'bankaccount'] },
  { key: 'bankAccountName', label: 'שם בעל החשבון', aliases: ['שם בעל החשבון', 'bankaccountname'] },
];

// ברירת המחדל = מה שחובה היום בעריכת לקוח (required בטופס הישן: שם פרטי, שם משפחה, טלפון).
export const DEFAULT_CUSTOMER_REQUIRED_FIELDS = Object.freeze(['firstName', 'lastName', 'phone1']);

const FIELD_BY_KEY = new Map(REQUIRABLE_CUSTOMER_FIELDS.map((f) => [f.key, f]));

function resolveToken(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const low = t.toLowerCase();
  for (const f of REQUIRABLE_CUSTOMER_FIELDS) {
    if (f.key.toLowerCase() === low || f.aliases.some((a) => a.toLowerCase() === low)) return f.key;
  }
  return null;
}

/**
 * מפענח את ערך ההגדרה לרשימת מפתחות (בסדר הקבוע של REQUIRABLE_CUSTOMER_FIELDS, בלי כפילויות).
 * @param {string|null|undefined} raw
 * @returns {string[]}
 */
export function parseRequiredFields(raw) {
  if (raw === null || raw === undefined) return [...DEFAULT_CUSTOMER_REQUIRED_FIELDS];
  const s = String(raw).trim();
  if (!s) return [...DEFAULT_CUSTOMER_REQUIRED_FIELDS];
  if (s === '[]' || s.toLowerCase() === 'none') return [];
  let tokens;
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      tokens = Array.isArray(arr) ? arr : [];
    } catch {
      tokens = s.replace(/[[\]"]/g, '').split(',');
    }
  } else {
    tokens = s.split(',');
  }
  const keys = new Set(tokens.map(resolveToken).filter(Boolean));
  // ערך שאף טוקן בו לא זוהה = כנראה הוקלד לא נכון - ברירת המחדל (לא "אין חובה" בשקט)
  if (keys.size === 0) return [...DEFAULT_CUSTOMER_REQUIRED_FIELDS];
  return REQUIRABLE_CUSTOMER_FIELDS.map((f) => f.key).filter((k) => keys.has(k));
}

/** ערך ההגדרה מתוך מפה {key:value} או מערך שורות [{key,value}] (כמו /api/settings). */
export function requiredFieldsFromSettings(settings) {
  if (!settings) return [...DEFAULT_CUSTOMER_REQUIRED_FIELDS];
  if (Array.isArray(settings)) {
    const row = settings.find((r) => r && r.key === CUSTOMER_REQUIRED_FIELDS_KEY);
    return parseRequiredFields(row ? row.value : undefined);
  }
  if (settings instanceof Map) return parseRequiredFields(settings.get(CUSTOMER_REQUIRED_FIELDS_KEY));
  return parseRequiredFields(settings[CUSTOMER_REQUIRED_FIELDS_KEY]);
}

export const requiredFieldLabel = (key) => (FIELD_BY_KEY.get(key) || { label: key }).label;

const filled = (customer, key) => String(customer?.[key] ?? '').trim().length > 0;

/** מפתחות החובה שחסרים ללקוח (בסדר הקבוע). */
export function missingRequiredFields(customer, requiredKeys) {
  return (requiredKeys || []).filter((k) => FIELD_BY_KEY.has(k) && !filled(customer, k));
}

/** הודעות שגיאה בעברית ("שם פרטי חובה") - אותו נוסח כמו האכיפה הקיימת בשרת. */
export function requiredFieldErrors(customer, requiredKeys) {
  return missingRequiredFields(customer, requiredKeys).map((k) => `${requiredFieldLabel(k)} חובה`);
}

/** ערך לשמירה בהגדרה (רשימת מפתחות מופרדת בפסיקים, "none" כשאין). */
export function serializeRequiredFields(keys) {
  const list = REQUIRABLE_CUSTOMER_FIELDS.map((f) => f.key).filter((k) => (keys || []).includes(k));
  return list.length ? list.join(',') : 'none';
}

/**
 * הערך ההתחלתי של `customer_required_fields` לארגון אחד, מחושב רק מהגדרות החובה שהארגון כבר קבע (תשובת הבעלים CC-O7,
 * 4.10.2026: "להוסיף לכל גמ"ח את השדות שהוא כבר הגדיר" - לא ברירת המחדל הכללית לשניהם). קריאה בלבד, פונקציה טהורה.
 *  - בסיס קבוע: שם פרטי, שם משפחה, טלפון (ה-required של הטופס הישן, תמיד חובה).
 *  - require_customer_email = 'true' -> email;  require_full_address = 'true' -> city, street, houseNum;
 *    require_customer_id_number = 'true' (נווה יעקב) -> zeout.
 *  - mandatory_fields (מסך "מילוי פרטי הזמנה") -> כל שדה לקוח שמופיע בו וניתן לסימון כחובה בכרטיס - אבל רק כש-
 *    strict_mandatory_fields = 'true' (רק אז הרשימה נאכפת כחובה קשיחה, גם בשרת ב-PUT /api/customers/[id]). אחרת הרשימה "רכה"
 *    (כוכבית/אזהרה בטפסי ההזמנה, לא חוסמת שמירה) ולכן לא נכנסת ל-keys; היא מוחזרת ב-`soft` כדי שה-dry-run יציג אותה לבעלים.
 * לא נכנסים (לא ניתנים לביטוי כרשימת שדות): mandatory_field_groups ("לפחות אחד מ...") ו-require_marketing_consent - נשארים
 * נאכפים בנפרד ביצירת לקוח, כפי שהיו.
 * @param {Record<string,string>|Map<string,string>} settings
 * @returns {{ keys: string[], value: string, reasons: Record<string,string[]>, soft: string[] }}  soft = שדות מ-mandatory_fields שאינם חובה קשיחה (strict כבוי)
 */
export function computeCustomerRequiredFieldsFromLegacy(settings) {
  const get = (k) => (settings instanceof Map ? settings.get(k) : settings?.[k]);
  const reasons = {};
  const add = (key, why) => { (reasons[key] = reasons[key] || []).push(why); };
  for (const k of DEFAULT_CUSTOMER_REQUIRED_FIELDS) add(k, 'base');
  if (String(get('require_customer_email')) === 'true') add('email', 'require_customer_email');
  if (String(get('require_full_address')) === 'true') for (const k of ['city', 'street', 'houseNum']) add(k, 'require_full_address');
  if (String(get('require_customer_id_number')) === 'true') add('zeout', 'require_customer_id_number');
  const strict = String(get('strict_mandatory_fields')) === 'true';
  const softSet = new Set();
  const mf = String(get('mandatory_fields') ?? '').trim();
  if (mf) {
    for (const tok of mf.split(',')) {
      const key = resolveToken(tok);
      if (!key) continue;
      if (strict) add(key, 'mandatory_fields'); else softSet.add(key);
    }
  }
  const keys = REQUIRABLE_CUSTOMER_FIELDS.map((f) => f.key).filter((k) => reasons[k]);
  const soft = REQUIRABLE_CUSTOMER_FIELDS.map((f) => f.key).filter((k) => softSet.has(k) && !reasons[k]);
  return { keys, value: serializeRequiredFields(keys), reasons, soft };
}
