// בדיקת דפדפן לאייקון המעבר "ישן / חדש": לכל תרחיש (דף חדש / ישן) ב-1280 וב-375 - האייקון קיים, במקום הנכון, בתוך המסך,
// ובמראה של לחצן אייקון עגול של הפלטה (computed style); לא קיים למשתמש שאינו רשאי / בנתיב בלי גרסה ישנה / בשעון הנוכחות;
// לחיצה שולחת POST /api/me/ui-variant/<screen> עם הערך הנכון. הרצה: node scripts/variant-toggle-audit/build.mjs && node scripts/variant-toggle-audit/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, '../../public');
const PORT = Number(process.env.AUDIT_PORT || 5191); // לא 3000
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const f = [path.join(HERE, u), path.join(PUB, u)].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  if (!f) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [תרחיש, צפוי: placement | null, יעד, לפתוח את חלון הדיווח?]
const CASES = [
  ['profile-new', 'header', 'legacy'], ['profile-old', 'corner', 'a5'],
  ['admin-new', 'header', 'legacy'], ['admin-old', 'corner', 'a5'],
  ['att-new', 'header', 'legacy'], ['att-old', 'corner', 'a5'],
  ['att-emp', null], // /employees/<id>/attendance - אין גרסה ישנה
  ['er-new', 'window', 'legacy', true], ['er-old', 'overlay', 'a5', true],
];
let fails = 0;
const results = [];
const check = (cond, msg) => { if (!cond) { fails++; console.error('  FAIL -', msg); } };

async function probe(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('.gm-pvt')];
    return els.map((el) => {
      const b = el.querySelector('.gm-pvt-btn');
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      const ic = b.querySelector('svg.gm-pvt-ic');
      return {
        cls: el.className, target: el.getAttribute('data-pvt-target'), label: b.getAttribute('aria-label'), tip: b.getAttribute('data-tip'),
        w: r.width, h: r.height, x: r.left, y: r.top, vw: innerWidth, vh: innerHeight,
        radius: cs.borderTopLeftRadius, bg: cs.backgroundImage, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, color: cs.color,
        cursor: cs.cursor, pos: getComputedStyle(el).position, z: getComputedStyle(el).zIndex,
        icon: !!ic && ic.querySelectorAll('path').length > 0, iconStroke: ic ? getComputedStyle(ic).stroke : null,
        hit: (() => { const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === b || b.contains(t)); })(),
      };
    });
  });
}

for (const width of [1280, 375]) {
  for (const [scn, placement, target, openEr] of CASES) {
    for (const allow of [true, false]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: width === 375 ? 812 : 900 });
      await page.goto(`http://127.0.0.1:${PORT}/?scn=${scn}&allow=${allow ? 1 : 0}`, { waitUntil: 'networkidle0' });
      await sleep(400);
      if (openEr) { await page.click('.icon-btn'); await sleep(1800); } // הגיליון התחתון בנייד נכנס באנימציה
      const found = await probe(page);
      const tag = `${scn} @${width}${allow ? '' : ' (not allowed)'}`;
      if (!allow || !placement) {
        check(found.length === 0, `${tag}: האייקון מוצג למרות שאסור (${found.length})`);
      } else {
        check(found.length >= 1, `${tag}: אין אייקון`);
        const f = found.find((x) => x.cls.includes(`gm-pvt-${placement}`));
        check(!!f, `${tag}: אין אייקון במיקום ${placement} (${found.map((x) => x.cls).join(', ')})`);
        if (f) {
          check(f.target === target, `${tag}: יעד ${f.target} במקום ${target}`);
          check(f.label === (target === 'a5' ? 'מעבר לתצוגה החדשה' : 'חזרה לתצוגה הישנה'), `${tag}: תווית ${f.label}`);
          check(Math.abs(f.w - f.h) < 0.5 && f.w >= 32, `${tag}: לא עגול/קטן ${f.w}x${f.h}`);
          check(f.radius === '50%' || parseFloat(f.radius) >= f.w / 2 - 0.5, `${tag}: radius ${f.radius}`);
          check(/linear-gradient/.test(f.bg), `${tag}: רקע ${f.bg}`);
          // 1.5px כמו בפלטה; Chrome מעגל רוחב מסגרת לפיקסל מכשיר (ב-DPR 1 מחושב 1px - כמו .ibtn של הפלטה עצמה)
          check(/^1(\.5)?px solid rgb\(0, 0, 0\)/.test(f.border), `${tag}: מסגרת ${f.border}`);
          check(f.icon, `${tag}: אין אייקון swap`);
          check(f.x >= 0 && f.y >= 0 && f.x + f.w <= f.vw && f.y + f.h <= f.vh + (placement === 'header' ? 400 : 0), `${tag}: מחוץ למסך ${JSON.stringify([f.x, f.y, f.w, f.h])}`);
          check(f.hit, `${tag}: משהו מכסה את האייקון`);
          if (placement === 'corner' || placement === 'overlay') {
            check(f.pos === 'fixed', `${tag}: לא fixed`);
            check(f.x < f.vw / 2, `${tag}: לא בצד שמאל (RTL inline-end)`);
          }
          if (placement === 'header' || placement === 'window') check(f.tip === f.label, `${tag}: data-tip (טולטיפ המערכת)`);
          results.push({ tag, ...f });
        }
      }
      await page.screenshot({ path: path.join(OUT, `${scn}-${width}${allow ? '' : '-deny'}.png`) });
      await page.close();
    }
  }
}

// נתיב קיוסק / שעון: גם רשאי לא רואה אייקון (חלון הדיווח הישן על /punch-clock)
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/?scn=er-old&path=/punch-clock`, { waitUntil: 'networkidle0' });
  await sleep(300);
  await page.click('.icon-btn'); await sleep(800);
  check((await probe(page)).length === 0, 'er-old /punch-clock: האייקון מוצג בנתיב אסור');
  await page.close();
}

// לחיצה: POST עם הערך הנכון ואז טעינה מחדש
for (const [scn, screen, value, openEr] of [['profile-old', 'profile', 'a5'], ['admin-new', 'admin_hub', 'legacy'], ['er-old', 'error_report', 'a5', true]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/?scn=${scn}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => sessionStorage.removeItem('pvt-calls'));
  await sleep(300);
  if (openEr) { await page.click('.icon-btn'); await sleep(800); }
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => null), page.click('.gm-pvt .gm-pvt-btn')]);
  const calls = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pvt-calls') || '[]'));
  const post = calls.find((c) => c.method === 'POST' && c.url.startsWith('/api/me/ui-variant/'));
  check(post && post.url === `/api/me/ui-variant/${screen}` && JSON.parse(post.body).value === value, `${scn}: לחיצה - ${JSON.stringify(post)}`);
  await page.close();
}

// טולטיפ משלו בפינה (דף ישן): מופיע בריחוף
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/?scn=profile-old`, { waitUntil: 'networkidle0' });
  await sleep(300);
  await page.hover('.gm-pvt .gm-pvt-btn'); await sleep(300);
  const tt = await page.evaluate(() => { const t = document.querySelector('.gm-pvt-tt'); const cs = getComputedStyle(t); const r = t.getBoundingClientRect(); return { text: t.textContent, op: cs.opacity, bg: cs.backgroundColor, x: r.left, w: r.width, vw: innerWidth }; });
  check(tt.text === 'מעבר לתצוגה החדשה' && Number(tt.op) > 0.9 && tt.x >= 0 && tt.x + tt.w <= tt.vw, `טולטיפ בפינה: ${JSON.stringify(tt)}`);
  await page.screenshot({ path: path.join(OUT, 'profile-old-tooltip.png') });
  await page.close();
}

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
for (const r of results) console.log(`  ${r.tag.padEnd(26)} ${r.cls.replace('gm-pvt ', '').padEnd(28)} ${r.w}x${r.h} r=${r.radius} pos=${r.pos} @(${Math.round(r.x)},${Math.round(r.y)}) ${r.border}`);
console.log(fails ? `\n${fails} FAILED` : `\nALL PASSED (${results.length} placements + deny/forced/click/tooltip checks)`);
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
