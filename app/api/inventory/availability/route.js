import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const size = searchParams.get('size');
  
  if (!modelId) {
    return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
  }

  try {
    const dressItems = await prisma.dressItem.findMany({
      where: {
        dressModelId: parseInt(modelId),
        sizeText: size || undefined,
        notInUse: false,
        inRepair: false
      },
      include: {
        orderItems: {
          where: { isDeleted: false },
          include: {
            order: true
          }
        }
      }
    });

    return NextResponse.json({ items: dressItems });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}
