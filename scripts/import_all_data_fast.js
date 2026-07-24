
const xlsx = require('xlsx');
const path = require('path');
const hebcal = require('hebcal');

import prisma from '@/app/lib/prisma';
const outDir = path.resolve(__dirname, '../../csv_exports');

function isTrue(val) { return val === true || val === 'true' || val === 1 || val === '1'; }
function excelDateToJSDate(serial) { if (!serial) return null; const msPerDay = 86400000; const epoch = new Date(1899, 11, 30).getTime(); return new Date(epoch + serial * msPerDay); }

async function main() {
  console.log('Reading Excel files...');
  const itemsFile = path.join(outDir, 'הזמנות_פרטים.xlsx');
  const itemsObj = xlsx.readFile(itemsFile);
  const items = xlsx.utils.sheet_to_json(itemsObj.Sheets[itemsObj.SheetNames[0]]);
  
  const pFile = path.join(outDir, 'הזמנות_תשלום.xlsx');
  const pObj = xlsx.readFile(pFile);
  const payments = xlsx.utils.sheet_to_json(pObj.Sheets[pObj.SheetNames[0]]);
  
  console.log(`Loaded ${items.length} items, ${payments.length} obligations.`);
  
  const validOrderIds = new Set();
  const dbOrders = await prisma.order.findMany({ select: { orderId: true } });
  for (const o of dbOrders) validOrderIds.add(o.orderId);

  const dbItems = await prisma.orderItem.findMany({ select: { id: true } });
  const validOrderItemIds = new Set(dbItems.map(i => i.id));
  
  console.log('Cleaning existing PaymentObligations...');
  await prisma.paymentObligation.deleteMany();

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
      isRefund: isTrue(p['זיכוי']) || isTrue(p['זיכוי_מבוטל']) || (p['מחיר'] && parseFloat(p['מחיר']) < 0) || (p['כמות'] && parseInt(p['כמות']) < 0),
      orderItemId: (p['קוד_פריט'] && validOrderItemIds.has(parseInt(p['קוד_פריט']))) ? parseInt(p['קוד_פריט']) : null
    });
  }

  let count = 0;
  for (let i = 0; i < paymentBatch.length; i += 2000) {
    const chunk = paymentBatch.slice(i, i + 2000);
    await prisma.paymentObligation.createMany({ data: chunk });
    count += chunk.length;
    console.log(`Inserted ${count} / ${paymentBatch.length} obligations...`);
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
