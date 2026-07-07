const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const outDir = path.resolve(__dirname, '../../csv_exports');

function readExcelTable(tableName) {
  const filePath = path.join(outDir, tableName + '.xlsx');
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } catch (err) {
    console.error(`Warning: Could not read table ${tableName} at ${filePath}`);
    return [];
  }
}

function parseExcelDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function migrateOrderDates() {
  console.log('Starting order dates migration...');
  try {
    let orders = readExcelTable('הזמנות');

    let orderCount = 0;
    
    for (const o of orders) {
      const orderId = o['קוד_הזמנה'];
      if (!orderId) continue;
      
      const orderDate = parseExcelDate(o['תאריך_הזמנה']);
      if (!orderDate) continue;

      try {
        await prisma.order.update({
          where: { orderId: orderId },
          data: {
            orderDate: orderDate,
          }
        });
        orderCount++;
      } catch (err) {
        if (err.code !== 'P2025') {
          console.error(`Error updating order ${orderId}:`, err.message);
        }
      }
      
      if (orderCount % 1000 === 0) console.log(`Updated ${orderCount} orders`);
    }
    
    console.log(`Successfully updated ${orderCount} orders with orderDate.`);
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateOrderDates();
