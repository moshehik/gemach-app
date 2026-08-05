import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';


export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    // רשימת מזהים מופרדת בפסיקים — משמשת כשצריך את ההיסטוריה של קבוצת ישויות
    // בבקשה אחת (למשל כל הפריטים של דגם בכרטיס הדגם).
    const entityIds = searchParams.get('entityIds');
    const action = searchParams.get('action');
    // רשימת actions מופרדת בפסיקים - למשל 'DEBT_APPROVED,CANCEL_DEBT_APPROVAL' כדי
    // לשלוף בבקשה אחת את כל פעולות אישור/ביטול-אישור חוב עבור קבוצת הזמנות (ר' entityIds).
    // אם גם action וגם actions סופקו, action (הבודד) גובר.
    const actions = searchParams.get('actions');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    let where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (entityIds) {
      const ids = entityIds.split(',').map(s => s.trim()).filter(Boolean);
      // רשימה ריקה הייתה מתורגמת ל-`in: []` ומחזירה כלום בשקט; עדיף לא לסנן בכלל
      if (ids.length) where.entityId = { in: ids };
    }
    if (action) {
      where.action = action;
    } else if (actions) {
      const actionList = actions.split(',').map(s => s.trim()).filter(Boolean);
      if (actionList.length) where.action = { in: actionList };
    }

    // An Order is identified two different ways in this table: the automatic audit hook in
    // app/lib/prisma.js stores `result.id` (the UUID), while rows written by hand - such as
    // DEBT_APPROVED in PUT /api/orders/[id] - store the human-readable orderId. The order
    // screen asks by orderId, so it used to match none of the automatic rows. Accept either
    // form and look up its counterpart so a single request returns the whole history.
    if (entityType === 'Order' && entityId) {
      const isNumericId = /^\d+$/.test(entityId);
      const order = await prisma.order.findUnique({
        where: isNumericId ? { orderId: parseInt(entityId, 10) } : { id: entityId },
        select: { id: true, orderId: true }
      });
      if (order) {
        where.entityId = { in: [order.id, String(order.orderId)] };
      }
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    if (search) {
      // Prisma string search inside changesJson
      where.changesJson = { contains: search, mode: 'insensitive' };
    }
    
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });
    
    const total = await prisma.auditLog.count({ where });
    
    return NextResponse.json({ logs, total });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
