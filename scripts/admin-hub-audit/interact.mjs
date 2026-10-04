// בדיקת התנהגות של מסך הניהול האמיתי בדפדפן (בלי שרת פיתוח ובלי DB; התפקיד מדומה ב-?role= של entry.jsx):
// ברירת מחדל אריחים, זכירת התצוגה לכל משתמש, localStorage חסום, חיפוש (בלי מונה) + ניקוי + Escape, מטריצת תפקידים,
// תגית קטגוריה בכל שורה, RTL (getBoundingClientRect), בלי גלילה אופקית ב-375, בלי שגיאות קונסול.
// שימוש: node scripts/admin-hub-audit/interact.mjs   (אחרי build.mjs). יוצא 1 בכישלון.
import { serve, launch, sleep, PORT } from './lib.mjs';
import { TOOLS, CATEGORIES, visibleToolIds, accessForRole } from '../../lib/adminHub.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const s = await serve();
const b = await launch();
const errs = [];
const page = async (w = 1280, opts = {}) => {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: 900 });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  if (opts.blockStorage) await p.evaluateOnNewDocument(() => { const f = () => { throw new Error('blocked'); }; Storage.prototype.getItem = f; Storage.prototype.setItem = f; });
  return p;
};
const go = async (p, role = '0') => { await p.goto(`http://127.0.0.1:${PORT}/?role=${role}`, { waitUntil: 'load' }); await sleep(900); };
const view = (p) => p.evaluate(() => document.querySelector('#admSecs').className);
const hrefsShown = (p) => p.evaluate(() => [...document.querySelectorAll('#admSecs a[href]')].map((a) => a.getAttribute('href')));
const click = async (p, sel) => { await p.click(sel); await sleep(250); };

// 1. ברירת מחדל + זכירה לכל משתמש
let p = await page();
await go(p, '0');
ok((await view(p)) === 'v-tiles', 'ברירת מחדל: אריחים');
ok(await p.evaluate(() => document.querySelector('.vsw').classList.contains('c') && document.querySelector('.vopt[data-view="tiles"]').getAttribute('aria-pressed') === 'true'), 'המתג מסמן אריחים');
ok((await p.$$('.hres-n, .adm-cnt')).length === 0 && !(await p.evaluate(() => /כלי ניהול \d/.test(document.body.textContent))), 'אין מונה כלים');
await click(p, '.vopt[data-view="rows"]');
ok((await view(p)) === 'v-rows' && (await p.$$('.adm-rows')).length > 0 && (await p.$$('.adm-tile')).length === 0, 'מעבר לשורות');
await go(p, '0');
ok((await view(p)) === 'v-rows', 'הבחירה נזכרת אחרי רענון (אותו משתמש)');
await go(p, '2');
ok((await view(p)) === 'v-tiles', 'משתמש אחר באותו דפדפן: ברירת המחדל (אריחים)');
await go(p, '0'); await click(p, '.vopt[data-view="table"]');
ok((await view(p)) === 'v-table' && (await p.$$('.adm-table table.rtbl')).length > 0, 'מעבר לטבלה');
ok(await p.evaluate(() => [...document.querySelectorAll('.adm-table thead th')].slice(0, 3).map((x) => x.textContent).join('|') === 'כלי|תיאור|'), 'עמודות הטבלה כמו בעיצוב');
await click(p, '.vopt[data-view="tiles"]');

// 2. תגית קטגוריה בכל שורה
await click(p, '.vopt[data-view="rows"]');
ok(await p.evaluate((cats) => [...document.querySelectorAll('.adm-sec')].every((sec) => { const c = cats.find((x) => x.id === sec.dataset.cat); return [...sec.querySelectorAll('.rlbl')].every((l) => l.textContent === c.tag) && sec.querySelectorAll('.rlbl').length === sec.querySelectorAll('.li').length; }), CATEGORIES), 'תגית הקטגוריה בכל שורה');
await click(p, '.vopt[data-view="tiles"]');

// 3. חיפוש
await p.type('.hf-s input', 'גיבוי'); await sleep(200);
ok(await p.evaluate(() => [...document.querySelectorAll('.adm-sec')].map((x) => x.dataset.cat).join() === 'backup'), 'חיפוש "גיבוי": רק קטגוריית הגיבוי');
ok(await p.evaluate(() => document.querySelector('.hf-cl').classList.contains('on')), 'לחצן הניקוי מופיע');
await click(p, '.hf-cl');
ok((await p.$$('.adm-sec')).length === 9 && (await p.evaluate(() => document.activeElement === document.querySelector('.hf-s input'))), 'ניקוי: כל 9 הקטגוריות, הפוקוס חוזר לשדה');
await p.type('.hf-s input', 'zzzz'); await sleep(200);
ok((await p.$$('.adm-sec')).length === 0 && (await p.evaluate(() => document.querySelector('.empty').textContent.includes('לא נמצאו כלים התואמים לחיפוש'))), 'אין תוצאות: מצב ריק');
await p.keyboard.press('Escape'); await sleep(200);
ok((await p.$$('.adm-sec')).length === 9, 'Escape מנקה את החיפוש');
await p.type('.hf-s input', 'נדרים פלוס'); await sleep(200);
ok((await p.$$('.adm-tile')).length === 5, 'חיפוש לפי שם קטגוריה מחזיר את כל הקטגוריה');

// 4. RTL: שדה החיפוש מימין, המתג בקצה השמאלי; הכותרת מימין
ok(await p.evaluate(() => { const a = document.querySelector('.hf-s').getBoundingClientRect(), v = document.querySelector('.vsw').getBoundingClientRect(), app = document.querySelector('.adm-app').getBoundingClientRect(); return a.left > v.right && v.left - app.left < 40 && app.right - a.right < 40; }), 'RTL: חיפוש בימין, מתג תצוגה בשמאל (getBoundingClientRect)');
await p.close();

// 5. מטריצת תפקידים
for (const role of ['0', '2', 'anon']) {
  p = await page(); await go(p, role);
  const acc = role === 'anon' ? accessForRole(null, { logged: false, requireLogin: false }) : accessForRole(Number(role));
  const want = visibleToolIds(acc).map((id) => TOOLS.find((x) => x.id === id).href);
  const got = await hrefsShown(p);
  ok(JSON.stringify(got) === JSON.stringify(want), `תפקיד ${role}: ${got.length} אריחים בדיוק לפי הקטלוג`);
  if (role === '0') ok(!got.includes('/admin/site') && !got.includes('/admin/labels') && got.includes('/admin/nedarim-hok-list'), 'הנהלה ראשית: בלי כלי מתכנת, עם רשימת הו״ק');
  if (role === '2') ok(got.includes('/admin/site') && got.includes('/admin/ai-restrictions') && !got.includes('/admin/nedarim-hok-list'), 'מתכנת: עם כלי מתכנת, בלי רשימת הו״ק');
  await p.close();
}

// 6. localStorage חסום: הדף עובד, ברירת מחדל אריחים, ומעבר תצוגה עדיין עובד
p = await page(1280, { blockStorage: true }); await go(p, '0');
ok((await view(p)) === 'v-tiles', 'localStorage חסום: אריחים');
await click(p, '.vopt[data-view="table"]');
ok((await view(p)) === 'v-table', 'localStorage חסום: המעבר עובד');
await p.close();

// 7. נייד: בלי גלילה אופקית בשלוש התצוגות
p = await page(375); await go(p, '2');
for (const v of ['tiles', 'rows', 'table']) {
  await click(p, `.vopt[data-view="${v}"]`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `375px ${v}: בלי גלילה אופקית`);
}
await p.close();

ok(errs.length === 0, 'אין שגיאות קונסול / pageerror' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close(); s.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
process.exit(fails ? 1 : 0);
