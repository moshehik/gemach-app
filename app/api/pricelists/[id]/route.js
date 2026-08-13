import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { cookies } from 'next/headers';

// Resolves the employee behind the auth_token cookie, same lookup /api/me uses
// (auth_token can hold either the Employee UUID or its legacy numeric id).
async function getActingEmployee() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token?.value) return null;
    const employeeId = token.value;
    const parsedLegacyId = parseInt(employeeId, 10);
    return prisma.employee.findFirst({
        where: {
            OR: [
                { id: employeeId },
                ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }])
            ]
        },
        select: { id: true, roleId: true }
    });
}

export async function PUT(request, { params }) {
    // Same admin-only intent as DELETE below (and the client-side lock in
    // app/dashboard/pricelist/page.js) - editing a price rule affects what customers
    // get charged, checkAuth() alone only required being logged in, not being a manager.
    if (!(await checkAuth('מנהל'))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    try {
        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id);
        const data = await request.json();
        
        const priceList = await prisma.priceList.update({
            where: { id },
            data: {
                description: data.description || null,
                fromSize: data.fromSize ? parseInt(data.fromSize) : null,
                toSize: data.toSize ? parseInt(data.toSize) : null,
                price: data.price ? parseFloat(data.price) : null,
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
                category: data.category || null,
                deposit: data.deposit ? parseFloat(data.deposit) : null,
            }
        });
        return NextResponse.json(priceList);
    } catch (error) {
        console.error("Error updating pricelist:", error);
        return NextResponse.json({ error: "Failed to update pricelist" }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    try {
        // Mirrors the client-side lock in app/dashboard/pricelist/page.js (handleLockSubmit),
        // which only allows unlocking delete for roleId 1/2 (מנהל/מתכנת) — enforce it server-side too,
        // since the lock is a UI affordance only and the DELETE endpoint itself must reject anyone else.
        const employee = await getActingEmployee();
        const isManager = employee && (employee.roleId === 1 || employee.roleId === 2);
        if (!isManager) {
            return NextResponse.json({ error: 'אין הרשאה למחיקה (נדרש סיווג מנהל/מתכנת)' }, { status: 403 });
        }

        const resolvedParams = await params;
        const id = parseInt(resolvedParams.id);
        await prisma.priceList.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting pricelist:", error);
        return NextResponse.json({ error: "Failed to delete pricelist" }, { status: 500 });
    }
}
