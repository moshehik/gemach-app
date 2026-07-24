
import prisma from '@/app/lib/prisma';

/**
 * Recalculates payment obligations for a given order.
 * Follows the logic from the Access VBA 'שמלות_תשלום_רישום'.
 */
export async function recalculateOrderObligations(orderId, options = {}) {
  const { dryRun = false, customNote = null } = options;

  // 1. Fetch order details
  const order = await prisma.order.findUnique({
    where: { orderId: parseInt(orderId) },
    include: {
      items: {
        where: { isDeleted: false },
        include: {
          dressItem: {
            include: { dress: true }
          }
        }
      },
      obligations: true
    }
  });

  if (!order) throw new Error('Order not found');

  // 2. Fetch price list and system settings
  const priceList = await prisma.priceList.findMany();
  const settings = await prisma.systemSetting.findMany();
  
  // 3. Helper to get setting value
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
    for (const item of order.items) {
      const category = item.dressItem?.dress?.priceCategory || '';
      if (!category.includes('כלול ב')) {
        mainDressesCount += (item.quantity || 1);
      }
    }
  }
  
  let totalValid = 0;

  for (const item of order.items) {
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

    let desc = item.dressItem.dress.name + (item.sizeText ? ` מידה ${item.sizeText}` : '') + ` (פריט #${item.id})`;
    if (isDiscountedSet) desc += ' (חינם בסט)';
    if (customNote) desc += ` - ${customNote}`;

    newObligations.push({
      orderId: order.orderId,
      productId: matchedPrice ? matchedPrice.id : null,
      amount: finalPrice,
      quantity: item.quantity || 1,
      description: desc,
      isManual: false
    });
    totalValid += finalPrice;

    // Repairs calculation
    let repairsTotal = 0;
    if (item.neckAlteration) {
      const neckCost = 20; // TODO: make dynamic if needed
      repairsTotal += neckCost;
      newObligations.push({
        orderId: order.orderId,
        productId: null,
        amount: neckCost,
        quantity: item.quantity || 1,
        description: `תיקון צוואר - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false
      });
      totalValid += neckCost;
    }
    
    if (item.sleeveAlteration) {
      const sleeveCost = 20;
      repairsTotal += sleeveCost;
      newObligations.push({
        orderId: order.orderId,
        productId: null,
        amount: sleeveCost,
        quantity: item.quantity || 1,
        description: `תיקון שרוול - ${item.dressItem.dress.name} (פריט #${item.id})`,
        isManual: false
      });
      totalValid += sleeveCost;
    }
  }

  // Cancellations (זיכויים) logic - handling deleted items
  const deletedItems = await prisma.orderItem.findMany({
    where: { orderId: parseInt(orderId), isDeleted: true },
    include: {
      dressItem: { include: { dress: true } }
    }
  });

  const eventDate = order.eventDate ? new Date(order.eventDate) : new Date();
  const orderDate = order.orderDate || new Date(); // Use orderDate to check full refund window
  const currentDate = new Date();
  
  const fullRefundCutoff = new Date(orderDate);
  fullRefundCutoff.setDate(fullRefundCutoff.getDate() + refundDaysFromOrder);
  
  const noRefundCutoff = new Date(eventDate);
  noRefundCutoff.setDate(noRefundCutoff.getDate() - noRefundDaysBeforeEvent);
  
  const isFullRefund = currentDate <= fullRefundCutoff;
  const isNoRefund = currentDate >= noRefundCutoff;

  let totalCredit = 0;

  for (const delItem of deletedItems) {
    if (!delItem.dressItem || !delItem.dressItem.dress) continue;
    const category = delItem.dressItem.dress.priceCategory || '';
    const size = parseInt(delItem.sizeText || '0');
    
    const matchedPrice = priceList.find(p => p.category === category && size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize));
    let basePrice = matchedPrice ? matchedPrice.price : 0;
    
    let repairsTotal = 0;
    if (delItem.neckAlteration) repairsTotal += 20;
    if (delItem.sleeveAlteration) repairsTotal += 20;

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

    let C = itemRefundableValue - R; // The rest is Internal Credit
    if (C < 0) C = 0;

    totalCredit += C;

    if (C + itemLost > 0) {
      newObligations.push({
        orderId: order.orderId,
        productId: matchedPrice ? matchedPrice.id : null,
        amount: C + itemLost,
        quantity: delItem.quantity || 1,
        description: 'דמי ביטול ותיקונים: ' + delItem.dressItem.dress.name + (customNote ? ` - ${customNote}` : ''),
        isManual: false
      });
    }
  }

  // Apply Internal Credit to Valid Items
  const amountPaidByCredit = Math.min(totalValid, totalCredit);
  if (amountPaidByCredit > 0) {
    newObligations.push({
      orderId: order.orderId,
      productId: null,
      amount: -amountPaidByCredit,
      quantity: 1,
      description: 'ניצול זיכוי פנימי מביטולים' + (customNote ? ` - ${customNote}` : ''),
      isManual: false
    });
  }

  const manualObligations = await prisma.paymentObligation.findMany({
    where: { orderId: parseInt(orderId), isManual: true, isDeleted: false }
  });
  const manualTotal = manualObligations.reduce((sum, obs) => sum + obs.amount, 0);
  const newTotal = newObligations.reduce((sum, obs) => sum + obs.amount, 0);
  const totalRequired = manualTotal + newTotal;

  // Delete old obligations and insert new ones
  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      await tx.paymentObligation.deleteMany({
        where: { 
          orderId: parseInt(orderId),
          isManual: false
        }
      });
      
      if (newObligations.length > 0) {
        await tx.paymentObligation.createMany({
          data: newObligations
        });
      }
      
      await tx.order.update({
        where: { orderId: parseInt(orderId) },
        data: { totalAmount: totalRequired }
      });
      
      // Also update finalPrice on items for UI display
      for (const item of order.items) {
        if (!item.dressItem || !item.dressItem.dress) continue;

        const obs = newObligations.filter(o => o.description.includes(`(פריט #${item.id})`) && o.amount >= 0);
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
