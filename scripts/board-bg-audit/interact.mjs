// בדיקת התנהגות של הלוח האמיתי בדפדפן (API מדומה מ-entry.jsx): חיפוש (search לשרת) וניקוי, ניווט חודשים (חצים במסך
// ובמקלדת, "החודש הנוכחי", בורר החודשים), מתג לוח/רשימה, מסנן השלבים, לחיצה על יום (לו״ז), אייקון "מורחב", תפריט
// הפעולות, חלונית הפרטים, חלון ההשכרה (ביטול השכרה -> "בטוח?" -> PUT), החלון הקיים (אותו hook), השער. OK/FAIL; יוצא 1 בכישלון.
// שימוש: node scripts/board-bg-audit/interact.mjs   (אחרי build.mjs)
import { serve, launch, sleep, PORT } from './lib.mjs';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
p.on('dialog', async (d) => { errs.push('BROWSER DIALOG: ' + d.message()); await d.dismiss(); });
const go = async (scn) => { await p.goto(`http://127.0.0.1:${PORT}/${scn ? '?scn=' + scn : ''}`, { waitUntil: 'load' }); await sleep(1300); };
const calls = () => p.evaluate(() => window.__calls);
const nav = () => p.evaluate(() => window.__nav);
const click = async (sel) => { await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' })); await p.click(sel); await sleep(300); };
const title = () => p.$eval('#mJump', (e) => e.textContent.trim());
const ordersCalls = async () => (await calls()).filter((c) => c.url.startsWith('/api/orders?'));

await go('');
let c = await ordersCalls();
ok(c.length >= 1 && /eventDateFrom=.*eventDateTo=.*filterStatus=all.*limit=2000/.test(c[0].url), 'טעינת החודש: /api/orders עם eventDateFrom/To, filterStatus=all, limit=2000');
ok((await calls()).some((x) => /^\/api\/board\/stages\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/.test(x.url)), 'מוני השלבים: /api/board/stages?from&to');
ok(await p.evaluate(() => !document.body.textContent.match(/\b\d{1,2}\/\d{1,2}\b/)), 'אין תאריך לועזי בדף');
for (const gone of ['חיפוש מתקדם', 'שאלות סטטיסטיקה', 'חיפוש חכם', 'הדפסת הזמנות להכנה', 'מקרא', 'תפעול', 'ללו״ז של היום']) ok(!(await p.evaluate((t) => document.body.innerHTML.includes(t), gone)), 'הוסר: ' + gone);
ok(await p.evaluate(() => { const a = document.querySelector('#mToday').getBoundingClientRect().height; const v = document.querySelector('#mvsw').getBoundingClientRect().height; return Math.abs(a - v) < 0.5; }), 'S04: "החודש הנוכחי" בגובה מתג התצוגה');
ok(await p.evaluate(() => [...document.querySelectorAll('.lz-day')].every((d) => { const n = d.querySelectorAll('.bd-co').length; const ex = !!d.querySelector('.bd-ex'); return !(ex && n) ; })), 'JDG-3: תא עם אייקון "מורחב" (מעל 2) בלי שורות הזמנה, ועד 2 - שורות');
ok(await p.evaluate(() => { const r = getComputedStyle(document.querySelector('.lz-pr:not(.al)')).backgroundColor; return [...document.querySelectorAll('.lz-pr:not(.al)')].every((x) => getComputedStyle(x).backgroundColor === r); }), 'S02: כל המונים בלי התראה באותו גוון');
ok(await p.evaluate(() => { const a = document.querySelector('.lz-pr.al'); const n = document.querySelector('.lz-pr:not(.al)'); return a && getComputedStyle(a).backgroundColor !== getComputedStyle(n).backgroundColor; }), 'S02: מונה עם התראה בגוון אחר');

// חיפוש
await p.type('#bdQ', 'כהן'); await p.keyboard.press('Enter'); await sleep(600);
c = await ordersCalls();
ok(/search=%D7%9B%D7%94%D7%9F/.test(c[c.length - 1].url), 'E01: Enter שולח search לשרת');
await click('#bdSearch .hf-cl'); await sleep(500);
c = await ordersCalls();
ok(!/search=/.test(c[c.length - 1].url) && (await p.$eval('#bdQ', (e) => e.value)) === '', 'E01: ניקוי מאפס את החיפוש');

// ניווט חודשים
const t0 = await title();
await click('#month .hc-nn'); const t1 = await title();
ok(t1 !== t0, 'חץ "החודש הבא" מחליף חודש (' + t0 + ' -> ' + t1 + ')');
await p.mouse.click(5, 300); await p.keyboard.press('ArrowRight'); await sleep(400);
ok((await title()) === t0, 'S09: חץ ימינה במקלדת = החודש הקודם');
await p.keyboard.press('ArrowLeft'); await sleep(400);
ok((await title()) === t1, 'S09: חץ שמאלה במקלדת = החודש הבא');
await click('#mToday'); ok((await title()) === t0 && (await p.$eval('#mToday', (e) => e.getAttribute('aria-pressed'))) === 'true', 'S04: "החודש הנוכחי" חוזר לחודש של היום');
await click('#mJump');
ok((await p.$$('.bd-mp .bd-mpd')).length === 13, 'S07: בורר 13 חודשים');
await p.evaluate(() => document.querySelectorAll('.bd-mp .bd-mpd')[2].click()); await sleep(500);
ok((await title()) !== t0 && !(await p.$('.bd-mp')), 'בחירת חודש בבורר מזיזה את הלוח וסוגרת את הבורר');
await click('#mToday');
ok((await p.$$('.rv-jbtn, .lz-jw .ic-cal')).length === 0, 'S07: בלי אייקון יומן ליד הכותרת');

// מסנן שלבים
const before = await p.$$eval('.lz-pr', (x) => x.length);
await click('#bdSearch .hf-t');
ok(await p.$eval('#bdSearch .hf-sel', (e) => e.classList.contains('on')), 'S01: לחצן הסינון פותח את הרשימה');
await click('#bdSearch .hf-o:nth-child(6)'); // אירוע
const after = await p.$$eval('.lz-pr', (x) => x.length);
ok(after < before && after > 0, 'S01: סימון שלב מסנן את המונים בתאים (' + before + ' -> ' + after + ')');
ok((await p.$eval('#bdSearch .hf-bdg', (e) => e.textContent)) === '1', 'S01: תג המספר על לחצן הסינון');
await click('#bdSearch .hf-allb');
ok((await p.$$eval('.lz-pr', (x) => x.length)) === before, 'S01: "הצג הכל" מחזיר את כל המונים');
await p.keyboard.press('Escape'); await sleep(200);

// לחיצה על יום / מורחב / תפריט
await p.evaluate(() => document.querySelector('.lz-day .lz-dh b').click()); await sleep(200);
ok(/^\/schedule\?date=\d{4}-\d{2}-\d{2}$/.test((await nav()).slice(-1)[0] || ''), 'S06: לחיצה על יום -> /schedule?date=');
await click('.lz-day .bd-ex');
ok(!!(await p.$('.dlg.bd-day')), 'E17: אייקון "מורחב" פותח את חלון היום');
const n0 = await p.$$eval('.bd-day .bd-or', (x) => x.length);
await p.type('#bdDayQ', '510'); await sleep(200);
ok((await p.$$eval('.bd-day .bd-or', (x) => x.length)) <= n0, 'E17: שדה הסינון בחלון');
await p.$eval('#bdDayQ', (e) => { e.value = ''; }); await click('.bd-day .inpx');
await p.hover('.bd-day .bd-info'); await sleep(300);
ok(!!(await p.$('.pl-rt.bd-rt')) && !(await p.evaluate(() => document.querySelector('.pl-rt.bd-rt').textContent.includes('לועזי'))), 'E14: חלונית פרטים בריחוף, בלי תאריך לועזי');
ok(await p.$eval('.bd-day .bd-info', (e) => getComputedStyle(e).borderRadius === '50%'), 'E14: לחצן המידע עגול');
await p.mouse.move(2, 2); await sleep(200);
await click('.bd-day .bd-or .li');
ok((await p.$$eval('.bd-menu-w .menu button', (x) => x.map((b) => b.textContent.trim()))).join('|').includes('כרטיס הזמנה'), 'E15: תפריט פעולות');
await p.evaluate(() => [...document.querySelectorAll('.bd-menu-w .menu button')].find((x) => /כרטיס הזמנה/.test(x.textContent)).click()); await sleep(200);
ok(/^\/orders\/\d+$/.test((await nav()).slice(-1)[0]), 'E15: "כרטיס הזמנה" -> /orders/<id>');
await click('.bd-day .bd-or .li');
await p.evaluate(() => [...document.querySelectorAll('.bd-menu-w .menu button')].find((x) => /כרטיס השכרה/.test(x.textContent)).click()); await sleep(900);
ok(!!(await p.$('.dlg.bd-rent')) && !(await p.$('.dlg.bd-day')), 'E16: "כרטיס השכרה" פותח את חלון ההשכרה (וסוגר את חלון היום)');
ok((await calls()).some((x) => /^\/api\/orders\/\d+$/.test(x.url)), 'E16: טעינת ההזמנה /api/orders/<id>');
await click('.bd-rent .bd-ri:nth-child(3) .bd-danger'); // ביטול השכרה
ok(!!(await p.$('#dlg.bd-cf')), 'E16: "ביטול השכרה" -> חלון "בטוח?" של הפלטה (לא confirm של הדפדפן)');
await click('#dlg.bd-cf .btn.primary'); await sleep(400);
ok((await calls()).some((x) => x.url === '/api/rentals/cancel' && x.method === 'PUT' && /orderItemId/.test(x.body)), 'E16: אישור -> PUT /api/rentals/cancel');
await click('.bd-rent .bd-ri:nth-child(1) .btn.primary'); // השכרה
await p.type('.bd-rin input', '4512380001'); await p.keyboard.press('Enter'); await sleep(500);
ok((await calls()).some((x) => x.url === '/api/rentals/scan' && /itemIdToForce/.test(x.body)), 'E16: השכרה לפריט -> POST /api/rentals/scan עם itemIdToForce');
await p.type('.bd-scan input', '189310002'); await p.keyboard.press('Enter'); await sleep(600);
ok(!!(await p.$('#dlg.bd-cf')) || (await calls()).some((x) => x.url.startsWith('/api/returns/scan')), 'E16: סריקה מהירה של פריט מושכר -> החזרה (או שאלת איחור)');
if (await p.$('#dlg.bd-cf')) { await click('#dlg.bd-cf .btn.ghost'); await sleep(500); }
// חלון קופץ של האתר מעל (אישור מנהל / הדפסה ומייל = .modal-backdrop): Esc שלו לא סוגר את חלון ההשכרה
await p.evaluate(() => { const d = document.createElement('div'); d.className = 'modal-backdrop'; d.id = 'fakePop'; d.innerHTML = '<input id="fakePin">'; document.body.appendChild(d); document.getElementById('fakePin').focus(); });
await p.keyboard.press('Escape'); await sleep(400);
ok(!!(await p.$('.dlg.bd-rent')) && !(await p.$('#dlg.bd-cf')), 'Esc בחלון קופץ מעל (modal-backdrop) לא סוגר את חלון ההשכרה');
await p.evaluate(() => document.getElementById('fakePop').remove());
await p.focus('.bd-scan input');
await p.keyboard.press('Escape'); await sleep(500);
if (await p.$('#dlg.bd-cf')) { await click('#dlg.bd-cf .btn.primary'); await sleep(500); }
ok(!(await p.$('.dlg.bd-rent')) || !!(await p.$('#dlg.bd-cf')), 'E16: Esc = סגירת החלון (עם בדיקת שינויים)');

// בלי הרשאה ללו״ז: לחיצה על יום פותחת את חלון היום
await go('noschedule');
await p.evaluate(() => { const d = [...document.querySelectorAll('.lz-day')].find((x) => x.querySelector('.bd-co')); d.querySelector('.lz-dh b').click(); }); await sleep(400);
ok(!!(await p.$('.dlg.bd-day')), 'S06: בלי page:schedule - לחיצה על יום פותחת את חלון "הזמנות ליום"');
// בלי מונים (403) - הלוח עובד
await go('nostages');
ok((await p.$$('.lz-day')).length >= 29 && (await p.$$('.lz-pr')).length === 0, 'כשל במונים: הלוח מוצג בלי מונים');
// טעינה
await go('loading');
ok(await p.evaluate(() => document.body.textContent.includes('טוען נתונים...') && !!document.querySelector('.bd-loading .mspin')), 'E18: "טוען נתונים..."');
// הדפסת יום רק בארגון עם enable_batch_print_prep
await go('bpp'); await click('.lz-day .bd-ex');
await p.evaluate(() => document.querySelector('.bd-day [aria-label="הדפסת פרוט ההזמנות ליום זה"]').click()); await sleep(200);
ok(/\/print\/order\?orderId=[\d,]+&type=order&batch=1/.test((await p.evaluate(() => window.__opened)).slice(-1)[0] || ''), 'E17: הדפסת היום (enable_batch_print_prep) -> /print/order?...&batch=1');
await go(''); await click('.lz-day .bd-ex');
ok(!(await p.$('.bd-day [aria-label="הדפסת פרוט ההזמנות ליום זה"]')), 'בלי ההגדרה - אין הדפסת יום');
// שער
await go('gate');
ok(await p.evaluate(() => document.body.textContent.includes('אין הרשאת גישה') && !!document.querySelector('.gm-gate .dlg.dk')), 'E19: חלון "אין הרשאה" בעיצוב החדש');
await go('guest');
ok(await p.evaluate(() => document.body.textContent.includes('כניסה למערכת')), 'UNV-4: אורח - "כניסה למערכת"');
// החלון הקיים עובד עם אותו hook
await go('legacy'); await sleep(500);
ok(await p.evaluate(() => document.body.textContent.includes('השכרה והחזרה — הזמנה #51001')), 'RentalReturnModal (הקיים) נטען דרך useRentalReturn');
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /ביטול השכרה/.test(x.textContent)).click()); await sleep(500);
ok((await calls()).some((x) => x.url === 'customConfirm') && (await calls()).some((x) => x.url === '/api/rentals/cancel'), 'החלון הקיים: customConfirm + PUT /api/rentals/cancel כמו קודם');

ok(errs.length === 0, 'אין שגיאות קונסול / pageerror / חלונות דפדפן' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
await b.close(); s.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
