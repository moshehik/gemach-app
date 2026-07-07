import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const data = await request.json();
    const { items, eventDate, isAbroad } = data;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ totalAmount: 0, items: [] });
    }

    // 1. Fetch settings and pricelist
    const settings = await prisma.systemSetting.findMany();
    const getSetting = (key, def) => {
      const setting = settings.find(s => s.key === key);
      return setting ? setting.value : def;
    };
    const enableSetDiscounts = getSetting('ENABLE_SET_DISCOUNTS', 'false') === 'true';

    const priceList = await prisma.priceList.findMany();

    // 2. Abroad markup
    let abroadMarkup = 1;
    if (isAbroad) {
      const abroadPrice = priceList.find(p => p.category === 'חול' || p.category === 'חו"ל');
      if (abroadPrice && abroadPrice.price) {
        abroadMarkup = (abroadPrice.price / 100) + 1;
      }
    }

    // 3. Populate dress items for categories
    const dressItemIds = items.map(i => parseInt(i.sampleItemId)).filter(id => !isNaN(id));
    const dbItems = await prisma.dressItem.findMany({
      where: { id: { in: dressItemIds } },
      include: { dress: true }
    });

    // Count main dresses
    let mainDressesCount = 0;
    if (enableSetDiscounts) {
      for (const item of items) {
        const dbItem = dbItems.find(d => d.id === parseInt(item.sampleItemId));
        const category = dbItem?.dress?.priceCategory || '';
        if (!category.includes('כלול ב')) {
          mainDressesCount += (item.quantity || 1);
        }
      }
    }

    let totalAmount = 0;
    const calculatedItems = [];

    // Calculate per item
    for (const item of items) {
      const dbItem = dbItems.find(d => d.id === parseInt(item.sampleItemId));
      if (!dbItem || !dbItem.dress) {
        calculatedItems.push({ ...item, finalPrice: 0 });
        continue;
      }

      const category = dbItem.dress.priceCategory || '';
      const size = parseInt(item.sizeText || '0');

      const matchedPrice = priceList.find(p => {
        const catMatch = p.category === category || p.category === category.replace('כלול ב', '').trim();
        if (!catMatch) return false;
        const sizeMatch = size >= (p.fromSize || 0) && (p.toSize === null || size <= p.toSize);
        
        let dateMatch = true;
        if (eventDate) {
          const evDate = new Date(eventDate);
          if (p.startDate && evDate < new Date(p.startDate)) dateMatch = false;
          if (p.endDate && evDate > new Date(p.endDate)) dateMatch = false;
        }
        return sizeMatch && dateMatch;
      });

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
      if (item.neckAlteration) repairsTotal += 20;
      if (item.sleeveAlteration) repairsTotal += 20;
      finalPrice += repairsTotal;

      totalAmount += finalPrice;
      calculatedItems.push({
        ...item,
        calculatedPrice: finalPrice,
        isDiscountedSet
      });
    }

    return NextResponse.json({ totalAmount, calculatedItems });
  } catch (error) {
    console.error('Error in calculate route:', error);
    return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 });
  }
}
