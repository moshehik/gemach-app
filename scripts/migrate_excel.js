const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const hebcal = require('hebcal');

const prisma = new PrismaClient();

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
    // 1. Migrate Customers
    console.log('Migrating Customers...');
    const customers = readExcelTable('לקוחות');
    let custCount = 0;
    for (const c of customers) {
      let emailStr = c['מייל'] ? String(c['מייל']).trim() : '';
      let suffixStr = c['סיומת_מייל'] ? String(c['סיומת_מייל']).trim() : '';
      if (suffixStr === './org.il') suffixStr = '.org.il';
      
      let combinedEmail = emailStr;
      if (emailStr && suffixStr) {
        if (!combinedEmail.includes('@') && !suffixStr.startsWith('@') && !suffixStr.startsWith('.')) {
          combinedEmail += '@' + suffixStr;
        } else if (combinedEmail.endsWith('@') && suffixStr.startsWith('@')) {
          combinedEmail += suffixStr.substring(1);
        } else {
          combinedEmail += suffixStr;
        }
      } else if (!emailStr && suffixStr) {
        combinedEmail = suffixStr; // fallback if only suffix exists
      }
      combinedEmail = combinedEmail.replace(/\s+/g, '');

      await prisma.customer.upsert({
        where: { id: c['קוד_לקוח'] || -1 }, // fallback to -1 if missing id
        update: {},
        create: {
            id: c['קוד_לקוח'] || undefined,
            firstName: c['שם_פרטי'] ? String(c['שם_פרטי']) : null,
            lastName: c['שם_משפחה'] ? String(c['שם_משפחה']) : null,
            phone1: c['טלפון_1'] ? String(c['טלפון_1']) : null,
            phone2: c['טלפון_2'] ? String(c['טלפון_2']) : null,
            city: c['עיר'] ? String(c['עיר']) : null,
            street: c['רחוב'] ? String(c['רחוב']) : null,
            houseNum: c['בית'] ? (isNaN(parseInt(c['בית'], 10)) ? null : parseInt(c['בית'], 10)) : null,
            email: combinedEmail ? combinedEmail : null,
            emailSuffix: c['סיומת_מייל'] ? String(c['סיומת_מייל']) : null,
            notes: c['הערות'] ? String(c['הערות']) : null,
            registrationDate: c['תאריך_רישום'] ? String(c['תאריך_רישום']) : null,
            isDeleted: c['לקוח_מחוק'] === true || c['לקוח_מחוק'] === 1 || String(c['לקוח_מחוק']) === 'Yes'
        }
      });
      custCount++;
    }
    console.log(`Successfully migrated ${custCount} customers.`);

    // 2. Migrate Employees
    console.log('Migrating Employees...');
    const employees = readExcelTable('עובדים');
    let empCount = 0;
    for (const e of employees) {
      if (!e['שם_פרטי'] && !e['שם_משפחה']) continue;
      await prisma.employee.upsert({
        where: { id: e['קוד_עובד'] || -1 },
        update: {},
        create: {
          id: e['קוד_עובד'] || undefined,
          firstName: e['שם_פרטי'] ? String(e['שם_פרטי']) : null,
          lastName: e['שם_משפחה'] ? String(e['שם_משפחה']) : null,
          phone1: e['טלפון_1'] ? String(e['טלפון_1']) : null,
          isActive: e['לא_פעיל'] !== true && e['לא_פעיל'] !== 1 && String(e['לא_פעיל']) !== 'Yes'
        }
      });
      empCount++;
    }
    console.log(`Successfully migrated ${empCount} employees.`);

    // 3. Migrate Dress Models
    console.log('Migrating Dress Models...');
    const models = readExcelTable('שמלות_דגמים');
    let modelCount = 0;
    for (const m of models) {
      if (!m['שם_שמלה']) continue;
      
      try {
        await prisma.dressModel.upsert({
          where: { name: String(m['שם_שמלה']) },
          update: {
            priceCategory: m['קטגורית_מחיר'] ? String(m['קטגורית_מחיר']) : null,
            notes: m['הערות'] ? String(m['הערות']) : null,
            inInspection: m['הצג_בבדיקה'] === true || m['הצג_בבדיקה'] === 1 || String(m['הצג_בבדיקה']) === 'Yes'
          },
          create: {
            id: m['קוד_שמלה'] || undefined,
            name: String(m['שם_שמלה']),
            priceCategory: m['קטגורית_מחיר'] ? String(m['קטגורית_מחיר']) : null,
            notes: m['הערות'] ? String(m['הערות']) : null,
            inInspection: m['הצג_בבדיקה'] === true || m['הצג_בבדיקה'] === 1 || String(m['הצג_בבדיקה']) === 'Yes'
          }
        });
        modelCount++;
      } catch (err) {
        console.error(`Could not upsert DressModel ${m['שם_שמלה']}:`, err.message);
      }
    }
    console.log(`Successfully migrated ${modelCount} dress models.`);

    // 4. Migrate Dress Items
    console.log('Migrating Dress Items...');
    const items = readExcelTable('שמלות_נתונים');
    let itemCount = 0;
    for (const item of items) {
      if (!item['שם_שמלה']) continue;
      
      try {
        await prisma.dressItem.upsert({
          where: { id: item['קוד'] || -1 },
          update: {},
          create: {
            id: item['קוד'] || undefined,
            dressName: String(item['שם_שמלה']),
            sizeText: item['מידה_טקסט'] ? String(item['מידה_טקסט']) : (item['מידה'] ? String(item['מידה']) : null),
            location: item['מיקום'] ? String(item['מיקום']) : null,
            quantity: item['כמות'] || 1,
            inRepair: item['שמלה_בתיקון'] === true || item['שמלה_בתיקון'] === 1 || String(item['שמלה_בתיקון']) === 'Yes',
            notInUse: item['לא_בשימוש'] === true || item['לא_בשימוש'] === 1 || String(item['לא_בשימוש']) === 'Yes',
            notInUseSince: parseExcelDate(item['לא_בשימוש_מתאריך']) || null,
            entryDateToRepo: parseExcelDate(item['תאריך_כניסה_למאגר']) || null
          }
        });
        itemCount++;
      } catch (err) {
        console.error(`Could not upsert DressItem ${item['קוד']}:`, err.message);
      }
    }
    console.log(`Successfully migrated ${itemCount} dress items.`);

    // 5. Migrate Orders
    console.log('Migrating Orders...');
    const orders = readExcelTable('הזמנות');
    let orderCount = 0;
    for (const o of orders) {
      if (o['מחוק'] === true || o['מחוק'] === 1 || String(o['מחוק']) === 'Yes') continue;
      if (!o['קוד_הזמנה']) continue;
      
      try {
        await prisma.order.upsert({
          where: { orderId: o['קוד_הזמנה'] || -1 },
          update: {},
          create: {
            orderId: o['קוד_הזמנה'],
            customerId: o['קוד_לקוח'] || null,
            totalAmount: o['תשלום_סכום'] ? parseFloat(o['תשלום_סכום']) : null,
            notes: o['הערות_להזמנה'] ? String(o['הערות_להזמנה']) : null,
            status: (o['שולם'] === true || o['שולם'] === 1 || String(o['שולם']) === 'Yes') ? 'שולם' : 'ממתין לתשלום'
          }
        });
        orderCount++;
      } catch (err) {
        console.error(`Could not upsert Order ${o['קוד_הזמנה']}:`, err.message);
      }
    }
    console.log(`Successfully migrated ${orderCount} orders.`);

    // 6. Migrate Order Items
    console.log('Migrating Order Items...');
    const orderItems = readExcelTable('הזמנות_פרטים');
    let orderItemCount = 0;
    for (const i of orderItems) {
      if (i['מחוק'] === true || i['מחוק'] === 1 || String(i['מחוק']) === 'Yes') continue;
      if (!i['קוד_פריט']) continue;
      
      try {
        await prisma.orderItem.upsert({
          where: { id: i['קוד_פריט'] || -1 },
          update: {},
          create: {
            id: i['קוד_פריט'],
            orderId: i['קוד_הזמנה'] || null,
            quantity: i['כמות'] || 1,
            description: i['פירוט_תיקון'] ? String(i['פירוט_תיקון']) : null
          }
        });
        orderItemCount++;
      } catch (err) {
        console.error(`Could not upsert OrderItem ${i['קוד_פריט']}:`, err.message);
      }
    }
    console.log(`Successfully migrated ${orderItemCount} order items.`);

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
