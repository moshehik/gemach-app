import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const orderId = searchParams.get('orderId');
    const limit = parseInt(searchParams.get('limit')) || 100;
    
    let whereClause = { isDeleted: false };
    
    if (customerId) whereClause.customerId = customerId;
    if (orderId) whereClause.orderId = parseInt(orderId);
    
    const refunds = await prisma.refund.findMany({
      where: whereClause,
      include: {
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
      },
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
