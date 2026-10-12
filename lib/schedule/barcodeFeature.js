// lib/schedule/barcodeFeature.js — החלק הקל של ברקוד בלו״ז שמסלולי הכתיבה הישנים (rentals/scan, rentals/toggle, orders/[id]) צריכים: האם ההגדרה פעילה
// להזמנה, בדיקת "הברקוד פתוח בהזמנה אחרת", והשגיאה המשותפת. בלי marks.js / loaders (כבדים) - ראוט הזמנה לא צריך לטעון את כל הלו״ז בשביל זה.
// docs/schedule-barcode-plan.md. ברירת מחדל (הגדרה חסרה / off): barcodeFeatureFor מחזיר null בלי שאילתה על ההזמנה.
import prisma from '@/app/lib/prisma';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { loadScheduleSettings } from './settings';
import { HANDOVER_STAGE_BY_KIND, isFeatureOn, orderKind } from './barcodeEntry';
import { findOpenHolders } from './barcodeData';

export class BarcodeError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || null;
  }
}

export const FEATURE_ORDER_SELECT = { orderId: true, isDeleted: true, status: true, isDelivery: true, deliveryDirection: true };

/**
 * האם ההגדרה פעילה להזמנה. null = כבוי (ברירת מחדל) - הקורא ממשיך בדיוק כמו היום.
 * @returns {Promise<null|{when: string, kind: string, closed: boolean, handoverStage: string, eff: object, order: object}>}
 */
export async function barcodeFeatureFor(orderId, settings = null) {
  const resolved = settings || await loadScheduleSettings();
  if (!isFeatureOn(resolved.barcode)) return null;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const order = await prisma.order.findUnique({ where: { orderId: id }, select: FEATURE_ORDER_SELECT });
  if (!order) return null;
  const kind = orderKind(order);
  const when = resolved.barcode[kind] || 'off';
  if (when === 'off') return null;
  return { when, kind, eff: resolved.barcode, order, handoverStage: HANDOVER_STAGE_BY_KIND[kind], closed: !!order.isDeleted || order.status === DRAFT_ORDER_STATUS };
}

/** בדיקת "פתוח בהזמנה אחרת" - משותפת לדיאלוג ולמסלולי הכתיבה הישנים כשההגדרה פעילה. null = פנוי. */
export async function openElsewhereError(barcode, { orderId, exceptItemId = null, now = new Date() } = {}) {
  const holders = (await findOpenHolders(barcode, { exceptItemId })).filter((h) => h.orderId !== orderId);
  if (!holders.length) return null;
  const taken = holders.find((h) => h.isTaken || h.takenDate);
  if (taken) {
    return new BarcodeError(409, 'taken_elsewhere', `השמלה הזו עדיין מושכרת בהזמנה ${taken.orderId} ולא הוחזרה. החזרה/אישור מנהל - דרך כרטיס ההזמנה.`, { otherOrderId: taken.orderId });
  }
  const o = holders[0];
  const stale = !!(o.eventDate && new Date(o.eventDate).getTime() < now.getTime() - 24 * 3600 * 1000);
  return new BarcodeError(409, 'prepped_elsewhere', `הברקוד הזה כבר נרשם בהכנה להזמנה ${o.orderId}.${stale ? ' האירוע שלה עבר - אפשר לשחרר את הרישום בכרטיס ההזמנה שלה.' : ''}`, { otherOrderId: o.orderId, stale });
}

/** האם ההגדרה פעילה לפחות לסוג הזמנה אחד - בדיקה זולה (מטמון ההגדרות) לפני שטוענים את שאר מנגנון הברקוד. */
export async function isBarcodeEntryOn(settings = null) {
  const resolved = settings || await loadScheduleSettings();
  return isFeatureOn(resolved.barcode);
}

// עטיפות עצלות למסלולי הכתיבה הישנים (rentals/toggle, confirm, cancel): barcodeScan.js מושך את כל מנגנון הלו״ז (marks / loaders / deliveries) - לא טוענים אותו
// בכלל כשההגדרה כבויה (ברירת מחדל), כדי לא להוסיף זמן התחלה קרה / CPU לראוטים חמים.
export async function lazyAutoMarkHandover(orderId, opts) {
  if (!(await isBarcodeEntryOn())) return { status: 'off' };
  return (await import('./barcodeScan')).autoMarkHandoverForOrder(orderId, opts);
}
export async function lazyAutoUnmarkHandover(orderId, opts) {
  if (!(await isBarcodeEntryOn())) return { status: 'off' };
  return (await import('./barcodeScan')).autoUnmarkHandoverForOrder(orderId, opts);
}
export async function lazyCheckHandoverGate(orderId) {
  if (!(await isBarcodeEntryOn())) return null;
  return (await import('./barcodeScan')).checkHandoverGate(orderId);
}
