
const xlsx = require('xlsx');
const path = require('path');
const hebcal = require('hebcal');

import prisma from '@/app/lib/prisma';
const outDir = path.resolve(__dirname, '../../csv_exports');

const HEB_MONTHS = {
  'תשרי': 'Tishrei', 'חשוון': 'Cheshvan', 'מרחשון': 'Cheshvan', 'כסלו': 'Kislev',
  'טבת': 'Tevet', 'שבט': 'Sh\'vat', 'אדר': 'Adar', 'אדר א': 'Adar I', 'אדר ב': 'Adar II', 'אדר א\'': 'Adar I', 'אדר ב\'': 'Adar II',
  'ניסן': 'Nisan', 'אייר': 'Iyyar', 'סיון': 'Sivan', 'תמוז': 'Tamuz', 'אב': 'Av', 'אלול': 'Elul'
};

function hebrewToNumber(str) {
  const vals = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
    'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90, 'ק': 100,
    'ר': 200, 'ש': 300, 'ת': 400
  };
  let sum = 0;
  for(let char of str) {
    if(vals[char]) sum += vals[char];
  }
  return sum;
}

function parseHebrewDate(str) {
  if (!str) return null;
  const parts = str.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const yearStr = parts[parts.length - 1];
  let year = hebrewToNumber(yearStr);
  if (year < 1000) year += 5000;
  
  let dayStr = parts[0].replace(/["']/g, '');
  let day = hebrewToNumber(dayStr);
  
  let monthStr = parts.slice(1, parts.length - 1).join(' ').replace(/["']/g, '');
  let month = HEB_MONTHS[monthStr] || 'Tishrei';
  
  try {
    const hd = new hebcal.HDate(day, month, year);
    return hd.greg();
  } catch(e) {
    return null;
  }
}

function parseAnyDate(val) {
  if (!val) return null;
  if (!isNaN(Number(val))) {
    // Excel date
    return new Date((Number(val) - (25567 + 2)) * 86400 * 1000);
  }
  if (typeof val === 'string' && /[א-ת]/.test(val)) {
    return parseHebrewDate(val);
  }
  if (typeof val === 'string') {
    const parts = val.split('/');
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function readExcelTable(tableName) {
  const filePath = path.join(outDir, `${tableName}.xlsx`);
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } catch (err) {
    console.error(`Could not read ${filePath}`);
    return [];
  }
}

async function run() {
  console.log('Updating DressItems with correct dates...');
  const items = readExcelTable('שמלות_נתונים');
  
  let count = 0;
  let batch = [];
  
  for (const item of items) {
    const id = item['קוד'];
    if (!id) continue;
    
    const entryDate = parseAnyDate(item['תאריך_כניסה_למאגר']);
    const notInUseSince = parseAnyDate(item['לא_בשימוש_מתאריך']);
    
    if (entryDate || notInUseSince) {
      batch.push(
        prisma.dressItem.updateMany({
          where: { id: id },
          data: {
            entryDateToRepo: entryDate,
            notInUseSince: notInUseSince
          }
        })
      );
      count++;
      
      if (batch.length >= 100) {
         try {
           await Promise.all(batch);
           console.log(`Updated ${count} items so far...`);
         } catch(e) { console.error('Batch error:', e.message); }
         batch = [];
      }
    }
  }
  
  if (batch.length > 0) {
     try {
       await Promise.all(batch);
     } catch(e) {}
  }
  
  console.log(`Updated dates for ${count} dress items.`);
  
  // Optionally do models too?
  console.log('Updating DressModels with correct dates...');
  const models = readExcelTable('שמלות_דגמים');
  let mCount = 0;
  batch = [];
  
  for (const m of models) {
    const id = m['קוד_שמלה'];
    if (!id) continue;
    const entryDate = parseAnyDate(m['תאריך_כניסה_למאגר']);
    const exitDate = parseAnyDate(m['תאריך_יציאה_מהמאגר']);
    
    if (entryDate || exitDate) {
      batch.push(
        prisma.dressModel.updateMany({
          where: { id: id },
          data: {
            entryDateToRepo: entryDate,
            exitDateFromRepo: exitDate
          }
        })
      );
      mCount++;
      
      if (batch.length >= 50) {
         try {
           await Promise.all(batch);
         } catch(e) {}
         batch = [];
      }
    }
  }
  
  if (batch.length > 0) {
     try {
       await Promise.all(batch);
     } catch(e) {}
  }
  
  console.log(`Updated dates for ${mCount} dress models.`);
  
  await prisma.$disconnect();
}

run().catch(console.error);
