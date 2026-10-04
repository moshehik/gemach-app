// שרת סטטי קטן + Chrome headless לבדיקת "סיכום נוכחות" מול העיצוב (כמו scripts/profile-bg-audit/lib.mjs, תיקייה ופורט משלו).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, '../../public');
export const PORT = Number(process.env.AUDIT_PORT || 5187); // לא 3000 - שרת הפיתוח המשותף
export const DEMO = process.env.DEMO_HTML || 'file:///C:/Users/moshe/Desktop/' + encodeURI('גמח שמלות חדש/תצוגות-עיצוב/סיכום-נוכחות.html');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png' };
export function serve(port = PORT) {
  const s = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    if (u === '/attendance/print') u = '/print.html'; // דף ההדפסה (iframe של התצוגה המקדימה) - אותו מטען מדומה
    const f = [path.join(HERE, u), path.join(PUB, u)].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (!f) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => s.listen(port, '127.0.0.1', () => r(s)));
}
export const launch = () => puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
