// ניקוי דגמי הבדיקה "בדיקת A5 דגם חדש (למחיקה)" ממסד ה-TEST (מחיקה רכה דרך ה-API: פריטים ואז הדגם). לא נוגע בשום דגם אחר. הרצה: node scripts/model-new-audit/cleanup-test-models.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^AGENT_LOGIN_SECRET=(.*)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 240000, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto(`http://localhost:3071/api/dev/agent-login?secret=${SECRET}`, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
await p.goto('http://localhost:3071/dashboard/dresses', { waitUntil: 'load', timeout: 120000 });
const out = await p.evaluate(async () => {
  const mode = (await fetch('/api/dev/switch-env').then((r) => r.json())).mode;
  if (mode !== 'test') return { aborted: mode };
  const list = await fetch('/api/dresses?advName=' + encodeURIComponent('בדיקת A5') + '&filterStatus=all&limit=50').then((r) => r.json());
  const res = [];
  for (const m of list.data || []) {
    if (!/^בדיקת A5 דגם חדש \(למחיקה\)/.test(m.name) || m.isDeleted) continue;
    for (const it of m.items || []) if (!it.isDeleted) await fetch(`/api/dresses/items/${it.id}`, { method: 'DELETE' });
    const d = await fetch(`/api/dresses/${m.id}`, { method: 'DELETE' });
    res.push([m.barcodePrefix, m.items.length, d.status]);
  }
  return { deleted: res };
});
console.log(JSON.stringify(out));
await b.close();
