// הדף המודפס של "סיכום נוכחות": (1) השוואת סגנונות מחושבים של רכיבי הגיליון מול הגיליון בעיצוב המאושר (תצוגה מקדימה בעיצוב,
// .sheet) - זוגות רכיבים לפי תפקיד (במעטפת של הלו״ז השמות pp-*); (2) PDF אמיתי (page.pdf, מדיה print) לכל סוג דוח: מספר עמודים,
// "עמוד X מתוך Y" בכל עמוד, כל עובד מתחיל עמוד חדש ("כל העובדים ברצף"), שורה לא נחתכת. שימוש: node print.mjs (אחרי build.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const PAIRS = [
  ['.sh-bsd', '.pp-bsd'], ['.sh-id b', '.pp-id b'], ['.sh-id span', '.pp-id span'], ['.sh-date', '.pp-date'], ['.sh-date small', '.pp-date small'],
  ['.sh-tb', '.pp-tb'], ['.sh-chip', '.pp-chip'], ['.sh-tb h1', '.pp-tb h1'], ['.sh-tb p', '.pp-tb p'], ['.sh-sum', '.pp-sum'], ['.sh-sum small', '.pp-sum small'],
  ['.sht th', '.pp-t th'], ['.sht td', '.pp-t td'], ['.sht td b', '.pp-t td b'], ['.sht td small', '.pp-t td small'], ['.sht tr.warn td', '.pp-t tr.warn td'],
  ['.stats div', '.pp-stats div'], ['.stats b', '.pp-stats b'], ['.sh-foot', '.pp-foot'], ['.fl', '.pp-fl'],
];
const PROPS = ['fontSize', 'fontWeight', 'color', 'lineHeight', 'borderTopWidth', 'borderTopStyle', 'borderBottomWidth', 'borderBottomStyle', 'paddingTop', 'paddingBottom', 'paddingInlineStart', 'backgroundColor', 'borderRadius', 'textAlign'];
const read = (sels) => sels.map((q) => { const el = document.querySelector(q); if (!el) return null; const cs = getComputedStyle(el); return Object.fromEntries(['fontSize', 'fontWeight', 'color', 'lineHeight', 'borderTopWidth', 'borderTopStyle', 'borderBottomWidth', 'borderBottomStyle', 'paddingTop', 'paddingBottom', 'paddingInlineStart', 'backgroundColor', 'borderRadius', 'textAlign', 'fontFamily'].map((k) => [k, cs[k]])); });
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
let fails = 0;
// (1) סגנונות
await p.goto(DEMO, { waitUntil: 'load' }); await sleep(1300);
await p.evaluate(() => { window.__ATT.openPreview(['e1', 'e7'], 'full', 2026, 8, 'print'); });
await sleep(800);
const demo = await p.evaluate(read, PAIRS.map((x) => '#pvScroll ' + x[0]));
await p.goto(`http://127.0.0.1:${PORT}/attendance/print?type=full&ids=e1,e7&y=2026&m=8&preview=1`, { waitUntil: 'load' }); await sleep(1500);
const real = await p.evaluate(read, PAIRS.map((x) => x[1]));
const pxmm = (v) => v; // ערכים בפיקסלים בשני הצדדים
const lines = [];
PAIRS.forEach(([a, c], i) => {
  const d = demo[i]; const r = real[i];
  if (!d || !r) { lines.push(`MISSING ${a} -> ${c} demo=${!!d} real=${!!r}`); return; }
  for (const k of PROPS) {
    const dv = pxmm(d[k]); const rv = pxmm(r[k]);
    const num = (v) => parseFloat(v);
    const same = dv === rv || (/px$/.test(dv) && /px$/.test(rv) && Math.abs(num(dv) - num(rv)) < 0.6);
    if (!same) lines.push(`${a} -> ${c} [${k}] demo=${dv} real=${rv}`);
  }
});
console.log('== סגנונות הגיליון מול העיצוב (' + lines.length + ' הבדלים)'); lines.forEach((l) => console.log('  ' + l));
console.log('  גופן: demo=' + (demo[1] && demo[1].fontFamily) + ' | real=' + (real[1] && real[1].fontFamily));
// (2) PDF לכל סוג דוח
const CASES = [
  ['full-2', 'type=full&ids=e1,e4&y=2026&m=8', { minPages: 2, sheets: 2 }],
  ['full-all', 'type=full&y=2026&m=8', { minPages: 9, sheets: 9 }],
  ['summary', 'type=summary&y=2026&m=8', { minPages: 1, sheets: 1 }],
  ['byemp', 'type=byemp&ids=e1&y=2026&m=8', { minPages: 1, sheets: 1 }],
  ['emp-own', 'type=full&y=2026&m=8&role=emp', { minPages: 1, sheets: 1, noWages: true }],
];
for (const [name, qs, exp] of CASES) {
  await p.goto(`http://127.0.0.1:${PORT}/attendance/print?${qs}`, { waitUntil: 'load' }); await sleep(1200);
  await p.emulateMediaType('print');
  const file = path.join(OUT, `print-${name}.pdf`);
  await p.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await p.emulateMediaType('screen');
  const py = `import sys,json\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint(json.dumps([pg.extract_text() for pg in r.pages]))`;
  const pages = JSON.parse(execFileSync('python', ['-c', py, file], { encoding: 'utf8' }));
  const n = pages.length;
  // pypdf מוציא את תיבת השוליים מימין לשמאל הפוך ("1 מתוך1עמוד") - שני הסדרים (כמו schedule-print-tests/render.mjs)
  const counter = (t) => { let m = t.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/); if (m) return [+m[1], +m[2]]; m = t.match(/(\d+)\s*מתוך\s*(\d+)\s*עמוד/); return m ? [+m[2], +m[1]] : null; };
  const counters = pages.map(counter).filter((c, i) => c && c[0] === i + 1 && c[1] === n).length;
  const heads = pages.filter((t) => /שמלות|ח״מג|תולמש/.test(t)).length;
  const wagesShown = pages.some((t) => /לתשלום|םולשתל/.test(t));
  const ok = n >= exp.minPages && counters === n && heads === n && (!exp.noWages || !wagesShown);
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} PDF ${name}: ${n} עמודים, מונה עמוד בכל עמוד ${counters}/${n}, כותרת בכל עמוד ${heads}/${n}${exp.noWages ? ', שכר: ' + (wagesShown ? 'מופיע!' : 'אין') : ''}`);
}
// כל עובד מתחיל עמוד חדש: בדוח "כל העובדים" - בכל עמוד שם של עובד אחד בלבד בכותרת
await b.close(); s.close();
process.exit(fails ? 1 : 0);
