import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cachedJson } from '@/lib/httpCache';



export async function GET(request) {
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
            
        // CPU phase 1B: private, max-age=60, swr=300 + ETag/304 (lib/httpCache.js)
        return cachedJson(request, validCategories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}
