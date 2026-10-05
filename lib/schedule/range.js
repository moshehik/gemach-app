// lib/schedule/range.js — סיכום מונים לכל יום בטווח (הלוח החודשי, /board): לכל יום ולכל שלב - כמה פריטים וכמה עם התראה.
//
// קריאה בלבד. אין כאן לוגיקה עסקית משלו: כל יום מחושב ע"י getScheduleDay (lib/schedule/index.js) - אותו קוד בדיוק
// שמציג את הלו״ז היומי - כדי שהמונה בתא של הלוח והמספר בציר של הלו״ז לאותו יום יהיו תמיד זהים (החלטות הבעלים
// 4.10.2026: S02 מונים לפי שלב בכל תא, S10 סימן התראה על משימות שלא בוצעו, S01 מסנן השלבים). ההגדרות נטענות פעם
// אחת לכל הטווח; "מי במשמרת" לא נטען (skipStaff); המשתמש לא מועבר (user=null): אין הערות פנימיות ואין "הכל בוצע",
// ממילא לא נשלחת אף שורה - רק מספרים.
// עלות: כמו פתיחת הלו״ז היומי לכל יום בטווח (עד MAX_RANGE_DAYS), במקביל של RANGE_CONCURRENCY ימים בכל פעם; התשובה נשמרת
// במטמון קצר בנתיב (lib/schedule/rangeCache.js).

import { getScheduleDay } from './index';
import { loadScheduleSettings } from './settings';
import { isValidKey, isWithinReasonableRange, addCalendarDays, daysBetween, todayKey } from './dates';

export const MAX_RANGE_DAYS = 31; // חודש עברי + יום (30 ימים לכל היותר)
export const RANGE_CONCURRENCY = 3; // ממצא הסקירה 2: 2-3 ימים במקביל (לא להעמיס על מאגר החיבורים)

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// מפתחות הימים מ-from עד to כולל. זורק 400 על טווח לא תקין / הפוך / ארוך מדי.
export function rangeKeys(from, to, today) {
  if (!isValidKey(from) || !isValidKey(to)) throw badRequest('תאריך לא תקין - נדרש YYYY-MM-DD');
  const span = daysBetween(from, to);
  if (span < 0) throw badRequest('טווח תאריכים הפוך');
  if (span + 1 > MAX_RANGE_DAYS) throw badRequest(`טווח ארוך מדי - עד ${MAX_RANGE_DAYS} ימים`);
  if (today && (!isWithinReasonableRange(from, today) || !isWithinReasonableRange(to, today))) {
    throw badRequest('התאריך מחוץ לטווח');
  }
  const keys = [];
  for (let k = from; k <= to; k = addCalendarDays(k, 1)) keys.push(k);
  return keys;
}

// יום אחד של getScheduleDay -> { s: { [stageKey]: { t, a } }, alerts, nonWorkingDay }; רק שלבים פעילים עם פריטים.
export function summarizeDay(day) {
  const s = {};
  let alerts = 0;
  for (const st of day.stages || []) {
    if (!st.enabled) continue;
    const t = st.counts ? st.counts.total : 0;
    const a = st.counts ? st.counts.alerts : 0;
    alerts += a;
    if (t > 0) s[st.key] = { t, a };
  }
  return { s, alerts, nonWorkingDay: !!day.nonWorkingDay };
}

async function runPool(items, limit, worker) {
  let i = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/**
 * @param {object} p
 * @param {string} p.from  YYYY-MM-DD (כולל)
 * @param {string} p.to    YYYY-MM-DD (כולל)
 * @param {string} [p.branch] סינון תצוגה לפי סניף, כמו בלו״ז היומי
 * @param {object} [p.settings] הגדרות פתורות (לבדיקות)
 * @param {Date}   [p.now]
 * @param {Function} [p.dayLoader] לבדיקות; ברירת מחדל getScheduleDay
 */
export async function getScheduleRangeSummary({ from, to, branch = '', settings, now = new Date(), dayLoader = getScheduleDay, concurrency = RANGE_CONCURRENCY } = {}) {
  const today = todayKey(now);
  const keys = rangeKeys(from, to, today);
  const resolved = settings || (await loadScheduleSettings());
  const days = {};
  let stages = null;
  let truncated = false;
  await runPool(keys, concurrency, async (key) => {
    const day = await dayLoader({ date: key, branch, user: null, settings: resolved, now, skipStaff: true });
    days[key] = summarizeDay(day);
    if (day.truncated) truncated = true;
    if (!stages && Array.isArray(day.stages)) {
      stages = day.stages.map((st) => ({ key: st.key, number: st.number, label: st.label, plural: st.plural, enabled: !!st.enabled, infoOnly: !!st.infoOnly }));
    }
  });
  return { from, to, today, stages: stages || [], days, truncated };
}
