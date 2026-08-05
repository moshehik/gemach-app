import { PrismaClient } from '@prisma/client';
import { computeOrderObligations } from './lib/pricingEngine.js';

const prisma = new PrismaClient();

const RECALC_SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS',
  'CANCELLATION_CREDIT_MINUTES'
];

async function main() {
  const parsedOrderId = 25734;
  const order = await prisma.order.findUnique({
    where: { orderId: parsedOrderId },
    include: { customer: true, employee: true }
  });
  
  const [items, payments, refunds, priceList, obligationsRaw, settings] = await Promise.all([
      prisma.orderItem.findMany({
        where: { orderId: parsedOrderId },
        include: {
          dressItem: {
            include: {
              dress: true
            }
          }
        }
      }),
      prisma.payment.findMany({ where: { orderId: parsedOrderId } }),
      prisma.refund.findMany({ where: { orderId: parsedOrderId } }),
      prisma.priceList.findMany({ select: { id: true, legacyId: true, category: true, description: true, fromSize: true, toSize: true, price: true } }),
      prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } }),
      prisma.systemSetting.findMany({ where: { key: { in: RECALC_SETTING_KEYS } } })
  ]);
  
  console.log("Got order:", order.orderId);
  console.log("Items:", items.length);
  
  try {
      const { newObligations } = computeOrderObligations({
        order,
        items: items.filter(i => !i.isDeleted),
        deletedItems: items.filter(i => i.isDeleted),
        priceList,
        settings
      });
      console.log("Obligations generated without error.");
  } catch (e) {
      console.error("Error generating draft obligations:", e);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
