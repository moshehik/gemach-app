const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const filePath = path.resolve(__dirname, '../../csv_exports/הזמנות.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const orders = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const updates = [];
  for (const o of orders) {
    if (!o['קוד_הזמנה']) continue;
    const amount = o['תשלום_סכום'] ? parseFloat(o['תשלום_סכום']) : (o['סהכ'] ? parseFloat(o['סהכ']) : null);
    if (amount !== null) {
      updates.push(prisma.order.update({
        where: { orderId: o['קוד_הזמנה'] },
        data: { totalAmount: amount }
      }).catch(() => {})); // ignore errors for deleted/missing orders
    }
  }
  
  console.log(`Updating ${updates.length} orders...`);
  // Process in chunks to not overload memory
  for (let i = 0; i < updates.length; i += 500) {
    await Promise.all(updates.slice(i, i + 500));
    console.log(`Updated ${Math.min(i + 500, updates.length)} orders`);
  }
  console.log('Done!');
}

main().finally(() => prisma.$disconnect());
