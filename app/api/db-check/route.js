import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const itemCount = await prisma.dressItem.count();
    const modelCount = await prisma.dressModel.count();
    const nullModels = await prisma.dressItem.count({ where: { dressModelId: null } });
    
    return NextResponse.json({ itemCount, modelCount, nullModels });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
