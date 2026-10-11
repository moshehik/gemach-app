// בדיקת קצה-לקצה ליצירת דגם באשף "דגם חדש" (A5) - רק מול מסד ה-TEST (נבדק ב-/api/dev/switch-env לפני כל כתיבה; אחרת יוצאים).
// יוצר דגם בדיקה בשם "בדיקת A5 דגם חדש (למחיקה)" עם 3 פריטים, בודק: זיהוי קוד תפוס חי, הודעת "הקוד כבר קיים", יצירה מוצלחת, מסך "הדגם נוצר",
// המעבר לכרטיס /dashboard/dresses/<id>, שהנתונים בשרת זהים ל-payload (ברקודים, מיקומים, קטגוריה, הערות), ואז מוחק את הפריטים והדגם (מחיקה רכה דרך ה-API).
// הרצה: node scripts/model-new-audit/e2e-create.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^AGENT_LOGIN_SECRET=(.*)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
const BASE = 'http://localhost:3071';
// שם הדגם ב-DB ייחודי (גם לדגמים שנמחקו רכות; השרת מחזיר 500 כללי) - לכן סיומת ייחודית לכל הרצה
const NAME = `בדיקת A5 דגם חדש (למחיקה) ${Date.now() % 1000000}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', '-', m); if (!c) process.exitCode = 1; };
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 240000, args: ['--no-sandbox'] });
const p = await browser.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto(`${BASE}/api/dev/agent-login?secret=${SECRET}`, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
await p.goto(`${BASE}/dashboard/dresses/new`, { waitUntil: 'load', timeout: 120000 });
await p.waitForSelector('.gm-mn #mnCode', { timeout: 120000 });
const mode = await p.evaluate(() => fetch('/api/dev/switch-env').then((r) => r.json()).then((j) => j.mode));
if (mode !== 'test') { console.log('ABORT: dev server mode is', mode); await browser.close(); process.exit(2); }
console.log('dev server mode: test');
const logs = []; p.on('console', (m) => { if (['error','warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); }); p.on('pageerror', (e) => logs.push('pageerror ' + String(e).slice(0, 200))); p.on('framenavigated', (f) => { if (f === p.mainFrame()) logs.push('nav ' + f.url().replace(SECRET, '***')); });
await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
const typeIn = async (sel, text) => { await p.focus(sel); await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace'); if (text) await p.type(sel, text, { delay: 5 }); };
const js = (sel) => p.$eval(sel, (e) => e.click());
const text = (sel) => p.$eval(sel, (e) => e.textContent).catch(() => null);
const shots = path.join(ROOT, '..', 'model-new-shots'); fs.mkdirSync(shots, { recursive: true });

// 1. הקוד הפנוי נטען מראש
await p.waitForFunction(() => (document.getElementById('mnCode')?.value || '').length > 0, { timeout: 60000 });
const pre = await p.$eval('#mnCode', (e) => e.value);
const nextApi = await p.evaluate(() => fetch('/api/dresses/next-code').then((r) => r.json()).then((j) => String(j.nextCode)));
ok(pre === nextApi, `הקוד הפנוי נטען מראש (${pre} = next-code ${nextApi})`);

// 2. קוד תפוס: קוד של דגם קיים
const existing = await p.evaluate(() => fetch('/api/dresses?filterStatus=active&fields=summary&limit=1').then((r) => r.json()).then((j) => String(j.data[0].barcodePrefix)));
await typeIn('#mnCode', existing); await p.waitForFunction(() => /\S/.test(document.getElementById('mnCodeE')?.textContent || ''), { timeout: 20000 }).catch(() => {});
const dupMsg = await text('#mnCodeE');
ok(/הקוד כבר קיים במאגר/.test(dupMsg || ''), `קוד תפוס (${existing}) מזוהה חי: "${dupMsg}"`);
await typeIn('#mnName', 'x'); await js('#mnCatT'); await js('.cb-o');
const nextDisabled = await p.$eval('#navTop [data-act=next]', (e) => e.disabled);
ok(nextDisabled, 'עם קוד תפוס "המשך" כבוי');
await p.screenshot({ path: path.join(shots, 'e2e-1-dup.png') });

// 3. מילוי תקין
await typeIn('#mnCode', pre); await typeIn('#mnName', NAME); await sleep(900);
ok(!(await text('#mnCodeE')), 'קוד פנוי - אין הודעת שגיאה');
await js('#navTop [data-act=next]'); await sleep(300);
await typeIn('#mnNotes', 'הערת בדיקה אוטומטית'); await js('#mnInsp button');
await js('#navTop [data-act=next]'); await sleep(300);
await typeIn('#mnSize', '38'); await js('[data-act=add-item]'); await sleep(200);
await js('[data-act=add-item]'); await sleep(200);
await typeIn('#mnSize', '40'); await js('[data-act=add-item]'); await sleep(200);
const rows = await p.$$eval('#stepCard .hrow', (r) => r.length);
ok(rows === 3, `3 שורות מלאי ראשוני (${rows})`);
const bcs = await p.$$eval('#stepCard .hrow .lni bdi', (b) => b.map((x) => x.textContent));
ok(bcs.join() === [`${pre}3801`, `${pre}3802`, `${pre}4001`].join(), `ברקודים: ${bcs.join(', ')}`);
await js('#navTop [data-act=next]'); await sleep(300);
await p.screenshot({ path: path.join(shots, 'e2e-2-summary.png'), fullPage: true });

// 4. יצירה
await js('#navTop [data-act=create]');
await p.waitForSelector('#dlg .success', { timeout: 30000 }).then(() => p.screenshot({ path: path.join(shots, 'e2e-busy-real.png') })).catch(() => {});
await p.waitForSelector('.status.ok', { timeout: 240000 }).catch(async (e) => { console.log('FAILED waiting for saved view. url:', p.url(), ' logs:', logs.slice(-12).join(' | '), ' toast:', await text('#toast'), ' busy dlg:', !!(await p.$('#dlg .success'))); throw e; });
await p.screenshot({ path: path.join(shots, 'e2e-3-saved.png'), fullPage: true });
const savedTxt = await text('.status.ok');
ok(savedTxt.includes(pre), `מסך "הדגם נוצר": ${savedTxt}`);
await p.waitForFunction(() => /\/dashboard\/dresses\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 60000 });
const id = p.url().split('/').pop();
ok(!!id, `מעבר אוטומטי לכרטיס הדגם (${id.slice(0, 8)})`);

// 5. אימות בשרת
const model = await p.evaluate((id) => fetch(`/api/dresses/${id}?includeDeleted=true`).then((r) => r.json()), id);
ok(model.name === NAME && String(model.barcodePrefix) === pre, `הדגם בשרת: ${model.name} / ${model.barcodePrefix}`);
ok(model.notes === 'הערת בדיקה אוטומטית' && model.inInspection === true, 'הערות ו"הצג בבדיקה" נשמרו');
ok(!!model.priceCategory, `קטגוריה: ${model.priceCategory}`);
const items = (model.items || []).map((i) => `${i.dressBarcode}:${i.sizeText}:${i.serialNumber}:${i.location}`).sort();
ok(items.length === 3, `3 פריטים בשרת: ${items.join(' | ')}`);

// 6. ניקוי (מחיקה רכה: פריטים ואז הדגם)
const res = await p.evaluate(async (id) => {
  const m = await fetch(`/api/dresses/${id}?includeDeleted=true`).then((r) => r.json());
  for (const it of m.items || []) await fetch(`/api/dresses/items/${it.id}`, { method: 'DELETE' });
  const d = await fetch(`/api/dresses/${id}`, { method: 'DELETE' });
  return d.status;
}, id);
ok(res === 200, `ניקוי: הדגם והפריטים נמחקו (${res})`);
await browser.close();
