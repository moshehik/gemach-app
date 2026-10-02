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
// אותו רכיב עם מחלקת עיצוב נוספת בדף (טקסט המצב הריק, השלד בטעינה) - מושווים כאותו רכיב ולא נספרים כהבדל מבנה
const ALIAS = [[/\.lz-empty-t\b/g, 'div'], [/\.lz-st\.lz-sk\b/g, '.lz-st']];
const norm = (x) => { let k = x.sel; for (const [re, to] of ALIAS) k = k.replace(re, to); return k === x.sel ? x : { ...x, sel: k }; };
const group = (arr) => { const m = new Map(); for (const x of (arr || []).filter((x) => !skip(x)).map(norm)) { if (!m.has(x.sel)) m.set(x.sel, []); m.get(x.sel).push(x); } return m; };
// סיווג כנה של כל הבדל (סקירה: "0 הבדלים אמיתיים" היה מוגזם - רוב ההבדלים הגולמיים היו רעש מצב/נתונים/סמן).
// REAL = הבדל עיצוב שלא מוסבר; PENDING = חריץ שעוד לא חובר (אשף ההדפסה / הברקוד מתחברים אחרי המיזוג - כבוי, סמן not-allowed);
// NOISE = נתוני ההדמיה שונים (כמה שורות/שלבים ריקים), שלב אנימציה, או גובה חלון שתלוי בתוכן; KNOWN = הבדל מבני מתועד
// (החלטת בעלים / שאלה פתוחה ב-docs/ui-fidelity-schedule.md). כל מה שלא מסווג במפורש = REAL.
const PENDING = [[/xlbtn|\.xlic|\.dlic|\.prtic/, /^cur$/, 'כלי הדפסה/הורדה/XL - האשף עוד לא חובר'], [/\.sbar>\.inpw>\.inp$/, /^cur$/, 'שורת הברקוד - onScan עוד לא חובר']];
const NARROW = Number(w) < 821;
// SHELL = הבדל שנובע מהמעטפת (index.html מדמה את .content של מעטפת A5 עם ריפוד 14px - כך גם בפרודקשן, לא רעש): בצר
// הדף צר ב-28px מהעיצוב, תוויות הציר נשברות/נחתכות. נספר בנפרד, לא כרעש ולא כ-REAL.
const SHELL = [[/\.st-stab\.lz-stab$/, /^ht$/, 'ריפוד .content של מעטפת A5 (14px) - הדף צר יותר מהעיצוב', () => NARROW]];
const NOISE = [
  [/\.topbar>\.ttl>\.pg-ttl$/, /^ht$/, 'העיצוב עצמו שבור ב-375: הכותרת מתכווצת לטור (h1 ברוחב 18px)', () => NARROW],
  [/sn-badge\.lz-rem|\.st-stab|\.st-sic|\.st-stabs/, /^op$/, 'שלב ריק ביום (fut/z) - תלוי בנתוני ההדמיה'],
  [/\.skel/, /^op$/, 'שלב באנימציית הטעינה'],
  [/\.dlg\.lz-cf$/, /^ht$/, 'גובה החלון לפי התוכן (מספר שורות, שורת "מה זה עושה")'],
  [/\.rtbl>tbody>\.lz-r$/, /^bi$/, 'ברק חולף (2.2s) נדגם באמצע המעבר'],
  [/\.lz-act>\.btn\.tgl\.lz-mark$/, /^(bg|col)$/, 'בהדמיה כל השורות ביום שעבר סומנו, בדף יש גם שורות פתוחות', (a, b) => b.length > a.length],
];
const KNOWN = [
  [/\.chip\.st-mid|\.chip\.st-bad/, 'שבבי "N אירועים" / "N התראות" הוסרו - שאלה פתוחה לבעלים'],
  [/lz-dtools>\.ibtn/, 'גלגל ההגדרות (S07) מוסתר עד שיש מסך הגדרות'],
  [/lz-tbtn|\.li\.lrow>div>(b|\.ln)$|\.lz-p\b|\.lz-pn\b/, 'שם + שורת פרטים עטופים בלחצן שפותח את פירוט השורה (היסטוריה 26)'],
  [/lz-late|\.lz-act>\.btn\.tgl\.lz-mark>\.ic\.sm$|\.lz-act>\.chip\.red|\.li\.lrow>\.lz-act>\.chip\.red|sn-badge\.lz-al2|\.chip\.green\.lz-rc/, 'נתוני ההדמיה: שורות באיחור / פתוחות / התראות שאין בנתוני העיצוב לאותו יום'],
  [/\.chip\.st-today/, 'שבב משמרת / שעות איסוף (S08/B13) - לפי נתוני היום'],
  [/\.lz-flag/, 'דגלי הזמנה / "חיוב משלוח קיים" במיקום שאושר (B21/B08)'],
  [/lz-cf-effect/, 'שורת "מה הסימון עושה" בחלון (שלבים 2/8) - מענף הסימונים, נשמרה בכוונה'],
];
const cls = (sel, f, a, b) => {
  for (const [re, fr, why] of PENDING) if (re.test(sel) && fr.test(f)) return ['PENDING', why];
  for (const [re, fr, why, extra] of SHELL) if (re.test(sel) && fr.test(f) && (!extra || extra(a, b))) return ['SHELL', why];
  for (const [re, fr, why, extra] of NOISE) if (re.test(sel) && fr.test(f) && (!extra || extra(a, b))) return ['NOISE', why];
  return ['REAL', ''];
};
const clsStruct = (sel) => {
  if (NARROW && /^\.topbar>\.ttl$/.test(sel)) return ['KNOWN', 'העיצוב עצמו שבור ב-375 (הכותרת יוצאת מ-.ttl)'];
  for (const [re, why] of KNOWN) if (re.test(sel)) return ['KNOWN', why];
  return ['REAL', ''];
};
const tally = { REAL: 0, PENDING: 0, SHELL: 0, NOISE: 0 }, stally = { REAL: 0, KNOWN: 0 }, reasons = new Map(), realLines = [];
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
      if (a.join('|') !== b.join('|')) {
        const [k, why] = cls(s, f, a, b); tally[k]++;
        if (why) reasons.set(k + ': ' + why, (reasons.get(k + ': ' + why) || 0) + 1);
        const line = `  ${k === 'REAL' ? 'REAL ' : k.toLowerCase().padEnd(5)} ${s} [${f}] demo=${a.join(' ; ') || '-'}   real=${b.join(' ; ') || '-'}`;
        lines.push(line); if (k === 'REAL') realLines.push(`[${st}] ${line.trim()}`);
      }
    }
  }
  const missing = [...dm.keys()].filter((s) => !rm.has(s));
  const extra = [...rm.keys()].filter((s) => !dm.has(s));
  total += lines.length; structural += missing.length + extra.length;
  for (const x of [...missing.map((m) => ['חסר בדף', m]), ...extra.map((m) => ['רק בדף', m])]) {
    const [k, why] = clsStruct(x[1]); stally[k]++;
    if (why) reasons.set('KNOWN: ' + why, (reasons.get('KNOWN: ' + why) || 0) + 1); else realLines.push(`[${st}] REAL ${x[0]}: ${x[1]}`);
  }
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
const sum = [`style: REAL ${tally.REAL} · PENDING ${tally.PENDING} · SHELL ${tally.SHELL} · NOISE ${tally.NOISE}`, `structure: REAL ${stally.REAL} · KNOWN ${stally.KNOWN}`];
console.log('== CLASSIFIED', sum.join(' | '));
[...reasons].sort((x, y) => y[1] - x[1]).forEach(([r, n]) => console.log(`   ${String(n).padStart(4)}  ${r}`));
console.log('== REAL (unexplained) differences:'); [...new Set(realLines)].forEach((l) => console.log('   ' + l.slice(0, 300)));
md.push(`**סה"כ הבדלי סגנון: ${total} · הבדלי מבנה: ${structural}**`, '', '## סיווג', '', ...sum.map((x) => '- ' + x), '',
  '| מספר | סיווג וסיבה |', '|---|---|', ...[...reasons].sort((x, y) => y[1] - x[1]).map(([r, n]) => `| ${n} | ${r} |`), '',
  '### REAL - הבדלים שלא מוסברים', '', '```', ...[...new Set(realLines)].map((l) => l.slice(0, 300)), '```');
fs.writeFileSync(path.join(OUT, `report-${w}.md`), md.join('\n'));
