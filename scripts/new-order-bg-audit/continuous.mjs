// מצלם את הטופס הרציף (new_order_layout='continuous') בכמה מצבים מול API מדומה (entry.jsx, ?layout=continuous) ובודק גיאומטריה אמיתית
// (getBoundingClientRect - לא סדר ה-DOM) של RTL: הסל משמאל לבחירה, "המשך" בקצה השמאלי, גלילה אופקית, נעילה. שימוש: node continuous.mjs [רוחב=1280]
// פלט: out/cont-<רוחב>-*.png + שורות "CHECK" בקונסול (נכשל = יציאה 1). בלי שרת פיתוח, בלי DB.
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT } from './lib.mjs';
const width = Number(process.argv[2] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 200)); });
let bad = 0;
const check = (name, ok, info = '') => { console.log(`CHECK ${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) bad++; };
const js = (c, ...a) => p.evaluate(c, ...a);
const snap = async (name) => { await js(() => { const a = document.activeElement; if (a && a !== document.body) a.blur(); }); await sleep(900); await p.screenshot({ path: `${OUT}/cont-${width}-${name}.png`, fullPage: true }); };
const click = async (sel) => { await p.waitForSelector(sel, { timeout: 5000 }); await p.$eval(sel, (el) => el.click()); await sleep(500); };
const mdown = async (sel) => { await p.waitForSelector(sel, { timeout: 5000 }); await p.$eval(sel, (el) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); await sleep(450); };
const clickText = async (sel, text) => { await p.evaluate((s0, t) => { const el = [...document.querySelectorAll(s0)].find((e) => e.textContent.includes(t)); if (!el) throw new Error('no ' + s0 + ' ' + t); el.click(); }, sel, text); await sleep(500); };
const rect = (sel) => js((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY, w: r.width, h: r.height }; }, sel);
const locked = () => js(() => [...document.querySelectorAll('.no-sec')].map((e) => e.dataset.secKey + ':' + (e.classList.contains('locked') ? 'L' : 'o')).join(' '));
const hscroll = () => js(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const url = (q = '') => `http://127.0.0.1:${PORT}/?layout=continuous${q}`;
const dayKey = await js(() => { const d = new Date(); d.setDate(d.getDate() + 12); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
const NEXTBTN = (k) => `#noSec-${k} .no-sec-nav .btn.primary`;

await p.goto(url(), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(2500);
await snap('01-initial');
check('אין גלילה אופקית (התחלה)', (await hscroll()) <= 0, String(await hscroll()));
check('נעילה בהתחלה: רק הלקוח פתוח', (await locked()) === 'customer:o dates:L delivery:L items:L summary:L payment:L', await locked());
check('אין פס/ניווט אשף בטופס הרציף', !(await p.$('#pbars')) && !(await p.$('.no-nav.navtop')) && !!(await p.$('#noMiniBars')));
// בחירה מהרשימה: הלקוח נקבע אבל השלבים הבאים עדיין נעולים עד "המשך" (בדיקת חסימה / חריגה) - כמו באשף
await click('#custSeg button:nth-of-type(2)'); await sleep(600); await click('.hgrp .li.rlink');
check('אחרי בחירה ברשימה (בלי "המשך") תאריכים עדיין נעולים', (await locked()).includes('dates:L'), await locked());
await snap('02-picked');
await click(NEXTBTN('customer')); await sleep(1200);
check('אחרי "המשך": תאריכים נפתחו, משלוח עדיין נעול', /dates:o delivery:L/.test(await locked()), await locked());
check('גלילה חלקה לגוש התאריכים (הגוש בראש החלון)', (await js(() => document.getElementById('noSec-dates').getBoundingClientRect().top)) < 260, String(await js(() => document.getElementById('noSec-dates').getBoundingClientRect().top)));
for (let i = 0; i < 2; i++) { if (await p.$(`.hc-d[data-hd="${dayKey}"]`)) break; await click('.hc-nn'); }
await click(`.hc-d[data-hd="${dayKey}"]`);
check('אחרי תאריך: משלוח ופריטים נפתחו, סיכום נעול', /delivery:o items:o summary:L/.test(await locked()), await locked());
await snap('03-dates');
await click(NEXTBTN('dates')); await click(NEXTBTN('delivery')); await sleep(600);
await mdown('#modelList .advo'); await clickText('#addSizes button', '38'); await clickText('#addSizes button', '40'); await sleep(700);
await click('.addbar .btn.primary'); await sleep(800);
await snap('04-items');
check('אחרי פריט: סיכום ותשלום נפתחו', (await locked()) === 'customer:o dates:o delivery:o items:o summary:o payment:o', await locked());
const main = await rect('.items-main'); const cart = await rect('.items-cart');
if (width > 760) {
  check('RTL: הסל משמאל לעמודת הבחירה (getBoundingClientRect)', cart && main && cart.r <= main.l + 2 && cart.l < main.l, JSON.stringify({ cart: [cart.l, cart.r], main: [main.l, main.r] }));
  check('הסל ~280px', cart && cart.w > 240 && cart.w < 330, String(cart && cart.w));
} else {
  check('מובייל: הסל מתחת לבחירה, עמודה אחת', cart && main && cart.t >= main.b - 2 && Math.abs(cart.l - main.l) < 12, JSON.stringify({ cart: [cart.t, cart.l], main: [main.b, main.l] }));
}
const nx = await rect(NEXTBTN('items')); const sec = await rect('#noSec-items');
check('"המשך לסיכום" בקצה השמאלי של הגוש (RTL)', nx && sec && nx.l - sec.l < 8 && sec.r - nx.r > (width > 760 ? 100 : 0) - 1, JSON.stringify({ nx: [nx && nx.l, nx && nx.r], sec: [sec.l, sec.r] }));
check('אין גלילה אופקית (פריטים)', (await hscroll()) <= 0, String(await hscroll()));
await click(NEXTBTN('items')); await sleep(600); await click(NEXTBTN('summary')); await sleep(900);
await snap('05-summary-payment');
await clickText('#methods button', 'מזומן');
await p.$eval('#noPayAmt', (el) => { el.focus(); el.select(); }); await p.keyboard.type('100'); await sleep(200);
await clickText('.btn.green', 'אישור תשלום'); await sleep(700);
await snap('06-payment-side');
const ps = await rect('.pay-side'); const pm = await rect('.pay-main');
if (width > 760) check('RTL: "תשלומים שנרשמו" משמאל לרישום התשלום', ps && pm && ps.r <= pm.l + 45 && ps.l < pm.l, JSON.stringify({ side: [ps && ps.l, ps && ps.r], main: [pm && pm.l, pm && pm.r] }));
else check('מובייל: התשלומים שנרשמו מתחת', ps && pm && ps.t >= pm.b - 2, '');
check('אין גלילה אופקית (תשלום)', (await hscroll()) <= 0, String(await hscroll()));
// סיום: משלימים את היתרה במזומן ושומרים
await p.$eval('#noPayAmt', (el) => { el.focus(); el.select(); }); await p.keyboard.type('1000'); await clickText('.btn.green', 'אישור תשלום'); await sleep(600);
await click(NEXTBTN('payment')); await sleep(1400);
await snap('07-saved');
check('אחרי שמירה: הטופס inert, שורת "הזמנה חדשה" מוצגת', await js(() => !!document.querySelector('#noFlow[inert]') && !!document.querySelector('.no-nav .btn.primary')), '');
const calls = await js(() => window.__calls.filter((c) => c.method === 'POST').map((c) => c.url + ' ' + Object.keys(c.body || {}).length));
console.log('POSTs:', calls.join(' | '));
// פריסה בלי משלוח: גוש המשלוח לא מוצג
await p.goto(url('&nodelivery=1'), { waitUntil: 'domcontentloaded', timeout: 90000 }); await sleep(2200);
check('משלוח / סניפים כבויים: אין גוש משלוח, 5 גושים', await js(() => document.querySelectorAll('.no-sec').length === 5 && !document.getElementById('noSec-delivery')), String(await js(() => document.querySelectorAll('.no-sec').length)));
await b.close(); s.close();
console.log(bad ? `${bad} CHECK(S) FAILED` : 'all checks passed');
process.exit(bad ? 1 : 0);
