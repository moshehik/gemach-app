// lib/schedule/print/extras/manretDetail.js — ה-extra 'manretDetail' של דף 16 (דף קבלת החזרות, שלב 8 "החזרה ידנית").
//
// שורת שלב 8 בלו״ז (getScheduleDay) נושאת רק כמות ("2 פריטים", החלטה A3/B05: בלי דגם) - מסך הלו״ז באתר נשאר כך
// (PQ-01). הדף המודפס מפורט לכל פריט (דגם, מידה, תקין / לא תקין), ולכן ה-API טוען כאן, רק לדף הזה:
//   1. items:  הפריטים של הזמנות השלב - שאילתת OrderItem אחת (orderId in [...], isDeleted=false) + שאילתה קטנה אחת
//              לשמות דגמים (לפי קידומת) רק אם יש פריט בלי DressItem/שם דגם. { [orderId]: [{ id, model, size, returned, ok }] }.
//   2. late:   החזרות "באיחור" - הזמנות שמועד ההחזרה שלהן לפני היום המודפס והפריטים עוד לא הוחזרו (לא ברשימת היום
//              כי השלב נקבע לפי מועד ההחזרה בלבד). שאילתת Order אחת עם הפריטים בפנים. רק כשהיום המודפס הוא היום או
//              עתיד (על יום שעבר אי אפשר לדעת מי "הייתה באיחור" אז - מצב ההחזרה הוא של עכשיו). חלון: LATE_WINDOW_DAYS
//              אחורה, מקסימום LATE_MAX הזמנות (take), כדי שנתוני ייבוא ישנים שלא סומנו לא יציפו את הדף.
//   3. returnHour: standard_return_hour (ברירת מחדל 13:00, כמו app/print/order/page.js) - שורת ההנחיה בראש הדף.
// כללים: קריאה בלבד, בלי $transaction, Order.status NULL-safe ({OR:[{status:null},{status:{not:DRAFT}}]} - אף פעם notIn),
// ימי עסקים וגלגול מועד ההחזרה = אותו returnDueKeys של הלו״ז (החלטת הבעלים 2.10), "הוחזר" = isReturned או returnDate.
import prisma from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { getNonWorkingDaysConfig } from '@/lib/businessDaysServer';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { returnDueKeys, itemTaken, itemReturned, isDeliveryReturn } from '@/lib/schedule/loaders';
import { dayRange, addCalendarDays, daysBetween } from '@/lib/schedule/dates';

export const LATE_WINDOW_DAYS = 60;
export const LATE_MAX = 150;
const ITEMS_TAKE = 3000;
const DEFAULT_RETURN_HOUR = '13:00';
const NOT_DRAFT = { OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] };

const ITEM_SELECT = {
  id: true, orderId: true, description: true, sizeText: true, barcodePrefix: true, isTaken: true, takenDate: true, isReturned: true, returnDate: true, returnedOk: true,
  dressItem: { select: { sizeText: true, dress: { select: { name: true, barcodePrefix: true } } } },
};

/** פריט DB -> פריט לדף (בלי שם דגם מקידומת - זה נפתר אחרי כל השליפות) */
function viewItem(it, modelByPrefix) {
  const prefix = it.dressItem?.dress?.barcodePrefix ?? it.barcodePrefix ?? null;
  const name = it.dressItem?.dress?.name || (it.barcodePrefix != null ? modelByPrefix[it.barcodePrefix] : null) || it.description || null;
  // "שם - קידומת" כמו בעיצוב ("תחרה קלאסית - 4512"); בלי שם: "דגם <קידומת>"; בלי שניהם: ריק (הדף מציג קו)
  const model = name ? (prefix != null && !String(name).includes(String(prefix)) ? `${name} - ${prefix}` : String(name)) : (prefix != null ? `דגם ${prefix}` : '');
  const returned = itemReturned(it);
  return { id: it.id, model, size: it.sizeText || it.dressItem?.sizeText || '', returned, ok: returned ? !!it.returnedOk : null };
}
const sortItems = (a, b) => a.model.localeCompare(b.model, 'he') || String(a.size).localeCompare(String(b.size), 'he', { numeric: true }) || String(a.id).localeCompare(String(b.id));

export async function loadManretDetail(day, { client = prisma } = {}) {
  const stage = (day.stages || []).find((s) => s.key === 'manret');
  const rows = stage && stage.enabled ? stage.items : [];
  const out = { items: {}, late: [], lateTruncated: false, lateMax: LATE_MAX, lateWindowDays: LATE_WINDOW_DAYS, returnHour: DEFAULT_RETURN_HOUR };

  try {
    const hour = await getCachedSetting('standard_return_hour', client);
    if (hour && hour.value && /^\d{1,2}:\d{2}$/.test(String(hour.value).trim())) out.returnHour = String(hour.value).trim();
  } catch { /* ברירת מחדל */ }

  // ---- 1. פריטי ההזמנות של היום ----
  const ids = [...new Set(rows.map((r) => r.orderId))];
  let rawDay = [];
  if (ids.length) {
    rawDay = await client.orderItem.findMany({ where: { orderId: { in: ids }, isDeleted: false }, select: ITEM_SELECT, take: ITEMS_TAKE });
  }

  // ---- 2. באיחור ----
  let lateOrders = [];
  const stageCfgOffset = stage ? stage.offsetBusinessDays : 1;
  const lateWanted = !!(stage && stage.enabled && day.date >= (day.today || day.date));
  if (lateWanted) {
    const nonWorkingDays = await getNonWorkingDaysConfig(client);
    const winStart = dayRange(addCalendarDays(day.date, -LATE_WINDOW_DAYS)).start;
    const dayStart = dayRange(day.date).start;
    const found = await client.order.findMany({
      where: {
        AND: [
          { isDeleted: false },
          NOT_DRAFT,
          { items: { some: { isTaken: true, isReturned: false, isDeleted: false } } },
          { OR: [
            { toDate: { gte: winStart, lt: dayStart } },
            { returnDate: { gte: winStart, lt: dayStart } },
            { AND: [{ toDate: null }, { returnDate: null }, { eventDate: { gte: winStart, lt: dayStart } }] },
          ] },
        ],
      },
      select: {
        orderId: true, eventDate: true, toDate: true, returnDate: true, isDelivery: true, deliveryDirection: true, branch: true,
        customer: { select: { firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true } },
        items: { where: { isDeleted: false }, select: ITEM_SELECT },
      },
      orderBy: { eventDate: 'asc' },
      take: LATE_MAX + 1,
    });
    out.lateTruncated = found.length > LATE_MAX;
    const branchFilter = day.settings && day.settings.branchFilter;
    for (const o of found.slice(0, LATE_MAX)) {
      if (isDeliveryReturn(o)) continue; // חוזרות בשליח - שלב 9, לא קבלה ידנית
      if (branchFilter && (o.branch || null) !== branchFilter) continue;
      const due = returnDueKeys(o, { offset: stageCfgOffset, nonWorkingDays }).due;
      if (!due || due >= day.date) continue;
      const daysLate = daysBetween(due, day.date);
      if (daysLate > LATE_WINDOW_DAYS) continue;
      if (!(o.items || []).some((it) => itemTaken(it) && !itemReturned(it))) continue;
      lateOrders.push({ order: o, dueKey: due, daysLate });
    }
  }

  // ---- שמות דגמים לפריטים בלי DressItem (שאילתה אחת לפי קידומת, כמו הלו״ז) ----
  const allRaw = [...rawDay, ...lateOrders.flatMap((x) => x.order.items || [])];
  const prefixes = new Set();
  for (const it of allRaw) if (!it.dressItem?.dress?.name && it.barcodePrefix != null) prefixes.add(it.barcodePrefix);
  let modelByPrefix = {};
  if (prefixes.size) {
    const models = await client.dressModel.findMany({ where: { barcodePrefix: { in: [...prefixes] } }, select: { barcodePrefix: true, name: true } });
    modelByPrefix = Object.fromEntries(models.map((m) => [m.barcodePrefix, m.name]));
  }

  for (const it of rawDay) (out.items[it.orderId] ||= []).push(viewItem(it, modelByPrefix));
  for (const k of Object.keys(out.items)) out.items[k].sort(sortItems);

  out.late = lateOrders
    .map(({ order: o, dueKey, daysLate }) => ({
      orderId: o.orderId,
      customer: { firstName: o.customer?.firstName || '', lastName: o.customer?.lastName || '', phone1: o.customer?.phone1 || '', phone2: o.customer?.phone2 || '' },
      street: [o.customer?.street, o.customer?.houseNum].filter((x) => x !== null && x !== undefined && String(x).trim() !== '').join(' '),
      city: o.customer?.city || '',
      dueKey,
      daysLate,
      items: (o.items || []).map((it) => viewItem(it, modelByPrefix)).sort(sortItems),
    }))
    .sort((a, b) => b.daysLate - a.daysLate || a.orderId - b.orderId);
  return out;
}
