import prisma from '@/app/lib/prisma';
import { verifySecret } from './passwordAuth';

// שרת-צד לבדיקת קוד/סיסמת מנהל, בנוסף לאימות ה-PIN שכבר קורה בצד הלקוח דרך
// window.customAuthPrompt + POST /api/auth/verify-pin (app/api/auth/verify-pin/route.js).
// לא סומכים על "success: true" שהתקבל בלקוח בלבד - קריאת API ישירה (בלי דרך המסך)
// הייתה עוקפת את זה - ולכן כל ראוט שדורש אישור מנהל אמיתי (require_manager_code_for_item_changes)
// מריץ את אותה בדיקה שוב כאן, מול ה-DB. אותו היגיון בדיוק כמו ב-verify-pin/route.js
// (roleId 1 = מנהל, roleId 2 = מתכנת - שניהם עוברים רמת 'מנהל').
export async function verifyManagerPin(employeeId, pin) {
  if (!pin) return false;
  const whereClause = { isActive: true };
  if (employeeId) whereClause.id = employeeId;
  const candidates = await prisma.employee.findMany({ where: whereClause });
  for (const candidate of candidates) {
    if (await verifySecret(pin, candidate.password)) {
      return candidate.roleId === 1 || candidate.roleId === 2;
    }
  }
  return false;
}
