import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    if (!id) {
      return NextResponse.json({ error: 'קוד שמלה חסר' }, { status: 400 });
    }

    const dress = await prisma.dressModel.findUnique({
      where: { id },
      include: {
        items: {
          where: { isDeleted: false },
          orderBy: { serialNumber: 'asc' }
        }
      }
    });

    if (!dress) {
      return NextResponse.json({ error: 'שמלה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json(dress);
  } catch (error) {
    console.error('Error fetching dress:', error);
    return NextResponse.json({ error: 'שגיאה בשליפת השמלה' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'קוד שמלה חסר' }, { status: 400 });
    }

    // Check for barcode conflict if updating barcode OR if restoring a deleted model
    const currentModel = await prisma.dressModel.findUnique({ where: { id } });
    const targetBarcode = body.barcodePrefix !== undefined ? body.barcodePrefix : currentModel?.barcodePrefix;
    
    if (targetBarcode !== undefined && targetBarcode !== null && targetBarcode !== "") {
      // If we are restoring, or updating to a new barcode
      if (body.isDeleted === false || (body.barcodePrefix !== undefined)) {
        const existing = await prisma.dressModel.findFirst({
          where: { 
            barcodePrefix: parseInt(targetBarcode),
            id: { not: id },
            isDeleted: false // Only conflict if the other one is active
          }
        });
        if (existing) {
          return NextResponse.json({ error: 'הקוד כבר בשימוש בדגם פעיל אחר במערכת!' }, { status: 400 });
        }
      }
    }

    const updatedData = {};
    if (body.name !== undefined) updatedData.name = body.name;
    if (body.priceCategory !== undefined) updatedData.priceCategory = body.priceCategory;
    if (body.notes !== undefined) updatedData.notes = body.notes;
    if (body.imageUrl !== undefined) updatedData.imageUrl = body.imageUrl;
    if (body.inInspection !== undefined) updatedData.inInspection = body.inInspection;
    
    if (body.barcodePrefix !== undefined) {
      updatedData.barcodePrefix = body.barcodePrefix ? parseInt(body.barcodePrefix) : null;
    }
    
    if (body.entryDateToRepo !== undefined) {
      updatedData.entryDateToRepo = body.entryDateToRepo ? new Date(body.entryDateToRepo) : null;
    }
    
    if (body.exitDateFromRepo !== undefined) {
      updatedData.exitDateFromRepo = body.exitDateFromRepo ? new Date(body.exitDateFromRepo) : null;
    }

    if (body.isDeleted !== undefined) {
      updatedData.isDeleted = body.isDeleted;
      if (!body.isDeleted) {
        updatedData.deletedAt = null;
      }
    }

    const updated = await prisma.dressModel.update({
      where: { id },
      data: updatedData
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating dress:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון השמלה' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    if (!id) {
      return NextResponse.json({ error: 'קוד שמלה חסר' }, { status: 400 });
    }

    // Since a dress model might have associated items, we need to handle relation deletion 
    // or just delete the model if items are set to Cascade (not set in our schema, so we should delete items first if needed, 
    // but typically we don't delete models with active inventory)
    
    // Check if it has active items
    const activeItemsCount = await prisma.dressItem.count({ 
      where: { 
        dress: { id },
        isDeleted: false
      } 
    });
    if (activeItemsCount > 0) {
      return NextResponse.json({ error: 'לא ניתן למחוק דגם שקיימים לו פריטים במלאי (יש למחוק קודם את הפריטים)' }, { status: 400 });
    }

    await prisma.dressModel.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dress:', error);
    return NextResponse.json({ error: 'שגיאה במחיקת השמלה' }, { status: 500 });
  }
}
