import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventDateStr = searchParams.get('eventDate');

    const dressModels = await prisma.dressModel.findMany({
      where: {
        isDeleted: false
      },
      include: {
        items: {
          include: {
            _count: {
              select: { orderItems: true }
            }
          }
        }
      }
    });

    let bulkAvailable = null;
    if (eventDateStr) {
      const eventDate = new Date(eventDateStr);
      if (!isNaN(eventDate.getTime())) {
        const { getBulkAvailableInventory } = await import('../../lib/inventory');
        bulkAvailable = await getBulkAvailableInventory(eventDate);
      }
    }

    // Map data to match the frontend expectations
    const formatted = dressModels.map(model => {
      // Keep track of how much availability we have left to distribute for each size
      const availableBySize = bulkAvailable ? { ...(bulkAvailable[model.id] || {}) } : null;
      
      const adjustedItems = model.items.map(item => {
        const size = item.sizeText || item.size || 'כללי';
        let availableQtyForThisItem = 1;

        const isUnusable = item.inRepair || item.notInUse || item.isDeleted || 
           (item.location && (item.location.includes('מחסן') || item.location.includes('warehouse') || item.location.includes('רזרבה') || item.location.includes('reserve')));

        if (bulkAvailable) {
          if (isUnusable) {
             availableQtyForThisItem = 0;
          } else if (availableBySize[size] > 0) {
             availableQtyForThisItem = 1;
             availableBySize[size] -= 1;
          } else {
             availableQtyForThisItem = 0;
          }
        } else {
          // No date specified, just return standard quantity
          if (isUnusable) {
             availableQtyForThisItem = 0;
          } else {
             availableQtyForThisItem = 1;
          }
        }

        return {
          ...item,
          quantity: availableQtyForThisItem,
          rentalsCount: item._count?.orderItems || 0,
          _count: undefined
        };
      });

      return {
        id: model.id,
        name: model.name,
        barcodePrefix: model.barcodePrefix,
        priceCategory: model.priceCategory,
        notes: model.notes,
        inInspection: model.inInspection,
        imageUrl: model.imageUrl,
        entryDateToRepo: model.entryDateToRepo,
        exitDateFromRepo: model.exitDateFromRepo,
        isDeleted: model.isDeleted,
        sizes: Array.from(new Set(adjustedItems.map(item => item.sizeText).filter(Boolean))),
        inStock: adjustedItems.some(item => item.quantity > 0),
        items: adjustedItems
      };
    });
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching dresses:', error);
    return NextResponse.json({ error: 'Failed to fetch dresses' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Check if duplicate barcodePrefix exists
    if (body.barcodePrefix) {
      const existing = await prisma.dressModel.findFirst({
        where: { 
          barcodePrefix: parseInt(body.barcodePrefix),
          isDeleted: false
        }
      });
      if (existing) {
        return NextResponse.json({ error: 'הקוד כבר בשימוש!' }, { status: 400 });
      }
    }

    const newModel = await prisma.dressModel.create({
      data: {
        name: body.name || `דגם ${body.barcodePrefix || 'חדש'}`,
        barcodePrefix: body.barcodePrefix ? parseInt(body.barcodePrefix) : null,
        priceCategory: body.priceCategory || null,
        notes: body.notes || null,
        inInspection: body.inInspection || false,
        imageUrl: body.imageUrl || null,
        entryDateToRepo: body.entryDateToRepo ? new Date(body.entryDateToRepo) : new Date(),
      }
    });

    return NextResponse.json(newModel);
  } catch (error) {
    console.error('Error creating dress model:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת הדגם' }, { status: 500 });
  }
}
