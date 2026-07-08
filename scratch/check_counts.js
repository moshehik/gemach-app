const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const models = await prisma.dressModel.findMany({ select: { entryDateToRepo: true } });
  const counts = {};
  models.forEach(m => {
    const date = m.entryDateToRepo ? m.entryDateToRepo.toISOString().split('T')[0] : 'null';
    counts[date] = (counts[date] || 0) + 1;
  });
  console.log("Model dates:", counts);
  
  const items = await prisma.dressItem.findMany({ select: { entryDateToRepo: true } });
  const itemCounts = {};
  items.forEach(m => {
    const date = m.entryDateToRepo ? m.entryDateToRepo.toISOString().split('T')[0] : 'null';
    itemCounts[date] = (itemCounts[date] || 0) + 1;
  });
  console.log("Item dates:", itemCounts);
  
  // also what happens when we parse a number date in migrate?
  // Let's read the first 10 dates from the excel files
  const xlsx = require('xlsx');
  const path = require('path');
  const outDir = path.resolve(__dirname, '../../csv_exports');
  
  const wb = xlsx.readFile(path.join(outDir, 'שמלות_דגמים.xlsx'));
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log("Excel model dates:", data.map(d => d['תאריך_כניסה_למאגר']).slice(0, 10));
}
run();
