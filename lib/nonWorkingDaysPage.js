// lib/nonWorkingDaysPage.js - הלוגיקה הטהורה של הדף "ימי אי-פעילות" (/non-working-days).
//
// עיצוב מאושר: תצוגות-עיצוב/סיימתי-לעבוד/ימי-אי-פעילות.html; תשובות הבעלים 1.10.2026 (15/15, החלטות-non-working-days.json)
// והפירושים שלהן: scratch/schedule-build/DECISIONS-ימי-אי-פעילות.md ("החלטות שפורשו" 1-9). הכלל עצמו ("מה יום סגור")
// לא מחושב כאן - הכול דרך lib/businessDays.js (dayStatus / parseNonWorkingDaysSetting), אותו כלל כמו בשאר המערכת.
//
// מודול טהור: בלי React, בלי fetch, בלי prisma. רץ בדפדפן (NonWorkingDaysPage.js), בשרת (app/api/non-working-days) ובבדיקות
// (scripts/test_non_working_days_page.mjs). כל התאריכים הם מפתחות 'YYYY-MM-DD' של היום הישראלי, והחשבון על המפתח (UTC) -
// בלי תלות באזור הזמן של המכונה. בממשק מוצגים תאריכים עבריים בלבד.
//
// המודל שהדף עורך ("טיוטה", החלטה NWD-04): { marks: Map<key, note>, fixed: [{ id, month, day, note }] }.
//   marks = כל יום שהבעלים סגר ידנית (ימים בודדים + ימי הטווחים מההגדרה, פרושים ליום-יום); fixed = תאריכים עבריים קבועים.
//   "שמור" שולח את המסמך כולו (modelToDocument) ל-POST /api/settings, המפתח non_working_days_extra (גרסה 2). רצף ימים
//   צמודים עם אותה הערה נשמר כטווח (ranges), יום בודד כ-days - אותה משמעות בדיוק בכלל (parseNonWorkingDaysSetting).

import {
  parseNonWorkingDaysSetting, dayStatus, hebrewDateOfKey, isValidDayKey, HEBREW_MONTH_OPTIONS,
  NON_WORKING_DAYS_SETTING_VERSION, MAX_RANGE_DAYS,
} from './businessDays';
import { addDaysToDateKey } from './hebrewDate';

export const NOTE_MAX = 40; // כמו בעיצוב (maxlength=40); הכלל עצמו מקבל עד 200
export const MAX_SELECTION_DAYS = 120; // בחירת טווח בלוח - יותר מזה אין משמעות לסימון ידני
export const NEXT_OCCURRENCE_SPAN = 420; // חיפוש המופע הקרוב של תאריך עברי קבוע (שנה עברית מעוברת = עד 385 יום)
export const ACTIVITY_MAX_DAYS = 120; // טווח מרבי לשאילתת "פעילות רשומה" (GET /api/non-working-days/activity)

// ---------- תאריכים ----------

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const addDays = (key, n) => addDaysToDateKey(key, n);
export const weekdayOf = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const WEEKDAYS = Object.freeze(['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']);
export const WEEKDAYS_SHORT = Object.freeze(['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']);

const GEMATRIA = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];
/** 26 -> כ״ו, 15 -> ט״ו, 5787 % 1000 -> תשפ״ז */
export function gematria(num) {
  let n = Math.trunc(Number(num)) || 0;
  let s = '';
  while (n > 0) {
    for (const [v, ch] of GEMATRIA) { if (n >= v) { s += ch; n -= v; break; } }
  }
  s = s.replace('יה', 'טו').replace('יו', 'טז');
  if (!s) return '';
  return s.length > 1 ? s.slice(0, -1) + '״' + s.slice(-1) : s + '׳';
}

const MONTH_HE = Object.fromEntries(HEBREW_MONTH_OPTIONS.map((o) => [o.value, o.label]));
MONTH_HE.Adar = 'אדר';
MONTH_HE['Adar I'] = 'אדר א׳';
MONTH_HE['Adar II'] = 'אדר ב׳';
export const monthLabel = (name) => MONTH_HE[name] || String(name || '');

const hebCache = new Map();
/** { d, dl, m, y, wd, w, month, monthNumber, year, leap } לתצוגה. null לקלט לא תקין. */
export function heb(key) {
  if (!isValidDayKey(key)) return null;
  let r = hebCache.get(key);
  if (r) return r;
  const h = hebrewDateOfKey(key);
  if (!h) return null;
  const w = weekdayOf(key);
  r = { d: h.day, dl: gematria(h.day), m: monthLabel(h.month), y: gematria(h.year % 1000), wd: WEEKDAYS[w], w, month: h.month, monthNumber: h.monthNumber, year: h.year, leap: h.leap };
  if (hebCache.size > 4000) hebCache.clear();
  hebCache.set(key, r);
  return r;
}
/** "יום שלישי · כ״ג תשרי תשפ״ז" */
export const hLong = (key) => { const h = heb(key); return h ? `יום ${h.wd} · ${h.dl} ${h.m} ${h.y}` : ''; };
/** "כ״ג תשרי תשפ״ז" */
export const hDate = (key) => { const h = heb(key); return h ? `${h.dl} ${h.m} ${h.y}` : ''; };
/** "כ״ג תשרי" */
export const hShort = (key) => { const h = heb(key); return h ? `${h.dl} ${h.m}` : ''; };
/** כותרת החודש העברי של היום הראשון: "תשרי תשפ״ז" */
export const hMonthTitle = (start) => { const h = heb(start); return h ? `${h.m} ${h.y}` : ''; };

export const monthStartOf = (key) => { const h = heb(key); return h ? addDays(key, -(h.d - 1)) : null; };
export const monthLength = (start) => (heb(addDays(start, 29)).d === 1 ? 29 : 30);
export const nextMonthStart = (start) => addDays(start, monthLength(start));
export const prevMonthStart = (start) => monthStartOf(addDays(start, -1));

/** תאי הלוח לחודש עברי (ראשון-שבת, כולל ימי החודש הקודם/הבא שממלאים את השבוע): [{ key, inMonth }] */
export function monthGrid(start) {
  const len = monthLength(start);
  const first = weekdayOf(start);
  const out = [];
  for (let i = first; i > 0; i--) out.push({ key: addDays(start, -i), inMonth: false });
  for (let i = 0; i < len; i++) out.push({ key: addDays(start, i), inMonth: true });
  const last = addDays(start, len - 1);
  for (let i = 1; i <= 6 - weekdayOf(last); i++) out.push({ key: addDays(last, i), inMonth: false });
  return out;
}

/** כל המפתחות מ-a עד b כולל (בכל סדר), עד MAX_SELECTION_DAYS. */
export function keysBetween(a, b, max = MAX_SELECTION_DAYS) {
  if (!isValidDayKey(a) || !isValidDayKey(b)) return [];
  let lo = a < b ? a : b;
  const hi = a < b ? b : a;
  const out = [];
  for (let i = 0; i < max && lo <= hi; i++) { out.push(lo); lo = addDays(lo, 1); }
  return out;
}

// ---------- למה יום סגור ----------

/**
 * שם החג לתצוגה, מהכותרת של hebcal (render('he'), בלי ניקוד): "סכות ב׳ (חוה״מ)" -> "סוכות", "ראש השנה 5787" -> "ראש השנה",
 * "פסח ז׳" -> "שביעי של פסח", "יום כפור" -> "יום כיפור", "סכות ז׳ (הושענא רבה)" -> "הושענא רבה" (כמו בעיצוב).
 */
export function holidayName(raw) {
  let t = String(raw || '').replace(/\s*\d{3,}\s*$/, '').trim();
  if (/הושענא רבה/.test(t)) return 'הושענא רבה';
  if (/^פסח ז/.test(t)) return 'שביעי של פסח';
  t = t.replace(/\s*\(חוה[״"]מ\)/g, '').replace(/\s+[א-ת]{1,2}[׳']$/, '').trim();
  t = t.replace(/^סכות/, 'סוכות').replace(/^יום כפור/, 'יום כיפור');
  return t;
}

/**
 * סגירה אוטומטית (ברירת המחדל של הכלל, בלי רשימת הבעלים): { k, txt } או null.
 * k: 'chag' | 'erev' | 'hol' | 'sat' | 'fri' (סדר העדיפות של העיצוב: חג > ערב חג > חול המועד > שבת > שישי).
 */
export function autoReason(key) {
  const st = dayStatus(key, null);
  if (!st || st.working) return null;
  const r = st.reasons;
  const erevTitle = (st.titles.find((t) => t.startsWith('ערב ')) || '').slice(4);
  const ownTitle = st.titles.find((t) => !t.startsWith('ערב ')) || '';
  if (r.includes('chag')) return { k: 'chag', txt: 'חג: ' + holidayName(ownTitle) };
  if (r.includes('erev_chag')) {
    const own = holidayName(ownTitle);
    return { k: 'erev', txt: 'ערב חג: ' + holidayName(erevTitle) + (own === 'הושענא רבה' ? ' (הושענא רבה)' : '') };
  }
  if (r.includes('chol_hamoed')) return { k: 'hol', txt: 'חול המועד: ' + holidayName(ownTitle) };
  if (r.includes('shabbat')) return { k: 'sat', txt: 'שבת' };
  if (r.includes('friday')) return { k: 'fri', txt: 'שישי' };
  return null;
}

/** "כ״ו בשבט" - תאריך עברי קבוע ברשימה ובלוח */
export const fixedLabel = (f) => `${gematria(f.day)} ב${monthLabel(f.month)}`;

// קונפיג של התאריכים הקבועים בלבד (מטמון לפי החתימה), כדי לשאול את הכלל "האם המפתח נופל על אחד מהם"
const fixedCfgCache = new Map();
function fixedConfig(fixed) {
  const list = (fixed || []).map((f) => ({ month: f.month, day: f.day }));
  const sig = JSON.stringify(list);
  let cfg = fixedCfgCache.get(sig);
  if (!cfg) {
    cfg = parseNonWorkingDaysSetting({ version: NON_WORKING_DAYS_SETTING_VERSION, days: [], recurringHebrew: list });
    if (fixedCfgCache.size > 64) fixedCfgCache.clear();
    fixedCfgCache.set(sig, cfg);
  }
  return cfg;
}

/** התאריך הקבוע (מהרשימה) שנופל על המפתח, לפי כלל אדר / יום 30 של lib/businessDays.js - או null. */
export function fixedOn(fixed, key) {
  if (!fixed || !fixed.length) return null;
  const st = dayStatus(key, fixedConfig(fixed), { skipWeekend: false, skipHolidays: false });
  if (!st || !st.recurring) return null;
  return fixed.find((f) => f.month === st.recurring.month && f.day === st.recurring.day) || null;
}

/** סגור אוטומטית, או סגור בתאריך עברי קבוע (של הטיוטה): { k, txt, f? } או null */
export function closedReason(key, fixed) {
  const a = autoReason(key);
  if (a) return a;
  const f = fixedOn(fixed, key);
  return f ? { k: 'fx', txt: 'כל שנה: ' + fixedLabel(f), f } : null;
}

/** המופע הקרוב (מ-today והלאה) של תאריך עברי קבוע, או null. */
export function nextOccurrence(f, today) {
  if (!f || !isValidDayKey(today)) return null;
  let d = today;
  for (let i = 0; i < NEXT_OCCURRENCE_SPAN; i++) {
    if (fixedOn([f], d)) return d;
    d = addDays(d, 1);
  }
  return null;
}

// ---------- המודל (טיוטה) ----------

let uid = 0;
const newId = () => 'f' + (++uid);

/** value של ההגדרה (מחרוזת / אובייקט / קונפיג) -> מודל לעריכה. ימי טווח נפרשים ליום-יום (הערת יום בודד גוברת). */
export function modelFromSetting(raw) {
  const cfg = parseNonWorkingDaysSetting(raw ?? null);
  const marks = new Map();
  for (const key of [...cfg.closed].sort()) marks.set(key, cfg.notes.get(key) || '');
  const fixed = (cfg.recurringHebrew || []).map((r) => ({ id: newId(), month: r.month, day: r.day, note: r.note || '' }));
  return { marks, fixed, invalid: cfg.invalid, ignoredOpen: cfg.ignoredOpen };
}

export function cloneModel(m) {
  return { marks: new Map(m.marks), fixed: m.fixed.map((f) => ({ ...f })), invalid: m.invalid || 0, ignoredOpen: m.ignoredOpen || 0 };
}

const normNote = (s) => (typeof s === 'string' ? s.trim().slice(0, NOTE_MAX) : '');

/**
 * מודל -> המסמך הקנוני לשמירה (גרסה 2). רצף ימים צמודים (2+) עם אותה הערה -> טווח אחד (עד MAX_RANGE_DAYS);
 * יום בודד -> days. התאריכים הקבועים לפי הסדר שבמודל.
 */
export function modelToDocument(m) {
  const keys = [...m.marks.keys()].filter(isValidDayKey).sort();
  const days = [];
  const ranges = [];
  let i = 0;
  while (i < keys.length) {
    const from = keys[i];
    const note = m.marks.get(from) || '';
    let to = from;
    let j = i + 1;
    while (j < keys.length && keys[j] === addDays(to, 1) && (m.marks.get(keys[j]) || '') === note && j - i < MAX_RANGE_DAYS) { to = keys[j]; j++; }
    if (to === from) days.push(note ? { date: from, note } : { date: from });
    else ranges.push(note ? { from, to, note } : { from, to });
    i = j;
  }
  const recurringHebrew = m.fixed.map((f) => (f.note ? { month: f.month, day: f.day, note: f.note } : { month: f.month, day: f.day }));
  return { version: NON_WORKING_DAYS_SETTING_VERSION, days, ranges, recurringHebrew };
}

export const serializeModel = (m) => JSON.stringify(modelToDocument(m));

/** אותה משמעות בכלל (אותם ימים סגורים, אותן הערות, אותם תאריכים קבועים) - בלי תלות בצורת השמירה. */
export function sameMeaning(a, b) {
  if (a.marks.size !== b.marks.size) return false;
  for (const [k, n] of a.marks) if (!b.marks.has(k) || (b.marks.get(k) || '') !== (n || '')) return false;
  const sig = (m) => JSON.stringify(m.fixed.map((f) => [f.month, f.day, f.note || '']).sort());
  return sig(a) === sig(b);
}

// ---------- שינויים שלא נשמרו (כרטיס "סיכום") ----------

function groupDays(keys, noteOf) {
  const out = [];
  for (const k of [...keys].sort()) {
    const n = noteOf(k) || '';
    const g = out[out.length - 1];
    if (g && addDays(g.keys[g.keys.length - 1], 1) === k && g.note === n) g.keys.push(k);
    else out.push({ keys: [k], note: n });
  }
  return out;
}
const fxKey = (f) => f.month + '|' + f.day;

/**
 * ההפרש בין השמור (saved) לטיוטה (work), כקבוצות לתצוגה ולביטול שורה-שורה:
 *   { t:'add'|'rm', keys, note } (ימים צמודים עם אותה הערה), { t:'note', keys:[k], note, was }, { t:'fxadd'|'fxrm', f }
 */
export function diffModels(saved, work) {
  const out = [];
  groupDays([...work.marks.keys()].filter((k) => !saved.marks.has(k)), (k) => work.marks.get(k)).forEach((g) => out.push({ t: 'add', keys: g.keys, note: g.note }));
  groupDays([...saved.marks.keys()].filter((k) => !work.marks.has(k)), (k) => saved.marks.get(k)).forEach((g) => out.push({ t: 'rm', keys: g.keys, note: g.note }));
  [...work.marks.keys()].filter((k) => saved.marks.has(k) && (saved.marks.get(k) || '') !== (work.marks.get(k) || '')).sort()
    .forEach((k) => out.push({ t: 'note', keys: [k], note: work.marks.get(k) || '', was: saved.marks.get(k) || '' }));
  const savedFx = new Map(saved.fixed.map((f) => [fxKey(f), f]));
  const workFx = new Map(work.fixed.map((f) => [fxKey(f), f]));
  for (const f of work.fixed) {
    const s = savedFx.get(fxKey(f));
    if (!s) out.push({ t: 'fxadd', f });
    else if ((s.note || '') !== (f.note || '')) out.push({ t: 'fxnote', f, was: s.note || '' });
  }
  for (const f of saved.fixed) if (!workFx.has(fxKey(f))) out.push({ t: 'fxrm', f });
  return out;
}

/** ביטול קבוצה אחת: מחזיר טיוטה חדשה (לא משנה את הקיימת). */
export function undoGroup(saved, work, g) {
  const w = cloneModel(work);
  if (g.t === 'add') g.keys.forEach((k) => w.marks.delete(k));
  else if (g.t === 'rm' || g.t === 'note') g.keys.forEach((k) => w.marks.set(k, saved.marks.get(k) || ''));
  else if (g.t === 'fxadd') w.fixed = w.fixed.filter((x) => fxKey(x) !== fxKey(g.f));
  else if (g.t === 'fxrm') w.fixed = [...w.fixed, { ...g.f }];
  else if (g.t === 'fxnote') w.fixed = w.fixed.map((x) => (fxKey(x) === fxKey(g.f) ? { ...x, note: g.was } : x));
  return w;
}

/**
 * בחירה בלוח -> מה אפשר לעשות בה (NWD-Q05/Q07, פירוש 5): ימים שעברו וימים סגורים (שישי, שבת, חג, ערב חג, חול המועד,
 * תאריך קבוע) מדולגים בשקט ונספרים; marked = ימים שכבר מסומנים בטיוטה; cand = ימים שיסומנו.
 */
export function analyseSelection(keys, work, today) {
  const r = { past: 0, closed: 0, marked: [], cand: [] };
  for (const k of keys) {
    if (k < today) { r.past++; continue; }
    if (closedReason(k, work.fixed)) { r.closed++; continue; }
    if (work.marks.has(k)) { r.marked.push(k); continue; }
    r.cand.push(k);
  }
  return r;
}

/** סימון ימים (לטיוטה). מחזיר טיוטה חדשה. */
export function markDays(work, keys, note) {
  const w = cloneModel(work);
  const n = normNote(note);
  for (const k of keys) if (isValidDayKey(k)) w.marks.set(k, n);
  return w;
}
/** הסרת סימון (לטיוטה). */
export function unmarkDays(work, keys) {
  const w = cloneModel(work);
  for (const k of keys) w.marks.delete(k);
  return w;
}
/** עדכון הערה ליום מסומן. */
export function setNote(work, key, note) {
  if (!work.marks.has(key)) return work;
  const w = cloneModel(work);
  w.marks.set(key, normNote(note));
  return w;
}

/** האם תאריך עברי (חודש קנוני + יום) תקין לבורר: חודש מהרשימה, יום 1..maxDay. */
export function isValidFixed(month, day) {
  const opt = HEBREW_MONTH_OPTIONS.find((o) => o.value === month);
  const d = Number(day);
  return !!opt && Number.isInteger(d) && d >= 1 && d <= opt.maxDay;
}
/** הוספת תאריך קבוע. { work, added: boolean, duplicate: boolean } */
export function addFixed(work, { month, day, note }) {
  if (!isValidFixed(month, day)) return { work, added: false, duplicate: false };
  const f = { month, day: Number(day) };
  if (work.fixed.some((x) => fxKey(x) === fxKey(f))) return { work, added: false, duplicate: true };
  const w = cloneModel(work);
  w.fixed = [...w.fixed, { id: newId(), ...f, note: normNote(note) }];
  return { work: w, added: true, duplicate: false };
}
export function removeFixed(work, f) {
  const w = cloneModel(work);
  w.fixed = w.fixed.filter((x) => fxKey(x) !== fxKey(f));
  return w;
}
export const hasFixed = (m, f) => m.fixed.some((x) => fxKey(x) === fxKey(f));

/**
 * הבורר של התאריך הקבוע (פירוש 8: שני select של הפלטה). הסדר מתשרי; 'Adar II' לא מוצע - בכלל הוא זהה ל-'Adar'
 * בכל שנה (פשוטה: אדר; מעוברת: אדר ב׳). התוויות אומרות מה הכלל עושה בפועל (lib/businessDays.js resolveHebrewMonth).
 */
export const FIXED_MONTH_OPTIONS = Object.freeze(HEBREW_MONTH_OPTIONS
  .filter((o) => o.value !== 'Adar II')
  .map((o) => Object.freeze({
    value: o.value,
    maxDay: o.maxDay,
    label: o.value === 'Adar' ? 'אדר (בשנה מעוברת: אדר ב׳)' : o.value === 'Adar I' ? 'אדר א׳ (בשנה פשוטה: אדר)' : o.label,
  })));
export const fixedMaxDay = (month) => (FIXED_MONTH_OPTIONS.find((o) => o.value === month) || { maxDay: 30 }).maxDay;
// חודשים שבחלק מהשנים יש בהם 29 ימים בלבד (חשוון, כסלו; אדר א׳ בשנה פשוטה = אדר בן 29)
export const SHORT_YEAR_MONTHS = Object.freeze(['Cheshvan', 'Kislev', 'Adar I']);
export const DAY30_NOTE = 'בשנה שבה אין בחודש הזה יום ל׳, הגמ״ח ייסגר ביום האחרון של החודש (כ״ט).';

// ---------- "פעילות רשומה" (NWD-Q06: אזהרה בלבד) ----------

export const plural = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
/** "3 אירועים · משלוח אחד" */
export function activityText(ev, dl) {
  const p = [];
  if (ev) p.push(plural(ev, 'אירוע אחד', 'אירועים'));
  if (dl) p.push(plural(dl, 'משלוח אחד', 'משלוחים'));
  return p.join(' · ');
}
/** סיכום הפעילות של רשימת ימים מתוך מפה { key: { events, deliveries } }: { ev, dl, days: [keys עם פעילות] } */
export function sumActivity(keys, byDay) {
  const r = { ev: 0, dl: 0, days: [] };
  for (const k of keys) {
    const a = byDay && byDay[k];
    if (!a || (!a.events && !a.deliveries)) continue;
    r.ev += a.events || 0;
    r.dl += a.deliveries || 0;
    r.days.push(k);
  }
  return r;
}

/**
 * צד השרת: הזמנות (eventDate, isDelivery) -> { key: { events, deliveries } } לפי היום הישראלי של האירוע, רק בטווח.
 * dayKeyOf = getIsraelDateKey (מוזרק, כדי שהמודול יישאר בלי תלות בשעון).
 */
export function countActivity(orders, fromKey, toKey, dayKeyOf) {
  const out = {};
  for (const o of orders || []) {
    if (!o || !o.eventDate) continue;
    const k = dayKeyOf(o.eventDate);
    if (!k || k < fromKey || k > toKey) continue;
    const a = out[k] || (out[k] = { events: 0, deliveries: 0 });
    a.events++;
    if (o.isDelivery) a.deliveries++;
  }
  return out;
}

/** פרמטרי ?from=&to= של בקשת הפעילות: { from, to } תקינים (to >= from, עד ACTIVITY_MAX_DAYS) או null. */
export function parseActivityRange(from, to) {
  if (typeof from !== 'string' || typeof to !== 'string' || !KEY_RE.test(from) || !KEY_RE.test(to)) return null;
  if (!isValidDayKey(from) || !isValidDayKey(to) || from > to) return null;
  if (keysBetween(from, to, ACTIVITY_MAX_DAYS + 1).length > ACTIVITY_MAX_DAYS) return null;
  return { from, to };
}

// ---------- הרשאה ----------

/**
 * מי עורך (NWD-Q08 + פירוש 9): הנהלה ראשית / מתכנת, או מי שיש לו feature:non_working_days_manage (hasPermission כבר מחזיר
 * true לתפקידים 0/2). אחרים - צפייה בלבד. אורח (התחברות כבויה) - צפייה בלבד: אין לו זהות שהשרת יכול לבדוק.
 */
export const canEditFrom = ({ logged, hasManagePermission }) => !!logged && !!hasManagePermission;

// ---------- טיוטה מקומית (localStorage) ----------
// עריכה שלא נשמרה לא הולכת לאיבוד גם כשעוזבים את הדף דרך התפריט (beforeunload לא נורה בניווט פנימי) או סוגרים את הלשונית.
// כמו טיוטות כרטיס ההזמנה (app/lib/orderDrafts.js): נכתבת בזמן שיש שינויים, נמחקת בשמירה / "בטל שינויים", ובטעינה הבאה מוצג
// באנר "שחזר / מחק". המפתח לפי העובד המחובר; הארגון (גמ"ח) נפרד מעצמו כי localStorage הוא לפי הדומיין של כל אתר.
export const DRAFT_VERSION = 1;
export const DRAFT_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
export const draftStorageKey = (userId) => `gemachNwdDraft:${userId === null || userId === undefined || userId === '' ? 'anon' : userId}`;

/** מודל עבודה -> אובייקט הטיוטה לשמירה (value = המסמך הקנוני של הטיוטה, base = המסמך השמור שעליו נבנתה). */
export function buildDraft(saved, work, now = Date.now()) {
  return { v: DRAFT_VERSION, savedAt: now, base: serializeModel(saved), value: serializeModel(work) };
}

/** מחרוזת מ-localStorage -> טיוטה תקינה וטרייה, או null (שבור / גרסה אחרת / ישן מדי). לעולם לא זורק. */
export function parseDraft(raw, now = Date.now()) {
  if (typeof raw !== 'string' || !raw) return null;
  let d;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!d || typeof d !== 'object' || d.v !== DRAFT_VERSION || typeof d.value !== 'string' || typeof d.base !== 'string') return null;
  if (typeof d.savedAt !== 'number' || now - d.savedAt > DRAFT_MAX_AGE_MS || d.savedAt > now + 3600 * 1000) return null;
  return d;
}

/**
 * המודל שישוחזר מהטיוטה מעל מה שנשמר כרגע: ימים שכבר עברו נשארים כמו בשמור (הם נעולים, גם בשרת - כך ששחזור לא ייצור שינוי
 * שהשמירה תידחה עליו); כל השאר כמו בטיוטה.
 */
export function restoreDraftModel(saved, draft, today) {
  const w = modelFromSetting(draft.value);
  for (const k of [...w.marks.keys()]) if (k < today && !saved.marks.has(k)) w.marks.delete(k);
  for (const [k, n] of saved.marks) if (k < today) w.marks.set(k, n);
  w.invalid = saved.invalid || 0;
  w.ignoredOpen = saved.ignoredOpen || 0;
  return w;
}
