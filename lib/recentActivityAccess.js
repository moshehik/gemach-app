// lib/recentActivityAccess.js - "השינויים שלי": מי רשאית לראות את הרשימות של עובדת אחרת (החלטת הבעלים MY-04, אפשרות ב).
// ההכרעה בשרת בלבד, מהעוגייה החתומה (getSessionEmployee) - לא ממה שהלקוח שולח. ההרשאה היא feature:view_others_recent_activity
// (lib/permissionsMetadata.js): ברירת מחדל הנהלה ראשית, מנהלות סניף ומתכנת (roleId 0/1/2; החלטת הבעלים MY-06 אפשרות ב), כל מחלקה / עובדת אחרת רק אם ניתנה לה שורת הרשאה.
import prisma from '@/app/lib/prisma';
import { getSessionEmployee } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { SERVICE_EMPLOYEE_LEGACY_ID_MIN } from '@/lib/apiKeys';

export const VIEW_OTHERS_KEY = 'feature:view_others_recent_activity';

/** האם העובדת המחוברת (העוגייה החתומה; חייבת להיות אותה זהות כמו meId) רשאית לראות רשימות של אחרות. כשל = false (סגור). */
export async function canViewOthersActivity(meId) {
  try {
    const actor = await getSessionEmployee();
    if (!actor || !meId || actor.id !== meId) return false;
    return await hasPermission(actor, VIEW_OTHERS_KEY);
  } catch {
    return false;
  }
}

/** עובדת פעילה שאפשר לצפות ברשימות שלה (לא עובד שירות / מפתח API). */
export const isViewableEmployee = (e) => !!e && e.isActive === true && !(Number.isFinite(e.legacyId) && e.legacyId >= SERVICE_EMPLOYEE_LEGACY_ID_MIN);

/** שם לתצוגה בבורר: שם מלא, אחרת שם פרטי + משפחה. בלי שום שדה אחר של העובדת. */
export const employeeChipName = (e) => String(e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || '').trim();
