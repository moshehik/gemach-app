// משווה את ה-computed style של העיצוב מול הדף האמיתי לכל מצב, ומדפיס רק הבדלים + רכיבים שקיימים רק בצד אחד (מבנה).
// שימוש: node cmp.mjs [רוחב=1280] [תחילית-מצב]   | פלט גם ל-out/report-<רוחב>.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const w = process.argv[2] || '1280', only = process.argv[3];
const d = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}.json`), 'utf8'));
const r = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}.json`), 'utf8'));
const F = ['bg', 'bi', 'bf', 'col', 'bd', 'bs', 'rad', 'op', 'ff', 'fs', 'fw', 'pad', 'cur', 'tr', 'ht'];
// רכיבים שאינם חלק מהעיצוב המאושר של הדף עצמו (שכבת הסקירה, ההדמיה) או שתוכנם שונה מראש (טקסט חופשי בשורה)
const skip = (x) => /(^|>)(\.demo|\.sbar\.inpw|\.rv-)/.test(x.sel);
const group = (arr) => { const m = new Map(); for (const x of (arr || []).filter((x) => !skip(x))) { if (!m.has(x.sel)) m.set(x.sel, []); m.get(x.sel).push(x); } return m; };
let total = 0, structural = 0;
const md = [`# הבדלי עיצוב: לוז-יומי.html מול /schedule (רוחב ${w})`, '', 'כל שורה = רכיב (מחלקות + אבות) שקיים בשני הצדדים ומאפיין אחד שלו שונה. "חסר בדף" = רכיב שיש בעיצוב ואין בדף; "רק בדף" = ההפך.', ''];
for (const st of Object.keys(d)) {
  if (only && !st.startsWith(only)) continue;
  const dm = group(d[st]), rm = group(r[st] || []);
  const lines = [];
  for (const [s, dv] of dm) {
    const rv = rm.get(s); if (!rv) continue;
    for (const f of F) {
      const a = [...new Set(dv.map((x) => x[f] || ''))].sort(), b = [...new Set(rv.map((x) => x[f] || ''))].sort();
      if (a.join('|') !== b.join('|')) lines.push(`  ${s} [${f}] demo=${a.join(' ; ') || '-'}   real=${b.join(' ; ') || '-'}`);
    }
  }
  const missing = [...dm.keys()].filter((s) => !rm.has(s));
  const extra = [...rm.keys()].filter((s) => !dm.has(s));
  total += lines.length; structural += missing.length + extra.length;
  console.log(`== ${st}: ${lines.length} style diffs, ${missing.length} missing in real, ${extra.length} real-only`);
  lines.forEach((l) => console.log(l.slice(0, 400)));
  if (missing.length) console.log('  חסר בדף: ' + missing.join('  |  '));
  if (extra.length) console.log('  רק בדף:  ' + extra.join('  |  '));
  md.push(`## ${st}`, '', `הבדלי סגנון: ${lines.length} · חסר בדף: ${missing.length} · רק בדף: ${extra.length}`, '');
  if (lines.length) md.push('```', ...lines.map((l) => l.trim().slice(0, 300)), '```', '');
  if (missing.length) md.push('- חסר בדף: `' + missing.join('` · `') + '`');
  if (extra.length) md.push('- רק בדף: `' + extra.join('` · `') + '`');
  md.push('');
}
// יישור ו-RTL: נקודות ציון (ימין/שמאל) בעיצוב מול הדף - אותו רוחב חלון, אותו מצב
try {
  const ld = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}-layout.json`), 'utf8'));
  const lr = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}-layout.json`), 'utf8'));
  console.log('== layout (right edge / left edge / width, t=top), demo -> real');
  md.push('## יישור ו-RTL (קצה ימין / קצה שמאל / רוחב): עיצוב ← דף', '');
  for (const st of ['01-today', '12-table', '14-date-hover', '18-past-late']) {
    if (!ld[st] || !lr[st]) continue;
    const A = Object.fromEntries(ld[st].map((i) => [i.k, i])), B = Object.fromEntries(lr[st].map((i) => [i.k, i]));
    const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])];
    const rows = keys.map((k) => { const a = A[k], b = B[k]; const fmt = (i) => (i ? `${i.r}/${i.l}/${i.w} t${i.t}` : '—'); const same = a && b && Math.abs(a.r - b.r) <= 2 && Math.abs(a.l - b.l) <= 2; return `${same ? 'same' : 'DIFF'} ${k}: ${fmt(a)} -> ${fmt(b)}`; });
    console.log('  [' + st + ']'); rows.forEach((x) => console.log('   ' + x));
    md.push(`### ${st}`, '', '```', ...rows, '```', '');
  }
} catch (e) { console.log('(no layout data)', e.message); }
console.log('TOTAL style diffs', total, '| structural', structural);
md.push(`**סה"כ הבדלי סגנון: ${total} · הבדלי מבנה: ${structural}**`);
fs.writeFileSync(path.join(OUT, `report-${w}.md`), md.join('\n'));
