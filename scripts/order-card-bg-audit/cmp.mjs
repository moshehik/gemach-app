// משווה את ה-computed style של העיצוב (demo) לדף האמיתי (real) לפי מצב ו-selector; מדפיס רק הבדלים. TOTAL 0 = זהה.
// (כמו scripts/profile-bg-audit/cmp.mjs). שלבים שקיימים רק בצד אחד לא נבדקים. APPROVED = חריגים מאושרים (מתועדים ב-W1-NOTES).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const w = process.argv[2] || '1280';
const d = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}.json`), 'utf8'));
const r = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}.json`), 'utf8'));
const F = ['bg', 'bi', 'bf', 'col', 'bd', 'bs', 'rad', 'op', 'ff', 'fs', 'pad', 'h', 'w'];
// הבדלים מותרים: [regex על "selector [field]", סיבה]
const APPROVED = [
  [/^DLG2?>.*\[(h|w)\]$/, 'גובה/רוחב גוף החלון תלוי בטקסט (נוסח אמיתי מול נוסח הדגמה)'],
  [/^TOAST>.*\[(h|w)\]$|^TOAST \[(h|w)\]$/, 'רוחב הטוסט תלוי בטקסט'],
  [/^DLG2? \[(h|w)\]$/, 'גובה החלון תלוי בטקסט'],
  [/^TOP>div\.sbar/, 'שורת הסריקה R42 - slot של W3 (OcScanBar); W8 מוסיף את השלב שלה'],
  [/^TOP \[h\]$/, 'גובה שורת הכותרת במסך צר כולל את שורת הסריקה (W3) כשורה מלאה'],
  [/^DLG2?>div\.dbtns \[(bi|pad)\]$/, 'במסך צר שורת הלחצנים האחרונה נדבקת לתחתית (:last-child); בעיצוב שכבת הסקירה (pv-line) באה אחריה ומבטלת את זה'],
];
// גובה/רוחב: עיגול תת-פיקסל (±1px) אינו הבדל
const near = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(Number(x) - Number(b[i])) <= 1);
// הבדלים מאושרים לשלב מסוים בלבד: [שלב, regex, סיבה]
const APPROVED_STAGE = [
  ['10-conflict', /^DLG>div\.dbtns>button\.block\.btn\.ghost/, 'R12: לחצן שלישי "חזרה לעריכה" (החלטת הבעלים: 3 בחירות; בעיצוב רק 2)'],
  // W6: R40 (הוסר בהחלטת הבעלים) - הכרטיס "בוצעה על ידי" + "עובדים פעילים בהזמנה" בראש לשונית ההיסטוריה של העיצוב; המידע עבר ליומן (A20)
  ...['40', '41', '42', '43', '44', '45', '46', '47', '48'].flatMap((n) => [
    [n, /^HIST>div\.card(>|$)|^HIST>div\.(list|li)>/, 'R40: כרטיס "בוצעה על ידי" הוסר (בעיצוב עדיין מוצג)'],
    [n, /^HIST \[h\]$/, 'R40: גובה הלשונית קטן בגובה הכרטיס שהוסר'],
  ]),
  ['42', /^HIST>(thead|tbody|tr)>.* \[w\]$/, 'רוחבי עמודות הטבלה לפי הטקסט (בעיצוב תאריך לועזי 8.10.2026 בשורת "נקבע תאריך האירוע"; אצלנו עברי)'],
  ['41', /^HIST>div\.li\.lrow\.rlink>div\.ic-b>svg\.ic \[(w|h)\]$/, 'אנימציית ריחוף של האייקון בעיצוב (ia-h) באמצע המעבר'],
  ['43', /^TOAST/, 'העיצוב משאיר טוסט מהדגמה שלו (לא חלק מההיסטוריה); בצילום אין טוסט'],
  ['46', /^RT(>div\.rr1(>span)?)? \[w\]$/, 'AMB-18: אין שם משמרת במודל - "משמרת · 08:00–16:00" במקום "משמרת בוקר · 08:00–16:00"'],
  ['10-conflict', /^TOP>button\.back \[op\]$/, 'סקירה 4: החץ מנוטרל בזמן שמירה רצה (החלון נפתח באמצע השמירה)'],
  ['11-stock', /^TOP>button\.back \[op\]$/, 'סקירה 4: החץ מנוטרל בזמן שמירה רצה (החלון נפתח באמצע השמירה)'],
];
const approved = (line, st) => APPROVED.some(([re]) => re.test(line)) || APPROVED_STAGE.some(([s2, re]) => (s2 === st || st.startsWith(s2 + '-')) && re.test(line));
const group = (arr) => { const m = new Map(); for (const x of arr) { if (!m.has(x.sel)) m.set(x.sel, []); m.get(x.sel).push(x); } return m; };
let total = 0, skipped = 0;
for (const st of Object.keys(d)) {
  if (!r[st]) { console.log(`== ${st}: אין בדף האמיתי`); continue; }
  const dm = group(d[st]), rm = group(r[st]);
  const lines = [];
  for (const [s, dv] of dm) {
    const rv = rm.get(s); if (!rv) { if (approved(s, st)) { skipped++; continue; } lines.push(`  (demo-only) ${s}`); continue; }
    for (const f of F) {
      const a = [...new Set(dv.map((x) => x[f] || ''))].sort(), b = [...new Set(rv.map((x) => x[f] || ''))].sort();
      if (a.join('|') !== b.join('|') && !((f === 'h' || f === 'w') && near(a.map(Number).sort((x, y) => x - y), b.map(Number).sort((x, y) => x - y)))) {
        const key = `${s} [${f}]`;
        if (approved(key, st)) { skipped++; continue; }
        lines.push(`  ${key} demo=${a.join(' ; ') || '-'}   real=${b.join(' ; ') || '-'}`);
      }
    }
  }
  for (const [s, rv] of rm) if (!dm.has(s)) { if (approved(s, st)) { skipped++; continue; } const x = rv[0]; lines.push(`  (real-only) ${s} bg=${x.bg} bi=${x.bi} bd=${x.bd}`); }
  total += lines.length;
  console.log(`== ${st} (${lines.length})`); lines.forEach((l) => console.log(l.slice(0, 400)));
}
console.log(`approved-skips ${skipped}`);
console.log('TOTAL', total);
