import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAvailableInventory, validateOrderItemsAvailability } from '@/lib/inventory';

export async function GET(request) {
  const log = [];
  function addLog(msg) {
    log.push(msg);
  }

  addLog("=== Starting Inventory Scenarios Test ===");
  
  let orderIdCounter = Math.floor(Math.random() * 100000) + 900000;

  try {
    const modelWithItems = await prisma.dressModel.findFirst({
      where: {
        items: {
          some: { notInUse: false, isDeleted: false }
        }
      },
      include: {
        items: {
          where: { notInUse: false, isDeleted: false }
        }
      }
    });

    if (!modelWithItems) {
      addLog("❌ No active models found in DB.");
      return NextResponse.json({ log });
    }

    const dressModelId = modelWithItems.id;
    const size = modelWithItems.items[0].sizeText || 'כללי';
    const totalStock = modelWithItems.items.filter(i => (i.sizeText || 'כללי') === size).reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    
    addLog(`Target Model ID: ${dressModelId}, Size: ${size}, Total Stock: ${totalStock}`);

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 30);
    if (baseDate.getDay() === 5) baseDate.setDate(baseDate.getDate() + 2);
    if (baseDate.getDay() === 6) baseDate.setDate(baseDate.getDate() + 1);
    baseDate.setHours(0,0,0,0);
    const testEventDate = new Date(baseDate);

    addLog(`\n--- Scenario 1: Initial Availability ---`);
    let avail = await getAvailableInventory(dressModelId, testEventDate, 3, true);
    let sizeAvail = avail.find(a => (a.sizeText || 'כללי') === size);
    let initialAvail = sizeAvail ? sizeAvail.availableQuantity : 0;
    addLog(`Available: ${initialAvail}/${totalStock}`);

    if (initialAvail === 0) {
       addLog("❌ Initial availability is 0, cannot proceed with tests on this model.");
       return NextResponse.json({ log });
    }

    addLog(`\n--- Scenario 2: Overlapping / Capacity (ציפוף) ---`);
    let createdOrders = [];
    for (let i = 0; i < initialAvail + 1; i++) {
        let order = await prisma.order.create({
            data: {
                orderId: orderIdCounter++,
                notes: `Test Capacity ${i}`,
                eventDate: testEventDate,
                status: 'חדש',
                items: {
                    create: {
                        dressModelId,
                        sizeText: size,
                        quantity: 1,
                        cartStatus: 'confirmed'
                    }
                }
            }
        });
        createdOrders.push(order);
    }
    
    avail = await getAvailableInventory(dressModelId, testEventDate, 3, true);
    sizeAvail = avail.find(a => (a.sizeText || 'כללי') === size);
    let newAvail = sizeAvail ? sizeAvail.availableQuantity : 0;
    
    if (newAvail === 0) {
        addLog("✅ Inventory correctly reported as 0 when capacity exceeded.");
    } else {
        addLog(`❌ Inventory should be 0, but is ${newAvail}`);
    }

    let validation = await validateOrderItemsAvailability([
        { dressModelId, sizeText: size, quantity: 1 }
    ], testEventDate, false, null, null);
    
    if (!validation.valid) {
        addLog("✅ validateOrderItemsAvailability correctly blocked exceeding capacity.");
    } else {
        addLog("❌ validateOrderItemsAvailability failed to block exceeding capacity.");
    }

    addLog(`\n--- Scenario 3: Adding to overlapping days ---`);
    const nextDay = new Date(testEventDate);
    nextDay.setDate(nextDay.getDate() + 1);
    let validationOverlap = await validateOrderItemsAvailability([
        { dressModelId, sizeText: size, quantity: 1 }
    ], nextDay, false, null, null);

    if (!validationOverlap.valid) {
        addLog("✅ Successfully blocked booking on overlapping day (due to buffer).");
    } else {
        addLog("❌ Failed to block booking on overlapping day. Buffer might not be working.");
    }

    addLog(`\n--- Scenario 4: Deleting a row (Mחיקה) ---`);
    const orderToDelete = createdOrders.pop();
    const itemToDelete = await prisma.orderItem.findFirst({ where: { orderId: orderToDelete.orderId }});
    await prisma.orderItem.update({
        where: { id: itemToDelete.id },
        data: { isDeleted: true }
    });
    
    avail = await getAvailableInventory(dressModelId, testEventDate, 3, true);
    sizeAvail = avail.find(a => (a.sizeText || 'כללי') === size);
    newAvail = sizeAvail ? sizeAvail.availableQuantity : 0;
    
    if (newAvail > 0) {
        addLog(`✅ Inventory correctly freed after deleting row. Available: ${newAvail}`);
    } else {
        addLog(`❌ Inventory not freed after row deletion. Available: ${newAvail}`);
    }

    addLog(`\n--- Scenario 5: Restoring a row (שחזור) ---`);
    await prisma.orderItem.update({
        where: { id: itemToDelete.id },
        data: { isDeleted: false }
    });
    
    avail = await getAvailableInventory(dressModelId, testEventDate, 3, true);
    sizeAvail = avail.find(a => (a.sizeText || 'כללי') === size);
    newAvail = sizeAvail ? sizeAvail.availableQuantity : 0;
    
    if (newAvail === 0) {
        addLog(`✅ Inventory correctly taken after restoring row.`);
    } else {
        addLog(`❌ Inventory not taken after restore. Available: ${newAvail}`);
    }

    addLog(`\n--- Scenario 6: 15-Minute Expiry (פג תוקף תשלום) ---`);
    await prisma.orderItem.update({
        where: { id: itemToDelete.id },
        data: { isDeleted: true }
    });
    
    const pastDate = new Date();
    pastDate.setMinutes(pastDate.getMinutes() - 20);
    
    let pendingOrder = await prisma.order.create({
        data: {
            orderId: orderIdCounter++,
            notes: `Test Pending 20m`,
            eventDate: testEventDate,
            status: 'חדש',
            items: {
                create: {
                    dressModelId,
                    sizeText: size,
                    quantity: 1,
                    cartStatus: 'pending',
                    cartStatusDate: pastDate
                }
            }
        }
    });
    
    avail = await getAvailableInventory(dressModelId, testEventDate, 3, true);
    sizeAvail = avail.find(a => (a.sizeText || 'כללי') === size);
    newAvail = sizeAvail ? sizeAvail.availableQuantity : 0;
    
    if (newAvail > 0) {
        addLog(`✅ Inventory correctly freed for 15+ mins pending order. Available: ${newAvail}`);
    } else {
        addLog(`❌ Inventory NOT freed for 15+ mins pending order.`);
    }

    addLog(`\n--- Scenario 7: Date Change & Save ---`);
    const nextMonth = new Date(testEventDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    await prisma.order.update({
        where: { id: createdOrders[0].id },
        data: { eventDate: nextMonth }
    });
    
    avail = await getAvailableInventory(dressModelId, testEventDate, 3, true);
    sizeAvail = avail.find(a => (a.sizeText || 'כללי') === size);
    newAvail = sizeAvail ? sizeAvail.availableQuantity : 0;
    
    if (newAvail > 0) {
         addLog(`✅ Inventory freed on old date after changing order date.`);
    } else {
         addLog(`❌ Inventory NOT freed on old date after changing order date.`);
    }

    addLog(`\n--- Cleanup ---`);
    for (const order of createdOrders) {
        await prisma.orderItem.deleteMany({ where: { orderId: order.orderId } });
        await prisma.order.delete({ where: { id: order.id } });
    }
    await prisma.orderItem.deleteMany({ where: { orderId: pendingOrder.orderId } });
    await prisma.order.delete({ where: { id: pendingOrder.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: orderToDelete.orderId } });
    await prisma.order.delete({ where: { id: orderToDelete.id } });
    
    addLog(`✅ Cleanup completed.`);
    return NextResponse.json({ log });

  } catch (error) {
    addLog(`❌ Error: ${error.message}`);
    return NextResponse.json({ log, error: error.message }, { status: 500 });
  }
}
