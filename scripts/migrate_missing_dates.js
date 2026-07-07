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

// Access stores dates usually as numbers (Excel serial date) or string depending on export
function parseExcelDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    // Excel date to JS date
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function migrateData() {
  console.log('Starting missing dates migration...');
  try {
    // We try to read the large table first
    let orders = readExcelTable('הזמנות_מלא');
    if (orders.length === 0) {
      orders = readExcelTable('הזמנות');
    }
    if (orders.length === 0) {
       orders = readExcelTable('הזמנות_מלא_פעילים_2');
    }

    let orderCount = 0;
    
    for (const o of orders) {
      // Access order ID is usually "קוד_הזמנה"
      const orderId = o['קוד_הזמנה'];
      if (!orderId) continue;
      
      const isAbroad = o['אירוע_חול'] === true || o['אירוע_חול'] === 1 || String(o['אירוע_חול']) === 'Yes';
      const eventDate = parseExcelDate(o['תאריך_אירוע_לועזי'] || o['מתאריך']);
      const returnDate = parseExcelDate(o['עד_תאריך']);
      
      try {
        await prisma.order.update({
          where: { orderId: orderId },
          data: {
            eventDate: eventDate,
            returnDate: returnDate,
            isWeekdayEvent: isAbroad, // Using this field for 'Abroad Event'
          }
        });
        orderCount++;
      } catch (err) {
        // Record might not exist if it was deleted, just ignore
        if (err.code !== 'P2025') {
          console.error(`Error updating order ${orderId}:`, err.message);
        }
      }
      
      if(orderCount % 1000 === 0) console.log(`Updated ${orderCount} orders`);
    }
    
    console.log(`Successfully updated ${orderCount} orders with missing dates.`);
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
