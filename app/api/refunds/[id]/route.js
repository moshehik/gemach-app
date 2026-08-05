import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { checkAuth } from '@/lib/auth';

export async function PUT(request, { params }) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
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
      // Two staff members can click "execute" on the same refund from different tabs at
      // nearly the same moment. A plain read-check-write would let both pass the
      // `!existingRefund.isExecuted` check before either commits, creating two reverse
      // Payments for one Refund. `updateMany` with `isExecuted: false` in the WHERE clause
      // is an atomic conditional claim at the DB level: only one caller's update can match
      // the row, so `claim.count === 0` unambiguously means someone else already executed
      // it. Wrapping the claim + payment creation in a transaction also means that if the
      // payment creation fails for any reason, the isExecuted flip rolls back with it instead
      // of leaving the refund stuck "executed" with no payment.
      const claimed = await prisma.$transaction(async (tx) => {
        const claim = await tx.refund.updateMany({
          where: { id, isExecuted: false, isDeleted: false },
          data: {
            ...otherData,
            isExecuted: true,
            executionDate: new Date(),
            executedBy: employeeCode || 'SYSTEM'
          }
        });

        if (claim.count === 0) return false;

        // updateMany doesn't go through the audit-log extension (it isn't a single-row
        // create/update/delete), so record the refund's own history line manually.
        // eslint-disable-next-line no-restricted-syntax -- updateMany אינו עובר דרך תוסף היומן, ראו ההסבר למעלה
        await tx.auditLog.create({
          data: {
            entityType: 'Refund',
            entityId: id,
            action: 'EXECUTE',
            changesJson: JSON.stringify({ isExecuted: { from: false, to: true } }),
            employeeId: token || null
          }
        });

        // Create reverse payment in Order
        if (existingRefund.orderId) {
          const reversePayment = await tx.payment.create({
            data: {
              customerId: existingRefund.customerId,
              orderId: existingRefund.orderId,
              amount: -Math.abs(existingRefund.amount), // Negative amount
              paymentMethod: 'החזר/זיכוי',
              notes: `החזר ללקוח (בנק ${existingRefund.bankName || ''} סניף ${existingRefund.bankBranch || ''} חשבון ${existingRefund.bankAccount || ''})`,
              isRefund: true,
            }
          });

          await tx.refund.update({
            where: { id },
            data: { paymentId: reversePayment.id }
          });

          // Audit log for payment
          // eslint-disable-next-line no-restricted-syntax -- הכתיבה היא ל-Payment; זו שורת ההיסטוריה של ההזמנה
          await tx.auditLog.create({
            data: {
              entityType: 'Order',
              entityId: String(existingRefund.orderId),
              action: 'ADD_PAYMENT',
              changesJson: JSON.stringify({ amount: -Math.abs(existingRefund.amount), note: 'Refund' }),
              employeeId: token || null
            }
          });
        }

        return true;
      });

      if (!claimed) {
        return NextResponse.json({ error: 'הזיכוי כבר סומן כבוצע בינתיים על ידי משתמש אחר. רענן את הדף.' }, { status: 409 });
      }

      const updatedRefund = await prisma.refund.findUnique({ where: { id } });
      return NextResponse.json(updatedRefund);
    } else if (isExecuted === false && existingRefund.isExecuted) {
      // Revert execution
      updateData.isExecuted = false;
      updateData.executionDate = null;
      updateData.executedBy = null;
      
      // Delete the reverse payment if it exists
      if (existingRefund.paymentId) {
        await prisma.payment.update({
          where: { id: existingRefund.paymentId },
          data: { isDeleted: true }
        });
        
        // Audit log for payment deletion
        // eslint-disable-next-line no-restricted-syntax -- הכתיבה היא ל-Payment; זו שורת ההיסטוריה של ההזמנה
        await prisma.auditLog.create({
          data: {
            entityType: 'Order',
            entityId: String(existingRefund.orderId),
            action: 'REMOVE_PAYMENT',
            changesJson: JSON.stringify({ paymentId: existingRefund.paymentId, note: 'Reverted Refund Execution' }),
            employeeId: token || null
          }
        });
        updateData.paymentId = null;
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
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    const result = await prisma.$transaction(async (tx) => {
      const existingRefund = await tx.refund.findUnique({ where: { id } });
      if (!existingRefund || existingRefund.isDeleted) {
        return { notFound: true };
      }

      // If the refund was already executed, a reverse (negative) Payment was created for
      // it on the order - cancelling/deleting the refund request must reverse that Payment
      // too, otherwise it's left orphaned on the order's ledger. Mirrors the "undo execute"
      // branch in PUT above.
      if (existingRefund.isExecuted && existingRefund.paymentId) {
        await tx.payment.update({
          where: { id: existingRefund.paymentId },
          data: { isDeleted: true }
        });

        // Audit log for payment deletion
        // eslint-disable-next-line no-restricted-syntax -- הכתיבה היא ל-Payment; זו שורת ההיסטוריה של ההזמנה
        await tx.auditLog.create({
          data: {
            entityType: 'Order',
            entityId: String(existingRefund.orderId),
            action: 'REMOVE_PAYMENT',
            changesJson: JSON.stringify({ paymentId: existingRefund.paymentId, note: 'Refund cancelled after execution' }),
            employeeId: token || null
          }
        });
      }

      // Soft delete
      await tx.refund.update({
        where: { id },
        data: { isDeleted: true }
      });

      return { notFound: false };
    });

    if (result.notFound) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting refund:', error);
    return NextResponse.json({ error: 'Failed to delete refund' }, { status: 500 });
  }
}
