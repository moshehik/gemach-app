import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// 2026-10-12: was public (item / model counts). Developer only.
export async function GET() {
  if (!(await checkAuth('מתכנת'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const itemCount = await prisma.dressItem.count();
    const modelCount = await prisma.dressModel.count();
    const nullModels = await prisma.dressItem.count({ where: { dressModelId: null } });
    
    return NextResponse.json({ itemCount, modelCount, nullModels });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
