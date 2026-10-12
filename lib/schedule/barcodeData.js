// lib/schedule/barcodeData.js — גישה ל-DB של ברקוד בלו״ז (docs/schedule-barcode-plan.md). רק prisma + הלוגיקה הטהורה של barcodeEntry.js;
// בכוונה לא מייבא את marks.js (marks.js מייבא את הקובץ הזה - בלי מעגל).
//
// כללי כתיבה (ה', "כלל הסדר"): קריאות מחוץ לטרנזקציה; בתוך הטרנזקציה האינטראקטיבית רק כתיבות (update עם תנאי על המצב הצפוי + auditAs,
// והתוסף רושם יומן באותה טרנזקציה); timeout/maxWait מפורשים. אין updateMany (לא נרשם ביומן). אידמפוטנטי: פריט שכבר במצב הרצוי מדולג.
import prisma, { auditAs } from '@/app/lib/prisma';
import { itemHasBarcode, itemIsRegistered, itemIsTaken, itemIsDeleted, itemNeedsBarcode, summarizeItems, rowBarcodeInfo, barcodeEqualsWhere } from './barcodeEntry';

export const TX_OPTIONS = { timeout: 30000, maxWait: 15000 };

// הפריטים שנדרשים לחישוב החסימה / תצוגה: ברקוד, מצב לקיחה/החזרה וזהות הדגם (כמו ITEM_SELECT בלו״ז).
export const BARCODE_ITEM_SELECT = {
  id: true, orderId: true, description: true, sizeText: true, barcodePrefix: true, barcode: true,
  barcodeInvalid: true, barcodeInvalidHandled: true, updatedAt: true,
  isTaken: true, takenDate: true, isReturned: true, returnDate: true, isDeleted: true,
  neckAlteration: true, lengthAlteration: true, sleeveAlteration: true, alterationDone: true, alterationDetails: true,
  dressItemId: true,
  dressItem: { select: { sizeText: true, barcodePrefix: true, dress: { select: { name: true, barcodePrefix: true } } } },
};

/** פריטים פעילים של כמה הזמנות -> Map<orderId, item[]> (שאילתה אחת). */
export async function loadItemsByOrder(orderIds) {
  const ids = [...new Set((orderIds || []).filter((x) => Number.isInteger(x)))];
  const map = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return map;
  const rows = await prisma.orderItem.findMany({
    where: { orderId: { in: ids }, isDeleted: false },
    select: BARCODE_ITEM_SELECT,
  });
  for (const r of rows) {
    if (map.has(r.orderId)) map.get(r.orderId).push(r);
  }
  return map;
}

/**
 * שורות משלוח הלוך: מצרף barcodeInfo (אין להן רשימת פריטים בשליפה של המשלוחים). נכשל פתוח לתצוגה בלבד: שגיאה = השורות נשארות בלי
 * barcodeInfo (החסימה האמיתית נאכפת בשרת בכל סימון). eff = הערכים האפקטיביים.
 */
export async function attachDeliveryBarcodeInfo(rows, eff) {
  if (!rows || !rows.length || !eff || eff.delivery === 'off') return;
  try {
    const byOrder = await loadItemsByOrder(rows.map((r) => r.orderId));
    for (const row of rows) {
      const items = byOrder.get(row.orderId) || [];
      const info = rowBarcodeInfo({ stageKey: 'dout', order: { isDelivery: true, deliveryDirection: 'הלוך' }, items, eff });
      if (info) row.barcodeInfo = info;
    }
  } catch (e) {
    console.error('schedule: delivery barcode info failed (display only; marking still enforces the gate)', e);
  }
}

/**
 * פריטים *פתוחים* שמחזיקים ברקוד (לא נמחקו, לא הוחזרו, ההזמנה לא מבוטלת) - המקור היחיד לבדיקת הכפילות בכל מסלול רישום (דיאלוג הלו״ז, rentals/toggle,
 * rentals/scan כשההגדרה פעילה). exceptItemId = הפריט שאנחנו כותבים אליו (לא נחשב).
 * @returns {Promise<{id: string, orderId: number, isTaken: boolean, takenDate: Date|null, eventDate: Date|null}[]>}
 */
export async function findOpenHolders(barcode, { exceptItemId = null } = {}) {
  const b = String(barcode ?? '').trim();
  if (!b) return [];
  const rows = await prisma.orderItem.findMany({
    where: { barcode: b, isDeleted: false, isReturned: false, order: { isDeleted: false } },
    select: { id: true, orderId: true, isTaken: true, takenDate: true, order: { select: { eventDate: true } } },
  });
  return rows
    .filter((r) => !exceptItemId || r.id !== exceptItemId)
    .map((r) => ({ id: r.id, orderId: r.orderId, isTaken: !!r.isTaken, takenDate: r.takenDate || null, eventDate: (r.order && r.order.eventDate) || null }));
}

// ---- ברקודים שנרשמו מהלו״ז מוגנים מ"ביטול סריקות" של החלון הישן (H1) ----------------------------------

const barcodeToOf = (changesJson) => {
  try {
    const c = JSON.parse(changesJson || '{}');
    const b = c && c.barcode;
    if (b && typeof b === 'object') return b.to === undefined || b.to === null ? null : String(b.to);
    return null;
  } catch {
    return null;
  }
};

/**
 * מתוך פריטים (id, barcode) - אלה שהברקוד הנוכחי שלהם נרשם בפעולת REGISTER_BARCODE (הכנה מהלו״ז). DELETE /api/rentals/confirm לא מנקה אותם.
 * שאילתה אחת על AuditLog לפי מזהי הפריטים; כשל בשאילתה = מחזיר Set ריק (התנהגות ישנה) ורושם לשרת.
 */
export async function registeredByScheduleIds(items) {
  const withBarcode = (items || []).filter((it) => itemHasBarcode(it));
  const out = new Set();
  if (!withBarcode.length) return out;
  try {
    // רק הפעולה האחרונה שמשפיעה על הברקוד של הפריט קובעת: REGISTER_BARCODE אחרון עם אותו ברקוד = רישום מהלו״ז; אם אחריו בוטל (CANCEL_SCAN / CANCEL_RENTAL)
    // ונסרק שוב בחלון הישן - זו כבר סריקה שטרם אושרה של החלון הישן ואפשר לנקות אותה (סקירה, ממצא 9)
    const rows = await prisma.auditLog.findMany({
      where: { entityType: 'OrderItem', action: { in: ['REGISTER_BARCODE', 'CANCEL_SCAN', 'CANCEL_RENTAL'] }, entityId: { in: withBarcode.map((it) => String(it.id)) } },
      select: { entityId: true, action: true, changesJson: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const byId = new Map(withBarcode.map((it) => [String(it.id), String(it.barcode).trim()]));
    const seen = new Set();
    for (const r of rows) {
      const id = String(r.entityId);
      if (seen.has(id)) continue; // השורה הראשונה לכל פריט = האחרונה
      seen.add(id);
      if (r.action === 'REGISTER_BARCODE' && barcodeToOf(r.changesJson) === byId.get(id)) out.add(id);
    }
  } catch (e) {
    console.error('schedule barcode: protected-registration lookup failed', e);
  }
  return out;
}

// ---- מסירה: לקיחת הפריטים הרשומים ----------------------------------------------------------------------

/**
 * ברגע המסירה: כל פריט פעיל שיש לו ברקוד ועוד לא נלקח הופך isTaken=true + takenDate (עם הערה ביומן). שמות פעולה: CONFIRM_RENTAL
 * (כמו כל לקיחה - lib/history/orderJournal.js גוזר ממנה "מי לקח").
 * @returns {Promise<{taken: string[], skipped: string[], items: object[]}>} items = מצב הפריטים אחרי הכתיבה (קריאה חוזרת)
 */
export async function takeRegisteredItems({ orderId, now = new Date(), note = 'מסירה מהלו״ז', source = 'schedule' }) {
  const before = await prisma.orderItem.findMany({ where: { orderId, isDeleted: false }, select: BARCODE_ITEM_SELECT });
  // נלקחים: פריטים עם ברקוד תקף שנרשם, ופריטים פטורים מברקוד (בלי זהות דגם, D4) - אחרת ההזמנה הייתה נשארת "חלקית" לנצח. פריט נדרש בלי ברקוד לא נלקח כאן
  // (השער נבדק לפני הקריאה לפונקציה; כאן רק רשת ביטחון).
  const todo = before.filter((it) => !itemIsTaken(it) && (itemIsRegistered(it) || !itemNeedsBarcode(it)));
  const taken = [];
  const skipped = [];
  if (todo.length) {
    await prisma.$transaction(async (tx) => {
      for (const it of todo) {
        try {
          await tx.orderItem.update(auditAs(
            'CONFIRM_RENTAL',
            // barcode בתנאי: ביטול רישום במקביל (ברקוד התאפס) = P2025 ודילוג, לא "נלקח עם ברקוד ריק"
            { where: { id: it.id, isTaken: false, isDeleted: false, ...barcodeEqualsWhere(it) }, data: { isTaken: true, takenDate: now } },
            {
              isTaken: { from: false, to: true },
              takenDate: { from: it.takenDate || null, to: now },
              barcode: { from: it.barcode || null, to: it.barcode || null },
              orderId,
              source,
              note,
            },
          ));
          taken.push(it.id);
        } catch (e) {
          if (e && e.code === 'P2025') { skipped.push(it.id); continue; } // נלקח/נמחק במקביל - אידמפוטנטי
          throw e;
        }
      }
    }, TX_OPTIONS);
  }
  const items = await prisma.orderItem.findMany({ where: { orderId, isDeleted: false }, select: BARCODE_ITEM_SELECT });
  return { taken, skipped, items };
}

/**
 * ביטול מסירה: בודק לפני כל כתיבה שאין פריט שכבר הוחזר (אז חוסמים); ואז מחזיר isTaken=false, takenDate=null לפריטים שנלקחו ולא הוחזרו.
 * הברקוד נשאר רשום. @returns {Promise<{blocked?: 'returned', untaken: string[], items: object[]}>}
 */
export async function untakeItemsForOrder({ orderId, note = 'ביטול מסירה מהלו״ז' }) {
  const before = await prisma.orderItem.findMany({ where: { orderId, isDeleted: false }, select: BARCODE_ITEM_SELECT });
  if (before.some((it) => it.isReturned || it.returnDate)) return { blocked: 'returned', untaken: [], items: before };
  const todo = before.filter((it) => itemIsTaken(it));
  const untaken = [];
  if (todo.length) {
    await prisma.$transaction(async (tx) => {
      for (const it of todo) {
        try {
          await tx.orderItem.update(auditAs(
            'CANCEL_RENTAL',
            { where: { id: it.id, isReturned: false, isDeleted: false }, data: { isTaken: false, takenDate: null } },
            {
              isTaken: { from: true, to: false },
              takenDate: { from: it.takenDate || null, to: null },
              barcode: { from: it.barcode || null, to: it.barcode || null },
              orderId,
              note,
            },
          ));
          untaken.push(it.id);
        } catch (e) {
          if (e && e.code === 'P2025') continue;
          throw e;
        }
      }
    }, TX_OPTIONS);
  }
  const items = await prisma.orderItem.findMany({ where: { orderId, isDeleted: false }, select: BARCODE_ITEM_SELECT });
  return { untaken, items };
}

/** סיכום מהיר של פריטים אחרי כתיבה (לתשובות). */
export function summaryOf(items) {
  const s = summarizeItems(items);
  return { total: s.total, required: s.required, registered: s.registered, taken: s.taken, missing: s.missing.length, complete: s.complete, allTaken: s.allTaken, requiredAllTaken: s.requiredAllTaken };
}

export { itemHasBarcode, itemIsTaken, itemIsDeleted };
