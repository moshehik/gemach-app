// בדיקת התנהגות של הדף האמיתי בדפדפן (API מדומה מ-entry.jsx): שמירה (payload), מתג התראות, מתג הכניסה האוטומטית (שמירה מיידית),
// פתיחה/סגירה של שינוי סיסמה, עיניים, Enter/Escape, שגיאות בטוסט, העלאת תמונה והסרתה. מדפיס OK/FAIL; יוצא 1 בכישלון.
// שימוש: node scripts/profile-bg-audit/interact.mjs   (אחרי build.mjs)
import path from 'node:path';
import fs from 'node:fs';
import { serve, launch, sleep, HERE, PORT } from './lib.mjs';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
const go = async (scn) => { await p.goto(`http://127.0.0.1:${PORT}/${scn ? '?scn=' + scn : ''}`, { waitUntil: 'load' }); await sleep(1300); };
const calls = () => p.evaluate(() => window.__calls);
const toastText = () => p.evaluate(() => { const t = document.querySelector('#toast'); return t ? t.textContent : null; });
const click = async (sel) => { await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' })); await p.click(sel); await sleep(250); };

await go('');
ok(!(await p.evaluate(() => document.body.textContent.includes('בלי לחיצה על'))), 'אין שורת עזר ליד מתג הכניסה האוטומטית');
ok((await p.$$('.pf-side, aside')).length === 0, 'אין עמודה צדדית');
ok(await p.evaluate(() => { const a = [...document.querySelectorAll('section.card h2')].map((h) => h.textContent); return a.join('|') === 'פרטים אישיים|יצירת קשר|כתובת|אבטחה|העדפות'; }), 'סדר הכרטיסים');
ok(await p.evaluate(() => { const f = document.querySelector('.pf-save .btn'); const last = document.querySelector('.panel').lastElementChild; return f && last.contains(f); }), 'כפתור השמירה אחרון בתחתית');
const cols = await p.evaluate(() => [...new Set([...document.querySelectorAll('section.card')].map((c) => Math.round(c.getBoundingClientRect().left)))]);
ok(cols.length === 1, 'כל הכרטיסים באותה עמודה (left=' + cols + ')');

// שמירה: PUT עם כל שדות הפרופיל; מתג התראות כבוי נשלח כ-false
await click('#receiveEmailAlerts');
await p.type('#profile-houseNum', '9');
await click('.pf-save .btn'); await sleep(500);
let c = (await calls()).filter((x) => x.method === 'PUT' && x.url.startsWith('/api/me/profile'));
ok(c.length === 1, 'נשלחה בקשת PUT אחת');
const body = c.length ? JSON.parse(c[0].body) : {};
ok(body.receiveEmailAlerts === false && body.houseNum === '149' && body.firstName === 'שרה' && body.id === 'e1', 'payload: receiveEmailAlerts=false, houseNum, שדות הפרופיל');
ok((await toastText() || '').includes('הפרטים נשמרו בהצלחה!'), 'טוסט הצלחה');

// מתג הכניסה האוטומטית נשמר מיד
await click('#profile-autoClockIn'); await sleep(400);
c = (await calls()).filter((x) => x.method === 'PUT' && x.url.startsWith('/api/me/auto-clock-in'));
ok(c.length === 1 && JSON.parse(c[0].body).enabled === true, 'מתג הכניסה האוטומטית: PUT מיידי {enabled:true}, בלי לחיצה על שמירה');

// סיסמה
ok((await p.$('#pf-pwbox')) === null, 'תיבת הסיסמה סגורה בהתחלה');
await click('.pf-pwact .btn');
ok((await p.$('#pf-pwbox')) !== null, 'תיבת הסיסמה נפתחת');
await click('.pf-pwbtns .btn.primary'); await sleep(300);
ok((await toastText() || '').includes('יש להזין סיסמא חדשה'), 'אישור בלי סיסמה חדשה: טוסט "יש להזין סיסמא חדשה"');
ok(((await calls()).filter((x) => x.url.includes('/password'))).length === 0, 'לא נשלחה בקשה בלי סיסמה חדשה');
await p.type('#profile-oldPassword', 'old-secret'); await p.type('#profile-newPassword', 'new-secret');
ok((await p.$eval('#profile-newPassword', (e) => e.type)) === 'password', 'סיסמה חדשה מוסתרת');
await click('#profile-newPassword + .inpx');
ok((await p.$eval('#profile-newPassword', (e) => e.type)) === 'text' && (await p.$eval('#profile-newPassword + .inpx', (e) => e.getAttribute('aria-pressed'))) === 'true', 'עין: מציגה סיסמה + aria-pressed');
await click('#profile-newPassword + .inpx');
ok((await p.$eval('#profile-newPassword', (e) => e.type)) === 'password', 'עין: מסתירה שוב');
await p.focus('#profile-newPassword'); await p.keyboard.press('Enter'); await sleep(500);
c = (await calls()).filter((x) => x.url.includes('/password'));
ok(c.length === 1 && c[0].method === 'POST' && c[0].url === '/api/employees/e1/password', 'Enter מאשר שינוי סיסמה: POST /api/employees/e1/password');
ok(!JSON.stringify(c).includes('secret'), 'הסיסמאות לא נשמרו ביומן הבדיקה');
ok((await toastText() || '').includes('הסיסמא שונתה בהצלחה') && (await p.$('#pf-pwbox')) === null, 'הצלחה: טוסט + התיבה נסגרת');
ok((await calls()).filter((x) => x.method === 'PUT' && x.url.startsWith('/api/me/profile')).length === 1, 'Enter בשדה סיסמה לא שלח את טופס הפרופיל');
await click('.pf-pwact .btn'); await p.type('#profile-oldPassword', 'x'); await p.keyboard.press('Escape'); await sleep(250);
ok((await p.$('#pf-pwbox')) === null, 'Escape סוגר את תיבת הסיסמה');
await click('.pf-pwact .btn');
ok((await p.$eval('#profile-oldPassword', (e) => e.value)) === '', 'פתיחה מחדש: השדות ריקים');
await click('.pf-pwbtns .btn.ghost');
ok((await p.$('#pf-pwbox')) === null, 'ביטול סוגר');

// שגיאות
await go('pwerr'); await click('.pf-pwact .btn'); await p.type('#profile-newPassword', 'zzz'); await click('.pf-pwbtns .btn.primary'); await sleep(400);
ok((await toastText() || '').includes('הסיסמא הישנה שגויה') && (await p.$('#pf-pwbox')) !== null, 'שגיאת שרת בסיסמה: טוסט והתיבה נשארת פתוחה');
await go('saveerr'); await click('.pf-save .btn'); await sleep(400);
ok((await toastText() || '').includes('כתובת המייל אינה תקינה'), 'שגיאת שרת בשמירה: טוסט עם הודעת השרת');
ok(await p.evaluate(() => !document.querySelector('.pf-save .btn').disabled), 'כפתור השמירה חוזר לפעיל אחרי שגיאה');

// תמונה
await go('');
ok(await p.evaluate(() => !!document.querySelector('.pf-av') && !document.querySelector('.pf-av').classList.contains('photo') && !document.querySelector('.pf-avrow .btn')), 'בלי תמונה: ראשי תיבות ואין כפתור הסר');
const png = path.join(HERE, 'out', 'sample.png');
fs.mkdirSync(path.dirname(png), { recursive: true });
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
await (await p.$('#profile-avatarInput')).uploadFile(png); await sleep(500);
ok(await p.evaluate(() => document.querySelector('.pf-av').classList.contains('photo') && /data:image\/png/.test(document.querySelector('.pf-av').style.backgroundImage) && !!document.querySelector('.pf-avrow .btn')), 'העלאת קובץ: התמונה מוצגת ומופיע "הסר"');
await click('.pf-save .btn'); await sleep(400);
c = (await calls()).filter((x) => x.method === 'PUT' && x.url.startsWith('/api/me/profile'));
ok(c.length && /^data:image\/png;base64,/.test(JSON.parse(c[0].body).profileImage), 'payload כולל profileImage כ-dataURL');
await click('.pf-avrow .btn'); await sleep(250);
ok(await p.evaluate(() => !document.querySelector('.pf-av').classList.contains('photo') && !document.querySelector('.pf-avrow .btn')), 'הסר: חוזר לראשי תיבות');

// מצבים
await go('noimg');
ok((await p.$('.pf-avwrap')) === null, 'ההגדרה show_employee_profile_image=false: בלי בלוק תמונה');
await go('unauth');
ok(await p.evaluate(() => document.body.textContent.includes('כדי לצפות בפרופיל האישי יש להתחבר למערכת עם המשתמש שלך.')), '401: הודעת "יש להתחבר"');
ok(errs.length === 0, 'אין שגיאות קונסול / pageerror' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close(); s.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
