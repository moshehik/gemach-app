// מפיק את "גרפים: שלושה כיווני עיצוב" (HTML סטטי עצמאי, בלי רשת): CSS + JS מ-scripts/station-analytics-tests/graphs-3/ ותוויות תאריך עבריות מהעזרים של האתר.
//   node --no-warnings --import ./scripts/station-analytics-tests/register-ssr.mjs scripts/station-analytics-tests/build-graphs-3.mjs "<נתיב לקובץ הפלט>"
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const OUT = process.argv[2];
if (!OUT) throw new Error('חסר נתיב פלט');
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const { hDateShort, dayTitle } = await L('app/components/a5-list/dates.js');
const { getIsraelTodayKey, addDaysToDateKey } = await L('lib/hebrewDate.js');
const { FUNNEL_STAGES } = await L('lib/stationAnalytics/constants.js');

const dir = path.join(PROJ, 'scripts/station-analytics-tests/graphs-3');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

const today = getIsraelTodayKey();
const days = Array.from({ length: 14 }, (_, i) => addDaysToDateKey(today, i - 13)).map((d) => ({ day: d, label: hDateShort(d), title: dayTitle(d) }));
const PARENT = { visits: 'הנכנסים', availability: 'מי שבדקו זמינות', formStart: 'מי שפתחו את הטופס', registered: 'מי שמילאו פרטים', opened: 'מי שנפתחה להן הזמנה' };
const stages = FUNNEL_STAGES.map((s) => ({ key: s.key, label: s.label, parent: s.parent, parentLabel: s.parent ? PARENT[s.parent] : '' }));

const section = (id, letter, title, sub, tags) => `
<section class="dir dir-${id}" id="dir-${id}" data-dir="${id}">
  <div class="dir-h"><span class="badge">${letter}</span><h2>${title}</h2></div>
  <p class="dir-sub">${sub}</p>
  <ul class="dir-tags">${tags.map((t) => `<li>${t}</li>`).join('')}</ul>
  <div class="dir-body"></div>
</section>`;

const html = `<!doctype html>
<html lang="he" dir="rtl" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>גרפים: שלושה כיווני עיצוב</title>
<style>
${css}
</style>
</head>
<body>
<header class="top">
  <h1>גרפים: שלושה כיווני עיצוב</h1>
  <nav class="pill" aria-label="מעבר בין הכיוונים"><button type="button" onclick="document.getElementById('dir-a').scrollIntoView()">A</button><button type="button" onclick="document.getElementById('dir-b').scrollIntoView()">B</button><button type="button" onclick="document.getElementById('dir-c').scrollIntoView()">C</button></nav>
  <div class="pill" role="group" aria-label="מצב תצוגה"><button type="button" data-theme-btn="light" aria-pressed="true">בהיר</button><button type="button" data-theme-btn="dark" aria-pressed="false">כהה</button></div>
  <button type="button" class="tbtn" id="replay">הפעלת התנועה מחדש</button>
</header>
<main class="wrap">
  <p class="intro">אותם ארבעה רכיבים (אריחי סטטיסטיקה, משפך, עמודות מקובצות, קו מגמה) בשלושה כיווני עיצוב שונים. כולם בצבעי המערכת (navy, sky, gold, rose) ובגופן Rubik, בבהיר ובכהה, עם נתוני דמה. אפשר לרחף על עמודה, נקודה או שלב (או לנווט במקלדת) ולראות טולטיפ, ולעבור בכל גרף לטבלה נגישה. הצירים מימין לשמאל. המסך החי לא ישתנה עד שתבחרו כיוון.</p>
  <div class="picks" role="radiogroup" aria-label="בחירת כיוון">
    <label class="pick"><input type="radio" name="dir" value="a"><span class="badge">A</span><span><b>ענן</b><small>גרדיאנטים רכים, קו חלק עם שטח, עמודות מעוגלות עם צל, טבעת המרה</small></span></label>
    <label class="pick"><input type="radio" name="dir" value="b"><span class="badge">B</span><span><b>זרימה</b><small>לוחות נייבי, משפך כסרט מתחדד עם תגיות המרה, זוהר זהב, מד חצי עיגול</small></span></label>
    <label class="pick"><input type="radio" name="dir" value="c"><span class="badge">C</span><span><b>מינימליזם</b><small>סגנון Stripe / Linear: שטוח, קווי שיער, מספרים גדולים, פס השוואה, קו תקופה קודמת</small></span></label>
  </div>
  <div class="chosen" id="chosen" role="status"><span id="chosen-msg"></span><button type="button" class="cbtn" id="copy">העתקת הבחירה</button></div>
  <p class="legend-note">צבעי הסדרות אומתו עם <bdi dir="ltr">validate_palette</bdi>: בבהיר <bdi dir="ltr">navy-500</bdi> ו-<bdi dir="ltr">gold-b</bdi> (הפרדה <bdi dir="ltr">ΔE 27.6</bdi> לעיוורי צבעים; הזהב 2.95:1 מול משטח לבן, ולכן יש תוויות ערך, מקרא וטבלה). בכהה <bdi dir="ltr">#5190cf</bdi> ו-<bdi dir="ltr">#b38c2a</bdi> (<bdi dir="ltr">ΔE 19.5</bdi> עד 23.5, מעל 3:1 גם על הנייבי). הגרדיאנטים הם קצוות דקורטיביים של אותם גוונים.</p>
${section('a', 'A', 'כיוון A: ענן', 'מראה רך וחי: כרטיסים עם גרדיאנט עדין וצל מרחף, אריחים עם ספרקליין חלק, טבעת כפולה לאחוז ההמרה (חיצונית: נפתחה הזמנה, פנימית: אושרה או שולמה), משפך בפסי קפסולה עם תגיות המרה בין השלבים, עמודות מעוגלות עם צל, וקו חלק עם שטח גרדיאנט, הדגשת השיא ונקודה פועמת.', ['גרדיאנטים', 'עקומה חלקה (spline)', 'צל עדין', 'טבעת התקדמות', 'ספרקליין באריח'])}
${section('b', 'B', 'כיוון B: זרימה', 'דשבורד על לוחות נייבי עם הדגשות זהב: משפך כסרט זורם שמצטמצם משלב לשלב עם אחוזי ההמרה כתגיות על הצמתים, אריחים עם פסי השוואה (היום מול אתמול מול ממוצע) ומד חצי עיגול כפול, עמודות עם זוהר, וקו מגמה זוהר עם מעבר צבע sky לזהב.', ['סרט משפך', 'לוח נייבי', 'זוהר זהב', 'מד חצי עיגול', 'פסי השוואה'])}
${section('c', 'C', 'כיוון C: מינימליזם', 'נקי כמו Stripe / Linear: בלי צל ובלי גרדיאנט, קווי שיער דקים, מספרים גדולים וקלים, פס השוואה אפור-כחלחל עם סימוני אתמול וממוצע, שורות משפך דקות עם אחוזים בטקסט, עמודות דקות, וקו דק עם קו מקווקו לתקופה הקודמת ותווית ישירה בקצה.', ['שטוח', 'קווי שיער', 'מספרים גדולים', 'קו השוואה לתקופה קודמת', 'תווית ישירה'])}
</main>
<div id="tt" role="tooltip"></div>
<script>window.__DAYS=${JSON.stringify(days)};window.__STAGES=${JSON.stringify(stages)};</script>
<script>
${js}
</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('נכתב:', OUT, `${Math.round(html.length / 1024)}KB`);
