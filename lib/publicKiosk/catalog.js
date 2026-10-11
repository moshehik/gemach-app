// lib/publicKiosk/catalog.js - קטלוג הדגמים לעמדה הציבורית (GET /api/public-kiosk/models).
// עיקרון: ALLOW-LIST. כל שדה שיוצא מופיע ב-shapePublicModel במפורש; שדה חדש ב-DressModel/DressItem לא יוצא לעולם בלי שינוי כאן.
// לא יוצאים: מזהים פנימיים (id), ברקודי פריטים, מיקומים, הערות, מחירי עלות, ספירות השכרה, מצב תיקון/לא-בשימוש, תאריכי כניסה/יציאה.
// כן יוצאים: שם הדגם, מספר הדגם (barcodePrefix - המספר שהלקוחה אומרת "דגם 511"), קטגוריית מחיר, תמונה (רק אם hide_dress_images כבוי), מידות.
// מלאי/זמינות (qty, available, inStock) יוצאים אך ורק כש-showInventory דלוק - ואז רק לפי תאריך שנבחר, וכמות מוגבלת ל-QTY_CAP.
import prisma from '@/app/lib/prisma';
import { modelMatchesQuery } from '@/lib/kioskModelSearch';

export const QTY_CAP = 5;        // כמות פנויה מוצגת עד 5 ("5" = 5 ומעלה) - לא חושפים כמויות מלאי מדויקות לציבור
export const MAX_MODELS = 500;
const MAX_NAME = 120;
const MAX_SIZE = 30;
const CATALOG_TTL_MS = 60 * 1000;
const AVAIL_TTL_MS = 60 * 1000;
const AVAIL_CACHE_MAX = 60;

const ATTACHMENT_URL = /^\/api\/attachment\/[0-9a-fA-F-]{8,64}$/;
/** רק נתיב הגשת תמונות פנימי או https; אחרת null (למשל javascript:, data:, נתיבים אחרים). */
export function safeImageUrl(u) {
  if (typeof u !== 'string') return null;
  const s = u.trim();
  if (!s || s.length > 500) return null;
  if (ATTACHMENT_URL.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  return null;
}

function compareSizes(a, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a).localeCompare(String(b), 'he');
}

/** מידות ייחודיות (ממוינות) מרשימת פריטים [{sizeText}]. */
export function uniqueSizes(items) {
  const set = new Set();
  for (const it of items || []) {
    const s = String((it && it.sizeText) || 'כללי').trim().slice(0, MAX_SIZE) || 'כללי';
    set.add(s);
  }
  return Array.from(set).sort(compareSizes);
}

/**
 * הצורה הציבורית של דגם. model: שורת DB (id,name,barcodePrefix,priceCategory,imageUrl,thumbnailUrl,items[{sizeText}]).
 * availability: { [size]: { available:number } } או null/undefined (= אין מידע זמינות -> לא יוצא כלום על מלאי).
 */
export function shapePublicModel(model, { hideImages = false, availability = null } = {}) {
  const sizes = uniqueSizes(model.items);
  const out = {
    name: String(model.name || '').slice(0, MAX_NAME),
    code: model.barcodePrefix == null ? null : String(model.barcodePrefix).slice(0, 12),
    priceCategory: model.priceCategory ? String(model.priceCategory).slice(0, 60) : null,
    sizes: sizes.map((size) => {
      if (!availability) return { size };
      const a = availability[size];
      const qty = a ? Math.max(0, Math.min(QTY_CAP, Math.floor(Number(a.available) || 0))) : 0;
      return { size, available: qty > 0, qty };
    }),
  };
  if (!hideImages) {
    out.imageUrl = safeImageUrl(model.imageUrl);
    out.thumbnailUrl = safeImageUrl(model.thumbnailUrl);
  }
  if (availability) out.inStock = out.sizes.some((s) => s.available);
  return out;
}

/** סינון בזיכרון: q (שם/מספר דגם), category, size (מידה מדויקת). */
export function filterPublicModels(models, { q = '', category = '', size = '' } = {}) {
  return models.filter((m) => {
    if (category && m.priceCategory !== category) return false;
    if (size && !m.sizes.some((s) => s.size === size)) return false;
    if (q && !modelMatchesQuery({ name: m.name, barcodePrefix: m.code }, q)) return false;
    return true;
  });
}

// ---------------- DB + מטמוני תהליך ----------------
let catalogCache = { rows: null, expires: 0, promise: null };
const availCache = new Map(); // dateKey -> { data, expires }

/** דגמים פעילים (אותו תנאי כמו filterStatus=active של /api/dresses): לא מחוק, לא יצא מהמאגר, יש לפחות פריט פעיל אחד. */
async function loadActiveRows() {
  const now = Date.now();
  if (catalogCache.rows && catalogCache.expires > now) return catalogCache.rows;
  if (catalogCache.promise) return catalogCache.promise;
  const p = prisma.dressModel.findMany({
    where: { isDeleted: false, exitDateFromRepo: null, items: { some: { notInUse: false, isDeleted: false } } },
    select: {
      id: true, name: true, barcodePrefix: true, priceCategory: true, imageUrl: true, thumbnailUrl: true,
      items: { where: { notInUse: false, isDeleted: false }, select: { sizeText: true } },
    },
    orderBy: { name: 'asc' },
    take: MAX_MODELS,
  }).then((rows) => {
    catalogCache = { rows, expires: Date.now() + CATALOG_TTL_MS, promise: null };
    return rows;
  }).catch((e) => {
    catalogCache = { ...catalogCache, promise: null };
    throw e;
  });
  catalogCache = { ...catalogCache, promise: p };
  return p;
}

async function loadAvailability(dateKey, modelIds) {
  const now = Date.now();
  const hit = availCache.get(dateKey);
  if (hit && hit.expires > now) return hit.data;
  const { getBulkAvailableInventory } = await import('@/lib/inventory');
  const data = await getBulkAvailableInventory(new Date(`${dateKey}T12:00:00.000Z`), modelIds);
  if (availCache.size >= AVAIL_CACHE_MAX) availCache.clear();
  availCache.set(dateKey, { data, expires: now + AVAIL_TTL_MS });
  return data;
}

/** תאריך YYYY-MM-DD תקין בטווח סביר (אתמול .. +3 שנים) או null. */
export function parseEventDateKey(raw, now = new Date()) {
  const s = String(raw == null ? '' : raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  const min = now.getTime() - 2 * 86400000;
  const max = now.getTime() + 3 * 366 * 86400000;
  if (d.getTime() < min || d.getTime() > max) return null;
  return s;
}

/**
 * התשובה המלאה של GET /api/public-kiosk/models. cfg = loadPublicKioskConfig(). params כבר מנוקים בנתיב.
 * eventDateKey נקרא רק כש-cfg.showInventory; אחרת מתעלמים ממנו לגמרי (אין שום מידע מלאי בתשובה).
 */
export async function buildPublicModelsResponse(cfg, { q = '', category = '', size = '', eventDateKey = null } = {}) {
  const rows = await loadActiveRows();
  let availabilityByModel = null;
  const useAvail = !!(cfg.showInventory && eventDateKey);
  if (useAvail) availabilityByModel = await loadAvailability(eventDateKey, rows.map((r) => r.id));
  const shaped = rows.map((r) => shapePublicModel(r, {
    hideImages: cfg.hideImages,
    availability: useAvail ? (availabilityByModel[r.id] || {}) : null,
  }));
  const categories = Array.from(new Set(shaped.map((m) => m.priceCategory).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'he'));
  const allSizes = Array.from(new Set(shaped.flatMap((m) => m.sizes.map((s) => s.size)))).sort(compareSizes);
  const data = filterPublicModels(shaped, { q, category, size });
  return {
    data,
    total: data.length,
    categories,
    sizes: allSizes,
    inventory: useAvail ? { eventDate: eventDateKey, qtyCap: QTY_CAP } : null,
  };
}

export function resetPublicCatalogCache() {
  catalogCache = { rows: null, expires: 0, promise: null };
  availCache.clear();
}
