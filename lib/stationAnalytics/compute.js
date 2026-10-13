// lib/stationAnalytics/compute.js - חישוב מדדי ההמרה של העמדה הציבורית. מודול טהור: בלי DB, בלי React, בלי Next (נטען גם ב-node רגיל לבדיקות).
// הקלט נטען ע"י queries.js; כאן רק הלוגיקה, כדי שאפשר לבדוק אותה על מקרי קצה סינתטיים.
//
// הגדרות (המסמך המלא: docs/station-analytics.md):
//  * ביקור / בדיקת זמינות / פתיחת טופס: ספירת סשנים אנונימיים ליום (אירוע אחד לכל סשן ליום לכל סוג). הקישור הכללי בלבד.
//  * מילאו פרטים: לקוחות שונות (customerId) שהרישום שלהן הושלם (אירוע register, גם "רישום חוזר" של לקוחה קיימת). לקוחה שנמחקה לא נספרת.
//    ביום - לקוחה אחת פעם אחת ליום; בטווח - פעם אחת בטווח (הרישום הראשון בו).
//  * אומתו: מבין הנרשמות, מי שהסימון הנוכחי שלה ב-Customer.officeNotes הוא "אומתה" (בזמן החישוב, לא בזמן הרישום).
//  * הזמנה נפתחה (המדד העיקרי): הלקוחה בעמדה לא מזמינה בעצמה - העובדת ממשיכה עם הפרטים ישר להזמנה. לכן "המרה" = לנרשמת יש הזמנה אמיתית שנפתחה (Order.orderDate)
//    ברגע הרישום או אחריו, עד סוף היום ה-N אחרי יום הרישום (N = windowDays, ברירת מחדל 14; יום הרישום הוא יום 0; ימי לוח בישראל).
//    הזמנה אמיתית: לא מחוקה, לא טיוטה / שמור-לחיוב, עם פריט פעיל אחד לפחות - גם אם נשמרה בלי תשלום ובלי אישור מנהל. הזמנה שנוצרה לפני הרישום לא נספרת.
//  * הזמנה אושרה / שולמה (המדד המחמיר): אותה הזמנה, ולפחות אחד מפריטיה הפעילים בהחזקה קבועה (cartStatus 'confirmed': שולם משהו, או יציאה באישור מנהל,
//    או הזמנה שאין בה מה לשלם). כל הזמנה מאושרת היא גם נפתחה.
//  * "אותו יום": ההזמנה באותו יום קלנדרי בישראל כמו הרישום.
//  * חלון שטרם הסתיים: רישום שחלון ה-N ימים שלו עוד פתוח נספר, אך מסומן (matured=false) - אחוז ההמרה שלו עוד יכול לעלות.
import { getIsraelDateKey, addDaysToDateKey } from '@/lib/hebrewDate';
import { DEFAULT_WINDOW_DAYS, FUNNEL_STAGES } from './constants';

/** n/d כשבר; null כשהמכנה 0 (לא להציג 0% מטעה). */
export function ratio(n, d) {
  if (typeof n !== 'number' || typeof d !== 'number' || !isFinite(n) || !isFinite(d) || d <= 0) return null;
  return n / d;
}

/** רשימת מפתחות יום YYYY-MM-DD מ-from עד to כולל (ריקה אם from אחרי to). */
export function enumerateDays(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  let d = from;
  for (let i = 0; i < 4000 && d <= to; i++) { out.push(d); d = addDaysToDateKey(d, 1); }
  return out;
}

export function dayOf(dateInput) {
  return getIsraelDateKey(dateInput);
}

/** שם פרטי + האות הראשונה של שם המשפחה ("שרה כ."). לטבלת "הרישומים של היום" בלבד. */
export function shortName(first, last) {
  const f = String(first == null ? '' : first).trim();
  const l = String(last == null ? '' : last).trim();
  const initial = l ? `${Array.from(l)[0]}.` : '';
  return [f, initial].filter(Boolean).join(' ') || '(ללא שם)';
}

function toMs(v) {
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return isNaN(t) ? null : t;
}

/** מפה customerId -> הזמנות [{ at(ms), day, confirmed, hasItem }] ממוינות לפי זמן. */
export function indexOrders(orders) {
  const m = new Map();
  for (const o of orders || []) {
    if (!o || !o.customerId) continue;
    const ms = toMs(o.orderDate);
    if (ms == null) continue;
    const arr = m.get(o.customerId) || [];
    arr.push({ at: ms, day: dayOf(new Date(ms)), confirmed: !!o.confirmed, hasItem: o.hasItem === true || !!o.confirmed });
    m.set(o.customerId, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.at - b.at);
  return m;
}

/**
 * רישומים ברי-ספירה, לפי יום: אירועי register של ערוץ הסינון, לקוחה קיימת ולא מחוקה, לקוחה אחת פעם אחת ליום (האירוע המוקדם ביותר).
 * @returns {{ byDay: Map<string, Array<{customerId, at:number, day:string, channel:string, outcome:string}>>, droppedDeleted:number }}
 */
export function buildRegistrationEntries({ registrations, customers, channel = 'public', days }) {
  const inRange = new Set(days);
  const byDay = new Map(days.map((d) => [d, []]));
  let droppedDeleted = 0;
  const sorted = [...(registrations || [])].filter(Boolean).map((r) => ({ ...r, _ms: toMs(r.at) })).filter((r) => r._ms != null).sort((a, b) => a._ms - b._ms);
  const seenDroppedIds = new Set();
  const seenPerDay = new Set();
  for (const r of sorted) {
    if (!r.customerId || !inRange.has(r.dayKey)) continue;
    if (channel !== 'all' && r.channel !== channel) continue;
    const c = customers && customers.get ? customers.get(r.customerId) : null;
    if (!c || c.isDeleted) {
      if (!seenDroppedIds.has(r.customerId)) { seenDroppedIds.add(r.customerId); droppedDeleted++; }
      continue;
    }
    const k = `${r.dayKey}|${r.customerId}`;
    if (seenPerDay.has(k)) continue;
    seenPerDay.add(k);
    byDay.get(r.dayKey).push({ customerId: r.customerId, at: r._ms, day: r.dayKey, channel: r.channel, outcome: r.outcome || '' });
  }
  return { byDay, droppedDeleted };
}

/** מה קרה להזמנות של הנרשמת בחלון שאחרי הרישום. ordersByCustomer = תוצאת indexOrders. */
export function evaluateEntry(entry, ordersByCustomer, { windowDays = DEFAULT_WINDOW_DAYS, todayKey }) {
  const list = ordersByCustomer.get(entry.customerId) || [];
  const lastDay = addDaysToDateKey(entry.day, windowDays);
  let openedSameDay = false;
  let openedInWindow = false;
  let approvedSameDay = false;
  let approvedInWindow = false;
  for (const o of list) {
    if (o.at < entry.at) continue; // הזמנה שנוצרה לפני הרישום
    if (o.day > lastDay) continue;
    if (!o.hasItem && !o.confirmed) continue; // בלי פריט פעיל - לא הזמנה אמיתית
    openedInWindow = true;
    if (o.day === entry.day) openedSameDay = true;
    if (o.confirmed) {
      approvedInWindow = true;
      if (o.day === entry.day) approvedSameDay = true;
    }
  }
  return { openedSameDay, openedInWindow, approvedSameDay, approvedInWindow, openedNotApproved: openedInWindow && !approvedInWindow, matured: lastDay < todayKey };
}

function emptyDay(day) {
  return {
    day, visits: 0, availability: 0, formStart: 0, registered: 0, verified: 0,
    openedSameDay: 0, openedInWindow: 0, approvedSameDay: 0, approvedInWindow: 0,
    maturedRegistered: 0, openedInWindowMatured: 0, approvedInWindowMatured: 0,
  };
}

/**
 * @param {object} p
 * @param {string} p.from  YYYY-MM-DD (ישראל)
 * @param {string} p.to
 * @param {'public'|'kiosk'|'all'} [p.channel]
 * @param {number} [p.windowDays]
 * @param {Date}   [p.now]
 * @param {Array<{dayKey,type,channel,count}>} p.events  ספירות אנונימיות (visit / availability / form_start)
 * @param {Array<{customerId,dayKey,at,channel,outcome}>} p.registrations  אירועי register
 * @param {Map<string,{isDeleted:boolean,state:string|null}>} p.customers
 * @param {Array<{customerId,orderDate,confirmed:boolean,hasItem:boolean}>} p.orders
 */
export function buildAnalytics({ from, to, channel = 'public', windowDays = DEFAULT_WINDOW_DAYS, now = new Date(), events = [], registrations = [], customers = new Map(), orders = [] }) {
  const days = enumerateDays(from, to);
  const todayKey = dayOf(now);
  const topMeasured = channel === 'public';
  const daily = new Map(days.map((d) => [d, emptyDay(d)]));

  // --- שלבי הפתיחה (אנונימיים, קישור כללי בלבד)
  for (const e of events || []) {
    const row = daily.get(e.dayKey);
    if (!row || e.channel !== 'public') continue;
    const n = Number(e.count) || 0;
    if (e.type === 'visit') row.visits += n;
    else if (e.type === 'availability') row.availability += n;
    else if (e.type === 'form_start') row.formStart += n;
  }

  // --- רישומים
  const { byDay, droppedDeleted } = buildRegistrationEntries({ registrations, customers, channel, days });
  const ordersByCustomer = indexOrders(orders);
  const evalOpts = { windowDays, todayKey };
  const firstInRange = new Map(); // customerId -> הרישום המוקדם בטווח
  let registeredDaySum = 0;
  for (const d of days) {
    const row = daily.get(d);
    for (const entry of byDay.get(d)) {
      const ev = evaluateEntry(entry, ordersByCustomer, evalOpts);
      const c = customers.get(entry.customerId);
      row.registered++;
      registeredDaySum++;
      if (c && c.state === 'verified') row.verified++;
      if (ev.openedSameDay) row.openedSameDay++;
      if (ev.openedInWindow) row.openedInWindow++;
      if (ev.approvedSameDay) row.approvedSameDay++;
      if (ev.approvedInWindow) row.approvedInWindow++;
      if (ev.matured) {
        row.maturedRegistered++;
        if (ev.openedInWindow) row.openedInWindowMatured++;
        if (ev.approvedInWindow) row.approvedInWindowMatured++;
      }
      if (!firstInRange.has(entry.customerId)) firstInRange.set(entry.customerId, { entry, ev });
    }
  }

  // --- סיכומי הטווח (לקוחות שונות)
  const totals = {
    visits: 0, availability: 0, formStart: 0,
    registered: firstInRange.size, registeredDaySum,
    verified: 0, openedSameDay: 0, openedInWindow: 0, approvedSameDay: 0, approvedInWindow: 0,
    maturedRegistered: 0, openedInWindowMatured: 0, approvedInWindowMatured: 0, openedNotApproved: 0, windowStillOpen: 0,
    droppedDeleted,
  };
  for (const row of daily.values()) { totals.visits += row.visits; totals.availability += row.availability; totals.formStart += row.formStart; }
  // חלוקה לפי ערוץ - בלי קשר לסינון הערוץ: לקוחות שונות עם לפחות רישום אחד בערוץ בטווח (לקוחה שנרשמה בשני הערוצים נספרת בשניהם)
  const byChannelSets = { public: new Set(), kiosk: new Set() };
  const rangeSet = new Set(days);
  for (const r of registrations || []) {
    const c = r && customers.get(r.customerId);
    if (c && !c.isDeleted && rangeSet.has(r.dayKey) && byChannelSets[r.channel]) byChannelSets[r.channel].add(r.customerId);
  }
  for (const { entry, ev } of firstInRange.values()) {
    const c = customers.get(entry.customerId);
    if (c && c.state === 'verified') totals.verified++;
    if (ev.openedSameDay) totals.openedSameDay++;
    if (ev.openedInWindow) totals.openedInWindow++;
    if (ev.approvedSameDay) totals.approvedSameDay++;
    if (ev.approvedInWindow) totals.approvedInWindow++;
    if (ev.openedNotApproved) totals.openedNotApproved++;
    if (ev.matured) {
      totals.maturedRegistered++;
      if (ev.openedInWindow) totals.openedInWindowMatured++;
      if (ev.approvedInWindow) totals.approvedInWindowMatured++;
    } else totals.windowStillOpen++;
  }
  totals.registeredByChannel = { public: byChannelSets.public.size, kiosk: byChannelSets.kiosk.size };

  // --- משפך
  const counts = {
    visits: topMeasured ? totals.visits : null,
    availability: topMeasured ? totals.availability : null,
    formStart: topMeasured ? totals.formStart : null,
    registered: totals.registered,
    verified: totals.verified,
    opened: totals.openedInWindow,
    approved: totals.approvedInWindow,
  };
  const funnel = FUNNEL_STAGES.map((s) => {
    const count = counts[s.key];
    const parentCount = s.parent ? counts[s.parent] : null;
    return {
      key: s.key,
      label: s.label,
      parent: s.parent,
      count,
      rateFromParent: s.parent && count != null && parentCount != null ? ratio(count, parentCount) : null,
      rateFromVisits: s.key !== 'visits' && count != null && counts.visits != null ? ratio(count, counts.visits) : null,
    };
  });
  const rates = {
    visitToRegistered: topMeasured ? ratio(totals.registered, totals.visits) : null,
    formToRegistered: topMeasured ? ratio(totals.registered, totals.formStart) : null,
    registeredToVerified: ratio(totals.verified, totals.registered),
    // המדד העיקרי: מילאו פרטים -> נפתחה להן הזמנה. המחמיר (אושרה / שולמה) לצידו.
    registeredToOpened: ratio(totals.openedInWindow, totals.registered),
    registeredToOpenedMatured: ratio(totals.openedInWindowMatured, totals.maturedRegistered),
    registeredToOpenedSameDay: ratio(totals.openedSameDay, totals.registered),
    registeredToApproved: ratio(totals.approvedInWindow, totals.registered),
    registeredToApprovedMatured: ratio(totals.approvedInWindowMatured, totals.maturedRegistered),
    registeredToApprovedSameDay: ratio(totals.approvedSameDay, totals.registered),
    openedToApproved: ratio(totals.approvedInWindow, totals.openedInWindow),
    visitToOpened: topMeasured ? ratio(totals.openedInWindow, totals.visits) : null,
    visitToApproved: topMeasured ? ratio(totals.approvedInWindow, totals.visits) : null,
  };

  return {
    range: { from, to, days: days.length, channel, windowDays, today: todayKey },
    topMeasured,
    daily: days.map((d) => daily.get(d)),
    totals,
    funnel,
    rates,
  };
}

/** סיכום יום בודד מתוך daily (לכרטיסים): ערכים ושיעורי המרה של אותו יום. */
export function dayMetrics(row, topMeasured = true) {
  if (!row) return null;
  return {
    day: row.day,
    visits: topMeasured ? row.visits : null,
    registered: row.registered,
    opened: row.openedInWindow,
    approved: row.approvedInWindow,
    visitToRegistered: topMeasured ? ratio(row.registered, row.visits) : null,
    registeredToOpened: ratio(row.openedInWindow, row.registered),
    registeredToApproved: ratio(row.approvedInWindow, row.registered),
  };
}

/** ממוצע יומי / שיעור מצטבר של מערך ימים (לכרטיס "ממוצע שבועי"). שיעורים = סכום מונים חלקי סכום מכנים (לא ממוצע שיעורים). */
export function averageMetrics(rows, topMeasured = true) {
  const list = (rows || []).filter(Boolean);
  const n = list.length;
  if (!n) return null;
  const sum = (k) => list.reduce((a, r) => a + (r[k] || 0), 0);
  return {
    days: n,
    visits: topMeasured ? sum('visits') / n : null,
    registered: sum('registered') / n,
    opened: sum('openedInWindow') / n,
    approved: sum('approvedInWindow') / n,
    visitToRegistered: topMeasured ? ratio(sum('registered'), sum('visits')) : null,
    registeredToOpened: ratio(sum('openedInWindow'), sum('registered')),
    registeredToApproved: ratio(sum('approvedInWindow'), sum('registered')),
  };
}

/** כרטיסי הסיכום: היום מול אתמול מול ממוצע 7 הימים שלפני היום. daily = שורות יומיות של טווח שכולל את הימים האלה. */
export function buildCards({ daily, todayKey, topMeasured = true, avgDays = 7 }) {
  const byDay = new Map((daily || []).map((r) => [r.day, r]));
  const yesterdayKey = addDaysToDateKey(todayKey, -1);
  const prev = [];
  for (let i = 1; i <= avgDays; i++) prev.push(byDay.get(addDaysToDateKey(todayKey, -i)) || emptyDay(addDaysToDateKey(todayKey, -i)));
  return {
    today: dayMetrics(byDay.get(todayKey) || emptyDay(todayKey), topMeasured),
    yesterday: dayMetrics(byDay.get(yesterdayKey) || emptyDay(yesterdayKey), topMeasured),
    weekAvg: averageMetrics(prev, topMeasured),
  };
}
