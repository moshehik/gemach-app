import { NextResponse } from 'next/server';
import prisma, { auditAs, getActingEmployeeId } from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';
import { checkRentalBarcodeMatch, RENTAL_MATCH_ITEM_SELECT } from '@/lib/rentalBarcodeGuard';
import { checkEarlyReturn } from '@/lib/earlyReturnGuard';
import { autoMarkPrepForOrder } from '@/lib/schedule/autoPrepMark';
import { autoMarkAlterationForItem, isAutoAlterationEnabled } from '@/lib/schedule/autoAlterationDone';
import { runAfterResponse } from '@/lib/schedule/afterResponse';
import { isAlterationEstimated, stripEstimateMarker } from '@/lib/alterationEstimate';

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
  // העובד נקרא לפני כל await (העוגייה זמינה רק בהקשר הבקשה; העבודה שאחרי התשובה רצה ב-after() שבו cookies() אסור) - lib/schedule/afterResponse.js
  const actorPromise = getActingEmployeeId();
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { itemId, action, barcode, returnedOk, overridePin, overrideEmployeeId } = await request.json();

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
      select: {
        isTaken: true, takenDate: true, isReturned: true, returnedOk: true, returnDate: true, barcode: true,
        alterationDone: true, alterationDetails: true,
        ...RENTAL_MATCH_ITEM_SELECT,
        order: { select: { orderId: true, eventDate: true } }
      }
    });
    if (!before) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    if (action === 'return' && before.order) {
      const guard = await checkEarlyReturn(before.order, { overridePin, overrideEmployeeId });
      if (guard.response) return guard.response;
    }

    // enforce_rental_barcode_match (ברירת מחדל כבוי = התנהגות ישנה): ברקוד שמשייכים בהשכרה
    // חייב להתאים לדגם/מידה שהוזמנו, אחרת 409 - אלא אם מנהל אישר עקיפה (מאומת בשרת בלבד).
    // ההשכרה נשלחת מהמודל "הזנת ברקוד ידנית" ומסריקת הסיידבר, ושם אין בדיקה אחרת מול ההזמנה.
    let overrideNote = null;
    if (action === 'rent' && barcode) {
      const guard = await checkRentalBarcodeMatch(before, barcode, { overridePin, overrideEmployeeId });
      if (guard.response) return guard.response;
      overrideNote = guard.auditNote;
    }

    // ביטול השכרה של פריט שהתיקון שלו נרשם אוטומטית ("בוצע (משוער)") - הרישום המשוער מתבטל איתו; סימון של אדם (בלי הסמן) לא נוגעים בו
    const revertsEstimate = action === 'undoRent' && isAlterationEstimated(before);
    if (revertsEstimate) {
      updateData.alterationDone = false;
      updateData.alterationDetails = stripEstimateMarker(before.alterationDetails);
    }

    const changes = {};
    for (const [field, to] of Object.entries(updateData)) {
      changes[field] = { from: before[field] ?? null, to: to ?? null };
    }
    if (revertsEstimate) changes.estimated = { from: true, to: false };
    if (overrideNote) changes.note = overrideNote;

    const updatedItem = await prisma.orderItem.update(auditAs(
      AUDIT_ACTIONS[action],
      { where: { id: String(itemId) }, data: updateData },
      changes
    ));

    // אחרי הכתיבה, מחוץ לכל טרנזקציה, במקביל ובלי להאט את התשובה (after() של Next; מחוץ להקשר בקשה - ריצה מקומית מוגבלת בזמן; נכשל בשקט תמיד):
    //  - לקיחה (או החזרה - אז בוודאי נלקח): נרשמת הכנה אוטומטית אם עוד לא סומנה (lib/schedule/autoPrepMark.js)
    //  - לקיחה בלבד (לא החזרה): תיקון שלא סומן נרשם "בוצע (משוער)" - lib/schedule/autoAlterationDone.js (רק כשauto_alteration_done_on_take === 'true')
    const actorId = await actorPromise;
    const afterTasks = [];
    if ((action === 'rent' || action === 'return') && before.order) afterTasks.push(() => autoMarkPrepForOrder(before.order.orderId, { userId: actorId }));
    if (action === 'rent') afterTasks.push(() => autoMarkAlterationForItem(itemId));
    // הגדרה כבויה (ברירת מחדל) = בדיוק ההתנהגות הקודמת: ההכנה נרשמת לפני התשובה (מוגבל 1.5ש'); רק כשהתכונה דולקת - אחרי התשובה
    const altOn = await isAutoAlterationEnabled();
    await runAfterResponse(afterTasks, { actorId, ...(altOn ? {} : { afterFn: null }) });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error toggling rental:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון הסטטוס' }, { status: 500 });
  }
}
