// בדיקת התנהגות בדפדפן (headless) על החבילה המדומה (dist, אחרי build.mjs): סימון -> טיוטה -> שמור; הסרה -> חלון כהה ->
// טיוטה -> שמור; Escape סוגר את החלון; ביטול שורה; צפייה בלבד בלי לחצני עריכה. node scripts/nwd-audit/interact.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const PUB = path.resolve(HERE, '../../public');
const PORT = Number(process.env.AUDIT_PORT || 5193);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = [path.join(HERE, u), path.join(PUB, u)].find((c) => fs.existsSync(c) && fs.statSync(c).isFile()); if (!f) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0; const fail = [];
const step = async (name, fn) => { try { await fn(); ok++; console.log('  ok   -', name); } catch (e) { fail.push(name); console.log('  FAIL -', name, e.message); } };
const page = async (q = '') => { const p = await browser.newPage(); p.on('pageerror', (e) => fail.push('pageerror ' + e.message)); await p.setViewport({ width: 1366, height: 900 }); await p.goto(`http://127.0.0.1:${PORT}/index.html${q}`, { waitUntil: 'networkidle0' }); await sleep(400); return p; };
const text = (p, sel) => p.$eval(sel, (e) => e.textContent);
const free = '.lz-day:not(.cl-auto):not(.cl-past):not(.cl-man):not(.cl-fx):not(.dim)';

const p = await page();
await step('סימון יום: נכנס לטיוטה (מונה 1, "יש שינויים"), התא "לא נשמר", ושום דבר לא נשמר עדיין', async () => {
  await (await p.$(free)).click(); await sleep(150);
  await p.type('#nw-note', 'בדיקה'); await (await p.$('.cl-side .btn.primary.lg')).click(); await sleep(200);
  assert.equal((await text(p, '#nw-sum .cart-h .badge')).trim(), '1');
  assert.match(await text(p, '#nw-sum'), /יש שינויים שלא נשמרו/);
  assert.ok(await p.$('.lz-day.cl-man.cl-pend'));
  assert.equal(await p.evaluate(() => window.__saved), undefined);
});
await step('ביטול שורה בכרטיס הסיכום מחזיר את השמור', async () => {
  await (await p.$('#nw-sum .cl-u')).click(); await sleep(150);
  assert.match(await text(p, '#nw-sum'), /הכול שמור/);
  assert.equal(await p.$('.lz-day.cl-pend'), null);
});
await step('סימון ושמירה: POST /api/settings עם מסמך גרסה 2 שכולל את היום וההערה', async () => {
  const k = await p.$eval(free, (e) => e.dataset.d); await (await p.$(`.lz-day[data-d="${k}"]`)).click(); await sleep(150);
  await p.type('#nw-note', 'חופשה'); await p.keyboard.press('Enter'); await sleep(150);
  await (await p.$('#nw-sum .btn.primary')).click(); await sleep(700);
  const saved = JSON.parse(await p.evaluate(() => window.__saved));
  assert.equal(saved.version, 2);
  assert.ok([...saved.days.map((d) => d.date), ...saved.ranges.flatMap((r) => [r.from, r.to])].includes(k), 'היום נשמר');
  assert.ok(JSON.stringify(saved).includes('חופשה'));
  assert.match(await text(p, '#nw-sum'), /הכול שמור/);
});
await step('הסרת יום שמור: חלון כהה (#dlg בתוך .gm-ds.dlg-dark), Escape סוגר בלי שינוי', async () => {
  await (await p.$('.cl-row .cl-u')).click(); await sleep(300);
  assert.ok(await p.$('.gm-ds.gm-nw.dlg-dark .scrim.on #dlg'));
  await p.keyboard.press('Escape'); await sleep(300);
  assert.equal(await p.$('#dlg'), null);
  assert.match(await text(p, '#nw-sum'), /הכול שמור/);
});
await step('הסרה מאושרת נכנסת לטיוטה (שורה "יוסר", "יוסר אחרי שמירה" בתא) ונשמרת רק ב"שמור"', async () => {
  const before = await p.evaluate(() => window.__saved);
  await (await p.$('.cl-row .cl-u')).click(); await sleep(300);
  await (await p.$('#dlg [data-yes]')).click(); await sleep(300);
  assert.ok(await p.$('.cl-row.cl-gone'));
  assert.equal(await p.evaluate(() => window.__saved), before);
  await (await p.$('#nw-sum .btn.primary')).click(); await sleep(700);
  assert.notEqual(await p.evaluate(() => window.__saved), before);
});
await step('יום סגור (שבת / חג / חול המועד): אין לחצן סימון, הסבר "אי אפשר לסמן אותו כפתוח"', async () => {
  await (await p.$('.lz-day.cl-auto:not(.dim)')).click(); await sleep(150);
  assert.equal(await p.$('.cl-side .btn.primary.lg'), null);
  assert.match(await text(p, '.cl-side'), /אי אפשר לסמן אותו כפתוח/);
});
await step('תאריך קבוע: הוספה לטיוטה, כפול נדחה', async () => {
  await p.select('#nw-fx-m', 'Kislev'); await p.select('#nw-fx-d', '25'); await sleep(100);
  await (await p.$('#nw-fixed .btn.lg')).click(); await sleep(200);
  assert.match(await text(p, '#nw-fixed'), /כ״ה בכסלו/);
  assert.match(await text(p, '#nw-sum'), /ייסגר בכל שנה/);
  await p.$eval('#nw-fixed .btn.lg', (b) => b.click()); await sleep(200); // הטוסט (פינה שמאלית למטה) מכסה את הלחצן בצילום
  assert.match(await text(p, '#toast'), /כבר ברשימה/);
});
// הדף שומר טיוטה בכל שינוי, ו-beforeunload עדיין מופיע כשיש שינויים: ב-reload של הבדיקה מאשרים אותו. הדפדפן הזה חולק localStorage עם
// העמוד הראשון (שהשאיר טיוטה), לכן מנקים ואז טוענים מחדש כדי להתחיל בלי באנר ממתין.
const d1 = await page();
d1.on('dialog', (d) => d.accept());
await d1.evaluate(() => localStorage.clear());
await d1.reload({ waitUntil: 'networkidle0' }); await sleep(400);
const markOne = async (pg) => { await (await pg.$(free)).click(); await sleep(150); await (await pg.$('.cl-side .btn.primary.lg')).click(); await sleep(200); };
await step('טיוטה מקומית: שינוי שלא נשמר נכתב ל-localStorage; ביקור חוזר מציג באנר שחזר / מחק; שחזור מחזיר את השינוי', async () => {
  await markOne(d1);
  const raw = await d1.evaluate(() => localStorage.getItem('gemachNwdDraft:5'));
  assert.ok(raw && JSON.parse(raw).value.includes('"days"'), 'draft written');
  await d1.reload({ waitUntil: 'networkidle0' }); await sleep(400);
  assert.ok(await d1.$('#nw-draft'), 'banner');
  assert.match(await text(d1, '#nw-draft'), /שינוי אחד/);
  assert.match(await text(d1, '#nw-sum'), /הכול שמור/, 'nothing applied before the decision');
  await d1.click('#nw-draft [data-act="draft-restore"]'); await sleep(250);
  assert.equal(await d1.$('#nw-draft'), null);
  assert.equal((await text(d1, '#nw-sum .cart-h .badge')).trim(), '1');
  assert.ok(await d1.$('.lz-day.cl-pend'));
});
await step('טיוטה מקומית: אחרי שחזור היא נשארת; "בטל שינויים" מוחק אותה (ביקור חוזר בלי באנר)', async () => {
  await d1.reload({ waitUntil: 'networkidle0' }); await sleep(400);
  assert.ok(await d1.$('#nw-draft'), 'draft survived the restore');
  await d1.click('#nw-draft [data-act="draft-restore"]'); await sleep(250);
  await d1.click('#nw-sum [data-act="discard"]'); await sleep(250);
  assert.equal(await d1.evaluate(() => localStorage.getItem('gemachNwdDraft:5')), null);
  await d1.reload({ waitUntil: 'networkidle0' }); await sleep(400);
  assert.equal(await d1.$('#nw-draft'), null);
});
await step('טיוטה מקומית: "מחק טיוטה" משאיר את השמור; שמירה מוחקת את הטיוטה', async () => {
  await markOne(d1);
  await d1.reload({ waitUntil: 'networkidle0' }); await sleep(400);
  await d1.click('#nw-draft [data-act="draft-discard"]'); await sleep(250);
  assert.equal(await d1.$('#nw-draft'), null);
  assert.match(await text(d1, '#nw-sum'), /הכול שמור/);
  assert.equal(await d1.evaluate(() => localStorage.getItem('gemachNwdDraft:5')), null);
  await markOne(d1);
  await (await d1.$('#nw-sum .btn.primary')).click(); await sleep(800);
  assert.equal(await d1.evaluate(() => localStorage.getItem('gemachNwdDraft:5')), null, 'cleared after a successful save');
  await d1.reload({ waitUntil: 'networkidle0' }); await sleep(400);
  assert.equal(await d1.$('#nw-draft'), null);
});
await step('נגישות: לוח הימים role=group; אזור ה-live קטן (לא כל כרטיס העריכה)', async () => {
  assert.equal(await d1.$('[role="grid"]'), null);
  assert.ok(await d1.$('.hc-g[role="group"]'));
  assert.equal(await d1.$('.cl-side [aria-live]:not(.sr-only):not(.nb):not(#toast) > .rcard'), null);
  await (await d1.$(free)).click(); await sleep(200);
  assert.ok((await text(d1, '.cl-side .sr-only[role="status"]')).trim().length > 5);
});
const d2 = await page('?fail=' + encodeURIComponent('רצף הימים הסגורים ארוך מדי: בדיקה'));
d2.on('dialog', (d) => d.accept());
await d2.evaluate(() => localStorage.clear());
await d2.reload({ waitUntil: 'networkidle0' }); await sleep(400);
await step('הודעת שגיאה מהשרת / מהאימות נשארת על המסך (באנר), ונעלמת בעריכה הבאה', async () => {
  await markOne(d2);
  await (await d2.$('#nw-sum .btn.primary')).click(); await sleep(600);
  assert.match(await text(d2, '.cl-side .cl-wrn [role="alert"]'), /רצף הימים הסגורים ארוך מדי/);
  await sleep(4200); // הטוסט נעלם
  assert.match(await text(d2, '.cl-side .cl-wrn [role="alert"]'), /רצף הימים הסגורים ארוך מדי/);
  await d2.click('#nw-sum [data-act="discard"]'); await sleep(250);
  assert.equal(await d2.$('.cl-side [role="alert"]'), null);
});
const v = await page('?role=view');
await step('צפייה בלבד: בלי כרטיס סיכום, בלי לחצני הסרה / הוספה', async () => {
  assert.equal(await v.$('#nw-sum'), null);
  assert.equal(await v.$('.cl-u'), null);
  assert.equal(await v.$('#nw-fx-m'), null);
  assert.match(await text(v, '.cl-side'), /צפייה בלבד/);
});
console.log(`\n${ok} passed${fail.length ? ', FAILED: ' + fail.join(' | ') : ''}`);
await browser.close(); server.close();
process.exit(fail.length ? 1 : 0);
