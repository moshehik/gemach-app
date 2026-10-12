// lib/stationAnalytics/service.js - הרכבת מסך המדדים: שליפות (queries.js) + חישוב טהור (compute.js). db מוזרק (בדיקות / DB TEST), בלי תלות ב-Next.
// server.js עוטף אותו עם prisma, מטמון קצר והגדרות הקישור הציבורי.
import { addDaysToDateKey, getIsraelDateKey } from '@/lib/hebrewDate';
import {
  DEFAULT_WINDOW_DAYS, MAX_RANGE_DAYS, MAX_WINDOW_DAYS, MIN_WINDOW_DAYS, VIEW_CHANNELS, WEEK_AVG_DAYS,
} from './constants';
import { buildAnalytics, buildCards, buildRegistrationEntries, enumerateDays, evaluateEntry, indexOrders, shortName } from './compute';
import { isMissingTableError, loadCustomers, loadEventCounts, loadOrders, loadRegistrationEvents, orderWindowBounds } from './queries';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDay(s) {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** מנרמל פרמטרים מה-URL. מחזיר { params } או { error }. ברירת מחדל: 7 ימים עד היום, ערוץ public, חלון 14. */
export function parseParams(raw, now = new Date()) {
  const today = getIsraelDateKey(now);
  const r = raw || {};
  const to = r.to ? String(r.to) : today;
  const from = r.from ? String(r.from) : addDaysToDateKey(to, -6);
  if (!validDay(from) || !validDay(to)) return { error: 'תאריך לא תקין' };
  if (from > to) return { error: 'תאריך ההתחלה אחרי תאריך הסיום' };
  const span = enumerateDays(from, to).length;
  if (span > MAX_RANGE_DAYS) return { error: `אפשר לבקש עד ${MAX_RANGE_DAYS} ימים בבת אחת` };
  const channel = r.channel === undefined || r.channel === '' ? 'public' : String(r.channel);
  if (!VIEW_CHANNELS.includes(channel)) return { error: 'ערוץ לא תקין' };
  let windowDays = DEFAULT_WINDOW_DAYS;
  if (r.windowDays !== undefined && r.windowDays !== '') {
    const n = parseInt(r.windowDays, 10);
    if (!Number.isFinite(n) || n < MIN_WINDOW_DAYS || n > MAX_WINDOW_DAYS) return { error: 'חלון ההמרה חייב להיות בין 1 ל-60 ימים' };
    windowDays = n;
  }
  return { params: { from, to, channel, windowDays } };
}

/**
 * @returns {Promise<object>} { status:'ok'|'no_table', ... } - no_table כשהטבלה StationEvent עוד לא נוצרה ב-DB.
 */
export async function computeStationAnalytics(db, { from, to, channel = 'public', windowDays = DEFAULT_WINDOW_DAYS }, { now = new Date() } = {}) {
  const todayKey = getIsraelDateKey(now);
  // טווח השליפה = איחוד של הטווח המבוקש וטווח ההשוואה של הכרטיסים (היום ו-7 הימים שלפניו)
  const refFrom = addDaysToDateKey(todayKey, -WEEK_AVG_DAYS);
  const loadFrom = from < refFrom ? from : refFrom;
  const loadTo = to > todayKey ? to : todayKey;
  let events;
  let regs;
  try {
    events = await loadEventCounts(db, loadFrom, loadTo);
    regs = await loadRegistrationEvents(db, loadFrom, loadTo);
  } catch (e) {
    if (isMissingTableError(e)) return { status: 'no_table' };
    throw e;
  }
  const customers = await loadCustomers(db, regs.map((r) => r.customerId));
  const { fromAt, toAt } = orderWindowBounds(loadFrom, loadTo, windowDays);
  const orders = await loadOrders(db, regs.map((r) => r.customerId), fromAt, toAt);

  const input = { channel, windowDays, now, events, registrations: regs, customers, orders };
  const result = buildAnalytics({ ...input, from, to });
  const ref = buildAnalytics({ ...input, from: loadFrom, to: loadTo });
  const cards = buildCards({ daily: ref.daily, todayKey, topMeasured: result.topMeasured, avgDays: WEEK_AVG_DAYS });
  return { status: 'ok', generatedAt: now.toISOString(), ...result, cards };
}

/**
 * הרישומים של יום מסוים (עם שם פרטי + אות ראשונה של משפחה, סטטוס אימות והאם סגרה הזמנה). PII מינימלי - רק לגורם עם הרשאת לקוחות.
 * @returns {Promise<{status:string, day:string, rows:Array}>}
 */
export async function listDayRegistrations(db, { day, channel = 'all', windowDays = DEFAULT_WINDOW_DAYS }, { now = new Date() } = {}) {
  let regs;
  try {
    regs = await loadRegistrationEvents(db, day, day);
  } catch (e) {
    if (isMissingTableError(e)) return { status: 'no_table', day, rows: [] };
    throw e;
  }
  const customers = await loadCustomers(db, regs.map((r) => r.customerId), { withNames: true });
  const { fromAt, toAt } = orderWindowBounds(day, day, windowDays);
  const orders = await loadOrders(db, regs.map((r) => r.customerId), fromAt, toAt);
  const { byDay } = buildRegistrationEntries({ registrations: regs, customers, channel, days: [day] });
  const ordersByCustomer = indexOrders(orders);
  const todayKey = getIsraelDateKey(now);
  const rows = byDay.get(day).map((entry) => {
    const c = customers.get(entry.customerId);
    const ev = evaluateEntry(entry, ordersByCustomer, { windowDays, todayKey });
    return {
      customerId: entry.customerId,
      name: shortName(c && c.firstName, c && c.lastName),
      at: new Date(entry.at).toISOString(),
      channel: entry.channel,
      outcome: entry.outcome,
      verification: c ? c.state : null, // 'pending' | 'repeat' | 'verified' | null
      closedSameDay: ev.closedSameDay,
      closed: ev.closedInWindow,
      savedUnpaid: ev.savedOnly,
    };
  });
  return { status: 'ok', day, rows };
}
