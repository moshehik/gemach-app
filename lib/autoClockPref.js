// lib/autoClockPref.js - ההעדפה "רשום לי התחלת עבודה אוטומטית בכניסה" של כל עובד (דף הכניסה החדש, L14/Q01).
// נשמרת בהעדפות הקיימות של העובד (Employee.themeColor, JSON) דרך lib/loginFlow.js - בלי שינוי סכמה.
// הקוראים: POST /api/login (שמירה כשהעובד שינה את המתג בכניסה, וקריאה להחלטה אם לרשום),
// GET/PUT /api/me/auto-clock-in (המתג בתפריט "הפרופיל שלי" ובדף הפרופיל).
// אין רישום AuditLog ידני - התוסף של Prisma מתעד את העדכון.

import prisma from '@/app/lib/prisma';
import { autoClockInFromRaw, withAutoClockIn } from '@/lib/loginFlow';

export function getAutoClockIn(employee) {
  return autoClockInFromRaw(employee && employee.themeColor);
}

/** שומר את ההעדפה ומחזיר את הערך השמור. employee חייב לכלול id ו-themeColor. */
export async function setAutoClockIn(employee, enabled) {
  const next = withAutoClockIn(employee.themeColor, enabled);
  if (next.length > 8192) throw new Error('Prefs too large');
  await prisma.employee.update({
    where: { id: employee.id },
    data: { themeColor: next },
    select: { id: true },
  });
  return !!enabled;
}
