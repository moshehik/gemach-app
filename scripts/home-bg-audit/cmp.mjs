import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const w = process.argv[2] || '1280', th = process.argv[3] || 'light', only = process.argv[4];
const rd = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) : {}); // "stages.mjs ... float" כותב רק את קובץ ה-float
const d = rd(`demo-${w}-${th}.json`);
const r = rd(`real-${w}-${th}.json`);
const F = ['bg', 'bi', 'bf', 'col', 'bd', 'bs', 'rad', 'op'];
const skip = (x) => /pv-|site-foot|sf-|\.demo|snav|nbArea|aiw|\bcalc\b|cdy|dph|dpf|dpw|calb|dpg/.test(x.sel);
const group = (arr) => { const m = new Map(); for (const x of arr.filter((x) => !skip(x))) { const k = x.sel; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
let total = 0;
for (const st of Object.keys(d)) {
  if (only && !st.startsWith(only)) continue;
  const dm = group(d[st]), rm = group(r[st] || []);
  const lines = [];
  for (const [s, dv] of dm) {
    const rv = rm.get(s); if (!rv) continue; // structural difference, not style
    // compare distinct value-sets per field
    for (const f of F) {
      const a = [...new Set(dv.map((x) => x[f] || ''))].sort(), b = [...new Set(rv.map((x) => x[f] || ''))].sort();
      if (a.join('|') !== b.join('|')) lines.push(`  ${s} [${f}] demo=${a.join(' ; ') || '-'}   real=${b.join(' ; ') || '-'}`);
    }
  }
  for (const [s, rv] of rm) if (!dm.has(s)) { const x = rv[0]; if (x.bg || x.bi || x.bf) lines.push(`  (real-only element) ${s} bg=${x.bg} bi=${x.bi} bf=${x.bf}`); }
  total += lines.length;
  console.log(`== ${st} (${lines.length})`); lines.forEach((l) => console.log(l.slice(0, 380)));
}
// סדר שורת החיפוש (RTL: מימין לשמאל; בשורה אחת לפי y). מושווה בין העיצוב לדף האמיתי.
try {
  const ld = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}-${th}-layout.json`), 'utf8'));
  const lr = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}-${th}-layout.json`), 'utf8'));
  const seq = (a) => { const rows = {}; for (const i of a || []) (rows[Math.round(i.y / 40)] ||= []).push(i); return Object.values(rows).map((r) => r.sort((p, q) => q.x - p.x).map((i) => i.k.replace('mode:', '')).join(' > ')).join('  |  '); };
  console.log('== RTL layout order (right to left)');
  for (const st of Object.keys(ld)) { const a = seq(ld[st]), b = seq(lr[st]); if (a || b) console.log(`  ${a === b ? 'same' : 'DIFF'} ${st}: demo[${a}]${a === b ? '' : ` real[${b}]`}`); if (a !== b) total++; }
} catch { console.log('(no layout data)'); }
// 36-37: הכותרת הצפה של החיפוש החכם (stages.mjs, FLOAT) - מצב/מיקום ביחס לסרגל ולכותרת הכרטיס, לכל נקודת גלילה
try {
  const fd = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}-${th}-float.json`), 'utf8'));
  const fr = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}-${th}-float.json`), 'utf8'));
  const KEYS = ['on', 'op', 'vis', 'tf', 'pos', 'z', 'pe', 'h', 'leftOff', 'rightOff', 'wDiff', 'pad', 'rad', 'bi', 'bf', 'bd', 'wrap', 'underBody', 'h2', 'kids'];
  for (const st of Object.keys(fd)) {
    const lines = [];
    for (const pt of Object.keys(fd[st])) {
      const a = fd[st][pt] || {}, b = (fr[st] || {})[pt] || {};
      if (!a.bar && a.bar !== undefined && !b.bar && b.bar !== undefined) continue;
      for (const k of [...KEYS, ...(a.on ? ['topRel'] : [])]) { const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]); if (x !== y) lines.push(`  ${pt} [${k}] demo=${x} real=${y}`); }
    }
    total += lines.length;
    console.log(`== ${st} (${lines.length})`); lines.forEach((l) => console.log(l.slice(0, 380)));
  }
} catch (e) { console.log('(no float data)', e.message); }
// 38: ה-X בשורת שאלת ההמשך (stages.mjs, FLOAT): ריק = אין X; הקלדה = X; לחיצה = ריק + נעלם + פוקוס חוזר לשדה. הציפייה (מחייבת, לא רק השוואה לדמו - הדמו עצמו מציג X בשדה ריק):
try {
  const r = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}-${th}-fuclear.json`), 'utf8'));
  const want = { empty: false, typed: true, afterClear: false, typedThenErased: false };
  const bad = Object.entries(want).filter(([k, v]) => r[k].shown !== v || (k !== 'typed' && r[k].value !== '') || (k === 'typed' && r[k].value === ''));
  if (r.focusAfterClear !== 'fuQ') bad.push(['focusAfterClear', r.focusAfterClear]);
  total += bad.length;
  console.log(`== 38-followup-clear-x (${bad.length})`); bad.forEach(([k, v]) => console.log('  FAIL', k, JSON.stringify(v)));
} catch (e) { console.log('(no fuclear data)', e.message); }
console.log('TOTAL', total);
