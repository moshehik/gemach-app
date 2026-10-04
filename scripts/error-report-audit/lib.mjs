// שרת סטטי קטן + Chrome headless לבדיקת חלון "דיווח על שגיאות" מול הסקיצה המאושרת (אותו מתכון כמו scripts/profile-bg-audit/lib.mjs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, '../../public');
export const PORT = Number(process.env.AUDIT_PORT || 5187); // לא 3000 - שרת הפיתוח המשותף
export const DEMO = process.env.DEMO_HTML || 'file:///C:/Users/moshe/Desktop/' + encodeURI('גמח שמלות חדש/תצוגות-עיצוב/דיווח-שגיאות-סקיצות-2.html');
export const OUT = process.env.ER_AUDIT_OUT || path.join(HERE, 'out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.txt': 'text/plain' };
export function serve(port = PORT) {
  const s = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    if (u.startsWith('/api/error-report/sketch/')) u = '/mock/sketch.html';
    const f = [path.join(HERE, u), path.join(PUB, u)].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (!f) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => s.listen(port, '127.0.0.1', () => r(s)));
}
export const launch = () => puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
