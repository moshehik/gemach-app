import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '@/app/lib/prisma';
import { checkAuth, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import { canOpenAnyPage, hasPermission } from '@/lib/permissions';
import { getCatalogItem } from '@/lib/permissionsMetadata';
import { verifySecret } from '@/lib/passwordAuth';
import {
  parseCustomerEventRequest, buildCustomerEventRow, buildCustomerApprovalMeta, clientEventIdNeedle,
  isCustomerIdShaped, CUSTOMER_EVENT_PAGE_KEYS, CUSTOMER_EVENT_ACTIONS,
} from '@/lib/history/customerEvents';

export const dynamic = 'force-dynamic';

// POST /api/customers/[id]/events - logs a customer event that has no model write behind it (print, PDF download,
// Excel export, history export, manager approval). Full contract: the JSDoc at the top of lib/history/customerEvents.js
// (mirrors POST /api/orders/events of the order-card build for entity 'Customer'). Who = the session cookie (never the
// body); when = the DB clock. MANAGER_APPROVAL is verified here (same rules as POST /api/auth/verify-pin) before the
// row is written; the pin is never stored.
const fail = (status, code, error, extra = {}) => NextResponse.json({ ok: false, code, error, ...extra }, { status });

// Same tiers as app/api/auth/verify-pin/route.js (kept in step by scripts/customer-card-tests/logic.test.mjs).
async function approverAllowed(employee, requiredLevel) {
  const isManager = employee.roleId === 1 || employee.roleId === 2;
  if (requiredLevel === 'מנהל') return isManager ? null : 'אין הרשאת מנהל/מתכנת למשתמש זה';
  if (requiredLevel === 'מתכנת') return employee.roleId === 2 ? null : 'פעולה זו מוגבלת למתכנת בלבד';
  if (requiredLevel === 'הנהלה ראשית') return HEAD_MANAGEMENT_ROLES.includes(employee.roleId) ? null : 'פעולה זו מוגבלת להנהלה ראשית בלבד';
  if (requiredLevel === 'מנהל סניף ומעלה') return [0, 1, 2].includes(employee.roleId) ? null : 'פעולה זו מוגבלת למנהל סניף ומעלה בלבד';
  if (requiredLevel === 'מאשר הזמנה ללא תשלום') return (await hasPermission(employee, 'feature:debt_approval')) ? null : 'פעולה זו מוגבלת למי שהורשה לאשר הזמנה ללא תשלום מלא';
  if (requiredLevel.startsWith('feature:')) {
    const item = getCatalogItem(requiredLevel);
    if (!item || !item.approver) return 'רמת אישור לא מוכרת';
    return (await hasPermission(employee, requiredLevel)) ? null : `אין הרשאה לאשר פעולה זו (${item.label})`;
  }
  return 'רמת אישור לא מוכרת';
}

export async function POST(request, { params }) {
  if (!(await checkAuth())) return fail(401, 'UNAUTHORIZED', 'יש להתחבר למערכת');
  const { id } = await params;
  if (!isCustomerIdShaped(id)) return fail(404, 'CUSTOMER_NOT_FOUND', 'לקוח לא נמצא');
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'BAD_REQUEST', 'גוף הבקשה אינו JSON תקין');
  }
  const parsed = parseCustomerEventRequest(body);
  if (!parsed.ok) return fail(parsed.status, parsed.code, parsed.error, parsed.field ? { field: parsed.field } : {});
  const { action, meta, clientEventId, approval } = parsed;

  if (!(await canOpenAnyPage([...CUSTOMER_EVENT_PAGE_KEYS]))) return fail(403, 'FORBIDDEN', 'אין הרשאה לרשום פעולה על לקוח');

  try {
    // reads only, no transaction (the write below is a single create)
    const [customer, duplicate] = await Promise.all([
      prisma.customer.findUnique({ where: { id }, select: { id: true } }),
      // MANAGER_APPROVAL never takes the duplicate shortcut: a repeated clientEventId must still go through the pin check
      // below (otherwise a replayed request would get {ok:true} without a password)
      clientEventId && action !== CUSTOMER_EVENT_ACTIONS.MANAGER_APPROVAL
        ? prisma.auditLog.findFirst({ where: { entityType: 'Customer', entityId: id, action, changesJson: { contains: clientEventIdNeedle(clientEventId) } }, select: { id: true } })
        : null,
    ]);
    if (!customer) return fail(404, 'CUSTOMER_NOT_FOUND', 'לקוח לא נמצא');
    if (duplicate) return NextResponse.json({ ok: true, action, customerId: id, written: 0, duplicate: true });

    let rowMeta = meta;
    let approver = null;
    if (action === CUSTOMER_EVENT_ACTIONS.MANAGER_APPROVAL) {
      const where = { isActive: true };
      if (approval.employeeId) where.id = approval.employeeId;
      const candidates = await prisma.employee.findMany({ where, select: { id: true, firstName: true, lastName: true, roleId: true, password: true } });
      for (const c of candidates) {
        if (await verifySecret(approval.pin, c.password)) { approver = c; break; }
      }
      if (!approver) return fail(401, 'BAD_PIN', 'סיסמה שגויה או משתמש לא פעיל');
      const why = await approverAllowed(approver, approval.requiredLevel);
      if (why) return fail(403, 'NOT_ALLOWED', why);
      rowMeta = buildCustomerApprovalMeta({ requiredLevel: approval.requiredLevel, reason: meta.reason, approverId: approver.id });
    }

    const actorId = await getActingEmployeeId();
    const data = buildCustomerEventRow({ customerId: id, action, meta: rowMeta, actorId, clientEventId });
    // eslint-disable-next-line no-restricted-syntax -- a customer event with no model write behind it (print/PDF/export/approval); the Prisma extension never sees it, so this is not a duplicate
    await prisma.auditLog.create({ data });
    const out = { ok: true, action, customerId: id, written: 1, duplicate: false };
    if (approver) Object.assign(out, { approverId: approver.id, approverName: `${approver.firstName || ''} ${approver.lastName || ''}`.trim() });
    return NextResponse.json(out);
  } catch (error) {
    console.error('POST /api/customers/[id]/events failed:', error);
    return fail(500, 'SERVER_ERROR', 'שגיאה ברישום הפעולה');
  }
}
