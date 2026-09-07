import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';

export const dynamic = 'force-dynamic';

// 26 - רשימת ברקודים לא תקינים להנהלה + סימון טופל, מותנה ב-barcode_invalid_list
export async function GET(request) {
  const all = await getAllCachedSettings();
  const enabled = all.find(s => s.key === 'barcode_invalid_list')?.value === 'true';
  if (!enabled) return NextResponse.json({ items: [], disabled: true });
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const items = await prisma.orderItem.findMany({
      where: { barcodeInvalid: true, isDeleted: false },
      include: {
        dressItem: { include: { dress: true } },
        order: { select: { orderId: true, customer: { select: { firstName: true, lastName: true, phone1: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}

export async function POST(request) {
  const all = await getAllCachedSettings();
  const enabled = all.find(s => s.key === 'barcode_invalid_list')?.value === 'true';
  if (!enabled) return NextResponse.json({ error: 'רשימת ברקודים כבויה' }, { status: 403 });
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });
    const updated = await prisma.orderItem.update({
      where: { id },
      data: { barcodeInvalidHandled: true },
    });
    return NextResponse.json({ success: true, item: updated });
  } catch (e) {
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}
