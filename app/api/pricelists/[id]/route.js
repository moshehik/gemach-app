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
    if (!(await checkAuth('הנהלה ראשית'))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
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
        // now roleId 0/2 (הנהלה ראשית/מתכנת) only, matching the PUT handler above and the
        // page-level guard in app/dashboard/pricelist/layout.js — a regular מנהל (roleId 1)
        // shouldn't reach this page at all anymore, so the API must reject them too.
        const employee = await getActingEmployee();
        const isHeadManagement = employee && (employee.roleId === 0 || employee.roleId === 2);
        if (!isHeadManagement) {
            return NextResponse.json({ error: 'אין הרשאה למחיקה (נדרש סיווג הנהלה ראשית/מתכנת)' }, { status: 403 });
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
