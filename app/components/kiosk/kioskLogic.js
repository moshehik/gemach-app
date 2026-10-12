// kioskLogic.js - הלוגיקה הטהורה של עמדת הלקוח החדשה (עיצוב A5): שמות דגם, סיכום מידות, לוח עברי, ולידציית רישום.
// מועתק מ-app/customer-interface/LegacyKioskPage.js (הגרסה הישנה, מוקפאת) בלי שינוי כלל עסקי; רק מופרד מהתצוגה.
// בלי React ובלי DB, כדי שאפשר יהיה לבדוק ב-node (scripts/test_kiosk_logic.mjs).

import { HDate, Sedra, Locale, HebrewCalendar, gematriya } from '@hebcal/core';
import { HEBREW_DAYS } from '../../../lib/hebrewDate.js';
import { modelDisplayName, modelHasRealName as sharedModelHasRealName } from '../../../lib/modelDisplay.js';

// הדוחות המודפסים נכתבים ל-document.write של חלון חדש: כל ערך שהוזן בידי משתמש (שם דגם, מידה, חיפוש) חייב escape, אחרת שם עם HTML רץ בהקשר האפליקציה
export const escHtml = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// דגמים שנשמרו עם השם הזמני "ללא שם" - ללקוח עדיף מספר הדגם. שימו לב: \b ב-JS לא עובד על אותיות עברית.
export function getModelDisplayName(model) {
  return modelDisplayName(model, { fallback: '' }); // lib/modelDisplay.js: שם אמיתי, אחרת מספר הדגם
}

// שם תיאורי אמיתי: לא ריק, לא "ללא שם", ולא בדיוק מספר הדגם (חלק מהדגמים המיובאים מאקסס נשמרו עם name="316" ו-barcodePrefix=316)
export function modelHasRealName(model) {
  return sharedModelHasRealName(model); // lib/modelDisplay.js (גם "אין שם", "דגם <קוד>" ושם = קוד אינם שם אמיתי)
}

// אותיות הדגם לעיגול כשאין תמונה: אות ראשונה משתי המילים הראשונות; מילה בודדת שהיא מספר מלא - עד 3 ספרות
export function modelInitials(model) {
  const name = getModelDisplayName(model);
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`
    : (/^\d+$/.test(parts[0] || '') ? parts[0].slice(0, 3) : name.slice(0, 2)) || '?';
}

// צבע לאריח בלי תמונה: נגזר מקידומת הדגם (יציב בין טעינות). הצבעים הם אותם 8 צבעי הדגימה המאושרת (עמדת-לקוח.html, CATALOG).
const TILE_COLORS = ['#c98f9e', '#8fa9c9', '#b8912f', '#7c8b6e', '#a86f9e', '#5a7ba0', '#c97a4f', '#6f9e8b'];
export function tileColor(model) {
  const key = String(model.barcodePrefix != null ? model.barcodePrefix : (model.id || model.name || ''));
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

const isUsable = (item) => !(item.notInUse || item.isDeleted || item.isUnusable);
export { isUsable };

// פירוט מידות/כמויות לדגם, משותף לכל התצוגות, לשורת הספירה ולדוח ההדפסה.
// fields=kiosk מקבץ פריטים זהים לשורה עם count; בצורה הישנה אין count = פריט אחד.
export function getModelSizeInfo(model) {
  const sizeMap = new Map();
  model.items?.forEach((item) => {
    if (!isUsable(item)) return;
    const st = item.sizeText || 'כללי';
    if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
    const info = sizeMap.get(st);
    const n = item.count || 1;
    info.total += n;
    if (item.quantity > 0) info.available += n;
  });
  const sizesArray = Array.from(sizeMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
  const totalAvailable = sizesArray.reduce((s, [, d]) => s + d.available, 0);
  const totalUnits = sizesArray.reduce((s, [, d]) => s + d.total, 0);
  return { sizesArray, totalAvailable, totalUnits };
}

/** מידות ייחודיות במלאי כולו + כמה דגמים נושאים כל מידה (לכפתורי בחירת המידה ולמסנן המהיר). */
export function buildSizeChipData(dresses) {
  const map = new Map();
  dresses.forEach((d) => {
    const seen = new Set();
    d.items?.forEach((item) => {
      if (!isUsable(item)) return;
      const st = (item.sizeText || '').trim();
      if (st && !seen.has(st)) {
        seen.add(st);
        map.set(st, (map.get(st) || 0) + 1);
      }
    });
  });
  return Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
}

// ---------------------------------------------------------------- לוח עברי ----------------------------------------------------------------

export const getMonthsForYear = (year) => {
  const isLeap = HDate.isLeapYear(year);
  return [
    { value: 7, label: 'תשרי' },
    { value: 8, label: 'חשוון' },
    { value: 9, label: 'כסלו' },
    { value: 10, label: 'טבת' },
    { value: 11, label: 'שבט' },
    { value: 12, label: isLeap ? "אדר א'" : 'אדר' },
    ...(isLeap ? [{ value: 13, label: "אדר ב'" }] : []),
    { value: 1, label: 'ניסן' },
    { value: 2, label: 'אייר' },
    { value: 3, label: 'סיוון' },
    { value: 4, label: 'תמוז' },
    { value: 5, label: 'אב' },
    { value: 6, label: 'אלול' },
  ];
};

// שמות החגים בתאי הלוח (S07 בדגימה): רק ימי החג עצמם, בישראל. אותו מיפוי של הדגימה (HOL_NAMES), מ-hebcal במקום רשימה ידנית.
const CHAG_LABELS = {
  'Rosh Hashana': 'ראש השנה',
  'Rosh Hashana II': 'ראש השנה',
  'Yom Kippur': 'יום כיפור',
  'Sukkot I': 'סוכות',
  'Shmini Atzeret': 'שמחת תורה',
  'Simchat Torah': 'שמחת תורה',
  'Pesach I': 'פסח',
  'Pesach VII': 'שביעי של פסח',
  'Shavuot': 'שבועות',
};

/** שם החג (אם יום החג עצמו) לתא בלוח, או null. */
export function holidayLabel(hd) {
  try {
    const evs = HebrewCalendar.getHolidaysOnDate(hd, true) || [];
    for (const e of evs) {
      const label = CHAG_LABELS[String(e.getDesc()).replace(/\s+\d{4}$/, '')]; // "Rosh Hashana 5787" -> בלי השנה
      if (label) return label;
    }
  } catch (e) { /* בלי חגים */ }
  return null;
}

/** שם הפרשה של שבת (בתא של שבת בלבד) או null. */
export function parshaLabelForSaturday(hd) {
  try {
    if (hd.getDay() !== 6) return null;
    const sedra = new Sedra(hd.getFullYear(), true);
    const lookup = sedra.lookup(hd);
    if (lookup && lookup.parsha) return lookup.parsha.map((x) => Locale.gettext(x, 'he-x-NoNikud')).join('-');
  } catch (e) { /* בלי פרשה */ }
  return null;
}

/** "י״ג באדר תשפ״ו - פרשת ויקהל": פרשת השבוע של השבת הקרובה לתאריך הנבחר (כמו שורת התחתית של הלוח הישן). */
export function parshaFooter(hd) {
  try {
    const sat = hd.onOrAfter(6);
    const sedra = new Sedra(sat.getFullYear(), true);
    const lookup = sedra.lookup(sat);
    const p = lookup && lookup.parsha ? lookup.parsha.map((x) => Locale.gettext(x, 'he-x-NoNikud')).join('-') : '';
    return p ? `פרשת ${p}` : '';
  } catch (e) { return ''; }
}

/** תאי חודש עברי: ריקים לפני היום הראשון, ואז ימי החודש. */
export function buildMonthCells(month, year) {
  const out = [];
  try {
    const dim = HDate.daysInMonth(month, year);
    const first = new HDate(1, month, year);
    const firstDow = first.greg().getDay();
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let d = 1; d <= dim; d++) out.push(new HDate(d, month, year));
  } catch (e) { /* תאריך לא תקין */ }
  return out;
}

// ----------------------------------------------------------- רישום פרטים אישיים -----------------------------------------------------------

// אותם שדות/כינויים/ולידציה בדיוק כמו getMissingMandatoryCustomerFields ב-app/orders/new/page.js (ראו LegacyKioskPage): שם פרטי/משפחה/טלפון תמיד חובה;
// מייל/כתובת מלאה/אישור דיוור/ת"ז רק כשההגדרה המתאימה דלוקה; ושדה חופשי mandatory_fields נבדק גם הוא.
export const CUSTOMER_FIELD_ALIASES = {
  firstName: ['firstname', 'שם פרטי', 'שם_פרטי'],
  lastName: ['lastname', 'שם משפחה', 'שם_משפחה'],
  phone1: ['phone1', 'טלפון ראשי (נייד)', 'טלפון_1'],
  email: ['email', 'אימייל'],
  city: ['city', 'עיר'],
  street: ['street', 'רחוב'],
  houseNum: ['housenum', 'מספר בית', 'מספר_בית'],
};
export const CUSTOMER_FIELD_LABELS = {
  firstName: 'שם פרטי', lastName: 'שם משפחה', zeout: 'תעודת זהות', phone1: 'טלפון', email: 'אימייל', city: 'עיר', street: 'רחוב', houseNum: 'מספר בית',
  marketingConsent: 'אישור קבלת דיוורים', acceptedTerms: 'חתימה על התקנון', acceptedPrivacy: 'אישור מדיניות הפרטיות',
};

/**
 * שדות חובה חסרים בטופס הרישום. customer = { firstName, ..., acceptedTerms: null|true|false, marketingConsent: null|true|false, acceptedPrivacy: boolean }.
 * הבחירות הכן/לא חייבות להיות מפורשות (null = לא נבחר); אישור מדיניות הפרטיות חייב להיות מסומן.
 */
export function getMissingRegFields(customer, settings) {
  const configuredMandatory = (settings.mandatory_fields || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const baseMissing = Object.keys(CUSTOMER_FIELD_ALIASES).filter((key) => {
    const alwaysRequired = key === 'firstName' || key === 'lastName' || key === 'phone1';
    const isRequired = alwaysRequired || CUSTOMER_FIELD_ALIASES[key].some((alias) => configuredMandatory.includes(alias.toLowerCase()));
    return isRequired && !String(customer[key] || '').trim();
  });
  const extra = [];
  if (settings.require_customer_email === 'true' && !String(customer.email || '').trim()) extra.push('email');
  if (settings.require_full_address === 'true') {
    if (!String(customer.city || '').trim()) extra.push('city');
    if (!String(customer.street || '').trim()) extra.push('street');
    if (!String(customer.houseNum || '').trim()) extra.push('houseNum');
  }
  if (settings.require_customer_id_number === 'true' && !String(customer.zeout || '').trim()) extra.push('zeout');
  const out = [...baseMissing, ...extra.filter((k) => !baseMissing.includes(k))];
  if (customer.acceptedTerms !== true && customer.acceptedTerms !== false) out.push('acceptedTerms');
  if (settings.hide_marketing_consent_field !== 'true') {
    const answered = customer.marketingConsent === true || customer.marketingConsent === false;
    // require_marketing_consent: "לא" אינו תשובה מספקת (כמו תיבת הסימון החובה בטופס הישן)
    if (!answered || (settings.require_marketing_consent === 'true' && customer.marketingConsent !== true)) out.push('marketingConsent');
  }
  if (customer.acceptedPrivacy !== true) out.push('acceptedPrivacy');
  return out;
}

// ---------------------------------------------------------- תאריך עברי להצגה ----------------------------------------------------------

// אותיות הדגימה: י״ג / ט׳ (גרשיים לשתי אותיות ומעלה, גרש לאות אחת)
export const gershayim = (s) => (s.length > 1 ? `${s.slice(0, -1)}״${s.slice(-1)}` : `${s}׳`);

/** "י״ג חשוון תשפ״ז" - תאריך עברי בלבד (כלל הבעלים: תאריכי אירוע מוצגים עבריים בלבד), בכתיב של הדגימה המאושרת. */
export function formatHebrewDate(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const hd = new HDate(d);
    const month = getMonthsForYear(hd.getFullYear()).find((m) => m.value === hd.getMonth())?.label || '';
    return `${gershayim(HEBREW_DAYS[hd.getDate()])} ${month} ${gematriya(hd.getFullYear())}`;
  } catch (e) { return ''; }
}

/**
 * רמזי הטופס של ה-API הציבורי (GET /api/public-kiosk/config, השדה registration: { required, oneOf, marketingMustBeYes }) -> אותם מפתחות הגדרה
 * ש-getMissingRegFields מכיר, כך שהמסלול הציבורי (בלי גישה ל-/api/settings) מסמן שדות חובה בדיוק כמו העמדה. השרת אוכף בכל מקרה.
 */
export function settingsFromRules(rules) {
  if (!rules || typeof rules !== 'object') return {};
  const r = rules.required || {};
  return {
    require_customer_email: r.email ? 'true' : 'false',
    require_full_address: r.address ? 'true' : 'false',
    require_customer_id_number: r.idNumber ? 'true' : 'false',
    require_marketing_consent: rules.marketingMustBeYes ? 'true' : 'false',
  };
}
