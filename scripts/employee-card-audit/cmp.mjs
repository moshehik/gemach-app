// משווה את ה-computed style (וטקסט) של העיצוב (demo) לדף האמיתי (real) לפי מצב ו-selector; מדפיס הבדלים. TOTAL 0 = זהה.
// הבדלים מוכרים (החלטות הבעלים EC-05 / EC-08 / EC-09 והדגמה בלבד) מסוננים ל-KNOWN ומודפסים בנפרד; TOTAL סופר רק את הלא-מוכרים.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const w = process.argv[2] || '1280';
const d = JSON.parse(fs.readFileSync(path.join(OUT, `demo-${w}.json`), 'utf8'));
const r = JSON.parse(fs.readFileSync(path.join(OUT, `real-${w}.json`), 'utf8'));
const F = ['bg', 'bi', 'bf', 'col', 'bd', 'bs', 'rad', 'op', 'ff', 'fs', 'pad', 'mar', 'h', 'w', 'tx'];
// לא נבדק: סרגל ההדגמה. הבדלים מוכרים (KNOWN = [סלקטור, שדה|null]) - החלטות הבעלים והבדלי הדגמה בלבד, כל אחד מוסבר:
const skip = (x) => /\.demo|qp/.test(x.sel);
const KNOWN = [
  [/^ROOT$/, /^(pad|h)$/], // 72px אוויר מתחת לסרגל העליון של האתר (כמו attendance.css / profile.css); בעיצוב הסרגל מחוץ ל-#app
  [/^ROOT>div\.layout(>main\.main)?$/, /^h$/], // גובה הלשונית = אורך רשימת ההרשאות (EC-09: 7 קטגוריות מקופלות במקום 2 קבוצות פתוחות)
  [/#permCard|#permBody|\.pr-g|\.pr-cat|\.pr-groups|\.coll|div\.prow|div\.pr-/, null], // EC-09
  [/ROOT>form>section\.card\.dfields>div$/, /^h$/], // מכל ההרשאות (EC-09)
  [/pf-avwrap>label\.lbl|label\.pf-up>/, /^(tx|w)$/], // EC-05: תמונה בלבד (בלי "/ מסמך", בלי "PDF")
  [/card-h>h2$/, /^tx$/], // EC-08: "מחלקה, סטטוס והערות" (כרטיס מאוחד) והערות לא בכרטיס נפרד
  [/ec-notes|section\.card\.dfields>div\.grid2|div\.grid2>div\.field/, /^h$/], // EC-08: הכרטיס המאוחד (שדה ההערות בתוכו)
  [/^TOAST/, null, /^(?!06|21)/], // אלמנט ה-#toast הריק של העיצוב קיים תמיד (נבדק רק בשלבי הטוסט: 06 ו-21)
  [/ec-hint/, /^h$/], // טקסט העזר של הסיסמה בכרטיס החדש מפורט יותר: כולל שינוי סיסמה בכרטיס של עובד אחר (תיקון EMP-BUGS)
  [/ec-notes|form>section\.card\.dfields>div\.field\.wide|section\.card\.dfields>div\.field\.wide/, null], // EC-08: ההערות בכרטיס המאוחד
  [/form>section\.card\.dfields$/, /^h$/, /^(0\d|2\d|3\d)/], // גובה כרטיסים בלשונית הפרטים: המאוחד (EC-08) וההרשאות (EC-09)
  [/^SCRIM2>div\.dlg$/, /^h$/], // שורת "קוד הדגמה: 1234" בעיצוב בלבד
  [/SCRIM2>div\.dlg>div\.mfld>span\.lbl/, /^tx$/], // "בחר מאשר" לרמת feature (כמו חלונית האימות הישנה); בעיצוב תמיד "בחר מנהל"
  [/\.(mico|dbadge)>svg/, /^(w|h)$/], // אנימציית ריחוף (תלוית זמן)
];
const known = (sel, f, st) => KNOWN.some(([re, fr, sr]) => re.test(sel) && (!fr || fr.test(f)) && (!sr || sr.test(st)));
const group = (arr) => { const m = new Map(); for (const x of arr.filter((x) => !skip(x))) { if (!m.has(x.sel)) m.set(x.sel, []); m.get(x.sel).push(x); } return m; };
let total = 0; let knownN = 0;
for (const st of Object.keys(d)) {
  const dm = group(d[st]); const rm = group(r[st] || []);
  const lines = []; const kl = [];
  for (const [s, dv] of dm) {
    const rv = rm.get(s);
    if (!rv) { (known(s, '', st) ? kl : lines).push(`  (demo-only) ${s}`); continue; }
    for (const f of F) {
      const a = [...new Set(dv.map((x) => x[f] || ''))].sort(); const b = [...new Set(rv.map((x) => x[f] || ''))].sort();
      if (a.join('|') !== b.join('|')) { const l = `  ${s} [${f}] demo=${a.join(' ; ') || '-'}   real=${b.join(' ; ') || '-'}`; (known(s, f, st) ? kl : lines).push(l); }
    }
  }
  for (const [s, rv] of rm) if (!dm.has(s)) { const x = rv[0]; if (x.bg || x.bi || x.bf || x.bd || x.tx) (known(s, '', st) ? kl : lines).push(`  (real-only element) ${s} bg=${x.bg} bi=${x.bi} bd=${x.bd} tx=${x.tx}`); }
  total += lines.length; knownN += kl.length;
  console.log(`== ${st} (${lines.length}${kl.length ? `, known ${kl.length}` : ''})`); lines.forEach((l) => console.log(l.slice(0, 380)));
}
console.log('KNOWN (filtered)', knownN);
console.log('TOTAL', total);
