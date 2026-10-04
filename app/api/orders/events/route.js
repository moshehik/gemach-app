import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenAnyPage } from '@/lib/permissions';
import { writeOrderEvents } from '@/app/lib/auditLog';
import { parseEventsRequest, eventPageKeys, clientEventIdNeedle } from '@/lib/history/orderEvents';

export const dynamic = 'force-dynamic';

// POST /api/orders/events - logs an order event that has no model write behind it (print, PDF download,
// Excel export, history export). Full request/response contract: the JSDoc at the top of
// lib/history/orderEvents.js. Who = the session cookie (never the body); when = the DB clock.
// MANAGER_APPROVAL / EMAIL_* are rejected here - only verify-pin / the email route write them.
const fail = (status, code, error, extra = {}) => NextResponse.json({ ok: false, code, error, ...extra }, { status });

export async function POST(request) {
  if (!(await checkAuth())) return fail(401, 'UNAUTHORIZED', 'יש להתחבר למערכת');
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'BAD_REQUEST', 'גוף הבקשה אינו JSON תקין');
  }
  const parsed = parseEventsRequest(body);
  if (!parsed.ok) return fail(parsed.status, parsed.code, parsed.error, parsed.field ? { field: parsed.field } : {});
  const { orderIds, action, meta, clientEventId } = parsed;

  if (!(await canOpenAnyPage(eventPageKeys(action, meta)))) {
    return fail(403, 'FORBIDDEN', 'אין הרשאה לרשום פעולה על הזמנה');
  }

  try {
    // reads only, no transaction (the write below is a single createMany)
    const found = await prisma.order.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true } });
    // S6: an order id that does not exist must not fail the whole batch (a 200-order print chunk lost every row because of one deleted/unknown
    // id) and must not reveal WHICH ids exist: the existing ones are recorded, the answer carries only a count of skipped ids. Nothing
    // exists at all = 404 without a list. (The batch is already deduplicated and capped at MAX_EVENT_ORDER_IDS by parseEventsRequest.)
    const existing = new Set(found.map((o) => o.orderId));
    const writable = orderIds.filter((n) => existing.has(n));
    const skipped = orderIds.length - writable.length;
    if (!writable.length) return fail(404, 'ORDER_NOT_FOUND', 'הזמנה לא נמצאה');
    const duplicate = clientEventId
      ? await prisma.auditLog.findFirst({
        where: { entityType: 'Order', entityId: String(writable[0]), action, changesJson: { contains: clientEventIdNeedle(clientEventId) } },
        select: { id: true },
      })
      : null;
    if (duplicate) return NextResponse.json({ ok: true, action, orderIds, written: 0, ...(skipped ? { skipped } : {}), duplicate: true });

    const actorId = await getActingEmployeeId();
    const written = await writeOrderEvents({ orderIds: writable, action, meta, actorId, clientEventId });
    // 0 written with a clientEventId = a concurrent repeat won the race on the deterministic row key
    return NextResponse.json({ ok: true, action, orderIds, written, ...(skipped ? { skipped } : {}), duplicate: !!clientEventId && written === 0 });
  } catch (error) {
    console.error('POST /api/orders/events failed:', error);
    return fail(500, 'SERVER_ERROR', 'שגיאה ברישום הפעולה');
  }
}
