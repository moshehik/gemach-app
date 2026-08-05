import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { computeShiftTotals } from '@/lib/shiftCalc';

export async function POST(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;

    if (!employeeId) {
      return NextResponse.json({ error: 'Invalid Employee ID' }, { status: 400 });
    }

    const body = await request.json();

    const entryTime = body.entryTime ? new Date(body.entryTime) : null;
    const exitTime = body.exitTime ? new Date(body.exitTime) : null;
    const shiftDate = body.date ? new Date(body.date) : new Date();

    // לא לאפשר הוספת משמרת בתאריך שאינו בחודש המוצג כרגע במסך - שיבוץ בטעות
    // לחודש אחר לא יבחין בזה המשתמש עד שהוא כבר לא רואה את המשמרת ברשימה.
    // displayedMonth מגיע 0-אינדקס (כמו Date.getMonth), בהתאמה לצד הלקוח.
    if (body.displayedMonth !== undefined && body.displayedMonth !== null && body.displayedYear) {
      const displayedMonth = parseInt(body.displayedMonth, 10);
      const displayedYear = parseInt(body.displayedYear, 10);
      if (!isNaN(displayedMonth) && !isNaN(displayedYear) &&
          (shiftDate.getMonth() !== displayedMonth || shiftDate.getFullYear() !== displayedYear)) {
        return NextResponse.json({
          error: `לא ניתן להוסיף משמרת בתאריך שאינו בחודש המוצג (${new Date(displayedYear, displayedMonth).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}). יש לבחור תאריך בחודש המוצג, או לעבור לחודש הרצוי לפני ההוספה.`
        }, { status: 400 });
      }
    }

    // Validation for overlapping shifts
    if (entryTime && exitTime) {
      const overlappingShifts = await prisma.shift.findMany({
        where: {
          employeeId: employeeId,
          isDeleted: false,
          OR: [
            {
              entryTime: { lt: exitTime },
              exitTime: { gt: entryTime }
            },
            // An existing shift with no exit time yet (still punched in) that started
            // before the new shift's exit time is also an overlap - exitTime: {gt: ...}
            // above never matches NULL, so an open shift would otherwise slip through.
            {
              exitTime: null,
              entryTime: { lt: exitTime }
            }
          ]
        }
      });
      if (overlappingShifts.length > 0) {
        return NextResponse.json({ error: 'שגיאה: העובד כבר רשום למשמרת בשעות אלו' }, { status: 400 });
      }
    }

    // סה"כ דקות/תשלום מחושבים תמיד בשרת (ולא לפי מה שהלקוח שלח) - השדות מוצגים
    // בטופס כ"מחושב אוטומטית" ומנוטרלים, כך שאין טעם לסמוך על ערך שהגיע מהלקוח.
    const { totalMinutes, totalCalculated, hourlyWageSnapshot, travelExpensesSnapshot } = await computeShiftTotals({
      employeeId, entryTime, exitTime, shiftDate
    });

    const newShift = await prisma.shift.create({
      data: {
        employeeId,
        date: shiftDate,
        hebrewDate: body.hebrewDate || null,
        entryTime: entryTime,
        exitTime: exitTime,
        totalMinutes,
        totalCalculated,
        hourlyWageSnapshot,
        travelExpensesSnapshot,
        notes: body.notes || null,
        isDeleted: false
      }
    });

    // Create Audit Log - באותה צורה שהתוסף האוטומטי של פריזמה כותב יצירה (אובייקט
    // שטוח, לא עטוף תחת "to"), כדי שההיסטוריה תוצג נכון בפאנל (ChangesChips מצפה
    // למפתחות שהם שמות שדות, לא ל"from"/"to" ברמה העליונה).
    // eslint-disable-next-line no-restricted-syntax -- Shift מוחרג מתוסף היומן, ולכן אין שורה אוטומטית
    await prisma.auditLog.create({
      data: {
        entityType: 'Shift',
        entityId: newShift.id,
        action: 'CREATE',
        changesJson: JSON.stringify(newShift),
        employeeId: employeeId
      }
    });

    return NextResponse.json(newShift);
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
