// בדיקת התנהגות של הלוח האמיתי בדפדפן (API מדומה מ-entry.jsx): חיפוש (search לשרת) וניקוי, ניווט חודשים (חצים במסך
// ובמקלדת, "החודש הנוכחי", בורר החודשים), מתג לוח/רשימה, מסנן השלבים, לחיצה על יום = הלו״ז היומי בעכבר / Enter / Ctrl (BD-O3,
// בלי חלון בשום מצב, גם בלי הרשאה ללו״ז), בתא וברשימה רק מונים וסמנים (BD-O4 / BD-O5), הגדרות איחור, השער, והחלון הקיים של
// ההשכרה והחזרה (אותו hook, נשאר ב-/orders ו-/rentals). OK/FAIL; יוצא 1 בכישלון.
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
ok(await p.evaluate(() => document.querySelectorAll('.lz-day').length >= 29 && !document.querySelector('.lz-day .bd-co, .lz-day .bd-cos, .lz-day .bd-ex, .lz-day button, .lz-day .chip, .lz-day article')), 'BD-O4: בתא רק אות יום + סמנים + מונים - אין שורות הזמנה, אין אייקון "מורחב", אין לחצנים');
ok(await p.evaluate(() => [...document.querySelectorAll('.lz-day')].every((d) => [...d.children].every((c) => /lz-dh|bd-notes|lz-rows/.test(c.className)))), 'BD-O4: תוכן התא = כותרת (lz-dh) + פרשה/חגים + מונים (lz-rows) בלבד');
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

// לחיצה על יום (BD-O3): תמיד -> דף הלו״ז של היום, בלי חלון, בעכבר ובמקלדת (Enter על הקישור)
const noDlg = () => p.evaluate(() => !document.querySelector('.scrim, [role=dialog]:not(.bd-mp), .dlg, #dlg, .bd-day, .bd-rent, .bd-menu-w'));
await p.evaluate(() => document.querySelector('.lz-day .lz-dh b').click()); await sleep(200);
ok(/^\/schedule\?date=\d{4}-\d{2}-\d{2}$/.test((await nav()).slice(-1)[0] || '') && await noDlg(), 'S06 / BD-O3: לחיצה על אות היום -> /schedule?date= (בלי חלון)');
const navN0 = (await nav()).length;
await p.evaluate(() => document.querySelectorAll('.lz-day')[10].click()); await sleep(200);
const navA = await nav();
ok(navA.length === navN0 + 1 && navA[navA.length - 1] === '/schedule?date=' + await p.evaluate(() => document.querySelectorAll('.lz-day')[10].getAttribute('data-d')) && await noDlg(), 'BD-O3: לחיצה על שטח התא (לא על הקישור) -> אותו יום, בלי חלון');
await p.focus('.lz-day .bd-dlink'); await p.keyboard.press('Enter'); await sleep(200);
const navB = await nav();
ok(navB.length === navA.length + 1 && /^\/schedule\?date=\d{4}-\d{2}-\d{2}$/.test(navB[navB.length - 1]), 'BD-O3: Enter על קישור היום במקלדת -> /schedule?date= (a11y: קישור אמיתי)');
ok(await p.evaluate(() => { const a = document.querySelector('.lz-day .bd-dlink'); return a.tagName === 'A' && /^\/schedule\?date=\d{4}-\d{2}-\d{2}$/.test(a.getAttribute('href')) && !!a.getAttribute('aria-label'); }), 'BD-O3: כל יום = <a href="/schedule?date=..."> עם aria-label');
// Ctrl+לחיצה = התנהגות קישור רגילה: הקוד לא מבטל את ברירת המחדל (אחרת הדפדפן לא פותח טאב חדש) ולא מנווט בצד הלקוח.
// מאזין על שורש האפליקציה (אחרי React) רושם אם ברירת המחדל עדיין פעילה, ואז מבטל אותה כדי שהבדיקה לא תפתח טאב אמיתי.
const navC0 = (await nav()).length;
const ctrlDefault = await p.evaluate(() => new Promise((res) => {
  const a = document.querySelector('.lz-day .bd-dlink');
  const root = document.getElementById('root');
  const h = (e) => { root.removeEventListener('click', h); res(!e.defaultPrevented); e.preventDefault(); };
  root.addEventListener('click', h); // אחרי המאזין של React על אותו צומת (נרשם ראשון)
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
}));
await sleep(150);
ok(ctrlDefault === true && (await nav()).length === navC0, 'BD-O3: Ctrl+לחיצה לא מנווט בצד הלקוח וברירת המחדל של הקישור נשמרת (נפתח בטאב חדש כמו כל קישור)');
// אין יותר ערוץ לחלון היום / תפריט הזמנה / חלון השכרה: אותה התנהגות גם בלי הרשאה ללו״ז ובלי מונים
for (const scn of ['noschedule', 'bpp', 'nostages']) {
  await go(scn);
  const k0 = (await nav()).length;
  await p.evaluate(() => document.querySelectorAll('.lz-day')[3].querySelector('.bd-dlink').click()); await sleep(300);
  const nv = await nav();
  ok(nv.length === k0 + 1 && /^\/schedule\?date=/.test(nv[nv.length - 1]) && await noDlg(), 'BD-O3: ' + scn + ' - לחיצה על יום עדיין /schedule?date= ובלי חלון (אין חלופה לפי הרשאה)');
}
await go('');
ok(await p.evaluate(() => !document.querySelector('.bd-or, .bd-info, .pl-rt, .bd-menu-w, .bd-rent, .bd-day, [aria-haspopup=menu]')), 'BD-O3: אין בדף שורות הזמנה / לחצן מידע / תפריט הזמנה / חלון השכרה / חלון יום');
ok(!(await calls()).some((x) => /^\/api\/orders\/\d+/.test(x.url) || /\/api\/(rentals|returns)\//.test(x.url)), 'BD-O3: הלוח לא קורא לשום API של השכרה / החזרה / הזמנה בודדת');
ok(await p.evaluate(() => !!document.querySelector('.gm-pvt') === false), 'מתג ישן/חדש: לא מוצג בלי הרשאת מעבר (בהרצה זו אין UiVariantContext)');
ok(await p.evaluate(() => document.querySelector('.topbar .ttl .pg-ttl')?.textContent.trim() === 'לוח חודשי'), 'JDG-1: כותרת "לוח חודשי"');
// BD-O5: תצוגת רשימה = כותרת יום + מונים בלבד (בלי שורות הזמנה)
await click('#mvsw .vopt:nth-child(3)');
ok(await p.evaluate(() => document.querySelectorAll('.bd-lday').length > 5 && [...document.querySelectorAll('.bd-lday')].every((d) => !!d.querySelector('.hday.bd-hday') && !d.querySelector('.bd-or, article, .chip')) && [...document.querySelectorAll('.bd-lday')].filter((d) => d.querySelectorAll('.bd-lc .lz-pr').length > 0).length > 5), 'BD-O5: ברשימה לכל יום כותרת, מוני שלבים מתחת, בלי שורות הזמנה');
ok(await p.evaluate(() => { const d = document.querySelector('.bd-lday'); return d.querySelectorAll('.bd-lc .lz-pr').length === d.querySelectorAll('.lz-pr').length; }), 'BD-O5: המונים ברשימה הם אותם lz-pr של התא');
ok(await p.evaluate(() => [...document.querySelectorAll('.bd-lday .hday')].every((a) => a.tagName === 'A' && /^\/schedule\?date=/.test(a.getAttribute('href')))), 'BD-O3: כותרת יום ברשימה = קישור <a href="/schedule?date=...">');
await p.focus('.bd-lday .hday'); await p.keyboard.press('Enter'); await sleep(200);
ok(/^\/schedule\?date=\d{4}-\d{2}-\d{2}$/.test((await nav()).slice(-1)[0] || '') && await noDlg(), 'S06 / BD-O3: Enter על כותרת יום ברשימה -> /schedule?date=');
// טעינה
await go('loading');
ok(await p.evaluate(() => document.body.textContent.includes('טוען נתונים...') && !!document.querySelector('.bd-loading .mspin')), 'E18: "טוען נתונים..."');
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
