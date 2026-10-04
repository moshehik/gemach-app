// משווה את ה-computed style של הסקיצה (demo) לחלון האמיתי (real) לפי מצב ו-selector; מדפיס רק הבדלים. TOTAL 0 = זהה.
// בנוסף: מיקום כפתור הסגירה (X) - תמיד בקצה הימני של הכותרת, באותו מרחק מהקצה כמו בסקיצה.
import fs from 'node:fs';
import { OUT } from './lib.mjs';
const w = process.argv[2] || '1280';
const d = JSON.parse(fs.readFileSync(`${OUT}/demo-${w}.json`, 'utf8'));
const r = JSON.parse(fs.readFileSync(`${OUT}/real-${w}.json`, 'utf8'));
const F = (process.env.FIELDS || 'bg,bi,bf,col,bd,bs,rad,op,ff,fs,pad').split(',');
const skip = (x) => /\.er3-mw|\.er3-menu|\.menu\b/.test(x.sel); // תפריט ⋯ של הסקיצה - בוטל בהוראת הבעלים (במקומו .er3-acts)
const group = (arr) => { const m = new Map(); for (const x of arr.filter((x) => !skip(x))) { if (!m.has(x.sel)) m.set(x.sel, []); m.get(x.sel).push(x); } return m; };
// הבדלים מכוונים (הוראות הבעלים 4.10.2026 / תוכן אמיתי במקום ציורי הדמו / רגע שונה באנימציה) - נספרים בנפרד, לא כהבדל
const EXPECTED = [
  [/er3-bh>b \[col\]/, 'שמות בזהב (הוראת בעלים)'],
  [/er3-acts/, 'כפתורים עגולים כחולים במקום תפריט ⋯ (הוראת בעלים)'],
  [/er3-hum|er-human/, '"מענה אנושי" בגוף השיחה (הוראת בעלים)'],
  [/er3-steps|details\.er-stp-b|er-stp-b>summary|er-stp-b>pre|summary>svg\.ia-check|summary>button|div\.er-stp-b|er-stp-h/, 'הצעדים לא מוצגים למדווח (הוראת בעלים)'],
  [/er-ei|div\.er-elt|er-shot|btn\.lg\.primary|img\.er-elt|er-lbshot|img\.er-lbimg/, 'צילום אמיתי במקום הציור הסכמטי של הדמו'],
  [/^\s*\(demo-only\) #toast|^\s*\(real-only\) #toast|#toast \[op\]|#toast>div\.tb>svg/, 'טוסט חולף - רגע שונה'],
  [/ibtn\.mx>svg\.ia-(ov\.ia-)?x\.ic\.sm$/, 'ia-ov על X של התצוגה הגדולה: בסקיצה נוסף או לא לפי תזמון (משתנה בין הרצות)'],
  [/span\.rd \[bs\]|er-mark \[bs\]|er3-r \[bs\]|ashield>svg[^\[]*\[(w|h)\]|svg\.ia-in/, 'רגע שונה באנימציה'],
];
const expectedOf = (l) => (EXPECTED.find(([re]) => re.test(l)) || [])[1];
let total = 0;
let expectedTotal = 0;
const reasons = {};
for (const st of Object.keys(d)) {
  const dm = group(d[st]); const rm = group(r[st] || []);
  const lines = [];
  for (const [s, dv] of dm) {
    const rv = rm.get(s); if (!rv) { lines.push(`  (demo-only) ${s}`); continue; }
    // גודל האייקונים (svg) - גם הוא חלק מהעיצוב. (רוחב פס הגלילה נבדק ב-interact.mjs מתוך כללי ה-CSS: ב-headless הפס הוא overlay ו-offsetWidth-clientWidth = 0)
    for (const f of [...F, ...(/svg/.test(s) ? ['w', 'h'] : [])]) {
      const a = [...new Set(dv.map((x) => x[f] || ''))].sort(); const b = [...new Set(rv.map((x) => x[f] || ''))].sort();
      if (a.join('|') !== b.join('|')) lines.push(`  ${s} [${f}] demo=${a.join(' ; ') || '-'}   real=${b.join(' ; ') || '-'}`);
    }
  }
  for (const [s] of rm) if (!dm.has(s)) lines.push(`  (real-only) ${s}`);
  // X: מרחק מהקצה הימני של החלון
  const xr = (arr) => { const x = (arr || []).find((e) => /er-x0/.test(e.sel)); const dlg = (arr || []).find((e) => /^#(erPop|erBig|scrim)>div\.dlg/.test(e.sel) && !/>.*>/.test(e.sel)); return x && dlg ? (dlg.x + dlg.w) - (x.x + x.w) : null; };
  const xd = xr(d[st]); const xrl = xr(r[st]);
  if (xd !== null || xrl !== null) { if (xd !== xrl) lines.push(`  [X offset from right edge] demo=${xd} real=${xrl}`); }
  const real = lines.filter((l) => !expectedOf(l));
  const exp = lines.filter((l) => expectedOf(l));
  for (const l of exp) reasons[expectedOf(l)] = (reasons[expectedOf(l)] || 0) + 1;
  total += real.length; expectedTotal += exp.length;
  console.log(`== ${st} (${real.length}${exp.length ? ` + ${exp.length} expected` : ''})`); real.forEach((l) => console.log(l.slice(0, 400)));
  if (process.env.SHOW_EXPECTED) exp.forEach((l) => console.log('  [expected: ' + expectedOf(l) + ']' + l.slice(0, 300)));
}
console.log('EXPECTED', expectedTotal, JSON.stringify(reasons));
console.log('TOTAL', total);
