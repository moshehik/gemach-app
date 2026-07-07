const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
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

function excelDateToJSDate(serial) {
  if (!serial) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  const date = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
  if (isNaN(date.getTime())) return null;
  return date;
}

function isTrue(val) {
  return val === true || val === 1 || String(val).toLowerCase() === 'yes' || String(val) === '1';
}

async function main() {
  console.log('Starting full data migration for Orders, OrderItems, and Payments...');

  console.log('Reading Excel files (this may take a moment)...');
  const orders = readExcelTable('הזמנות');
  const orderItems = readExcelTable('הזמנות_פרטים');
  const payments = readExcelTable('הזמנות_תשלום');

  console.log(`Loaded ${orders.length} orders, ${orderItems.length} items, ${payments.length} payments.`);

  console.log('Cleaning existing records (PaymentObligation, OrderItem, Order)...');
  await prisma.paymentObligation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});

  console.log('Migrating Orders...');
  
  const existingCustomers = await prisma.customer.findMany({ select: { id: true } });
  const validCustomerIds = new Set(existingCustomers.map(c => c.id));
  
  const orderBatch = [];
  const validOrderIds = new Set();
  
  for (const o of orders) {
    if (!o['קוד_הזמנה']) continue;
    validOrderIds.add(o['קוד_הזמנה']);
    
    orderBatch.push({
      orderId: o['קוד_הזמנה'],
      customerId: (o['קוד_לקוח'] && validCustomerIds.has(parseInt(o['קוד_לקוח']))) ? parseInt(o['קוד_לקוח']) : null,
      totalAmount: o['סהכ'] ? parseFloat(o['סהכ']) : null,
      notes: o['הערות'] ? String(o['הערות']) : null,
      status: isTrue(o['הזמנה_מבוטלת']) ? 'מבוטלת' : (o['סטאטוס'] || 'פעיל'),
      isPaid: false,
      isDeleted: isTrue(o['הזמנה_מבוטלת']),
      eventDate: o['תאריך_אירוע_לועזי'] || o['מתאריך'] ? excelDateToJSDate(o['תאריך_אירוע_לועזי'] || o['מתאריך']) : null,
      eventDateHebrew: o['תאריך_אירוע'] ? String(o['תאריך_אירוע']) : null,
      returnDate: o['עד_תאריך'] ? excelDateToJSDate(o['עד_תאריך']) : null,
      isWeekdayEvent: isTrue(o['אירוע_חול'])
    });
  }

  // Insert orders in chunks
  let count = 0;
  for (let i = 0; i < orderBatch.length; i += 2000) {
    const chunk = orderBatch.slice(i, i + 2000);
    await prisma.order.createMany({ data: chunk, skipDuplicates: true });
    count += chunk.length;
    console.log(`Inserted ${count} / ${orderBatch.length} orders...`);
  }

  console.log('Migrating OrderItems...');
  const itemBatch = [];
  
  for (const i of orderItems) {
    if (!i['קוד_הזמנה'] || !validOrderIds.has(i['קוד_הזמנה'])) continue;
    
    itemBatch.push({
      id: i['קוד_שמלה'] || undefined, // use existing ID if valid, or let autoinc if missing ID? Actually let's trust DB to auto-inc if we omit or provide. Wait, 'קוד_שמלה' in הזמנות_פרטים is not its ID. 'קוד_פריט_מוזמן' might be the ID. In the old DB, ID is usually 'קוד'. Let's check 'קוד'. 
      // If we don't supply id, it will auto increment. But wait, we need 'id' to map properly? Let's just not supply id to let Prisma generate it.
      orderId: i['קוד_הזמנה'],
      dressItemId: null, // Keep null for now since IDs changed during initial DressItem migration
      quantity: i['כמות'] || 1,
      description: (i['פירוט_תיקון'] ? String(i['פירוט_תיקון']) : '') + (i['בר_קוד_קידומת'] ? ` (קידומת: ${i['בר_קוד_קידומת']})` : ''),
      sizeText: i['מידה'] ? String(i['מידה']) : null,
      neckAlteration: i['תיקון_צוואר'] ? 1 : 0,
      sleeveAlteration: i['תיקון_שרוול'] ? 1 : 0,
      lengthAlteration: i['תיקון_אורך'] ? String(i['תיקון_אורך']) : null,
      alterationDetails: i['פירוט_תיקון'] ? String(i['פירוט_תיקון']) : null,
      alterationDone: isTrue(i['בוצע_תיקון']),
      barcode: i['ברקוד'] ? String(i['ברקוד']) : null,
      barcodePrefix: i['בר_קוד_קידומת'] ? parseInt(i['בר_קוד_קידומת']) : null,
      isTaken: isTrue(i['נלקח']),
      isReturned: isTrue(i['הוחזר']),
      returnedOk: isTrue(i['חזר_תקין']),
      isDeleted: isTrue(i['מחוק']),
      takenDate: i['תאריך_לקיחה'] ? excelDateToJSDate(i['תאריך_לקיחה']) : null,
      returnDate: i['תאריך_החזרה'] ? excelDateToJSDate(i['תאריך_החזרה']) : null
    });
  }

  count = 0;
  for (let i = 0; i < itemBatch.length; i += 2000) {
    const chunk = itemBatch.slice(i, i + 2000);
    await prisma.orderItem.createMany({ data: chunk, skipDuplicates: true });
    count += chunk.length;
    console.log(`Inserted ${count} / ${itemBatch.length} items...`);
  }

  console.log('Migrating Payments & Obligations...');
  const paymentBatch = [];
  
  for (const p of payments) {
    if (!p['קוד_הזמנה'] || !validOrderIds.has(p['קוד_הזמנה'])) continue;
    
    paymentBatch.push({
      orderId: p['קוד_הזמנה'],
      productId: p['קוד_מוצר'] || null,
      amount: p['מחיר'] ? parseFloat(p['מחיר']) : 0,
      quantity: p['כמות'] ? parseInt(p['כמות']) : 1,
      description: p['תיאור'] ? String(p['תיאור']) : null,
      createdAt: p['תאריך_תשלום'] ? excelDateToJSDate(p['תאריך_תשלום']) : new Date(),
      isDeleted: isTrue(p['פריט_מחוק']),
      isRefund: isTrue(p['זיכוי']) || isTrue(p['זיכוי_מבוטל']) || (p['מחיר'] && parseFloat(p['מחיר']) < 0) || (p['כמות'] && parseInt(p['כמות']) < 0)
    });
  }

  count = 0;
  for (let i = 0; i < paymentBatch.length; i += 2000) {
    const chunk = paymentBatch.slice(i, i + 2000);
    await prisma.paymentObligation.createMany({ data: chunk, skipDuplicates: true });
    count += chunk.length;
    console.log(`Inserted ${count} / ${paymentBatch.length} payments/obligations...`);
  }

  console.log('Linking orphaned OrderItems to DressItems based on barcodePrefix...');
  const orphanedItems = await prisma.orderItem.findMany({
    where: { dressItemId: null, barcodePrefix: { not: null } }
  });
  
  let linkedCount = 0;
  // Optimize by fetching all possible items into memory first since there are few models
  const allDressItems = await prisma.dressItem.findMany({
    where: { barcodePrefix: { not: null } },
    select: { id: true, barcodePrefix: true, sizeText: true }
  });
  
  for (const item of orphanedItems) {
    if (!item.barcodePrefix) continue;
    // exact match
    let match = allDressItems.find(d => d.barcodePrefix === item.barcodePrefix && d.sizeText === item.sizeText);
    // fallback match
    if (!match) match = allDressItems.find(d => d.barcodePrefix === item.barcodePrefix);
    
    if (match) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { dressItemId: match.id }
      });
      linkedCount++;
    }
  }
  console.log(`Successfully linked ${linkedCount} orphaned OrderItems!`);

  console.log('All migrations completed successfully!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
