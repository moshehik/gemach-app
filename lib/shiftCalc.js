import prisma from '@/app/lib/prisma';

/**
 * מחשב את סה"כ הדקות ואת הסכום לתשלום עבור משמרת, מתוך שעת כניסה/יציאה ושכר
 * השעה של העובד. עד לתיקון הזה הראוטים של הוספה/עריכת משמרת שמרו ישירות את מה
 * שהלקוח שלח (השדות מוצגים כ"מחושב אוטומטית" ומנוטרלים בטופס, ולכן תמיד הגיע
 * ריק) - וכך משמרות עם כניסה+יציאה תקינות המשיכו להציג "---" בדקות ובתשלום.
 * החישוב עצמו הועתק מ"שעון הנוכחות" עצמו (POST /api/attendance) כדי שתהיה שיטת
 * חישוב אחת לכל הדרכים שבהן משמרת נוצרת/נערכת.
 *
 * שדה "נסיעות" על העובד (Employee.travelExpenses) הוא דגל זכאות בוליאני בלבד -
 * אין במערכת סכום נסיעות קבוע לשמור אותו ב-Shift.travelExpensesSnapshot (עמודת
 * Float). לכן, כדי לא לכתוב בוליאן לעמודת מספר (מה שנכשל בפריזמה), נוסף לתשלום
 * רק אם השדה הוא בפועל מספר; אחרת נשמר 0 בלי להשפיע על הסכום.
 *
 * @param {object} params
 * @param {string} params.employeeId
 * @param {Date|null} params.entryTime
 * @param {Date|null} params.exitTime
 * @param {Date} params.shiftDate - התאריך (ללא שעה) של המשמרת, לבדיקת "כבר שולמו נסיעות היום"
 * @param {string} [params.excludeShiftId] - משמרת לדלג עליה בבדיקת הנסיעות (עריכה של המשמרת עצמה)
 * @returns {Promise<{totalMinutes:number|null, totalCalculated:number|null, hourlyWageSnapshot:number|null, travelExpensesSnapshot:number|null}>}
 */
export async function computeShiftTotals({ employeeId, entryTime, exitTime, shiftDate, excludeShiftId }) {
  if (!entryTime || !exitTime) {
    // משמרת חלקית (חסרה כניסה או יציאה) - אין מה לחשב עדיין
    return { totalMinutes: null, totalCalculated: null, hourlyWageSnapshot: null, travelExpensesSnapshot: null };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  const diffMs = new Date(exitTime).getTime() - new Date(entryTime).getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const hourlyWageSnapshot = employee?.hourlyWage || 0;

  // נסיעות משולמות פעם אחת ביום (לא לכל משמרת בנפרד) - בודקים אם למשמרת אחרת
  // של אותו עובד באותו יום כבר יש נסיעות משויכות.
  let travelForThisShift = 0;
  const travelAmount = typeof employee?.travelExpenses === 'number' ? employee.travelExpenses : 0;
  if (travelAmount > 0) {
    const day = new Date(shiftDate);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const otherShiftWithTravelToday = await prisma.shift.findFirst({
      where: {
        employeeId,
        date: { gte: dayStart, lte: dayEnd },
        isDeleted: false,
        travelExpensesSnapshot: { gt: 0 },
        ...(excludeShiftId ? { id: { not: excludeShiftId } } : {})
      }
    });
    if (!otherShiftWithTravelToday) travelForThisShift = travelAmount;
  }

  const totalCalculated = parseFloat((((totalMinutes / 60) * hourlyWageSnapshot) + travelForThisShift).toFixed(2));

  return {
    totalMinutes,
    totalCalculated,
    hourlyWageSnapshot,
    travelExpensesSnapshot: travelForThisShift
  };
}
