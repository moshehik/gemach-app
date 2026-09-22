import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { verifySecret } from '@/lib/passwordAuth';
import { hasPermission } from '@/lib/permissions';
import { notifyManagers } from '@/lib/notifyManagers';

// require_approval_for_early_return (SystemSetting, ברירת מחדל: חסר/false = ההתנהגות
// הישנה - אפשר לסמן פריט כהוחזר בכל שלב, גם לפני שהאירוע/תקופת ההשכרה הגיעו). דווח
// כדיווח תקלה 8efa57cc, 2026-09-22 - מדווח/ת רצה שסימון "הוחזר" עבור הזמנה שהאירוע
// שלה עדיין לא הגיע ידרוש אישור מנהל, בדיוק כמו checkRentalBarcodeMatch.
export async function isEarlyReturnApprovalRequired() {
  try {
    const row = await getCachedSetting('require_approval_for_early_return');
    return row?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * @param {{eventDate?: string|Date|null}} order
 * @returns {{isEarly: boolean, eventDate?: Date}}
 */
export function getEarlyReturnInfo(order) {
  if (!order?.eventDate) return { isEarly: false };
  const eventDate = new Date(order.eventDate);
  if (isNaN(eventDate.getTime())) return { isEarly: false };
  eventDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today < eventDate ? { isEarly: true, eventDate } : { isEarly: false };
}

// אימות עקיפה של מנהל - אותו דפוס בדיוק כמו verifyManagerOverride ב-lib/rentalBarcodeGuard.js:
// השרת מאמת את הסיסמה בעצמו מול ה-DB ולא סומך על שום דגל מהלקוח. מי שרשאי לאשר נקבע
// בהרשאה feature:early_return_approval (ברירת מחדל: הנהלה ראשית/מתכנת תמיד).
async function verifyManagerOverride(overridePin, overrideEmployeeId) {
  if (!overridePin) return null;
  const candidates = await prisma.employee.findMany({
    where: { isActive: true, ...(overrideEmployeeId ? { id: overrideEmployeeId } : {}) }
  });
  for (const candidate of candidates) {
    if (await verifySecret(overridePin, candidate.password) && await hasPermission(candidate, 'feature:early_return_approval')) {
      return candidate;
    }
  }
  return null;
}

/**
 * בדיקה לפני סימון פריט כ"הוחזר": אם ההגדרה דלוקה וההזמנה מיועדת לאירוע עתידי שעדיין
 * לא הגיע - חוסמת אלא אם התקבלה עקיפת מנהל תקפה (overridePin מאומת נגד feature:early_return_approval).
 *
 * מחזיר { response, auditNote } - response=null כשמותר להמשיך.
 *
 * @param {{orderId: number, eventDate?: string|Date|null}} order
 * @param {{overridePin?: string, overrideEmployeeId?: string}} [opts]
 */
export async function checkEarlyReturn(order, opts = {}) {
  if (!(await isEarlyReturnApprovalRequired())) return { response: null, auditNote: null };

  const { isEarly, eventDate } = getEarlyReturnInfo(order);
  if (!isEarly) return { response: null, auditNote: null };

  const { overridePin, overrideEmployeeId } = opts;
  const dateStr = eventDate.toLocaleDateString('he-IL');
  const message = `תאריך האירוע של ההזמנה (${dateStr}) עדיין לא הגיע`;

  if (overridePin) {
    const approver = await verifyManagerOverride(overridePin, overrideEmployeeId);
    if (approver) {
      try {
        const actingId = await getActingEmployeeId();
        const actingEmployee = actingId
          ? await prisma.employee.findUnique({ where: { id: actingId }, select: { firstName: true, lastName: true } })
          : null;
        const actingName = actingEmployee ? `${actingEmployee.firstName || ''} ${actingEmployee.lastName || ''}`.trim() || 'עובד/ת לא ידוע/ה' : 'עובד/ת לא ידוע/ה';
        const approverName = `${approver.firstName || ''} ${approver.lastName || ''}`.trim() || 'מנהל/ת';
        await notifyManagers({
          title: 'סומן פריט כהוחזר לפני מועד האירוע (אישור מנהל)',
          content: `${actingName} סימן/ה פריט בהזמנה #${order.orderId} כהוחזר למרות ש${message}, באישור ${approverName}.`
        });
      } catch (notifyErr) {
        console.error('Failed to notify managers of early-return override:', notifyErr);
      }
      return { response: null, auditNote: `אושרה בעקיפת מנהל: ${message}` };
    }
  }

  const response = NextResponse.json({
    error: overridePin
      ? `${message}. סיסמת האישור שגויה או שאינה של מנהל/ת מורשה.`
      : `${message}. נדרש אישור מנהל כדי לסמן את הפריט כהוחזר.`,
    earlyReturn: true,
    ...(overridePin ? { overrideRejected: true } : {}),
    eventDate
  }, { status: 409 });
  return { response, auditNote: null };
}
