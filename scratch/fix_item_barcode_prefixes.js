const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

async function main() {
  console.log("Starting fix for DressItem barcodePrefixes...");
  
  // Read xlsx
  const workbook = xlsx.readFile('c:/Users/moshe/Desktop/גמח שמלות חדש/csv_exports/שמלות_נתונים.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  let updatedCount = 0;
  
  for (const row of data) {
    const accessId = row['קוד']; // Access ID
    let barcodePrefix = row['בר_קוד_קידומת'];
    let barcode = row['בר_קוד_שמלה'];
    
    if (accessId == null || barcodePrefix == null) continue;
    
    barcodePrefix = parseInt(barcodePrefix, 10);
    if (isNaN(barcodePrefix)) continue;
    
    // We assume the SQLite DressItem table kept the Access ID as its primary key ID
    // or maybe the import script set id = קוד
    const item = await prisma.dressItem.findUnique({
      where: { id: parseInt(accessId, 10) }
    });
    
    if (item) {
      await prisma.dressItem.update({
        where: { id: item.id },
        data: { 
          barcodePrefix: barcodePrefix,
          dressBarcode: barcode ? String(barcode) : null
        }
      });
      updatedCount++;
    }
  }
  
  console.log(`Successfully updated ${updatedCount} DressItems with their barcodePrefix!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
