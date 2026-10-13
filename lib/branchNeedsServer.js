// lib/branchNeedsServer.js - צד שרת של חישוב הצרכים לפי סניף (lib/branchNeeds.js הוא החישוב הטהור). קריאה בלבד, בלי $transaction,
// קבוצת שאילתות קבועה (הזמנות עתידיות + היחידות של הדגמים האלה), ממטמן קצר בזיכרון (30 ש', לפי מסד).
// פועל רק כש-multi_branch_enabled דלוק (loadBranchContext); כבוי = מחזיר ריק בלי שום שאילתה.
import prisma from '@/app/lib/prisma';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { addDaysToDateKey, getIsraelDateKey, getIsraelDayRange, getIsraelDaysUntil, getIsraelTodayKey } from '@/lib/hebrewDate';
import { currentDbModeTag } from '@/lib/dbMode';
import { parseBarcode } from '@/lib/rentalBarcodeMatch';
import { loadBranchContext } from '@/lib/branchesServer';
import { computeBranchNeeds, computeReturnAdvice } from '@/lib/branchNeeds';
import { orderTargetBranch } from '@/lib/branches';

const NOT_DRAFT = { OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] };
const ORDERS_CAP = 600;
const TTL_MS = 30 * 1000;
let cache = { key: '', at: 0, value: null };

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? parseInt(s, 10) : null;
};

// קידומת + מידה של פריט הזמנה, באותו סדר עדיפויות כמו dressLocationAlerts / rentals/scan
function itemIdentity(item) {
  let prefix = num(item.dressItem?.dress?.barcodePrefix) ?? num(item.dressItem?.barcodePrefix) ?? num(item.barcodePrefix);
  let size = num(item.sizeText) ?? num(item.dressItem?.sizeText);
  if ((prefix === null || size === null) && item.barcode) {
    const p = parseBarcode(item.barcode);
    if (p) { if (prefix === null) prefix = num(p.prefix); if (size === null) size = num(p.size); }
  }
  return { prefix, size };
}

const ORDER_SELECT = {
  orderId: true, eventDate: true, branch: true, pickupBranch: true,
  customer: { select: { firstName: true, lastName: true } },
  items: {
    where: { isDeleted: false, isTaken: false, isReturned: false },
    select: {
      id: true, barcode: true, barcodePrefix: true, sizeText: true,
      dressItem: { select: { barcodePrefix: true, sizeText: true, dress: { select: { barcodePrefix: true } } } },
    },
  },
};

async function loadInputs({ ctx, fromKey, toKey, prefixFilter = null, barcodeFilter = null, now }) {
  const range = { gte: getIsraelDayRange(fromKey).start, lte: getIsraelDayRange(toKey).end };
  const itemMatch = prefixFilter !== null || barcodeFilter
    ? { items: { some: { isDeleted: false, isTaken: false, isReturned: false, OR: [
      ...(barcodeFilter ? [{ barcode: barcodeFilter }] : []),
      ...(prefixFilter !== null ? [{ barcodePrefix: prefixFilter }, { dressItem: { dress: { barcodePrefix: prefixFilter } } }, { dressItem: { barcodePrefix: prefixFilter } }] : []),
    ] } } }
    : { items: { some: { isDeleted: false, isTaken: false, isReturned: false } } };
  const rows = await prisma.order.findMany({
    where: { isDeleted: false, ...NOT_DRAFT, eventDate: range, ...itemMatch },
    select: ORDER_SELECT,
    orderBy: { eventDate: 'asc' },
    take: ORDERS_CAP,
  });
  const prefixes = new Set();
  const orders = rows.map((o) => {
    const items = o.items.map((it) => {
      const { prefix, size } = itemIdentity(it);
      if (prefix !== null) prefixes.add(prefix);
      return { id: it.id, prefix, size, barcode: it.barcode || null };
    });
    const c = o.customer;
    return {
      orderId: o.orderId, eventKey: getIsraelDateKey(o.eventDate) || toKeyFallback(o.eventDate), target: orderTargetBranch(o),
      customerName: c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '', items,
    };
  });
  if (prefixFilter !== null) prefixes.add(prefixFilter);
  let units = [];
  if (prefixes.size) {
    const list = [...prefixes];
    const found = await prisma.dressItem.findMany({
      where: { isDeleted: false, OR: [{ barcodePrefix: { in: list } }, { dress: { barcodePrefix: { in: list } } }] },
      select: { dressBarcode: true, sizeText: true, branch: true, location: true, inRepair: true, notInUse: true, barcodePrefix: true, dress: { select: { barcodePrefix: true, name: true } } },
    });
    units = found.filter((u) => u.dressBarcode).map((u) => ({
      barcode: u.dressBarcode, prefix: num(u.dress?.barcodePrefix) ?? num(u.barcodePrefix), size: num(u.sizeText),
      branch: u.branch || null, location: u.location || null, inRepair: !!u.inRepair, notInUse: !!u.notInUse, modelName: u.dress?.name || '',
    }));
  }
  const stock = { includeWarehouse: ctx.map.inventory_include_warehouse === 'true', allowReserve: ctx.map.allow_renting_reserve_items === 'true' };
  return { orders, units, stock, now };
}
const toKeyFallback = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/**
 * ההעברות הנדרשות לפי ההזמנות העתידיות. מחזיר { enabled, transfers, shortages, horizonDays, generatedAt } (ריק כשהריבוי כבוי).
 * @param {{ horizonDays?: number, fresh?: boolean, now?: Date }} [opts]
 */
export async function getBranchNeeds({ horizonDays, fresh = false, now = new Date() } = {}) {
  const ctx = await loadBranchContext();
  if (!ctx.enabled || ctx.cfg.branches.filter((b) => b.active).length < 2) {
    return { enabled: ctx.enabled, transfers: [], shortages: [], pendingReturns: [], horizonDays: horizonDays || ctx.notice.horizonDays, generatedAt: now.toISOString() };
  }
  const horizon = horizonDays || ctx.notice.horizonDays;
  const key = `${currentDbModeTag()}|${horizon}|${getIsraelTodayKey(now)}`;
  if (!fresh && cache.key === key && Date.now() - cache.at < TTL_MS && cache.value) return cache.value;
  const todayKey = getIsraelTodayKey(now);
  const inputs = await loadInputs({ ctx, fromKey: todayKey, toKey: addDaysToDateKey(todayKey, horizon), now });
  const { transfers, shortages, pendingReturns } = computeBranchNeeds({ orders: inputs.orders, units: inputs.units, cfg: ctx.cfg, stock: inputs.stock });
  const decorate = (t) => ({ ...t, daysUntil: getIsraelDaysUntil(t.eventKey, now) });
  const value = { enabled: true, transfers: transfers.map(decorate), shortages: shortages.map(decorate), pendingReturns: pendingReturns.map(decorate), horizonDays: horizon, generatedAt: now.toISOString() };
  cache = { key, at: Date.now(), value };
  return value;
}

export function invalidateBranchNeedsCache() { cache = { key: '', at: 0, value: null }; }

/** העברות לפי מספרי הזמנה (לשורות הלו"ז): Map(orderId -> transfers[]) */
export async function getTransfersByOrder(orderIds, opts = {}) {
  const set = new Set(orderIds || []);
  const needs = await getBranchNeeds(opts);
  const map = new Map();
  for (const t of needs.transfers) {
    if (!set.has(t.orderId)) continue;
    if (!map.has(t.orderId)) map.set(t.orderId, []);
    map.get(t.orderId).push(t);
  }
  return map;
}

/**
 * התראת החזרה: אחרי החזרת ברקוד בסניף atBranch - האם הוא צריך לעבור לסניף אחר? (חישוב טרי, מצומצם לדגם / ברקוד הזה).
 * @returns {Promise<{ to:string, orderId:number, eventKey:string, direct:boolean }|null>}
 */
export async function getReturnBranchAdvice({ barcode, atBranch, now = new Date() }) {
  const ctx = await loadBranchContext();
  if (!ctx.enabled || !atBranch || !barcode) return null;
  const parsed = parseBarcode(barcode);
  const prefix = parsed ? num(parsed.prefix) : null;
  const todayKey = getIsraelTodayKey(now);
  const inputs = await loadInputs({ ctx, fromKey: todayKey, toKey: addDaysToDateKey(todayKey, ctx.notice.horizonDays), prefixFilter: prefix, barcodeFilter: String(barcode), now });
  return computeReturnAdvice({ returnedBarcode: String(barcode), atBranch, orders: inputs.orders, units: inputs.units, cfg: ctx.cfg, stock: inputs.stock });
}
