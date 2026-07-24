import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

// Update a specific DressItem
export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    if (!itemId) {
      return NextResponse.json({ error: 'קוד פריט חסר' }, { status: 400 });
    }

    const body = await request.json();
    const currentItem = await prisma.dressItem.findUnique({ where: { id: itemId } });
    const targetBarcode = body.dressBarcode !== undefined ? body.dressBarcode : currentItem?.dressBarcode;

    if (targetBarcode !== undefined && targetBarcode !== null && targetBarcode !== "") {
      if (body.isDeleted === false || (body.dressBarcode !== undefined)) {
        const existing = await prisma.dressItem.findFirst({
          where: { 
            dressBarcode: targetBarcode,
            id: { not: itemId },
            isDeleted: false // Only conflict with active items
          }
        });
        if (existing) {
          return NextResponse.json({ error: `הברקוד ${targetBarcode} כבר קיים במערכת לפריט פעיל אחר.` }, { status: 400 });
        }
      }
    }


    const dataToUpdate = {
      sizeText: body.sizeText !== undefined ? body.sizeText : undefined,
      serialNumber: body.serialNumber !== undefined ? (body.serialNumber ? parseInt(body.serialNumber) : null) : undefined,
      dressBarcode: body.dressBarcode !== undefined ? body.dressBarcode : undefined,
      location: body.location !== undefined ? body.location : undefined,
      locationNum: body.locationNum !== undefined ? (body.locationNum ? parseInt(body.locationNum) : null) : undefined,
      quantity: body.quantity !== undefined ? parseInt(body.quantity) : undefined,
      inRepair: body.inRepair !== undefined ? body.inRepair : undefined,
      notInUse: body.notInUse !== undefined ? body.notInUse : undefined,
      notInUseSince: body.notInUseSince !== undefined ? (body.notInUseSince ? new Date(body.notInUseSince) : null) : undefined,
    };
    if (body.isDeleted !== undefined) {
      dataToUpdate.isDeleted = body.isDeleted;
      if (!body.isDeleted) {
        dataToUpdate.deletedAt = null;
      }
    }

    const updatedItem = await prisma.dressItem.update({
      where: { id: itemId },
      data: dataToUpdate
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating dress item:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון פריט' }, { status: 500 });
  }
}

// Delete a specific DressItem
export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    if (!itemId) {
      return NextResponse.json({ error: 'קוד פריט חסר' }, { status: 400 });
    }

    await prisma.dressItem.update({
      where: { id: itemId },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dress item:', error);
    return NextResponse.json({ error: 'שגיאה במחיקת פריט' }, { status: 500 });
  }
}
