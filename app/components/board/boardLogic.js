// הלוגיקה הטהורה של הלוח החודשי (/board) - בלי React, בלי DOM, בלי רשת. נבדקת ב-scripts/test_board_page.mjs.
// כל הכללים כאן הועתקו מהדף הקודם (app/board/page.js עד 4.10.2026) כמו שהם: חישוב החודש העברי וניווט חודשים
// (changeMonth), קבוצות ההזמנות לפי תאריך האירוע, איחור החזרה (יותר מ-2 ימים
// אחרי האירוע עם פריט שנלקח ולא הוחזר), פרשת השבוע והחגים בתא, 
// מה שנוסף לפי החלטות הבעלים (4.10.2026): רשימת 13 החודשים לקפיצה (S07), טקסט המונה לכל שלב (S02), איחוד סיבות
// סימן ההתראה (S10 + E12, JDG-5), ומפתחות הטווח של בקשת המונים.
// ייבוא יחסי עם סיומת .js - כדי שהקובץ ייטען גם ב-node בבדיקה (כמו homeLogic.js).

import { HDate, Sedra, Locale, HebrewCalendar } from '@hebcal/core';
import { getHebrewMonthYear, getHebrewDateString } from '../../../lib/hebrewDate.js';
import { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } from '../../../lib/lateReturn.js';

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const pad = (n) => (n < 10 ? '0' : '') + n;
// מפתח היום המקומי YYYY-MM-DD - אותו מפתח שהדף הקודם השתמש בו (toLocaleDateString('en-CA'))
export const localKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function safeHDate(date) {
  try { return new HDate(date); } catch { return new HDate(new Date()); }
}

// ניווט חודש קודם/הבא - בדיוק changeMonth של הדף הקודם (יום 15 בחודש ± 30 ימים, ואז היום הראשון של החודש העברי)
export function shiftMonth(date, delta) {
  try {
    const h = safeHDate(date);
    const mid = new HDate(15, h.getMonth(), h.getFullYear());
    const target = new HDate(mid.abs() + 30 * delta);
    return new HDate(1, target.getMonth(), target.getFullYear()).greg();
  } catch {
    const d = new Date(date);
    d.setMonth(d.getMonth() + delta);
    return d;
  }
}

// היום הראשון (לועזי, חצות מקומית) של החודש העברי שהתאריך שייך אליו
export function monthStartDate(date) {
  const h = safeHDate(date);
  return new HDate(1, h.getMonth(), h.getFullYear()).greg();
}

export const sameMonth = (a, b) => {
  const x = safeHDate(a);
  const y = safeHDate(b);
  return x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear();
};

export const monthTitle = (date) => getHebrewMonthYear(date);

// S07: 13 חודשים סביב החודש המוצג (6 לפני, הוא, 6 אחרי) - כמו jumpList בעיצוב. window = הזזה בקפיצות של 13.
export function jumpMonths(date, windowShift = 0) {
  let cur = monthStartDate(date);
  cur = shiftMonth(cur, windowShift * 13 - 6);
  const out = [];
  for (let i = 0; i < 13; i++) {
    out.push({ date: cur, key: localKey(cur), title: monthTitle(cur) });
    cur = shiftMonth(cur, 1);
  }
  return out;
}

// טווח מפתחות החודש העברי המוצג (מהיום הראשון עד האחרון) - לבקשת המונים /api/board/stages
export function monthRangeKeys(date) {
  const h = safeHDate(date);
  const first = new HDate(1, h.getMonth(), h.getFullYear());
  const last = new HDate(h.daysInMonth(), h.getMonth(), h.getFullYear());
  return { from: localKey(first.greg()), to: localKey(last.greg()) };
}

// פרשת השבוע (שבת בלבד) והחגים של היום - אותו סינון בדיוק כמו בדף הקודם (בלי חגים מודרניים, "בנות", "מעשר בהמה",
// "סליחות"; רק הדגלים 1/256/16384/524288/2097152). E10: מוצגים כטקסט פשוט, בלי תגית.
export function dayCalendarNotes(hdate, isShabbat) {
  const out = [];
  if (isShabbat) {
    try {
      const s = new Sedra(hdate.getFullYear(), true);
      const p = s.lookup(hdate);
      if (p && p.parsha && p.parsha.length > 0) out.push(p.parsha.map((name) => Locale.gettext(name, 'he')).join('-'));
    } catch { /* בלי פרשה */ }
  }
  try {
    const evs = HebrewCalendar.getHolidaysOnDate(hdate, true) || [];
    evs.filter((e) => {
      const fl = e.getFlags();
      const name = e.render('he');
      if (fl & 8192) return false;
      if (name.includes('בנות') || name.includes('מעשר בהמה') || name.includes('סליחות')) return false;
      return (fl & 1) || (fl & 524288) || (fl & 2097152) || (fl & 16384) || (fl & 256);
    }).forEach((e) => out.push(e.render('he')));
  } catch { /* בלי חגים */ }
  return out;
}

// גריד החודש העברי: שבועות של 7 תאים; null = תא ריק לפני/אחרי החודש (S08 "לא להכניס": בלי ימי חודש סמוך)
export function buildMonthGrid(date, today = new Date()) {
  const h = safeHDate(date);
  const hYear = h.getFullYear();
  const hMonth = h.getMonth();
  const first = new HDate(1, hMonth, hYear);
  const days = h.daysInMonth();
  const todayStr = today.toDateString();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let day = 1; day <= days; day++) {
    const hd = new HDate(day, hMonth, hYear);
    const greg = hd.greg();
    const weekday = greg.getDay();
    let letter = String(day);
    try { letter = hd.renderGematriya().split(' ')[0]; } catch { /* מספר */ }
    cells.push({
      day,
      key: localKey(greg),
      greg,
      weekday,
      letter,
      monthName: day === 1 ? monthTitle(greg).split(' ').slice(0, -1).join(' ') : '',
      isToday: greg.toDateString() === todayStr,
      isShabbat: weekday === 6,
      notes: dayCalendarNotes(hd, weekday === 6),
      hebrewLong: 'יום ' + WEEKDAYS[weekday] + ' · ' + getHebrewDateString(greg),
    });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ההזמנות לפי תאריך האירוע (מפתח יום מקומי) - כמו ordersByDate בדף הקודם
export function groupOrdersByDate(orders) {
  const grouped = {};
  (orders || []).forEach((order) => {
    if (!order.eventDate) return;
    const k = localKey(new Date(order.eventDate));
    (grouped[k] ||= []).push(order);
  });
  return grouped;
}

export const validItems = (order) => (order.items ? order.items.filter((i) => !i.isDeleted) : []);

// (קטגוריית הסטטוס של הזמנה - getOrderCategory של הדף הקודם, CATEGORY ו-categoryOrder - הוסרה ב-BD-O7: הבעלים לא רוצה
// תגית סטטוס ולא ציר סינון לפי סטטוס. הקוד בהיסטוריית git, commit 620780b7.)

// E12: איחור החזרה - אותו כלל כמו הלו״ז (שלב 8 "החזרה ידנית", התראת "באיחור"), /api/orders/overdue ובר ההחזרה המהיר:
// יש פריט שנלקח ולא הוחזר (הדגל או התאריך, כמו loaders.js), ועברו late_return_threshold_days (ברירת מחדל 7) ימים ממועד
// ההחזרה הצפוי - toDate/returnDate או יום העבודה הראשון אחרי האירוע, לפי הכלל האחיד של ימי עסקים (lib/lateReturn.js).
// (עד 4.10.2026 הלוח השתמש ב"יותר מ-2 ימים מהאירוע" קבוע - ממצא הסקירה 6: הסימן בלוח והמונה בלו״ז לא תאמו.)
// cfg = { threshold, nonWorkingDays, now } - מההגדרות (late_return_threshold_days, non_working_days_extra).
const itemTaken = (i) => !!(i && (i.isTaken || i.takenDate));
const itemReturned = (i) => !!(i && (i.isReturned || i.returnDate));
export function isOrderLate(order, cfg = {}) {
  const v = validItems(order);
  if (!v.length || !v.some((i) => itemTaken(i) && !itemReturned(i))) return false;
  const threshold = Number(cfg.threshold) > 0 ? Number(cfg.threshold) : LATE_RETURN_THRESHOLD_DAYS;
  return !!getLateReturnInfo(order, threshold, { now: cfg.now || new Date(), nonWorkingDays: cfg.nonWorkingDays ?? null }).isLate;
}

// S02: הטקסט של מונה שלב בתא ("2 הכנות" / "הכנה אחת") - chipTxt בעיצוב; plural מהשרת
export function stageCountText(stage, n) {
  if (n === 1) return (stage.label || '') + ' אחת';
  return n + ' ' + (stage.plural || stage.label || '');
}

// S10 + E12 (JDG-5 "כן, לאחד"): סימן התראה אחד בכותרת התא עם שתי סיבות - התראות הלו״ז (באיחור / חסרה כתובת) והזמנות
// באיחור החזרה. מחזיר null כשאין סיבה.
export function cellAlert(stageAlerts, lateCount) {
  const parts = [];
  if (stageAlerts > 0) parts.push(stageAlerts === 1 ? 'התראה אחת בלו״ז' : stageAlerts + ' התראות בלו״ז');
  if (lateCount > 0) parts.push(lateCount === 1 ? 'הזמנה אחת באיחור החזרה' : lateCount + ' הזמנות באיחור החזרה');
  if (!parts.length) return null;
  return { count: stageAlerts + lateCount, tip: parts.join(' · ') };
}

// מוני השלבים של יום אחד לפי המסנן (S01): רשימה מסודרת לפי סדר השלבים, רק שלבים עם פריטים
export function dayStageRows(day, stages, selected) {
  if (!day || !day.s) return [];
  const sel = selected && selected.length ? new Set(selected) : null;
  return stages
    .filter((st) => st.enabled && day.s[st.key] && day.s[st.key].t > 0 && (!sel || sel.has(st.key)))
    .map((st) => ({ stage: st, total: day.s[st.key].t, alerts: day.s[st.key].a || 0 }));
}

// סה"כ לכל שלב בחודש (המספר ליד כל אפשרות במסנן, hf-oc)
export function monthStageTotals(days, stages) {
  const out = {};
  for (const st of stages) out[st.key] = 0;
  for (const d of Object.values(days || {})) for (const [k, v] of Object.entries(d.s || {})) out[k] = (out[k] || 0) + (v.t || 0);
  return out;
}
