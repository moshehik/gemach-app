import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { attachEmployeeNames } from '@/app/lib/auditLog';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { resolveOrderRef } from '@/lib/history/orderHistory';
import { buildOrderJournal, parseShiftDefinitions } from '@/lib/history/orderJournal';
import { computeOrderStages, dayKeyOf, dayLabels } from '@/lib/schedule/orderStages';
import { resolveScheduleSettings } from '@/lib/schedule/settings';
import { listOrderMarks } from '@/lib/schedule/marks';

export const dynamic = 'force-dynamic';

// GET /api/orders/[id]/journal — כרטיס ההזמנה החדש, לשונית היסטוריה (W6, PLAN §C.1/§C.4):
//   stages   "שלבי ההזמנה" (A5) - השלבים של ההזמנה לפי הגדרות הלו״ז (lib/schedule/orderStages.js), בוצע / טרם בוצע
//   journal  "יומן הזמנה" (A20) - לכל שלב שבוצע + תשלום: מתי, מי, ומי היה במשמרת (lib/history/orderJournal.js)
//   canMark  האם אפשר לסמן "הכנה בוצעה" מהכרטיס: כל מי שפתחה הזמנה (page:orders - השער של הנקודה הזו) + טבלת הסימונים קיימת (AMB-08 (B),
//            החלטת הבעלים 2026-10-04; הסימון עצמו ב-POST /api/orders/[id]/prep-mark, לא ב-/api/schedule/marks שנשאר סגור בלי page:schedule)
// קריאה בלבד, בלי $transaction. שער: כמו GET /api/orders/[id]/history - checkAuth + page:orders (PLAN §C.5).
// אין בתשובה מזהי עובדים (UUID) - רק שמות; אין תאריך לועזי - מפתחות יום 'YYYY-MM-DD' + תוויות עבריות.

const MAX_AUDIT_ROWS = 1000;
const MAX_ITEM_UPDATE_ROWS = 200;
const MAX_SHIFT_ROWS = 400;
const DAY_MS = 24 * 3600 * 1000;
const JOURNAL_ACTIONS = ['ALTERATION_DONE', 'CONFIRM_RENTAL', 'RETURN_RENTAL'];

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const intOr = (v, d) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : d; };
const fullName = (e) => (e ? (e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || null) : null);

export async function GET(request, { params }) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  if (!(await canOpenPage('page:orders'))) return json({ error: 'Forbidden' }, 403);
  try {
    const { id } = await params;
    const ref = resolveOrderRef(id);
    if (!ref) return json({ error: 'Order not found' }, 404);
    const order = await prisma.order.findUnique({
      where: ref.id ? { id: ref.id } : { orderId: ref.orderId },
      select: {
        id: true, orderId: true, orderDate: true, employeeId: true, isDeleted: true,
        eventDate: true, fromDate: true, toDate: true, returnDate: true, isAbroad: true,
        isDelivery: true, deliveryDirection: true, deliveryOneDayBefore: true,
        items: {
          select: {
            id: true, isDeleted: true, neckAlteration: true, sleeveAlteration: true, lengthAlteration: true, alterationDone: true,
            isTaken: true, takenDate: true, isReturned: true, returnDate: true, returnedOk: true,
          },
        },
        payments: { select: { id: true, amount: true, paymentDate: true, isDeleted: true, isRefund: true } },
      },
    });
    if (!order) return json({ error: 'Order not found' }, 404);

    const items = order.items || [];
    const payments = order.payments || [];
    const now = new Date();
    const todayKey = dayKeyOf(now);

    const [settingsRows, marksRes] = await Promise.all([
      getAllCachedSettings().catch(() => []),
      listOrderMarks(order.orderId).catch(() => ({ available: false, marks: [] })),
    ]);
    const map = {};
    for (const r of settingsRows || []) if (r && r.key) map[r.key] = r.value;
    const schedule = resolveScheduleSettings(map);
    const delivery = { daysBefore: intOr(map.delivery_days_before, 1), daysAfter: intOr(map.delivery_days_after, 1), skipWeekends: map.delivery_skip_weekends === 'true' };

    // closeWhenReturned: הזמנה שהוחזרה במלואה / שבוטלה = בלי "שלב נוכחי" ובלי הצעת סימון הכנה (lib/schedule/orderStages.js)
    const { stages, currentKey, closed, closedBy } = computeOrderStages({ ...order, items }, { schedule, delivery, marks: marksRes.marks || [], todayKey, closeWhenReturned: true });

    // audit rows that say who did a stage (creation, repairs, rental, return, payment)
    const or = [{ entityType: 'Order', entityId: { in: [order.id, String(order.orderId)] }, action: 'CREATE' }];
    if (items.length) or.push({ entityType: 'OrderItem', entityId: { in: items.map((i) => i.id) }, action: { in: JOURNAL_ACTIONS } });
    if (payments.length) or.push({ entityType: 'Payment', entityId: { in: payments.map((p) => p.id) }, action: 'CREATE' });
    const auditSelect = { id: true, entityType: true, entityId: true, action: true, changesJson: true, createdAt: true, employeeId: true };
    // two small independent reads (no $transaction): the named actions, NEWEST first so a heavy order that hits the
    // cap loses its oldest rows, never the latest RETURN_RENTAL / CONFIRM_RENTAL / payment; and the generic item
    // UPDATE rows, only those that touch alterationDone (the old "repair done" form) with their own small cap
    const [mainRows, itemUpdateRows] = await Promise.all([
      prisma.auditLog.findMany({ where: { OR: or }, orderBy: [{ createdAt: 'desc' }], take: MAX_AUDIT_ROWS, select: auditSelect }),
      items.length
        ? prisma.auditLog.findMany({
          where: { entityType: 'OrderItem', entityId: { in: items.map((i) => i.id) }, action: 'UPDATE', changesJson: { contains: 'alterationDone' } },
          orderBy: [{ createdAt: 'desc' }],
          take: MAX_ITEM_UPDATE_ROWS,
          select: auditSelect,
        })
        : [],
    ]);
    const audit = [...mainRows, ...itemUpdateRows].reverse(); // oldest first, as the journal builder expects
    const named = await attachEmployeeNames([{ employeeId: order.employeeId }, ...audit]);
    const orderEmployeeName = named[0].employeeName || null;
    const auditRows = named.slice(1);

    // AMB-18 (B): שמות משמרות לפי שעה (SystemSetting shift_definitions; ריק = בלי משמרות בכלל - D3)
    const shiftDefinitions = parseShiftDefinitions(map.shift_definitions);
    const base = { order: { orderId: order.orderId, orderDate: order.orderDate, employeeName: orderEmployeeName }, stages, auditRows, items, payments, todayKey, shiftDefinitions };
    // pass 1 (without shifts) -> the instants of the done nodes -> ONE Shift query (a window per instant) -> pass 2
    const first = buildOrderJournal(base);
    const instants = first.nodes.map((n) => n.when && !n.when.dateOnly && n.when.ts).filter(Boolean).map((t) => new Date(t));
    let shifts = [];
    // D3 (בעלים 2026-10-05): אין הגדרות משמרות = אין מידע משמרת בכלל (גם לא שאילתת Shift)
    if (instants.length && shiftDefinitions.length) {
      const rows = await prisma.shift.findMany({
        where: { isDeleted: false, OR: instants.map((t) => ({ entryTime: { gte: new Date(t.getTime() - DAY_MS), lte: t } })) },
        select: { employeeId: true, entryTime: true, exitTime: true, employee: { select: { firstName: true, lastName: true, fullName: true } } },
        orderBy: { entryTime: 'asc' },
        take: MAX_SHIFT_ROWS,
      });
      shifts = rows.map((s) => ({ employeeId: s.employeeId, name: fullName(s.employee) || 'עובד/ת', entryTime: s.entryTime, exitTime: s.exitTime, isDeleted: false }));
    }
    const journal = shifts.length ? buildOrderJournal({ ...base, shifts }) : first;

    return json({
      orderId: order.orderId,
      today: dayLabels(todayKey),
      stages: stages.map(publicStage),
      currentKey,
      closed: !!closed,
      closedBy: closedBy || null, // 'return' | 'cancelled' | null - הציר העליון (OcStepper) מציג הזמנה שהוחזרה כגמורה והזמנה מבוטלת בלי שלב ממתין
      journal: journal.nodes,
      marksAvailable: !!marksRes.available,
      canMark: !!marksRes.available,
    });
  } catch (error) {
    console.error('Error building order journal:', error);
    return json({ error: 'Failed to load order journal' }, 500);
  }
}

// no employee ids in the response - the marker's NAME only
function publicStage(s) {
  const { mark, ...rest } = s;
  return { ...rest, mark: mark ? { dayKey: mark.dayKey, markedAt: mark.markedAt, markedBy: mark.markedBy || null, outcome: mark.outcome } : null };
}
