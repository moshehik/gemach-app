// lib/schedule/print/barcode.js — ברקוד Code 39 לדפי ההדפסה של הלו״ז (טהור, בלי DOM, בלי חבילה).
//
// מקור: הפונקציות barcode()/bc() ו-C39 בתצוגות המאושרות (תצוגות-עיצוב/לוז-יומי.html, דפי-הדפסה-עיצוב.html).
// הקודים כאן הם "קוד הזמנה-שלב" חדש (החלטת הבעלים D1, DECISIONS-לוז-יומי.md): קידומת של שלוש אותיות,
// מקף ומספר ההזמנה - למשל DOT-40113 (משלוח הלוך), REP-40113-2 (פריט 2 בהזמנה), ALL-PRP-261014 (כל דף ההכנה
// של 14.10.2026). הם נפרדים לגמרי מברקוד פריט השמלה (ספרות בלבד, lib/rentalBarcodeMatch.js parseBarcode) -
// הפענוח כאן (parseScheduleCode) אינו נוגע ב-parseBarcode ואינו מחליף אותו.
//
// Code 39: כל תו = 9 פסים/רווחים לסירוגין (5 פסים, 4 רווחים), 3 מהם רחבים ('w') ו-6 צרים ('n'); רווח צר בין
// תווים; תו התחלה/סיום '*' משני הצדדים. תווים חוקיים: 0-9, A-Z, '-', '.', רווח. (סורק רגיל קורא זאת בלי הגדרה.)

export const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn',
  J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn',
  Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn',
  X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
};

const WIDE = 3; // יחס רחב:צר (2.5-3 מקובל; העיצוב משתמש ב-3)

export function isValidCode39(text) {
  const s = String(text ?? '');
  if (!s.length) return false;
  for (const ch of s.toUpperCase()) if (!(ch in CODE39) || ch === '*') return false;
  return true;
}

/**
 * מחשב את הפסים של הקוד (בלי לצייר). unit = רוחב פס צר ביחידות הציור (מ"מ בדפים, px במסך).
 * @returns {{ text:string, bars:Array<{x:number,w:number}>, width:number }}
 *   bars - רק הפסים השחורים (x מתחילת הקוד); width - רוחב הקוד כולו (כולל תווי * ובלי רווח אחרון).
 */
export function code39Bars(text, unit = 0.2) {
  const clean = String(text ?? '').toUpperCase();
  if (!isValidCode39(clean)) throw new Error('Code 39: תו לא חוקי ב-"' + clean + '"');
  const s = '*' + clean + '*';
  const bars = [];
  let x = 0;
  for (let i = 0; i < s.length; i++) {
    const p = CODE39[s[i]];
    for (let j = 0; j < 9; j++) {
      const w = (p[j] === 'w' ? WIDE : 1) * unit;
      if (j % 2 === 0) bars.push({ x: round(x), w: round(w) });
      x += w;
    }
    x += unit; // רווח צר בין תווים
  }
  return { text: clean, bars, width: round(x - unit) };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * SVG כמחרוזת (לשימוש מחוץ ל-React: מייל, בדיקות). ב-React: app/components/schedule/print/Code39.js.
 * @param {string} text  הקוד
 * @param {{ height?:number, unit?:number, mm?:boolean }} [opts]  גובה ורוחב פס צר; mm=true -> מידות במ"מ (ברירת מחדל)
 */
export function code39Svg(text, { height = 8, unit = 0.2, mm = true } = {}) {
  const { bars, width, text: clean } = code39Bars(text, unit);
  const u = mm ? 'mm' : '';
  const rects = bars.map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="${height}"/>`).join('');
  return `<svg class="pp-bcsvg" data-code="${esc(clean)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}${u}" height="${height}${u}" fill="#000" shape-rendering="crispEdges" role="img" aria-label="ברקוד ${esc(clean)}">${rects}</svg>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---- סכימת הקודים של הלו״ז (D1) ----------------------------------------------------------------
// קידומת לכל שלב שיש בו "בוצע" (DECISIONS-דפי-הדפסה.md, "ברקודים"). שלבים 1 ו-7 (הזמנה, אירוע) הם מידע בלבד:
// לדפים שלהם (01, 02, 15) אין ברקוד כלל. הקידומות מופיעות גם ב-registry.js של הדפים.
export const STAGE_CODE_PREFIX = {
  order: 'ORD',   // לא מודפס (מידע בלבד) - נשמר למיפוי בלבד
  repair: 'REP',
  prep: 'PRP',
  dout: 'DOT',
  pick: 'PCK',
  event: 'EVT',   // לא מודפס (מידע בלבד)
  manret: 'MRT',
  dback: 'DBK',
};
export const PREFIX_TO_STAGE = Object.fromEntries(Object.entries(STAGE_CODE_PREFIX).map(([k, v]) => [v, k]));
const INFO_ONLY_PREFIXES = new Set(['ORD', 'EVT']);

/** קוד הזמנה לשלב: DOT-40113 */
export function orderCode(prefix, orderId) {
  return `${prefix}-${Number(orderId)}`;
}
/** קוד פריט בהזמנה (מדבקות, דף תיקונים ב'): REP-40113-2 (n = מספר סידורי 1..k בתוך ההזמנה, לא מזהה DB) */
export function itemCode(prefix, orderId, n) {
  return `${prefix}-${Number(orderId)}-${Number(n)}`;
}
/** קוד "כל הדף": ALL-PRP-261014 (YYMMDD של יום הלו״ז) */
export function dayCode(prefix, dayKey) {
  return `ALL-${prefix}-${String(dayKey).replace(/-/g, '').slice(2)}`;
}

/**
 * פענוח קוד לו״ז (ולא ברקוד שמלה - זה נשאר ב-parseBarcode). מחזיר אחד מ:
 *   { kind:'order', stage, prefix, orderId }                 DOT-40113
 *   { kind:'item',  stage, prefix, orderId, n }              REP-40113-2
 *   { kind:'day',   stage, prefix, day:'2026-10-14' }        ALL-PRP-261014
 *   { kind:'none' }                                          כל דבר אחר (כולל קידומות המידע ORD/EVT)
 */
export function parseScheduleCode(raw) {
  const c = String(raw ?? '').trim().toUpperCase();
  let m = c.match(/^([A-Z]{3})-(\d{1,9})(?:-(\d{1,3}))?$/);
  if (m && PREFIX_TO_STAGE[m[1]] && !INFO_ONLY_PREFIXES.has(m[1])) {
    const base = { stage: PREFIX_TO_STAGE[m[1]], prefix: m[1], orderId: Number(m[2]) };
    return m[3] ? { kind: 'item', ...base, n: Number(m[3]) } : { kind: 'order', ...base };
  }
  m = c.match(/^ALL-([A-Z]{3})-(\d{6})$/);
  if (m && PREFIX_TO_STAGE[m[1]] && !INFO_ONLY_PREFIXES.has(m[1])) {
    const yy = m[2].slice(0, 2);
    const mo = m[2].slice(2, 4);
    const dd = m[2].slice(4, 6);
    return { kind: 'day', stage: PREFIX_TO_STAGE[m[1]], prefix: m[1], day: `20${yy}-${mo}-${dd}` };
  }
  return { kind: 'none' };
}
