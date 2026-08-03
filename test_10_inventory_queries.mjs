import { getAvailableInventory } from './lib/inventory_test.js';
import prisma from './lib/prisma_mock.js';

async function test10Queries() {
  console.log('--- RUNNING 10 INVENTORY QUERIES TO VERIFY CORRECTNESS ---');
  
  // Pick 5 random dress models that have inventory
  const items = await prisma.dressItem.findMany({
    where: { notInUse: false, isDeleted: false, quantity: { gt: 0 } },
    take: 50,
    select: { dressModelId: true }
  });
  
  const uniqueModels = [...new Set(items.map(i => i.dressModelId).filter(Boolean))].slice(0, 5);
  if (uniqueModels.length === 0) {
    console.log('No valid models found to test.');
    return;
  }
  
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + 30); // 30 days in future
  
  const queries = [
    { desc: "Query 1: Normal event, 30 days from now, default spacing", model: uniqueModels[0], date: baseDate, isAbroad: false, customSpacing: null },
    { desc: "Query 2: Normal event, 35 days from now, default spacing", model: uniqueModels[1] || uniqueModels[0], date: new Date(baseDate.getTime() + 5*86400000), isAbroad: false, customSpacing: null },
    { desc: "Query 3: Abroad event (7 days), starting 40 days from now", model: uniqueModels[2] || uniqueModels[0], date: new Date(baseDate.getTime() + 10*86400000), endDate: new Date(baseDate.getTime() + 17*86400000), isAbroad: true, customSpacing: null },
    { desc: "Query 4: Custom spacing = 0 (no buffer), 30 days from now", model: uniqueModels[0], date: baseDate, isAbroad: false, customSpacing: 0 },
    { desc: "Query 5: Custom spacing = 1 (small buffer), 35 days from now", model: uniqueModels[1] || uniqueModels[0], date: new Date(baseDate.getTime() + 5*86400000), isAbroad: false, customSpacing: 1 },
    { desc: "Query 6: Custom spacing = 4 (large buffer), 45 days from now", model: uniqueModels[3] || uniqueModels[0], date: new Date(baseDate.getTime() + 15*86400000), isAbroad: false, customSpacing: 4 },
    { desc: "Query 7: Abroad event with custom spacing = 0", model: uniqueModels[2] || uniqueModels[0], date: new Date(baseDate.getTime() + 10*86400000), endDate: new Date(baseDate.getTime() + 17*86400000), isAbroad: true, customSpacing: 0 },
    { desc: "Query 8: Normal event, 60 days from now", model: uniqueModels[4] || uniqueModels[0], date: new Date(baseDate.getTime() + 30*86400000), isAbroad: false, customSpacing: null },
    { desc: "Query 9: Far future event (120 days from now)", model: uniqueModels[0], date: new Date(baseDate.getTime() + 90*86400000), isAbroad: false, customSpacing: null },
    { desc: "Query 10: Same model as Q1 but different date to verify distinct booking checks", model: uniqueModels[0], date: new Date(baseDate.getTime() + 3*86400000), isAbroad: false, customSpacing: null }
  ];

  let successCount = 0;
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`\n--- ${q.desc} ---`);
    try {
      const result = await getAvailableInventory(
        q.model,
        q.date, // minDate
        3, // default bufferDays
        true, // skipWeekends
        q.isAbroad,
        q.endDate || q.date, // maxDate
        null, // ignoreOrderId
        q.customSpacing
      );
      
      console.log(`Model ID: ${q.model}, isAbroad: ${q.isAbroad}, customSpacing: ${q.customSpacing}`);
      console.log(`Date: ${q.date.toISOString().split('T')[0]}` + (q.endDate ? ` to ${q.endDate.toISOString().split('T')[0]}` : ''));
      console.log(`Result sizes: ${result.length}`);
      if (result.length > 0) {
        // Just print the first size to keep logs short
        console.log(`Sample size: ${result[0].sizeText}, Total: ${result[0].totalInStock}, Available: ${result[0].availableQuantity}`);
      }
      successCount++;
    } catch (e) {
      console.error(`Error in Query ${i+1}:`, e.message);
    }
  }

  console.log(`\n--- TEST COMPLETE: ${successCount}/10 QUERIES SUCCEEDED ---`);
}

test10Queries().catch(console.error).finally(() => prisma.$disconnect());
