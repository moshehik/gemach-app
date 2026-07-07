import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';



export async function PUT(request, { params }) {
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
    try {
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
