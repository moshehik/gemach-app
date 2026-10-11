// ולידציית קלט בשרת ליצירת דגם (POST /api/dresses) ופריט (POST /api/dresses/[id]/items).
// עד עכשיו הלקוח (אשף "דגם חדש", כרטיס הדגם, האשף הישן) היה קו ההגנה היחיד: פנייה ישירה ל-API שמרה קוד באורך שגוי, "998x" -> 998, "007" -> 7,
// שם של רווחים, קטגוריה לא קיימת, מידה 150 / "abc", סידורי 777, ברקוד שלא מתאים לקוד+מידה+סידורי, כמות שלילית ופריט ריק.
// לוגיקה טהורה (בלי prisma / next) - נבדקת ב-scripts/test_dress_input_validation.mjs. כל הפונקציות מחזירות { error } או { data }.

export const MAX_NAME = 100;
export const MAX_NOTES = 2000;
export const MAX_URL = 2000;
export const MAX_CATEGORY = 60;

const isBlankStr = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const pad2 = (v) => String(v).padStart(2, '0');

/** קוד דגם: ספרות ASCII בלבד, באורך ההגדרה barcodePrefixLength, בלי 0 מוביל (נשמר כ-Int, "007" היה נשמר כ-7 והברקודים לא היו מתאימים) */
export function validateCode(raw, codeLen) {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return { error: 'קוד הדגם חייב להכיל ספרות בלבד.' };
  if (codeLen && s.length !== codeLen) return { error: `קוד הדגם חייב להיות בן ${codeLen} ספרות.` };
  if (s.startsWith('0')) return { error: 'קוד הדגם לא יכול להתחיל ב-0.' };
  return { data: parseInt(s, 10) };
}

function validateDate(raw, label) {
  if (isBlankStr(raw)) return { data: null };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { error: `${label} לא תקין.` };
  const y = d.getUTCFullYear();
  if (y < 1990 || y > 2100) return { error: `${label} מחוץ לטווח המותר.` };
  return { data: d };
}

/**
 * גוף יצירת דגם -> נתונים מנוקים לכתיבה. ctx: { codeLen, categories } (categories = שמות קטגוריות המחירון; ריק/חסר = לא בודקים התאמה)
 * שם: אם חסר - נגזר "דגם <קוד>" (כמו תמיד); אם נשלח - חייב להיות מחרוזת לא ריקה אחרי trim.
 */
export function validateModelInput(body, ctx = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'גוף הבקשה לא תקין.' };
  const out = {};
  if (isBlankStr(body.barcodePrefix)) out.barcodePrefix = null;
  else {
    const c = validateCode(body.barcodePrefix, ctx.codeLen);
    if (c.error) return { error: c.error, field: 'barcodePrefix' };
    out.barcodePrefix = c.data;
  }
  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string' || body.name.trim() === '') return { error: 'שם הדגם לא יכול להיות ריק.', field: 'name' };
    if (body.name.trim().length > MAX_NAME) return { error: `שם הדגם ארוך מדי (עד ${MAX_NAME} תווים).`, field: 'name' };
    out.name = body.name.trim();
  } else out.name = null;
  if (isBlankStr(body.priceCategory)) out.priceCategory = null;
  else {
    if (typeof body.priceCategory !== 'string') return { error: 'קטגוריית המחיר לא תקינה.', field: 'priceCategory' };
    const cat = body.priceCategory.trim();
    if (cat.length > MAX_CATEGORY) return { error: 'קטגוריית המחיר ארוכה מדי.', field: 'priceCategory' };
    if (Array.isArray(ctx.categories) && ctx.categories.length && !ctx.categories.includes(cat)) return { error: `קטגוריית המחיר "${cat}" לא קיימת במחירון.`, field: 'priceCategory' };
    out.priceCategory = cat;
  }
  if (isBlankStr(body.notes)) out.notes = null;
  else {
    if (typeof body.notes !== 'string') return { error: 'ההערות לא תקינות.', field: 'notes' };
    if (body.notes.length > MAX_NOTES) return { error: `ההערות ארוכות מדי (עד ${MAX_NOTES} תווים).`, field: 'notes' };
    out.notes = body.notes.trim();
  }
  for (const k of ['imageUrl', 'thumbnailUrl']) {
    if (isBlankStr(body[k])) out[k] = null;
    else if (typeof body[k] !== 'string' || body[k].length > MAX_URL) return { error: 'כתובת התמונה לא תקינה או ארוכה מדי.', field: k };
    else out[k] = body[k].trim();
  }
  if (body.inInspection !== undefined && typeof body.inInspection !== 'boolean') return { error: 'שדה "הצג בבדיקה" לא תקין.', field: 'inInspection' };
  out.inInspection = !!body.inInspection;
  const dt = validateDate(body.entryDateToRepo, 'תאריך הכניסה למאגר');
  if (dt.error) return { error: dt.error, field: 'entryDateToRepo' };
  out.entryDateToRepo = dt.data || new Date();
  return { data: out };
}

const intIn = (raw, lo, hi) => {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= lo && raw <= hi ? raw : null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= lo && n <= hi ? n : null;
};

/**
 * גוף יצירת פריט -> נתונים מנוקים. model = { barcodePrefix } של הדגם האב (כבר נבדק שקיים ולא נמחק).
 * מידה: מחרוזת קצרה (בנתוני אמת יש גם מידות לא מספריות / עם אפס מוביל - לא כופים מספר), אבל כשהיא מספרית 0-99 והסידורי קיים -
 * הברקוד חייב להיות בדיוק קוד+מידה(2)+סידורי(2) - כמו שכל הלקוחות בונים אותו.
 */
export function validateItemInput(body, model = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'גוף הבקשה לא תקין.' };
  const out = {};
  if (isBlankStr(body.sizeText)) out.sizeText = null;
  else {
    const s = String(body.sizeText).trim();
    if (s.length > 10 || /[<>]/.test(s)) return { error: 'המידה לא תקינה.', field: 'sizeText' };
    out.sizeText = s;
  }
  if (isBlankStr(body.serialNumber)) out.serialNumber = null;
  else {
    const n = intIn(body.serialNumber, 1, 99);
    if (n === null) return { error: 'המספר הסידורי חייב להיות מספר שלם בין 1 ל-99.', field: 'serialNumber' };
    out.serialNumber = n;
  }
  if (isBlankStr(body.dressBarcode)) out.dressBarcode = null;
  else {
    const bc = String(body.dressBarcode).trim();
    if (!/^\d{3,14}$/.test(bc)) return { error: 'הברקוד חייב להכיל ספרות בלבד.', field: 'dressBarcode' };
    out.dressBarcode = bc;
  }
  if (out.sizeText === null && out.dressBarcode === null) return { error: 'יש להזין מידה או ברקוד.', field: 'sizeText' };
  const prefix = model.barcodePrefix == null ? '' : String(model.barcodePrefix);
  if (out.dressBarcode && prefix && !out.dressBarcode.startsWith(prefix)) return { error: `הברקוד חייב להתחיל בקוד הדגם (${prefix}).`, field: 'dressBarcode' };
  if (out.dressBarcode && prefix && out.sizeText !== null && /^\d{1,2}$/.test(out.sizeText) && out.serialNumber !== null) {
    const want = `${prefix}${pad2(out.sizeText)}${pad2(out.serialNumber)}`;
    if (out.dressBarcode !== want) return { error: `הברקוד לא מתאים לקוד, למידה ולמספר הסידורי (צפוי ${want}).`, field: 'dressBarcode' };
  }
  if (isBlankStr(body.quantity)) out.quantity = 1;
  else {
    const q = intIn(body.quantity, 0, 999);
    if (q === null) return { error: 'הכמות חייבת להיות מספר שלם בין 0 ל-999.', field: 'quantity' };
    out.quantity = q;
  }
  for (const [k, max] of [['location', 40], ['cartonNumber', 20], ['dressName', MAX_NAME]]) {
    if (isBlankStr(body[k])) out[k] = null;
    else if (typeof body[k] !== 'string' && typeof body[k] !== 'number') return { error: `השדה ${k} לא תקין.`, field: k };
    else if (String(body[k]).trim().length > max) return { error: `השדה ${k} ארוך מדי.`, field: k };
    else out[k] = String(body[k]).trim();
  }
  if (isBlankStr(body.locationNum)) out.locationNum = null;
  else {
    const n = intIn(body.locationNum, 0, 9999);
    if (n === null) return { error: 'מספר המיקום לא תקין.', field: 'locationNum' };
    out.locationNum = n;
  }
  for (const k of ['inRepair', 'notInUse']) {
    if (body[k] !== undefined && typeof body[k] !== 'boolean') return { error: `השדה ${k} לא תקין.`, field: k };
    out[k] = !!body[k];
  }
  const since = validateDate(body.notInUseSince, 'תאריך "לא בשימוש"');
  if (since.error) return { error: since.error, field: 'notInUseSince' };
  out.notInUseSince = since.data;
  const ent = validateDate(body.entryDateToRepo, 'תאריך הכניסה');
  if (ent.error) return { error: ent.error, field: 'entryDateToRepo' };
  out.entryDateToRepo = ent.data || new Date();
  return { data: out };
}
