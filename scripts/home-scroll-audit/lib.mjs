// שרת סטטי + Chrome + מדידות גלילה לבדיקת הגלילה בדף הבית (תצוגת טבלה + "עוד N").
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, '../../public');
export const PORT = Number(process.env.SCROLL_AUDIT_PORT || 5181); // לא 3000 — שרת הפיתוח המשותף
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function serve(port = PORT) {
  const s = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    const f = [path.join(HERE, u), path.join(PUB, u)].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (!f) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => s.listen(port, '127.0.0.1', () => r(s)));
}
export const launch = () => puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// שרשרת האבות של אלמנט עם הערכים שקובעים אם גלילה אפשרית/חסומה
export const CHAIN = (sel) => {
  const el = document.querySelector(sel);
  const out = [];
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const cs = getComputedStyle(e);
    out.push({
      el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 3).map((c) => '.' + c).join(''),
      ox: cs.overflowX, oy: cs.overflowY, pos: cs.position, h: cs.height, mh: cs.maxHeight,
      sh: e.scrollHeight, ch: e.clientHeight, ob: cs.overscrollBehaviorY, ta: cs.touchAction, ct: cs.contain,
    });
  }
  return out;
};
export const metrics = () => {
  const se = document.scrollingElement;
  return { top: Math.round(se.scrollTop), sh: se.scrollHeight, ch: se.clientHeight, bodyOY: getComputedStyle(document.body).overflowY, htmlOY: getComputedStyle(document.documentElement).overflowY };
};
