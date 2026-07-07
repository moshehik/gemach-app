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
  if (typeof serial === 'string') {
    const parsed = new Date(serial);
    if (!isNaN(parsed)) return parsed;
    return null;
  }
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

async function main() {
  console.log('Starting migration for Payments from הזמנות_תשלום_ביצוע.xlsx...');
  const payments = readExcelTable('הזמנות_תשלום_ביצוע');

  console.log(`Loaded ${payments.length} payments.`);

  const validOrders = await prisma.order.findMany({
    select: { orderId: true, customerId: true }
  });
  
  const orderMap = new Map();
  for (const o of validOrders) {
    orderMap.set(o.orderId, o.customerId);
  }

  // Clear existing payments to avoid duplicates if run multiple times
  console.log('Cleaning existing Payment records...');
  await prisma.payment.deleteMany({});

  const paymentBatch = [];
  
  for (const p of payments) {
    const orderId = p['קוד_הזמנה'];
    if (!orderId || !orderMap.has(orderId)) continue;
    
    paymentBatch.push({
      orderId: orderId,
      customerId: orderMap.get(orderId),
      amount: p['סכום'] ? parseFloat(p['סכום']) : 0,
      paymentDate: p['תאריך_תשלום'] ? excelDateToJSDate(p['תאריך_תשלום']) || new Date() : new Date(),
      paymentMethod: p['צורת_תשלום'] ? String(p['צורת_תשלום']) : null,
      notes: [
        p['הערות'] ? String(p['הערות']) : '',
        p['מס_אישור'] ? `מס_אישור: ${p['מס_אישור']}` : '',
        p['הערות_מערכת'] ? `מערכת: ${p['הערות_מערכת']}` : ''
      ].filter(Boolean).join(' | '),
      isDeleted: false
    });
  }

  let count = 0;
  for (let i = 0; i < paymentBatch.length; i += 2000) {
    const chunk = paymentBatch.slice(i, i + 2000);
    await prisma.payment.createMany({ data: chunk, skipDuplicates: true });
    count += chunk.length;
    console.log(`Inserted ${count} / ${paymentBatch.length} payments...`);
  }

  console.log('Payments migration completed successfully!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
