import { NextResponse } from 'next/server';
import { getBulkAvailableInventory, getAvailableInventory } from '../../../lib/inventory';
import prisma from '../../lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || '2026-06-23T00:00:00.000Z';
    const targetDate = new Date(dateStr);
    
    const orderOnDate = await prisma.order.findFirst({
      where: { 
        eventDate: targetDate,
        status: { notIn: ['מבוטל', 'מחוק'] },
        isDeleted: false
      },
      include: { items: { include: { dressItem: true } } }
    });
    
    if (!orderOnDate) {
      return NextResponse.json({ error: 'No order exactly on ' + targetDate.toISOString() });
    }
    
    const bookedItem = orderOnDate.items.find(i => !i.isDeleted && i.dressItem);
    if (!bookedItem) {
      return NextResponse.json({ error: 'No valid item with dressItem in order' });
    }
    
    const modelId = bookedItem.dressItem.dressModelId;
    const size = bookedItem.sizeText;
    
    const bulk = await getBulkAvailableInventory(targetDate, [modelId]);
    const single = await getAvailableInventory(modelId, targetDate, 3, true, false, null, null);
    
    return NextResponse.json({
      modelId,
      size,
      qty: bookedItem.quantity,
      orderId: orderOnDate.id,
      bulk: bulk[modelId],
      single: single.find(s => s.sizeText === size)
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}
