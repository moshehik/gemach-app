
const xlsx = require('xlsx');
const path = require('path');

import prisma from '@/app/lib/prisma';

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

async function fixMissingFields() {
  console.log('Starting migration to fix missing fields (serialNumber, dressBarcode, etc.)');
  try {
    const items = readExcelTable('שמלות_נתונים');
    let updatedCount = 0;
    
    for (const item of items) {
      if (!item['קוד']) continue;
      
      const id = item['קוד'];
      const dataToUpdate = {};
      
      if (item['מספר_סידורי'] !== undefined && item['מספר_סידורי'] !== null) {
         dataToUpdate.serialNumber = parseInt(item['מספר_סידורי']);
      }
      if (item['בר_קוד_שמלה'] !== undefined && item['בר_קוד_שמלה'] !== null) {
         dataToUpdate.dressBarcode = String(item['בר_קוד_שמלה']);
      }
      if (item['בר_קוד_קידומת'] !== undefined && item['בר_קוד_קידומת'] !== null) {
         dataToUpdate.barcodePrefix = parseInt(item['בר_קוד_קידומת']);
      }
      if (item['מיקום_מס'] !== undefined && item['מיקום_מס'] !== null) {
         dataToUpdate.locationNum = parseInt(item['מיקום_מס']);
      }
      
      if (Object.keys(dataToUpdate).length > 0) {
        try {
          await prisma.dressItem.updateMany({
             where: { id: id },
             data: dataToUpdate
          });
          updatedCount++;
        } catch (err) {
          console.error(`Could not update item ${id}: ${err.message}`);
        }
      }
    }
    console.log(`Successfully updated ${updatedCount} dress items with missing fields.`);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingFields();
