const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

function isTrue(val) {
  return val === true || val === 1 || String(val).toLowerCase() === 'yes' || String(val) === '1';
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

async function main() {
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

  console.log('Loading Excel data...');
  const orders = readExcelTable('הזמנות');
  const actualPayments = readExcelTable('הזמנות_תשלום_ביצוע');

  const validOrderIds = new Set((await prisma.order.findMany({ select: { orderId: true } })).map(o => o.orderId));
  const validCustomerIds = new Set((await prisma.customer.findMany({ select: { id: true } })).map(c => c.id));

  console.log('Updating isPaid status for orders...');
  const updates = [];
  for (const o of orders) {
    if (!o['קוד_הזמנה']) continue;
    if (isTrue(o['שולם'])) {
      updates.push(prisma.order.update({
        where: { orderId: o['קוד_הזמנה'] },
        data: { isPaid: true }
      }).catch(() => {})); 
    }
  }
  for (let i = 0; i < updates.length; i += 500) {
    await Promise.all(updates.slice(i, i + 500));
    console.log(`Updated isPaid for ${Math.min(i + 500, updates.length)} orders`);
  }

  console.log('Clearing old Payment table...');
  await prisma.payment.deleteMany({});

  console.log('Inserting actual payments...');
  const actualPaymentBatch = [];
  for (const p of actualPayments) {
    if (!p['קוד_הזמנה'] || !validOrderIds.has(p['קוד_הזמנה'])) continue;
    
    const customerId = orders.find(o => o['קוד_הזמנה'] === p['קוד_הזמנה'])?.['קוד_לקוח'];
    
    actualPaymentBatch.push({
      orderId: p['קוד_הזמנה'],
      customerId: (customerId && validCustomerIds.has(parseInt(customerId))) ? parseInt(customerId) : null,
      amount: p['סכום'] ? parseFloat(p['סכום']) : 0,
      paymentDate: p['תאריך_תשלום'] ? excelDateToJSDate(p['תאריך_תשלום']) : new Date(),
      paymentMethod: p['צורת_תשלום'] ? String(p['צורת_תשלום']) : null,
      notes: p['הערות'] ? String(p['הערות']) : null,
      isDeleted: false
    });
  }

  let count = 0;
  for (let i = 0; i < actualPaymentBatch.length; i += 2000) {
    const chunk = actualPaymentBatch.slice(i, i + 2000);
    await prisma.payment.createMany({ data: chunk });
    count += chunk.length;
    console.log(`Inserted ${count} / ${actualPaymentBatch.length} actual payments...`);
  }

  console.log('Done!');
}

main().finally(() => prisma.$disconnect());
