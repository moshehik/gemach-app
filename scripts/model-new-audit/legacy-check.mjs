// בדיקת הגרסה הישנה של "דגם חדש" (/dashboard/dresses/new): עקיפה אישית 'legacy' (POST /api/me/ui-variant/model_new), טעינת הדף, בדיקה שהאשף הישן (.stepper, "הוספת דגם חדש") מוצג,
// אין שגיאות קונסול, אייקון המעבר "לתצוגה החדשה" בפינה, שהאשף החדש לא נטען; ואז החזרת העקיפה (value:null). נוגע רק בהעדפת התצוגה של משתמש הבדיקה במסד ה-TEST.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^AGENT_LOGIN_SECRET=(.*)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', '-', m); if (!c) process.exitCode = 1; };
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 240000, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
p.on('pageerror', (e) => errors.push('pageerror ' + String(e).slice(0, 160)));
await p.goto(`http://localhost:3071/api/dev/agent-login?secret=${SECRET}`, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
await p.goto('http://localhost:3071/dashboard/dresses', { waitUntil: 'load', timeout: 120000 });
const post = (v) => p.evaluate((v) => fetch('/api/me/ui-variant/model_new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: v }) }).then((r) => r.status), v);
try {
  ok((await post('legacy')) === 200, "עקיפה אישית model_new='legacy'");
  await p.goto('http://localhost:3071/dashboard/dresses/new', { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('.stepper', { timeout: 120000 });
  const h1 = await p.$eval('h1', (e) => e.textContent);
  ok(/הוספת דגם חדש/.test(h1), `האשף הישן מוצג: "${h1}"`);
  ok(!(await p.$('.gm-mn')), 'האשף החדש לא נטען');
  await p.waitForSelector('.gm-pvt', { timeout: 15000 }).catch(() => {});
  ok(!!(await p.$('.gm-pvt')), 'אייקון המעבר "לתצוגה החדשה" מוצג בפינה');
  const steps = await p.$$eval('.stepper .step', (s) => s.map((x) => x.textContent.trim()));
  ok(steps.length === 4, `4 שלבים בישן: ${steps.join(' | ')}`);
  await p.waitForFunction(() => document.getElementById('dress-new-code')?.value, { timeout: 60000 }).catch(() => {});
  ok(/^\d{3}$/.test(await p.$eval('#dress-new-code', (e) => String(e.value))), 'הקוד הפנוי נטען בישן');
  ok(errors.filter((e) => !/404|favicon|Failed to load resource/.test(e)).length === 0, `אין שגיאות קונסול בישן (${errors.length ? errors.join(' || ') : 'נקי'})`);
} finally {
  // החזרת העקיפה בדף חדש ויציב (הדף הנבדק עלול להיטען מחדש באמצע - HMR של שרת הפיתוח)
  const q = await b.newPage();
  await q.goto('http://localhost:3071/dashboard/dresses', { waitUntil: 'load', timeout: 120000 });
  const r = await q.evaluate(() => fetch('/api/me/ui-variant/model_new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: null }) }).then((x) => x.status));
  console.log('  restore override:', r);
  await b.close();
}
