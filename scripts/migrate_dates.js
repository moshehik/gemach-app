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
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    return data;
  } catch (err) {
    console.error(`Warning: Could not read table ${tableName} at ${filePath}`);
    return [];
  }
}

// Helper to convert Excel date (serial number) to JS Date
function excelDateToJSDate(serial) {
  if (!serial) return null;
  // Excel dates are days since Dec 30, 1899
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);

  const fractional_day = serial - Math.floor(serial) + 0.0000001;

  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;

  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;

  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

async function run() {
  const ordersData = readExcelTable('הזמנות');
  let count = 0;
  for (const o of ordersData) {
    if (!o['קוד_הזמנה']) continue;

    const hebrewDate = o['תאריך_אירוע'] ? String(o['תאריך_אירוע']) : null;
    let jsDate = null;
    if (o['תאריך_אירוע_לועזי'] || o['מתאריך']) {
      jsDate = excelDateToJSDate(o['תאריך_אירוע_לועזי'] || o['מתאריך']);
    }
    let jsReturnDate = null;
    if (o['עד_תאריך']) {
      jsReturnDate = excelDateToJSDate(o['עד_תאריך']);
    }

    if (hebrewDate || jsDate || jsReturnDate) {
      try {
        await prisma.order.updateMany({
          where: { orderId: o['קוד_הזמנה'] },
          data: {
            eventDateHebrew: hebrewDate,
            eventDate: jsDate,
            returnDate: jsReturnDate
          }
        });
        count++;
      } catch (err) {
        // order not found or error
      }
    }
  }
  console.log(`Updated dates for ${count} orders.`);
  await prisma.$disconnect();
}

run();
