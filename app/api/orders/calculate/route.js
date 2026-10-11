import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { findPriceRowForSize, normalizeGapRule } from '@/lib/priceRows';
import { resolveEffectiveDeliveryCity } from '@/lib/pricingCalc';
import { previewSharedDelivery } from '@/lib/sharedDelivery';
import { computeLegAmounts } from '@/lib/sharedDeliveryCalc';

export async function POST(request) {
  // /api/* לא עובר דרך middleware.js, ולכן בלי בדיקה כאן ראוט זה היה פתוח לגולש אנונימי.
  // אותה בדיקה ואותה תשובת 401 כמו שאר ראוטי ההזמנות (למשל [id]/email).
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await request.json();
    const { items, eventDate, isAbroad, isDelivery, deliveryCity: explicitDeliveryCity, deliveryDirection, customerCity } = data;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ totalAmount: 0, items: [] });
    }

    // 1. Fetch settings and pricelist (cached)
    const settings = await getAllCachedSettings();
    const getSetting = (key, def) => {
      const setting = settings.find(s => s.key === key);
      return setting ? setting.value : def;
    };
    const enableSetDiscounts = getSetting('ENABLE_SET_DISCOUNTS', 'false') === 'true';
    const gapRule = normalizeGapRule(getSetting('gap_size_price_rule', ''));

    const priceList = await prisma.priceList.findMany();

    // 2. Abroad markup
    let abroadMarkup = 1;
    if (isAbroad) {
      const abroadPrice = priceList.find(p => p.category === 'חול' || p.category === 'חו"ל');
      if (abroadPrice && abroadPrice.price) {
        abroadMarkup = (abroadPrice.price / 100) + 1;
      }
    }

    // 3. Populate dress models for categories
    const dressModelIds = items.map(i => i.dressModelId).filter(Boolean);
    const dbModels = await prisma.dressModel.findMany({
      where: { id: { in: dressModelIds } }
    });

    // Count main dresses
    let mainDressesCount = 0;
    if (enableSetDiscounts) {
      for (const item of items) {
        const dbModel = dbModels.find(d => d.id === item.dressModelId);
        const category = dbModel?.priceCategory || '';
        if (!category.includes('כלול ב')) {
          mainDressesCount += (item.quantity || 1);
        }
      }
    }

    let totalAmount = 0;
    const calculatedItems = [];

    // Calculate per item
    for (const item of items) {
      const dbModel = dbModels.find(d => d.id === item.dressModelId);
      if (!dbModel) {
        calculatedItems.push({ ...item, finalPrice: 0 });
        continue;
      }

      const category = dbModel.priceCategory || '';
      const size = parseInt(item.sizeText || '0');

      // אותו כלל חיפוש שורת מחיר כמו במנוע (lib/priceRows.js), כולל gap_size_price_rule:
      // קודם התאמה ישירה בקטגוריה (או בקטגוריה בלי "כלול ב"), ורק אם אין - כלל המידה שבין טווחים.
      const strippedCategory = category.replace('כלול ב', '').trim();
      const categoryCandidates = strippedCategory && strippedCategory !== category ? [category, strippedCategory] : [category];
      let matchedPrice = null;
      for (const gapMode of ['none', gapRule]) {
        for (const cat of categoryCandidates) {
          matchedPrice = findPriceRowForSize(priceList, cat, size, { eventDate, gapRule: gapMode }).row;
          if (matchedPrice) break;
        }
        if (matchedPrice) break;
      }

      let basePrice = matchedPrice ? matchedPrice.price : 0;

      let isDiscountedSet = false;
      if (enableSetDiscounts && category.includes('כלול ב') && mainDressesCount > 0) {
        const qty = item.quantity || 1;
        if (mainDressesCount >= qty) {
          mainDressesCount -= qty;
          basePrice = 0;
          isDiscountedSet = true;
        } else {
          mainDressesCount -= 1;
          basePrice = 0;
          isDiscountedSet = true;
        }
      }

      let finalPrice = basePrice * abroadMarkup;

      let repairsTotal = 0;
      if (item.neckAlteration) {
        const p = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון צוואר');
        repairsTotal += p ? p.price : 0;
      }
      if (item.sleeveAlteration) {
        const p = priceList.find(p => p.category === 'תיקונים' && p.description === 'תיקון שרוול');
        repairsTotal += p ? p.price : 0;
      }
      if (item.lengthAlteration && String(item.lengthAlteration).trim() !== '') {
        const p = priceList.find(p => p.category === 'תיקון אורך' && size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize));
        repairsTotal += p ? p.price : 0;
      }
      finalPrice += repairsTotal;

      totalAmount += finalPrice;
      calculatedItems.push({
        ...item,
        calculatedPrice: finalPrice,
        repairsCost: repairsTotal,
        isDiscountedSet
      });
    }

    // 15 - חיוב משלוח: כשההזמנה עדיין באשף היצירה (אין orderId עדיין), ה"סכום לתשלום"
    // המוצג בשלב התשלום היה מחשב רק פריטים - ולכן הלקוח היה משלם בפועל פחות ממה
    // שבאמת ייגבה בסוף, וה-obligation האוטומטי (applyDeliveryCharge, שרץ אחרי יצירת
    // ההזמנה) נשאר פתוח/לא משולם על אף שהוצג "שולם במלואו" באשף - ר' דיווח org2 e799b1e0.
    // אותה נוסחת מחיר בדיוק כמו applyDeliveryCharge ב-lib/pricingEngine.js.
    let deliveryAmount = 0;
    let sharedDelivery = null;
    const priceByCity = getSetting('delivery_price_by_city', '');
    // בלי עיר משלוח מפורשת נופלים לעיר הלקוח (אם בטבלה) - כמו applyDeliveryCharge (org2 06467870).
    const deliveryCity = isDelivery
      ? resolveEffectiveDeliveryCity({ deliveryCity: explicitDeliveryCity, customerCity, deliveryPriceByCity: priceByCity, allowCustomerCityFallback: getSetting('delivery_charge_customer_city_fallback', 'false') === 'true' }).city
      : null;
    if (isDelivery && deliveryCity) {
      let priceMap = {};
      try { priceMap = JSON.parse(priceByCity || '{}'); } catch { /* ignore invalid JSON */ }
      let cityPrice = priceMap[deliveryCity];
      if (!cityPrice || Number(cityPrice) <= 0) cityPrice = getSetting('delivery_price', '0');
      // תואם ל-fallback ב-applyDeliveryCharge (lib/pricingEngine.js) - אחרת התצוגה המקדימה כאן
      // מציגה 0 בזמן שההזמנה בפועל תחויב ב-50 ש"ח כברירת מחדל.
      if (!cityPrice || Number(cityPrice) <= 0) cityPrice = 50;
      const dir = deliveryDirection || 'הלוך-חזור';
      const count = dir === 'הלוך-חזור' ? 2 : 1;
      deliveryAmount = Number(cityPrice) * count;
      // משלוח משותף (shared_delivery_enabled, כבוי כברירת מחדל): אותה כתובת ואותו יום אירוע של הזמנה קיימת => מחיר מוזל לצד שיש בו משלוח ראשי אחר.
      // אותו חישוב כמו applyDeliveryCharge (הזמנה חדשה נחשבת כנרשמת עכשיו => אחרונה בסדר הרישום). כשל לא עוצר את החישוב.
      try {
        const sp = await previewSharedDelivery({
          orderId: data.orderId || null,
          customerId: data.customerId || null,
          eventDate: isAbroad && data.fromDate ? data.fromDate : eventDate,
          fromDate: data.fromDate || null,
          isDelivery: true,
          deliveryAddress: data.deliveryAddress || null,
          deliveryCity: explicitDeliveryCity || null,
          deliveryDirection: dir,
          deliveryOneDayBefore: !!data.deliveryOneDayBefore,
        });
        if (sp.enabled) {
          const regularAmount = deliveryAmount;
          if (sp.discount) {
            deliveryAmount = computeLegAmounts({ direction: dir, regularPerLeg: Number(cityPrice), discountedPerLeg: sp.discount.discountedPerLeg, discountedLegs: sp.discount.discountedLegs }).amount;
          }
          sharedDelivery = { shared: sp.shared, isPrimary: sp.isPrimary, discounted: deliveryAmount < regularAmount, regularAmount, matches: sp.matches || [] };
        }
      } catch (sharedErr) {
        console.error('shared delivery preview failed (showing regular price)', sharedErr);
      }
    }
    totalAmount += deliveryAmount;

    return NextResponse.json({ totalAmount, calculatedItems, deliveryAmount, ...(sharedDelivery ? { sharedDelivery } : {}) });
  } catch (error) {
    console.error('Error in calculate route:', error);
    return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 });
  }
}
