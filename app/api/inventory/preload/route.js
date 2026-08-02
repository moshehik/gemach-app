import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('targetDate') || searchParams.get('eventDate');
    const isAbroad = searchParams.get('isAbroad') === 'true';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const excludeOrderIdStr = searchParams.get('excludeOrderId');

    const minDateStr = isAbroad ? fromDate : targetDate;
    const maxDateStr = isAbroad ? toDate : minDateStr;

    if (!minDateStr) {
      return NextResponse.json({ error: 'Missing target date or fromDate for availability query' }, { status: 400 });
    }

    const minDate = new Date(minDateStr);
    const maxDate = maxDateStr ? new Date(maxDateStr) : minDate;

    // Calculate +/- 60 days window around event range
    const dateLimitStart = new Date(minDate);
    dateLimitStart.setDate(dateLimitStart.getDate() - 60);

    const dateLimitEnd = new Date(maxDate);
    dateLimitEnd.setDate(dateLimitEnd.getDate() + 60);

    // 1. Fetch system settings
    const settingsRaw = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['inventory_buffer_days', 'inventory_skip_weekends', 'inventory_include_warehouse'] }
      }
    });

    let bufferDays = 3;
    let skipWeekends = true;
    let includeWarehouse = false;

    const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
    if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);

    const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
    if (weekendSetting) skipWeekends = weekendSetting.value === 'true';

    const warehouseSetting = settingsRaw.find(s => s.key === 'inventory_include_warehouse');
    if (warehouseSetting) includeWarehouse = warehouseSetting.value === 'true';

    // 2. Fetch total active stock (all dress items)
    const stockItems = await prisma.dressItem.findMany({
      where: {
        notInUse: false,
        isDeleted: false,
        inRepair: false,
        ...(includeWarehouse ? {} : {
          OR: [
            { location: null },
            {
              AND: [
                { location: { not: { contains: 'מחסן' } } },
                { location: { not: { contains: 'רזרבה' } } },
                { location: { not: { contains: 'warehouse' } } },
                { location: { not: { contains: 'reserve' } } }
              ]
            }
          ]
        })
      },
      select: {
        id: true,
        dressModelId: true,
        sizeText: true,
        quantity: true
      }
    });

    // Group stock by [dressModelId][sizeText]
    const stock = {};
    stockItems.forEach(item => {
      if (!item.dressModelId) return;
      const size = item.sizeText || 'כללי';
      if (!stock[item.dressModelId]) {
        stock[item.dressModelId] = {};
      }
      if (!stock[item.dressModelId][size]) {
        stock[item.dressModelId][size] = { total: 0, itemId: item.id };
      }
      stock[item.dressModelId][size].total += (item.quantity || 1);
    });

    // 3. Fetch barcodes prefix to modelId map
    const models = await prisma.dressModel.findMany({
      select: { id: true, barcodePrefix: true }
    });
    const prefixToModelId = {};
    models.forEach(m => {
      if (m.barcodePrefix) {
        prefixToModelId[m.barcodePrefix] = m.id;
      }
    });

    // 4. Fetch bookings in date range window
    const bookingsWhere = {
      isDeleted: false,
      isReturned: false,
      order: {
        isDeleted: false,
        status: { notIn: ['מבוטל', 'מחוק'] },
        OR: [
          { eventDate: { gte: dateLimitStart, lte: dateLimitEnd } },
          { fromDate: { gte: dateLimitStart, lte: dateLimitEnd } },
          { toDate: { gte: dateLimitStart, lte: dateLimitEnd } }
        ]
      }
    };

    if (excludeOrderIdStr) {
      const excludeOrderId = parseInt(excludeOrderIdStr, 10);
      if (!isNaN(excludeOrderId)) {
        bookingsWhere.order.orderId = { not: excludeOrderId };
      }
    }

    const bookingsRaw = await prisma.orderItem.findMany({
      where: bookingsWhere,
      select: {
        barcodePrefix: true,
        sizeText: true,
        quantity: true,
        dressItem: {
          select: {
            dressModelId: true,
            sizeText: true
          }
        },
        order: {
          select: {
            eventDate: true,
            isAbroad: true,
            fromDate: true,
            toDate: true
          }
        }
      }
    });

    // Normalize bookings
    const bookings = bookingsRaw.map(b => {
      const modelId = b.dressModelId || b.dressItem?.dressModelId || (b.barcodePrefix ? prefixToModelId[b.barcodePrefix] : null);
      const size = b.sizeText || b.dressItem?.sizeText || 'כללי';
      
      return {
        m: modelId,
        s: size,
        q: b.quantity || 1,
        eD: b.order?.eventDate ? b.order.eventDate.toISOString() : null,
        fD: b.order?.fromDate ? b.order.fromDate.toISOString() : null,
        tD: b.order?.toDate ? b.order.toDate.toISOString() : null
      };
    }).filter(b => b.m !== null);

    return NextResponse.json({
      settings: {
        bufferDays,
        skipWeekends
      },
      stock,
      bookings
    });
  } catch (error) {
    console.error('Error in inventory preload API:', error);
    return NextResponse.json(
      { error: 'Failed to preload inventory availability' },
      { status: 500 }
    );
  }
}
