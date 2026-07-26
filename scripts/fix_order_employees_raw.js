const xlsx = require('xlsx');
const path = require('path');
const Database = require('better-sqlite3');

const outDir = path.resolve(__dirname, '../../csv_exports');
const dbPath = path.resolve(__dirname, '../prisma/dev.db');

function main() {
  console.log('Loading Excel...');
  const ordersFile = path.join(outDir, 'הזמנות.xlsx');
  const ordersObj = xlsx.readFile(ordersFile);
  const orders = xlsx.utils.sheet_to_json(ordersObj.Sheets[ordersObj.SheetNames[0]]);
  
  console.log('Connecting to SQLite...');
  const db = new Database(dbPath);
  
  const employees = db.prepare('SELECT id, legacyId FROM Employee WHERE legacyId IS NOT NULL').all();
  const legacyToId = {};
  for (const emp of employees) legacyToId[emp.legacyId] = emp.id;
  
  const updates = [];
  for (const o of orders) {
    const legacyOrderId = parseInt(o['קוד_הזמנה'] || o['מספר_הזמנה'] || o['קוד']);
    const empLegacy = o['קוד_עובד'];
    
    if (empLegacy && legacyToId[empLegacy] && legacyOrderId && !isNaN(legacyOrderId)) {
      updates.push({ orderId: legacyOrderId, employeeId: legacyToId[empLegacy] });
    }
  }
  
  console.log(`Found ${updates.length} potential mappings from Excel.`);
  
  const updateStmt = db.prepare('UPDATE "Order" SET employeeId = ? WHERE orderId = ? AND employeeId IS NULL');
  
  let updatedCount = 0;
  
  const runUpdates = db.transaction((ups) => {
    for (const update of ups) {
      const res = updateStmt.run(update.employeeId, update.orderId);
      updatedCount += res.changes;
    }
  });
  
  runUpdates(updates);
  
  console.log(`Done! Updated ${updatedCount} orders with employee IDs.`);
  db.close();
}

main();
