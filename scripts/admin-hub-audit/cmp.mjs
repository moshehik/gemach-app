// משווה את ה-computed style של העיצוב (demo, ניהול-ראשי-כרטיסים.html) למסך הניהול האמיתי (real) לפי מצב ו-selector; מדפיס רק הבדלים. FIELDS=bg,col,... לצמצום. הבדלי w/h נובעים מתוכן שונה (בעיצוב יש כלים שהוסרו ואין הרשאות).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const w = process.argv[2] || '1280';
const d = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}.json`), 'utf8'));
const r = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}.json`), 'utf8'));
const F = (process.env.FIELDS || 'bg,bi,bf,col,bd,bs,rad,op,ff,fs,pad,mar,gap,disp,td,h,w').split(',');
// לא נבדק: סרגל ההדגמה של העיצוב, חיצי המיון בטבלה (רק בדף האמיתי), אנימציות כניסה
const skip = (x) => /.demo/.test(x.sel);
const group = (arr) => { const m = new Map(); for (const x of arr.filter((x) => !skip(x))) { if (!m.has(x.sel)) m.set(x.sel, []); m.get(x.sel).push(x); } return m; };
let total = 0;
for (const st of Object.keys(d)) {
  const dm = group(d[st]), rm = group(r[st] || []);
  const lines = [];
  for (const [s, dv] of dm) {
    const rv = rm.get(s); if (!rv) { lines.push(`  (demo-only) ${s}`); continue; }
    for (const f of F) {
      const a = [...new Set(dv.map((x) => x[f] || ''))].sort(), b = [...new Set(rv.map((x) => x[f] || ''))].sort();
      if (a.join('|') !== b.join('|')) lines.push(`  ${s} [${f}] demo=${a.join(' ; ') || '-'}   real=${b.join(' ; ') || '-'}`);
    }
  }
  for (const [s, rv] of rm) if (!dm.has(s)) { const x = rv[0]; if (x.bg || x.bi || x.bf || x.bd) lines.push(`  (real-only element) ${s} bg=${x.bg} bi=${x.bi} bd=${x.bd}`); }
  total += lines.length;
  console.log(`== ${st} (${lines.length})`); lines.forEach((l) => console.log(l.slice(0, 380)));
}
console.log('TOTAL', total);
