// lib/schedule/print/data.js — בונה את מטען ההדפסה (JSON) מתשובת getScheduleDay, בלי Prisma ישיר (חוץ מ-loadExtras).
//
// הזרימה: route.js -> getScheduleDay (פעם אחת לכל הדפים שנבחרו) -> loadExtras (רק מה שהדפים ביקשו) ->
// buildPrintPayload -> { meta, pages:[{ key, version, def, data, pageCode }] }. אותו מטען משמש את דף ההדפסה
// (app/schedule/print/[page]) ואת הייצוא (format=rows -> toRows של כל דף).
import prisma from '@/app/lib/prisma';
import { getPrintPage, publicPageInfo, defaultVersion, isValidVersion } from './registry';
import { getPageModule } from './pages';
import { dayCode } from './barcode';
import { hLong, greg, israelTime, israelKey } from './format';
import { loadItemInfo } from './extras/itemInfo';

// ---- נתונים נוספים שהדפים מבקשים ("extras") -----------------------------------------------------
// 'orderInfo' -> extras.orderInfo[orderId] = { totalPaid, delivery:{ isDelivery, direction }, city } להזמנות שבשלבים
// שהדפים המבקשים מזינים. שאילתת Prisma אחת (findMany, לא groupBy - כדי שגם המוק של הבדיקות יריץ אותה).
// totalPaid = סכום התשלומים שאינם מחוקים, כמו totalPaid ב-GET /api/orders.
export async function loadExtras(day, pageDefs, { client = prisma } = {}) {
  const wanted = new Set();
  for (const p of pageDefs) for (const x of p.extras || []) wanted.add(x);
  const extras = {};
  if (wanted.has('orderInfo')) {
    const ids = new Set();
    for (const p of pageDefs) {
      if (!(p.extras || []).includes('orderInfo')) continue;
      for (const s of day.stages || []) if (p.stages.includes(s.key)) for (const r of s.items) ids.add(r.orderId);
    }
    extras.orderInfo = {};
    if (ids.size) {
      const orders = await client.order.findMany({
        where: { orderId: { in: [...ids] } },
        select: { orderId: true, isDelivery: true, deliveryDirection: true, customer: { select: { city: true } }, payments: { where: { isDeleted: false }, select: { amount: true, isDeleted: true } } },
      });
      for (const o of orders) {
        extras.orderInfo[o.orderId] = {
          // isDeleted מסונן כבר ב-where; הסינון החוזר כאן הוא הגנה (וגם מה שהמוק של הבדיקות מריץ)
          totalPaid: (o.payments || []).reduce((s, p) => s + (p.isDeleted ? 0 : Number(p.amount) || 0), 0),
          delivery: { isDelivery: !!o.isDelivery, direction: o.deliveryDirection || null },
          city: (o.customer && o.customer.city) || '',
        };
      }
    }
  }
  // 'itemInfo' (דפים 03, 04, 08, 09) -> extras.itemInfo[orderId][orderItemId] = { n, alt } - ר' extras/itemInfo.js
  if (wanted.has('itemInfo')) extras.itemInfo = await loadItemInfo(day, pageDefs, client);
  return extras;
}

/**
 * @param {object} p
 * @param {object} p.day        תשובת getScheduleDay
 * @param {string[]} p.keys     מפתחות דפים (קיימים ב-registry)
 * @param {object} [p.versions] { 'PP-03': 'b' }
 * @param {object} [p.extras]   תוצאת loadExtras
 * @param {object} [p.gmach]    { name, address, phone }
 * @param {string} [p.printedBy] שם המדפיס/ה
 * @param {Date}   [p.now]
 */
export function buildPrintPayload({ day, keys, versions = {}, extras = {}, gmach = {}, printedBy = '', now = new Date() }) {
  const pages = [];
  for (const key of keys) {
    const def = getPrintPage(key);
    if (!def) continue;
    const mod = getPageModule(key);
    const version = def.versions ? (isValidVersion(def, versions[key]) ? versions[key] : defaultVersion(def)) : null;
    if (!mod || def.status !== 'ready') {
      pages.push({ key, version, def: publicPageInfo(def), notBuilt: true, data: null, pageCode: null });
      continue;
    }
    const data = mod.build({ day, page: def, version, extras, now });
    pages.push({
      key,
      version,
      def: publicPageInfo(def),
      data,
      // ברקוד "כל הדף" (ALL-PRP-261014) - רק לדפים עם ברקוד; דפי "הזמנה בכל עמוד" מציבים קוד הזמנה בעצמם
      pageCode: def.barcode && def.barcode.page ? dayCode(def.barcode.prefix, day.date) : null,
    });
  }
  return {
    meta: {
      date: day.date,
      dateHebrew: hLong(day.date),
      dateGreg: greg(day.date),
      weekday: day.weekday || null,
      isToday: !!day.isToday,
      nonWorkingDay: !!day.nonWorkingDay,
      branch: (day.settings && day.settings.branchFilter) || null,
      pickupHours: (day.settings && day.settings.pickupHours) || null,
      gmach: { name: gmach.name || 'גמ״ח שמלות', address: gmach.address || '', phone: gmach.phone || '' },
      printedBy: printedBy || '',
      producedAt: now.toISOString(),
      producedKey: israelKey(now),
      producedTime: israelTime(now),
      truncated: !!day.truncated,
      warnings: day.warnings || [],
    },
    pages,
  };
}

/** שורות שטוחות לייצוא (format=rows): [{ key, label, sheetName, rows }] - רק דפים בנויים */
export function payloadToRows(payload) {
  const out = [];
  for (const p of payload.pages) {
    if (p.notBuilt) continue;
    const mod = getPageModule(p.key);
    const rows = mod && mod.toRows ? mod.toRows(p.data, { meta: payload.meta, version: p.version }) : [];
    out.push({ key: p.key, label: p.def.label, version: p.version, sheetName: (mod && mod.SHEET_NAME) || p.def.label, rows });
  }
  return out;
}
