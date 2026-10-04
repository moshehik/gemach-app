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
  ['10-conflict', /^TOP>button\.back \[op\]$/, 'סקירה 4: החץ מנוטרל בזמן שמירה רצה (החלון נפתח באמצע השמירה)'],
  ['11-stock', /^TOP>button\.back \[op\]$/, 'סקירה 4: החץ מנוטרל בזמן שמירה רצה (החלון נפתח באמצע השמירה)'],
  // ===== W2a (scratch/order-card-build/W2a-NOTES.md §5) =====
  ...['30-details', '31-details-calendar', '32-hover-day', '33-abroad'].flatMap((st) => [
    [st, /^DET>div\.(kv>div\.f>div|f>div>small|f>div>b) \[w\]$/, 'רוחב תא בכרטיס הלקוח = רוחב הטקסט (טלפון/מייל אמיתיים מול נתוני ההדגמה)'],
    [st, /^DET \[h\]$|^DET>div\.card\.cust(>div\.kv)? \[h\]$/, 'גובה: בשורת המייל אין "מייל מהיר" (slot של W7, מאחורי order_quick_mail_enabled)'],
    [st, /^DET>details\.coll>div\.in|^DET>div\.in>div>div\.pill\.seg|^DET>div>div\.pill\.seg>(span\.pth|button)/, '"פרטים מתקדמים" בהזמנת נווה בלי enable_rental_extension: אין "יום נוסף", 6 גלולות ציפוף (ברירת מחדל 3); מושווה בשלב 34 עם הגדרות תואמות'],
  ]),
  ['33-abroad', /^DET>div\.hc>div\.hc-g>button\.hc-d \[(bg|col|bs)\]$/, 'מעבר לחו"ל מנקה את תאריך האירוע (כמו הישן, MGD:344) - בהדגמה היום נשאר מסומן'],
  ['33-abroad', /^DET>div\.card(>div)? \[h\]$|^DET>div\.card>div>div\.faint$/, 'R16: הכיתוב "ערכי דוגמה" של שכבת הסקירה לא נבנה'],
  ['36-swap-new', /^DLG>div>div>div\.mfld$|^DLG>div>div\.mfld>/, 'R19: בנווה (require_customer_id_number) "בית" ו"תעודת זהות" בשורה אחת (grid2) - בהדגמה אין ת״ז והשדה "בית" לבד'],
];
const approved = (line, st) => APPROVED.some(([re]) => re.test(line)) || APPROVED_STAGE.some(([s2, re]) => s2 === st && re.test(line));
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
