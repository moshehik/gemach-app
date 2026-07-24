
const xlsx = require('xlsx');
const path = require('path');
const hebcal = require('hebcal');

import prisma from '@/app/lib/prisma';
const outDir = path.resolve(__dirname, '../../csv_exports');

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

function isTrue(val) {
  return val === true || val === 1 || String(val).toLowerCase() === 'yes' || String(val) === '1';
}

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

function parseExcelDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
    return new Date((dateStr - (25567 + 2)) * 86400 * 1000);
  }
  if (typeof dateStr === 'string' && /[א-ת]/.test(dateStr)) {
    return parseHebrewDate(dateStr);
  }
  if (typeof dateStr === 'string') {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

async function migrateData() {
  console.log('Starting data migration from Excel exports to SQLite via Prisma...');

  try {
    // 0. Clean up dependent tables first to avoid foreign key constraint errors
    console.log('Cleaning dependent tables (Orders, Payments)...');
    await prisma.payment.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});

    // 1. Migrate Customers
    console.log('Migrating Customers...');
    const customers = readExcelTable('לקוחות');
    await prisma.customer.deleteMany({});
    
    const customerBatch = customers.map(c => {
      let houseNum = null;
      if (c['בית']) {
        const parsed = parseInt(c['בית'], 10);
        if (!isNaN(parsed)) {
          houseNum = parsed;
        }
      }
      return {
        id: c['קוד_לקוח'] || undefined,
        firstName: c['שם_פרטי'],
        lastName: c['שם_משפחה'],
        phone1: c['טלפון_1'],
        phone2: c['טלפון_2'] ? String(c['טלפון_2']) : null,
        city: c['עיר'],
        street: c['רחוב'] ? String(c['רחוב']) : null,
        houseNum: houseNum,
        email: c['מייל'],
        emailSuffix: c['סיומת_מייל'] ? String(c['סיומת_מייל']) : null,
        notes: c['הערות'] ? String(c['הערות']) : null,
        registrationDate: c['תאריך_רישום'] ? String(c['תאריך_רישום']) : null,
        isDeleted: isTrue(c['לקוח_מחוק'])
      };
    });

    let count = 0;
    for (let i = 0; i < customerBatch.length; i += 2000) {
      const chunk = customerBatch.slice(i, i + 2000);
      await prisma.customer.createMany({ data: chunk });
      count += chunk.length;
    }
    console.log(`Successfully migrated ${count} customers.`);

    // 2. Migrate Employees
    console.log('Migrating Employees (Upserting to preserve logs)...');
    const employees = readExcelTable('עובדים');
    
    let empCount = 0;
    for (const e of employees) {
      const empData = {
        firstName: e['שם_פרטי'] || '',
        lastName: e['שם_משפחה'] || '',
        phone1: e['טלפון_1'] || '',
        email: e['מייל'] ? String(e['מייל']) : null,
        emailSuffix: e['סיומת_מייל'] ? String(e['סיומת_מייל']) : null,
        roleId: e['מס_מחלקה'] ? parseInt(e['מס_מחלקה'], 10) : null,
        isActive: !isTrue(e['לא_פעיל'])
      };
      if (e['קוד_עובד']) {
         await prisma.employee.upsert({
           where: { id: e['קוד_עובד'] },
           update: empData,
           create: { id: e['קוד_עובד'], ...empData }
         });
         empCount++;
      }
    }
    console.log(`Successfully migrated ${empCount} employees.`);

    // 3. Migrate Dress Models
    console.log('Migrating Dress Models...');
    const models = readExcelTable('שמלות_דגמים');
    // Important: we need to handle relation deletion if we delete models and items. 
    // Since we delete orderItems and orders in import_all_data, we should be fine here as long as we delete items first.
    await prisma.dressItem.deleteMany({});
    await prisma.dressModel.deleteMany({});
    
    const usedModelNames = new Set();
    const modelBatch = models.map(m => {
      let baseName = m['שם_שמלה'] || `ללא שם - ${m['קוד_שמלה'] || Math.floor(Math.random() * 10000)}`;
      let finalName = baseName;
      let counter = 1;
      while (usedModelNames.has(finalName)) {
        finalName = `${baseName} (${counter})`;
        counter++;
      }
      usedModelNames.add(finalName);
      
      return {
        id: m['קוד_שמלה'] || undefined,
        name: finalName,
        barcodePrefix: m['בר_קוד_קידומת'] ? parseInt(m['בר_קוד_קידומת'], 10) : null,
        priceCategory: m['קטגורית_מחיר'],
        notes: m['הערות'],
        inInspection: isTrue(m['הצג_בבדיקה']),
        entryDateToRepo: parseExcelDate(m['תאריך_כניסה_למאגר']) || null,
        exitDateFromRepo: parseExcelDate(m['תאריך_יציאה_מהמאגר']) || null
      };
    });
    await prisma.dressModel.createMany({ data: modelBatch });
    console.log(`Successfully migrated ${modelBatch.length} dress models.`);

    // 4. Migrate Dress Items
    console.log('Migrating Dress Items...');
    const items = readExcelTable('שמלות_נתונים');
    
    const validModelIds = new Set(modelBatch.map(m => m.id).filter(id => id !== undefined));
    
    const itemBatch = [];
    for(const item of items) {
      const barcodePrefix = item['בר_קוד_קידומת'] ? parseInt(item['בר_קוד_קידומת'], 10) : null;
      let dressModelId = null;
      // Find the corresponding model id
      const matchedModel = modelBatch.find(m => m.barcodePrefix === barcodePrefix || (m.name && m.name === item['שם_שמלה']));
      if (matchedModel) {
          dressModelId = matchedModel.id;
      }
      
      itemBatch.push({
        id: item['קוד'] || undefined,
        dressModelId: dressModelId,
        dressName: item['שם_שמלה'],
        sizeText: item['מידה_טקסט'] || item['מידה'],
        barcodePrefix: barcodePrefix,
        dressBarcode: item['בר_קוד_שמלה'] ? String(item['בר_קוד_שמלה']) : null,
        location: item['מיקום'],
        locationNum: item['מיקום_מס'] ? parseInt(item['מיקום_מס'], 10) : null,
        serialNumber: item['מספר_סידורי'] ? parseInt(item['מספר_סידורי'], 10) : null,
        quantity: item['כמות'] || 1,
        inRepair: isTrue(item['שמלה_בתיקון']),
        notInUse: isTrue(item['לא_בשימוש']),
        notInUseSince: parseExcelDate(item['לא_בשימוש_מתאריך']) || null,
        entryDateToRepo: parseExcelDate(item['תאריך_כניסה_למאגר']) || null
      });
    }

    count = 0;
    for (let i = 0; i < itemBatch.length; i += 2000) {
      const chunk = itemBatch.slice(i, i + 2000);
      await prisma.dressItem.createMany({ data: chunk });
      count += chunk.length;
    }
    console.log(`Successfully migrated ${count} dress items.`);

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
