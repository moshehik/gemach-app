
import prisma from '@/app/lib/prisma';

const SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS'
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

  for (const delItem of deletedItems) {
    if (!delItem.dressItem || !delItem.dressItem.dress) continue;
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
    if (isFullRefund) {
      R = itemRefundableValue;
    } else if (isNoRefund) {
      R = 0;
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
        description: 'חיוב מקורי: ' + delItem.dressItem.dress.name,
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
        description: 'זיכוי בגין ביטול: ' + delItem.dressItem.dress.name,
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }

    if (C + itemLost > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: C + itemLost,
        quantity: delItem.quantity || 1,
        description: 'דמי ביטול ותיקונים: ' + delItem.dressItem.dress.name + (customNote ? ` - ${customNote}` : ''),
        isManual: false,
        orderItemId: delItem.id,
        isDraft: false
      });
    }
  }

  return { newObligations, totalValid };
}

/**
 * Recalculates payment obligations for a given order.
 *
 * Pass `options.preloaded` with `{ order, items, deletedItems, priceList, settings }`
 * (order must NOT include items/obligations; items/deletedItems are OrderItem[] with
 * dressItem.dress included) to skip re-fetching data the caller already has in memory.
 */
export async function recalculateOrderObligations(orderId, options = {}) {
  const { dryRun = false, customNote = null, preloaded = null } = options;
  const numericOrderId = parseInt(orderId);

  let order, items, deletedItems, priceList, settings;

  if (preloaded) {
    ({ order, items, deletedItems, priceList, settings } = preloaded);
  } else {
    let orderWithItems;
    [orderWithItems, priceList, settings, deletedItems] = await Promise.all([
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
    order = orderWithItems;
    items = orderWithItems ? orderWithItems.items : [];
  }

  if (!order) throw new Error('Order not found');

  const { newObligations } = computeOrderObligations({ order, items, deletedItems, priceList, settings, customNote });

  const manualObligations = await prisma.paymentObligation.findMany({
    where: { orderId: numericOrderId, isManual: true, isDeleted: false }
  });
  const manualTotal = manualObligations.reduce((sum, obs) => sum + obs.amount, 0);
  const newTotal = newObligations.reduce((sum, obs) => sum + obs.amount, 0);
  const totalRequired = manualTotal + newTotal;

  // Delete old obligations and insert new ones
  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      await tx.paymentObligation.deleteMany({
        where: {
          orderId: numericOrderId,
          isManual: false
        }
      });

      if (newObligations.length > 0) {
        const obligationsToSave = newObligations.filter(o => !o.isDraft).map(o => {
          const { isDraft, ...rest } = o;
          return rest;
        });
        if (obligationsToSave.length > 0) {
          await tx.paymentObligation.createMany({
            data: obligationsToSave
          });
        }
      }

      await tx.order.update({
        where: { orderId: numericOrderId },
        data: { totalAmount: totalRequired }
      });

      // Also update finalPrice on items for UI display
      for (const item of items) {
        if (!item.dressItem || !item.dressItem.dress) continue;

        const obs = newObligations.filter(o => o.orderItemId === item.id && o.amount >= 0);
        const totalItemPrice = obs.reduce((sum, o) => sum + o.amount, 0);
        if (obs.length > 0) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { finalPrice: totalItemPrice }
          });
        }
      }
    });
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
