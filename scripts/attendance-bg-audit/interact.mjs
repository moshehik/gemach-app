// בדיקת התנהגות של הדף האמיתי בדפדפן (API מדומה מ-entry.jsx / data.mjs): ניווט בין התצוגות, מיון, פתיחת שורה, עימוד "לפי עובד",
// הוספה / עריכה / מחיקה / שחזור (גוף הבקשות), חלון ההיסטוריה, האשף והחלונית המהירה, XL (הנהלה בלבד), PDF עם גיבוי להדפסה,
// ותצוגת עובדת (בלי שכר, בלי XL). מדפיס OK/FAIL; יוצא 1 בכישלון. שימוש: node interact.mjs [רוחב=1280]  (אחרי build.mjs)
import { serve, launch, sleep, PORT } from './lib.mjs';
const width = Number(process.argv[2] || 1280);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|status of 500/.test(m.text())) errs.push(m.text()); });
const go = async (qs) => { await p.goto(`http://127.0.0.1:${PORT}/?${qs}`, { waitUntil: 'load' }); await sleep(1300); };
const calls = () => p.evaluate(() => window.__calls);
const text = (sel) => p.evaluate((q) => { const e = document.querySelector(q); return e ? e.textContent : null; }, sel);
const count = (sel) => p.evaluate((q) => document.querySelectorAll(q).length, sel);
const click = async (sel) => { const has = await p.evaluate((q) => { const e = document.querySelector(q); if (e) { e.scrollIntoView({ block: 'center' }); e.click(); } return !!e; }, sel); await sleep(450); return has; };
const toast = () => text('#toast');

// ---- הנהלה: חודש ----
await go('role=mgr');
ok((await text('#atH1')) === 'סיכום נוכחות', 'כותרת "סיכום נוכחות"');
ok(/ספטמבר 2026/.test(await text('.at-per b')), 'ברירת המחדל: החודש הקודם (AT-11) - ספטמבר 2026');
ok(await count('#mNow') === 1, '"החודש" מוצג (החודש המוצג אינו הנוכחי)');
ok(await count('tr.at-r') === 9, '9 עובדים בטבלה');
ok(/^\d+:\d\d$/.test((await text('tr.at-r[data-id="e1"] td:nth-child(2)')).trim()), 'שעות בפורמט h:mm (AT-06)');
ok((await text('tr.at-r[data-id="e1"] td:nth-child(3)')).trim() === '18', 'כמות ימים = ימים שונים (שתי משמרות ביום = 1, AT-04)');
await click('.tsb.td[aria-label="מיון ס״ה שעות יורד"]');
const firstAfterSort = await p.evaluate(() => document.querySelector('tr.at-r').dataset.id);
ok(firstAfterSort === 'e9' || firstAfterSort === 'e3', 'מיון לפי שעות יורד (' + firstAfterSort + ')');
await click('tr.at-r[data-id="e1"]');
ok(await count('tr.at-det .at-sh tbody tr') === 19, 'פתיחת שורה: 19 משמרות של העובדת');
ok(/סה״כמשמרות:19/.test((await text('.at-sum')).replace(/\s/g, '')), 'בפירוט: סה״כ משמרות = מספר המשמרות (19)');
await click('#mNow');
ok(/אוקטובר 2026/.test(await text('.at-per b')) && (await count('#mNow')) === 0, '"החודש" עובר לאוקטובר ונעלם');
await click('#mPrev');
ok(/ספטמבר 2026/.test(await text('.at-per b')), 'חץ חודש קודם');
await click('#cbt-month'); await click('.cb-o[data-cbv="7"]');
ok(/אוגוסט 2026/.test(await text('.at-per b')), 'תיבת הבחירה של החודש');

// ---- "לפי עובד" + עימוד ----
await click('[data-view="byemp"]');
await sleep(500);
ok((await text('#atCt')).includes('שרה כהן'), '"לפי עובד" נפתח על העובדת הראשונה');
ok(await count('tr.at-mrow') === 20, 'עד 20 שורות בעמוד (AT-14)');
ok(/עמוד 1 מתוך 2/.test(await text('.at-pgt')), '"עמוד 1 מתוך 2"');
const tot1 = await text('.at-tbl tfoot');
await click('.at-pg [data-pg="1"]');
ok(await count('tr.at-mrow') === 2 && (await text('.at-tbl tfoot')) === tot1, 'עמוד 2: שתי שורות, אותו סה״כ לכל התקופה');
await click('tr.at-mrow .at-open');
ok((await text('#atH1')) === 'נוכחות עובד', 'עיפרון בשורת חודש -> דף העריכה (AT-15)');
await click('#atBack');
ok((await text('#atCt')).includes('סיכום לפי עובד'), 'חזרה מדף העריכה ל"לפי עובד"');

// ---- דף העריכה ----
await go('role=mgr&view=emp&emp=e4');
ok(await count('.ea-tbl .chip.gold.at-man') >= 3, 'שורות שנערכו / נוספו ידנית מסומנות "נערך ידנית" (AT-12)');
const tip = await p.evaluate(() => document.querySelector('.at-man').dataset.tip);
ok(/^(נערך|נוסף ידנית) ע״י .+ · .+ \d\d:\d\d$/.test(tip), 'טולטיפ: מי ומתי (' + tip + ')');
await click('.ec-tool .btn:not(.primary)');
ok(await count('#dlg.at-hist .at-hli') >= 4 && (await count('#dlg.at-hist .btn:not(.ghost)')) === 1, 'היסטוריית שינויים + לחצן לכרטיס העובד (AT-16)');
await p.keyboard.press('Escape'); await sleep(300);
ok(await count('#dlg.at-hist') === 0, 'Escape סוגר את ההיסטוריה');
await click('.ec-tool .btn.primary');
await p.type('#aEn', '0900'); await p.type('#aEx', '1300');
await click('.ec-add .acts .btn.primary');
// התאריך ברירת המחדל = 1 בחודש המוצג -> נשלח
let c = (await calls()).filter((x) => x.method === 'POST');
const body = c.length ? JSON.parse(c[0].body) : {};
ok(c.length === 1 && /\/api\/employees\/e4\/shifts$/.test(c[0].url) && body.date === '2026-09-01T00:00:00.000Z' && body.entryTime === '2026-09-01T06:00:00.000Z' && body.exitTime === '2026-09-01T10:00:00.000Z' && body.displayedMonth === 8, 'POST: תאריך, כניסה ויציאה בשעון ישראל, החודש המוצג ' + JSON.stringify(body));
await click('button[aria-label="ערוך רק כניסה ויציאה"]');
await p.$eval('#eEx', (el) => { el.value = ''; });
await p.type('#eEx', '1530');
await click('.ea-tbl tr.edit .btn.primary');
c = (await calls()).filter((x) => x.method === 'PUT');
const pb = c.length ? JSON.parse(c[0].body) : {};
ok(c.length === 1 && Object.keys(pb).sort().join() === 'entryTime,exitTime' && /T12:30:00.000Z$/.test(pb.exitTime), 'PUT: רק כניסה ויציאה ' + JSON.stringify(pb));
await click('button[aria-label="מחק"]');
ok(/האם אתה בטוח שברצונך למחוק משמרת זו\?/.test(await text('#dlg')), 'חלון אישור מחיקה');
await click('#dlg .btn.ghost');
ok((await calls()).filter((x) => x.method === 'DELETE').length === 0, 'ביטול - לא נמחק');
await click('button[aria-label="מחק"]'); await click('#dlg .btn.primary');
ok((await calls()).filter((x) => x.method === 'DELETE').length === 1, 'אישור - DELETE נשלח');
await p.$eval('#showDel', (el) => el.click()); await sleep(600);
ok(await count('.ea-tbl tr.del') >= 1, '"הצג מחוקות" מציג שורות מחוקות');
await click('button[aria-label="שחזר"]'); await click('#dlg .btn.primary');
c = (await calls()).filter((x) => x.method === 'PUT');
ok(c.length === 2 && JSON.parse(c[1].body).isDeleted === false, 'שחזור: PUT isDeleted:false');

// ---- האשף, החלונית המהירה, XL, PDF ----
await go('role=mgr');
await click('#atTools .xlbtn.xlp');
ok(await count('#dlg.lz-wiz:not(.lz-quick)') === 1 && (await count('#wzType button')) === 3, 'אשף מלא: שלושה סוגי דוח');
ok(await count('#wzList .lz-wr') === 9 && /\(9\)/.test(await text('#wzGo')), 'כל העובדים מסומנים');
ok(!/סיסמ/.test(await text('#dlg')), 'בלי סיסמת מאשר (AT-08)');
await click('#wzGo');
ok(await count('#pv.on iframe.pv-frame') === 1 && /print\?type=full&ids=e1%2Ce2/.test(await p.$eval('#pv iframe', (f) => f.getAttribute('src'))), 'הדפסה -> תצוגה מקדימה של דף ההדפסה (כל העובדים ברצף)');
await sleep(1500);
ok(/עמודים?/.test((await text('#pvN')) || ''), 'מספר עמודים בתצוגה המקדימה: ' + (await text('#pvN')));
await click('#pvClose');
await click('#atTools .xlbtn.xld'); await click('#wzGo'); await sleep(400);
await click('#pvGo'); await sleep(1500);
ok(/לא ניתן להפיק PDF כרגע/.test(await toast() || ''), 'PDF: השרת נכשל -> טוסט והדפסה רגילה (AT-07)');
await click('#pvClose');
await click('#atTools .xlbtn.xlg'); await sleep(500);
await click('#wzGo'); await sleep(1500);
ok(/קובץ ה-Excel ירד/.test(await toast() || ''), 'XL ירד בלי סיסמה');
await click('tr.at-r[data-id="e2"] .at-rt .xlbtn.xlp');
ok(await count('#dlg.lz-quick') === 1 && (await count('#wzList .lz-wr')) === 1 && /רחל לוי/.test(await text('#wzT')), 'חלונית מהירה לעובדת אחת');

// ---- עובדת ----
await go('role=emp');
ok((await text('#atH1')) === 'השעות שלי' && (await count('.xlbtn.xlg')) === 0, 'עובדת: "השעות שלי", בלי XL (JDG-04)');
ok(!/₪/.test(await text('#atBody')), 'עובדת: בלי שכר');
ok(await count('.at-edit') === 1, 'עובדת: "עריכת הנוכחות שלי"');
await click('.at-edit');
ok((await text('#atH1')) === 'נוכחות עובד' && (await count('.ea-tbl.nopay')) === 1 && !(await text('#atBody')).includes('₪'), 'עובדת: דף העריכה בלי עמודת תשלום');
await click('.ec-tool .btn:not(.primary)');
ok(await count('#dlg.at-hist .btn:not(.ghost)') === 0, 'עובדת: היסטוריה בלי קישור לכרטיס העובד');
await p.keyboard.press('Escape'); await sleep(300);
await click('#atTools .xlbtn.xlp');
ok(await count('#dlg.lz-quick') === 1 && /לאה פרידמן/.test(await text('#wzT')), 'עובדת: הדפסה של הדוח שלה בלבד');
await p.keyboard.press('Escape'); await sleep(300);
await click('#atBack'); await click('[data-view="byemp"]'); await sleep(500);
ok(await count('tr.at-mrow') >= 1 && (await count('.at-tbl thead th')) === 5, 'עובדת: "לפי עובד" בלי עמודות ס״ה / נסיעות');

ok(errs.length === 0, 'בלי שגיאות קונסול / דף' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close(); s.close();
process.exit(fails ? 1 : 0);
