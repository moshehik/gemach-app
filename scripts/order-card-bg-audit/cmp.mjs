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
];
// W4 (לשונית תשלומים): עטיפת r37 של שכבת הסקירה (span display:contents) נוספת מחדש בכל רינדור; בעיצוב לחצן "רישום תשלום ידני" מנוטרל כשאין יתרה
APPROVED_STAGE.push(...['P01-pay-tab', 'P02-pay-mgr', 'P03-pay-debt', 'P04-dlg-pay'].flatMap((st) => [
  [st, /^PAY>(div\.li>span>button\.ibtn|span>button\.ibtn>svg)/, 'r37: עטיפת span של שכבת הסקירה'],
  [st, /^PAY>(div\.in>div\.row\.wrap>button\.btn|div\.row\.wrap>button\.btn>svg\.ic\.sm) \[(bg|col|bd|w|h|op)\]$/, 'אפשרויות מנהל: בעיצוב 3 לחצנים (אחד מנוטרל); אצלנו לחצן אחד מאוחד (R22) + חישוב מחדש (R33)'],
]));
// בשלבי החלונות: בעיצוב החלון נפתח מעל לשונית אחרת (חלון הדגמה), אצלנו מעל לשונית התשלומים - משווים רק את החלון
APPROVED_STAGE.push(...['P05-dlg-paydet', 'P06-dlg-manual', 'P07-dlg-refund', 'P08-dlg-bank', 'P09-dlg-credit', 'P10-dlg-forced'].map((st) => [st, /^PAY/, 'שלב חלון: הלשונית שמתחת אינה חלק מההשוואה']));
APPROVED_STAGE.push(['P04-dlg-pay', /^DLG>(div>div\.row\.wrap>button\.ibtn|div\.row\.wrap>button\.ibtn>svg|div\.amsg)/, 'R36: לחצן "מעקף מתכנת" (החלטה R36, אין בעיצוב) + שורת השגיאה של החלון']);
// W4: גובה/רוחב באזור הלשונית תלויים בנתונים ובטקסט (נוסח אמיתי מול "(דוגמה)" בעיצוב, תשלום אחד מול שניים)
APPROVED_STAGE.push(...['P01-pay-tab', 'P02-pay-mgr', 'P03-pay-debt', 'P04-dlg-pay'].map((st) => [st, /^PAY.* \[(h|w)\]$/, 'גובה/רוחב לפי טקסט ונתונים']));
// W4 חלונות: שדות שהעיצוב לא מציג אבל ההחלטות דורשות (R37 פירוט הערות; R38 בנק/סניף חובה; R36 שדות נדרים בחלון הכפוי; שורת השגיאה),
// לשוניות/טוסט של התרחיש (ארגון ראשי בלי משלוח; הטוסט של sim-add בעיצוב), ולחצן "פרטי בנק" ב-D4
APPROVED_STAGE.push(
  ['P05-dlg-paydet', /^DLG>div\.mfld/, 'R37: פירוט ההערות (נדרים) כמו בישן'],
  ['P07-dlg-refund', /^TABS/, 'תרחיש הגמ"ח הראשי (בלי לשונית משלוח, סמן זיכוי)'],
  ['P07-dlg-refund', /^DLG>(div>div|div\.mfld|div\.grid2|div\.amsg)/, 'R38: כל השדות של הישן בתוך עטיפת שדות אחת'],
  ['P08-dlg-bank', /^DLG>(div>div|div\.mfld|div\.grid2|div\.amsg|div\.grid2>div\.mfld)/, 'A15/R38: שם + IBAN + בנק + סניף (חובה בשרת) בעטיפת שדות'],
  ['P08-dlg-bank', /^DLG>div$/, 'עטיפת השדות'],
  ['P09-dlg-credit', /^DLG>(div\.chg|div\.amsg|div\.dbtns>button\.block\.btn(>svg\.ic\.sm)?$)/, 'D4: פרטי הזיכוי והבנק + "עריכת פרטי בנק"'],
  ['P09-dlg-credit', /^DLG>div\.dbtns>button\.block\.btn( |>svg\.ic\.sm )\[/, 'D4: לחצן "פרטי בנק"'],
  ['P10-dlg-forced', /^(TABS|TOAST)/, 'סמני לשוניות (W1) והטוסט של sim-add בעיצוב'],
  ['P10-dlg-forced', /^DLG>(div\.sub|div$|div>div|div\.mfld|div\.grid2|div\.row\.wrap|div\.amsg)/, 'R14 כותרת-משנה + R36 שדות נדרים (אשראי ברירת מחדל) + שורת השגיאה'],
);
// W4: שלב המעטפת 03 פותח את לשונית התשלומים עם נתוני נווה ובלי ניקוי סמני הסקירה - הלשונית עצמה נבדקת בשלבי P01-P10
APPROVED_STAGE.push(['03-tab-payments', /^PAY/, 'לשונית התשלומים נבדקת ב-P01-P04']);
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
