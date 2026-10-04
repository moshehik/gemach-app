import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { canViewOthersActivity, isViewableEmployee } from '@/lib/recentActivityAccess';
import {
  MY_ACTIVITY_LIMITS as L, MY_ENTITY_TYPES, activitySince, collectRefs, attachOrderNumbers, mergeAuditRows, pickCandidates,
  detailOrderNumbers, historyOrderNumbers, composeMyActivity,
} from '@/lib/myRecentActivity';

export const dynamic = 'force-dynamic';

// GET /api/me/recent-activity - "השינויים שלי": ההזמנות החדשות שהעובדת המחוברת יצרה והשינויים שעשתה בהזמנות.
//   -> { created: [{ id, orderNumber, customerName, createdAt }],
//        changed: [{ id, orderNumber, customerName, lastChangeLabelHe, lastChangeAt }],
//        degraded?: true, anonymous?: true }
// id = מזהה ה-uuid של ההזמנה; orderNumber = המספר שמוצג והוא גם הכתובת (/orders/<orderNumber>, כמו שאר האפליקציה).
// החדש ראשון, הזמנה אחת פעם אחת בכל רשימה, עד 20 בכל רשימה. הזמנה שבוטלה או טיוטה לא מופיעה.
// createdAt של הזמנה שנוצרה דרך טיוטה = רגע השמירה הסופית (לא תחילת הטיוטה), ור' lib/myRecentActivity.js pickCandidates.
//
// פרטיות: ברירת המחדל = הפעולות של העובדת המחוברת עצמה (employeeId נלקח מהעוגייה המאומתת, לא מהבקשה).
// ?employeeId=<אחרת> (MY-04 ב): רק עם feature:view_others_recent_activity (ברירת מחדל הנהלה ראשית / מנהלות סניף / מתכנת, נבדק מהעוגייה החתומה: lib/recentActivityAccess.js);
// בלי ההרשאה = 403, מזהה שאינו של עובדת פעילה = 404. הנתיב קריאה בלבד: לא כותב ל-AuditLog ולא לשום טבלה (גם לא "מי הציץ").
// הרשאה: אותה כמו דפי ההזמנות (page:orders). ההפרדה בין שני הגמ"חים היא ה-DB עצמו (כל גמ"ח בסיס נתונים נפרד).
// ביצועים: סבבים ממוקדים ובלי N+1 (יומן של העובדת: שאילתה אחת -> שיוך להזמנות -> שורות Order של העובדת לפי entityId ->
// פרטי הזמנות -> פריטים/תשלומים -> יומן ההזמנות), כולן עם take, בלי $transaction. החלון (60 ימי-לוח ישראליים) + take הם התקרה של
// התוצאה, לא של הסריקה: יש אינדקס על employeeId בלבד (לא על employeeId+createdAt), לכן למי שיש לה המון שורות בהיסטוריה Postgres
// עלול לסרוק את כולן ולמיין. אינדקס @@index([employeeId, createdAt]) על AuditLog היה פותר (SQL ידני בשני ה-DB, ר' NOTES, לא בוצע).
// הנתיב נקרא רק בפתיחת הרשימה ('&' / שורת השינויים שלי / /?recent=mine) - לא בטעינת עמוד.
// כשל ב-DB: 200 עם רשימות ריקות ו-degraded:true (התצוגה מראה "לא הצלחנו לטעון" ולא שגיאה).

const json = (body, status = 200) => NextResponse.json(body, { status });
const EMPTY = { created: [], changed: [] };

export async function GET(request) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  if (!(await canOpenPage('page:orders'))) return json({ error: 'Forbidden' }, 403);
  const me = await getActingEmployeeId();
  if (!me) return json({ ...EMPTY, anonymous: true }); // מצב פתוח (בלי התחברות) / עוגייה מזויפת: אין "אני"
  const asked = new URL(request.url).searchParams.get('employeeId');
  // רשימות של עובדת אחרת (MY-04 ב): רק מי שיש לה feature:view_others_recent_activity (ברירת מחדל הנהלה ראשית / מתכנת), לפי העוגייה החתומה בשרת.
  // המזהה חייב להיות של עובדת פעילה (לא עובד שירות); אחרת 404. הכל שאילתות קריאה בלבד, אותן תקרות.
  let who = me;
  if (asked && asked !== me) {
    if (!(await canViewOthersActivity(me))) return json({ error: 'Forbidden' }, 403);
    let target = null;
    try { target = await prisma.employee.findUnique({ where: { id: asked }, select: { id: true, isActive: true, legacyId: true } }); } catch { return json({ ...EMPTY, degraded: true }); }
    if (!isViewableEmployee(target)) return json({ error: 'Not found' }, 404);
    who = target.id;
  }

  try {
    const since = activitySince(new Date());
    const select = { id: true, entityType: true, entityId: true, action: true, createdAt: true };
    const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];

    // סבב 1: מה העובדת כתבה ביומן - שאילתה אחת (Order / OrderItem / Payment, כל הפעולות); CREATE של פריט / תשלום בהזמנה
    // שלא נוצרה עכשיו הוא שינוי ("נוסף פריט"), והסינון בין סוגי השורות נעשה בזיכרון (pickCandidates)
    const rows = await prisma.auditLog.findMany({ where: { employeeId: who, entityType: { in: [...MY_ENTITY_TYPES] }, createdAt: { gte: since } }, orderBy, take: L.auditRows, select });
    if (!rows.length) return json(EMPTY);

    // סבב 2: שיוך כל שורה להזמנה (מזהה uuid / מזהה פריט / מזהה תשלום -> מספר הזמנה + uuid של ההזמנה)
    const refs = collectRefs(rows);
    const [byUuid, items, pays] = await Promise.all([
      refs.orderUuids.length ? prisma.order.findMany({ where: { id: { in: refs.orderUuids } }, select: { id: true, orderId: true }, take: refs.orderUuids.length }) : [],
      refs.itemIds.length ? prisma.orderItem.findMany({ where: { id: { in: refs.itemIds } }, select: { id: true, orderId: true, order: { select: { id: true } } }, take: refs.itemIds.length }) : [],
      refs.paymentIds.length ? prisma.payment.findMany({ where: { id: { in: refs.paymentIds } }, select: { id: true, orderId: true, order: { select: { id: true } } }, take: refs.paymentIds.length }) : [],
    ]);
    const lookups = {
      uuidToNumber: new Map(byUuid.map((o) => [o.id, o.orderId])),
      itemToOrder: new Map(items.filter((i) => i.orderId != null).map((i) => [i.id, i.orderId])),
      paymentToOrder: new Map(pays.filter((p) => p.orderId != null).map((p) => [p.id, p.orderId])),
    };

    // סבב 2ב: שורות Order של העובדת להזמנות שנמצאו, לפי entityId (אינדקס entityType+entityId): (א) יצירות שנפלו מהתקרה של סבב 1
    // (אחרת "נוסף פריט" שנכתב בזמן יצירת הזמנה ישנה נחשב שינוי), (ב) שורות עם changesJson - הסטטוס שבהן קובע את רגע השמירה הסופית
    // של הזמנה שנוצרה דרך טיוטה. הזמנות בלי שורת Order בסבב 1 (רק פריט / תשלום) נכללות דרך ה-uuid שבקשר של הפריט / התשלום.
    const knownUuids = new Set(refs.orderUuids);
    for (const x of [...items, ...pays]) if (x.order && x.order.id) { knownUuids.add(x.order.id); lookups.uuidToNumber.set(x.order.id, x.orderId); }
    const orderRows = knownUuids.size
      ? await prisma.auditLog.findMany({
        where: { employeeId: who, entityType: 'Order', action: { in: ['CREATE', 'UPDATE'] }, entityId: { in: [...knownUuids] }, createdAt: { gte: since } },
        orderBy, take: L.extraAuditRows, select: { ...select, changesJson: true },
      })
      : [];
    const mine = mergeAuditRows(orderRows, rows);
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

    return json(composeMyActivity({ candidates, ordersByNumber, historyByNumber, me: who }));
  } catch (error) {
    console.error('recent-activity error:', error);
    return json({ ...EMPTY, degraded: true });
  }
}
