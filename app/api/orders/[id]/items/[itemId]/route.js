import { NextResponse } from 'next/server';
import prisma, { auditAs } from '../../../../../lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { recalculateOrderObligations } from '../../../../../../lib/pricingEngine';
import { loadInventoryContext, refreshInventoryBookings, computeInventoryAvailability } from '../../../../../../lib/inventory';
import { isWithinItemEditWindow, ITEM_EDIT_WINDOW_MINUTES } from '../../../../../../lib/orderItemEditWindow';

// Rules the caller can actually do something about (missing dates, nothing free in stock).
// Everything else is a fault on our side: reporting those as 400 too made a server crash
// look like a bad request, which is how "Maximum call stack size exceeded" spent a while
// disguised as a validation failure.
const ruleError = (message) => Object.assign(new Error(message), { isRuleViolation: true });

// רשת ביטחון על גבי הקיצור של הטרנזקציה עצמה: גם טרנזקציה של כתיבה אחת יכולה לחרוג
// מ-5 השניות שהן ברירת המחדל של Prisma כשה-DB מרוחק ומגיב לאט לרגע. במיוחד ב-dev,
// שבו הידור ראשון של המודולים יכול ליפול בדיוק באמצע הטרנזקציה ולהוסיף לה עשרות שניות.
const TX_OPTIONS = { timeout: 30000, maxWait: 15000 };

const formatVal = (val) => val === undefined || val === null ? '' : String(val);

// שדות שעריכתם משפיעה על ההזמנה ועל הסכומים, ולכן כפופים לחלון העריכה
const LOCKED_FIELDS = ['dressItemId', 'sizeText', 'neckAlteration', 'sleeveAlteration', 'lengthAlteration'];
const AUDITED_FIELDS = [...LOCKED_FIELDS, 'alterationDetails', 'alterationDone'];

const findSizeAvailability = (availability, sizeText) =>
  availability.find(a => (a.sizeText || a.size || 'כללי') === sizeText);

const hasFreeUnit = (sizeAvail) =>
  !!sizeAvail && sizeAvail.availableQuantity > 0 && !!sizeAvail.itemIds && sizeAvail.itemIds.length > 0;

const parseAlteration = (val) =>
  val !== undefined && val !== null && val !== '' ? parseInt(val) : null;

const buildUpdateData = (itemData, dressItemId) => ({
  dressItemId,
  sizeText: itemData.sizeText,
  neckAlteration: parseAlteration(itemData.neckAlteration),
  sleeveAlteration: parseAlteration(itemData.sleeveAlteration),
  lengthAlteration: itemData.lengthAlteration !== undefined && itemData.lengthAlteration !== null && itemData.lengthAlteration !== '' ? String(itemData.lengthAlteration) : null,
  alterationDetails: itemData.alterationDetails || null,
  alterationDone: itemData.alterationDone || false
});

const diffFields = (item, updateData) => {
  const changes = {};
  AUDITED_FIELDS.forEach(field => {
    if (formatVal(item[field]) !== formatVal(updateData[field])) {
      changes[field] = { from: item[field], to: updateData[field] };
    }
  });
  return changes;
};

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id, itemId } = resolvedParams;
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const itemData = await request.json();

    // dressModelId לא נדרש כאן באופן גורף: פריטים שהוגרו מ-Access בלי DressItem מקושר
    // (currentItem.dressItem === null) מזוהים לפי barcodePrefix/legacyId ולא מחזיקים dressModelId
    // בכלל — עדיין צריך להיות אפשר לערוך את התיקונים שלהם.
    if (!itemData.sizeText) {
      return NextResponse.json({ error: 'יש להזין מידה' }, { status: 400 });
    }

    // כל העבודה שהיא קריאה בלבד רצה מחוץ לטרנזקציה. כשההגדרות וחישוב הזמינות (שאילתות
    // מלאי כבדות) רצו בתוכה, מול DB מרוחק הן חרגו מ-5 השניות שהן ברירת המחדל של Prisma
    // לטרנזקציה אינטראקטיבית, והכתיבה שבסוף נפלה על
    // "Transaction already closed: A query cannot be executed on an expired transaction".
    // אף כלל עסקי לא ויתר: כל הבדיקות מאומתות שוב בתוך הטרנזקציה הקצרה למטה, על נתונים
    // טריים שנשלפו דרך ה-tx עצמו.
    const [order, currentItem, settingsRaw] = await Promise.all([
      prisma.order.findUnique({ where: { orderId: parsedId } }),
      prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { dressItem: true }
      }),
      getAllCachedSettings()
    ]);

    if (!order) throw ruleError('הזמנה לא נמצאה');
    if (!currentItem) throw ruleError('פריט בהזמנה לא נמצא');

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

    // dressModelId הנוכחי של הפריט (אם יש לו DressItem מקושר בכלל — פריטי Access ישנים לא)
    const currentDressModelId = currentItem.dressItem?.dressModelId ?? null;
    const incomingDressModelId = itemData.dressModelId ?? null;
    const sizeChanged = currentItem.sizeText !== itemData.sizeText;
    const modelChanged = currentDressModelId !== null && incomingDressModelId !== null && currentDressModelId !== incomingDressModelId;

    // בודקים זמינות מלאי מחדש רק כשיש בכלל דגם לבדוק מולו (הרכיב לא מציג בורר דגם/מידה
    // לפריטים ישנים בלי dressModelId, כך שאין להם ממה "לשנות" בפועל).
    const needsAvailabilityCheck = (modelChanged || sizeChanged) && !!(incomingDressModelId || currentDressModelId);

    let inventoryContext = null;
    if (needsAvailabilityCheck) {
      if (currentItem.isTaken) {
        throw ruleError('לא ניתן לשנות דגם/מידה לפריט שכבר נלקח. יש להחזירו תחילה.');
      }

      inventoryContext = await loadInventoryContext(prisma, {
        dressModelId: incomingDressModelId || currentDressModelId,
        targetMinDate,
        bufferDays,
        skipWeekends,
        targetMaxDate,
        ignoreOrderId: parsedId,
        customSpacing: order.customSpacing ?? null
      });

      // כשל מוקדם על נתוני הרגע הזה, כדי שהמשתמש יקבל את השגיאה העסקית בלי לפתוח
      // טרנזקציה לחינם. האימות הקובע הוא זה שבתוך הטרנזקציה.
      const sizeAvail = findSizeAvailability(computeInventoryAvailability(inventoryContext), itemData.sizeText);
      if (!hasFreeUnit(sizeAvail)) {
        throw ruleError(`אין פריט פנוי במלאי עבור דגם זה במידה ${itemData.sizeText} בתאריך המבוקש`);
      }
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // קריאה חוזרת של הפריט דרך ה-tx: חלון העריכה, סימון "נלקח" ותוכן ה-changes
      // נקבעים לפי המצב ברגע הכתיבה ולא לפי מה שנקרא לפני חישוב הזמינות.
      const freshItem = await tx.orderItem.findUnique({ where: { id: itemId } });
      if (!freshItem) throw ruleError('פריט בהזמנה לא נמצא');

      let dressItemIdToUse = freshItem.dressItemId;

      if (needsAvailabilityCheck) {
        if (freshItem.isTaken) {
          throw ruleError('לא ניתן לשנות דגם/מידה לפריט שכבר נלקח. יש להחזירו תחילה.');
        }

        // הזמינות מחושבת מחדש בתוך הטרנזקציה. מרעננים רק את שאילתת ההזמנות — הנתון
        // היחיד שהזמנה מקבילה יכולה לשנות — ולא את כל טעינת המלאי, כדי שהחלון שבו
        // הכתיבה מסתמכת על חישוב ישן ייסגר בלי להאריך שוב את הטרנזקציה.
        const freshContext = await refreshInventoryBookings(tx, inventoryContext);
        const sizeAvail = findSizeAvailability(computeInventoryAvailability(freshContext), itemData.sizeText);

        if (!hasFreeUnit(sizeAvail)) {
          throw ruleError(`אין פריט פנוי במלאי עבור דגם זה במידה ${itemData.sizeText} בתאריך המבוקש`);
        }

        dressItemIdToUse = sizeAvail.itemIds[0];
      }

      const updateData = buildUpdateData(itemData, dressItemIdToUse);

      // עריכה מלאה (דגם/מידה/תיקונים המשפיעים על הסכומים) מותרת רק בתוך 15 דקות מהעדכון
      // האחרון של הפריט. סימון "תיקון בוצע" ופירוט התיקון נשארים פתוחים תמיד — לא כפופים לחלון.
      // forceFullEdit: המשתמש כבר עבר אישור מנהל בצד הלקוח (ר' handleReopenFullEdit
      // ב-ModernItemsManager) כדי לפתוח מחדש עריכה מלאה אחרי שהחלון נסגר.
      if (!itemData.forceFullEdit && !isWithinItemEditWindow(freshItem)) {
        const lockedFieldChanged = LOCKED_FIELDS.some(field => formatVal(freshItem[field]) !== formatVal(updateData[field]));
        if (lockedFieldChanged) {
          throw ruleError(`חלון העריכה של הפריט (${ITEM_EDIT_WINDOW_MINUTES} דקות מהעדכון האחרון) נסגר. ניתן לערוך כעת רק את תיאור התיקון.`);
        }
      }

      // Update the item.
      // ה-changes המחושב כאן מועבר לתוסף ה-audit כדי שתיווצר שורת היסטוריה אחת בלבד,
      // עם פירוט "לפני ← אחרי". בלי זה נרשמה שורה גנרית עם צילום מלא של כל השדות
      // (גם כשלא השתנה דבר) ועוד שורה ידנית עם הפירוט — שתי שורות כמעט זהות לכל שמירה.
      const updatedItem = await tx.orderItem.update(auditAs('UPDATE', {
        where: { id: itemId },
        data: updateData
      }, diffFields(freshItem, updateData)));

      return updatedItem;
    }, TX_OPTIONS);

    // Recalculate obligations asynchronously after updating item
    await recalculateOrderObligations(parsedId);

    // Fetch the fully updated order data to return (like in POST).
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
    console.error('Error updating order item:', error);
    return NextResponse.json(
      { error: error.isRuleViolation ? error.message : `שגיאת מערכת בעדכון הפריט: ${error.message}` },
      { status: error.isRuleViolation ? 400 : 500 }
    );
  }
}
