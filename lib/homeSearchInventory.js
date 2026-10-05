// lib/homeSearchInventory.js - שורות "מלאי" בחיפוש הראשי של דף הבית (טהור: בלי prisma / רשת). הנתונים נשלפים ב-lib/globalSearch.js; כאן רק
// הרכבת השורה, איחוד כתיבי מידה ("06" = "6"), מיון, והקרנה לפי הרשאה (מה נשלח למי שאין לה page:dresses_catalog).
//
// עיקרון ההרשאה (החלטה 5.10.2026, דפוס app/api/stock-check/route.js): את ההחלטה מקבל השרת, לא הדפדפן. בלי הרשאת קטלוג השמלות השורה כוללת רק:
// שם הדגם, קוד הדגם, הברקוד שהוקלד, המידה, ספירות זמינות (סה"כ / מוזמנות / פנויות לכל מידה) וסטטוס מצומצם (מושכר / פנוי / לא זמין).
// עם ההרשאה נוספים: קישור לכרטיס הדגם, מספר סידורי, מיקום וסיבת אי-הזמינות (בתיקון / לא בשימוש). מחיר ושאר שדות הפריט לא נשלחים לאף אחת (אין בהם צורך בשורה).

import { compareSizeText } from './sizeSort.js';
import { sizeKey } from './searchNormalize.js';

export const MODEL_CARD_PAGE_KEY = 'page:dresses_catalog';
export const MODEL_CARD_PATH = '/dashboard/dresses/';

export const ITEM_STATUS = Object.freeze({ rented: 'מושכר', available: 'פנוי', unavailable: 'לא זמין', repair: 'בתיקון', notInUse: 'לא בשימוש' });

/**
 * מפת הזמינות של דגם אחד (תוצאת getBulkAvailableInventory: { [sizeText]: { available, total, booked } }) -> רשימת מידות ממוזגות לפי מפתח המידה
 * ("06" ו-"6" = שורה אחת), ממוינת (compareSizeText). לא מסננת מידות בלי פנוי (בניגוד ל-evaluateModel של בדיקת המלאי): "0 פנויות מתוך N" מוצג.
 * @returns {{key: string, size: string, total: number, booked: number, available: number}[]}
 */
export function bucketModelSizes(availability) {
  const buckets = new Map();
  for (const raw of Object.keys(availability || {})) {
    const a = availability[raw] || {};
    const key = sizeKey(raw);
    const b = buckets.get(key) || { key, raws: [], total: 0, booked: 0, available: 0 };
    b.raws.push(String(raw));
    b.total += Number(a.total) || 0;
    b.booked += Number(a.booked) || 0;
    b.available += Math.max(0, Number(a.available) || 0);
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .map((b) => ({
      key: b.key,
      size: b.raws.length === 1 ? (b.raws[0].trim() || b.key) : b.key, // כתיב אחד = כפי שב-DB; כמה כתיבים = המפתח המנורמל
      total: b.total, booked: b.booked, available: b.available,
    }))
    .sort((a, b) => compareSizeText(a.key, b.key));
}

/** סטטוס הפריט (הברקוד) כפי שהוא ידוע לשרת. rentedNow = יש שורת השכרה פעילה (נלקח ולא הוחזר). */
export function itemStatusKey({ item, rentedNow }) {
  if (rentedNow) return 'rented';
  if (item && (item.inRepair || item.notInUse)) return item.inRepair ? 'repair' : 'notInUse';
  return 'available';
}

/**
 * מרכיב את השורה הפנימית המלאה (לפני הקרנה להרשאה).
 * @param {object} p
 * @param {'barcode'|'model'} p.type
 * @param {{id: string, name?: string|null, barcodePrefix?: number|null}} p.model
 * @param {object} [p.item]  פריט הברקוד: { dressBarcode, sizeText, serialNumber, location, inRepair, notInUse }
 * @param {string} [p.barcode] הברקוד שהוקלד (גם כשהפריט לא נמצא)
 * @param {boolean} [p.rentedNow]
 * @param {Array} p.sizes     תוצאת bucketModelSizes (אפשר כבר מסוננת למידה אחת)
 * @param {string} p.dateKey  היום שלגביו חושבה הזמינות
 * @param {string} [p.dateLabel] תווית תצוגה ("היום" / תאריך עברי)
 * @param {string} [p.ownSizeKey] מפתח המידה של הברקוד (להדגשה)
 * @param {boolean} [p.itemMissing] הברקוד לא נמצא כפריט - הדגם נקבע לפי הקידומת
 */
export function buildInventoryRow({ type, model, item, barcode, rentedNow, sizes, dateKey, dateLabel, ownSizeKey, itemMissing }) {
  return {
    type,
    modelId: model.id,
    modelName: model.name || '',
    modelCode: model.barcodePrefix ?? null,
    barcode: barcode || (item && item.dressBarcode) || '',
    size: item ? String(item.sizeText ?? '').trim() : '',
    serial: item && item.serialNumber != null ? item.serialNumber : null,
    location: item && item.location ? String(item.location) : '',
    statusKey: type !== 'barcode' ? '' : item ? itemStatusKey({ item, rentedNow }) : (rentedNow ? 'rented' : ''),
    itemMissing: !!itemMissing,
    date: dateKey,
    dateLabel: dateLabel || '',
    sizes: sizes.map((s) => ({ size: s.size, total: s.total, booked: s.booked, available: s.available, own: !!ownSizeKey && s.key === ownSizeKey })),
  };
}

// בלי הרשאה: מושכר / פנוי / לא זמין בלבד (בלי לחשוף אם הסיבה תיקון או "לא בשימוש"); עם הרשאה - הסיבה המדויקת
function statusLabel(key, detailed) {
  if (!key) return '';
  if (detailed || key === 'rented' || key === 'available') return ITEM_STATUS[key];
  return ITEM_STATUS.unavailable;
}

/**
 * הקרנה לפי הרשאה: זו הפונקציה היחידה שמייצרת את מה שנשלח לדפדפן.
 * @param {object} full  תוצאת buildInventoryRow
 * @param {{canLink: boolean}} perms  canLink = page:dresses_catalog
 */
export function projectInventoryRow(full, { canLink }) {
  const out = {
    type: full.type,
    modelName: full.modelName,
    modelCode: full.modelCode,
    barcode: full.barcode,
    size: full.size,
    status: statusLabel(full.statusKey, canLink),
    itemMissing: full.itemMissing,
    date: full.date,
    dateLabel: full.dateLabel,
    sizes: full.sizes,
  };
  if (canLink) {
    out.link = MODEL_CARD_PATH + full.modelId;
    out.serial = full.serial;
    out.location = full.location;
  }
  return out;
}

const OWN_FIELDS_WITHOUT_PERMISSION = ['type', 'modelName', 'modelCode', 'barcode', 'size', 'status', 'itemMissing', 'date', 'dateLabel', 'sizes'];
/** רשימת השדות שמותר שיופיעו בשורה שנשלחת למי שאין לה הרשאת קטלוג (לבדיקות). */
export const INVENTORY_PUBLIC_FIELDS = Object.freeze(OWN_FIELDS_WITHOUT_PERMISSION.slice());

/** סדר שורות מלאי של מילות מפתח: פנוי יורד (סכום המידות המוצגות), אחר כך קוד דגם, אחר כך שם. */
export function compareInventoryRows(a, b) {
  const fa = a.sizes.reduce((s, x) => s + x.available, 0);
  const fb = b.sizes.reduce((s, x) => s + x.available, 0);
  if (fb !== fa) return fb - fa;
  const ac = a.modelCode ?? Number.MAX_SAFE_INTEGER;
  const bc = b.modelCode ?? Number.MAX_SAFE_INTEGER;
  if (ac !== bc) return ac - bc;
  return String(a.modelName || '').localeCompare(String(b.modelName || ''), 'he');
}
