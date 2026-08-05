import { NextResponse } from 'next/server';
import prisma, { auditAs } from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';

// כל פעולה כאן נרשמת ביומן בשם ברור (ולא כ"עדכון" גנרי), כדי שבהיסטוריית הפריט
// אפשר יהיה לראות במפורש מתי בוצעה השכרה, החזרה, ביטול השכרה או ביטול החזרה.
const AUDIT_ACTIONS = {
  rent: 'CONFIRM_RENTAL',
  return: 'RETURN_RENTAL',
  undoRent: 'CANCEL_RENTAL',
  undoReturn: 'CANCEL_RETURN',
  setReturnCondition: 'RETURN_CONDITION'
};

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { itemId, action, barcode, returnedOk } = await request.json();

    if (!itemId || !action) {
      return NextResponse.json({ error: 'חסרים נתונים' }, { status: 400 });
    }

    let updateData = {};
    if (action === 'rent') {
      updateData = { isTaken: true, takenDate: new Date() };
      if (barcode) updateData.barcode = barcode;
    } else if (action === 'return') {
      // ברירת המחדל של returnedOk בסכימה היא false — בלי לסמן אותו כאן החזרה רגילה
      // הייתה נרשמת כ"הוחזר - לא תקין" (כמו ב-/api/returns/scan שמסמן true).
      updateData = { isReturned: true, returnedOk: returnedOk !== false, returnDate: new Date() };
    } else if (action === 'undoRent') {
      updateData = { isTaken: false, takenDate: null };
    } else if (action === 'undoReturn') {
      updateData = { isReturned: false, returnedOk: false, returnDate: null };
    } else if (action === 'setReturnCondition') {
      // שינוי מצב פריט שכבר הוחזר: תקין / לא תקין
      updateData = { returnedOk: returnedOk === true };
    } else {
      return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 });
    }

    // המצב לפני העדכון נשמר כדי שרשומת ההיסטוריה תציג "מ-X ל-Y" ולא רק את הערך החדש
    const before = await prisma.orderItem.findUnique({
      where: { id: String(itemId) },
      select: { isTaken: true, takenDate: true, isReturned: true, returnedOk: true, returnDate: true, barcode: true }
    });
    if (!before) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    const changes = {};
    for (const [field, to] of Object.entries(updateData)) {
      changes[field] = { from: before[field] ?? null, to: to ?? null };
    }

    const updatedItem = await prisma.orderItem.update(auditAs(
      AUDIT_ACTIONS[action],
      { where: { id: String(itemId) }, data: updateData },
      changes
    ));

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error toggling rental:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון הסטטוס' }, { status: 500 });
  }
}
