// לוגיקה טהורה (בלי React / דפדפן / רשת) של אשף "דגם חדש" (A5): אימות קוד הדגם, בניית ברקוד, הצעת מספר סידורי, אימות פריט ראשוני,
// מה חסר להמשך, "יש שינוי", בניית ה-payload לשרת ופענוח שגיאות השרת. נבדק ב-node: scripts/test_model_new_wizard.mjs.
// הכללים נגזרים מהאשף הישן (components/dresses/modern/ModernNewDressWizard.js) ומה-API (app/api/dresses/route.js, app/api/dresses/[id]/items/route.js,
// app/api/dresses/next-code/route.js) - אותם payloads, אותן הודעות שגיאה.

export const DEFAULT_CODE_LEN = 3; // ברירת המחדל של barcodePrefixLength (כמו next-code/route.js)
export const DEFAULT_LOCATIONS = Object.freeze(['חנות', 'רזרבה', 'מחסן']); // כמו הכרטיס הישן (item_locations ריק)

export const pad2 = (v) => String(v).padStart(2, '0');
export const plural = (n, one, many, zero) => (n === 0 && zero !== undefined ? zero : n === 1 ? one : `${n} ${many}`);

// אורך קוד הדגם = ההגדרה barcodePrefixLength (1..10, ברירת מחדל 3). האשף הישן קבע 3 ספרות בדיוק; ההגדרה היא מה ש-next-code מייצר בפועל
export function parseCodeLen(v) {
  const n = parseInt(String(v == null ? '' : v).trim(), 10);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : DEFAULT_CODE_LEN;
}

// רשימת המיקומים מההגדרה item_locations ("חנות, רזרבה") - ריקה = ברירת המחדל של הכרטיס
export function parseLocations(v) {
  const list = String(v == null ? '' : v).split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [...DEFAULT_LOCATIONS];
}

// הקלדת קוד: ספרות בלבד (התיבה לא חותכת ל-len - הודעת השגיאה אומרת כמה ספרות; חותכים רק לקצה סביר)
export function sanitizeCode(v, len = DEFAULT_CODE_LEN) {
  return String(v == null ? '' : v).replace(/\D/g, '').slice(0, Math.max(6, len));
}

// הודעת שגיאה לקוד (ריק = תקין). taken = true כש-/api/dresses החזיר דגם פעיל עם אותו קוד (אותה בדיקה כמו POST /api/dresses: isDeleted=false)
export function codeError(code, { len = DEFAULT_CODE_LEN, taken = false } = {}) {
  const c = String(code == null ? '' : code).trim();
  if (!c) return 'חובה להזין קוד דגם';
  if (!new RegExp(`^\\d{${len}}$`).test(c)) return `קוד דגם בן ${len} ספרות בדיוק`;
  if (taken) return 'הקוד כבר קיים במאגר';
  return '';
}

// ברקוד פריט = קוד הדגם + מידה (2 ספרות) + מספר סידורי (2 ספרות)
export const buildBarcode = (code, size, serial) => `${String(code == null ? '' : code).trim()}${pad2(String(size).trim())}${pad2(serial)}`;

// המספר הסידורי הבא לאותה מידה (עולה); מידה ריקה / אין פריטים באותה מידה -> 1
export function nextSerial(items, size) {
  const same = (items || []).filter((p) => String(p.size).trim() === String(size).trim());
  return same.length ? Math.max(...same.map((p) => +p.serial || 0)) + 1 : 1;
}

// תצוגה מקדימה של ברקוד הפריט הבא (לפני "הוסף פריט"): מידה ריקה -> "קוד____"
export function barcodePreview(code, add, items) {
  const sz = String(add.size).trim();
  const c = String(code == null ? '' : code).trim();
  if (sz === '') return (c || '###') + '____';
  const sr = String(add.serial).trim() === '' ? nextSerial(items, sz) : add.serial;
  return buildBarcode(c, sz, sr);
}

// אימות שורת מלאי ראשוני לפני הוספה. מחזיר { error } או { size, serial } (שניהם מספרים). אותן הודעות כמו האשף הישן
export function validateNewItem(add, items) {
  const size = String(add.size).trim();
  if (!size) return { error: 'חובה להזין מידה' };
  const sn = Number(size);
  if (isNaN(sn) || sn < 0 || sn > 99 || !Number.isInteger(sn)) return { error: 'מידה חייבת להיות מספר שלם בין 0 ל-99' };
  const serial = Number(String(add.serial).trim() || nextSerial(items, size));
  if (isNaN(serial) || serial < 1 || serial > 99 || !Number.isInteger(serial)) return { error: "מס' סידורי חייב להיות מספר שלם בין 1 ל-99" };
  if ((items || []).some((p) => Number(p.size) === sn && Number(p.serial) === serial)) return { error: `כבר נוסף פריט במידה ${sn} עם מס' סידורי ${serial}` };
  return { size: sn, serial };
}

export const sizesOf = (items) => [...new Set((items || []).map((p) => String(p.size)))].sort((a, b) => a - b);
export const locCount = (items, loc) => (items || []).filter((p) => p.loc === loc).length;

// מה חסר כדי להמשיך (שלב 1): רשימת תוויות בסדר קוד, שם, קטגוריה
export function missingList({ codeErr, hasCode, nameOk, catOk, useModelNames = true }) {
  return [
    codeErr && (hasCode ? 'קוד דגם תקין' : 'קוד דגם'),
    useModelNames && !nameOk && 'שם דגם',
    !catOk && 'קטגוריית מחיר',
  ].filter(Boolean);
}

// יש משהו ללכת לאיבוד? (קוד ריק - למשל בזמן טעינת הקוד הפנוי אחרי איפוס - אינו שינוי) (לחצן "ביטול" -> חלון "לצאת בלי ליצור"; "בטל הכול" ברייל). nextCode = הקוד שנטען מראש
export function isDirty(d, items, { todayKey, nextCode }) {
  return !!(String(d.name || '').trim() || d.cat || String(d.notes || '').trim() || d.img || d.inspect || (items && items.length)
    || d.entry !== todayKey || (String(d.code || '').trim() !== '' && String(d.code).trim() !== String(nextCode || '')));
}

// תאריך כניסה למאגר: מפתח YYYY-MM-DD (יום ישראלי) -> ISO בצהרי היום (כמו שהאשף הישן שולח ISO; הצהריים מונעים הזזת יום באזור זמן)
export const entryIso = (key) => new Date(`${key}T12:00:00`).toISOString();

// ה-payload ל-POST /api/dresses - אותם שדות כמו האשף הישן (name, barcodePrefix, priceCategory, notes, inInspection, imageUrl, thumbnailUrl, entryDateToRepo)
export function buildModelPayload(d, { useModelNames = true } = {}) {
  const code = String(d.code || '').trim();
  const name = String(d.name || '').trim();
  return {
    name: !useModelNames && !name ? `דגם ${code || 'ללא קוד'}` : name,
    barcodePrefix: code,
    priceCategory: d.cat || '',
    notes: d.notes || '',
    inInspection: !!d.inspect,
    imageUrl: d.img || '',
    thumbnailUrl: d.thumb || '',
    entryDateToRepo: entryIso(d.entry),
  };
}

// ה-payload ל-POST /api/dresses/<id>/items (כמו האשף הישן: ...תכנון הפריט, barcodePrefix ושם מהדגם שנוצר, תאריך כניסה)
export function buildItemPayload(it, created, d, locations) {
  return {
    sizeText: String(it.size).trim(),
    serialNumber: Number(it.serial),
    dressBarcode: buildBarcode(String(d.code || '').trim(), it.size, it.serial),
    location: it.loc || (locations && locations[0]) || null,
    barcodePrefix: created.barcodePrefix,
    dressName: created.name,
    entryDateToRepo: entryIso(d.entry),
  };
}

// כותרת + פרטי שגיאה מתשובת ה-POST של הדגם (403 הרשאה / 400 "הקוד כבר בשימוש!" / 400 שם דגם קיים (field:'name') / 500)
export function describeCreateError(status, data) {
  const msg = (data && data.error) || 'יצירת הדגם נכשלה';
  const dup = /הקוד כבר בשימוש/.test(msg);
  const nameDuplicate = status === 400 && !!data && data.field === 'name';
  return { msg, duplicate: dup, nameDuplicate, forbidden: status === 403, text: `שגיאה: ${msg}` };
}

// טווח המחירים (לפי המחירון) של קטגוריה - השורה הקטנה באפשרות הבחירה. רק שורות בתוקף ב-now. null אם אין
export function priceRangeLabel(rows, cat, now = new Date()) {
  const ps = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.category === cat && typeof r.price === 'number'
      && (!r.startDate || new Date(r.startDate) <= now) && (!r.endDate || new Date(r.endDate) >= now))
    .map((r) => r.price);
  if (!ps.length) return null;
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  return lo === hi ? `מחיר ₪${lo}` : `מחיר ₪${lo}–₪${hi}`;
}

// סיכום "הושלם" של פס ההתקדמות לכל שלב (recap)
export function recapOf(n, { d, items, useModelNames = true }) {
  const code = String(d.code || '').trim();
  if (n === 1) return { code, name: useModelNames ? String(d.name || '').trim() : '' };
  if (n === 2) return d.img ? 'עם תמונה' : 'ללא תמונה';
  if (n === 3) return items.length ? plural(items.length, 'פריט אחד', 'פריטים') : 'ללא פריטים';
  return 'הושלם';
}

// שמות השלבים (לפי הגדרת תמונות: כשהתמונות מוסתרות - השלב השני הוא "הערות והתראות", כמו האשף הישן)
export const stepsOf = (showImages = true) => [
  { l: 'זיהוי הדגם', i: 'tag', q: 'איזה דגם?' },
  { l: showImages ? 'תמונה והערות' : 'הערות והתראות', i: 'dress', q: 'איך הוא נראה?' },
  { l: 'מלאי ראשוני', i: 'box', q: 'כמה יש במלאי?' },
  { l: 'סיכום', i: 'list', q: 'הכול נכון?' },
];

// אייקון לכל מיקום (כמו המוק: חנות / מחסן / רזרבה); מיקום אחר -> סיכה
export const LOC_ICONS = Object.freeze({ 'חנות': 'store', 'מחסן': 'box', 'רזרבה': 'flag' });
export const locIcon = (l) => LOC_ICONS[l] || 'pin';
