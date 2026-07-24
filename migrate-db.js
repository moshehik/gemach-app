const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SqliteClient } = require('./prisma/generated/sqlite');
const crypto = require('crypto');

const pg = new PostgresClient();
const sq = new SqliteClient();

async function migrateData() {
  console.log('Starting migration from SQLite to Postgres with UUID mapping...');
  
  // Mapping objects to hold legacyId (Int) -> newId (UUID String)
  const customerMap = new Map();
  const employeeMap = new Map();
  const dressModelMap = new Map();
  const dressItemMap = new Map();
  const orderMap = new Map();
  const orderItemMap = new Map();

  // Helper for chunked inserts
  async function insertChunked(targetModel, data, tableName) {
    const chunkSize = 2000;
    let inserted = 0;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const res = await targetModel.createMany({
        data: chunk,
        skipDuplicates: true
      });
      inserted += res.count;
      console.log(`  Inserted ${inserted} / ${data.length} into ${tableName}`);
    }
  }

  try {
    // 1. Customer
    console.log('\nMigrating Customer...');
    const customers = await sq.customer.findMany();
    const newCustomers = customers.map(c => {
      const newId = crypto.randomUUID();
      customerMap.set(c.id, newId);
      return { ...c, id: newId, legacyId: c.id, updatedAt: new Date() };
    });
    await insertChunked(pg.customer, newCustomers, 'Customer');

    // 2. Employee
    console.log('\nMigrating Employee...');
    const employees = await sq.employee.findMany();
    const newEmployees = employees.map(e => {
      const newId = crypto.randomUUID();
      employeeMap.set(e.id, newId);
      return { ...e, id: newId, legacyId: e.id, updatedAt: new Date() };
    });
    await insertChunked(pg.employee, newEmployees, 'Employee');

    // 3. DressModel
    console.log('\nMigrating DressModel...');
    const dressModels = await sq.dressModel.findMany();
    const newDressModels = dressModels.map(m => {
      const newId = crypto.randomUUID();
      dressModelMap.set(m.id, newId);
      return { ...m, id: newId, legacyId: m.id, updatedAt: new Date() };
    });
    await insertChunked(pg.dressModel, newDressModels, 'DressModel');

    // 4. SystemSetting
    console.log('\nMigrating SystemSetting...');
    const settings = await sq.systemSetting.findMany();
    const newSettings = settings.map(s => {
      return { ...s, id: crypto.randomUUID(), legacyId: s.id, updatedAt: new Date() };
    });
    await insertChunked(pg.systemSetting, newSettings, 'SystemSetting');

    // 5. PriceList
    console.log('\nMigrating PriceList...');
    const priceLists = await sq.priceList.findMany();
    const newPriceLists = priceLists.map(p => {
      return { ...p, id: crypto.randomUUID(), legacyId: p.id, updatedAt: new Date() };
    });
    await insertChunked(pg.priceList, newPriceLists, 'PriceList');

    // 6. PriceRule
    console.log('\nMigrating PriceRule...');
    const priceRules = await sq.priceRule.findMany();
    const newPriceRules = priceRules.map(p => {
      return { ...p, id: crypto.randomUUID(), legacyId: p.id, updatedAt: new Date() };
    });
    await insertChunked(pg.priceRule, newPriceRules, 'PriceRule');

    // 7. DressItem
    console.log('\nMigrating DressItem...');
    const dressItems = await sq.dressItem.findMany();
    const newDressItems = dressItems.map(d => {
      const newId = crypto.randomUUID();
      dressItemMap.set(d.id, newId);
      return {
        ...d,
        id: newId,
        legacyId: d.id,
        dressModelId: d.dressModelId ? dressModelMap.get(d.dressModelId) : null,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.dressItem, newDressItems, 'DressItem');

    // 8. Order
    console.log('\nMigrating Order...');
    const orders = await sq.order.findMany();
    const newOrders = orders.map(o => {
      const newId = crypto.randomUUID();
      orderMap.set(o.id, newId);
      
      // employeeId doesn't exist in sqlite Order, but let's map it safely if it somehow does
      let empId = null;
      if (o.employeeId) empId = employeeMap.get(o.employeeId);
      
      // We explicitly copy only fields we know exist or exclude the ones we don't want problems with
      // isWeekdayEvent doesn't exist in PG schema (let's omit it if it causes issues, but JS spread is fine unless Prisma complains).
      // Actually Prisma WILL complain if we pass a field that doesn't exist in the PG model.
      // Let's filter out 'isWeekdayEvent'
      const { isWeekdayEvent, ...restOrder } = o;

      return {
        ...restOrder,
        id: newId,
        legacyId: o.id,
        customerId: o.customerId ? customerMap.get(o.customerId) : null,
        employeeId: empId,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.order, newOrders, 'Order');

    // 9. Shift
    console.log('\nMigrating Shift...');
    const shifts = await sq.shift.findMany();
    const newShifts = shifts.map(s => {
      return {
        ...s,
        id: crypto.randomUUID(),
        legacyId: s.id,
        employeeId: employeeMap.get(s.employeeId),
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.shift, newShifts, 'Shift');

    // 10. Payment
    console.log('\nMigrating Payment...');
    const payments = await sq.payment.findMany();
    const newPayments = payments.map(p => {
      return {
        ...p,
        id: crypto.randomUUID(),
        legacyId: p.id,
        customerId: p.customerId ? customerMap.get(p.customerId) : null,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.payment, newPayments, 'Payment');

    // 11. PaymentObligation
    console.log('\nMigrating PaymentObligation...');
    const obligations = await sq.paymentObligation.findMany();
    const newObligations = obligations.map(p => {
      return {
        ...p,
        id: crypto.randomUUID(),
        legacyId: p.id,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.paymentObligation, newObligations, 'PaymentObligation');

    // 12. OrderItem
    console.log('\nMigrating OrderItem...');
    const orderItems = await sq.orderItem.findMany();
    const newOrderItems = orderItems.map(o => {
      const newId = crypto.randomUUID();
      orderItemMap.set(o.id, newId);
      return {
        ...o,
        id: newId,
        legacyId: o.id,
        dressItemId: o.dressItemId ? dressItemMap.get(o.dressItemId) : null,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.orderItem, newOrderItems, 'OrderItem');

    // 13. PageVisitLog
    console.log('\nMigrating PageVisitLog...');
    const visitLogs = await sq.pageVisitLog.findMany();
    const newVisitLogs = visitLogs.map(v => {
      return {
        ...v,
        id: crypto.randomUUID(),
        legacyId: v.id,
        employeeId: v.employeeId ? employeeMap.get(v.employeeId) : null,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.pageVisitLog, newVisitLogs, 'PageVisitLog');

    // 14. EmailLog
    console.log('\nMigrating EmailLog...');
    const emailLogs = await sq.emailLog.findMany();
    const newEmailLogs = emailLogs.map(e => {
      return {
        ...e,
        id: crypto.randomUUID(),
        legacyId: e.id,
        customerId: e.customerId ? customerMap.get(e.customerId) : null,
        employeeId: e.employeeId ? employeeMap.get(e.employeeId) : null,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.emailLog, newEmailLogs, 'EmailLog');

    // 15. AuditLog
    console.log('\nMigrating AuditLog...');
    const auditLogs = await sq.auditLog.findMany();
    const newAuditLogs = auditLogs.map(a => {
      return {
        ...a,
        id: crypto.randomUUID(),
        legacyId: a.id,
        employeeId: a.employeeId ? employeeMap.get(a.employeeId) : null,
        updatedAt: new Date()
      };
    });
    await insertChunked(pg.auditLog, newAuditLogs, 'AuditLog');

    console.log('\nMigration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pg.$disconnect();
    await sq.$disconnect();
  }
}

migrateData().catch(e => {
  console.error(e);
  process.exit(1);
});
