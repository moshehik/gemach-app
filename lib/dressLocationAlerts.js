// lib/dressLocationAlerts.js — (פורט ללא שינוי לוגי מ-feature/neve-batch-2026-09-25, R49 בכרטיס ההזמנה החדש; הממשק: parts/OcDressLocationBanner.js)
// התראה בולטת על שמלות שהוזמנו להזמנה קרובה אך פיזית עדיין לא "בבית":
//   (א) יחידה שמושכרת כרגע בהזמנה אחרת (OrderItem נלקח ולא הוחזר) - "עדיין באירוע";
//   (ב) יחידה שהמיקום שלה (DressItem.location) הוא סניף אחר מסניף ההזמנה - "צריכה לעבור".
// קריאה בלבד: לא משנה שום זמינות/מלאי (lib/inventory.js לא נגעים בו, וגם הגדרות החסימה
// inventory_include_warehouse / allow_renting_reserve_items רק נקראות כדי להתאים בדיוק לאילו
// יחידות נחשבות "במלאי"). הכל בשאילתות מקובצות (5 שאילתות לכל הקריאה, בלי N+1 ובלי טרנזקציה).
//
// מגבלה מהותית של הנתונים: בהזמנה שטרם נלקחה לפריט אין עדיין יחידה פיזית - ברקוד משויך רק
// בסריקה בעת הלקיחה (ר' app/api/rentals/scan). לכן ההשוואה היא ברמת דגם+מידה: כמה יחידות
// "בבית" קיימות מול כמה נדרשות בהזמנה. פריט שכבר שויך אליו ברקוד נבדק ישירות מול אותה יחידה.
//
// הגדרה: enable_dress_location_alert (חסר/כבוי = אין שום התראה ואפס שאילתות). רשימת הסניפים: branch_list.

import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { toIsraelCalendarDate } from '@/lib/hebrewDate';
import { parseBarcode } from '@/lib/rentalBarcodeMatch';

export async function isDressLocationAlertEnabled() {
  try {
    const all = await getAllCachedSettings();
    return all.find(s => s.key === 'enable_dress_location_alert')?.value === 'true';
  } catch {
    return false;
  }
}

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? parseInt(s, 10) : null;
};

// מזהה קידומת+מידה אפקטיבית של פריט הזמנה, באותו סדר עדיפויות כמו /api/rentals/scan.
function itemIdentity(item) {
  let prefix = num(item.dressItem?.dress?.barcodePrefix) ?? num(item.dressItem?.barcodePrefix) ?? num(item.barcodePrefix);
  let size = num(item.sizeText) ?? num(item.dressItem?.sizeText);
  if ((prefix === null || size === null) && item.barcode) {
    const parsed = parseBarcode(item.barcode);
    if (parsed) {
      if (prefix === null) prefix = num(parsed.prefix);
      if (size === null) size = num(parsed.size);
    }
  }
  return { prefix, size };
}

const dayKey = (d) => { const a = toIsraelCalendarDate(d); return a ? a.getTime() : null; };

/**
 * @param {number[]} orderIds מספרי הזמנה (Order.orderId)
 * @returns {Promise<Array<{orderId:number, eventDate:Date|null, customerName:string, alerts:Array}>>}
 *   מחזיר רשומה לכל הזמנה שנמצאה (alerts יכול להיות ריק). ריק כשההגדרה כבויה.
 */
export async function computeDressLocationAlerts(orderIds) {
  const ids = [...new Set((orderIds || []).map(n => parseInt(n, 10)).filter(Number.isFinite))];
  if (ids.length === 0 || !(await isDressLocationAlertEnabled())) return [];

  const settings = await getAllCachedSettings();
  const setting = (k) => settings.find(s => s.key === k)?.value;
  const includeWarehouse = setting('inventory_include_warehouse') === 'true';
  const allowReserve = setting('allow_renting_reserve_items') === 'true';
  const excludeTerms = [
    ...(includeWarehouse ? [] : ['מחסן', 'warehouse']),
    ...(allowReserve ? [] : ['רזרבה', 'reserve']),
  ];
  const branchTerms = (setting('branch_list') || '').split(',').map(s => s.trim()).filter(Boolean);

  // 1. ההזמנות ופריטיהן שטרם נלקחו
  const orders = await prisma.order.findMany({
    where: { orderId: { in: ids }, isDeleted: false },
    select: {
      orderId: true, eventDate: true, branch: true, pickupBranch: true,
      customer: { select: { firstName: true, lastName: true } },
      items: {
        where: { isDeleted: false, isTaken: false, isReturned: false },
        select: {
          id: true, description: true, barcode: true, barcodePrefix: true, sizeText: true,
          dressItem: { select: { dressBarcode: true, barcodePrefix: true, sizeText: true, dress: { select: { barcodePrefix: true, name: true } } } },
        },
      },
    },
  });

  const wantedPrefixes = new Set();
  for (const o of orders) for (const it of o.items) {
    const { prefix } = itemIdentity(it);
    if (prefix !== null) wantedPrefixes.add(prefix);
  }
  if (wantedPrefixes.size === 0) return orders.map(o => ({ orderId: o.orderId, eventDate: o.eventDate, customerName: '', alerts: [] }));
  const prefixList = [...wantedPrefixes];

  // 2. כל היחידות הפיזיות הפעילות של הדגמים האלה (אותם תנאי "במלאי" כמו lib/inventory.js)
  const allUnits = await prisma.dressItem.findMany({
    where: {
      isDeleted: false, notInUse: false, inRepair: false,
      OR: [{ barcodePrefix: { in: prefixList } }, { dress: { barcodePrefix: { in: prefixList } } }],
    },
    select: { id: true, dressBarcode: true, sizeText: true, location: true, barcodePrefix: true, dress: { select: { barcodePrefix: true, name: true } } },
  });
  const lower = (s) => (s || '').toLowerCase();
  const units = allUnits.filter(u => !excludeTerms.some(t => lower(u.location).includes(t.toLowerCase())));

  // 3. אילו מהן מושכרות עכשיו (נלקחו ולא הוחזרו) - שאילתה אחת לפי רשימת הברקודים
  const barcodes = units.map(u => u.dressBarcode).filter(Boolean);
  const outRows = barcodes.length === 0 ? [] : await prisma.orderItem.findMany({
    where: { barcode: { in: barcodes }, isTaken: true, isReturned: false, isDeleted: false, order: { isDeleted: false } },
    select: { barcode: true, orderId: true, order: { select: { orderId: true, eventDate: true, fromDate: true, toDate: true, returnDate: true } } },
  });
  const outByBarcode = new Map();
  for (const r of outRows) if (!outByBarcode.has(r.barcode)) outByBarcode.set(r.barcode, r);

  const todayKey = dayKey(new Date());
  const unitsByKey = new Map();
  for (const u of units) {
    const prefix = num(u.dress?.barcodePrefix) ?? num(u.barcodePrefix);
    const size = num(u.sizeText);
    if (prefix === null) continue;
    const k = `${prefix}|${size}`;
    if (!unitsByKey.has(k)) unitsByKey.set(k, []);
    unitsByKey.get(k).push(u);
  }

  const branchOf = (location) => branchTerms.find(b => lower(location).includes(b.toLowerCase())) || null;

  const result = [];
  for (const o of orders) {
    const targetBranch = o.pickupBranch || o.branch || null;
    const eventKey = dayKey(o.eventDate);
    const customerName = o.customer ? `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim() : '';

    // מצב יחידה ביחס להזמנה הזו
    const describeAway = (u) => {
      const out = outByBarcode.get(u.dressBarcode);
      if (out && out.orderId !== o.orderId) {
        const prev = out.order || {};
        const expected = prev.returnDate || prev.toDate || prev.eventDate || null;
        const expKey = dayKey(expected);
        return {
          barcode: u.dressBarcode, kind: 'out', orderId: out.orderId,
          eventDate: prev.eventDate || null, expectedReturn: expected,
          overdue: expKey !== null && todayKey !== null && expKey < todayKey,
          backBeforeEvent: expKey !== null && eventKey !== null && expKey < eventKey,
        };
      }
      const b = branchOf(u.location);
      if (b && targetBranch && lower(b) !== lower(targetBranch)) {
        return { barcode: u.dressBarcode, kind: 'branch', branch: b, location: u.location, backBeforeEvent: true };
      }
      return null;
    };

    // קיבוץ פריטי ההזמנה לפי דגם+מידה
    const groups = new Map();
    for (const it of o.items) {
      const { prefix, size } = itemIdentity(it);
      if (prefix === null) continue;
      const k = `${prefix}|${size}`;
      if (!groups.has(k)) groups.set(k, { prefix, size, items: [] });
      groups.get(k).items.push(it);
    }

    const alerts = [];
    for (const [k, g] of groups) {
      const candidates = unitsByKey.get(k) || [];
      if (candidates.length === 0) continue;
      const modelName = candidates[0].dress?.name || `דגם ${g.prefix}`;
      const sizeLabel = g.size === null ? '' : String(g.size);

      // (1) פריט ששויך אליו כבר ברקוד ספציפי - נבדק ישירות מול אותה יחידה
      const assignedAway = [];
      for (const it of g.items) {
        if (!it.barcode) continue;
        const u = candidates.find(c => c.dressBarcode === it.barcode);
        const away = u ? describeAway(u) : null;
        if (away) assignedAway.push(away);
      }
      if (assignedAway.length > 0) {
        alerts.push({
          key: `${k}|assigned`, modelName, size: sizeLabel, needed: g.items.length, homeCount: null, shortage: assignedAway.length,
          severity: assignedAway.every(a => a.backBeforeEvent) ? 'warning' : 'critical', assigned: true, away: assignedAway,
        });
        continue;
      }

      // (2) ברמת דגם+מידה: כמה יחידות "בבית" מול כמה נדרשות
      const unassignedNeeded = g.items.filter(it => !it.barcode).length;
      const away = [];
      let home = 0;
      for (const u of candidates) {
        const a = describeAway(u);
        if (a) away.push(a); else home += 1;
      }
      const shortage = unassignedNeeded - home;
      if (shortage <= 0 || away.length === 0) continue;
      const coverable = away.filter(a => a.backBeforeEvent).length;
      away.sort((a, b) => (a.expectedReturn ? new Date(a.expectedReturn).getTime() : Infinity) - (b.expectedReturn ? new Date(b.expectedReturn).getTime() : Infinity));
      alerts.push({
        key: `${k}|model`, modelName, size: sizeLabel, needed: unassignedNeeded, homeCount: home, shortage,
        severity: coverable >= shortage ? 'warning' : 'critical', assigned: false, away,
      });
    }
    result.push({ orderId: o.orderId, eventDate: o.eventDate, customerName, alerts });
  }
  return result;
}
