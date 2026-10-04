// דף ה-PDF / ההדפסה של תוצאות החיפוש (דף הבית החדש): לוגיקה טהורה בלבד — בלי DOM, React או רשת, כדי שאפשר לבדוק ב-node
// (scripts/test_search_pdf_logic.mjs). מקור יחיד לשני המסלולים: חלון הדפסה (window.print) והורדת PDF (POST /api/pdf, מצב html).
//
// למה עמודים מפורשים ושורות בגובה קבוע (ולא זרימה חופשית של הדפדפן + thead):
//  - מספר עמוד "עמוד X מתוך Y" וכותרת עליונה בכל עמוד נכתבים במפורש לכל עמוד, ולכן עובדים בכל דפדפן ובלי JavaScript
//    (מצב html של /api/pdf מריץ Chromium בלי JS) — בניגוד ל-@page margin boxes שקיימים רק ב-Chromium.
//  - לשורה גובה קבוע (טקסט ארוך נחתך ב-"…" ולא מגדיל את השורה) ולכן החלוקה לעמודים חישוב טהור: שורה אף פעם לא נחתכת בין שני עמודים,
//    ואין תלות בפונט של המכונה (ב-Vercel הפונט שונה מזה שבמחשב העובדת).
//  - כותרות העמודות של כל קטגוריה חוזרות בראש כל עמוד שהקטגוריה ממשיכה בו.
// צבעים קבועים בלבד (שחור/אפור/לבן) — חלון הדפסה לא משתמש במשתני ערכת הנושא של האתר (ר' CLAUDE.md, "Print views").
// תאריכים: עבריים בלבד (החלטת הבעלים), והשעה לפי שעון ישראל (לא לפי אזור הזמן של השרת/המחשב).
//
// הממשק שמתחבר ל-shell ההדפסה של הלו"ז (feature/schedule-print-core-2026-10-02, כשימוזג): אותם משתני גיאומטריה
// (GEOMETRY_MM) וסדר המקטעים (כותרת / שורת הקשר / גוף / תחתית). עד אז הדף הזה עצמאי; להחליף = להחזיר מ-buildSearchSheet את אותו מבנה pages.

import { escapeHtml, unifiedRows, rowColumns, withoutActionKeys, cellText } from './homeLogic.js';
import { hebText } from './homeDates.js';

export const SHEET_TITLE = 'תוצאות חיפוש';
export const DEFAULT_GMACH = 'גמ״ח שמלות';
// מעל זה לא מדפיסים (הערה בתחתית הדף מפנה ל-Excel). החיפוש הכללי מחזיר עד 50 לכל סוג = 150, החיפוש המתקדם/החכם יכולים יותר.
export const SHEET_ROW_CAP = 500;
// עמודות במקטע גנרי (חיפוש מתקדם / חכם) מעל זה = דף לרוחב
export const LANDSCAPE_FROM_COLUMNS = 7;

// מידות תוכן העמוד במ"מ (A4 פחות שוליים של 10 מ"מ מכל צד — אותם שוליים ש-/api/pdf קובע במצב html). 1 מ"מ פחות כדי שלא ייווצר עמוד ריק בסוף.
export const GEOMETRY_MM = Object.freeze({
  portrait: Object.freeze({ w: 190, h: 276 }),
  landscape: Object.freeze({ w: 277, h: 189 }),
});
const HEAD_H = 19; // כותרת: שם הגמ"ח + "תוצאות חיפוש" + תאריך עברי ושעה
const CTX_H = 9; // שורת הקשר: מה חיפשו, הסינון, כמה תוצאות
const FOOT_H = 10; // תחתית: "עמוד X מתוך Y"
const BODY_PAD = 3; // רווח בין שורת ההקשר לגוף
const SEC_H = 8.5; // כותרת קטגוריה ("לקוחות · 12")
const COL_H = 7.5; // שורת כותרות העמודות
const GAP_H = 4; // רווח בין שתי קטגוריות באותו עמוד
const NOTE_H = 10; // הערת חיתוך בסוף
export const ROW_H = Object.freeze({ one: 9, two: 13.5 }); // גובה שורה: שורת טקסט אחת / עד שתיים (מרווח נדיב, כמו בדפי ההדפסה האחרים)

/* ---------- זמן עברי לפי שעון ישראל ---------- */

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const IL_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** { iso: 'YYYY-MM-DD', time: 'HH:MM' } לפי שעון ישראל (בלי קשר לאזור הזמן של המכונה). */
export function israelNow(now = new Date()) {
  const p = {};
  IL_PARTS.formatToParts(now).forEach((x) => { p[x.type] = x.value; });
  return { iso: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
}

/** { date: 'יום חמישי · כ״א תשרי תשפ״ז', time: '14:32', hebrew: 'כ״א תשרי תשפ״ז', iso } — תאריך עברי בלבד. */
export function headerStamp(now = new Date()) {
  const { iso, time } = israelNow(now);
  const wd = WEEKDAYS[new Date(iso + 'T12:00:00').getDay()];
  const hebrew = hebText(iso);
  return { iso, time, hebrew, date: 'יום ' + wd + ' · ' + hebrew };
}

/* ---------- שם קובץ ---------- */

const FILE_BAD = /[\\/:*?"<>|\u0000-\u001f\u007f‎‏‪-‮⁦-⁩״׳'`]/g;
const cleanPart = (s, max) => String(s == null ? '' : s).replace(FILE_BAD, '').replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, max).replace(/-+$/, '');

/** "תוצאות-חיפוש-כהן-כא-תשרי-תשפז" (בלי סיומת): כותרת, טקסט החיפוש (אם יש), תאריך עברי. בטוח לשם קובץ בווינדוס. */
export function searchFileName({ title = SHEET_TITLE, query = '', now = new Date() } = {}) {
  const parts = [cleanPart(title, 40) || 'תוצאות-חיפוש'];
  const q = cleanPart(query, 24);
  if (q) parts.push(q);
  const d = cleanPart(headerStamp(now).hebrew, 24);
  if (d) parts.push(d);
  return parts.join('-');
}

/* ---------- מקטעים (קטגוריות) ---------- */

const cnt = (n, one, many) => (n === 1 ? one : n + ' ' + many);

// תיאור עמודות החיפוש הכללי: h = כותרת, w = משקל רוחב, ltr = מספרים/טלפון/ברקוד (כיוון שמאל-לימין, מיושר לימין).
// לפי מה שהעובדת רואה על המסך בשורת התוצאה — לא מוסיפים סכום, פריטים או פרטי תשלום (מידע שלא מוצג בתוצאות).
const GENERAL_SECTIONS = [
  { kind: 'לקוח', key: 'customers', label: 'לקוחות', one: 'לקוח אחד', many: 'לקוחות', cols: [{ h: 'שם', w: 42 }, { h: 'טלפון', w: 30, ltr: true }, { h: 'עיר', w: 28 }] },
  { kind: 'הזמנה', key: 'orders', label: 'הזמנות', one: 'הזמנה אחת', many: 'הזמנות', cols: [{ h: 'שם', w: 34 }, { h: 'מס׳ הזמנה', w: 16, ltr: true }, { h: 'תאריך אירוע', w: 30 }, { h: 'סטטוס', w: 20 }] },
  // פריט = השכרה אחת של פריט (ברקוד חוזר בהשכרות רבות): גם ההזמנה, הלקוחה, תאריך האירוע (עברי) ומצב הפריט — כמו בשורה על המסך
  { kind: 'פריט', key: 'items', label: 'פריטים', one: 'פריט אחד', many: 'פריטים', cols: [{ h: 'דגם', w: 28 }, { h: 'ברקוד', w: 17, ltr: true }, { h: 'מידה', w: 10 }, { h: 'מס׳ הזמנה', w: 14, ltr: true }, { h: 'לקוח', w: 27 }, { h: 'תאריך אירוע', w: 25 }, { h: 'סטטוס', w: 20 }] },
];

function generalCells(kind, r) {
  if (kind === 'לקוח') return [r.title, r.phone, r.city];
  if (kind === 'הזמנה') return [r.title, '#' + r.orderId, r.eventHeb, r.status ? r.status.label : ''];
  return [r.title, r.barcode, r.size, r.orderId ? '#' + r.orderId : '', r.customer, r.eventHeb, r.status ? r.status.label : ''];
}

/** תשובת החיפוש הכללי (אחרי normalizeSearch + applyScope) → מקטעים: לקוחות / הזמנות / פריטים, רק מה שיש בו שורות. */
export function sectionsFromGeneral(res) {
  const rows = unifiedRows(res);
  return GENERAL_SECTIONS
    .map((def) => {
      const mine = rows.filter((r) => r.kind === def.kind);
      return { key: def.key, label: def.label, one: def.one, many: def.many, cols: def.cols, rows: mine.map((r) => generalCells(def.kind, r)) };
    })
    .filter((s) => s.rows.length);
}

const PHONE_OR_MAIL = /^[+\d][\d\s\-()+]{6,}$|^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * שורות-אובייקטים (חיפוש מתקדם / חכם: מפתח לכל עמודה) → מקטע אחד. עמודות פנימיות (_action*) ורגישות (ת"ז, בנק…) לא נכללות —
 * אותם כללים כמו בייצוא ל-Excel (withoutActionKeys). רוחב כל עמודה לפי אורך התוכן, ושורות עם תוכן ארוך עוברות לשתי שורות טקסט.
 */
export function sectionFromRecords(rows, label = 'תוצאות') {
  const data = withoutActionKeys(rows);
  const keys = rowColumns(data);
  if (!keys.length || !data.length) return null;
  const maxLen = keys.map((k) => data.reduce((m, r) => Math.max(m, cellText(r[k]).length), 0));
  const cols = keys.map((k, i) => ({
    h: k,
    w: clamp(Math.max(k.length + 2, Math.min(maxLen[i], 36)), 6, 36),
    ltr: data.every((r) => { const v = cellText(r[k]).trim(); return !v || PHONE_OR_MAIL.test(v); }),
  }));
  return { key: 'rows', label, one: 'שורה אחת', many: 'שורות', cols, rows: data.map((r) => keys.map((k) => cellText(r[k]))), generic: true };
}

/** חיתוך לכמות מקסימלית של שורות על פני כל המקטעים (לפי הסדר). מחזיר { sections, total, shown, capped }. לא משנה את הקלט. */
export function capSections(sections, cap = SHEET_ROW_CAP) {
  const total = sections.reduce((n, s) => n + s.rows.length, 0);
  let left = cap;
  const out = [];
  sections.forEach((s) => {
    if (left <= 0) return;
    const rows = s.rows.slice(0, left);
    left -= rows.length;
    out.push(rows.length === s.rows.length ? s : { ...s, rows, totalRows: s.rows.length });
  });
  const shown = out.reduce((n, s) => n + s.rows.length, 0);
  return { sections: out, total, shown, capped: shown < total };
}

/* ---------- גיאומטריה וחלוקה לעמודים ---------- */

/** לרוחב אם יש מקטע גנרי עם הרבה עמודות; אחרת לאורך. */
export function chooseOrientation(sections, wanted = 'auto') {
  if (wanted === 'portrait' || wanted === 'landscape') return wanted;
  return sections.some((s) => s.generic && s.cols.length >= LANDSCAPE_FROM_COLUMNS) ? 'landscape' : 'portrait';
}

// רוחב ממוצע של תו עברי בגודל 10pt ≈ 1.85 מ"מ (מעוגל ל-1.9); שוליים פנימיים 3.2 מ"מ בכל תא
const CHAR_MM = 1.9;
const CELL_PAD_MM = 3.2;

/** כמה שורות טקסט (1 או 2) צריך המקטע — לפי התא הארוך ביותר בכל עמודה מול רוחב העמודה. עמודות כלליות (לא גנריות) תמיד שורה אחת. */
export function sectionLines(section, widthMm) {
  if (!section.generic) return 1;
  const total = section.cols.reduce((n, c) => n + c.w, 0);
  const needTwo = section.cols.some((c, i) => {
    const cap = Math.max(4, Math.floor(((widthMm * c.w) / total - CELL_PAD_MM) / CHAR_MM));
    return section.rows.some((r) => cellText(r[i]).length > cap);
  });
  return needTwo ? 2 : 1;
}

/**
 * חלוקה לעמודים — חישוב טהור לפי גבהים קבועים. מחזיר [{ items: [{ t: 'sec'|'col'|'row'|'gap'|'note', ... }], used }].
 * כללים: כותרת קטגוריה + כותרות עמודות + לפחות שתי שורות (או כל מה שיש) נשארות יחד (אין כותרת "יתומה" בתחתית עמוד); שורה לא נחתכת בין עמודים;
 * בעמוד המשך חוזרים כותרת הקטגוריה ("… · המשך") וכותרות העמודות.
 */
export function paginate(sections, orientation = 'portrait', { note = '' } = {}) {
  const geo = GEOMETRY_MM[orientation] || GEOMETRY_MM.portrait;
  const avail = geo.h - HEAD_H - CTX_H - FOOT_H - BODY_PAD;
  const pages = [];
  let cur = null;
  const fresh = () => { cur = { items: [], used: 0 }; pages.push(cur); };
  const add = (item, h) => { cur.items.push(item); cur.used += h; };
  fresh();
  sections.forEach((s) => {
    const rowH = sectionLines(s, geo.w) === 2 ? ROW_H.two : ROW_H.one;
    const lead = SEC_H + COL_H + Math.min(2, s.rows.length) * rowH; // כותרות + עד שתי שורות ראשונות נשארות יחד
    const gap = cur.items.length ? GAP_H : 0;
    if (cur.items.length && cur.used + gap + lead > avail) fresh();
    else if (gap) add({ t: 'gap' }, GAP_H);
    const head = (cont) => { add({ t: 'sec', s, cont }, SEC_H); add({ t: 'col', s, rowH }, COL_H); };
    head(false);
    s.rows.forEach((cells, i) => {
      if (cur.used + rowH > avail) { fresh(); head(true); }
      add({ t: 'row', s, cells, rowH, n: i }, rowH);
    });
  });
  if (note) {
    if (cur.used + NOTE_H > avail) fresh();
    add({ t: 'note', text: note }, NOTE_H);
  }
  return pages;
}

/* ---------- HTML ---------- */

const FONT = 'Arial,"Segoe UI",Heebo,"Noto Sans Hebrew","Helvetica Neue",sans-serif';
// נטען רק בהורדת PDF בשרת: ל-Chromium של Vercel אין פונט עברי מותקן, ו-/api/pdf מתיר רק את Google Fonts (lib/pdf.js, isAllowedHtmlModeRequest)
const SERVER_FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap');";

function sheetCss(orientation, forServer) {
  const g = GEOMETRY_MM[orientation];
  return (forServer ? SERVER_FONT_IMPORT : '')
    + '@page{size:A4 ' + orientation + ';margin:10mm}'
    + '*{box-sizing:border-box}'
    + 'html,body{margin:0;padding:0;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font-family:' + (forServer ? 'Heebo,' : '') + FONT + ';font-size:10pt;line-height:1.35;direction:rtl}'
    + '.pg{width:' + g.w + 'mm;height:' + g.h + 'mm;display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#111;break-after:page;page-break-after:always}'
    + '.pg:last-child{break-after:auto;page-break-after:auto}'
    + '.hd{flex:none;height:' + HEAD_H + 'mm;display:flex;align-items:flex-end;justify-content:space-between;gap:6mm;border-bottom:.9mm solid #111;padding-bottom:2mm}'
    + '.hd .gm{display:block;font-size:9pt;font-weight:600;color:#555;line-height:1.1}'
    + '.hd h1{margin:1mm 0 0;font-size:17pt;line-height:1.1;font-weight:700;color:#111}'
    + '.hd .dt{text-align:end;font-size:10pt;font-weight:600;line-height:1.3;white-space:nowrap}'
    + '.hd .dt span{display:block;font-weight:400;color:#555;font-size:9pt}'
    + '.cx{flex:none;height:' + CTX_H + 'mm;display:flex;align-items:center;gap:2.5mm;border-bottom:.3mm solid #111;overflow:hidden;white-space:nowrap}'
    + '.cx .chip{border:.3mm solid #111;border-radius:99px;padding:.4mm 2.8mm;font-size:9pt;font-weight:600;max-width:100mm;overflow:hidden;text-overflow:ellipsis}'
    + '.cx .sm{margin-inline-start:auto;font-size:9pt;color:#555}'
    + '.bd{flex:1 1 auto;min-height:0;padding-top:' + BODY_PAD + 'mm;overflow:hidden}'
    + '.sc{height:' + SEC_H + 'mm;display:flex;align-items:center;gap:2mm;background:#f3f3f3;border-top:.3mm solid #111;border-bottom:.3mm solid #888;padding:0 1.6mm;font-weight:700;font-size:10.5pt}'
    + '.sc span{font-weight:400;color:#555;font-size:9.5pt}'
    + '.r{display:grid;align-items:center;border-bottom:.2mm solid #b9b9b9}'
    + '.r.h{height:' + COL_H + 'mm;border-bottom:.5mm solid #111;font-weight:700;font-size:9.5pt}'
    + '.r.o{height:' + ROW_H.one + 'mm}'
    + '.r.t{height:' + ROW_H.two + 'mm}'
    + '.c{min-width:0;padding:0 1.6mm;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;line-clamp:1;overflow-wrap:anywhere}'
    + '.t .c{-webkit-line-clamp:2;line-clamp:2}'
    + '.c.ltr{direction:ltr;text-align:right;unicode-bidi:isolate}'
    + '.d{color:#888}'
    + '.gp{height:' + GAP_H + 'mm}'
    + '.nt{height:' + NOTE_H + 'mm;display:flex;align-items:center;font-size:9pt;color:#555}'
    + '.ft{flex:none;height:' + FOOT_H + 'mm;display:flex;align-items:center;justify-content:space-between;border-top:.3mm solid #111;font-size:9pt;color:#555}'
    + '.ft .pn{font-weight:700;color:#111;font-size:10pt}'
    + '@media screen{body{background:#e9ebee;padding:8mm 0}.pg{margin:0 auto 8mm;box-shadow:0 2px 14px rgba(0,0,0,.25)}}';
}

function cellHtml(v, col) {
  const t = cellText(v).trim();
  return '<div class="c' + (col.ltr ? ' ltr' : '') + '">' + (t ? escapeHtml(t) : '<span class="d">—</span>') + '</div>';
}
const gridCols = (s) => 'grid-template-columns:' + s.cols.map((c) => 'minmax(0,' + c.w + 'fr)').join(' ');

function itemHtml(it) {
  if (it.t === 'gap') return '<div class="gp"></div>';
  if (it.t === 'note') return '<div class="nt">' + escapeHtml(it.text) + '</div>';
  if (it.t === 'sec') {
    const s = it.s;
    const n = s.totalRows || s.rows.length;
    return '<div class="sc"><b>' + escapeHtml(s.label) + (it.cont ? ' · המשך' : '') + '</b><span>' + escapeHtml(cnt(n, s.one, s.many)) + '</span></div>';
  }
  if (it.t === 'col') return '<div class="r h" style="' + gridCols(it.s) + '">' + it.s.cols.map((c) => '<div class="c' + (c.ltr ? ' ltr' : '') + '">' + escapeHtml(c.h) + '</div>').join('') + '</div>';
  return '<div class="r ' + (it.rowH === ROW_H.two ? 't' : 'o') + '" style="' + gridCols(it.s) + '">' + it.s.cols.map((c, i) => cellHtml(it.cells[i], c)).join('') + '</div>';
}

/**
 * בונה את מסמך ה-HTML המלא של דף ההדפסה / ה-PDF.
 * @param {object} o
 * @param {Array}  o.sections       מקטעים (sectionsFromGeneral / sectionFromRecords)
 * @param {string} [o.title]        כותרת הדף (ברירת מחדל "תוצאות חיפוש")
 * @param {string} [o.gmach]        שם הגמ"ח (מההגדרות)
 * @param {string} [o.query]        מה חיפשו (נחתך ל-80 תווים בכותרת)
 * @param {string} [o.queryLabel]   תווית הטקסט בשורת ההקשר: "חיפוש" (ברירת מחדל) / "סינון" (מתקדם) / "שאלה" (חכם)
 * @param {string} [o.scopeChip]    טקסט מלא לתגית הקטגוריה, למשל "רק בלקוחות" או "תחום: הזמנות" (ריק = אין תגית)
 * @param {string} [o.orientation]  'auto' | 'portrait' | 'landscape'
 * @param {boolean}[o.forServer]    true = להורדה דרך /api/pdf (מוסיף פונט עברי מ-Google Fonts)
 * @param {Date}   [o.now]
 * @returns {{ html, pages, landscape, total, shown, capped, fileName }}
 */
export function buildSearchSheet({ sections, title = SHEET_TITLE, gmach = DEFAULT_GMACH, query = '', queryLabel = 'חיפוש', scopeChip = '', orientation = 'auto', forServer = false, now = new Date(), cap = SHEET_ROW_CAP } = {}) {
  const capped = capSections((sections || []).filter((s) => s && s.rows.length), cap);
  const orient = chooseOrientation(capped.sections, orientation);
  const note = capped.capped ? 'מוצגות ' + capped.shown + ' מתוך ' + capped.total + ' תוצאות. לרשימה המלאה יש להשתמש בייצוא ל-Excel.' : '';
  const pages = paginate(capped.sections, orient, { note });
  const stamp = headerStamp(now);
  const fileName = searchFileName({ title, query, now });
  const q = String(query || '').trim();
  const qShown = q.length > 80 ? q.slice(0, 79) + '…' : q;
  const summary = capped.sections.length > 1 || capped.capped
    ? [cnt(capped.total, 'תוצאה אחת', 'תוצאות')].concat(capped.sections.length > 1 ? [capped.sections.map((s) => cnt(s.totalRows || s.rows.length, s.one, s.many)).join(', ')] : []).join(': ')
    : capped.sections.length ? cnt(capped.total, capped.sections[0].one, capped.sections[0].many) : 'אין תוצאות';
  const chips = (qShown ? '<span class="chip">' + escapeHtml(queryLabel) + ': ' + escapeHtml(qShown) + '</span>' : '')
    + (scopeChip ? '<span class="chip">' + escapeHtml(scopeChip) + '</span>' : '')
    + '<span class="sm">' + escapeHtml(summary) + '</span>';
  const total = pages.length;
  const body = pages.map((p, i) => '<section class="pg">'
    + '<header class="hd"><div><span class="gm">' + escapeHtml(gmach) + '</span><h1>' + escapeHtml(title) + '</h1></div>'
    + '<div class="dt">' + escapeHtml(stamp.date) + '<span>' + escapeHtml(stamp.time) + '</span></div></header>'
    + '<div class="cx">' + chips + '</div>'
    + '<div class="bd">' + p.items.map(itemHtml).join('') + '</div>'
    + '<footer class="ft"><span>' + escapeHtml(gmach) + ' · ' + escapeHtml(title) + '</span><span class="pn">עמוד ' + (i + 1) + ' מתוך ' + total + '</span></footer>'
    + '</section>').join('');
  const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + escapeHtml(fileName) + '</title>'
    + '<style>' + sheetCss(orient, forServer) + '</style></head><body>' + body + '</body></html>';
  return { html, pages: total, landscape: orient === 'landscape', total: capped.total, shown: capped.shown, capped: capped.capped, fileName };
}
