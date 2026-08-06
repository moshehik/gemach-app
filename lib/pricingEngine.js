
import prisma from '@/app/lib/prisma';
import { syncPendingCreditRefund } from '@/lib/creditRefundSync';

const SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS',
  'CANCELLATION_CREDIT_MINUTES'
];

/**
 * Pure calculation of an order's obligations from already-fetched data.
 * No DB access here - callers are responsible for fetching order/items/priceList/settings/deletedItems.
 * Follows the logic from the Access VBA 'שמלות_תשלום_רישום'.
 */
export function computeOrderObligations({ order, items, deletedItems, priceList, settings, customNote = null }) {
  const getSetting = (key, def) => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : def;
  };

  const refundDaysFromOrder = parseFloat(getSetting('REFUND_DAYS_FROM_ORDER', '7'));
  const noRefundDaysBeforeEvent = parseFloat(getSetting('NO_REFUND_DAYS_BEFORE_EVENT', '7'));
  const refundPercentage = parseFloat(getSetting('REFUND_PERCENTAGE', '100')) / 100;
  const refundRepairs = getSetting('REFUND_REPAIRS', 'false') === 'true';
  const enableSetDiscounts = getSetting('ENABLE_SET_DISCOUNTS', 'false') === 'true';
  const cancellationCreditMinutes = parseFloat(getSetting('CANCELLATION_CREDIT_MINUTES', '15'));

  // Abroad markup
  let abroadMarkup = 1;
  if (order.isAbroad) {
    const abroadPrice = priceList.find(p => p.category === 'חול' || p.category === 'חו"ל');
    if (abroadPrice && abroadPrice.price) {
      abroadMarkup = (abroadPrice.price / 100) + 1; // Assuming it's a percentage (e.g. 10%)
    }
  }

  // Map of generated obligations
  const newObligations = [];

  // -- Set Discounts Logic --
  // Count how many "main" dresses we have to allow discounting accessories
  let mainDressesCount = 0;
  if (enableSetDiscounts) {
    for (const item of items) {
      const category = item.dressItem?.dress?.priceCategory || '';
      if (!category.includes('כלול ב')) {
        mainDressesCount += (item.quantity || 1);
      }
    }
  }

  let totalValid = 0;

  for (const item of items) {
    if (!item.dressItem || !item.dressItem.dress) continue;
    const category = item.dressItem.dress.priceCategory || '';
    const size = parseInt(item.sizeText || '0');

    // Find matching price by checking fromSize/toSize properly
    const matchedPrice = priceList.find(p => {
      const catMatch = p.category === category || p.category === category.replace('כלול ב', '').trim();
      if (!catMatch) return false;
      const sizeMatch = size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize);

      // Date filtering
      let dateMatch = true;
      if (order.eventDate) {
        const evDate = new Date(order.eventDate);
        if (p.startDate && evDate < new Date(p.startDate)) dateMatch = false;
        if (p.endDate && evDate > new Date(p.endDate)) dateMatch = false;
      }
      return sizeMatch && dateMatch;
    });

    let basePrice = matchedPrice ? matchedPrice.price : 0;

    // Apply Set Discounts (מבצע סטים)
    let isDiscountedSet = false;
    if (enableSetDiscounts && category.includes('כלול ב') && mainDressesCount > 0) {
      const qty = item.quantity || 1;
      if (mainDressesCount >= qty) {
        mainDressesCount -= qty;
        basePrice = 0; // Discounted!
        isDiscountedSet = true;
      } else {
        mainDressesCount -= 1;
        basePrice = 0;
        isDiscountedSet = true;
      }
    }

    let finalPrice = basePrice * abroadMarkup;

    const isPending = !order.legacyId && item.cartStatus === 'pending';

    let desc = item.dressItem.dress.name + (item.sizeText ? ` מידה ${item.sizeText}` : '') + ` (פריט #${item.id})`;
    if (isDiscountedSet) desc += ' (חינם בסט)';
    if (customNote) desc += ` - ${customNote}`;

    newObligations.push({
      orderId: order.orderId,
      productId: matchedPrice ? matchedPrice.id : null,
      amount: finalPrice,
      quantity: item.quantity || 1,
      description: desc,
      isManual: false,
      orderItemId: item.id,
      isDraft: isPending
    });
    totalValid += finalPrice;

    // Repairs calculation
    let repairsTotal = 0;
    if (item.neckAlteration) {
      const neckPriceObj = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון צוואר');
      const neckCost = neckPriceObj ? neckPriceObj.price : 0;
      repairsTotal += neckCost;
      newObligations.push({
        orderId: order.orderId,
        productId: neckPriceObj ? neckPriceObj.id : null,
        amount: neckCost,
        quantity: item.quantity || 1,
        description: `תיקון צוואר - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false,
        orderItemId: item.id,
        isDraft: isPending
      });
      totalValid += neckCost;
    }

    if (item.sleeveAlteration) {
      const sleevePriceObj = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון שרוול');
      const sleeveCost = sleevePriceObj ? sleevePriceObj.price : 0;
      repairsTotal += sleeveCost;
      newObligations.push({
        orderId: order.orderId,
        productId: sleevePriceObj ? sleevePriceObj.id : null,
        amount: sleeveCost,
        quantity: item.quantity || 1,
        description: `תיקון שרוול - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false,
        orderItemId: item.id,
        isDraft: isPending
      });
      totalValid += sleeveCost;
    }

    if (item.lengthAlteration && String(item.lengthAlteration).trim() !== '') {
      const lengthPriceObj = priceList.find(p => p.category === 'תיקון אורך' && size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize));
      const lengthCost = lengthPriceObj ? lengthPriceObj.price : 0;
      repairsTotal += lengthCost;
      newObligations.push({
        orderId: order.orderId,
        productId: lengthPriceObj ? lengthPriceObj.id : null,
        amount: lengthCost,
        quantity: item.quantity || 1,
        description: `תיקון אורך - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false,
        orderItemId: item.id,
        isDraft: isPending
      });
      totalValid += lengthCost;
    }
  }

  // Cancellations (זיכויים) logic - handling deleted items
  const eventDate = order.eventDate ? new Date(order.eventDate) : new Date();
  const orderDate = order.orderDate || new Date(); // Use orderDate to check full refund window
  const currentDate = new Date();

  const fullRefundCutoff = new Date(orderDate);
  fullRefundCutoff.setDate(fullRefundCutoff.getDate() + refundDaysFromOrder);

  const noRefundCutoff = new Date(eventDate);
  noRefundCutoff.setDate(noRefundCutoff.getDate() - noRefundDaysBeforeEvent);

  const isFullRefund = currentDate <= fullRefundCutoff;
  const isNoRefund = currentDate >= noRefundCutoff;

  // Cancellation-fee credit: a fee can be redirected toward another item in the same order
  // instead of being pure loss, if that item was added at/after the cancellation and the
  // cancellation is still within CANCELLATION_CREDIT_MINUTES. `deletedAt` is stamped at save
  // time (not when the item was toggled off in the UI), so a cancel+add done in one sitting
  // always shares one "now" and passes this check regardless of how long the sitting took -
  // see app/api/orders/[id]/route.js's PUT handler for where that stamp happens.
  const itemChargeRemaining = new Map();
  for (const ob of newObligations) {
    if (ob.orderItemId && ob.amount > 0) {
      itemChargeRemaining.set(ob.orderItemId, (itemChargeRemaining.get(ob.orderItemId) || 0) + ob.amount);
    }
  }
  const creditCandidates = [...items]
    .filter(i => i.createdAt)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const sortedDeletedItems = [...deletedItems].sort((a, b) => {
    const ta = a.deletedAt ? new Date(a.deletedAt).getTime() : Infinity;
    const tb = b.deletedAt ? new Date(b.deletedAt).getTime() : Infinity;
    return ta - tb;
  });

  // פריטים שמקורם ב-Access (legacyId) מקבלים כולם, ללא יוצא מן הכלל, אותו createdAt -
  // רגע הרצת סקריפט הייבוא (ראו scripts/import_all_data.js) - ולא את המועד שבו הפריט
  // באמת נוסף להזמנה בזמנו. תאריך כזה לא אומר כלום על "כמה זמן חי הפריט", ומינוף שלו
  // ישירות בבדיקת "ביטול מיידי" למטה עובד נכון היום רק במקרה (מפני שהייבוא רץ מעל 15
  // דקות לפני כל ביטול בפועל) - הרצה חוזרת עתידית של סקריפט ייבוא/תיקון נתונים הייתה
  // מאפסת שוב את ה-createdAt של כל הפריטים המיובאים ל"עכשיו", והופכת כל ביטול של פריט
  // ישן שבוצע תוך 15 דקות מריצת הסקריפט ל"ביטול מיידי" שגוי - בלי חיוב מקורי, בלי זיכוי
  // ובלי דמי ביטול, על פריט אמיתי שהיה קיים שנים. עבור פריט legacy אנחנו מעדיפים אפוא את
  // תאריך ההזמנה האמיתי (ברמת הפריט, ואם חסר - ברמת ההזמנה, ששניהם מיובאים כראוי
  // ומייצגים תאריך היסטורי אמיתי) כנקודת הייחוס - כך שהחלון של 15 הדקות לעולם לא ייפתח
  // בטעות לפריט legacy ותיק, ללא תלות בזמן שחלף מאז שהייבוא האחרון רץ.
  const getItemAddReference = (item) => {
    if (item.legacyId) {
      return item.orderDate || order.orderDate || null;
    }
    return item.createdAt || null;
  };

  for (const delItem of sortedDeletedItems) {
    if (!delItem.dressItem || !delItem.dressItem.dress) continue;

    // "ביטול מיידי": פריט שכל חייו - מהוספה ועד מחיקה - התרחשו בתוך חלון
    // CANCELLATION_CREDIT_MINUTES נחשב כאילו מעולם לא נוסף - בלי חיוב מקורי, בלי זיכוי
    // ובלי דמי ביטול, ללא קשר לחלונות הזמן הרגילים של ההזמנה.
    const addReference = getItemAddReference(delItem);
    if (addReference && delItem.deletedAt && !isNaN(cancellationCreditMinutes)) {
      const lifetimeMs = new Date(delItem.deletedAt).getTime() - new Date(addReference).getTime();
      if (lifetimeMs >= 0 && lifetimeMs <= cancellationCreditMinutes * 60000) {
        continue;
      }
    }

    const category = delItem.dressItem.dress.priceCategory || '';
    const size = parseInt(delItem.sizeText || '0');

    const matchedPrice = priceList.find(p => p.category === category && size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize));
    let basePrice = matchedPrice ? matchedPrice.price : 0;

    let repairsTotal = 0;
    if (delItem.neckAlteration) {
      const p = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון צוואר');
      repairsTotal += p ? p.price : 0;
    }
    if (delItem.sleeveAlteration) {
      const p = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון שרוול');
      repairsTotal += p ? p.price : 0;
    }
    if (delItem.lengthAlteration && String(delItem.lengthAlteration).trim() !== '') {
      const p = priceList.find(p => p.category === 'תיקון אורך' && size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize));
      repairsTotal += p ? p.price : 0;
    }

    let itemBaseValue = basePrice * abroadMarkup;
    let itemLost = refundRepairs ? 0 : repairsTotal;
    let itemRefundableValue = itemBaseValue + (refundRepairs ? repairsTotal : 0);

    let R = 0; // Cash Refund
    // isNoRefund (proximity to the event) is checked first: if the order itself was placed
    // less than NO_REFUND_DAYS_BEFORE_EVENT before the event, isFullRefund's order-date window
    // can still be "open" (it counts from orderDate, not eventDate) - without this priority an
    // order made 3 days before an imminent event would wrongly qualify for a full refund just
    // because it's within REFUND_DAYS_FROM_ORDER of itself. Event proximity always wins.
    if (isNoRefund) {
      R = 0;
    } else if (isFullRefund) {
      R = itemRefundableValue;
    } else {
      if (matchedPrice && matchedPrice.deposit !== null && matchedPrice.deposit > 0) {
        // [החזר] is the cash refund amount they get
        R = matchedPrice.deposit * abroadMarkup + (refundRepairs ? repairsTotal : 0);
      } else {
        R = itemRefundableValue * refundPercentage;
      }
    }

    // Safety boundaries
    if (R > itemRefundableValue) R = itemRefundableValue;
    if (R < 0) R = 0;

    let C = itemRefundableValue - R; // The rest is Cancellation Fee
    if (C < 0) C = 0;

    let originalCharge = itemBaseValue + repairsTotal;

    if (delItem.legacyId === null && originalCharge > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: originalCharge,
        quantity: delItem.quantity || 1,
        description: `חיוב מקורי: ${delItem.dressItem.dress.name} (פריט #${delItem.id})`,
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }

    if (originalCharge > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: -originalCharge,
        quantity: delItem.quantity || 1,
        description: `זיכוי בגין ביטול: ${delItem.dressItem.dress.name} (פריט #${delItem.id})`,
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }

    const feeAmount = C + itemLost;
    if (feeAmount > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: feeAmount,
        quantity: delItem.quantity || 1,
        description: `דמי ביטול ותיקונים: ${delItem.dressItem.dress.name}${customNote ? ` - ${customNote}` : ''} (פריט #${delItem.id})`,
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }

    const deletedAtTime = delItem.deletedAt ? new Date(delItem.deletedAt).getTime() : null;
    // רק C (החלק הבלתי-מוחזר של השמלה) ניתן לניצול כזיכוי על פריט חלופי - itemLost
    // (עלות תיקונים) חייב להישאר חיוב קבוע ללקוח תמיד, גם כשיש פריט חלופי זמין.
    const isCreditEligible = C > 0
      && deletedAtTime !== null
      && !isNaN(cancellationCreditMinutes)
      && (currentDate.getTime() - deletedAtTime) <= cancellationCreditMinutes * 60000;

    if (isCreditEligible) {
      let remainingFee = C;
      let consumedCredit = 0;
      for (const candidate of creditCandidates) {
        if (remainingFee <= 0) break;
        if (new Date(candidate.createdAt).getTime() < deletedAtTime) continue;
        const capacity = itemChargeRemaining.get(candidate.id) || 0;
        if (capacity <= 0) continue;
        const take = Math.min(capacity, remainingFee);
        itemChargeRemaining.set(candidate.id, capacity - take);
        remainingFee -= take;
        consumedCredit += take;
      }

      if (consumedCredit > 0) {
        newObligations.push({
          orderId: order.orderId,
          productId: matchedPrice ? matchedPrice.id : null,
          amount: -consumedCredit,
          quantity: delItem.quantity || 1,
          description: `זיכוי דמי ביטול (מומש על פריט חדש): ${delItem.dressItem.dress.name} (פריט #${delItem.id})`,
          isManual: false,
          orderItemId: delItem.id,
          isDraft: false
        });
      }
    }
  }

  return { newObligations, totalValid };
}

/**
 * Recalculates payment obligations for a given order.
 * Follows the logic from the Access VBA 'שמלות_תשלום_רישום'.
 * For read-only draft previews where the caller already has order/items/priceList/settings
 * in memory (e.g. GET /api/orders/[id]), call `computeOrderObligations` directly instead
 * to avoid re-fetching the same data from the DB.
 */
export async function recalculateOrderObligations(orderId, options = {}) {
  const { dryRun = false, customNote = null } = options;
  const numericOrderId = parseInt(orderId);

  const [order, priceList, settings, deletedItems] = await Promise.all([
    prisma.order.findUnique({
      where: { orderId: numericOrderId },
      include: {
        items: { where: { isDeleted: false }, include: { dressItem: { include: { dress: true } } } }
      }
    }),
    prisma.priceList.findMany(),
    prisma.systemSetting.findMany({ where: { key: { in: SETTING_KEYS } } }),
    prisma.orderItem.findMany({
      where: { orderId: numericOrderId, isDeleted: true },
      include: { dressItem: { include: { dress: true } } }
    })
  ]);

  if (!order) throw new Error('Order not found');

  // Enrich legacy deleted items with DressModel data so cancellation refunds are calculated
  const uniquePrefixes = new Set();
  for (const delItem of deletedItems) {
    if ((!delItem.dressItem || !delItem.dressItem.dress) && delItem.barcodePrefix) {
      uniquePrefixes.add(delItem.barcodePrefix);
    }
  }

  if (uniquePrefixes.size > 0) {
    const fallbackModels = await prisma.dressModel.findMany({
      where: { barcodePrefix: { in: Array.from(uniquePrefixes) } }
    });
    for (const delItem of deletedItems) {
      if ((!delItem.dressItem || !delItem.dressItem.dress) && delItem.barcodePrefix) {
        const model = fallbackModels.find(m => m.barcodePrefix === delItem.barcodePrefix);
        if (model) {
          delItem.dressItem = delItem.dressItem || {};
          delItem.dressItem.dress = model;
        }
      }
    }
  }

  const items = order.items;

  const { newObligations } = computeOrderObligations({ order, items, deletedItems, priceList, settings, customNote });

  const manualObligations = await prisma.paymentObligation.findMany({
    where: { orderId: numericOrderId, isManual: true, isDeleted: false }
  });
  const manualTotal = manualObligations.reduce((sum, obs) => sum + obs.amount, 0);
  const newTotal = newObligations.reduce((sum, obs) => sum + obs.amount, 0);
  const totalRequired = manualTotal + newTotal;

  // Replace old obligations with the freshly computed set - but as a diff against what's
  // already there, not a blanket delete+recreate. A delete+recreate stamps every single
  // non-manual row (unrelated ones included) with a brand new createdAt = now(), which wiped
  // out the "date added" shown in the payments history table on every recalc - e.g. editing
  // one item's price reset the added-date of every other charge in the order too. Matching by
  // (orderItemId, description) - the stable identity of a charge line - lets untouched rows
  // keep their original createdAt, and only genuinely new/changed/removed lines are written.
  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      const existingObligations = await tx.paymentObligation.findMany({
        where: { orderId: numericOrderId, isManual: false }
      });
      const keyOf = (o) => `${o.orderItemId || ''}::${o.description || ''}`;
      const existingByKey = new Map(existingObligations.map(o => [keyOf(o), o]));

      const obligationsToSave = newObligations.filter(o => !o.isDraft).map(o => {
        const { isDraft, ...rest } = o;
        return rest;
      });

      const matchedExistingIds = new Set();
      const toCreate = [];
      for (const ob of obligationsToSave) {
        const existing = existingByKey.get(keyOf(ob));
        if (!existing) {
          toCreate.push(ob);
          continue;
        }
        matchedExistingIds.add(existing.id);
        const changed = Math.abs(existing.amount - ob.amount) > 0.001
          || existing.quantity !== ob.quantity
          || existing.productId !== ob.productId;
        if (changed) {
          await tx.paymentObligation.update({
            where: { id: existing.id },
            data: { amount: ob.amount, quantity: ob.quantity, productId: ob.productId }
          });
        }
      }

      const idsToDelete = existingObligations.filter(o => !matchedExistingIds.has(o.id)).map(o => o.id);
      if (idsToDelete.length > 0) {
        await tx.paymentObligation.deleteMany({ where: { id: { in: idsToDelete } } });
      }
      if (toCreate.length > 0) {
        await tx.paymentObligation.createMany({ data: toCreate });
      }

      // מעדכנים רק כשהסכום באמת השתנה. עדכון סרק כאן קידם את updatedAt של ההזמנה
      // בכל חישוב מחדש (גם כשנערך רק פריט), ואז השמירה הבאה מהכרטיס נחסמה עם
      // "הזמנה זו עודכנה בשרת" — בלי שאף אחד שינה בפועל את שדות ההזמנה.
      // אותו שיקול בדיוק כמו בעדכון finalPrice של הפריטים למטה.
      const currentTotal = order.totalAmount;
      const totalChanged = (currentTotal === null || currentTotal === undefined)
        ? totalRequired !== 0
        : Math.abs(currentTotal - totalRequired) > 0.001;
      if (totalChanged) {
        await tx.order.update({
          where: { orderId: numericOrderId },
          data: { totalAmount: totalRequired }
        });
      }

      // Also update finalPrice on items for UI display. Group items that land on the
      // same price into a single updateMany instead of one update() per item - avoids
      // an N+1 sequence of awaits (and N extra audit-log inserts) on every order save.
      const priceGroups = new Map();
      for (const item of items) {
        if (!item.dressItem || !item.dressItem.dress) continue;

        const obs = newObligations.filter(o => o.orderItemId === item.id && o.amount >= 0);
        if (obs.length === 0) continue;
        const totalItemPrice = obs.reduce((sum, o) => sum + o.amount, 0);
        if (!priceGroups.has(totalItemPrice)) priceGroups.set(totalItemPrice, []);
        priceGroups.get(totalItemPrice).push(item.id);
      }
      for (const [finalPrice, ids] of priceGroups) {
        // מדלגים על פריטים שהמחיר שלהם לא באמת השתנה - עדכון סרק כאן היה מאפס את
        // updatedAt של כל פריט בהזמנה בכל שמירה, ושובר את חלון עריכת 15 הדקות
        // (ראו lib/orderItemEditWindow.js) שמבוסס על השדה הזה.
        const idsToUpdate = ids.filter(id => {
          const item = items.find(i => i.id === id);
          return item && item.finalPrice !== finalPrice;
        });
        if (idsToUpdate.length === 0) continue;
        await tx.orderItem.updateMany({
          where: { id: { in: idsToUpdate } },
          data: { finalPrice }
        });
      }
      // הטרנזקציה מכילה כתיבות בלבד (הקריאות כולן למעלה, לפני הפתיחה), אבל היא כותבת
      // מספר לא חסום של שורות מול DB מרוחק. timeout מפורש מונע נפילה על
      // "Transaction already closed" בהזמנה עם הרבה פריטים או בקפיצת השהיה רגעית.
    }, { timeout: 30000, maxWait: 15000 });

    // ההתחייבויות (ולכן totalRequired) הרגע השתנו - מוודאים שבקשת זיכוי אוטומטית
    // ממתינה קיימת/מעודכנת/נמחקת בהתאם ליתרת הזכות הנוכחית. לא רץ במצב dryRun
    // (תצוגה מקדימה של recalculation באדמין לא אמורה ליצור זיכויים).
    await syncPendingCreditRefund(numericOrderId);
  }

  return {
    newObligations,
    manualTotal,
    newTotal,
    totalRequired,
    oldTotalAmount: order.totalAmount,
    diff: totalRequired - (order.totalAmount || 0)
  };
}
