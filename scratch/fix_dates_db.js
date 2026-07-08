const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const outDir = path.resolve(__dirname, '../../csv_exports');

async function fixDates() {
  console.log("Reading Excel file to find models with empty entry dates...");
  const filePath = path.join(outDir, 'שמלות_דגמים.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const models = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  let fixedCount = 0;
  
  for (const m of models) {
    // If the entry date is missing in the Excel file
    if (!m['תאריך_כניסה_למאגר']) {
      // Find the model by its prefix or name (this is how it was matched during migration)
      const barcodePrefix = m['בר_קוד_קידומת'] ? parseInt(m['בר_קוד_קידומת'], 10) : null;
      let dbModel = null;
      
      if (barcodePrefix) {
        dbModel = await prisma.dressModel.findFirst({ where: { barcodePrefix } });
      } else if (m['שם_שמלה']) {
        dbModel = await prisma.dressModel.findFirst({ where: { name: m['שם_שמלה'] } });
      }
      
      // If found in DB, set its entryDateToRepo to null
      if (dbModel && dbModel.entryDateToRepo) {
        // Only fix if it currently has a date
        await prisma.dressModel.update({
          where: { id: dbModel.id },
          data: { entryDateToRepo: null }
        });
        fixedCount++;
      }
    }
  }

  console.log(`Successfully fixed ${fixedCount} models that had incorrectly assigned dates.`);
  await prisma.$disconnect();
}

fixDates().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
