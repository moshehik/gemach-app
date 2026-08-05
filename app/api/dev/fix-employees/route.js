import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import path from 'path';
import * as xlsx from 'xlsx';
import { checkAuth } from '@/lib/auth';

export async function GET(request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Available only in development mode' }, { status: 403 });
  }
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const outDir = path.resolve(process.cwd(), '../csv_exports');
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
    
    const dbOrders = await prisma.order.findMany({
      where: { employeeId: null },
      select: { id: true, orderId: true }
    });
    
    const dbOrderMap = new Map();
    for (const db of dbOrders) dbOrderMap.set(db.orderId, db.id);
    
    let updatedCount = 0;
    
    // Process sequentially to avoid SQLite connection pool exhaustion
    for (const update of updates) {
      const dbId = dbOrderMap.get(update.orderId);
      if (dbId) {
        await prisma.order.update({
          where: { id: dbId },
          data: { employeeId: update.employeeId }
        });
        updatedCount++;
        if (updatedCount % 500 === 0) console.log(`Updated ${updatedCount}...`);
      }
    }
    
    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Fix error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
