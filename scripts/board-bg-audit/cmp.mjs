// הערה (5.10.2026): הדמו לוח-חודשי.html נבנה עכשיו מהרינדור האמיתי (build-demo.mjs), ולכן השוואת הלוח מולו היא בדיקת עקביות הדמו; ההשוואה
// בעלת הערך מול עיצוב חיצוני היא שורת החיפוש + המסנן מול #hfBar של כרטיס-הזמנה.html.
// השוואת computed style: הלוח האמיתי (API מדומה) מול העיצוב המאושר (לוח-חודשי.html), ושורת החיפוש + מסנן השלבים מול חיפוש
// ההיסטוריה בכרטיס ההזמנה (כרטיס-הזמנה.html #hfBar - "בדיוק בסגנון שיש בהיסטוריה", S01). לכל זוג רכיבים (עיצוב ↔ דף) מודפסים
// רק המאפיינים השונים. שימוש: node cmp.mjs [רוחב=1280]   (אחרי build.mjs). יוצא 1 אם יש הבדל שאינו ברשימת ההבדלים המוסברים.
// רשימת ההבדלים המוסברים (EXPECTED) - החלטות הבעלים שמשנות את העיצוב בכוונה; כל שורה עם הסיבה.
import { serve, launch, sleep, PORT, DEMO, DEMO_OC } from './lib.mjs';
const width = Number(process.argv[2] || 1280);
const PROPS = ['display', 'height', 'padding', 'margin', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderInlineStartWidth', 'borderRadius', 'backgroundColor', 'backgroundImage', 'color', 'fontSize', 'fontWeight', 'fontFamily', 'gap', 'boxShadow', 'opacity', 'lineHeight', 'position'];
// [שם, בורר בעיצוב, בורר בדף, מאפיינים להתעלם (תוכן/נתונים שונים)]
const BOARD = [
  ['כותרת הדף', '.pg-ttl', '.pg-ttl', ['height']],
  ['סרגל החודש הנוכחי + מתג', '#mBar', '#mBar', []],
  ['החודש הנוכחי', '#mToday', '#mToday', []],
  ['מתג תצוגה', '#mvsw', '#mvsw', []],
  ['לחצן במתג', '#mvsw .vopt', '#mvsw .vopt', []],
  ['ידית המתג', '#mvsw .vknob', '#mvsw .vknob', []],
  ['הלוח', '#month .hc', '#month .hc', ['height']],
  ['כותרת הלוח', '#month .hc-h', '#month .lz-hc > .hc-h', []],
  ['חץ חודש', '#month .hc-h > .hc-n', '#month .lz-hc > .hc-h > .hc-n', []],
  ['שם החודש', '#month .lz-jump', '#month .lz-jump', []],
  ['שורת ימי השבוע', '#month .hc-w', '#month .hc-w', []],
  ['יום בשבוע', '#month .hc-w span', '#month .hc-w span', []],
  ['גריד', '#month .hc-g', '#month .hc-g', ['height']],
  ['תא יום', '#month .lz-day:not(.dim):not(.today):not(.sh)', '#month .lz-day:not(.today):not(.sh)', ['height']],
  ['תא שבת', '#month .lz-day.sh:not(.dim)', '#month .lz-day.sh', ['height']],
  ['תא היום', '#month .lz-day.today', '#month .lz-day.today', ['height']],
  ['כותרת תא', '#month .lz-dh', '#month .lz-dh', []],
  ['אות היום', '#month .lz-dh b', '#month .lz-dh b', []],
  ['שם החודש בתא', '#month .lz-dh em', '#month .lz-dh em', []],
  ['מונים', '#month .lz-rows', '#month .lz-rows', ['height']],
  ['מונה שלב', '#month .lz-pr:not(.al)', '#month .lz-pr:not(.al)', ['backgroundColor', 'borderTopColor']],
  ['מספר במונה', '#month .lz-pr b', '#month .lz-pr b', []],
  ['אייקון במונה', '#month .lz-pr .ic', '#month .lz-pr .ic', []],
  ['סימן התראה', '#month .lz-al', '#month .lz-al', ['margin']],
];
const HF = [
  ['שורת החיפוש', '#hfBar .hf-s', '#bdSearch .hf-s', []],
  ['אייקון חיפוש', '#hfBar .hf-s>svg.ic', '#bdSearch .hf-s>svg.ic', []],
  ['שדה', '#hfBar .hf-s input', '#bdSearch .hf-s input', []],
  ['ניקוי', '#hfBar .hf-cl', '#bdSearch .hf-cl', []],
  ['עטיפת הסינון', '#hfBar .hf-sel', '#bdSearch .hf-sel', []],
  ['לחצן סינון', '#hfBar .hf-t', '#bdSearch .hf-t', []],
  ['אייקון סינון', '#hfBar .hf-t>svg.ic', '#bdSearch .hf-t>svg.ic', []],
  ['תווית סינון', '#hfBar .hf-lbl', '#bdSearch .hf-lbl', []],
  ['חץ סינון', '#hfBar .hf-chv', '#bdSearch .hf-chv', []],
];
const HF_OPEN = [
  ['חלונית', '#hfBar .hf-p', '#bdSearch .hf-p', ['height']],
  ['שורת "הכל"', '#hfBar .hf-all', '#bdSearch .hf-all', []],
  ['לחצן "הכל"', '#hfBar .hf-allb', '#bdSearch .hf-allb', []],
  ['רשימה', '#hfBar .hf-l', '#bdSearch .hf-l', ['height']],
  ['אפשרות', '#hfBar .hf-o', '#bdSearch .hf-o', []],
  ['תיבת סימון', '#hfBar .hf-ck', '#bdSearch .hf-ck', []],
  ['אייקון אפשרות', '#hfBar .hf-oi', '#bdSearch .hf-oi', []],
  ['תווית אפשרות', '#hfBar .hf-ol', '#bdSearch .hf-ol', []],
  ['מונה אפשרות', '#hfBar .hf-oc', '#bdSearch .hf-oc', []],
];
// הבדלים מוסברים: [שם רכיב, מאפיין, סיבה]
const EXPECTED = [
  ['החודש הנוכחי', 'height', 'S04: בגובה מתג התצוגה (28px) ולא 44px'],
  ['החודש הנוכחי', 'padding', 'S04: ריפוד הגלולה הנמוכה'],
  ['החודש הנוכחי', 'fontSize', 'S04: גלולה נמוכה - 14px'],
  ['החודש הנוכחי', 'lineHeight', 'S04: גלולה נמוכה'],
  ['סרגל החודש הנוכחי + מתג', 'height', 'S04: הסרגל נמוך יותר כי הלחצן בגובה המתג'],
  ['מונה שלב', 'backgroundColor', 'S02: כל המונים באותו גוון (בעיצוב צבע לכל שלב)'],
  ['תא יום', 'boxShadow', 'מצב ריחוף בזמן הצילום (הסמן)'],
  // שכבת הסקירה של העיצוב (לא חלק מהאתר) מצמידה מספר לכל רכיב שנסקר ונותנת לו position:relative
  ...['החודש הנוכחי', 'כותרת הלוח', 'שם החודש', 'מונה שלב', 'מתג תצוגה', 'סימן התראה', 'תא שבת'].map((n) => [n, 'position', 'שכבת הסקירה של העיצוב (מספור הרכיבים)']),
];
const dump = (pairs, side) => (async (p) => p.evaluate((pairs, side, PROPS) => {
  const o = {};
  for (const [name, dSel, rSel, skip] of pairs) {
    const e = document.querySelector(side === 'demo' ? dSel : rSel);
    if (!e) { o[name] = null; continue; }
    const cs = getComputedStyle(e);
    o[name] = Object.fromEntries(PROPS.filter((k) => !skip.includes(k)).map((k) => [k, String(cs[k]).replace(/\s+/g, ' ')]));
  }
  return o;
}, pairs, side, PROPS));
const s = await serve();
const b = await launch();
const p = await b.newPage();
await p.setViewport({ width, height: 900 });
// שכבת הסקירה של העיצוב (לא חלק מהאתר): מסירים את הסרגלים ואת סימוני "קיים רק בדגימה" (rv-so-t: מעומעם + position) ומחכים לסוף
// אנימציות הכניסה של האייקונים (ia-*), אחרת הם נמדדים באמצע (opacity 0)
const clean = async () => { await p.evaluate(() => { document.querySelectorAll('.rvd-bar,[id^=qp],.qp-root,#rvSet').forEach((x) => x.remove()); document.documentElement.classList.remove('rv-dim'); document.querySelectorAll('[class*="rv-so"],[class*="rv-mk"]').forEach((x) => [...x.classList].filter((c) => /^rv-(so|mk)/.test(c)).forEach((c) => x.classList.remove(c))); }); await sleep(1500); };
async function demoBoard() {
  await p.goto(DEMO, { waitUntil: 'load' }); await sleep(1800); await clean();
  // בעיצוב בנייד הלוח עובר לרשימה; בהשוואה - תמיד לוח
  await p.evaluate(() => { const g = document.querySelectorAll('#mvsw .vopt')[0]; if (g) g.click(); });
  await sleep(400); await p.mouse.move(2, 2);
  return dump(BOARD, 'demo')(p);
}
async function realBoard() {
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' }); await sleep(1500);
  await p.evaluate(() => { const g = document.querySelectorAll('#mvsw .vopt')[0]; if (g) g.click(); });
  await sleep(400); await p.mouse.move(2, 2);
  return dump(BOARD, 'real')(p);
}
async function demoHf(open) {
  await p.goto(DEMO_OC, { waitUntil: 'load' }); await sleep(1500);
  await p.evaluate(() => { const t = [...document.querySelectorAll('button,a,[role=tab]')].find((x) => /היסטוריה/.test(x.textContent || '') && x.offsetParent); if (t) t.click(); });
  await sleep(700); await p.evaluate(() => document.querySelector('#hfBar').scrollIntoView({ block: 'start' })); await sleep(1500);
  await p.mouse.move(2, 2);
  if (open) { await p.evaluate(() => document.querySelector('#hfBar .hf-t').click()); await sleep(600); await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(300); }
  return dump(open ? HF_OPEN : HF, 'demo')(p);
}
async function realHf(open) {
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' }); await sleep(1500);
  await p.mouse.move(2, 2);
  if (open) { await p.evaluate(() => document.querySelector('#bdSearch .hf-t').click()); await sleep(600); await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(300); }
  return dump(open ? HF_OPEN : HF, 'real')(p);
}
let unexplained = 0;
function compare(title, d, r) {
  console.log(`\n== ${title} (${width})`);
  for (const name of Object.keys(d)) {
    if (!d[name] || !r[name]) { console.log(`  [${!d[name] ? 'אין בעיצוב' : 'אין בדף'}] ${name}`); if (!r[name]) unexplained++; continue; }
    for (const k of Object.keys(d[name])) {
      if (d[name][k] === r[name][k]) continue;
      const exp = EXPECTED.find((x) => x[0] === name && x[1] === k);
      if (!exp) unexplained++;
      console.log(`  ${exp ? 'OK-EXPECTED' : 'DIFF'} ${name} [${k}] עיצוב=${d[name][k]}  דף=${r[name][k]}${exp ? '  (' + exp[2] + ')' : ''}`);
    }
  }
}
compare('לוח', await demoBoard(), await realBoard());
compare('שורת חיפוש + סינון (סגור)', await demoHf(false), await realHf(false));
compare('סינון פתוח', await demoHf(true), await realHf(true));
console.log(`\nלא מוסברים: ${unexplained}`);
await b.close(); s.close();
process.exit(unexplained ? 1 : 0);
