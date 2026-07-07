import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  try {
    const models = await prisma.dressModel.findMany({
      where: {
        exitDateFromRepo: null,
        ...(q ? {
          OR: [
            { name: { contains: q } },
            { barcodePrefix: { equals: parseInt(q) || -1 } }
          ]
        } : {})
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
