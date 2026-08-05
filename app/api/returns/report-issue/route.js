import { NextResponse } from 'next/server';
import prisma, { auditAs } from '../../../lib/prisma';
import { checkAuth } from '@/lib/auth';

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { orderItemId, issueType } = await request.json(); // issueType: 'not-returned' | 'returned-bad'

    if (!orderItemId || !issueType) {
      return NextResponse.json({ error: 'חסרים נתונים' }, { status: 400 });
    }

    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: { include: { customer: true } } }
    });

    if (!item) {
      return NextResponse.json({ error: 'פריט לא נמצא' }, { status: 404 });
    }

    let notePrefix = '';
    const dateStr = new Date().toLocaleDateString('he-IL');
    
    if (issueType === 'not-returned') {
      notePrefix = `[${dateStr}] אוטומטי: שמלה ${item.description || item.barcode} (הזמנה ${item.order?.orderId}) לא הוחזרה.`;
      // Don't change isReturned/returnedOk, it's already not returned. Just add the note.
    } else if (issueType === 'returned-bad') {
      notePrefix = `[${dateStr}] אוטומטי: שמלה ${item.description || item.barcode} (הזמנה ${item.order?.orderId}) חזרה לא תקינה.`;
      
      await prisma.orderItem.update(auditAs(
        'RETURN_CONDITION',
        { where: { id: orderItemId }, data: { returnedOk: false } },
        { returnedOk: { from: item.returnedOk, to: false }, note: 'דווח כחזר לא תקין' }
      ));
    }

    if (item.order?.customerId) {
      const customer = item.order.customer;
      const currentNotes = customer.notes ? customer.notes + '\n' : '';

      // הוספת ההערה נרשמת ביומן דרך auditAs — בלי זה נוצרו שתי שורות בהיסטוריית הלקוח:
      // שורת UPDATE גנרית מהתוסף עם כל טקסט ההערות, ועוד שורה ידנית של ADD_AUTO_NOTE.
      await prisma.customer.update(auditAs(
        'ADD_AUTO_NOTE',
        { where: { id: customer.id }, data: { notes: currentNotes + notePrefix } },
        { note: notePrefix, issueType, orderItemId }
      ));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reporting issue:', error);
    return NextResponse.json({ error: 'שגיאה בדיווח' }, { status: 500 });
  }
}
