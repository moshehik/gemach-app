import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import {
  MY_ACTIVITY_LIMITS as L, MY_ENTITY_TYPES, activitySince, collectRefs, attachOrderNumbers, pickCandidates,
  detailOrderNumbers, historyOrderNumbers, composeMyActivity,
} from '@/lib/myRecentActivity';

export const dynamic = 'force-dynamic';

// GET /api/me/recent-activity - "השינויים שלי": ההזמנות החדשות שהעובדת המחוברת יצרה והשינויים שעשתה בהזמנות.
//   -> { created: [{ orderId, orderNumber, customerName, createdAt }],
//        changed: [{ orderId, orderNumber, customerName, lastChangeLabelHe, lastChangeAt }],
//        degraded?: true, anonymous?: true }
// orderId = מזהה ההזמנה לכתובת (/orders/<orderId>); orderNumber = המספר שמוצג. החדש ראשון, הזמנה אחת פעם אחת בכל רשימה,
// עד 20 בכל רשימה. הזמנה שבוטלה או טיוטה לא מופיעה.
//
// פרטיות: רק הפעולות של העובדת המחוברת עצמה (employeeId נלקח מהעוגייה המאומתת, לא מהבקשה). ?employeeId=<אחרת> = 403
// (צפייה ברשימה של עובדת אחרת, גם להנהלה, טרם הוחלט - ר' NOTES). הנתיב קריאה בלבד: לא כותב ל-AuditLog ולא לשום טבלה.
// הרשאה: אותה כמו דפי ההזמנות (page:orders). ההפרדה בין שני הגמ"חים היא ה-DB עצמו (כל גמ"ח בסיס נתונים נפרד).
// ביצועים: חמש סבבי שאילתות ממוקדים ובלי N+1 (יומן של העובדת -> שיוך להזמנות -> פרטי הזמנות -> פריטים/תשלומים -> יומן ההזמנות),
// כולן עם take, בלי $transaction. חלון: 60 ימי-לוח ישראליים (אין אינדקס על employeeId+createdAt, והחלון הוא התקרה).
// כשל ב-DB: 200 עם רשימות ריקות ו-degraded:true (התצוגה מראה "לא הצלחנו לטעון" ולא שגיאה).

const json = (body, status = 200) => NextResponse.json(body, { status });
const EMPTY = { created: [], changed: [] };

export async function GET(request) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  if (!(await canOpenPage('page:orders'))) return json({ error: 'Forbidden' }, 403);
  const me = await getActingEmployeeId();
  if (!me) return json({ ...EMPTY, anonymous: true }); // מצב פתוח (בלי התחברות): אין "אני"
  const asked = new URL(request.url).searchParams.get('employeeId');
  if (asked && asked !== me) return json({ error: 'Forbidden' }, 403);

  try {
    const since = activitySince(new Date());
    const select = { id: true, entityType: true, entityId: true, action: true, createdAt: true };
    const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];

    // סבב 1: מה העובדת כתבה ביומן (שלוש שאילתות במקביל: יצירות של הזמנות, שאר הפעולות, ויצירות של פריט / תשלום -
    // CREATE של פריט / תשלום בהזמנה שלא נוצרה עכשיו הוא שינוי ("נוסף פריט"), לכן נקרא בנפרד, באותה תקרה)
    const [createRows, changeRows, addRows] = await Promise.all([
      prisma.auditLog.findMany({ where: { employeeId: me, entityType: 'Order', action: 'CREATE', createdAt: { gte: since } }, orderBy, take: L.createAuditRows, select }),
      prisma.auditLog.findMany({ where: { employeeId: me, entityType: { in: [...MY_ENTITY_TYPES] }, action: { not: 'CREATE' }, createdAt: { gte: since } }, orderBy, take: L.changeAuditRows, select }),
      prisma.auditLog.findMany({ where: { employeeId: me, entityType: { in: ['OrderItem', 'Payment'] }, action: 'CREATE', createdAt: { gte: since } }, orderBy, take: L.changeAuditRows, select }),
    ]);
    const mine = [...createRows, ...changeRows, ...addRows];
    if (!mine.length) return json(EMPTY);

    // סבב 2: שיוך כל שורה להזמנה (מזהה uuid / מזהה פריט / מזהה תשלום -> מספר הזמנה)
    const refs = collectRefs(mine);
    const [byUuid, items, pays] = await Promise.all([
      refs.orderUuids.length ? prisma.order.findMany({ where: { id: { in: refs.orderUuids } }, select: { id: true, orderId: true }, take: refs.orderUuids.length }) : [],
      refs.itemIds.length ? prisma.orderItem.findMany({ where: { id: { in: refs.itemIds } }, select: { id: true, orderId: true }, take: refs.itemIds.length }) : [],
      refs.paymentIds.length ? prisma.payment.findMany({ where: { id: { in: refs.paymentIds } }, select: { id: true, orderId: true }, take: refs.paymentIds.length }) : [],
    ]);
    const lookups = {
      uuidToNumber: new Map(byUuid.map((o) => [o.id, o.orderId])),
      itemToOrder: new Map(items.filter((i) => i.orderId != null).map((i) => [i.id, i.orderId])),
      paymentToOrder: new Map(pays.filter((p) => p.orderId != null).map((p) => [p.id, p.orderId])),
    };
    const candidates = pickCandidates(attachOrderNumbers(mine, lookups));
    const detailNums = detailOrderNumbers(candidates);
    if (!detailNums.length) return json(EMPTY);

    // סבב 3: פרטי ההזמנות (שם לקוחה, בוטלה, טיוטה)
    const orders = await prisma.order.findMany({
      where: { orderId: { in: detailNums } },
      select: { id: true, orderId: true, orderDate: true, status: true, isDeleted: true, customer: { select: { firstName: true, lastName: true } } },
      take: detailNums.length,
    });
    const ordersByNumber = new Map(orders.map((o) => [o.orderId, { ...o, orderNumber: o.orderId }]));

    // סבב 4: פריטים ותשלומים של ההזמנות שהשתנו (למיפוי הנוסח: שם הדגם, סוג התשלום)
    const histNums = historyOrderNumbers(candidates).filter((n) => { const o = ordersByNumber.get(n); return o && !o.isDeleted && o.status !== 'טיוטה'; });
    const historyByNumber = new Map();
    if (histNums.length) {
      const [itemRows, payRows] = await Promise.all([
        prisma.orderItem.findMany({
          where: { orderId: { in: histNums } },
          select: { id: true, orderId: true, sizeText: true, description: true, barcodePrefix: true, isDeleted: true, isTaken: true, takenDate: true, isReturned: true, returnDate: true, returnedOk: true, dressItem: { select: { barcodePrefix: true, dress: { select: { name: true, barcodePrefix: true } } } } },
          take: L.itemRows,
        }),
        prisma.payment.findMany({
          where: { orderId: { in: histNums } },
          select: { id: true, orderId: true, amount: true, paymentMethod: true, notes: true, paymentDate: true, isDeleted: true, isRefund: true },
          take: L.paymentRows,
        }),
      ]);
      const itemsBy = new Map(); const paysBy = new Map();
      for (const r of itemRows) {
        const it = { id: r.id, sizeText: r.sizeText, description: r.description, prefix: r.dressItem?.dress?.barcodePrefix ?? r.dressItem?.barcodePrefix ?? r.barcodePrefix ?? null, modelName: r.dressItem?.dress?.name || null, isDeleted: r.isDeleted, isTaken: r.isTaken, takenDate: r.takenDate, isReturned: r.isReturned, returnDate: r.returnDate, returnedOk: r.returnedOk };
        (itemsBy.get(r.orderId) || itemsBy.set(r.orderId, []).get(r.orderId)).push(it);
      }
      for (const p of payRows) (paysBy.get(p.orderId) || paysBy.set(p.orderId, []).get(p.orderId)).push(p);

      // סבב 5: יומן של כל ההזמנות האלה בשאילתה אחת (כל כותבי השורות - המיפוי צריך את הערכים הקודמים כבסיס השוואה)
      const or = [{ entityType: 'Order', entityId: { in: [...histNums.map(String), ...histNums.map((n) => ordersByNumber.get(n).id)] } }];
      const itemIds = itemRows.map((r) => r.id); const payIds = payRows.map((p) => p.id);
      if (itemIds.length) or.push({ entityType: 'OrderItem', entityId: { in: itemIds } });
      if (payIds.length) or.push({ entityType: 'Payment', entityId: { in: payIds } });
      const audit = await prisma.auditLog.findMany({
        where: { OR: or },
        orderBy,
        take: L.historyAuditRows,
        select: { id: true, entityType: true, entityId: true, action: true, changesJson: true, createdAt: true, employeeId: true },
      });
      const numOfUuid = new Map(histNums.map((n) => [ordersByNumber.get(n).id, n]));
      const numOfItem = new Map(itemRows.map((r) => [r.id, r.orderId])); const numOfPay = new Map(payRows.map((p) => [p.id, p.orderId]));
      const auditBy = new Map();
      for (const a of audit) {
        const n = a.entityType === 'Order' ? (numOfUuid.get(a.entityId) ?? Number(a.entityId)) : a.entityType === 'OrderItem' ? numOfItem.get(a.entityId) : numOfPay.get(a.entityId);
        if (!Number.isFinite(n)) continue;
        (auditBy.get(n) || auditBy.set(n, []).get(n)).push(a);
      }
      for (const n of histNums) historyByNumber.set(n, { auditRows: auditBy.get(n) || [], items: itemsBy.get(n) || [], payments: paysBy.get(n) || [] });
    }

    return json(composeMyActivity({ candidates, ordersByNumber, historyByNumber, me }));
  } catch (error) {
    console.error('recent-activity error:', error);
    return json({ ...EMPTY, degraded: true });
  }
}
