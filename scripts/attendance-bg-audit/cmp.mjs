// משווה את ה-computed style של העיצוב (demo) לדף האמיתי (real) לפי מצב ו-selector; מדפיס רק הבדלים. TOTAL 0 = זהה.
// שימוש: node cmp.mjs [רוחב=1280] [מצב]   (אחרי stages.mjs demo/real)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const w = process.argv[2] || '1280';
const only = process.argv[3] || '';
const d = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}.json`), 'utf8'));
const r = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}.json`), 'utf8'));
const F = ['bg', 'bi', 'bf', 'col', 'bd', 'bs', 'rad', 'op', 'ff', 'fs', 'pad', 'h', 'w'];
const group = (arr) => { const m = new Map(); for (const x of arr) { if (!m.has(x.sel)) m.set(x.sel, []); m.get(x.sel).push(x); } return m; };
let total = 0;
for (const st of Object.keys(d)) {
  if (only && !st.includes(only)) continue;
  const dm = group(d[st]); const rm = group(r[st] || []);
  const lines = [];
  for (const [s, dv] of dm) {
    const rv = rm.get(s); if (!rv) { lines.push(`  (demo-only) ${s}  "${dv[0].txt}"`); continue; }
    for (const f of F) {
      const a = [...new Set(dv.map((x) => x[f] || ''))].sort(); const b = [...new Set(rv.map((x) => x[f] || ''))].sort();
      if (a.join('|') !== b.join('|')) lines.push(`  ${s} [${f}] demo=${a.join(' ; ').slice(0, 160) || '-'}   real=${b.join(' ; ').slice(0, 160) || '-'}`);
    }
  }
  for (const [s, rv] of rm) if (!dm.has(s)) lines.push(`  (real-only) ${s}  "${rv[0].txt}"`);
  total += lines.length;
  console.log(`== ${st} (${lines.length})`); lines.forEach((l) => console.log(l.slice(0, 400)));
}
console.log('TOTAL', total);
