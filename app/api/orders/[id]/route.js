import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma, { auditAs, getActingEmployeeId } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

// שליפת פריטי ההזמנה עם dressItem+dress בשאילתת JOIN אחת במקום include מקונן של
// פריזמה (3 סבבים עוקבים מול Neon — OrderItem ואז DressItem ואז DressModel, כ-100-200ms
// לסבב). אותו תקדים כמו app/api/alterations/route.js, אבל רשימת העמודות נבנית מה-DMMF
// של הקליינט כך שהיא תמיד תואמת את הסכימה הנוכחית ולא מתיישנת עם שינויי מודל.
// (relationJoins של פריזמה נבחן ונפסל — ר' ההערה ב-prisma/schema.prisma.)
const scalarFieldNames = (modelName) =>
  Prisma.dmmf.datamodel.models
    .find(m => m.name === modelName)
    .fields.filter(f => f.kind === 'scalar' || f.kind === 'enum')
    .map(f => f.name);

const ORDER_ITEM_FIELDS = scalarFieldNames('OrderItem');
const DRESS_ITEM_FIELDS = scalarFieldNames('DressItem');
const DRESS_MODEL_FIELDS = scalarFieldNames('DressModel');

const colList = (fields, alias, prefix) =>
  fields.map(f => `${alias}."${f}" AS "${prefix}${f}"`).join(', ');

const pickPrefixed = (row, fields, prefix) => {
  const out = {};
  for (const f of fields) out[f] = row[prefix + f];
  return out;
};

// מחזיר בדיוק את הצורה של:
// prisma.orderItem.findMany({ where: { orderId }, include: { dressItem: { include: { dress: true } } } })
async function fetchOrderItemsWithDress(orderId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT
      ${Prisma.raw(colList(ORDER_ITEM_FIELDS, 'oi', 'oi_'))},
      ${Prisma.raw(colList(DRESS_ITEM_FIELDS, 'di', 'di_'))},
      ${Prisma.raw(colList(DRESS_MODEL_FIELDS, 'dm', 'dm_'))}
    FROM "OrderItem" oi
    LEFT JOIN "DressItem" di ON di."id" = oi."dressItemId"
    LEFT JOIN "DressModel" dm ON dm."id" = di."dressModelId"
    WHERE oi."orderId" = ${orderId}
  `);

  return rows.map(row => {
    const item = pickPrefixed(row, ORDER_ITEM_FIELDS, 'oi_');
    if (row.di_id !== null) {
      const dressItem = pickPrefixed(row, DRESS_ITEM_FIELDS, 'di_');
      dressItem.dress = row.dm_id !== null ? pickPrefixed(row, DRESS_MODEL_FIELDS, 'dm_') : null;
      item.dressItem = dressItem;
    } else {
      item.dressItem = null;
    }
    return item;
  });
}
import { recalculateOrderObligations, computeOrderObligations } from '../../../../lib/pricingEngine';
import { getHebrewDateString } from '../../../../lib/hebrewDate';
import { validateOrderItemsAvailability, loadInventoryContext, refreshInventoryBookings, computeInventoryAvailability } from '../../../../lib/inventory';
import { orderHasPermanentHold } from '../../../../lib/inventoryHold';
import { DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS, deriveConfirmedOrderStatus } from '../../../../lib/orderReservation';

const RECALC_SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS',
  'CANCELLATION_CREDIT_MINUTES'
];

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    let parsedOrderId;
    let order;

    if (id.includes('-')) {
      order = await prisma.order.findUnique({
        where: { id },
        include: { customer: true, employee: true }
      });
      if (order) parsedOrderId = order.orderId;
    } else {
      parsedOrderId = parseInt(id);
      if (!isNaN(parsedOrderId)) {
        order = await prisma.order.findUnique({
          where: { orderId: parsedOrderId },
          include: { customer: true, employee: true }
        });
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Workaround for schema relation pointing to Order.id instead of Order.orderId
    // These queries are independent of each other - fetch them concurrently instead of one at a time.
    const [items, payments, refunds, priceList, obligationsRaw, settings] = await Promise.all([
      fetchOrderItemsWithDress(parsedOrderId),
      prisma.payment.findMany({ where: { orderId: parsedOrderId } }),
      prisma.refund.findMany({ where: { orderId: parsedOrderId } }),
      prisma.priceList.findMany({ select: { id: true, legacyId: true, category: true, description: true, fromSize: true, toSize: true, price: true } }),
      prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } }),
      prisma.systemSetting.findMany({ where: { key: { in: RECALC_SETTING_KEYS } } })
    ]);

    let obligations = obligationsRaw;

    // Add draft obligations for pending items - computed in-memory from data already
    // fetched above, instead of triggering a second full order+items+priceList fetch.
    try {
      const { newObligations } = computeOrderObligations({
        order,
        items: items.filter(i => !i.isDeleted),
        deletedItems: items.filter(i => i.isDeleted),
        priceList,
        settings
      });
      const drafts = newObligations.filter(o => o.isDraft);
      obligations = [...obligations, ...drafts];
    } catch (e) {
      console.error("Error generating draft obligations:", e);
    }

    const uniquePrefixes = new Set();
    items.forEach(i => {
      const dressName = i.dressItem?.dress?.name;
      const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
      if (!dressName && prefix !== null && prefix !== undefined) {
        const numPfx = parseInt(prefix, 10);
        if (!isNaN(numPfx)) uniquePrefixes.add(numPfx);
      }
    });

    let dressModels = [];
    if (uniquePrefixes.size > 0) {
      dressModels = await prisma.dressModel.findMany({
        where: { barcodePrefix: { in: Array.from(uniquePrefixes) } },
        select: { barcodePrefix: true, name: true }
      });
    }
    const dressModelMap = new Map();
    dressModels.forEach(m => {
      if (m.barcodePrefix !== null && m.barcodePrefix !== undefined) {
        dressModelMap.set(Number(m.barcodePrefix), m.name);
        dressModelMap.set(String(m.barcodePrefix), m.name);
      }
    });

    const itemsWithLogs = items.map(item => {
      let dressName = item.dressItem?.dress?.name;
      const prefix = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
      
      if (!dressName && prefix !== null && prefix !== undefined) {
        dressName = dressModelMap.get(Number(prefix)) || dressModelMap.get(String(prefix));
      }
      
      let finalDescription = item.description;
      if (!finalDescription || finalDescription === 'פריט כללי') {
        if (dressName) {
          finalDescription = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''}`;
        } else if (item.dressItem?.dressName) {
          finalDescription = item.dressItem.dressName;
        } else {
          finalDescription = 'פריט כללי';
        }
      } else if (dressName && !finalDescription.includes(dressName)) {
        finalDescription = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''} - ${item.description}`;
      }

      const isTaken = item.isTaken || item.takenDate !== null;
      const isReturned = item.isReturned || item.returnDate !== null;

      return {
        ...item,
        description: finalDescription,
        isTaken,
        isReturned
      };
    });

    obligations = obligations.map(ob => {
      if (ob.isManual === false || ob.productId) {
         ob.isManual = false;
         if (ob.productId) {
             const prod = priceList.find(p => String(p.id) === String(ob.productId) || String(p.legacyId) === String(ob.productId));
             if (!ob.description) {
                 const matchedItem = itemsWithLogs.find(i => {
                     const cat = i.dressItem?.dress?.priceCategory || '';
                     return prod && (cat === prod.category || cat.replace('כלול ב', '').trim() === prod.category);
                 });
                 ob.description = matchedItem ? `${matchedItem.dressItem?.dress?.name || matchedItem.description || 'פריט'} ${matchedItem.sizeText ? `מידה ${matchedItem.sizeText}` : ''} (פריט #${matchedItem.id})` : (prod ? (prod.description || prod.category || 'חיוב מחירון') : `חיוב מוצר #${ob.productId}`);
             }
             ob.productName = ob.description;
             if (prod) {
                 ob.priceCategory = prod.category;
                 ob.priceDescription = prod.description;
             }
         } else if (ob.description) {
             ob.productName = ob.description;
         } else {
             ob.productName = 'חיוב אוטומטי';
         }
      } else {
         ob.productName = ob.description ? ob.description : 'חיוב ידני';
      }
      return ob;
    });

    order = {
      ...order,
      items: itemsWithLogs,
      payments,
      obligations,
      refunds
    };

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    try { require('fs').appendFileSync(process.cwd() + '/dev_error.txt', '[GET] ' + (error.stack || error) + '\\n'); } catch (e) {}
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}

function parseSafeDate(val) {
  if (val === undefined) return undefined;
  if (!val || val === 'null' || val === 'undefined') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Keep this in sync with app/api/orders/route.js and app/api/orders/draft/route.js,
    // which parse date-only strings ("YYYY-MM-DD") as UTC midnight via `new Date(str)`.
    // Appending a local "T00:00:00" here previously shifted saved dates back by the
    // server's UTC offset (Asia/Jerusalem), storing the wrong calendar day for edited orders.
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    let parsedOrderId;
    let existingOrder;

    if (id.includes('-')) {
      existingOrder = await prisma.order.findUnique({
        where: { id }
      });
      if (existingOrder) parsedOrderId = existingOrder.orderId;
    } else {
      parsedOrderId = parseInt(id);
      if (!isNaN(parsedOrderId)) {
        existingOrder = await prisma.order.findUnique({
          where: { orderId: parsedOrderId }
        });
      }
    }

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const data = await request.json();

    // Offline data collision check.
    // data.overwriteConflict נשלח רק אחרי שהמשתמש אישר במפורש בכרטיס ההזמנה שהוא רוצה
    // לדרוס את הגרסה שבשרת — בלי זה הוא נתקע על אותה שגיאה בכל ניסיון שמירה חוזר.
    if (data.updatedAt && existingOrder.updatedAt && !data.overwriteConflict) {
      const clientUpdate = new Date(data.updatedAt).getTime();
      const serverUpdate = new Date(existingOrder.updatedAt).getTime();

      // If server is strictly newer by more than 1 second
      if (serverUpdate > clientUpdate + 1000) {
        return NextResponse.json({
          error: 'Data Collision',
          message: 'הזמנה זו עודכנה בשרת לאחר הסנכרון האחרון שלך. כדי למנוע דריסת נתונים, אנא רענן את העמוד ושלב את השינויים שלך.',
          serverUpdatedAt: existingOrder.updatedAt,
        }, { status: 409 });
      }
    }

    // Effective order dates once this update lands. Both the availability check below and
    // the dress-item picker inside the transaction have to reason about the same window,
    // otherwise the save can pass validation and still book an already-taken unit.
    const isAbroadVal = data.isAbroad !== undefined ? data.isAbroad : existingOrder.isAbroad;
    const isWeekdayVal = data.isWeekdayEvent !== undefined ? data.isWeekdayEvent : existingOrder.isWeekdayEvent;
    const isCustomDuration = isAbroadVal || isWeekdayVal;
    const eventDateVal = data.eventDate !== undefined ? parseSafeDate(data.eventDate) : existingOrder.eventDate;
    const fromDateVal = data.fromDate !== undefined ? parseSafeDate(data.fromDate) : existingOrder.fromDate;
    const toDateVal = data.toDate !== undefined ? parseSafeDate(data.toDate) : existingOrder.toDate;
    const customSpacingVal = data.customSpacing !== undefined ? data.customSpacing : existingOrder.customSpacing;
    const hasDatesVal = isCustomDuration ? (fromDateVal && toDateVal) : !!eventDateVal;

    // Spacing settings, read only when a brand-new item actually has to be matched to a unit.
    const hasNewItems = Array.isArray(data.items)
      && data.items.some(i => i.isNew && i.dressModelId && i.sizeText);
    let inventoryBufferDays = 3;
    let inventorySkipWeekends = true;
    if (hasNewItems) {
      const inventorySettings = await prisma.systemSetting.findMany({
        where: { key: { in: ['inventory_buffer_days', 'inventory_skip_weekends'] } }
      });
      const bufferSetting = inventorySettings.find(s => s.key === 'inventory_buffer_days');
      if (bufferSetting && !isNaN(parseInt(bufferSetting.value, 10))) {
        inventoryBufferDays = parseInt(bufferSetting.value, 10);
      }
      const weekendSetting = inventorySettings.find(s => s.key === 'inventory_skip_weekends');
      if (weekendSetting) inventorySkipWeekends = weekendSetting.value === 'true';
    }

    // הקשר המלאי לכל דגם שנוסף בשמירה הזו נטען כאן, מחוץ לטרנזקציה. הטעינה היא החלק
    // הכבד (שאילתות מלאי מול DB מרוחק), ומשהורצה בתוך הטרנזקציה היא דחפה אותה אל מעבר
    // ל-timeout שלה - עד "Transaction already closed" על הכתיבה שאחריה. בתוך הטרנזקציה
    // נשאר רק רענון שאילתת ההזמנות (השדה היחיד שהזמנה מקבילה יכולה לשנות) והחישוב עצמו.
    const inventoryContextByModel = new Map();
    if (hasNewItems && hasDatesVal) {
      const newItemModelIds = [...new Set(
        data.items.filter(i => i.isNew && i.dressModelId && i.sizeText).map(i => i.dressModelId)
      )];
      const contexts = await Promise.all(newItemModelIds.map(modelId => loadInventoryContext(prisma, {
        dressModelId: modelId,
        targetMinDate: isCustomDuration ? fromDateVal : eventDateVal,
        bufferDays: inventoryBufferDays,
        skipWeekends: inventorySkipWeekends,
        targetMaxDate: isCustomDuration ? toDateVal : eventDateVal,
        ignoreOrderId: parsedOrderId,
        customSpacing: customSpacingVal
      })));
      newItemModelIds.forEach((modelId, i) => inventoryContextByModel.set(modelId, contexts[i]));
    }

    // Validate inventory availability
    if (data.items && Array.isArray(data.items)) {
      const activeItems = data.items.filter(i => !i.isDeleted);
      if (activeItems.length > 0) {
        const idsNeedingLookup = activeItems
          .filter(item => !item.dressModelId && !item.isNew && item.id)
          .map(item => item.id);

        if (idsNeedingLookup.length > 0) {
          const currentItems = await prisma.orderItem.findMany({
            where: { id: { in: idsNeedingLookup } },
            include: { dressItem: true }
          });
          const currentItemById = new Map(currentItems.map(ci => [ci.id, ci]));

          for (const item of activeItems) {
            if (!item.dressModelId && !item.isNew && item.id) {
              const currentItem = currentItemById.get(item.id);
              if (currentItem && currentItem.dressItem) {
                item.dressModelId = currentItem.dressItem.dressModelId;
                item.sizeText = item.sizeText || currentItem.sizeText || currentItem.dressItem.sizeText;
              }
            }
          }
        }

        if (hasDatesVal) {
          const validationResult = await validateOrderItemsAvailability(
            activeItems,
            eventDateVal,
            isCustomDuration,
            fromDateVal,
            toDateVal,
            parsedOrderId,
            customSpacingVal
          );

          if (validationResult.error) {
            return NextResponse.json({ error: validationResult.error }, { status: 400 });
          }
          
          if (!validationResult.valid) {
            return NextResponse.json({
              error: 'אחד או יותר מהפריטים שניסית לעדכן אינם זמינים במלאי בתאריכים החדשים.',
              validationErrors: validationResult.errors
            }, { status: 409 });
          }
        }
      }
    }

    // Whether the items of this order hold their units permanently or as an expiring cart
    // follows the payments the order will have once this save lands - the same rule
    // POST /api/orders and the add-item route apply. Writing 'confirmed' onto every saved
    // item, as this route used to, pinned the dresses of an unpaid cart forever the moment
    // someone opened it and pressed save.
    const [storedPayments, storedItems, storedObligations] = await Promise.all([
      prisma.payment.findMany({
        where: { orderId: parsedOrderId },
        select: { id: true, amount: true, paymentMethod: true, isDeleted: true }
      }),
      prisma.orderItem.findMany({
        where: { orderId: parsedOrderId },
        select: {
          id: true, cartStatus: true, isDeleted: true,
          sizeText: true, neckAlteration: true, sleeveAlteration: true,
          lengthAlteration: true, alterationDetails: true, alterationDone: true,
          barcode: true
        }
      }),
      // המצב הקודם של ההתחייבויות — כדי לזהות ביטול/שחזור ולרשום אותו ביומן בשם מפורש
      prisma.paymentObligation.findMany({
        where: { orderId: parsedOrderId },
        select: { id: true, isDeleted: true }
      })
    ]);
    const storedItemById = new Map(storedItems.map(i => [i.id, i]));
    const storedPaymentById = new Map(storedPayments.map(p => [p.id, p]));
    const storedObligationById = new Map(storedObligations.map(o => [o.id, o]));

    // מחזיר את שם פעולת היומן לרשומה שמבוטלת/משוחזרת בשמירה הזו (או null לעדכון רגיל)
    const cancelActionFor = (storedMap, id, nowDeleted, cancelAction, restoreAction) => {
      const wasDeleted = !!storedMap.get(id)?.isDeleted;
      if (!!nowDeleted && !wasDeleted) return cancelAction;
      if (!nowDeleted && wasDeleted) return restoreAction;
      return null;
    };
    const paymentsAfterSave = new Map(storedPayments.map(p => [p.id, p]));
    if (Array.isArray(data.payments)) {
      data.payments.forEach((p, idx) => {
        if (p.id) paymentsAfterSave.set(p.id, { ...paymentsAfterSave.get(p.id), ...p });
        else if (p.isNew) paymentsAfterSave.set(`new-${idx}`, p);
      });
    }
    const holdIsPermanent = orderHasPermanentHold({
      legacyId: existingOrder.legacyId,
      payments: Array.from(paymentsAfterSave.values()),
      items: storedItems
    });

    // A draft or reservation shell opened straight from its own card (e.g. the "open the
    // draft in a new tab" link on the new-order screen) is saved through this same PUT route,
    // which never used to touch `status` beyond echoing back whatever the client already had
    // loaded - so a shell that picked up a real payment here stayed stuck showing 'טיוטה'
    // forever, even though its items had already flipped to a permanent ('confirmed') hold.
    // Promote it out of the shell status on the same signal that promotes the items, so the
    // two can't drift apart the way they did for order 26125.
    const wasShellOrder = existingOrder.status === DRAFT_ORDER_STATUS || existingOrder.status === RESERVED_ORDER_STATUS;
    let shellExitStatus;
    if (wasShellOrder && holdIsPermanent) {
      const totalPaidForStatus = Array.from(paymentsAfterSave.values())
        .reduce((sum, p) => sum + (p.isDeleted ? 0 : (parseFloat(p.amount) || 0)), 0);
      const totalRequiredForStatus = data.totalAmount !== undefined && data.totalAmount !== null
        ? (parseFloat(data.totalAmount) || 0)
        : (existingOrder.totalAmount || 0);
      shellExitStatus = deriveConfirmedOrderStatus(totalPaidForStatus, totalRequiredForStatus, 'חדש');
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const parsedEventDate = parseSafeDate(data.eventDate);
      const parsedFromDate = parseSafeDate(data.fromDate);
      const parsedToDate = parseSafeDate(data.toDate);
      const parsedReturnDate = parseSafeDate(data.returnDate);
      // Developer-only edit (see requiredLevel: 'מתכנת' gate in the client) - shifts the
      // REFUND_DAYS_FROM_ORDER window in lib/pricingEngine.js, so it's normally immutable
      // after creation (app/api/orders/route.js only sets it once, at order creation).
      const parsedOrderDate = parseSafeDate(data.orderDate);

      // 1. Update general order details
      const order = await tx.order.update({
        where: { orderId: parsedOrderId },
        data: {
          totalAmount: data.totalAmount !== undefined && data.totalAmount !== null ? (parseFloat(data.totalAmount) || 0) : undefined,
          orderDate: parsedOrderDate,
          eventDate: parsedEventDate,
          eventDateHebrew: data.eventDateHebrew !== undefined ? data.eventDateHebrew : (parsedEventDate ? getHebrewDateString(parsedEventDate) : undefined),
          returnDate: parsedReturnDate,
          isAbroad: data.isAbroad !== undefined ? data.isAbroad : undefined,
          isWeekdayEvent: data.isWeekdayEvent !== undefined ? data.isWeekdayEvent : undefined,
          fromDate: parsedFromDate,
          toDate: parsedToDate,
          customSpacing: data.customSpacing !== undefined ? (data.customSpacing === null || data.customSpacing === '' ? null : parseInt(data.customSpacing, 10)) : undefined,
          notes: data.notes !== undefined ? data.notes : undefined,
          status: shellExitStatus !== undefined ? shellExitStatus : (data.status !== undefined ? data.status : undefined),
          hasSignedRegulations: data.hasSignedRegulations !== undefined ? data.hasSignedRegulations : undefined,
        }
      });

      // 2. Update order items (alterations, size, deletions) and create new items
      let addedItem = false;
      if (data.items && Array.isArray(data.items)) {
        for (let idx = 0; idx < data.items.length; idx++) {
          const item = data.items[idx];
          if (item.id) {
            const stored = storedItemById.get(item.id);
            const wasDeleted = stored?.isDeleted || false;
            const nowDeleted = !!item.isDeleted;
            // Stamped at save time (not when the checkbox was toggled in the UI) so that a
            // cancel+add done in the same sitting always shares one "now" - see
            // computeOrderObligations' cancellation-fee credit window in lib/pricingEngine.js.
            const deletedAtVal = nowDeleted && !wasDeleted ? new Date()
              : (!nowDeleted && wasDeleted ? null : undefined);
            // מחיקה/שחזור של פריט נרשמים בשם מפורש, כדי שבהיסטוריית הפריט יהיה ברור
            // שמדובר בביטול הפריט מההזמנה ולא ב"עדכון" שגרתי של מידה או תיקון.
            const itemAuditAction = (nowDeleted && !wasDeleted) ? 'CANCEL_ITEM'
              : ((!nowDeleted && wasDeleted) ? 'RESTORE_ITEM' : null);
            const normalizedNeck = (item.neckAlteration === true || item.neckAlteration === 1 || item.neckAlteration === '1') ? 1 : (item.neckAlteration === null ? null : 0);
            const normalizedSleeve = (item.sleeveAlteration === true || item.sleeveAlteration === 1 || item.sleeveAlteration === '1') ? 1 : (item.sleeveAlteration === null ? null : 0);
            const normalizedLength = (item.lengthAlteration !== undefined && item.lengthAlteration !== null && item.lengthAlteration !== '') ? String(item.lengthAlteration) : null;
            const normalizedBarcode = item.barcode || item.dressItem?.barcode || undefined;
            // Prisma's @updatedAt stamps this row's updatedAt on *any* update() call, even one
            // that changes nothing - and orderItemEditWindow.js's 15-minute full-edit lock reads
            // that same updatedAt. Every save used to re-touch every item in the order (e.g. on
            // exit), silently re-arming the edit window for rows nobody actually edited. Only
            // writing when a field truly differs keeps updatedAt meaningful as a real "last
            // edited" marker.
            const hasRealChange = !stored || (
              item.sizeText !== stored.sizeText ||
              normalizedNeck !== stored.neckAlteration ||
              normalizedSleeve !== stored.sleeveAlteration ||
              normalizedLength !== stored.lengthAlteration ||
              item.alterationDetails !== stored.alterationDetails ||
              !!item.alterationDone !== !!stored.alterationDone ||
              nowDeleted !== wasDeleted ||
              (normalizedBarcode !== undefined && normalizedBarcode !== stored.barcode)
            );
            if (hasRealChange) {
              await tx.orderItem.update(auditAs(itemAuditAction, {
                where: { id: item.id },
                data: {
                  sizeText: item.sizeText,
                  neckAlteration: normalizedNeck,
                  sleeveAlteration: normalizedSleeve,
                  lengthAlteration: normalizedLength,
                  alterationDetails: item.alterationDetails,
                  alterationDone: item.alterationDone,
                  isDeleted: item.isDeleted,
                  deletedAt: deletedAtVal,
                  // GET synthesizes isTaken/isReturned/takenDate/returnDate for display when the
                  // stored columns are empty (falling back to barcode presence and eventDate).
                  // Writing those inferred values back would turn a guess into a stored fact -
                  // e.g. an item that merely has a barcode would become permanently "taken" and
                  // could no longer be removed from the order. The rental lifecycle is owned by
                  // the rentals/returns scan routes, so this general save leaves it untouched.
                  barcode: normalizedBarcode
                  // cartStatus is not decided per item - it follows the order's payment
                  // state, applied to the whole order in step 5 below.
                }
              }));
            }
          } else if (item.isNew) {
            // A row the user added but never filled in (no model/size picked) is skipped
            // rather than aborting the whole save.
            if (!item.dressModelId || !item.sizeText) {
              continue;
            }

            // Pick the physical unit the same way POST /api/orders/[id]/items does. Matching
            // on notInUse/inRepair alone ignores the booking calendar, so this could hand out
            // a unit already rented for these dates while an actually free one sat unused.
            if (!hasDatesVal) {
              throw new Error('לא ניתן להוסיף פריט להזמנה ללא תאריכים');
            }

            // מרעננים את ההזמנות דרך ה-tx ומחשבים מחדש, כדי שהיחידה שתיבחר תיבדק מול
            // מצב המלאי ברגע הכתיבה ולא מול מה שנטען לפני פתיחת הטרנזקציה.
            const freshContext = await refreshInventoryBookings(tx, inventoryContextByModel.get(item.dressModelId));
            const availability = computeInventoryAvailability(freshContext);
            const sizeAvailability = availability.find(
              a => (a.sizeText || a.size || 'כללי') === item.sizeText
            );
            const availableItem = (sizeAvailability?.availableQuantity > 0 && sizeAvailability.itemIds?.length)
              ? { id: sizeAvailability.itemIds[0] }
              : null;

            if (availableItem) {
              await tx.orderItem.create({
                data: {
                  orderId: parsedOrderId,
                  dressItemId: availableItem.id,
                  sizeText: item.sizeText,
                  quantity: 1,
                  neckAlteration: (item.neckAlteration === true || item.neckAlteration === 1 || item.neckAlteration === '1') ? 1 : (item.neckAlteration === null ? null : 0),
                  sleeveAlteration: (item.sleeveAlteration === true || item.sleeveAlteration === 1 || item.sleeveAlteration === '1') ? 1 : (item.sleeveAlteration === null ? null : 0),
                  lengthAlteration: (item.lengthAlteration !== undefined && item.lengthAlteration !== null && item.lengthAlteration !== '') ? String(item.lengthAlteration) : null,
                  alterationDetails: item.alterationDetails,
                  alterationDone: false,
                  isDeleted: false,
                  cartStatus: holdIsPermanent ? 'confirmed' : 'pending',
                  finalPrice: 0 // Will be calculated by pricing engine
                }
              });
              addedItem = true;
            } else {
              throw new Error(`אין פריט פנוי במלאי עבור דגם זה במידה ${item.sizeText}`);
            }
          }
        }
      }

      // 3. Process manual obligations
      if (data.obligations && Array.isArray(data.obligations)) {
        for (const obs of data.obligations) {
          if (obs.id) {
            const obsAuditAction = cancelActionFor(storedObligationById, obs.id, obs.isDeleted, 'CANCEL_OBLIGATION', 'RESTORE_OBLIGATION');
            await tx.paymentObligation.update(auditAs(obsAuditAction, {
              where: { id: obs.id },
              data: {
                isDeleted: obs.isDeleted,
                description: obs.description,
                amount: parseFloat(obs.amount) || 0
              }
            }));
          } else if (obs.isNew) {
            await tx.paymentObligation.create({
              data: {
                orderId: parsedOrderId,
                description: obs.description,
                amount: parseFloat(obs.amount) || 0,
                isManual: true,
                createdAt: new Date(obs.createdAt)
              }
            });
          }
        }
      }

      // 4. Process payments
      if (data.payments && Array.isArray(data.payments)) {
        for (const p of data.payments) {
          if (p.id) {
            const paymentAuditAction = cancelActionFor(storedPaymentById, p.id, p.isDeleted, 'CANCEL_PAYMENT', 'RESTORE_PAYMENT');
            await tx.payment.update(auditAs(paymentAuditAction, {
              where: { id: p.id },
              data: {
                isDeleted: p.isDeleted,
                paymentMethod: p.paymentMethod,
                notes: p.notes,
                amount: parseFloat(p.amount) || 0
              }
            }));
          } else if (p.isNew) {
            await tx.payment.create({
              data: {
                orderId: parsedOrderId,
                paymentMethod: p.paymentMethod,
                notes: p.notes,
                amount: parseFloat(p.amount) || 0,
                paymentDate: new Date(p.paymentDate)
              }
            });
          }
        }
      }

      // 5. An order that is paid, or approved by a manager for payment tracked afterwards,
      // has no 15 minute timer on any of its dresses - including rows that were added while
      // it was still a cart. Only a cart that is still unpaid keeps its running timer.
      if (holdIsPermanent) {
        await tx.orderItem.updateMany({
          where: { orderId: parsedOrderId, isDeleted: false, cartStatus: 'pending' },
          data: { cartStatus: 'confirmed', cartStatusDate: new Date() }
        });
      } else if (addedItem) {
        // Still a cart: adding a dress gives the whole order a fresh 15 minutes, so the
        // rows picked first do not expire while the customer is still choosing.
        await tx.orderItem.updateMany({
          where: { orderId: parsedOrderId, cartStatus: 'pending' },
          data: { cartStatusDate: new Date() }
        });
      }

      // 6. Record debt approval if provided
      if (data.debtApprovedBy) {
        const currentTotalPaid = data.payments ? data.payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) : 0;
        const currentTotalRequired = data.totalAmount || 0;
        const currentDebt = currentTotalRequired - currentTotalPaid;
        
        // אישור החוב אינו כתיבה למודל כלשהו אלא רישום עצמאי של אישור העובד/מנהל.
        // eslint-disable-next-line no-restricted-syntax -- אין כתיבה מקבילה שתייצר שורה אוטומטית
        await tx.auditLog.create({
          data: {
            entityType: 'Order',
            entityId: parsedOrderId.toString(),
            action: 'DEBT_APPROVED',
            changesJson: JSON.stringify({ approvedDebtAmount: currentDebt }),
            employeeId: data.debtApprovedBy
          }
        });
      }

      return order;
    }, { timeout: 30000, maxWait: 15000 });

    // Recalculate obligations asynchronously after updating order details
    await recalculateOrderObligations(parsedOrderId);

    // Fetch the fully updated order to return to the client.
    // These queries are independent of each other - fetch them concurrently.
    const [finalOrderRaw, items, payments, refunds, obligationsRaw, priceList] = await Promise.all([
      prisma.order.findUnique({
        where: { orderId: parsedOrderId },
        include: {
          customer: true,
          employee: true
        }
      }),
      fetchOrderItemsWithDress(parsedOrderId),
      prisma.payment.findMany({ where: { orderId: parsedOrderId } }),
      prisma.refund.findMany({ where: { orderId: parsedOrderId } }),
      prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } }),
      prisma.priceList.findMany({ select: { id: true, legacyId: true, category: true, description: true, fromSize: true, toSize: true, price: true } })
    ]);

    let finalOrder = finalOrderRaw;
    let obligations = obligationsRaw;

    const uniquePrefixes = new Set();
    items.forEach(i => {
      const dressName = i.dressItem?.dress?.name;
      const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
      if (!dressName && prefix !== null && prefix !== undefined) {
        const numPfx = parseInt(prefix, 10);
        if (!isNaN(numPfx)) uniquePrefixes.add(numPfx);
      }
    });

    let dressModels = [];
    if (uniquePrefixes.size > 0) {
      dressModels = await prisma.dressModel.findMany({
        where: { barcodePrefix: { in: Array.from(uniquePrefixes) } },
        select: { barcodePrefix: true, name: true }
      });
    }
    const dressModelMap = new Map();
    dressModels.forEach(m => {
      if (m.barcodePrefix !== null && m.barcodePrefix !== undefined) {
        dressModelMap.set(Number(m.barcodePrefix), m.name);
        dressModelMap.set(String(m.barcodePrefix), m.name);
      }
    });
    
    const itemsWithLogs = items.map(item => {
      let dressName = item.dressItem?.dress?.name;
      const prefix = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
      
      if (!dressName && prefix !== null && prefix !== undefined) {
        dressName = dressModelMap.get(Number(prefix)) || dressModelMap.get(String(prefix));
      }
      
      let finalDescription = item.description;
      if (!finalDescription || finalDescription === 'פריט כללי') {
        if (dressName) {
          finalDescription = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''}`;
        } else if (item.dressItem?.dressName) {
          finalDescription = item.dressItem.dressName;
        } else {
          finalDescription = 'פריט כללי';
        }
      } else if (dressName && !finalDescription.includes(dressName)) {
        finalDescription = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''} - ${item.description}`;
      }

      const isTaken = item.isTaken || item.takenDate !== null;
      const isReturned = item.isReturned || item.returnDate !== null;

      return {
        ...item,
        description: finalDescription,
        isTaken,
        isReturned
      };
    });

    obligations = obligations.map(ob => {
      if (ob.isManual === false || ob.productId) {
         ob.isManual = false;
         if (ob.productId) {
             const prod = priceList.find(p => String(p.id) === String(ob.productId) || String(p.legacyId) === String(ob.productId));
             if (!ob.description) {
                 const matchedItem = itemsWithLogs.find(i => {
                     const cat = i.dressItem?.dress?.priceCategory || '';
                     return prod && (cat === prod.category || cat.replace('כלול ב', '').trim() === prod.category);
                 });
                 ob.description = matchedItem ? `${matchedItem.dressItem?.dress?.name || matchedItem.description || 'פריט'} ${matchedItem.sizeText ? `מידה ${matchedItem.sizeText}` : ''} (פריט #${matchedItem.id})` : (prod ? (prod.description || prod.category || 'חיוב מחירון') : `חיוב מוצר #${ob.productId}`);
             }
             ob.productName = ob.description;
             if (prod) {
                 ob.priceCategory = prod.category;
                 ob.priceDescription = prod.description;
             }
         } else if (ob.description) {
             ob.productName = ob.description;
         } else {
             ob.productName = 'חיוב אוטומטי';
         }
      } else {
         ob.productName = ob.description ? ob.description : 'חיוב ידני';
      }
      return ob;
    });
    
    finalOrder = { ...finalOrder, items: itemsWithLogs, payments, obligations, refunds };

    return NextResponse.json(finalOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    try { require('fs').appendFileSync(process.cwd() + '/dev_error.txt', '[PUT] ' + (error.stack || error) + '\\n'); } catch (e) {}
    return NextResponse.json(
      { error: 'Failed to update order details', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    let parsedOrderId;
    let order;

    if (id.includes('-')) {
      order = await prisma.order.findUnique({
        where: { id }
      });
      if (order) parsedOrderId = order.orderId;
    } else {
      parsedOrderId = parseInt(id);
      if (!isNaN(parsedOrderId)) {
        order = await prisma.order.findUnique({
          where: { orderId: parsedOrderId }
        });
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Check if order can be deleted
    const items = await prisma.orderItem.findMany({
      where: { orderId: parsedOrderId, isDeleted: false }
    });

    const hasRental = items.some(item => item.isTaken || item.isReturned);
    if (hasRental) {
      return NextResponse.json({ error: 'Cannot delete order with rental history' }, { status: 400 });
    }

    // הפריטים וההתחייבויות שמבוטלים בפועל — נאספים לפני העדכון כדי לרשום לכל אחד מהם
    // שורת היסטוריה משלו. updateMany לא עובר דרך תוסף היומן, ולכן עד כה ביטול הזמנה
    // לא הותיר שום רישום בהיסטוריה של הפריט או של ההתחייבות — רק בהזמנה עצמה.
    const [itemsToCancel, obligationsToCancel, cancelledBy] = await Promise.all([
      prisma.orderItem.findMany({
        where: { orderId: parsedOrderId, isDeleted: false },
        select: { id: true, description: true }
      }),
      prisma.paymentObligation.findMany({
        where: { orderId: parsedOrderId, isDeleted: false },
        select: { id: true, amount: true, description: true }
      }),
      getActingEmployeeId()
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.order.update(auditAs(
        'CANCEL_ORDER',
        { where: { orderId: parsedOrderId }, data: { isDeleted: true } },
        { isDeleted: { from: false, to: true } }
      ));
      await tx.orderItem.updateMany({
        where: { orderId: parsedOrderId },
        data: { isDeleted: true }
      });
      await tx.paymentObligation.updateMany({
        where: { orderId: parsedOrderId },
        data: { isDeleted: true }
      });

      // שורות היומן האוטומטיות של Order נשמרות תחת ה-UUID (result.id), בעוד טאב ההיסטוריה
      // בכרטיס מחפש לפי מספר ההזמנה — ולכן ביטול ההזמנה לא היה מופיע שם. הרישום המפורש
      // הזה נשמר תחת מספר ההזמנה, בדיוק כמו רישום אישור החוב בשמירה.
      const cancelLog = (entityType, entityId, extra) => ({
        entityType,
        entityId: String(entityId),
        action: 'CANCEL_ORDER',
        changesJson: JSON.stringify({
          isDeleted: { from: false, to: true },
          orderId: parsedOrderId,
          note: `בוטל עקב ביטול הזמנה #${parsedOrderId}`,
          ...extra
        }),
        employeeId: cancelledBy
      });

      // הפריטים וההתחייבויות מבוטלים ב-updateMany (שאינו עובר דרך תוסף היומן), ולכן זהו הרישום
      // היחיד שלהם ולא כפילות. שורת ההזמנה נרשמת כאן תחת מספר ההזמנה, כי השורה האוטומטית
      // של order.update נשמרת תחת ה-UUID ולא נראית בטאב ההיסטוריה של הכרטיס.
      // eslint-disable-next-line no-restricted-syntax -- updateMany אינו מייצר שורות יומן
      await tx.auditLog.createMany({
        data: [
          cancelLog('Order', parsedOrderId, {
            note: `ההזמנה בוטלה (${itemsToCancel.length} פריטים, ${obligationsToCancel.length} התחייבויות תשלום)`
          }),
          ...itemsToCancel.map(item => cancelLog('OrderItem', item.id, { description: item.description })),
          ...obligationsToCancel.map(obs => cancelLog('PaymentObligation', obs.id, { amount: obs.amount, description: obs.description }))
        ]
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
