import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    // Check if employee has required permissions
    let employeeCode = null;
    if (token) {
      const emp = await prisma.employee.findUnique({ where: { id: token } });
      if (emp) {
        employeeCode = emp.legacyId ? String(emp.legacyId) : emp.id.substring(0, 4);
      }
    }

    const body = await request.json();
    const { isExecuted, ...otherData } = body;
    
    const existingRefund = await prisma.refund.findUnique({
      where: { id },
      include: { order: true }
    });
    
    if (!existingRefund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }
    
    let updateData = { ...otherData };
    
    // Handle execution logic
    if (isExecuted === true && !existingRefund.isExecuted) {
      // 1. Mark as executed
      updateData.isExecuted = true;
      updateData.executionDate = new Date();
      updateData.executedBy = employeeCode || 'SYSTEM';
      
      // 2. Create reverse payment in Order
      if (existingRefund.orderId) {
        const reversePayment = await prisma.payment.create({
          data: {
            customerId: existingRefund.customerId,
            orderId: existingRefund.orderId,
            amount: -Math.abs(existingRefund.amount), // Negative amount
            paymentMethod: 'החזר/זיכוי',
            notes: `החזר ללקוח (בנק ${existingRefund.bankName || ''} סניף ${existingRefund.bankBranch || ''} חשבון ${existingRefund.bankAccount || ''})`,
            isRefund: true,
          }
        });
        updateData.paymentId = reversePayment.id;
        
        // Audit log for payment
        await prisma.auditLog.create({
          data: {
            entityType: 'Order',
            entityId: String(existingRefund.orderId),
            action: 'ADD_PAYMENT',
            changesJson: JSON.stringify({ amount: -Math.abs(existingRefund.amount), note: 'Refund' }),
            employeeId: token || null
          }
        });
      }
    }
    
    const updatedRefund = await prisma.refund.update({
      where: { id },
      data: updateData
    });
    
    return NextResponse.json(updatedRefund);
  } catch (error) {
    console.error('Error updating refund:', error);
    return NextResponse.json({ error: 'Failed to update refund' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    const existingRefund = await prisma.refund.findUnique({ where: { id } });
    if (!existingRefund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }
    
    // Soft delete
    await prisma.refund.update({
      where: { id },
      data: { isDeleted: true }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting refund:', error);
    return NextResponse.json({ error: 'Failed to delete refund' }, { status: 500 });
  }
}
