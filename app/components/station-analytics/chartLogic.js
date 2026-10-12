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

/* ===================== כיוון B ("זרימה"): חישובי גיאומטריה טהורים ===================== */

/** עקומה חלקה מונוטונית (Fritsch-Carlson) דרך נקודות עם x עולה. מחזירה מחרוזת path ('' כשיש פחות משתי נקודות). */
export function splinePath(pts) {
  const n = pts.length;
  if (n < 2) return '';
  const dx = [];
  const m = [];
  const t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / dx[i]; }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const w = dx[i];
    d += ` C${pts[i].x + w / 3},${pts[i].y + (t[i] * w) / 3} ${pts[i + 1].x - w / 3},${pts[i + 1].y - (t[i + 1] * w) / 3} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/** מפרק מערך נקודות עם חורים (null) לקטעים רצופים. */
export function splitSegments(pts) {
  const out = [];
  let cur = [];
  for (const p of pts) { if (p) cur.push(p); else { if (cur.length) out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  return out;
}

/** צבע סרט המשפך לפי קבוצת השלב: כניסות (תכלת), רישום (כחול), הזמנות (זהב). */
export const STAGE_COLOR_VARS = Object.freeze({
  visits: '--sa-c-top', availability: '--sa-c-top', formStart: '--sa-c-top', registered: '--sa-c-mid', verified: '--sa-c-mid', opened: '--sa-c-open', approved: '--sa-c-appr',
});

/**
 * גיאומטריית משפך "סרט" ממורכז. stages = השלבים הנמדדים בלבד [{key, count, parent, rateFromParent}] (count מספר).
 * רוחב הסרט ליניארי בין 17% ל-100% מהרוחב המרבי (המספרים והאחוזים מדויקים; הרוחב רק מקרב כך ששלב קטן נשאר קריא).
 * @returns {{height:number, bands:Array<{key,count,x,y,w,half}>, joints:Array<{from:number,to:number,y1:number,y2:number,tag:string|null}>, cx:number}}
 */
export function funnelGeometry(stages, { width, labelWidth, rowH = 46, gap = 28, parentLabels = {} }) {
  const ribW = Math.max(60, width - labelWidth - 8);
  const cx = ribW / 2;
  const maxHalf = ribW * 0.47;
  const top = Math.max(1, ...stages.map((s) => s.count));
  const bands = stages.map((s, i) => {
    const half = maxHalf * (0.17 + 0.83 * (s.count / top));
    const y = 4 + i * (rowH + gap);
    return { key: s.key, count: s.count, half, x: cx - half, y, w: half * 2 };
  });
  const joints = [];
  for (let i = 1; i < stages.length; i++) {
    const s = stages[i];
    const prevKey = stages[i - 1].key;
    let tag = null;
    if (typeof s.rateFromParent === 'number') {
      const adjacent = s.parent === prevKey;
      tag = `${fmtPct(s.rateFromParent)}${adjacent || !s.parent || !parentLabels[s.parent] ? '' : ` מ${parentLabels[s.parent]}`}`;
    }
    joints.push({ from: i - 1, to: i, y1: bands[i - 1].y + rowH, y2: bands[i].y, tag });
  }
  return { height: stages.length ? 4 + stages.length * rowH + (stages.length - 1) * gap + 4 : 0, bands, joints, cx, ribW };
}

/** מד חצי עיגול: אורך קשת וקיזוז מילוי לשבר 0..1 (נחתך לטווח). */
export function gaugeDash(radius, fraction) {
  const len = Math.PI * radius;
  const f = typeof fraction === 'number' && isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return { length: len, offset: len * (1 - f) };
}

/** שורות פסי ההשוואה באריח: היום / אתמול / ממוצע, כשהרוחב יחסי לגדול שבהם (null מדולג). */
export function compareRows(today, yesterday, weekAvg) {
  const vals = [today, yesterday, weekAvg].filter((v) => typeof v === 'number' && isFinite(v));
  const mx = Math.max(1e-9, ...vals);
  const row = (key, label, v) => (typeof v === 'number' && isFinite(v) ? { key, label, value: v, pct: (v / mx) * 100 } : { key, label, value: null, pct: 0 });
  return [row('today', 'היום', today), row('yesterday', 'אתמול', yesterday), row('avg', 'ממוצע שבועי', weekAvg)];
}
