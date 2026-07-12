const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAvailableInventory } = require('./lib/inventory.js');

async function test() {
  const modelId = 366;
  const eventDate = '2026-08-05T21:00:00.000Z'; // Or whatever date
  
  // What does getAvailableInventory return?
  const availability = await getAvailableInventory(modelId, eventDate, 3, true, false, eventDate, null);
  
  console.log("Availability:", JSON.stringify(availability, null, 2));
  
  const req = {
    dressModelId: 366,
    sizeText: '02',
    quantity: 1
  };
  
  const sizeData = availability.find(s => s.sizeText === req.sizeText || s.size === req.sizeText);
  let availableQty = sizeData ? (sizeData.availableQuantity || 0) : 0;
  
  console.log("Found availableQty:", availableQty);
  if (availableQty < req.quantity) {
    console.log("ERROR: NOT IN STOCK!");
  } else {
    console.log("OK: IN STOCK!");
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
