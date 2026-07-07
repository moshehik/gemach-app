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
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    return data;
  } catch (err) {
    console.error(`Warning: Could not read table ${tableName} at ${filePath}`);
    return [];
  }
}

async function migrateData() {
  console.log('Starting data migration from Excel exports to SQLite via Prisma...');

  try {
    // 1. Migrate Customers
    console.log('Migrating Customers...');
    const customers = readExcelTable('לקוחות');
    let custCount = 0;
    for (const c of customers) {
      if (!c['שם_פרטי'] && !c['שם_משפחה']) continue; // Skip empty rows
      await prisma.customer.upsert({
        where: { id: c['קוד_לקוח'] || -1 }, // fallback to -1 if missing id
        update: {},
        create: {
          id: c['קוד_לקוח'] || undefined,
          firstName: c['שם_פרטי'] ? String(c['שם_פרטי']) : null,
          lastName: c['שם_משפחה'] ? String(c['שם_משפחה']) : null,
          phone1: c['טלפון_1'] ? String(c['טלפון_1']) : null,
          city: c['עיר'] ? String(c['עיר']) : null,
          email: c['מייל'] ? String(c['מייל']) : null,
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
            notInUse: item['לא_בשימוש'] === true || item['לא_בשימוש'] === 1 || String(item['לא_בשימוש']) === 'Yes'
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
