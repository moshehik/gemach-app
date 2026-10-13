// lib/preloadStockCache.js - מטמון שרת קצר לחלק "הסטטי" של GET /api/inventory/preload: מלאי הפריטים הפעילים (3.5k שורות) + מפת קידומת-ברקוד -> דגם.
//
// למה (2026-10-13, ירידה בנתונים יוצאים מ-Neon): כרטיס הזמנה קורא ל-preload בכל פתיחה (גם לצפייה בלבד), ובכל קריאה נמשכו שוב כל פריטי המלאי
// וכל הדגמים (~40% מהמשקל של הקריאה) - נתון שכמעט לא משתנה. ההזמנות בחלון התאריכים (bookings) *לא* נמטמנות: הן משתנות עם כל הוספת פריט.
// מטמון ברמת האינסטנס החם (כמו lib/settingsCache.js); בקשת _t (רענון יזום של הלקוח אחרי כשל הוספה) עוקפת את המטמון ומרעננת אותו.
// בדיקת הזמינות האמיתית בהוספה/עריכה (lib/inventory.js) לא עוברת כאן - היא תמיד קוראת ישירות מה-DB.
//
// ללא תלויות (בטוח לייבוא בבדיקות). תגית מצב-המסד (currentDbModeTag) מועברת מבחוץ: בקשה שקוראת ממסד הגיבוי לא תקבל מלאי של המסד האמיתי.

export const STOCK_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 12; // תגית מסד x שילוב של שני הגדרות המחסן/רזרבה - קטן בהרבה מזה

const cache = new Map(); // key -> { data, expiresAt, promise }

export function stockCacheKey(excludeLocationTerms, tag = '') {
  return `${tag}#${[...excludeLocationTerms].sort().join(',')}`;
}

// טעינה ישירה מה-DB (זהה לקוד שהיה ב-route): stock[modelId][size] = { total, itemId }, prefixToModelId[barcodePrefix] = modelId
export async function loadStockSnapshot(prisma, excludeLocationTerms) {
  const stockItems = await prisma.dressItem.findMany({
    where: {
      notInUse: false,
      isDeleted: false,
      inRepair: false,
      ...(excludeLocationTerms.length > 0 ? {
        OR: [
          { location: null },
          { AND: excludeLocationTerms.map(term => ({ location: { not: { contains: term } } })) }
        ]
      } : {})
    },
    select: { id: true, dressModelId: true, sizeText: true, quantity: true }
  });

  const stock = {};
  stockItems.forEach(item => {
    if (!item.dressModelId) return;
    const size = item.sizeText || 'כללי';
    if (!stock[item.dressModelId]) stock[item.dressModelId] = {};
    if (!stock[item.dressModelId][size]) stock[item.dressModelId][size] = { total: 0, itemId: item.id };
    stock[item.dressModelId][size].total += (item.quantity || 1);
  });

  const models = await prisma.dressModel.findMany({ select: { id: true, barcodePrefix: true } });
  const prefixToModelId = {};
  models.forEach(m => { if (m.barcodePrefix) prefixToModelId[m.barcodePrefix] = m.id; });

  return { stock, prefixToModelId };
}

/**
 * מחזיר { stock, prefixToModelId } ממטמון (TTL 60 שנ') או טוען מה-DB.
 * options: { fresh = false (עוקף קריאה מהמטמון ומרענן אותו), tag = '' (currentDbModeTag), now = Date.now, ttlMs, loader = loadStockSnapshot }
 * שגיאות לא נמטמנות. ההחזר משותף בין בקשות - אסור לשנות אותו (ה-route רק מסריאל אותו).
 */
export async function getStockSnapshot(prisma, excludeLocationTerms, { fresh = false, tag = '', now = Date.now, ttlMs = STOCK_TTL_MS, loader = loadStockSnapshot } = {}) {
  const key = stockCacheKey(excludeLocationTerms, tag);
  const hit = cache.get(key);
  if (!fresh && hit) {
    if (hit.data && hit.expiresAt > now()) return hit.data;
    if (hit.promise) return hit.promise;
  }
  const promise = loader(prisma, excludeLocationTerms)
    .then((data) => {
      if (cache.size >= MAX_ENTRIES && !cache.has(key)) cache.clear();
      cache.set(key, { data, expiresAt: now() + ttlMs, promise: null });
      return data;
    })
    .catch((err) => {
      if (cache.get(key)?.promise === promise) {
        if (hit && hit.data) cache.set(key, { ...hit, promise: null }); else cache.delete(key);
      }
      throw err;
    });
  cache.set(key, { data: hit?.data || null, expiresAt: hit?.expiresAt || 0, promise });
  return promise;
}

export function clearStockSnapshotCache() { cache.clear(); }
