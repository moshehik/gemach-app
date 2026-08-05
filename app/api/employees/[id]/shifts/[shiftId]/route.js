import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { computeShiftTotals } from '@/lib/shiftCalc';

export async function PUT(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;
    const shiftId = resolvedParams.shiftId;

    if (!employeeId || !shiftId) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    const body = await request.json();

    const oldShift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!oldShift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const entryTime = body.entryTime !== undefined ? (body.entryTime ? new Date(body.entryTime) : null) : oldShift.entryTime;
    const exitTime = body.exitTime !== undefined ? (body.exitTime ? new Date(body.exitTime) : null) : oldShift.exitTime;

    // Check for overlap if entryTime or exitTime is being updated
    if (entryTime && exitTime) {
      const overlappingShifts = await prisma.shift.findMany({
        where: {
          employeeId: employeeId,
          id: { not: shiftId },
          isDeleted: false,
          OR: [
            {
              entryTime: { lt: exitTime },
              exitTime: { gt: entryTime }
            }
          ]
        }
      });
      if (overlappingShifts.length > 0) {
        return NextResponse.json({ error: 'שגיאה: קיימת משמרת חופפת בזמנים אלו' }, { status: 400 });
      }
    }

    // סה"כ דקות/תשלום מחושבים תמיד מחדש בשרת על בסיס הכניסה/יציאה הסופיות -
    // לעולם לא לפי מה שהלקוח שלח (השדות מנוטרלים בטופס העריכה, ולעיתים הגיעו
    // כמחרוזת ריקה '' שגרמה לפריזמה לזרוק שגיאת ולידציה על עמודת Int/Float,
    // וזו הסיבה ש"שמירת עריכה" נכשלה עם שגיאה).
    const shiftDate = body.date ? new Date(body.date) : oldShift.date;
    const { totalMinutes, totalCalculated, hourlyWageSnapshot, travelExpensesSnapshot } = await computeShiftTotals({
      employeeId, entryTime, exitTime, shiftDate, excludeShiftId: shiftId
    });

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        date: body.date ? shiftDate : undefined,
        hebrewDate: body.hebrewDate !== undefined ? body.hebrewDate : undefined,
        entryTime: entryTime,
        exitTime: exitTime,
        totalMinutes,
        totalCalculated,
        hourlyWageSnapshot,
        travelExpensesSnapshot,
        notes: body.notes !== undefined ? body.notes : undefined,
        isDeleted: body.isDeleted !== undefined ? body.isDeleted : undefined
      }
    });

    // היסטוריה בפורמט "לפני/אחרי" לכל שדה בנפרד (כמו בשאר המערכת), במקום שתי
    // תמונות מצב מלאות תחת from/to - כדי שפאנל ההיסטוריה יציג שינויים קריאים.
    const changes = {};
    const FIELDS_TO_DIFF = ['date', 'hebrewDate', 'entryTime', 'exitTime', 'totalMinutes', 'totalCalculated', 'hourlyWageSnapshot', 'travelExpensesSnapshot', 'notes', 'isDeleted'];
    FIELDS_TO_DIFF.forEach(key => {
      const fromVal = oldShift[key];
      const toVal = updatedShift[key];
      const fromStr = fromVal instanceof Date ? fromVal.toISOString() : fromVal;
      const toStr = toVal instanceof Date ? toVal.toISOString() : toVal;
      if (fromStr !== toStr) {
        changes[key] = { from: fromVal, to: toVal };
      }
    });

    if (Object.keys(changes).length > 0) {
      // eslint-disable-next-line no-restricted-syntax -- Shift מוחרג מתוסף היומן, ולכן אין שורה אוטומטית
      await prisma.auditLog.create({
        data: {
          entityType: 'Shift',
          entityId: shiftId,
          action: 'UPDATE',
          changesJson: JSON.stringify(changes),
          employeeId: employeeId
        }
      });
    }

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const resolvedParams = await params;
    const employeeId = resolvedParams.id;
    const shiftId = resolvedParams.shiftId;

    if (!employeeId || !shiftId) {
      return NextResponse.json({ error: 'Invalid ID parameters' }, { status: 400 });
    }

    const oldShift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!oldShift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Soft delete
    const deletedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: { isDeleted: true }
    });

    // eslint-disable-next-line no-restricted-syntax -- Shift מוחרג מתוסף היומן, ולכן אין שורה אוטומטית
    await prisma.auditLog.create({
      data: {
        entityType: 'Shift',
        entityId: shiftId,
        action: 'DELETE',
        changesJson: JSON.stringify({ isDeleted: { from: oldShift?.isDeleted ?? false, to: true } }),
        employeeId: employeeId
      }
    });

    return NextResponse.json({ success: true, id: deletedShift.id });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
