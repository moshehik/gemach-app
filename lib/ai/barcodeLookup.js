// lib/ai/barcodeLookup.js - ענף ודאי (ללא מודל שפה) לחיפוש החכם כשהמשתמשת מקלידה ברקוד.
//
// הבעיה (תמונת מסך של הבעלים, 5.10.2026): בהקלדת 6323401 בחיפוש החכם המודל פירש את המספר כמספר הזמנה (WHERE "orderId" = 6323401)
// והחזיר "לא נמצאו רשומות תואמות עבור מספר ההזמנה 6323401". בפרומפט לא הייתה שום הגדרה של ברקוד. התיקון כפול:
//   1) כללי S16-S20 ב-lib/ai/aiCommon.js (buildSharedSqlRules): מה זה ברקוד, ברקוד מול מספר הזמנה, טלפון, חודשים עבריים, מידות.
//   2) הענף הזה - בדיקה בקוד לפני קריאת המודל, כך שהתשובה על ברקוד מלא (7 ספרות, או "ברקוד N") לא תלויה בציות של המודל לפרומפט.
//
// מה הוא עושה: מחפש את השמלה לפי הברקוד (DressItem.dressBarcode), את ההזמנות שהברקוד מופיע בהן (OrderItem.barcode, האחרונה ראשונה) ואת הזמינות
// של כל המידות של הדגם להיום (getBulkAvailableInventory - קריאה אחת לכל הדגמים, בלי N+1), ומחזיר תשובה קצרה בעברית + טבלת הזמנות אחרונות.
// קריאה בלבד, בלי טרנזקציות, ובלי להרחיב את מה שה-AI יכול לקרוא: אותן טבלאות שה-AI ממילא קורא ב-SQL, עמודות מפורשות בלבד,
// בלי שם לקוח / טלפון / כספים (הכלל "STRICT PRIVACY" של הצ'אט) ובלי מיקום השמלה במחסן. ההרשאות (התחברות + feature:ai + hide_ai_features) נבדקות ב-route לפני הענף.
//
// מודול ללא תלות ב-prisma / Next: כל התלויות (prisma, מנוע המלאי, עיצוב תאריך) מוזרקות - כך נבדק ב-scripts/test_ai_barcode.mjs עם מוקים.

import { classifyQuery, israelDayKey, sizeKey } from '../searchNormalize.js';
import { compareSizeText } from '../sizeSort.js';
import { DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS } from '../orderReservation.js';

export const BARCODE_RECENT_ORDERS = 5; // כמה הזמנות אחרונות מוצגות (טקסט וטבלה)
export const BARCODE_ORDERS_FETCH = 8; // כמה שורות מוזמנות נשלפות (כולל כפילויות לאותה הזמנה)
export const BARCODE_SIZES_MAX = 24; // תקרה לשורות מידות בתשובה
export const STALE_OUT_DAYS = 7; // כמו S6: "נלקח ולא הוחזר" שהאירוע שלו לפני יותר מ-7 ימים = סימון ישן מהייבוא, לא השכרה פעילה

/**
 * האם השאלה היא "רק ברקוד": 7 ספרות (ברקוד מלא לפי classifyQuery), או "ברקוד N" מפורש (5 ספרות ומעלה).
 * סימני סוף שורה ("?", ".", "!") לא משנים. מספר של 5-6 ספרות בלי המילה "ברקוד" הוא דו-משמעי (הזמנה קודם) - נשאר למודל + כללי S17.
 * @returns {{ digits: string, prefix: string, size: string, serial: string, sizeKey: string, legacy: boolean } | null}
 */
export function detectBarcodePrompt(prompt) {
  if (typeof prompt !== 'string') return null;
  const text = prompt.replace(/[\s?!.,;:]+$/u, '');
  const c = classifyQuery(text);
  if (c.kind !== 'barcode' || !c.barcode || !c.barcode.digits) return null;
  if (!(c.barcode.complete || c.explicit)) return null;
  const { digits, prefix, size, serial, sizeKey: sk, legacy } = c.barcode;
  return { digits, prefix, size, serial, sizeKey: sk, legacy: !!legacy };
}

function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** מצב השכרה של שורת הזמנה: returned | out (מושכרת עכשיו) | staleOut | booked (משוריינת, האירוע היום או בעתיד) | past (לא נלקחה והאירוע עבר). */
export function rentalState(row, todayKey) {
  if (row.isReturned) return 'returned';
  const key = row.eventKey;
  if (row.isTaken) return key && dayNumber(todayKey) - dayNumber(key) > STALE_OUT_DAYS ? 'staleOut' : 'out';
  return key && key >= todayKey ? 'booked' : 'past';
}

const STATE_LABEL = Object.freeze({
  returned: 'הוחזרה',
  out: 'מושכרת כרגע',
  staleOut: 'מסומנת כמושכרת ולא הוחזרה (כנראה סימון ישן)',
  booked: 'משוריינת (טרם נלקחה)',
  past: 'לא נלקחה',
});

const fallbackFormat = (key) => { const [y, m, d] = key.split('-'); return `${d}/${m}/${y}`; };

/**
 * מחפש ברקוד ובונה תשובה. deps = { prisma, getBulkAvailableInventory(instant, modelIds), formatDate?(key 'YYYY-MM-DD') -> string, now?: Date }.
 * מחזיר { response, data, sqlQuery: null, deterministic: 'barcode' }. זורק שגיאה אם מסד הנתונים נכשל (ה-route נופל חזרה למודל).
 */
export async function answerBarcode(parsed, deps) {
  const { prisma, getBulkAvailableInventory } = deps;
  const now = deps.now || new Date();
  const todayKey = israelDayKey(now);
  const fmt = (key) => (key ? (deps.formatDate ? deps.formatDate(key) : fallbackFormat(key)) : '');
  const { digits } = parsed;

  // 1) שתי שאילתות במקביל, עמודות מפורשות (בלי שם לקוח / טלפון / כספים / מיקום השמלה)
  const [items, orderRows] = await Promise.all([
    prisma.dressItem.findMany({
      where: { dressBarcode: digits },
      select: {
        id: true, sizeText: true, serialNumber: true, dressBarcode: true, barcodePrefix: true, dressModelId: true,
        inRepair: true, notInUse: true, isDeleted: true,
        dress: { select: { id: true, name: true, barcodePrefix: true, isDeleted: true } },
      },
      take: 3,
    }),
    prisma.orderItem.findMany({
      where: {
        barcode: digits,
        isDeleted: false,
        // "status" ריק ברוב ההזמנות: NOT IN לבד מוציא אותן (כלל S1) - לכן OR מפורש עם null
        order: { isDeleted: false, OR: [{ status: null }, { status: { notIn: [DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS] } }] },
      },
      orderBy: { order: { eventDate: 'desc' } },
      take: BARCODE_ORDERS_FETCH,
      select: {
        id: true, orderId: true, isTaken: true, isReturned: true, sizeText: true, barcodePrefix: true,
        order: { select: { orderId: true, eventDate: true, eventDateHebrew: true } },
      },
    }),
  ]);

  const orders = (orderRows || []).map((r) => ({
    orderId: r.order && r.order.orderId != null ? r.order.orderId : r.orderId,
    isTaken: !!r.isTaken,
    isReturned: !!r.isReturned,
    sizeText: r.sizeText,
    eventKey: r.order && r.order.eventDate ? israelDayKey(r.order.eventDate) : null,
  })).filter((r) => r.orderId != null);
  for (const r of orders) r.state = rentalState(r, todayKey);

  const item = (items || []).find((i) => !i.isDeleted) || (items || [])[0] || null;

  // 2) הדגם: מהשמלה עצמה, ואם אין - לפי הקידומת (כל הספרות חוץ מ-4 האחרונות)
  let models = [];
  if (item && item.dress && !item.dress.isDeleted) models = [item.dress];
  else if (/^\d+$/.test(parsed.prefix)) {
    models = (await prisma.dressModel.findMany({
      where: { barcodePrefix: Number(parsed.prefix), isDeleted: false },
      select: { id: true, name: true, barcodePrefix: true },
      take: 3,
    })) || [];
  }

  // 3) זמינות כל המידות להיום - קריאה אחת למנוע המלאי (כולל כל הדגמים), לא קריאה לכל מידה / דגם
  let availability = null;
  if (models.length && getBulkAvailableInventory) {
    const [y, m, d] = todayKey.split('-').map(Number);
    availability = await getBulkAvailableInventory(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), models.map((x) => x.id));
  }

  const lines = [];
  const modelLabel = (mo) => `${mo.barcodePrefix != null ? mo.barcodePrefix : parsed.prefix}${mo.name ? ` "${mo.name}"` : ''}`;

  // שורת הזיהוי
  const sizeTxt = (item && item.sizeText) || parsed.size;
  const serialTxt = item && item.serialNumber != null ? String(item.serialNumber).padStart(2, '0') : parsed.serial;
  if (item) {
    lines.push(`ברקוד ${digits}: דגם ${models.length ? modelLabel(models[0]) : parsed.prefix}, מידה ${sizeTxt}, מספר סידורי ${serialTxt}.`);
    const flags = [];
    if (item.isDeleted) flags.push('מחוקה מהמלאי');
    if (item.inRepair) flags.push('בתיקון');
    if (item.notInUse) flags.push('מסומנת "לא בשימוש"');
    if (flags.length) lines.push(`מצב השמלה: ${flags.join(', ')}.`);
  } else if (orders.length) {
    lines.push(`הברקוד ${digits} לא נמצא כשמלה במלאי, אבל הוא מופיע בהזמנות. לפי מבנה הברקוד: דגם ${models.length ? modelLabel(models[0]) : parsed.prefix}, מידה ${parsed.size}, מספר סידורי ${parsed.serial}.`);
  } else {
    lines.push(`לא נמצאה שמלה עם הברקוד ${digits}, והוא לא מופיע באף הזמנה. לפי מבנה הברקוד (קידומת דגם, מידה, מספר סידורי): דגם ${parsed.prefix}, מידה ${parsed.size}, מספר סידורי ${parsed.serial}.`);
    lines.push(models.length ? `דגם ${modelLabel(models[0])} קיים במערכת.` : `דגם ${parsed.prefix} לא נמצא במערכת.`);
  }

  // מצב ההשכרה הנוכחי
  if (item || orders.length) {
    const cur = orders.find((r) => r.state === 'out');
    const stale = orders.find((r) => r.state === 'staleOut');
    const soon = orders.filter((r) => r.state === 'booked').sort((a, b) => (a.eventKey < b.eventKey ? -1 : 1))[0];
    if (cur) lines.push(`מושכרת כרגע בהזמנה ${cur.orderId}${cur.eventKey ? ` (אירוע ב-${fmt(cur.eventKey)})` : ''}, טרם הוחזרה.`);
    else if (soon) lines.push(`אין השכרה פעילה כרגע. משוריינת להזמנה ${soon.orderId}${soon.eventKey ? ` לאירוע ב-${fmt(soon.eventKey)}` : ''}.`);
    else lines.push('אין השכרה פעילה כרגע.');
    if (stale && !cur) lines.push(`שימי לב: בהזמנה ${stale.orderId} היא עדיין מסומנת כמושכרת ולא הוחזרה${stale.eventKey ? ` (אירוע ב-${fmt(stale.eventKey)})` : ''} - כנראה סימון ישן.`);
  }

  // הזמנות אחרונות (טקסט + טבלה)
  const seen = new Set();
  const recent = [];
  for (const r of orders) { if (!seen.has(r.orderId)) { seen.add(r.orderId); recent.push(r); } }
  const shown = recent.slice(0, BARCODE_RECENT_ORDERS);
  if (shown.length) lines.push(`הזמנות אחרונות עם הברקוד: ${shown.map((r) => `הזמנה ${r.orderId} (${STATE_LABEL[r.state]})`).join(', ')}.`);

  // זמינות לכל המידות של הדגם (להיום)
  models.forEach((mo) => {
    const bySize = availability && availability[mo.id] ? availability[mo.id] : null;
    const sizes = bySize ? Object.keys(bySize).sort(compareSizeText) : [];
    if (!sizes.length) { lines.push(`אין נתוני זמינות למידות של דגם ${modelLabel(mo)}.`); return; }
    lines.push(`זמינות בכל המידות של דגם ${modelLabel(mo)} להיום (${fmt(todayKey)}):`);
    for (const sz of sizes.slice(0, BARCODE_SIZES_MAX)) {
      const v = bySize[sz] || {};
      const own = sizeKey(sz) === sizeKey(sizeTxt) ? ' (המידה של הברקוד)' : '';
      lines.push(`- מידה ${sz}: פנויות ${v.available != null ? v.available : '?'} מתוך ${v.total != null ? v.total : '?'}${own}`);
    }
    if (sizes.length > BARCODE_SIZES_MAX) lines.push(`ועוד ${sizes.length - BARCODE_SIZES_MAX} מידות.`);
  });

  const data = shown.length
    ? shown.map((r) => ({
      'מספר הזמנה': r.orderId,
      'תאריך אירוע': r.eventKey ? fmt(r.eventKey) : '',
      'מצב': STATE_LABEL[r.state],
      _actionUrl: `/orders/${r.orderId}`,
      _actionLabel: 'פרטי הזמנה',
    }))
    : null;

  return { response: lines.join('\n'), data, sqlQuery: null, deterministic: 'barcode' };
}
