
const xlsx = require('xlsx');
const path = require('path');
import prisma from '@/app/lib/prisma';

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

async function migrate() {
  const filePath = path.join(__dirname, '../../csv_exports/הזמנות.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const orders = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  console.log(`Loaded ${orders.length} orders from Excel.`);
  let updatedCount = 0;

  for (const o of orders) {
    if (!o['קוד_הזמנה']) continue;
    
    const orderId = parseInt(o['קוד_הזמנה']);
    const employeeId = o['קוד_עובד'] ? parseInt(o['קוד_עובד']) : null;
    const deletedAt = o['תאריך_מחיקה'] ? excelDateToJSDate(o['תאריך_מחיקה']) : null;
    
    if (employeeId !== null || deletedAt !== null) {
      try {
        await prisma.order.updateMany({
          where: { orderId: orderId },
          data: {
            employeeId: employeeId,
            deletedAt: deletedAt
          }
        });
        updatedCount++;
        if (updatedCount % 1000 === 0) console.log(`Updated ${updatedCount} orders...`);
      } catch (err) {
        // Continue
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} orders with employeeId and deletedAt.`);
  await prisma.$disconnect();
}

migrate().catch(console.error);
