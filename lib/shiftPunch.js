// lib/shiftPunch.js - רישום כניסה/יציאה למשמרת (שעון נוכחות), משותף ל-POST /api/attendance (שעון הנוכחות),
// ל-POST /api/login (רישום התחלת עבודה אוטומטי בכניסה, דף הכניסה החדש) ול-POST /api/attendance/previous-shift
// (סגירת משמרת שנשארה פתוחה מיום קודם). החישובים הועתקו אחד-לאחד מ-app/api/attendance/route.js כדי ששלושת
// המסלולים לא יסטו זה מזה. Shift מוחרג מתוסף ה-AuditLog (app/lib/prisma.js), אין כאן רישום ידני.

import prisma from '@/app/lib/prisma';
import { toIsraelCalendarDate } from '@/lib/hebrewDate';
import { findLatestOpenShift } from '@/lib/openShift';

/**
 * המשמרת הפתוחה (exitTime: null) של העובד בכל תאריך - לא רק היום (משמרת שחצתה חצות נשארת פתוחה "מאתמול").
 * כשיש כמה משמרות פתוחות (למשל ישנות מ-Access) - העדכנית לפי שעת כניסה, לא id אקראי (lib/openShift.js, PR #209).
 */
export async function findOpenShift(employeeId) {
  return findLatestOpenShift(prisma, employeeId);
}

/** פתיחת משמרת חדשה. הקורא אחראי לבדוק קודם שאין משמרת פתוחה (findOpenShift). */
export async function punchIn(employee, now = new Date()) {
  // שדה date = חצות UTC של היום הקלנדרי בישראל (אותה צורה כמו משמרת שנוספה ידנית 'YYYY-MM-DD'; now.getDate()
  // בשרת UTC תיארך כניסה בין 00:00 ל-03:00 שעון ישראל ליום הקודם, ו-/api/me מחפש "משמרת היום" באותו יום).
  const todayStart = toIsraelCalendarDate(now);
  return prisma.shift.create({
    data: {
      employeeId: employee.id,
      date: todayStart,
      entryTime: now,
      hourlyWageSnapshot: employee.hourlyWage || 0,
      travelExpensesSnapshot: typeof employee.travelExpenses === 'number' ? employee.travelExpenses : 0,
    },
  });
}

/** סגירת משמרת פתוחה בשעת exitAt (ברירת מחדל: עכשיו) עם חישוב דקות, שכר ונסיעות - כמו ב-/api/attendance. */
export async function punchOut(employee, currentShift, exitAt = new Date()) {
  const entryTime = new Date(currentShift.entryTime);
  const diffMs = exitAt - entryTime;
  const totalMinutes = Math.floor(diffMs / 60000);

  const hourlyWage = currentShift.hourlyWageSnapshot || employee.hourlyWage || 0;
  const travelEligible = currentShift.travelExpensesSnapshot || (typeof employee.travelExpenses === 'number' ? employee.travelExpenses : 0);
  let totalCalculated = (totalMinutes / 60) * hourlyWage;

  // נסיעות הן קצבה יומית, לא לכל רישום: רק המשמרת הראשונה של אותו יום מקבלת אותה.
  let travelForThisShift = 0;
  if (travelEligible) {
    const earlierShiftToday = await prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        date: currentShift.date,
        isDeleted: false,
        id: { not: currentShift.id },
        entryTime: { lt: currentShift.entryTime },
      },
    });
    if (!earlierShiftToday) {
      travelForThisShift = travelEligible;
    }
  }
  totalCalculated += travelForThisShift;

  return prisma.shift.update({
    where: { id: currentShift.id },
    data: {
      exitTime: exitAt,
      totalMinutes,
      totalCalculated: parseFloat(totalCalculated.toFixed(2)),
    },
  });
}
