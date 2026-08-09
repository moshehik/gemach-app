import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';

// "ההשכרות האחרונות" נשלפות בשאילתת JOIN אחת במקום include מקונן בעומק 3 של פריזמה
// (שנמדד כ-9 שאילתות עוקבות מול Neon, ~1.2s). רשימות העמודות נבנות מה-DMMF של הקליינט
// כך שהן תמיד תואמות את הסכימה — אותו תקדים כמו app/api/alterations/route.js.
const scalarFieldNames = (modelName) =>
  Prisma.dmmf.datamodel.models
    .find(m => m.name === modelName)
    .fields.filter(f => f.kind === 'scalar' || f.kind === 'enum')
    .map(f => f.name);

const ORDER_ITEM_FIELDS = scalarFieldNames('OrderItem');
const ORDER_FIELDS = scalarFieldNames('Order');
const DRESS_ITEM_FIELDS = scalarFieldNames('DressItem');

const colList = (fields, alias, prefix) =>
  fields.map(f => `${alias}."${f}" AS "${prefix}${f}"`).join(', ');

const pickPrefixed = (row, fields, prefix) => {
  const out = {};
  for (const f of fields) out[f] = row[prefix + f];
  return out;
};

// מחזיר בדיוק את הצורה של ה-findMany המקונן הקודם:
// orderItem + order{...כל השדות, customer{firstName,lastName}, employee{firstName,lastName}}
// + dressItem{...כל השדות, dress{name}} — ממוין takenDate יורד (נשען על האינדקס החדש), 10 שורות.
async function fetchRecentRentals() {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      ${Prisma.raw(colList(ORDER_ITEM_FIELDS, 'oi', 'oi_'))},
      ${Prisma.raw(colList(ORDER_FIELDS, 'o', 'o_'))},
      (c."id" IS NOT NULL) AS "has_customer",
      c."firstName" AS "c_firstName", c."lastName" AS "c_lastName",
      (e."id" IS NOT NULL) AS "has_employee",
      e."firstName" AS "e_firstName", e."lastName" AS "e_lastName",
      ${Prisma.raw(colList(DRESS_ITEM_FIELDS, 'di', 'di_'))},
      (dm."id" IS NOT NULL) AS "has_dress",
      dm."name" AS "dm_name"
    FROM "OrderItem" oi
    JOIN "Order" o ON o."orderId" = oi."orderId"
    LEFT JOIN "Customer" c ON c."id" = o."customerId"
    LEFT JOIN "Employee" e ON e."id" = o."employeeId"
    LEFT JOIN "DressItem" di ON di."id" = oi."dressItemId"
    LEFT JOIN "DressModel" dm ON dm."id" = di."dressModelId"
    WHERE oi."isDeleted" = false
      AND oi."isTaken" = true
      AND oi."takenDate" IS NOT NULL
      AND o."isDeleted" = false
    ORDER BY oi."takenDate" DESC
    LIMIT 10
  `);

  return rows.map(row => {
    const item = pickPrefixed(row, ORDER_ITEM_FIELDS, 'oi_');
    const order = pickPrefixed(row, ORDER_FIELDS, 'o_');
    order.customer = row.has_customer
      ? { firstName: row.c_firstName, lastName: row.c_lastName }
      : null;
    order.employee = row.has_employee
      ? { firstName: row.e_firstName, lastName: row.e_lastName }
      : null;
    item.order = order;
    if (row.di_id !== null) {
      const dressItem = pickPrefixed(row, DRESS_ITEM_FIELDS, 'di_');
      dressItem.dress = row.has_dress ? { name: row.dm_name } : null;
      item.dressItem = dressItem;
    } else {
      item.dressItem = null;
    }
    return item;
  });
}

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    // 1. Fetch Outstanding Debts (Orders that are not fully paid)
    // For simplicity, we find orders where isPaid is false. 
    // In a real scenario you might sum up order totalAmount and subtract payments.
    // debts + שלוש רשימות ה"אחרונים" בלתי-תלויות זו בזו — רצות במקביל (שלב 1).
    // התשלומים/התחייבויות של החובות + auditLogs תלויים ברשימת החובות ולכן רצים
    // בשלב 2, גם הם במקביל זה לזה.
    const [debtOrders, recentPayments, recentOrders, recentRentals] = await Promise.all([
      prisma.order.findMany({
      where: {
        isPaid: false,
        isDeleted: false
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone1: true
          }
        }
      },
      orderBy: {
        eventDate: { sort: 'desc', nulls: 'last' }
      },
      take: 100
      }),
      // 2. Recent Payments
      prisma.payment.findMany({
        where: {
          isDeleted: false
        },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          order: {
            select: {
              orderId: true
            }
          }
        },
        orderBy: {
          paymentDate: 'desc'
        },
        take: 10
      }),
      // 3. Recent Orders
      prisma.order.findMany({
        where: {
          isDeleted: false
        },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          items: {
            where: { isDeleted: false },
            select: { id: true }
          },
          employee: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          eventDate: { sort: 'desc', nulls: 'last' }
        },
        take: 10
      }),
      // 4. Recent Rentals — שאילתת JOIN אחת (ר' fetchRecentRentals למעלה)
      fetchRecentRentals()
    ]);

    // שלב 2 — שלוש שליפות שתלויות ברשימת החובות בלבד, במקביל זו לזו:
    // התשלומים וההתחייבויות של 100 החובות (הוצאו מה-include כדי שלא ייגררו כשאילתות
    // עוקבות בתוך שלב 1), ויומני אישור-החוב.
    // Fetch DEBT_APPROVED and its undo counterpart CANCEL_DEBT_APPROVAL for these orders -
    // whichever is most recent per order decides the current approval state (an approval
    // can be undone later from the refunds/debts screen, see app/refunds/page.js).
    const debtOrderIds = debtOrders.map(d => d.orderId);
    const [debtPayments, debtObligations, auditLogs] = await Promise.all([
      prisma.payment.findMany({ where: { orderId: { in: debtOrderIds } } }),
      prisma.paymentObligation.findMany({ where: { orderId: { in: debtOrderIds } } }),
      prisma.auditLog.findMany({
        where: {
          entityType: 'Order',
          entityId: { in: debtOrderIds.map(String) },
          action: { in: ['DEBT_APPROVED', 'CANCEL_DEBT_APPROVAL'] }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const groupByOrderId = (rows) => {
      const map = new Map();
      rows.forEach(r => {
        if (!map.has(r.orderId)) map.set(r.orderId, []);
        map.get(r.orderId).push(r);
      });
      return map;
    };
    const paymentsByOrder = groupByOrderId(debtPayments);
    const obligationsByOrder = groupByOrderId(debtObligations);

    // אותה צורה שהחזיר ה-include הקודם: כל הזמנה עם מערכי payments/obligations מלאים.
    const debts = debtOrders.map(order => ({
      ...order,
      payments: paymentsByOrder.get(order.orderId) || [],
      obligations: obligationsByOrder.get(order.orderId) || []
    }));

    const debtsWithRemaining = debts.map(order => {
      const totalPaid = order.payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
      const totalObligations = order.obligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0);
      const remaining = totalObligations - totalPaid;

      // Check if debt is approved - auditLogs is already ordered desc, so the first match
      // per order is its latest DEBT_APPROVED/CANCEL_DEBT_APPROVAL entry.
      let isApproved = false;
      const latestLog = auditLogs.find(log => log.entityId === order.orderId.toString());
      if (latestLog && latestLog.action === 'DEBT_APPROVED') {
        try {
          const changes = JSON.parse(latestLog.changesJson);
          // If the approved debt amount is at least as much as the current remaining debt, it's considered approved.
          // Or if they approved some debt, we consider it reviewed. Let's just say if the log exists, it's approved for that amount.
          if (changes.approvedDebtAmount !== undefined && changes.approvedDebtAmount >= remaining - 1) {
             isApproved = true;
          }
        } catch(e) {}
      }

      return {
        ...order,
        totalPaid,
        remaining,
        isApproved
      };
    }).filter(d => d.remaining > 0 && !d.isApproved);

    return NextResponse.json({ debts: debtsWithRemaining, recentPayments, recentOrders, recentRentals });
  } catch (error) {
    console.error('Debts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch debts and payments' }, { status: 500 });
  }
}
