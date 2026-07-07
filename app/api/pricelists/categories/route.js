import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';



export async function GET() {
    try {
        const categories = await prisma.priceList.findMany({
            select: {
                category: true,
            },
            distinct: ['category'],
        });
        // filter out nulls and map
        const validCategories = categories
            .map(c => c.category)
            .filter(c => c !== null && c.trim() !== '');
            
        return NextResponse.json(validCategories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}
