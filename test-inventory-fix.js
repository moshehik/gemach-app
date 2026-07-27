import prisma from './app/lib/prisma.js';
import { validateOrderItemsAvailability } from './lib/inventory.js';

async function runTests() {
  console.log("Starting Inventory Validation Tests...");
  
  try {
    // 1. Find an active dress item
    const testItem = await prisma.dressItem.findFirst({
      where: {
        notInUse: false,
        isDeleted: false,
        inRepair: false
      },
      include: {
        dress: true
      }
    });

    if (!testItem) {
      console.log("No active dress items found for testing.");
      process.exit(0);
    }

    const modelId = testItem.dressModelId;
    const size = testItem.sizeText || 'כללי';
    console.log(`Testing with Model ID: ${modelId}, Size: ${size}`);

    // Determine target dates
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 10); // 10 days from now
    
    // First, let's see how many are available initially
    const initialCheck = await validateOrderItemsAvailability([{
        dressModelId: modelId,
        sizeText: size,
        quantity: 1,
        isDeleted: false
    }], eventDate, false, null, null, null);
    
    console.log("Initial availability check (qty 1):", initialCheck.valid ? "PASSED" : "FAILED (expected to pass unless 0 stock)");

    // Test a massive quantity that shouldn't be available
    const overbookCheck = await validateOrderItemsAvailability([{
        dressModelId: modelId,
        sizeText: size,
        quantity: 9999,
        isDeleted: false
    }], eventDate, false, null, null, null);
    
    console.log("Overbooking check (qty 9999):", !overbookCheck.valid ? "PASSED (correctly blocked)" : "FAILED (allowed 9999 items)");

    // Get total stock for this size
    const getStock = await prisma.dressItem.count({
        where: { dressModelId: modelId, sizeText: size, notInUse: false, isDeleted: false, inRepair: false }
    });
    
    console.log(`Total stock for this model/size: ${getStock}`);

    // Create a real order to book one item
    const maxOrder = await prisma.order.findFirst({ orderBy: { orderId: 'desc' } });
    const orderId1 = maxOrder ? maxOrder.orderId + 1 : 1;

    const order = await prisma.order.create({
        data: {
            orderId: orderId1,
            eventDate: eventDate,
            items: {
                create: [{
                    dressItemId: testItem.id,
                    sizeText: size,
                    quantity: 1,
                    isDeleted: false
                }]
            }
        }
    });
    console.log(`Created test order #${order.orderId} for event date ${eventDate.toISOString().split('T')[0]}`);

    // Now check availability for the EXACT same date, requesting ALL stock
    const postBookingCheck = await validateOrderItemsAvailability([{
        dressModelId: modelId,
        sizeText: size,
        quantity: getStock, 
        isDeleted: false
    }], eventDate, false, null, null, null);

    console.log(`Post-booking check (requesting ${getStock} items when 1 is booked):`, !postBookingCheck.valid ? "PASSED (correctly blocked)" : "FAILED (allowed full stock)");

    // Check availability ignoring the order (as if updating the SAME order)
    const updateCheck = await validateOrderItemsAvailability([{
        dressModelId: modelId,
        sizeText: size,
        quantity: getStock, 
        isDeleted: false
    }], eventDate, false, null, null, order.orderId);

    console.log(`Update check (ignoring order #${order.orderId}):`, updateCheck.valid ? "PASSED (allowed)" : "FAILED (blocked incorrectly)");

    // Cleanup
    await prisma.orderItem.deleteMany({ where: { orderId: order.orderId }});
    await prisma.order.delete({ where: { orderId: order.orderId }});
    console.log("Cleanup completed.");
    
  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
