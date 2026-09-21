import { NextResponse } from 'next/server';

import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { findPriceRowForSize, normalizeGapRule } from '@/lib/priceRows';

export async function POST(request) {
  try {
    const data = await request.json();
    const { items, eventDate, isAbroad, isDelivery, deliveryCity, deliveryDirection } = data;

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
    if (isDelivery && deliveryCity) {
      const priceByCity = getSetting('delivery_price_by_city', '');
      let priceMap = {};
      try { priceMap = JSON.parse(priceByCity || '{}'); } catch { /* ignore invalid JSON */ }
      let cityPrice = priceMap[deliveryCity];
      if (!cityPrice) cityPrice = getSetting('delivery_price', '0');
      if (cityPrice && Number(cityPrice) > 0) {
        const dir = deliveryDirection || 'הלוך-חזור';
        const count = dir === 'הלוך-חזור' ? 2 : 1;
        deliveryAmount = Number(cityPrice) * count;
      }
    }
    totalAmount += deliveryAmount;

    return NextResponse.json({ totalAmount, calculatedItems, deliveryAmount });
  } catch (error) {
    console.error('Error in calculate route:', error);
    return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 });
  }
}
