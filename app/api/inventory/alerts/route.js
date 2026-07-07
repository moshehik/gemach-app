import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { addDaysSkippingWeekends } from '../../../../lib/inventory';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch settings for buffer and weekends
    const settingsRaw = await prisma.setting.findMany();
    let bufferDays = 3;
    let skipWeekends = true;
    
    const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
    if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
    
    const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
    if (weekendSetting) skipWeekends = weekendSetting.value === 'true';

    // 2. Fetch all dress items to group them by model and size
    const allItems = await prisma.dressItem.findMany({
      where: { isDeleted: false },
      include: { dress: true }
    });

    const inventoryMap = {}; // { modelId_size: { totalInStock: 0, dressName, inRepair: 0, notInUse: 0, warehouse: 0, reserve: 0 } }
    
    for (const item of allItems) {
      if (!item.dressModelId) continue;
      
      const size = item.sizeText || item.size || 'כללי';
      const key = `${item.dressModelId}_${size}`;
      
      if (!inventoryMap[key]) {
        inventoryMap[key] = {
          dressModelId: item.dressModelId,
          dressName: item.dress?.name || item.dressName || 'דגם לא ידוע',
          sizeText: size,
          totalInStock: 0,
          inRepair: 0,
          notInUse: 0,
          warehouse: 0,
          reserve: 0
        };
      }
      
      // Determine status
      if (item.inRepair) {
        inventoryMap[key].inRepair += 1;
      } else if (item.notInUse) {
        inventoryMap[key].notInUse += 1;
      } else if (item.location && (item.location.includes('מחסן') || item.location.includes('warehouse'))) {
        inventoryMap[key].warehouse += 1;
      } else if (item.location && (item.location.includes('רזרבה') || item.location.includes('reserve'))) {
        inventoryMap[key].reserve += 1;
      } else {
        // Active stock
        inventoryMap[key].totalInStock += 1;
      }
    }

    // 3. Fetch all future bookings
    // A booking is "future" if its eventDate or toDate is today or later
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureBookings = await prisma.orderItem.findMany({
      where: {
        isDeleted: false,
        isReturned: false,
        order: {
          isDeleted: false,
          OR: [
            { eventDate: { gte: today } },
            { toDate: { gte: today } },
            // Include active orders that might be ongoing
            { fromDate: { lte: today }, toDate: { gte: today } }
          ]
        }
      },
      include: {
        order: true,
        dressItem: true
      }
    });

    // 4. Organize bookings by model and size
    const bookingsMap = {}; // { modelId_size: [booking1, booking2] }
    for (const booking of futureBookings) {
      if (!booking.order) continue;
      const modelId = booking.dressModelId || booking.dressItem?.dressModelId;
      if (!modelId) continue;
      
      const size = booking.sizeText || booking.dressItem?.sizeText || 'כללי';
      const key = `${modelId}_${size}`;
      
      if (!bookingsMap[key]) bookingsMap[key] = [];
      bookingsMap[key].push(booking);
    }

    // 5. Detect Overlaps per day
    const alerts = [];
    
    for (const key in bookingsMap) {
      const bookings = bookingsMap[key];
      const invInfo = inventoryMap[key] || { totalInStock: 0, dressName: 'לא ידוע', sizeText: key.split('_')[1] };
      const totalInStock = invInfo.totalInStock;
      
      // Find the furthest date to check
      let maxDate = new Date(today);
      let minDate = new Date(today);
      
      for (const b of bookings) {
        const customEnd = (b.order.isAbroad && b.order.toDate) ? new Date(b.order.toDate) : null;
        const eDate = b.order.eventDate ? new Date(b.order.eventDate) : null;
        
        let endBound = new Date();
        if (customEnd) {
          endBound = new Date(customEnd);
        } else if (eDate) {
          endBound = addDaysSkippingWeekends(new Date(eDate), bufferDays, skipWeekends);
        }
        
        if (endBound > maxDate) maxDate = new Date(endBound);
      }
      
      // We will iterate day by day
      let currentAlert = null;
      let d = new Date(minDate);
      
      while (d <= maxDate) {
        // Skip weekends globally if they are skipped for everyone?
        // Actually, an event can't overlap on a skipped weekend, but to be safe we check every day.
        
        let dailyDemand = 0;
        let involvedOrders = new Set();
        
        for (const b of bookings) {
          const isAbroad = b.order.isAbroad;
          const customStart = isAbroad && b.order.fromDate ? new Date(b.order.fromDate) : null;
          const customEnd = isAbroad && b.order.toDate ? new Date(b.order.toDate) : customStart;
          const eDate = b.order.eventDate ? new Date(b.order.eventDate) : null;
          
          let overlaps = false;
          if (customStart && customEnd) {
            if (d >= customStart && d <= customEnd) overlaps = true;
          } else if (eDate) {
            const bMin = addDaysSkippingWeekends(eDate, -bufferDays, skipWeekends);
            const bMax = addDaysSkippingWeekends(eDate, bufferDays, skipWeekends);
            if (d >= bMin && d <= bMax) overlaps = true;
          }
          
          if (overlaps) {
            dailyDemand += (b.quantity || 1);
            involvedOrders.add(b.order.orderId);
          }
        }
        
        if (dailyDemand > totalInStock) {
          // We have a shortage!
          if (!currentAlert) {
             currentAlert = {
                modelId: parseInt(key.split('_')[0]),
                dressName: invInfo.dressName,
                sizeText: invInfo.sizeText,
                fromDate: new Date(d).toISOString(),
                toDate: new Date(d).toISOString(),
                demanded: dailyDemand,
                inStock: totalInStock,
                orders: Array.from(involvedOrders),
                statusSummary: {
                  inRepair: invInfo.inRepair || 0,
                  notInUse: invInfo.notInUse || 0,
                  warehouse: invInfo.warehouse || 0,
                  reserve: invInfo.reserve || 0
                }
             };
          } else {
             // Extend the alert range
             currentAlert.toDate = new Date(d).toISOString();
             currentAlert.demanded = Math.max(currentAlert.demanded, dailyDemand);
             // Add any new orders
             for (const oid of involvedOrders) {
               if (!currentAlert.orders.includes(oid)) currentAlert.orders.push(oid);
             }
          }
        } else {
          // Shortage ended
          if (currentAlert) {
            alerts.push(currentAlert);
            currentAlert = null;
          }
        }
        
        d.setDate(d.getDate() + 1);
      }
      
      // If ended while in alert
      if (currentAlert) {
        alerts.push(currentAlert);
      }
    }

    return NextResponse.json({ alerts });

  } catch (error) {
    console.error('Error generating alerts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
