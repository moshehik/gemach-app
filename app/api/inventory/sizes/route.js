import { NextResponse } from 'next/server';
import prisma from '../../../../app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const barcodePrefixParam = searchParams.get('barcodePrefix');
    const modelIdParam = searchParams.get('modelId');

    if (!barcodePrefixParam && !modelIdParam) {
      return NextResponse.json({ error: 'Missing barcodePrefix or modelId' }, { status: 400 });
    }

    const barcodePrefix = barcodePrefixParam ? parseInt(barcodePrefixParam, 10) : undefined;
    const dressModelId = modelIdParam ? modelIdParam : undefined;

    const items = await prisma.dressItem.findMany({
      where: {
        ...(barcodePrefix ? { barcodePrefix } : {}),
        ...(dressModelId ? { dressModelId } : {}),
        isDeleted: false
      },
      select: {
        sizeText: true
      },
      distinct: ['sizeText']
    });

    const sizes = items.map(item => item.sizeText).filter(Boolean).sort();

    return NextResponse.json({ sizes });

  } catch (error) {
    console.error('Error fetching sizes:', error);
    return NextResponse.json({ error: 'Failed to fetch sizes' }, { status: 500 });
  }
}
