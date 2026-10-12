// מפיק את דף ההצעה "רכיבי גרפים לפלטה" (HTML סטטי עצמאי): מרנדר בשרת (SSR) את רכיבי הגרפים האמיתיים של מסך "המרות בעמדה" עם נתוני דמה,
// ומטמיע את ה-CSS שלהם, את טוקני הפלטה ואת האייקונים הדרושים. בלי שרת dev, בלי רשת; לא נוגע בפלטה עצמה (design-system/ נקרא בלבד).
//   node --no-warnings --import ./scripts/station-analytics-tests/register-ssr.mjs scripts/station-analytics-tests/build-chart-proposal.mjs "<נתיב לקובץ הפלט>"
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const OUT = process.argv[2];
if (!OUT) throw new Error('חסר נתיב פלט');
const req = createRequire(path.join(PROJ, 'package.json'));
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const h = React.createElement;
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const Charts = await L('app/components/station-analytics/StationCharts.js');
const { hDateShort, dayTitle } = await L('app/components/a5-list/dates.js');
const { getIsraelTodayKey, addDaysToDateKey } = await L('lib/hebrewDate.js');
const { FUNNEL_STAGES } = await L('lib/stationAnalytics/constants.js');

const read = (rel) => fs.readFileSync(path.join(PROJ, rel), 'utf8');
const tokens = read('design-system/tokens.css');
const saCss = read('app/components/station-analytics/station-analytics.css');
const sprite = read('design-system/sprite.svg');

// ---- אייקונים: רק מה שהרכיבים משתמשים בו, בשם gmi-* כמו ב-sprite המוטמע של האתר
const ICONS = ['eye', 'user', 'cart', 'check', 'sparkle', 'sig', 'info'];
const symbols = ICONS.map((n) => {
  const m = new RegExp(`<symbol[^>]*id="i-${n}"[^>]*>[\\s\\S]*?</symbol>`).exec(sprite);
  if (!m) throw new Error(`אייקון חסר ב-sprite: ${n}`);
  return m[0].replace(`id="i-${n}"`, `id="gmi-${n}"`);
}).join('\n');

// ---- נתוני דמה (14 ימים)
const today = getIsraelTodayKey();
const days = Array.from({ length: 14 }, (_, i) => addDaysToDateKey(today, i - 13));
const dayItems = days.map((d, i) => ({ day: d, label: i === 13 ? 'היום' : hDateShort(d), title: dayTitle(d) }));
const registered = [3, 5, 2, 6, 4, 7, 5, 3, 8, 6, 4, 9, 7, 5];
const opened = [2, 3, 1, 4, 3, 5, 3, 2, 5, 4, 3, 6, 4, 2];
const visits = [38, 52, 31, 66, 49, 72, 58, 40, 81, 63, 47, 90, 74, 55];
const rate = visits.map((v, i) => (i === 2 || i === 7 ? null : registered[i] / v));

const funnel = [
  { key: 'visits', count: 420 }, { key: 'availability', count: 168 }, { key: 'formStart', count: 74 },
  { key: 'registered', count: 41 }, { key: 'verified', count: 28 }, { key: 'opened', count: 29 }, { key: 'approved', count: 21 },
].map((c) => {
  const st = FUNNEL_STAGES.find((s) => s.key === c.key);
  const parent = st.parent ? { visits: 420, availability: 168, formStart: 74, registered: 41, opened: 29 }[st.parent] : null;
  return { key: st.key, label: st.label, parent: st.parent, count: c.count, rateFromParent: parent ? c.count / parent : null, rateFromVisits: c.key === 'visits' ? null : c.count / 420 };
});
const PARENT_LABELS = { visits: 'הנכנסים', availability: 'מי שבדקו זמינות', formStart: 'מי שפתחו את הטופס', registered: 'מי שמילאו פרטים', opened: 'מי שנפתחה להן הזמנה' };

const tileCount = renderToStaticMarkup(h(Charts.StatTile, { icon: 'user', label: 'מילאו פרטים', value: 7, yesterday: 9, weekAvg: 5.1 }));
const tileRate = renderToStaticMarkup(h(Charts.StatTile, { icon: 'sparkle', label: 'אחוז ממילאות הפרטים שנפתחה להן הזמנה', kind: 'rate', value: 0.71, yesterday: 0.56, weekAvg: 0.62, extra: 'בהגדרה המחמירה (אושרה או שולמה): 51%' }));
const tileOff = renderToStaticMarkup(h(Charts.StatTile, { icon: 'eye', label: 'נכנסו לעמדה', value: null, yesterday: null, weekAvg: null, unmeasured: true }));
const funnelHtml = renderToStaticMarkup(h(Charts.FunnelBars, { stages: funnel, parentLabels: PARENT_LABELS, hasData: true }));
// בדף הסטטי אין React בצד הלקוח למדידת רוחב: ה-SVG מרונדר ברוחב 640 ומוקטן עם viewBox כדי להשתלב בכל רוחב מסך (באתר הרכיב מודד את הרוחב בפועל)
const fit = (html) => html.replace(/<svg width="(\d+)" height="(\d+)"/g, '<svg viewBox="0 0 $1 $2" width="100%" style="height:auto"');
const colsHtml = fit(renderToStaticMarkup(h(Charts.DayColumns, {
  days: dayItems, ariaLabel: 'מילאו פרטים ונפתחה להן הזמנה בכל יום', emptyText: 'אין רישומים בטווח הזה',
  series: [{ key: 'registered', label: 'מילאו פרטים', slot: 2, values: registered }, { key: 'opened', label: 'נפתחה הזמנה', slot: 1, values: opened }],
})));
const lineHtml = fit(renderToStaticMarkup(h(Charts.RateLine, { days: dayItems, label: 'מילאו פרטים מתוך הנכנסים', slot: 2, values: rate, ariaLabel: 'אחוז מהנכנסים שמילאו פרטים, בכל יום', emptyText: 'אין עדיין מספיק נתונים' })));
const tableHtml = renderToStaticMarkup(h(Charts.DataTable, {
  caption: 'נתונים יומיים', columns: [{ key: 'day', label: 'יום' }, { key: 'registered', label: 'מילאו פרטים' }, { key: 'opened', label: 'נפתחה הזמנה' }],
  rows: dayItems.slice(-5).reverse().map((d, i) => ({ id: d.day, cells: { day: d.title, registered: String(registered[13 - i]), opened: String(opened[13 - i]) } })),
}));

const section = (n, title, name, use, notUse, body, extra = '') => `
<section class="cmp" id="cmp-${n}">
  <header class="cmp-h">
    <span class="cmp-n">${n}</span>
    <div><h2>${title}</h2><p class="cmp-name">שם מוצע בפלטה: <b>${name}</b></p></div>
  </header>
  <div class="cmp-use"><b>מתי להשתמש</b><p>${use}</p><b>מתי לא</b><p>${notUse}</p></div>
  <div class="cmp-demo">${body}</div>
  ${extra}
</section>`;

const html = `<!doctype html>
<html lang="he" dir="rtl" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>הצעה: רכיבי גרפים לפלטה</title>
<style>
${tokens}
</style>
<style>
/* ===== בסיס הדף (לא חלק מהרכיבים): רק מה שהרכיבים צריכים כדי להיראות כמו באתר ===== */
*{box-sizing:border-box}
html{color-scheme:light}
body{margin:0;font-family:var(--gm-font);background:var(--pg-bg);color:var(--gm-ink);line-height:1.6;font-size:16px}
:root{--pg-bg:var(--gm-sky-50);--pg-card:var(--gm-surface)}
.gm-ds .card{background:var(--gm-surface);border:1px solid var(--gm-line);border-radius:var(--gm-r);box-shadow:var(--gm-sh);padding:22px}
.gm-ds .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.gm-ds .ic{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.gm-ds .rtbl{width:100%;border-collapse:collapse;font-size:15px}
.gm-ds .rtbl th{background:var(--gm-navy);color:var(--gm-gold-300);font-weight:600;text-align:start;padding:12px 14px}
.gm-ds .rtbl td{padding:12px 14px;border-bottom:1px solid var(--gm-sky-100);color:var(--gm-ink)}
.gm-ds .tblw{overflow-x:auto}
.gm-ds .faint{color:var(--gm-ink3)}
/* ===== דף ההצעה ===== */
.wrap{max-width:1040px;margin:0 auto;padding:24px 16px 64px}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:space-between;margin-bottom:8px}
.top h1{margin:0;font-size:28px;color:var(--gm-navy-900)}
.sub{color:var(--gm-ink2);margin:4px 0 20px;max-width:760px}
.tgl{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:var(--gm-surface);border:1px solid var(--gm-line)}
.tgl button{border:0;background:transparent;color:var(--gm-ink2);font:inherit;padding:6px 16px;border-radius:999px;cursor:pointer}
.tgl button[aria-pressed="true"]{background:var(--gm-navy);color:#fff;font-weight:600}
.note{background:var(--gm-gold-50);border:1px solid var(--gm-gold-300);border-radius:14px;padding:12px 16px;margin:0 0 20px;color:var(--gm-ink)}
.cmp{margin:0 0 32px;padding:20px;border-radius:20px;background:var(--pg-card);border:1px solid var(--gm-line)}
.cmp-h{display:flex;gap:14px;align-items:center;margin-bottom:12px}
.cmp-n{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:var(--gm-gold-rich-c) var(--gm-gold-rich);color:#0a2242;flex:none}
.cmp h2{margin:0;font-size:22px;color:var(--gm-navy-900)}
.cmp-name{margin:2px 0 0;color:var(--gm-ink2)}
.cmp-name b{color:var(--gm-navy-900)}
.cmp-use{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:16px;font-size:15px}
.cmp-use b{color:var(--gm-navy-900)}
.cmp-use p{margin:0 0 6px;color:var(--gm-ink2)}
@media (max-width:700px){.cmp-use{grid-template-columns:1fr}}
.cmp-demo{display:grid;gap:16px}
.cmp-demo.two{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.cmp-cap{color:var(--gm-ink3);font-size:14px;margin:0}
.sa-card-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;margin-bottom:14px}
.sa-card-h b{font-size:17px;font-weight:600;color:var(--gm-navy-900)}
.sa-card-h small{font-size:14px;color:var(--gm-ink3)}
.tok{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
.tok th,.tok td{padding:8px 12px;border-bottom:1px solid var(--gm-line2);text-align:start}
.tok i{display:inline-block;width:22px;height:10px;border-radius:3px;vertical-align:middle;margin-inline-end:8px}
/* ===== מצב כהה (הצעה: האתר עצמו עדיין בעור בהיר בלבד) ===== */
[data-theme="dark"]{color-scheme:dark;--pg-bg:#0f1722;--pg-card:#141d2b;
  --gm-surface:#18212e;--gm-line:#33445a;--gm-line2:#263446;--gm-sky-50:#202c3d;--gm-sky-100:#2a3a50;
  --gm-ink:#e8eef6;--gm-ink2:#b9c6d6;--gm-ink3:#93a4b8;--gm-navy-900:#eaf1fa;--gm-navy:#cfe0f3;--gm-gold-d:#d9b34a;--gm-gold-50:#2a2414;--gm-gold-300:#e0c56e;
  --gm-sh:0 1px 2px rgba(0,0,0,.4);--gm-sh-lg:0 12px 28px rgba(0,0,0,.5)}
[data-theme="dark"] .gm-ds.gm-st.gm-sa{--sa-s1:#5190cf;--sa-s2:#b38c2a}
[data-theme="dark"] .tgl button[aria-pressed="true"]{background:var(--gm-gold-300);color:#0a2242}
[data-theme="dark"] .gm-ds .rtbl th{background:#0f1722;color:var(--gm-gold-300)}
[data-theme="dark"] .gm-ds.gm-sa .sa-tt{background:#05090f;color:#fff}
[data-theme="dark"] .cmp-n,[data-theme="dark"] .gm-ds.gm-sa .sa-tile-ic{color:#0a2242}
[data-theme="dark"] .gm-ds.gm-sa .sa-fidx{background:var(--gm-sky-100);color:var(--gm-ink)}
[data-theme="dark"] .gm-ds.gm-sa .sa-ftrack{background:var(--gm-sky-50)}
[data-theme="dark"] .gm-ds.gm-sa .sa-hit:hover{fill:rgba(255,255,255,.06)}
</style>
<style>
${saCss}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${symbols}
</defs></svg>
<div class="wrap gm-ds gm-st gm-sa">
  <div class="top">
    <h1>הצעה: רכיבי גרפים לפלטה</h1>
    <div class="tgl" role="group" aria-label="מצב תצוגה">
      <button type="button" data-theme-btn="light" aria-pressed="true">בהיר</button>
      <button type="button" data-theme-btn="dark" aria-pressed="false">כהה</button>
    </div>
  </div>
  <p class="sub">ארבעה רכיבים שנבנו למסך "המרות בעמדה הציבורית" ואינם קיימים בפלטה. כל אחד מוצג כאן כפי שהוא רץ באתר (אותו קוד ואותו CSS), עם נתוני דמה. לאישור: שם בפלטה, ומספר סידורי שיוקצה לכל רכיב. הפלטה עצמה לא שונתה.</p>
  <p class="note">נתוני דמה בלבד. הרחפו על עמודה או על נקודה כדי לראות את הטולטיפ. הצירים מימין לשמאל (היום הראשון בטווח מימין), כיוון הקריאה בעברית. כל הצבעים הם טוקני פלטה (<code>--gm-*</code>); שני צבעי הסדרה אומתו נגד עיוורון צבעים, בבהיר ובכהה (טבלה בסוף).</p>

${section(1, 'אריח סטטיסטיקה עם השוואה', 'אריח מספר', 'מספר מרכזי אחד (ספירה או אחוז) עם השוואה לאתמול ולממוצע של 7 הימים שלפניו. מתאים לשורת סיכום בראש מסך מדדים, 4 עד 6 אריחים בשורה.', 'כשיש יותר מכמה מספרים להשוות (אז טבלה), או כשאין תקופת השוואה. בשלב שלא נמדד האריח מציג "—" והסבר, לא אפס.',
  `<div class="cmp-demo two">${tileCount}${tileRate}${tileOff}</div><p class="cmp-cap">שלוש הצורות: ספירה, אחוז עם שורת משנה (המדד המחמיר), ושלב שלא נמדד בערוץ. החצים בצורה בלבד (בלי אדום וירוק), והטקסט הנסתר קורא "עלייה של" / "ירידה של".</p>`)}

${section(2, 'גרף משפך', 'גרף משפך (עמודות אופקיות)', 'שלבים עוקבים של תהליך, מהרחב לצר, כשחשוב לראות כמה נשאר בכל שלב ואיזה אחוז ממנו ומהשלב הראשון. כל שורה: שם, מספר, פס, ואחוזי המרה.', 'כשהשלבים אינם עוקבים או כשיש מעל 8 שלבים. הפס ליניארי (לא נחתך), ולכן שלב קטן מאוד נשאר פס דק אך נראה.',
  `<div class="card sa-card"><div class="sa-card-h"><b>משפך ההמרה</b><small>נתוני דמה · חלון המרה 14 ימים</small></div>${funnelHtml}</div>`)}

${section(3, 'עמודות מקובצות', 'גרף עמודות מקובצות (לפי יום)', 'השוואה בין שתי סדרות באותה יחידה לאורך ציר זמן (למשל מילאו פרטים מול נפתחה הזמנה). קצה עליון מעוגל, מקרא תמיד, טולטיפ בריחוף ובמקלדת, ולחיצה על יום (אופציונלית) לבחירה.', 'סדרה אחת (השתמשו בלי מקרא), שתי יחידות שונות בקנה מידה שונה (שני גרפים נפרדים, אף פעם לא שני צירים), או יותר משתי סדרות (רק שני צבעי סדרה אומתו).',
  `<div class="card sa-card"><div class="sa-card-h"><b>מילאו פרטים ונפתחה להן הזמנה בכל יום</b><small>נתוני דמה · 14 ימים</small></div>${colsHtml}</div><div class="card sa-card"><div class="sa-card-h"><b>תצוגת טבלה (חלופה נגישה לכל גרף)</b></div>${tableHtml}</div>`)}

${section(4, 'קו מגמה', 'גרף קו מגמה (שיעור יומי)', 'שיעור או ערך רציף לאורך זמן. ימים בלי מכנה (למשל יום בלי כניסות) הם רווח בקו, לא אפס מזויף. נקודה עם טבעת בצבע המשטח, ציר באחוזים.', 'ערכים בודדים או מעט נקודות (אז אריח), או השוואת כמה קווים (יותר משלושה הופכים לבלגן).',
  `<div class="card sa-card"><div class="sa-card-h"><b>אחוז מהנכנסים שמילאו פרטים</b><small>נתוני דמה · ימים 3 ו-8 בלי כניסות</small></div>${lineHtml}</div>`)}

<section class="cmp">
  <header class="cmp-h"><span class="cmp-n">צ</span><div><h2>צבעי הסדרות (אומתו)</h2><p class="cmp-name">בדיקה: <code>validate_palette</code> של skill ה-dataviz</p></div></header>
  <table class="tok">
    <thead><tr><th>סדרה</th><th>בהיר</th><th>כהה</th></tr></thead>
    <tbody>
      <tr><td>1 · נפתחה הזמנה / כניסות</td><td><i style="background:#2b5a94"></i><code>--gm-navy-500</code> #2b5a94</td><td><i style="background:#5190cf"></i>#5190cf</td></tr>
      <tr><td>2 · מילאו פרטים</td><td><i style="background:#b8912f"></i><code>--gm-gold-b</code> #b8912f</td><td><i style="background:#b38c2a"></i>#b38c2a</td></tr>
      <tr><td>הפרדה בין השתיים (ΔE)</td><td>27.6 (עיוורון צבעים) · 31 (רגיל)</td><td>19.5 · 23.5</td></tr>
      <tr><td>ניגודיות מול המשטח</td><td>הזהב 2.9:1, מתחת ל-3:1, ולכן יש ערכים בתוויות ישירות, מקרא ותצוגת טבלה</td><td>מעל 3:1</td></tr>
    </tbody>
  </table>
  <p class="cmp-cap">צבעי הכהה נבחרו כך שיעברו את הבדיקה (טווח בהירות 0.48 עד 0.67). שלוש סדרות לא עוברות בבדיקה עם הצבעים הנוכחיים של הפלטה, ולכן הרכיבים מוגבלים לשתי סדרות.</p>
</section>
</div>
<div id="sa-tt-live" class="sa-tt" role="tooltip" style="display:none;position:fixed;transform:none"></div>
<script>
(function () {
  var root = document.documentElement;
  document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      root.setAttribute('data-theme', b.getAttribute('data-theme-btn'));
      document.querySelectorAll('[data-theme-btn]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) { var d = document.querySelector('[data-theme-btn="dark"]'); if (d) d.click(); }
  // טולטיפ דמו: ממלא מתוך aria-label של פס היום (בדף האמיתי זה רכיב React)
  var tt = document.getElementById('sa-tt-live');
  function show(el, ev) {
    var t = el.getAttribute('aria-label'); if (!t) return;
    var i = t.indexOf(': ');
    tt.innerHTML = '';
    var d = document.createElement('div'); d.className = 'sa-tt-d'; d.textContent = i > 0 ? t.slice(0, i) : t; tt.appendChild(d);
    var r = document.createElement('div'); r.textContent = i > 0 ? t.slice(i + 2) : ''; tt.appendChild(r);
    tt.style.display = 'block';
    var b = el.getBoundingClientRect();
    tt.style.left = Math.max(8, Math.min(window.innerWidth - 230, b.left + b.width / 2 - 110)) + 'px';
    tt.style.top = Math.max(8, b.top - tt.offsetHeight - 8) + 'px';
  }
  document.querySelectorAll('.sa-hit').forEach(function (el) {
    el.addEventListener('mouseenter', function (e) { show(el, e); });
    el.addEventListener('focus', function (e) { show(el, e); });
    el.addEventListener('mouseleave', function () { tt.style.display = 'none'; });
    el.addEventListener('blur', function () { tt.style.display = 'none'; });
  });
})();
</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('נכתב:', OUT, `${Math.round(html.length / 1024)}KB`);
