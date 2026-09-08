import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { checkAuth } from '@/lib/auth';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const orderId = searchParams.get('orderId');
    const pageParam = searchParams.get('page');
    const limit = parseInt(searchParams.get('limit')) || 100;
    // סינון טווח תאריכים + סטטוס לצורך ייצוא מסודר להנה"ח (ולא רק "מה שכבר נטען
    // בדפדפן") - fromDate/toDate מסננים לפי createdAt (תאריך בקשת הזיכוי).
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const status = searchParams.get('status'); // 'executed' | 'pending' | undefined=all
    const exportAll = searchParams.get('export') === 'true';

    let whereClause = { isDeleted: false };

    if (customerId) whereClause.customerId = customerId;
    if (orderId) whereClause.orderId = parseInt(orderId);
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) whereClause.createdAt.gte = new Date(fromDate);
      if (toDate) whereClause.createdAt.lte = new Date(toDate);
    }
    if (status === 'executed') whereClause.isExecuted = true;
    else if (status === 'pending') whereClause.isExecuted = false;

    const includeClause = {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          phone1: true,
          email: true
        }
      },
      order: {
        select: {
          orderId: true
        }
      }
    };

    // ייצוא מלא (export=true): כל השורות התואמות את הסינון, ללא הגבלת limit/page -
    // משמש את כפתור הייצוא בעמוד /refunds כדי לייצא את כל הטווח המבוקש להנה"ח,
    // ולא רק את מה שכבר נטען/עומד בעמוד הנוכחית בדפדפן.
    if (exportAll) {
      const refunds = await prisma.refund.findMany({
        where: whereClause,
        include: includeClause,
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({ data: refunds, total: refunds.length });
    }

    // Paginated mode: opt-in via `page` so existing callers that fetch by
    // customerId/orderId (small result sets) keep getting a plain array back.
    // Without this, refunds beyond the default `limit` (e.g. old ones on the
    // main refunds list) were simply unreachable - there was no way to page to them.
    if (pageParam) {
      const page = parseInt(pageParam, 10) || 1;
      const skip = (page - 1) * limit;

      const [refunds, total] = await Promise.all([
        prisma.refund.findMany({
          where: whereClause,
          include: includeClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.refund.count({ where: whereClause })
      ]);

      return NextResponse.json({
        data: refunds,
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      });
    }

    const refunds = await prisma.refund.findMany({
      where: whereClause,
      include: includeClause,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json(refunds);
  } catch (error) {
    console.error('Error fetching refunds:', error);
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    const body = await request.json();
    const { 
      customerId, orderId, amount, reason, 
      bankName, bankBranch, bankAccount, bankAccountName, 
      paymentDetails, email 
    } = body;
    
    if (!customerId || !amount) {
      return NextResponse.json({ error: 'חובה להזין לקוח וסכום זיכוי' }, { status: 400 });
    }
    
    const newRefund = await prisma.refund.create({
      data: {
        customerId,
        orderId: orderId ? parseInt(orderId) : null,
        amount: parseFloat(amount),
        reason,
        bankName,
        bankBranch,
        bankAccount,
        bankAccountName,
        paymentDetails,
        email
      }
    });
    
    // Also update customer bank details automatically if provided
    if (bankName || bankAccount) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          ...(bankName && { bankName }),
          ...(bankBranch && { bankBranch }),
          ...(bankAccount && { bankAccount }),
          ...(bankAccountName && { bankAccountName }),
        }
      });
    }
    
    return NextResponse.json(newRefund, { status: 201 });
  } catch (error) {
    console.error('Error creating refund:', error);
    return NextResponse.json({ error: 'Failed to create refund' }, { status: 500 });
  }
}
