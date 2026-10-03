// בדיקת גלילה אוטומטית בדף הבית: תצוגת טבלה + "עוד N" — החיפוש הכללי (HomeResults) והמתקדם (HomeAdvResults), בשולחן עבודה ובמובייל.
// באג מקורי (4.10.2026): אחרי מעבר לטבלה ולחיצה על "עוד N" אי אפשר היה לגלול לשורות התחתונות — globals.css `div:has(> table){max-height:75vh}`
// + `.gm-ds .tblw{overflow:hidden}` חתכו את עטיפת הטבלה (.tblw) ל-75% מגובה החלון בלי גלילה פנימית.
//
//   ESBUILD_DIR=<esbuild> node scripts/home-scroll-audit/build.mjs   # פעם אחת (ובכל שינוי בקוד הדף)
//   node scripts/home-scroll-audit/run.mjs                           # יוצא 1 אם משהו נכשל
// דרישות: Chrome (CHROME_PATH), puppeteer-core ו-react מה-node_modules של הפרויקט. אין DB: ה-API מדומה ב-entry.jsx (40 שורות לכל סוג).
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, CHAIN, metrics } from './lib.mjs';

const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const TAG = process.argv[2] || 'run';
const VIEWPORTS = [{ w: 1280, h: 800, touch: false }, { w: 375, h: 812, touch: true }];
const MODES = process.env.ONLY_OTHER ? [] : ['quick', 'adv']; // ONLY_OTHER=1: רק בדיקת שאר הדפים (מהירה)

const s = await serve(); const b = await launch();
const fails = []; const report = [];
const ok = (cond, msg) => { if (!cond) { fails.push(msg); console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

async function openResults(p, mode) {
  const clickText = (txt, sel = 'button') => p.evaluate((t, q) => { const x = [...document.querySelectorAll(q)].find((e) => e.textContent.includes(t) && e.offsetParent); if (x) { x.click(); return true; } return false; }, txt, sel);
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(2400);
  if (mode === 'quick') { await p.click('#sq'); await p.type('#sq', 'כהן'); await p.keyboard.press('Enter'); }
  else {
    await clickText('לחיפוש מתקדם'); await sleep(500);
    const fb = await p.$('.advfb'); await fb.click(); await sleep(600);
    const inp = await p.$('.advp input.inp'); await inp.click(); await inp.type('כהן'); await p.keyboard.press('Escape');
    await clickText('חיפוש', '.advp .advact .btn.primary');
  }
  await sleep(2000);
  await p.evaluate(() => document.querySelector('.vsw .vopt[aria-label="מצב טבלה"]').click()); await sleep(500);
  await p.evaluate(() => [...document.querySelectorAll('.lrow.block')].find((x) => /^\s*עוד/.test(x.textContent)).click()); await sleep(600);
}

// האם השורה האחרונה בטבלה באמת נצבעת (לא חתוכה בידי אב כמו .tblw) כשמגלגלים אליה?
const LAST_ROW = () => {
  const trs = document.querySelectorAll('.rtbl tbody tr'); const tr = trs[trs.length - 1];
  // גוללים את *הדף* (לא scrollIntoView: הוא גולל גם עטיפה עם overflow:hidden, וכך מסתיר את הבאג) כך שהשורה האחרונה במרכז החלון
  window.scrollTo(0, scrollY + tr.getBoundingClientRect().top - innerHeight / 2);
  const r = tr.getBoundingClientRect(); const w = document.querySelector('.tblw').getBoundingClientRect(); // טבלה רחבה (7 עמודות) גולשת הצידה בתוך .tblw: בודקים בנקודה הנראית שלה
  const x = (Math.max(r.left, w.left, 0) + Math.min(r.right, w.right, innerWidth)) / 2, y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  return { rows: trs.length, inView: r.top >= 0 && r.bottom <= innerHeight, painted: !!(hit && hit.closest('tr') === tr), bottom: Math.round(r.bottom), vh: innerHeight };
};

for (const vp of VIEWPORTS) for (const mode of MODES) {
  const name = `${mode}-${vp.w}`; console.log(`\n== ${name} ==`);
  const p = await b.newPage();
  await p.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1, hasTouch: vp.touch, isMobile: vp.touch });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await openResults(p, mode);
  const rec = { name };
  rec.before = await p.evaluate(metrics);
  rec.wrap = await p.evaluate(() => { const w = document.querySelector('.tblw'); const cs = getComputedStyle(w); return { ch: w.clientHeight, sh: w.scrollHeight, oy: cs.overflowY, mh: cs.maxHeight }; });
  rec.chain = await p.evaluate(CHAIN, '.rtbl');
  await p.screenshot({ path: `${OUT}/${TAG}-${name}-more.png` });
  // 1) העטיפה לא חותכת את הטבלה: או שהיא גבוהה כמו התוכן או שהיא עצמה גוללת אנכית
  const scrollsInside = ['auto', 'scroll'].includes(rec.wrap.oy) && rec.wrap.sh > rec.wrap.ch;
  ok(rec.wrap.sh <= rec.wrap.ch + 1 || scrollsInside, `${name}: .tblw not clipped (clientHeight ${rec.wrap.ch}, scrollHeight ${rec.wrap.sh}, overflow-y ${rec.wrap.oy}, max-height ${rec.wrap.mh})`);
  ok(!(rec.wrap.sh > rec.wrap.ch + 1 && !scrollsInside), `${name}: no hidden/unreachable overflow inside .tblw`);
  // 2) גלילה אמיתית: גלגלת מעל הטבלה, גלגלת בשוליים, מקש End, ומגע במובייל
  // נקודה בתוך הטבלה שנראית בחלון (חיתוך של .tblw עם ה-viewport); בגלילה הבאה העכבר/האצבע נמצאים מעל הטבלה
  const mid = await p.evaluate(() => { const r = document.querySelector('.tblw').getBoundingClientRect(); const top = Math.max(r.top, 0), bot = Math.min(r.bottom, innerHeight); return { x: Math.min(Math.max(r.left + r.width / 2, 10), innerWidth - 10), y: (top + bot) / 2 }; });
  const t0 = (await p.evaluate(metrics)).top;
  if (vp.touch) {
    // החלקת אצבע אמיתית (touchStart/Move/End) — Input.synthesizeScrollGesture לא גולל בכרום headless עם מובייל
    const swipe = async (x, y, dy) => { await p.touchscreen.touchStart(x, y); for (let i = 1; i <= 12; i++) { await p.touchscreen.touchMove(x, y - (dy * i) / 12); await sleep(16); } await p.touchscreen.touchEnd(); await sleep(120); };
    await swipe(Math.round(mid.x), Math.round(mid.y), 400); await sleep(600);
    rec.touchOverTable = (await p.evaluate(metrics)).top - t0;
    ok(rec.touchOverTable > 100, `${name}: touch swipe over the table scrolls the page (+${rec.touchOverTable}px)`);
    // כמה החלקות אמיתיות רצופות (הדף גולל בהן), ואת שארית הדרך עד התחתית עושים ב-scrollTo (החלקות רבות איטיות מאוד ב-headless)
    const tt = (await p.evaluate(metrics)).top;
    for (let i = 0; i < 5; i++) await swipe(Math.round(mid.x), Math.round(vp.h * 0.8), 600);
    rec.touchFive = (await p.evaluate(metrics)).top - tt;
    ok(rec.touchFive > 1200, `${name}: five consecutive swipes keep scrolling (+${rec.touchFive}px)`);
    await p.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
    await sleep(500);
  } else {
    await p.mouse.move(mid.x, mid.y); await p.mouse.wheel({ deltaY: 400 }); await sleep(400);
    rec.wheelOverTable = (await p.evaluate(metrics)).top - t0;
    ok(rec.wheelOverTable > 100, `${name}: wheel over the table scrolls the page (+${rec.wheelOverTable}px)`);
    const t1 = (await p.evaluate(metrics)).top;
    await p.mouse.move(6, 400); await p.mouse.wheel({ deltaY: 300 }); await sleep(400);
    rec.wheelMargin = (await p.evaluate(metrics)).top - t1;
    ok(rec.wheelMargin > 50, `${name}: wheel over the page margin scrolls (+${rec.wheelMargin}px)`);
    await p.keyboard.press('End'); await sleep(500);
  }
  rec.end = await p.evaluate(metrics);
  ok(rec.end.top + rec.end.ch >= rec.end.sh - 2, `${name}: reached the page bottom (top ${rec.end.top} + ${rec.end.ch} >= ${rec.end.sh})`);
  rec.last = await p.evaluate(LAST_ROW);
  ok(rec.last.rows > 8, `${name}: "show more" expanded the table (${rec.last.rows} rows)`);
  ok(rec.last.painted && rec.last.inView, `${name}: the LAST table row is painted and reachable (rows ${rec.last.rows}, bottom ${rec.last.bottom} / ${rec.last.vh})`);
  await p.screenshot({ path: `${OUT}/${TAG}-${name}-end.png` });
  report.push(rec); await p.close();
}
// אותה עטיפה (.tblw) בשאר הדפים שמשתמשים בה: בדיקת מלאי (.gm-ds.gm-home.stock-page, ResultsTable) ושלבי הלו"ז (.gm-ds.gm-lz). רק ה-CSS המשותף (globals + פלטה) נטען כאן,
// וזה בדיוק מה שגורם לחיתוך, ולכן מספיקה עטיפה סינתטית עם 80 שורות.
{
  console.log('\n== other .tblw users (stock-check, schedule) ==');
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 800 });
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1500);
  for (const [name, cls] of [['stock-check', 'gm-ds gm-home stock-page'], ['schedule', 'gm-ds gm-lz']]) {
    const r = await p.evaluate((c) => {
      const host = document.createElement('div'); host.className = c;
      host.innerHTML = '<div class="tblw"><table class="rtbl"><thead><tr><th>א</th><th>ב</th></tr></thead><tbody>' + Array.from({ length: 80 }, (_, i) => `<tr><td>${i}</td><td>שורה</td></tr>`).join('') + '</tbody></table></div>';
      document.body.appendChild(host);
      const w = host.firstChild; const cs = getComputedStyle(w);
      const out = { ch: w.clientHeight, sh: w.scrollHeight, oy: cs.overflowY, mh: cs.maxHeight };
      host.remove(); return out;
    }, cls);
    ok(r.sh <= r.ch + 1 || (['auto', 'scroll'].includes(r.oy) && r.sh > r.ch), `${name}: .tblw not clipped (clientHeight ${r.ch}, scrollHeight ${r.sh}, overflow-y ${r.oy}, max-height ${r.mh})`);
  }
  await p.close();
}
fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(report, null, 1));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL OK');
await b.close(); s.close(); process.exit(fails.length ? 1 : 0);
