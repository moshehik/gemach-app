
import prisma, { auditAs } from '@/app/lib/prisma';
import { syncPendingCreditRefund } from '@/lib/creditRefundSync';
import { getAllCachedSettings, getCachedSetting } from '@/lib/settingsCache';
import { getDeliveryJoinPrice, isOrderJoinValid } from './deliveryJoin';
import { computeOrderObligations, computeDeliveryObligationPreview, resolveEffectiveDeliveryCity, findReplaceableLegacyItemLines } from './pricingCalc';

const SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS',
  'CANCELLATION_CREDIT_MINUTES',
  'premium_pricing_enabled',
  'premium_categories',
  'same_model_swap_no_fee',
  'swap_min_days_before_event',
  'swap_same_category_only',
  'refund_tiers_at_deletion_time',
  'swap_pairing_window_minutes',
  'instant_undo_minutes',
  'gap_size_price_rule'
];
// החישוב הטהור (computeOrderObligations) חי ב-lib/pricingCalc.js כדי שאפשר יהיה להריץ אותו
// גם ב-Node טהור (בדיקות/סקריפטים) בלי alias '@/'. מיוצא מחדש מכאן לכל המייבאים הקיימים.
export { computeOrderObligations };


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

  const [order, priceList, allSettings, deletedItems] = await Promise.all([
    prisma.order.findUnique({
      where: { orderId: numericOrderId },
      include: {
        items: { where: { isDeleted: false }, include: { dressItem: { include: { dress: true } } } }
      }
    }),
    prisma.priceList.findMany(),
    getAllCachedSettings().then(all => all.filter(s => SETTING_KEYS.includes(s.key))),
    prisma.orderItem.findMany({
      where: { orderId: numericOrderId, isDeleted: true },
      include: { dressItem: { include: { dress: true } } }
    })
  ]);
  const settings = allSettings;

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
  // שורות השכרה ישנות מהאקסס שמוחלפות בשורה המחושבת של אותו פריט (ר' findReplaceableLegacyItemLines ב-pricingCalc.js).
  // מאחורי legacy_item_lines_replaced_on_recalc (ברירת מחדל כבוי = כמו קודם: השורה הישנה נשארת ונספרת בנוסף לשורה המחושבת).
  const replaceLegacySetting = await getCachedSetting('legacy_item_lines_replaced_on_recalc');
  const replacedLegacyLines = replaceLegacySetting?.value === 'true'
    ? findReplaceableLegacyItemLines({ manualObligations, newObligations, activeItemIds: new Set(items.map(i => i.id)) })
    : [];
  const replacedLegacyIds = new Set(replacedLegacyLines.map(o => o.id));
  const manualTotal = manualObligations.filter(o => !replacedLegacyIds.has(o.id)).reduce((sum, obs) => sum + obs.amount, 0);
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
    // B4: שליפה לפני הטרנזקציה — מחזיקה את ה-TX פתוח רק לכתיבות (פחות זמן מול Neon)
    const existingObligations = await prisma.paymentObligation.findMany({
      where: { orderId: numericOrderId, isManual: false }
    });
    await prisma.$transaction(async (tx) => {
      const keyOf = (o) => `${o.orderItemId || ''}::${o.description || ''}`;
      const existingByKey = new Map(existingObligations.map(o => [keyOf(o), o]));

      const obligationsToSave = newObligations.filter(o => !o.isDraft).map(o => {
        const { isDraft, ...rest } = o;
        return rest;
      });

      // ביטול (soft-delete, לא מחיקה) של שורות ההשכרה הישנות שהוחלפו - נרשם ביומן כביטול חיוב עם הסכום המקורי.
      for (const ob of replacedLegacyLines) {
        await tx.paymentObligation.update(auditAs('CANCEL_OBLIGATION', {
          where: { id: ob.id },
          data: { isDeleted: true }
        }, {
          isDeleted: { from: false, to: true },
          amount: ob.amount,
          description: ob.description || 'חיוב השכרה ישן מהאקסס - הוחלף בחיוב לפי המחירון',
          note: 'הוחלף בחיוב לפי המחירון לאותו פריט (legacy_item_lines_replaced_on_recalc)'
        }));
      }

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

      // Deletes/creates here are per-row (not deleteMany/createMany) so each removed or added
      // charge line gets its own AuditLog entry through the extension - a bulk op has no
      // per-row result for the extension to log against, and this diff only ever touches the
      // handful of obligation lines that actually changed (unaffected rows are matched and
      // left alone above), so the extra round trips are cheap.
      const obligationsToDelete = existingObligations.filter(o => !matchedExistingIds.has(o.id));
      for (const ob of obligationsToDelete) {
        await tx.paymentObligation.delete(auditAs('DELETE', { where: { id: ob.id } }, {
          deleted: true,
          description: ob.description,
          amount: ob.amount
        }));
      }
      for (const ob of toCreate) {
        await tx.paymentObligation.create({ data: ob });
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

/**
 * 15 - חיוב משלוח אוטומטי לפי עיר (`delivery_price_by_city` SystemSetting), נופל חזרה למחיר
 * אחיד (`delivery_price`) כשאין מחיר לעיר הספציפית או שהטבלה ריקה כליל.
 * Shared by order creation (POST /api/orders) and order update (PUT /api/orders/[id]) so a
 * delivery added/changed on an already-existing order is charged the same way a delivery
 * present at creation time is - previously this only ran at creation.
 * No-ops when the order isn't a delivery, has no configured price (neither per-city nor flat),
 * or already has a non-deleted "משלוח" obligation (matching the original creation-time
 * create-if-missing logic exactly - it does not update an existing obligation's amount if the
 * city/price changed).
 * Safe to call unconditionally after `recalculateOrderObligations`, whose diff against
 * `computeOrderObligations` (which has no notion of delivery) deletes any existing non-manual
 * "משלוח" obligation on every recalc - calling this right after re-creates it from the order's
 * current delivery fields, so it doesn't just fix the "never charged on update" gap but also
 * keeps the charge from silently disappearing on the next unrelated save.
 * עיר המשלוח: כשבהזמנה אין `deliveryCity` מפורשת נופלים לעיר הלקוח (אם היא בטבלת
 * `delivery_price_by_city`) - ר' resolveEffectiveDeliveryCity ב-pricingCalc.js (org2
 * 06467870, 3a4d36df). אם גם זה לא מצליח - לא מחייבים (כמו קודם) אבל מתעדים console.warn
 * במקום להישאר שקט. כשההזמנה אינה משלוח - אף פעם לא מחייבים ולא מתעדים כלום.
 * Returns { charged, citySource, warning } (callers may ignore it).
 */
export async function applyDeliveryCharge(orderId) {
  try {
    const numericOrderId = parseInt(orderId, 10);
    const order = await prisma.order.findUnique({
      where: { orderId: numericOrderId },
      select: {
        orderId: true,
        isDelivery: true,
        deliveryCity: true,
        deliveryDirection: true,
        customer: { select: { city: true } },
        obligations: { where: { isDeleted: false }, select: { description: true, isDeleted: true } }
      }
    });
    if (!order?.isDelivery) return { charged: false, citySource: null, warning: null };

    const [priceSetting, flatPriceSetting, fallbackSetting] = await Promise.all([
      getCachedSetting('delivery_price_by_city'),
      getCachedSetting('delivery_price'),
      getCachedSetting('delivery_charge_customer_city_fallback')
    ]);
    // מתג org (ברירת מחדל כבוי כשהשורה חסרה = כמו לפני 5.10.2026): נפילה-לאחור לעיר הלקוח.
    const allowCustomerCityFallback = fallbackSetting?.value === 'true';
    const resolvedCity = resolveEffectiveDeliveryCity({
      deliveryCity: order.deliveryCity,
      customerCity: order.customer?.city,
      deliveryPriceByCity: priceSetting?.value,
      allowCustomerCityFallback
    });
    if (!resolvedCity.city) {
      // המתג כבוי: התנהגות ישנה בדיוק - בלי חיוב ובלי רעש בלוג.
      if (!allowCustomerCityFallback) return { charged: false, citySource: null, warning: null };
      // משלוח בלי עיר שאפשר לחייב לפיה - לא מחייבים (כמו קודם), אבל לא בשקט. אם כבר קיים
      // חיוב משלוח (למשל הזמנה ישנה) אין על מה להזהיר.
      const alreadyCharged = order.obligations.some(o => String(o.description || '').includes('משלוח'));
      const warning = alreadyCharged ? null : `delivery NOT charged for order ${order.orderId}: ${resolvedCity.reason}`;
      if (warning) console.warn(warning);
      return { charged: false, citySource: null, warning };
    }
    // הצטרפות למשלוח קיים (enable_delivery_join, R49): מחיר הצטרפות לצד במקום מחיר העיר. חסר/כבוי/טבלה חסרה = null.
    const configuredJoinPrice = await getDeliveryJoinPrice();
    // S1: מחיר הצטרפות רק כשההצטרפות עדיין תקפה מול השורש (יום אירוע / כיוון / "יוצא יום לפני" / השורש קיים) - הצטרפות שהתיישנה (תאריך, כיוון
    // או עיר שהשתנו אחרי ההצטרפות) נמחקת (audit) והמשלוח מחויב במחיר הרגיל
    const joinPrice = configuredJoinPrice && (await isOrderJoinValid(order.orderId, { dropStale: true })) ? configuredJoinPrice : null;
    // חישוב טהור משותף עם תצוגה מקדימה (preview-pricing) - ר' computeDeliveryObligationPreview
    // ב-lib/pricingCalc.js לכללי הנפילה-לאחור המלאים (טבלת ערים -> מחיר אחיד -> 50 ברירת מחדל).
    const preview = computeDeliveryObligationPreview({
      isDelivery: order.isDelivery,
      deliveryCity: order.deliveryCity,
      customerCity: order.customer?.city,
      allowCustomerCityFallback,
      deliveryDirection: order.deliveryDirection,
      deliveryPriceByCity: priceSetting?.value,
      deliveryPrice: flatPriceSetting?.value,
      joinPrice,
      existingObligations: order.obligations
    });
    if (!preview) return { charged: false, citySource: resolvedCity.source, warning: null };

    await prisma.paymentObligation.create({
      data: {
        orderId: order.orderId,
        amount: preview.amount,
        quantity: preview.quantity,
        description: preview.description,
        isManual: preview.isManual,
      }
    });
    return { charged: true, citySource: preview.citySource, warning: null };
  } catch (e) {
    console.error('delivery charge failed', e);
    return { charged: false, citySource: null, warning: 'delivery charge failed' };
  }
}
