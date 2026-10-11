import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireDressItemManager } from '@/lib/dressItemAccess';

// Create a new DressItem for a specific DressModel
// ניהול פריטי דגם (הוספה): feature:dress_items_manage - הנהלה ראשית / מתכנת תמיד, אחרים לפי הרשאה (lib/dressItemAccess.js)
export async function POST(request, { params }) {
  const denied = await requireDressItemManager();
  if (denied) return denied;
  try {
    const resolvedParams = await params;
    const dressModelId = resolvedParams.id;
    if (!dressModelId) {
      return NextResponse.json({ error: 'קוד דגם חסר' }, { status: 400 });
    }

    const body = await request.json();

    if (body.dressBarcode) {
      const existing = await prisma.dressItem.findFirst({
        where: { dressBarcode: body.dressBarcode }
      });
      if (existing) {
        return NextResponse.json({ error: `הברקוד ${body.dressBarcode} כבר קיים במערכת.` }, { status: 400 });
      }
    }


    const newItem = await prisma.dressItem.create({
      data: {
        dressModelId,
        sizeText: body.sizeText || null,
        serialNumber: body.serialNumber ? parseInt(body.serialNumber) : null,
        dressBarcode: body.dressBarcode || null,
        location: body.location || null,
        locationNum: body.locationNum ? parseInt(body.locationNum) : null,
        cartonNumber: body.cartonNumber || null,
        quantity: body.quantity ? parseInt(body.quantity) : 1,
        inRepair: body.inRepair || false,
        notInUse: body.notInUse || false,
        notInUseSince: body.notInUseSince ? new Date(body.notInUseSince) : null,
        entryDateToRepo: body.entryDateToRepo ? new Date(body.entryDateToRepo) : new Date(),
        // legacy compatibility if needed
        dressName: body.dressName || null,
        barcodePrefix: body.barcodePrefix ? parseInt(body.barcodePrefix) : null,
      }
    });

    return NextResponse.json(newItem);
  } catch (error) {
    console.error('Error creating dress item:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת פריט' }, { status: 500 });
  }
}
