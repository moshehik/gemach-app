// בדיקת ממשק אמיתית לכפתורי ה-PDF / הדפסה בכרטיס התוצאות של דף הבית (HomeA5 האמיתי, כל קבצי ה-CSS הגלובליים של האתר):
//  - הכפתורים: תווית/tooltip של הורדת PDF, וסגנון מחושב (רקע / תמונת רקע / גבול / צל / רדיוס) זהה לכפתורי הפלטה שבדמו — אפס דליפת רקע.
//  - לחיצה על הדפסה: נפתח חלון עם דף ההדפסה המעוצב (page.evaluateOnNewDocument תופס את window.open) — נבדק ה-HTML.
//  - לחיצה על PDF: POST /api/pdf עם { html, landscape, filename } (מדומה), הצלחה → "ה-PDF ירד"; כשל 403 → נפתח אותו דף בהדפסה.
//  - הדף עצמו (setContent): רקע לבן, בלי תמונות רקע, בלי משתני ערכת נושא.
// דורש esbuild (ESBUILD_DIR=<תיקייה> או npm i --no-save esbuild) כמו scripts/home-bg-audit. אין DB, אין שרת פיתוח, פורט AUDIT_PORT (5179).
// הרצה: node scripts/search-pdf-audit/ui.mjs [רוחב=1280]   |   צילומים: scratch/_agent_tmp/search-pdf-audit
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { serve, launch, sleep, HERE as AUDIT_HERE, PORT } from '../home-bg-audit/lib.mjs';

const width = Number(process.argv[2] || 1280);
const OUT = path.resolve(AUDIT_HERE, '../../scratch/_agent_tmp/search-pdf-audit');
fs.mkdirSync(OUT, { recursive: true });
const DEMO = process.env.SEARCH_PDF_DEMO || 'file:///C:/Users/moshe/Desktop/' + encodeURI('גמח שמלות חדש/תצוגות-עיצוב/חיפוש-pdf-הדפסה.html');
let failed = 0;
const ok = (c, msg, extra = '') => { if (!c) { failed++; console.error('  FAIL -', msg, extra); } else console.log('  ok   -', msg); };

const b = spawnSync(process.execPath, [path.join(AUDIT_HERE, 'build.mjs')], { stdio: 'inherit', env: process.env });
if (b.status) process.exit(b.status);

const srv = await serve();
const browser = await launch();
try {
  // סגנון מחושב מול אותם כפתורים בדמו (פלטה בלבד)
  const demoPage = await browser.newPage();
  await demoPage.setViewport({ width, height: 900 });
  await demoPage.goto(DEMO, { waitUntil: 'load' });
  await sleep(500);
  const demoBtns = await demoPage.evaluate(() => [...document.querySelectorAll('#mockRoot .aixl .xlbtn')].map((b) => {
    const cs = getComputedStyle(b);
    return { bg: cs.backgroundColor, bi: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 60), bd: cs.borderTopColor + '/' + cs.borderTopWidth, bs: cs.boxShadow, rad: cs.borderTopLeftRadius, col: cs.color };
  }));
  await demoPage.close();
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // לוכד window.open (חלון הדפסה) ואת קריאות /api/pdf; מצב ה-PDF נשלט מהבדיקה (window.__pdfMode: ok | deny)
  await page.evaluateOnNewDocument(() => {
    window.__opened = [];
    window.__pdfCalls = [];
    window.__pdfMode = 'ok';
    window.open = () => {
      const doc = { html: '', write(h) { this.html += h; }, close() { window.__opened.push(this.html); } };
      return { document: doc, focus() {}, print() { window.__printed = (window.__printed || 0) + 1; } };
    };
    URL.createObjectURL = () => 'blob:fake';
    HTMLAnchorElement.prototype.click = function () { window.__download = this.download; };
  });
  page.on('console', (m) => { if (process.env.UI_DEBUG) console.log('  [page]', m.type(), m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await sleep(2600);
  // entry.jsx מחליף את window.fetch (API מדומה) בטעינה, לכן עוטפים אותו אחריה
  await page.evaluate(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, opts) => {
      if (String(url).includes('/api/pdf')) {
        window.__pdfCalls.push(JSON.parse(opts.body));
        if (window.__pdfMode === 'deny') return new Response(JSON.stringify({ error: 'אין הרשאה' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        return new Response(new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' }), { status: 200 });
      }
      return realFetch(url, opts);
    };
  });
  await page.type('#sq', 'כהן');
  await page.keyboard.press('Enter');
  await sleep(1200);

  console.log('\n== הכפתורים בכרטיס התוצאות (HomeA5 אמיתי)');
  const btns = await page.evaluate(() => [...document.querySelectorAll('.res-one .aixl .xlbtn')].map((b) => {
    const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
    return { cls: b.className, label: b.getAttribute('aria-label'), tip: b.getAttribute('data-tip'), bg: cs.backgroundColor, bi: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 60), bd: cs.borderTopColor + '/' + cs.borderTopWidth, bs: cs.boxShadow, rad: cs.borderTopLeftRadius, col: cs.color, x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
  }));
  ok(btns.length === 3, 'שלושה כפתורים: Excel / הדפסה / הורדה');
  ok(btns[2] && btns[2].label === 'הורדת PDF' && /PDF/.test(btns[2].tip), 'הכפתור השלישי = הורדת PDF (aria-label + tooltip)');
  ok(btns.length === 3 && btns[0].x > btns[1].x && btns[1].x > btns[2].x, 'RTL: Excel מימין, אחריו הדפסה, אחריו PDF (getBoundingClientRect)');

  ['xlg Excel', 'xlp הדפסה', 'xld PDF'].forEach((n, i) => {
    const r = btns[i]; const d = demoBtns[i];
    const diff = ['bg', 'bi', 'bd', 'bs', 'rad', 'col'].filter((k) => r && d && r[k] !== d[k]).map((k) => `${k}: אמיתי=${r[k]} דמו=${d[k]}`);
    ok(r && d && diff.length === 0, `סגנון מחושב ${n} זהה לפלטה בדמו (בלי דליפת רקע)`, diff.join(' | '));
  });
  await page.screenshot({ path: path.join(OUT, `ui-card-${width}.png`) });

  console.log('\n== הדפסה');
  await page.evaluate(() => document.querySelector('.res-one .aixl .xlp').click());
  await sleep(500);
  const printed = await page.evaluate(() => ({ docs: window.__opened, n: window.__printed || 0 }));
  ok(printed.docs.length === 1, 'נפתח חלון הדפסה אחד');
  const html = printed.docs[0] || '';
  ok(/<section class="pg">/.test(html) && /עמוד 1 מתוך 1/.test(html), 'הדף המעוצב: עמוד X מתוך Y');
  ok(html.includes('חיפוש: כהן') && html.includes('גמ״ח שמלות'), 'שורת הקשר: מה חיפשו + שם הגמ"ח מההגדרות');
  ok(html.includes('לקוחות') && html.includes('הזמנות') && html.includes('פריטים'), 'שלוש הקטגוריות כמו ברשימה שעל המסך');
  ok(!html.includes('totalAmount') && !html.includes('1200') && !html.includes('₪'), 'בלי סכומים (לא מוצגים בתוצאות)');
  ok(/@page\{size:A4 portrait/.test(html) && !/@import/.test(html), 'הדפסה: בלי פונט חיצוני');
  fs.writeFileSync(path.join(OUT, 'ui-print.html'), html);

  console.log('\n== הורדת PDF — הצלחה');
  await page.evaluate(() => { window.__opened = []; window.__pdfMode = 'ok'; document.querySelector('.res-one .aixl .xld').click(); });
  await sleep(700);
  const okCall = await page.evaluate(() => ({ calls: window.__pdfCalls, dl: window.__download, opened: window.__opened.length, toast: (document.querySelector('#toast b') || {}).textContent }));
  ok(okCall.calls.length === 1 && /@import url\('https:\/\/fonts\.googleapis\.com/.test(okCall.calls[0].html), 'נשלח POST /api/pdf עם ה-HTML של הדף (כולל פונט עברי לשרת)');
  ok(okCall.calls[0] && okCall.calls[0].landscape === false && okCall.calls[0].filename === 'search-results', 'landscape=false, שם קובץ לשרת ASCII (Content-Disposition)');
  ok(/^תוצאות-חיפוש-כהן-.+\.pdf$/.test(okCall.dl || ''), 'שם הקובץ בדפדפן: ' + okCall.dl);
  ok(okCall.opened === 0, 'בהצלחה לא נפתח חלון הדפסה');
  ok(okCall.toast === 'ה-PDF ירד', 'הודעה "ה-PDF ירד"', String(okCall.toast));

  console.log('\n== הורדת PDF — אין הרשאה (403) → אותו דף בחלון הדפסה');
  await page.evaluate(() => { window.__opened = []; window.__pdfCalls = []; window.__pdfMode = 'deny'; document.querySelector('.res-one .aixl .xld').click(); });
  await sleep(900);
  const deny = await page.evaluate(() => ({ opened: window.__opened, toast: (document.querySelector('#toast b') || {}).textContent }));
  ok(deny.opened.length === 1 && /<section class="pg">/.test(deny.opened[0]) && !/@import/.test(deny.opened[0]), 'נפתח דף ההדפסה (בלי פונט שרת)');
  ok(/PDF/.test(deny.toast || ''), 'הודעה שמסבירה: ' + deny.toast);

  console.log('\n== הדף עצמו (סגנון מחושב)');
  const sheetPage = await browser.newPage();
  await sheetPage.setContent(html, { waitUntil: 'load' });
  const sty = await sheetPage.evaluate(() => {
    const bad = [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).backgroundImage !== 'none').length;
    const bg = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
    return { bad, body: bg('body'), pg: bg('.pg'), sc: bg('.sc'), hd: bg('.hd'), row: bg('.r.o'), font: getComputedStyle(document.body).fontFamily.slice(0, 40) };
  });
  ok(sty.bad === 0, 'אין background-image בשום אלמנט בדף');
  ok(sty.pg === 'rgb(255, 255, 255)' && sty.hd === 'rgba(0, 0, 0, 0)' && sty.row === 'rgba(0, 0, 0, 0)', 'עמוד לבן; כותרת ושורות בלי רקע', JSON.stringify(sty));
  ok(sty.sc === 'rgb(243, 243, 243)', 'רקע יחיד: שורת כותרת הקטגוריה באפור בהיר (#f3f3f3)', sty.sc);
  ok(errs.length === 0, 'אין שגיאות JS בדף', errs.join(' | '));
} finally {
  await browser.close();
  srv.close();
}
console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
