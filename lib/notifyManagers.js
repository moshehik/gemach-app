import prisma from '@/app/lib/prisma';

// "מנהלי הגמ"ח" - אותה קבוצת roleId שכבר משמשת בקוד הקיים ל"מנהל סניף ומעלה"
// (app/api/auth/verify-pin/route.js: isBranchManagerOrAbove) - הנהלה ראשית (0),
// מנהל סניף (1) ומתכנת (2). ר' lib/auth.js ROLE_LEVELS/HEAD_MANAGEMENT_ROLES.
const MANAGER_ROLE_IDS = [0, 1, 2];

/**
 * שולח הודעה פנימית (Notification) אישית לכל עובד/ת פעיל/ה ברמת מנהל ומעלה -
 * לא שידור-לכולם (כמו קטגוריות shift_handover/management ב-app/api/notifications/route.js),
 * אלא שורת Notification נפרדת per-recipient לכל מנהל, כדי שההתראה תופיע רק אצלם.
 *
 * משמש להתראות תפעוליות שמנהלים צריכים לראות אך לא כלל הצוות - למשל השכרת פריט
 * רזרבה באישור לא-מנהל (allow_shift_lead_reserve_rental) או ברקוד שהוקלד ידנית.
 * נכשל בשקט (לא זורק) - זו התראה משנית, לא אמורה לחסום את פעולת ההשכרה עצמה.
 */
export async function notifyManagers({ title, content }) {
  try {
    const managers = await prisma.employee.findMany({
      where: { isActive: true, roleId: { in: MANAGER_ROLE_IDS } },
      select: { id: true }
    });
    for (const manager of managers) {
      try {
        await prisma.notification.create({
          data: { receiverId: manager.id, title, content }
        });
      } catch (e) {
        console.error('notifyManagers: failed to notify', manager.id, e);
      }
    }
  } catch (e) {
    console.error('notifyManagers failed:', e);
  }
}
