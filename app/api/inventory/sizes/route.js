import { NextResponse } from 'next/server';
import prisma from '../../../../app/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const barcodePrefixParam = searchParams.get('barcodePrefix');

    if (!barcodePrefixParam) {
      return NextResponse.json({ error: 'Missing barcodePrefix' }, { status: 400 });
    }

    const barcodePrefix = parseInt(barcodePrefixParam, 10);

    const items = await prisma.dressItem.findMany({
      where: {
        barcodePrefix,
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
