const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

function convertExcelDate(excelDate) {
    if (!excelDate) return null;
    if (typeof excelDate === 'number') {
        // Excel dates are number of days since Jan 1, 1900.
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        return date;
    }
    return new Date(excelDate);
}

async function main() {
    console.log("Starting PriceList migration...");
    const filePath = path.join(__dirname, '../../csv_exports/מחירים.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Read data as array of objects
    const data = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`Found ${data.length} rows in מחירים.xlsx`);
    
    // Clear existing to avoid duplicates if re-run (optional, but let's just insert)
    await prisma.priceList.deleteMany();
    
    let imported = 0;
    for (const row of data) {
        try {
            await prisma.priceList.create({
                data: {
                    id: row['קוד'] ? parseInt(row['קוד']) : undefined,
                    description: row['תיאור'] ? String(row['תיאור']) : null,
                    fromSize: row['ממידה'] !== undefined ? parseInt(row['ממידה']) : null,
                    toSize: row['עד_מידה'] !== undefined ? parseInt(row['עד_מידה']) : null,
                    price: row['מחיר'] !== undefined ? parseFloat(row['מחיר']) : null,
                    startDate: convertExcelDate(row['תאריך_התחלת_מחיר']),
                    endDate: convertExcelDate(row['תאריך_סיום_מחיר']),
                    category: row['קטגוריה'] ? String(row['קטגוריה']) : null,
                    deposit: row['החזר'] !== undefined ? parseFloat(row['החזר']) : null,
                }
            });
            imported++;
        } catch (e) {
            console.error(`Failed to insert row ID ${row['קוד']}: ${e.message}`);
        }
    }
    
    console.log(`Migration finished. Imported ${imported} price lists.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
