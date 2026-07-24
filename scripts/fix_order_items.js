
const xlsx = require('xlsx');
const path = require('path');

import prisma from '@/app/lib/prisma';
const outDir = path.resolve(__dirname, '../../csv_exports');

function readExcelTable(tableName) {
  const filePath = path.join(outDir, `${tableName}.xlsx`);
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } catch (err) {
    console.error(`Could not read ${filePath}`);
    return [];
  }
}

async function main() {
  console.log('Fixing OrderItem data...');

  // 1. Delete all existing OrderItem records
  console.log('Deleting existing OrderItems...');
  await prisma.orderItem.deleteMany({});
  
  // 2. Read the OrderItems from Excel
  console.log('Reading Excel data...');
  const orderItems = readExcelTable('הזמנות_פרטים');
  console.log(`Found ${orderItems.length} rows in Excel.`);
  
  // 2.5 Fetch all existing orderIds
  console.log('Fetching existing orders to validate foreign keys...');
  const existingOrders = await prisma.order.findMany({ select: { orderId: true } });
  const validOrderIds = new Set(existingOrders.map(o => o.orderId));
  console.log(`Found ${validOrderIds.size} valid orders in database.`);

  let inserted = 0;
  let skipped = 0;
  
  // Prepare batch insert
  const batch = [];
  
  for (const i of orderItems) {
    if (i['מחוק'] === true || i['מחוק'] === 1 || String(i['מחוק']) === 'Yes') {
      skipped++;
      continue;
    }
    if (!i['קוד_הזמנה'] || !validOrderIds.has(i['קוד_הזמנה'])) {
      skipped++;
      continue;
    }
    
    batch.push({
      orderId: i['קוד_הזמנה'],
      dressItemId: null, // IDs changed during migration, setting to null to avoid FK error
      quantity: i['כמות'] || 1,
      description: (i['פירוט_תיקון'] ? String(i['פירוט_תיקון']) : '') + (i['בר_קוד_קידומת'] ? ` (קידומת: ${i['בר_קוד_קידומת']})` : ''),
      sizeText: i['מידה'] ? String(i['מידה']) : null,
      neckAlteration: i['תיקון_צוואר'] ? 1 : 0,
      sleeveAlteration: i['תיקון_שרוול'] ? 1 : 0,
      lengthAlteration: i['תיקון_אורך'] ? String(i['תיקון_אורך']) : null,
      alterationDetails: i['פירוט_תיקון'] ? String(i['פירוט_תיקון']) : null,
      alterationDone: i['בוצע_תיקון'] === true || i['בוצע_תיקון'] === 1,
      barcode: i['ברקוד'] ? String(i['ברקוד']) : null,
      barcodePrefix: i['בר_קוד_קידומת'] ? parseInt(i['בר_קוד_קידומת']) : null,
      isTaken: i['נלקח'] === true || i['נלקח'] === 1,
      isReturned: i['הוחזר'] === true || i['הוחזר'] === 1,
      returnedOk: i['חזר_תקין'] === true || i['חזר_תקין'] === 1,
      isDeleted: false
    });
  }
  
  console.log(`Prepared ${batch.length} valid order items for insertion.`);
  
  // Insert in chunks, but if a chunk fails, insert one by one to isolate the error
  const chunkSize = 2000;
  for (let idx = 0; idx < batch.length; idx += chunkSize) {
    const chunk = batch.slice(idx, idx + chunkSize);
    try {
      await prisma.orderItem.createMany({ data: chunk });
      inserted += chunk.length;
      console.log(`Inserted ${inserted} items...`);
    } catch (err) {
      console.log(`Chunk failed. Inserting row by row for this chunk...`);
      for (const item of chunk) {
        try {
          await prisma.orderItem.create({ data: item });
          inserted++;
        } catch (innerErr) {
          skipped++;
        }
      }
      console.log(`Finished chunk. Total inserted so far: ${inserted}`);
    }
  }
  
  console.log(`Done! Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
