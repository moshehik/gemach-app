import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { recalculateOrderObligations } from '../../../../../lib/pricingEngine';
import { loadInventoryContext, refreshInventoryBookings, computeInventoryAvailability } from '../../../../../lib/inventory';
import { orderHasPermanentHold } from '../../../../../lib/inventoryHold';

// See the sibling [itemId] route: only caller-fixable rules should surface as 400, so a
// genuine server fault is not mistaken for a bad request.
const ruleError = (message) => Object.assign(new Error(message), { isRuleViolation: true });

// כמו בראוט האחות: timeout מפורש כרשת ביטחון, על גבי הטרנזקציה הקצרה עצמה.
const TX_OPTIONS = { timeout: 30000, maxWait: 15000 };

const findSizeAvailability = (availability, sizeText) =>
  availability.find(a => (a.sizeText || a.size || 'כללי') === sizeText);

const hasFreeUnit = (sizeAvail) =>
  !!sizeAvail && sizeAvail.availableQuantity > 0 && !!sizeAvail.itemIds && sizeAvail.itemIds.length > 0;

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const itemData = await request.json();

    if (!itemData.dressModelId || !itemData.sizeText) {
      return NextResponse.json({ error: 'יש לבחור דגם ומידה' }, { status: 400 });
    }

    // הקריאות (הגדרות + חישוב הזמינות) רצות מחוץ לטרנזקציה: מול DB מרוחק הן מספיקות
    // כדי לחרוג מ-5 השניות של ברירת המחדל לטרנזקציה אינטראקטיבית, ואז ה-create שאחריהן
    // נופל על "Transaction already closed". הזמינות מאומתת שוב בתוך הטרנזקציה.
    const [order, settingsRaw] = await Promise.all([
      prisma.order.findUnique({
        where: { orderId: parsedId },
        include: {
          payments: { select: { amount: true, paymentMethod: true, isDeleted: true } },
          items: { select: { cartStatus: true, isDeleted: true } }
        }
      }),
      prisma.systemSetting.findMany()
    ]);
    if (!order) throw ruleError('הזמנה לא נמצאה');

    // An order that was already paid - or that a manager approved to leave with the
    // payment tracked afterwards - is not a shopping cart any more, so a dress added to
    // it has to be held permanently. Creating every item as 'pending' put a 15 minute
    // expiry on it (and restarted the clock on its siblings), and the hold window in
    // lib/inventory.js then handed the unit back to the pool while the customer was
    // already booked for it.
    const holdIsPermanent = orderHasPermanentHold(order);

    let bufferDays = 3;
    let skipWeekends = true;
    const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
    if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
    const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
    if (weekendSetting) skipWeekends = weekendSetting.value === 'true';

    const newOrderIsAbroad = order.isAbroad || order.isWeekdayEvent;
    let targetMinDate, targetMaxDate;
    if (newOrderIsAbroad) {
       if (!order.fromDate || !order.toDate) throw ruleError('חסרים תאריכים להזמנת חו"ל');
       targetMinDate = order.fromDate;
       targetMaxDate = order.toDate;
    } else {
       if (!order.eventDate) throw ruleError('חסר תאריך אירוע להזמנה');
       targetMinDate = order.eventDate;
       targetMaxDate = order.eventDate;
    }

    const inventoryContext = await loadInventoryContext(prisma, {
      dressModelId: itemData.dressModelId,
      targetMinDate,
      bufferDays,
      skipWeekends,
      targetMaxDate,
      ignoreOrderId: parsedId,
      customSpacing: order.customSpacing ?? null
    });

    // כשל מוקדם על מצב המלאי הנוכחי, בלי לפתוח טרנזקציה לחינם. האימות הקובע הוא זה
    // שבתוך הטרנזקציה, על הזמנות שנשלפו מחדש דרך ה-tx.
    if (!hasFreeUnit(findSizeAvailability(computeInventoryAvailability(inventoryContext), itemData.sizeText))) {
      throw ruleError(`אין פריט פנוי במלאי עבור דגם זה במידה ${itemData.sizeText} בתאריך המבוקש`);
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const freshContext = await refreshInventoryBookings(tx, inventoryContext);
      const sizeAvail = findSizeAvailability(computeInventoryAvailability(freshContext), itemData.sizeText);

      if (!hasFreeUnit(sizeAvail)) {
        throw ruleError(`אין פריט פנוי במלאי עבור דגם זה במידה ${itemData.sizeText} בתאריך המבוקש`);
      }

      const dressItemIdToUse = sizeAvail.itemIds[0];

      // Create the item
      const newItem = await tx.orderItem.create({
        data: {
          orderId: parsedId,
          dressItemId: dressItemIdToUse,
          sizeText: itemData.sizeText,
          quantity: 1,
          neckAlteration: itemData.neckAlteration !== undefined && itemData.neckAlteration !== null && itemData.neckAlteration !== '' ? parseInt(itemData.neckAlteration) : null,
          sleeveAlteration: itemData.sleeveAlteration !== undefined && itemData.sleeveAlteration !== null && itemData.sleeveAlteration !== '' ? parseInt(itemData.sleeveAlteration) : null,
          lengthAlteration: itemData.lengthAlteration !== undefined && itemData.lengthAlteration !== null && itemData.lengthAlteration !== '' ? String(itemData.lengthAlteration) : null,
          alterationDetails: itemData.alterationDetails || null,
          alterationDone: false,
          isDeleted: false,
          cartStatus: holdIsPermanent ? 'confirmed' : 'pending',
          cartStatusDate: new Date(),
          finalPrice: 0 // Will be calculated by pricing engine
        }
      });

      if (holdIsPermanent) {
        // An order with a permanent hold has no timer at all. Any row still left in cart
        // state - added before the order was paid for, or before this rule existed - is
        // cleared here, so no dress of a booked order is waiting to be released.
        await tx.orderItem.updateMany({
          where: {
            orderId: parsedId,
            isDeleted: false,
            cartStatus: 'pending'
          },
          data: {
            cartStatus: 'confirmed',
            cartStatusDate: new Date()
          }
        });
      } else {
        // Still a cart: adding a dress restarts the 15 minute window for the whole order.
        await tx.orderItem.updateMany({
          where: {
            orderId: parsedId,
            cartStatus: 'pending'
          },
          data: {
            cartStatusDate: new Date()
          }
        });
      }

      // אין רישום ידני ליומן: תוסף ה-audit ב-app/lib/prisma.js כבר רושם שורת CREATE
      // עם אותו תוכן (ובנוסף עם מזהה העובד המבצע). רישום נוסף כאן יצר שורה כפולה בהיסטוריה.

      return newItem;
    }, TX_OPTIONS);

    // Recalculate obligations asynchronously after adding item
    await recalculateOrderObligations(parsedId);

    // Fetch the fully updated order data to return.
    // finalOrder/items/payments/obligations/priceList are independent - fetch concurrently.
    const [finalOrderRaw, items, payments, obligationsRaw, priceList] = await Promise.all([
      prisma.order.findUnique({ where: { orderId: parsedId }, include: { customer: true } }),
      prisma.orderItem.findMany({
        where: { orderId: parsedId },
        include: { dressItem: { include: { dress: true } } }
      }),
      prisma.payment.findMany({ where: { orderId: parsedId } }),
      prisma.paymentObligation.findMany({ where: { orderId: parsedId } }),
      prisma.priceList.findMany()
    ]);

    let finalOrder = finalOrderRaw;

    const itemIds = items.map(i => i.id);
    const uniquePrefixes = new Set();
    items.forEach(i => {
      const dressName = i.dressItem?.dress?.name;
      const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
      if (!dressName && prefix) {
        uniquePrefixes.add(prefix);
      }
    });

    // auditLogs and dressModels both depend on the items fetched above - fetch concurrently.
    const [auditLogs, dressModels] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entityType: 'OrderItem',
          entityId: { in: itemIds }
        },
        orderBy: { createdAt: 'desc' }
      }),
      uniquePrefixes.size > 0
        ? prisma.dressModel.findMany({
            where: { barcodePrefix: { in: Array.from(uniquePrefixes) } },
            select: { barcodePrefix: true, name: true }
          })
        : Promise.resolve([])
    ]);
    const dressModelMap = new Map(dressModels.filter(m => m.barcodePrefix).map(m => [m.barcodePrefix, m.name]));

    const itemsWithLogs = items.map(item => {
      let dressName = item.dressItem?.dress?.name;
      const prefix = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
      
      if (!dressName && prefix) {
        dressName = dressModelMap.get(prefix);
      }
      
      let finalDescription = item.description || 'פריט כללי';
      if (dressName) {
        finalDescription = `${dressName} (קוד: ${prefix || ''})`;
      } else if (item.description) {
        finalDescription = item.description;
      }

      return {
        ...item,
        description: finalDescription,
        auditLogs: auditLogs.filter(log => log.entityId === item.id)
      };
    });

    let obligations = obligationsRaw.map(ob => {
      if (ob.isManual === false || ob.productId) {
         ob.isManual = false;
         if (ob.productId) {
             const prod = priceList.find(p => p.id === ob.productId || String(p.legacyId) === String(ob.productId));
             if (!ob.description) {
                 const matchedItem = itemsWithLogs.find(i => {
                     const cat = i.dressItem?.dress?.priceCategory || '';
                     return prod && (cat === prod.category || cat.replace('כלול ב', '').trim() === prod.category);
                 });
                 ob.description = matchedItem ? `${matchedItem.dressItem?.dress?.name || 'פריט'} ${matchedItem.sizeText ? `מידה ${matchedItem.sizeText}` : ''} (פריט #${matchedItem.id})` : (prod ? prod.description : 'חיוב מחירון');
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
    
    finalOrder = { ...finalOrder, items: itemsWithLogs, payments, obligations };

    return NextResponse.json(finalOrder);

  } catch (error) {
    console.error('Error adding order item:', error);
    return NextResponse.json(
      { error: error.isRuleViolation ? error.message : `שגיאת מערכת בשמירת הפריט: ${error.message}` },
      { status: error.isRuleViolation ? 400 : 500 }
    );
  }
}
