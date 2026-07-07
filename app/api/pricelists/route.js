import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';



export async function GET() {
    try {
        const pricelists = await prisma.priceList.findMany({
            orderBy: [
                { category: 'asc' },
                { fromSize: 'asc' }
            ]
        });
        return NextResponse.json(pricelists);
    } catch (error) {
        console.error("Error fetching pricelists:", error);
        return NextResponse.json({ error: "Failed to fetch pricelists" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();
        const priceList = await prisma.priceList.create({
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
        return NextResponse.json(priceList, { status: 201 });
    } catch (error) {
        console.error("Error creating pricelist:", error);
        return NextResponse.json({ error: "Failed to create pricelist" }, { status: 500 });
    }
}
