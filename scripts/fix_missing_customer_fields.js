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
    console.error(`Warning: Could not read table ${tableName} at ${filePath}`);
    return [];
  }
}

async function main() {
  console.log('Starting to update missing customer fields...');
  const customers = readExcelTable('לקוחות');
  let count = 0;
  for (const c of customers) {
    if (!c['קוד_לקוח']) continue;

    let houseNum = null;
    if (c['בית']) {
      const parsed = parseInt(c['בית'], 10);
      if (!isNaN(parsed)) {
        houseNum = parsed;
      }
    }

    try {
      await prisma.customer.update({
        where: { id: c['קוד_לקוח'] },
        data: {
          phone2: c['טלפון_2'] ? String(c['טלפון_2']) : null,
          street: c['רחוב'] ? String(c['רחוב']) : null,
          houseNum: houseNum,
          emailSuffix: c['סיומת_מייל'] ? String(c['סיומת_מייל']) : null,
          notes: c['הערות'] ? String(c['הערות']) : null,
          registrationDate: c['תאריך_רישום'] ? String(c['תאריך_רישום']) : null,
        }
      });
      count++;
    } catch (err) {
      // Ignored if customer not found in db
    }
  }
  console.log(`Updated ${count} customers with missing fields.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
