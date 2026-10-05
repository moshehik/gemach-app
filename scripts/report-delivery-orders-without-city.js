#!/usr/bin/env node
/**
 * דוח קריאה-בלבד: הזמנות משלוח (isDelivery=true) בלי עיר משלוח (לפי orderDate) מאז 2026-09-14, ואם יש להן חיוב משלוח.
 * הרקע: עד התיקון ב-applyDeliveryCharge (lib/pricingEngine.js) חיוב משלוח נוצר רק כשהייתה
 * deliveryCity מפורשת - ולקוח מעיר שבטבלת delivery_price_by_city שמר משלוח בלי חיוב (org2
 * 06467870, 3a4d36df). הסקריפט רק קורא (findMany) - לא כותב, לא מתקן.
 *
 * שימוש:  node scripts/report-delivery-orders-without-city.js --org=2 [--since=2026-09-14]
 * עמודות: orderId | eventDate | ללקוח עיר | סטטוס חיוב משלוח | סה"כ חיובי משלוח
 *   NO_DELIVERY_OBLIGATION = הבעיה (משלוח ללא חיוב); HAS_DELIVERY_OBLIGATION = תקין.
 *   customerCityInTable = האם התיקון החדש היה מחייב את ההזמנה בשמירה הבאה.
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const sinceArg = (rest.find(a => a.startsWith('--since=')) || '').slice('--since='.length);
  const since = new Date(sinceArg || '2026-09-14T00:00:00.000Z');
  if (isNaN(since.getTime())) throw new Error(`bad --since value: ${sinceArg}`);

  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    const [orders, priceSetting] = await Promise.all([
      prisma.order.findMany({
        where: {
          isDelivery: true,
          orderDate: { gte: since },
          OR: [{ deliveryCity: null }, { deliveryCity: '' }]
        },
        select: {
          orderId: true,
          status: true,
          eventDate: true,
          customer: { select: { city: true } },
          obligations: { where: { isDeleted: false }, select: { description: true, amount: true } }
        },
        orderBy: { orderId: 'asc' }
      }),
      prisma.systemSetting.findFirst({ where: { key: 'delivery_price_by_city' }, select: { value: true } })
    ]);

    let priceCities = [];
    try { priceCities = Object.keys(JSON.parse(priceSetting?.value || '{}')).map(c => c.trim()); } catch { /* ignore */ }

    console.log(`org ${org}: isDelivery orders without deliveryCity since ${since.toISOString().slice(0, 10)}: ${orders.length}`);
    let missing = 0;
    for (const o of orders) {
      const delivery = o.obligations.filter(ob => String(ob.description || '').includes('משלוח'));
      const total = delivery.reduce((s, ob) => s + (ob.amount || 0), 0);
      const state = delivery.length ? 'HAS_DELIVERY_OBLIGATION' : 'NO_DELIVERY_OBLIGATION';
      if (!delivery.length) missing++;
      const city = String(o.customer?.city || '').trim();
      console.log([
        o.orderId,
        o.status || '-',
        o.eventDate ? o.eventDate.toISOString().slice(0, 10) : '-',
        `customerCity=${city || '(empty)'}`,
        `customerCityInTable=${city ? priceCities.includes(city) : false}`,
        state,
        total
      ].join(' | '));
    }
    console.log(`\nWithout a delivery obligation: ${missing} of ${orders.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
