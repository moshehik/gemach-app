import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * רישום "ביטול שינויים" בכרטיס ההזמנה.
 *
 * הביטול עצמו מתבצע בצד הלקוח בלבד (הכרטיס חוזר לצילום המצב האחרון שנשמר), ולכן עד כה
 * לא נשאר ממנו שום זכר: לא בוצעה כתיבה ל-DB, וממילא לא נוצרה שורת יומן. הראוט הזה רושם
 * את הפעולה בהיסטוריית ההזמנה עם פירוט מה בוטל, בלי לגעת בהזמנה עצמה — כך גם updatedAt
 * לא זז ולא נוצרת התנגשות נתונים בשמירה הבאה.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { changes } = await request.json().catch(() => ({}));

    let orderId = null;
    if (String(id).includes('-')) {
      const order = await prisma.order.findUnique({ where: { id }, select: { orderId: true } });
      orderId = order?.orderId ?? null;
    } else {
      const parsed = parseInt(id);
      if (!isNaN(parsed)) {
        const order = await prisma.order.findUnique({ where: { orderId: parsed }, select: { orderId: true } });
        orderId = order?.orderId ?? null;
      }
    }

    if (!orderId) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    const discarded = Array.isArray(changes) ? changes.filter(Boolean).map(String) : [];

    // הביטול מתבצע כולו בצד הלקוח ואין כאן שום כתיבה למודל אחר,
    // ולכן זו שורת ההיסטוריה היחידה של הפעולה ולא כפילות.
    // eslint-disable-next-line no-restricted-syntax -- אין כתיבה מקבילה שתייצר שורה אוטומטית
    await prisma.auditLog.create({
      data: {
        entityType: 'Order',
        entityId: String(orderId),
        action: 'CANCEL_CHANGES',
        changesJson: JSON.stringify({
          note: 'ביטול שינויים שלא נשמרו — הכרטיס הוחזר למצב האחרון שנשמר',
          discarded: discarded.length > 0 ? discarded.join(', ') : 'שינויים שלא נשמרו'
        }),
        employeeId: await getActingEmployeeId()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging cancelled changes:', error);
    return NextResponse.json({ error: 'שגיאה ברישום ביטול השינויים' }, { status: 500 });
  }
}
