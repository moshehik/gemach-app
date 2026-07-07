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
    console.error(`Could not read ${filePath}`);
    return [];
  }
}

function isTrue(val) {
  return val === true || val === 1 || String(val).toLowerCase() === 'yes' || String(val) === '1';
}

async function migrateData() {
  console.log('Starting data migration from Excel exports to SQLite via Prisma...');

  try {
    // 1. Migrate Customers
    console.log('Migrating Customers...');
    const customers = readExcelTable('לקוחות');
    await prisma.customer.deleteMany({});
    
    const customerBatch = customers.map(c => ({
      id: c['קוד_לקוח'] || undefined,
      firstName: c['שם_פרטי'],
      lastName: c['שם_משפחה'],
      phone1: c['טלפון_1'],
      city: c['עיר'],
      email: c['מייל'],
      isDeleted: isTrue(c['לקוח_מחוק'])
    }));

    let count = 0;
    for (let i = 0; i < customerBatch.length; i += 2000) {
      const chunk = customerBatch.slice(i, i + 2000);
      await prisma.customer.createMany({ data: chunk, skipDuplicates: true });
      count += chunk.length;
    }
    console.log(`Successfully migrated ${count} customers.`);

    // 2. Migrate Employees
    console.log('Migrating Employees...');
    const employees = readExcelTable('עובדים');
    await prisma.employee.deleteMany({});
    
    const employeeBatch = employees.map(e => ({
      id: e['קוד_עובד'] || undefined,
      firstName: e['שם_פרטי'],
      lastName: e['שם_משפחה'],
      phone1: e['טלפון_1'],
      isActive: !isTrue(e['לא_פעיל'])
    }));

    await prisma.employee.createMany({ data: employeeBatch, skipDuplicates: true });
    console.log(`Successfully migrated ${employeeBatch.length} employees.`);

    // 3. Migrate Dress Models
    console.log('Migrating Dress Models...');
    const models = readExcelTable('שמלות_דגמים');
    // Important: we need to handle relation deletion if we delete models and items. 
    // Since we delete orderItems and orders in import_all_data, we should be fine here as long as we delete items first.
    await prisma.dressItem.deleteMany({});
    await prisma.dressModel.deleteMany({});
    
    const modelBatch = models.map(m => ({
      id: m['קוד_שמלה'] || undefined,
      name: m['שם_שמלה'],
      barcodePrefix: m['בר_קוד_קידומת'] ? parseInt(m['בר_קוד_קידומת'], 10) : null,
      priceCategory: m['קטגורית_מחיר'],
      notes: m['הערות'],
      inInspection: isTrue(m['הצג_בבדיקה'])
    }));
    await prisma.dressModel.createMany({ 
      data: modelBatch,
      skipDuplicates: true
    });
    console.log(`Successfully migrated ${modelBatch.length} dress models.`);

    // 4. Migrate Dress Items
    console.log('Migrating Dress Items...');
    const items = readExcelTable('שמלות_נתונים');
    
    const validModelIds = new Set(modelBatch.map(m => m.id).filter(id => id !== undefined));
    
    const itemBatch = [];
    for(const item of items) {
      // Find model id by name if missing? The schema links by dressModelId but in earlier versions it might not.
      itemBatch.push({
        id: item['קוד'] || undefined,
        dressName: item['שם_שמלה'],
        sizeText: item['מידה_טקסט'] || item['מידה'],
        barcodePrefix: item['בר_קוד_קידומת'] ? parseInt(item['בר_קוד_קידומת'], 10) : null,
        dressBarcode: item['בר_קוד_שמלה'] ? String(item['בר_קוד_שמלה']) : null,
        location: item['מיקום'],
        quantity: item['כמות'] || 1,
        inRepair: isTrue(item['שמלה_בתיקון']),
        notInUse: isTrue(item['לא_בשימוש'])
      });
    }

    count = 0;
    for (let i = 0; i < itemBatch.length; i += 2000) {
      const chunk = itemBatch.slice(i, i + 2000);
      await prisma.dressItem.createMany({ data: chunk, skipDuplicates: true });
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
