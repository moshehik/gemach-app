// בדיקת התנהגות בדפדפן (headless) על החבילה המדומה (dist, אחרי build.mjs): סימון -> טיוטה -> שמור; הסרת יום שמור (NW-I2) = טיוטה
// "יוסר" בלי חלון אישור -> שמור; גם הסרת תאריך קבוע שמור בלי חלון (NW-I4); טווח = רק "N ימים נבחרו" ולחצן "סמן" (NW-I5);
// תאריך קבוע מלוח עברי ננעל על תשפ״ז (NW-I8); ביטול שורה; צפייה בלבד בלי לחצני עריכה. node scripts/nwd-audit/interact.mjs
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
await step('הסרת יום שמור (NW-I2): בלי חלון אישור - שורה "יוסר" בטיוטה, השמור לא משתנה', async () => {
  await sleep(500);
  const before = await p.evaluate(() => window.__saved);
  await (await p.$('.cl-row .cl-u')).click(); await sleep(300);
  assert.equal(await p.$('#dlg'), null, 'אין חלון');
  assert.ok(await p.$('.cl-row.cl-gone'));
  assert.match(await text(p, '#nw-sum'), /יוסר הסימון/);
  assert.equal(await p.evaluate(() => window.__saved), before);
});
await step('סימון מחדש של יום שמור שהוסר בטיוטה: ההערה השמורה מתמלאת בשדה ולא נדרסת', async () => {
  await p.click('.cl-row.cl-gone'); await sleep(250);
  assert.equal(await p.$eval('#nw-note', (e) => e.value), 'חופשה', 'שדה ההערה מלא בהערה השמורה');
  await p.$eval('.cl-side .rcard:not(#nw-sum) .btn.primary.lg', (b) => b.click()); await sleep(250);
  assert.equal(await p.$('.cl-row.cl-gone'), null, 'הסימון חזר');
  assert.match(await text(p, '#nw-sum'), /הכול שמור/, 'אותה הערה = בלי שינוי');
  await (await p.$('.cl-row .cl-u')).click(); await sleep(250); // חוזרים למצב "יוסר" להמשך הבדיקה
  assert.ok(await p.$('.cl-row.cl-gone'));
});
await step('"שמור" היחיד מחיל את ההסרה', async () => {
  const before = await p.evaluate(() => window.__saved);
  await (await p.$('#nw-sum .btn.primary')).click(); await sleep(700);
  assert.notEqual(await p.evaluate(() => window.__saved), before);
  assert.match(await text(p, '#nw-sum'), /הכול שמור/);
});
await step('טווח (NW-I5): רק "N ימים נבחרו", בלי תגיות ובלי מספר נוסף, ולחצן "סמן" פשוט', async () => {
  const cells = await p.$$eval(free, (els) => els.map((e) => e.dataset.d));
  await p.click(`.lz-day[data-d="${cells[0]}"]`); await sleep(100);
  await p.keyboard.down('Shift'); await p.click(`.lz-day[data-d="${cells[cells.length - 1]}"]`); await p.keyboard.up('Shift'); await sleep(200);
  assert.match(await text(p, '.cl-side .cl-eh'), /ימים נבחרו/);
  assert.equal(await p.$('.cl-sum'), null);
  assert.equal(await p.$('.cl-side .chip.gold'), null, 'אין תגית');
  assert.doesNotMatch(await text(p, '.cl-side'), /יסומנו|כבר מסומנים|סגורים בלאו הכי|עברו \(נעולים\)/);
  const btn = await p.$eval('.cl-side .btn.primary.lg', (b) => b.textContent.trim());
  assert.equal(btn, 'סמן');
});
await step('יום סגור (שבת / חג / חול המועד): אין לחצן סימון, הסבר "אי אפשר לסמן אותו כפתוח"', async () => {
  await (await p.$('.lz-day.cl-auto:not(.dim)')).click(); await sleep(150);
  assert.equal(await p.$('.cl-side .btn.primary.lg'), null);
  assert.match(await text(p, '.cl-side'), /אי אפשר לסמן אותו כפתוח/);
});
await step('תאריך קבוע (NW-I8): לוח עברי ננעל על תשפ״ז - בלי select ובלי שנה; כל יום וחודש לחיצים; הוספה לטיוטה, כפול נדחה', async () => {
  assert.equal(await p.$('#nw-fixed select'), null, 'אין select');
  assert.ok(await p.$('#nw-fx-cal.hc'));
  assert.doesNotMatch(await text(p, '#nw-fx-title'), /\d|תשפ/, 'השנה מוסתרת');
  assert.equal(await p.$eval('#nw-fx-title', (e) => e.textContent.trim()), 'שבט');
  await p.click('#nw-fx-prev'); await p.click('#nw-fx-prev'); await sleep(100);
  assert.equal(await p.$eval('#nw-fx-title', (e) => e.textContent.trim()), 'כסלו');
  assert.equal((await p.$$('#nw-fx-cal .hc-d')).length, 30, 'כסלו תשפ״ז: ל׳ ימים - גם יום ל׳ לחיץ');
  await p.click('#nw-fx-cal .hc-d[data-m="Kislev"][data-d="25"]'); await sleep(100);
  await p.$eval('#nw-fixed .btn.lg', (b) => b.click()); await sleep(200); // לא .click() אמיתי: הטוסט של הפעולה הקודמת עלול לכסות את הלחצן
  assert.match(await text(p, '#nw-fixed'), /כ״ה בכסלו/);
  assert.match(await text(p, '#nw-sum'), /ייסגר בכל שנה/);
  await p.$eval('#nw-fixed .btn.lg', (b) => b.click()); await sleep(200); // הטוסט (פינה שמאלית למטה) מכסה את הלחצן בצילום
  assert.match(await text(p, '#toast'), /כבר ברשימה/);
});
await step('תאריך קבוע: אדר ב׳ נשמר כ-Adar, אדר א׳ כ-Adar I; ל׳ בחשוון/כסלו ואדר א׳ מציגים את ההערה המתאימה', async () => {
  for (let i = 0; i < 8; i++) { if ((await p.$eval('#nw-fx-title', (e) => e.textContent.trim())) === 'אדר א׳') break; await p.click('#nw-fx-next'); await sleep(60); }
  assert.equal(await p.$eval('#nw-fx-title', (e) => e.textContent.trim()), 'אדר א׳');
  await p.click('#nw-fx-cal .hc-d[data-m="Adar I"][data-d="30"]'); await sleep(100);
  assert.match(await text(p, '#nw-fixed'), /אדר א׳ קיים רק בשנה מעוברת/);
  await p.click('#nw-fx-next'); await sleep(100);
  assert.equal(await p.$eval('#nw-fx-title', (e) => e.textContent.trim()), 'אדר ב׳');
  assert.equal((await p.$$('#nw-fx-cal .hc-d')).length, 29, 'אדר ב׳: כ״ט ימים');
  await p.click('#nw-fx-cal .hc-d[data-m="Adar"][data-d="14"]'); await sleep(100);
  assert.match(await text(p, '#nw-fixed'), /בשנה מעוברת נסגר באדר ב׳/);
  await p.$eval('#nw-fixed .btn.lg', (b) => b.click()); await sleep(200);
  await p.click('#nw-sum .btn.primary'); await sleep(700);
  const saved = JSON.parse(await p.evaluate(() => window.__saved));
  assert.ok(saved.recurringHebrew.some((r) => r.month === 'Adar' && r.day === 14), 'אדר ב׳ ט״ו... י״ד נשמר כ-Adar');
  assert.ok(saved.recurringHebrew.some((r) => r.month === 'Kislev' && r.day === 25));
  assert.ok(!saved.recurringHebrew.some((r) => r.month === 'Adar II'), 'לא נשמר Adar II');
});
await step('לוח התאריך הקבוע (נגישות): עצירת Tab אחת, חיצים ב-RTL, ו-aria-disabled בקצה בלי לאבד פוקוס', async () => {
  const stops = await p.$$eval('#nw-fx-cal .hc-d', (els) => els.filter((e) => e.tabIndex === 0).map((e) => e.dataset.d));
  assert.equal(stops.length, 1, 'עצירת Tab אחת');
  await p.focus('#nw-fx-cal .hc-d[tabindex="0"]');
  const cur = () => p.evaluate(() => Number(document.activeElement.dataset.d));
  const d0 = await cur();
  await p.keyboard.press('ArrowLeft'); await sleep(80);
  assert.equal(await cur(), d0 + 1, 'חץ שמאלה = היום הבא (RTL)');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await sleep(80);
  assert.equal(await cur(), d0 - 1);
  await p.keyboard.press('ArrowDown'); await sleep(80);
  assert.equal(await cur(), d0 + 6, 'חץ למטה = שבוע');
  await p.keyboard.press('Home'); await sleep(80); assert.equal(await cur(), 1);
  await p.keyboard.press('End'); await sleep(80); assert.equal(await cur(), 29, 'אדר ב׳: כ״ט');
  for (let i = 0; i < 8; i++) await p.$eval('#nw-fx-next', (b) => b.click());
  await sleep(100);
  assert.equal(await p.$eval('#nw-fx-title', (e) => e.textContent.trim()), 'אלול');
  assert.equal(await p.$eval('#nw-fx-next', (b) => b.getAttribute('aria-disabled')), 'true');
  assert.equal(await p.$eval('#nw-fx-next', (b) => b.disabled), false, 'לא disabled (הפוקוס נשאר)');
  await p.focus('#nw-fx-next'); await p.keyboard.press('Enter'); await sleep(100);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'nw-fx-next', 'הפוקוס נשאר על הלחצן');
  assert.equal(await p.$eval('#nw-fx-title', (e) => e.textContent.trim()), 'אלול', 'לא עברנו את אלול');
});
await step('הסרת תאריך קבוע שמור (NW-I4): בלי חלון אישור, שורה "יוסר" בטיוטה, ורק "שמור" מחיל', async () => {
  const before = await p.evaluate(() => window.__saved);
  await (await p.$('#nw-fixed .cl-u')).click(); await sleep(300);
  assert.equal(await p.$('#dlg'), null, 'אין חלון');
  assert.ok(await p.$('#nw-fixed .cl-row.cl-gone'));
  assert.equal(await p.evaluate(() => window.__saved), before);
  await (await p.$('#nw-sum .btn.primary')).click(); await sleep(700);
  assert.notEqual(await p.evaluate(() => window.__saved), before);
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
const nb = await page('?board=no');
await step('הקישור "ללוח החודשי": מוצג למי שיכול לפתוח את הלוח, מוסתר למי שלא', async () => {
  assert.ok(await p.$('.lz-dtools a[href="/board"]'));
  assert.equal(await nb.$('.lz-dtools a[href="/board"]'), null);
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
