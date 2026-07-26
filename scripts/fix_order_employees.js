const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const outDir = path.resolve(__dirname, '../../csv_exports');

async function main() {
  console.log('Loading Excel...');
  const ordersFile = path.join(outDir, 'הזמנות.xlsx');
  const ordersObj = xlsx.readFile(ordersFile);
  const orders = xlsx.utils.sheet_to_json(ordersObj.Sheets[ordersObj.SheetNames[0]]);
  
  const employees = await prisma.employee.findMany({ select: { id: true, legacyId: true } });
  const legacyToId = {};
  for (const emp of employees) if (emp.legacyId) legacyToId[emp.legacyId] = emp.id;
  
  const updates = [];
  
  for (const o of orders) {
    const legacyOrderId = parseInt(o['קוד_הזמנה'] || o['מספר_הזמנה'] || o['קוד']);
    const empLegacy = o['קוד_עובד'];
    
    if (empLegacy && legacyToId[empLegacy] && legacyOrderId && !isNaN(legacyOrderId)) {
      updates.push({ orderId: legacyOrderId, employeeId: legacyToId[empLegacy] });
    }
  }
  
  console.log(`Found ${updates.length} potential mappings from Excel.`);
  
  const fs = require('fs');
  
  // Group by employee ID
  const orderIdsByEmployee = {};
  for (const update of updates) {
    if (!orderIdsByEmployee[update.employeeId]) {
      orderIdsByEmployee[update.employeeId] = [];
    }
    orderIdsByEmployee[update.employeeId].push(update.orderId);
  }
  
  const totalEmployees = Object.keys(orderIdsByEmployee).length;
  console.log(`Grouping into ${totalEmployees} employees.`);
  fs.writeFileSync('employee_fix_progress.txt', `Started. Processing 0 / ${totalEmployees} employees.`);
  
  let processed = 0;
  for (const [empId, orderIds] of Object.entries(orderIdsByEmployee)) {
    // Process in chunks of 2000
    for (let i = 0; i < orderIds.length; i += 2000) {
      const chunk = orderIds.slice(i, i + 2000);
      await prisma.order.updateMany({
        where: { orderId: { in: chunk }, employeeId: null },
        data: { employeeId: empId }
      });
    }
    processed++;
    const progressMsg = `Processed ${processed} / ${totalEmployees} employees.`;
    console.log(progressMsg);
    fs.writeFileSync('employee_fix_progress.txt', progressMsg);
  }
  
  fs.writeFileSync('employee_fix_progress.txt', 'Done!');
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
