const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

async function main() {
  console.log("Starting fix for DressModel barcodePrefixes...");
  
  // Read xlsx
  const workbook = xlsx.readFile('c:/Users/moshe/Desktop/גמח שמלות חדש/csv_exports/שמלות_דגמים.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  let updatedCount = 0;
  
  for (const row of data) {
    const dressName = row['שם_שמלה'];
    let barcodePrefix = row['בר_קוד_קידומת'];
    
    if (!dressName || barcodePrefix == null) continue;
    
    // Parse it as an integer just in case
    barcodePrefix = parseInt(barcodePrefix, 10);
    if (isNaN(barcodePrefix)) continue;
    
    // Find model by name
    const model = await prisma.dressModel.findFirst({
      where: { name: dressName }
    });
    
    if (model) {
      await prisma.dressModel.update({
        where: { id: model.id },
        data: { barcodePrefix: barcodePrefix }
      });
      updatedCount++;
    }
  }
  
  console.log(`Successfully updated ${updatedCount} DressModels with their barcodePrefix!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
