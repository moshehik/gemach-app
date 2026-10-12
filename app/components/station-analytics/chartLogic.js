// chartLogic.js - עזרים טהורים (בלי React / DOM) למסך "המרות בעמדה": עיצוב מספרים ואחוזים, שינוי מול תקופת השוואה, צירי גרף, וטווחי תאריכים מוכנים.
// נבדק ב-scripts/station-analytics-tests/chart.test.mjs.
import { addDaysToDateKey } from '@/lib/hebrewDate';

const NUM = typeof Intl !== 'undefined' ? new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }) : null;
const NUM1 = typeof Intl !== 'undefined' ? new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : null;

/** מספר שלם עם מפריד אלפים; null / לא-מספר -> "—". */
export function fmtInt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return NUM ? NUM.format(Math.round(n)) : String(Math.round(n));
}

/** ממוצע: שלם כשהוא שלם, אחרת ספרה אחת אחרי הנקודה. */
export function fmtAvg(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  if (Math.abs(n - Math.round(n)) < 1e-9) return fmtInt(n);
  return NUM1 ? NUM1.format(n) : n.toFixed(1);
}

/** שבר -> אחוז. מתחת ל-10% ספרה אחת אחרי הנקודה; null -> "—" (אין מכנה - לא מציגים 0% מטעה). */
export function fmtPct(r) {
  if (typeof r !== 'number' || !isFinite(r)) return '—';
  const p = r * 100;
  const s = p < 10 && p > 0 ? (NUM1 ? NUM1.format(p) : p.toFixed(1)) : fmtInt(p);
  return `${s}%`;
}

/**
 * שינוי מול ערך השוואה. kind 'count' (הפרש מוחלט) | 'rate' (הפרש בנקודות אחוז). null כשאין מה להשוות.
 * @returns {{dir:'up'|'down'|'same', text:string}|null}
 */
export function deltaInfo(cur, prev, kind = 'count') {
  if (typeof cur !== 'number' || typeof prev !== 'number' || !isFinite(cur) || !isFinite(prev)) return null;
  if (kind === 'rate') {
    const pts = (cur - prev) * 100;
    if (Math.abs(pts) < 0.05) return { dir: 'same', text: 'ללא שינוי' };
    const abs = Math.abs(pts);
    const body = abs < 10 ? (NUM1 ? NUM1.format(abs) : abs.toFixed(1)) : fmtInt(abs);
    return { dir: pts > 0 ? 'up' : 'down', text: `${body} נק׳ אחוז` };
  }
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return { dir: 'same', text: 'ללא שינוי' };
  return { dir: d > 0 ? 'up' : 'down', text: fmtAvg(Math.abs(d)) };
}

/** צירי גרף: מקסימום "יפה" וסימוני ציר. תמיד לפחות 1; ערכים שלמים בלבד כשהמקסימום קטן (ספירות). */
export function niceScale(maxValue, wantTicks = 4) {
  const max = typeof maxValue === 'number' && isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  if (max <= wantTicks) {
    const m = Math.max(1, Math.ceil(max));
    return { max: m, ticks: Array.from({ length: m + 1 }, (_, i) => i) };
  }
  // הצעד הקטן מבין 1 / 2 / 5 כפול חזקת 10 שנותן לכל היותר wantTicks + 1 מרווחים
  const e0 = Math.floor(Math.log10(max));
  let step = Math.pow(10, e0 + 1);
  outer: for (let e = e0 - 2; e <= e0 + 1; e++) {
    for (const m of [1, 2, 5]) {
      const cand = m * Math.pow(10, e);
      if (Math.ceil(max / cand - 1e-9) <= wantTicks + 1) { step = cand; break outer; }
    }
  }
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max: top, ticks };
}

/** טווחי תאריכים מוכנים (ימי לוח בישראל, כולל היום). */
export function presetRange(preset, todayKey) {
  if (preset === 'today') return { from: todayKey, to: todayKey };
  if (preset === '7') return { from: addDaysToDateKey(todayKey, -6), to: todayKey };
  if (preset === '30') return { from: addDaysToDateKey(todayKey, -29), to: todayKey };
  if (preset === '90') return { from: addDaysToDateKey(todayKey, -89), to: todayKey };
  return null;
}

/** אילו תוויות ציר X להציג (כל כמה ימים) כך שלא יתנגשו: מבוסס על רוחב זמין. */
export function labelStride(count, widthPx, minLabelPx = 56) {
  if (count <= 0) return 1;
  const fit = Math.max(1, Math.floor(widthPx / minLabelPx));
  return Math.max(1, Math.ceil(count / fit));
}

/**
 * סידור העמודות בגרף הימי. הציר מהימין לשמאל (היום הראשון בטווח מימין, כמו כיוון הקריאה בעברית).
 * @returns {Array<{index:number, x:number, band:number}>} x = שמאל הקבוצה במערכת הצירים של ה-SVG; band = רוחב הפס של היום
 */
export function dayBands(count, plotLeft, plotWidth) {
  if (count <= 0) return [];
  const band = plotWidth / count;
  return Array.from({ length: count }, (_, i) => ({ index: i, x: plotLeft + plotWidth - (i + 1) * band, band }));
}

/** טקסט נגיש קצר לקבוצת עמודות של יום: "יום ב׳ ט׳ תשרי: מילאו פרטים 3, סגרו הזמנה 1". */
export function bandAriaLabel(dayLabel, parts) {
  return `${dayLabel}: ${parts.map((p) => `${p.label} ${fmtInt(p.value)}`).join(', ')}`;
}
