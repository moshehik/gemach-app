// צילומי מסך של הדף האמיתי (dist) מול העיצוב המאושר, במחשב (1366) ובטלפון (390). שרת סטטי מקומי (לא פורט 3000).
// node scripts/nwd-audit/shots.mjs [outDir]    (אחרי build.mjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, '../../public');
const OUT = process.argv[2] || path.join(HERE, 'shots');
const PORT = Number(process.env.AUDIT_PORT || 5191);
const DEMO = process.env.DEMO_HTML || 'file:///C:/Users/moshe/Desktop/' + encodeURI('גמח שמלות חדש/תצוגות-עיצוב/סיימתי-לעבוד/ימי-אי-פעילות.html');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = [path.join(HERE, u), path.join(PUB, u)].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  if (!f) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
async function shot(name, url, { w = 1366, h = 900, act } = {}) {
  const p = await browser.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'networkidle0' });
  await sleep(600);
  if (act) await act(p);
  await sleep(500);
  const info = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  await p.close();
  return info;
}
const ours = `http://127.0.0.1:${PORT}/index.html`;
const freeDay = async (p) => { const el = await p.$('.lz-day:not(.cl-auto):not(.cl-past):not(.cl-man):not(.cl-fx):not(.dim)'); if (el) await el.click(); };
const res = {};
res.ours_desktop = await shot('ours-desktop', ours);
res.ours_desktop_sel = await shot('ours-desktop-selected', ours, { act: freeDay });
res.ours_desktop_range = await shot('ours-desktop-range', ours, { act: async (p) => { await (await p.$('.hc-nn')).click(); await sleep(300); const els = await p.$$('.lz-day:not(.cl-past):not(.dim)'); if (els.length > 12) { await els[3].click(); await p.keyboard.down('Shift'); await els[12].click(); await p.keyboard.up('Shift'); } } });
res.ours_desktop_confirm = await shot('ours-desktop-confirm', ours, { act: async (p) => { const b = await p.$('.cl-row .cl-u'); if (b) await b.click(); } });
res.ours_desktop_draft = await shot('ours-desktop-draft', ours, { act: async (p) => { await freeDay(p); await sleep(200); const m = await p.$('.cl-side .btn.primary'); if (m) await m.click(); } });
res.ours_view = await shot('ours-view', ours + '?role=view', { act: freeDay });
res.ours_mobile = await shot('ours-mobile', ours, { w: 390, h: 844 });
res.ours_mobile_sel = await shot('ours-mobile-selected', ours, { w: 390, h: 844, act: freeDay });
res.demo_desktop = await shot('demo-desktop', DEMO);
res.demo_mobile = await shot('demo-mobile', DEMO, { w: 390, h: 844 });
console.log(JSON.stringify(res));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close(); server.close();
