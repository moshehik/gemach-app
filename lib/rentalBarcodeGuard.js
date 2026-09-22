import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { verifySecret } from '@/lib/passwordAuth';
import { hasPermission } from '@/lib/permissions';
import { notifyManagers } from '@/lib/notifyManagers';
import { checkBarcodeMatchesItem, describeMismatch } from '@/lib/rentalBarcodeMatch';

// שדות פריט ההזמנה שנדרשים לזיהוי הדגם/המידה שהוזמנו (ר' getOrderedIdentity).
export const RENTAL_MATCH_ITEM_SELECT = {
  orderId: true,
  sizeText: true,
  barcodePrefix: true,
  dressItem: {
    select: { barcodePrefix: true, sizeText: true, dress: { select: { barcodePrefix: true } } }
  }
};

/**
 * enforce_rental_barcode_match (SystemSetting, ברירת מחדל: חסר/false = ההתנהגות הישנה -
 * כל ברקוד מתקבל בלי בדיקה מול הדגם/המידה שהוזמנו). כשדלוק - ראה checkRentalBarcodeMatch.
 */
export async function isRentalBarcodeMatchEnforced() {
  try {
    const row = await getCachedSetting('enforce_rental_barcode_match');
    return row?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * אימות עקיפה של מנהל - בדיוק כמו חסימת הרזרבה ב-app/api/rentals/scan/route.js: השרת מאמת
 * את הסיסמה בעצמו מול ה-DB (verifySecret) ולא סומך על שום דגל מהלקוח; מי שרשאי לאשר נקבע בהרשאה feature:barcode_mismatch_override (ברירת מחדל: מנהל/מתכנת; הנהלה ראשית תמיד).
 * מחזיר את העובד המאשר, או null.
 */
async function verifyManagerOverride(overridePin, overrideEmployeeId) {
  if (!overridePin) return null;
  const candidates = await prisma.employee.findMany({
    where: { isActive: true, ...(overrideEmployeeId ? { id: overrideEmployeeId } : {}) }
  });
  for (const candidate of candidates) {
    if (await verifySecret(overridePin, candidate.password) && await hasPermission(candidate, 'feature:barcode_mismatch_override')) {
      return candidate;
    }
  }
  return null;
}

/**
 * בדיקת התאמה בין הברקוד לפריט ההזמנה, לפני שמשייכים אותו אליו.
 *
 * מחזיר { response, auditNote }. response=null כשמותר להמשיך (ההגדרה כבויה / הברקוד תואם /
 * אין מידע להשוואה / עקיפת מנהל תקפה - ואז auditNote מתאר את העקיפה לרישום ביומן הפריט,
 * בשדה note של changes ב-auditAs; התוסף כותב את השורה ממילא, אין כתיבה ידנית ל-AuditLog).
 * אחרת response הוא NextResponse מוכן להחזרה מהראוט: 409 עם
 *   { barcodeMismatch: true, expected: {prefix,size}, scanned: {prefix,size}, error }
 * (ועם overrideRejected:true כשנשלחה סיסמת עקיפה שאינה של מנהל/מתכנת).
 *
 * @param {object} item פריט הזמנה שנטען עם RENTAL_MATCH_ITEM_SELECT
 * @param {string} barcode
 * @param {{overridePin?: string, overrideEmployeeId?: string, context?: string}} [opts]
 */
export async function checkRentalBarcodeMatch(item, barcode, opts = {}) {
  if (!barcode || !(await isRentalBarcodeMatchEnforced())) return { response: null, auditNote: null };

  const result = checkBarcodeMatchesItem(item, barcode);
  if (result.ok) return { response: null, auditNote: null };

  const { overridePin, overrideEmployeeId, context } = opts;
  const message = describeMismatch(result.expected, result.scanned);

  if (overridePin) {
    const approver = await verifyManagerOverride(overridePin, overrideEmployeeId);
    if (approver) {
      // התראה פנימית לכל המנהלים - כמו בהשכרת רזרבה באישור אחראית משמרת (scan/route.js).
      try {
        const actingId = await getActingEmployeeId();
        const actingEmployee = actingId
          ? await prisma.employee.findUnique({ where: { id: actingId }, select: { firstName: true, lastName: true } })
          : null;
        const actingName = actingEmployee ? `${actingEmployee.firstName || ''} ${actingEmployee.lastName || ''}`.trim() || 'עובד/ת לא ידוע/ה' : 'עובד/ת לא ידוע/ה';
        const approverName = `${approver.firstName || ''} ${approver.lastName || ''}`.trim() || 'מנהל/ת';
        await notifyManagers({
          title: 'הושכרה שמלה שאינה תואמת להזמנה (אישור מנהל)',
          content: `${actingName} השכיר/ה בהזמנה #${item.orderId} את הברקוד ${barcode} למרות אי-התאמה לפריט שהוזמן, באישור ${approverName}. ${message}.${context ? ` (${context})` : ''}`
        });
      } catch (notifyErr) {
        console.error('Failed to notify managers of barcode-mismatch override:', notifyErr);
      }
      return { response: null, auditNote: `אושרה בעקיפת מנהל: ${message}` };
    }
  }

  const response = NextResponse.json({
    error: overridePin
      ? `${message}. סיסמת האישור שגויה או שאינה של מנהל/מתכנת.`
      : `${message}. יש להביא את השמלה הנכונה, או לקבל אישור מנהל.`,
    barcodeMismatch: true,
    ...(overridePin ? { overrideRejected: true } : {}),
    expected: result.expected,
    scanned: result.scanned
  }, { status: 409 });
  return { response, auditNote: null };
}
