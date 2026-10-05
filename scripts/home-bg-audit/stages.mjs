import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO as DEMO_URL } from './lib.mjs';
const which = process.argv[2]; // demo | real
const width = Number(process.argv[3] || 1280);
const theme = process.argv[4] || 'light';
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const DEMO = DEMO_URL;
const ROOTS = '.hero, .hero *, #app, #app *, .site-foot, .site-foot *';
const DUMP = (roots) => {
  const out = [];
  const sel = (el) => { const p = []; let e = el; while (e && e.nodeType === 1 && p.length < 3 && !(e.classList.contains('hero') && p.length)) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|enter)$/.test(x)).slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return p.join('>'); };
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  document.querySelectorAll(roots).forEach((el) => {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol)$/i.test(el.tagName)) return;
    const bg = cs.backgroundColor, bi = cs.backgroundImage, bf = cs.backdropFilter || cs.webkitBackdropFilter;
    const p = parse(bg); const has = p && p.a > 0;
    const bw = cs.borderTopWidth, bsty = cs.borderTopStyle;
    const o = { sel: sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
      col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity };
    out.push(o);
  });
  return out;
};
// סדר פריטי שורת החיפוש מימין לשמאל (RTL), כדי לוודא שאחרי הסרת/שינוי כפתור הסדר זהה לעיצוב (flex order יכול להפוך בשקט)
const LAYOUT = () => {
  const items = [];
  const add = (k, el) => { if (!el) return; const r = el.getBoundingClientRect(); if (r.width) items.push({ k, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }); };
  const scan = document.querySelector('.hero .scan') || document.querySelector('.fu .scan');
  if (!scan) return items;
  add('input', scan.querySelector('input'));
  add('clear', scan.querySelector('.ibtn'));
  scan.parentElement.parentElement.querySelectorAll('.cmode-b').forEach((b) => add('mode:' + b.textContent.trim(), b));
  add('submit', scan.querySelector('button[type=submit], .btn.primary'));
  return items;
};
const clickText = async (p, txt, selr = 'button') => p.evaluate((t, s) => { const b = [...document.querySelectorAll(s)].find((x) => x.textContent.includes(t) && x.offsetParent); if (b) { b.click(); return true; } return false; }, txt, selr);
let s, b;
if (which === 'real') s = await serve();
b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
const url = which === 'demo' ? DEMO : `http://127.0.0.1:${PORT}/`;
const results = {};
const layout = {};
const snap = async (name) => {
  await sleep(700);
  await p.screenshot({ path: `${OUT}/${which}-${width}-${theme}-${name}.png` });
  results[name] = await p.evaluate(DUMP, ROOTS);
  layout[name] = await p.evaluate(LAYOUT);
};
async function fresh() {
  await p.goto(url, { waitUntil: 'load' });
  if (theme === 'dark') await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await sleep(2600);
  await p.evaluate(() => { window.scrollTo(0, 0); });
}
const type = async (txt) => { await p.click('#sq'); await p.type('#sq', txt); };
const onlyFloat = process.argv[5] === 'float'; // node stages.mjs real 1280 light float = רק שלבי הכותרת הצפה (36-37)
if (!onlyFloat) {
// 1 start
await fresh(); await p.mouse.move(5, 5); await snap('01-start');
await p.hover('.hero .scan'); await snap('02-start-hover-pill');
await p.click('#sq'); await snap('03-start-focus');
await p.type('#sq', 'כהן'); await snap('04-start-typed-focus');
// AI mode toggle in start
await fresh(); await clickText(p, 'לחיפוש חכם'); await snap('05-start-ai-mode');
await clickText(p, 'לחיפוש מתקדם'); await sleep(600); await snap('06-adv-chooser');
const focusBtn = await p.$('.advfb'); if (focusBtn) { await focusBtn.click(); await sleep(700); await snap('07-adv-form'); }
// results
await fresh(); await type('כהן'); await p.keyboard.press('Enter'); await sleep(2200); await p.mouse.move(5, 5); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await snap('08-results');
await p.click('#sq'); await snap('09-results-focus');
await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.hover('.hero .scan'); await snap('10-results-hover-pill');
await p.hover('.hero .li'); await snap('11-results-hover-row');
await p.mouse.move(5, 5);
await clickText(p, '', '.vopt[aria-label="מצב טבלה"],.vsw .vopt:nth-child(3)'); await sleep(500); await snap('12-results-table');
// ai chat
await fresh(); await clickText(p, 'לחיפוש חכם'); await type('הזמנות של כהן'); await p.keyboard.press('Enter'); await sleep(2500); await p.mouse.move(5, 5); await snap('13-ai-chat');
// adv results
await fresh(); await clickText(p, 'לחיפוש מתקדם'); await sleep(500); const fb = await p.$('.advfb'); if (fb) { await fb.click(); await sleep(600); }
const inp = await p.$('.advp input.inp, .advp input'); if (inp) { await inp.click(); await inp.type('כהן'); await sleep(400); await p.keyboard.press('Escape'); await snap('14-adv-form-filled');
  const ok = await clickText(p, 'חיפוש', '.advp .advact .btn.primary'); await sleep(2200); await p.mouse.move(5, 5); await snap('15-adv-results'); }
// extra states
await fresh(); await clickText(p, 'לחיפוש מתקדם'); await sleep(500);
{ const fb2 = await p.$$('.advfb'); if (fb2[0]) { await fb2[0].hover(); await snap('16-adv-chooser-hover-focus-btn'); } }
await p.mouse.move(5,5); { const pl = await p.$('.advplus'); if (pl) { await pl.click(); await sleep(500); await snap('17-adv-chooser-more-open'); } }
{ const fb3 = await p.$('.advfb'); if (fb3) { await fb3.click(); await sleep(600); } }
{ const ins = await p.$$('.advp input.inp'); if (ins[0]) { await ins[0].click(); await ins[0].type('ר'); await sleep(900); await snap('18-adv-suggestions-open'); await p.keyboard.press('Escape'); } }
{ const fl = await p.$('.advfl'); if (fl) { await fl.click(); await p.mouse.move(5,5); await snap('19-adv-flag-checked'); await fl.hover(); await snap('20-adv-flag-hover'); } }
{ const dt = await p.$('.advp [id*=-dp]') || null; const dbtn = await p.$('.advp .inpw .dpbtn, .advp [aria-haspopup=dialog]'); if (dbtn) { await dbtn.click(); await sleep(500); await snap('21-adv-datepicker-open'); } }
await fresh(); await clickText(p, 'לחיפוש חכם'); await p.click('#sq'); await p.type('#sq','א'); await p.keyboard.press('Enter'); await sleep(2500);
{ const fi = await p.$('.fu input, #fuForm input'); if (fi) { await fi.click(); await snap('22-ai-chat-followup-focus'); } }
{ const sw = await p.$('.aiw .vopt:last-child, .vsw .vopt:last-child'); if (sw) { await sw.click(); await sleep(500); await p.mouse.move(5,5); await snap('23-ai-chat-table'); } }
await fresh(); await clickText(p, 'לחיפוש מתקדם'); await sleep(500);
{ const ok = await clickText(p, 'הזמנות', '.advfb'); await sleep(700); const di = await p.$('.advp input.advdate, .advp input[readonly]'); if (di) { await di.click(); await sleep(600); await snap('21b-adv-datepicker-open'); } }
await fresh(); await p.evaluate(() => { window.__delay = 3500; }); await type('כהן'); await p.keyboard.press('Enter'); await sleep(900); await snap('24-loading-disabled-input'); await sleep(3500);
await fresh(); await type('אין'); await p.keyboard.press('Enter'); await sleep(2200); await p.mouse.move(5,5); await snap('25-no-results');
if (which === 'real') { await fresh(); await type('שגיאה'); await p.keyboard.press('Enter'); await sleep(2200); await p.mouse.move(5,5); await snap('26-error-card'); }
// תפוסה (4.10.2026): טופס, טופס ממולא, תוצאות + סיכום (capstats), טבלה; ובדף האמיתי בלבד — טעינה, דגם חובה, מגבלת צמדים, שגיאה
const capOpen = async () => { await fresh(); await clickText(p, 'לחיפוש מתקדם'); await sleep(500); await clickText(p, 'תפוסה', '.advfb'); await sleep(700); };
const capFill = async (model) => {
  const m = await p.$('#adv-model'); if (m) { await m.click(); await m.type(model); await sleep(300); await p.keyboard.press('Escape'); }
  const z = await p.$('#adv-size'); if (z) { await z.click(); await z.type('36'); await sleep(300); await p.keyboard.press('Escape'); }
  await p.mouse.move(5, 5);
};
const capGo = () => clickText(p, 'חיפוש', '.advp .advact .btn.primary');
await capOpen(); await p.mouse.move(5, 5); await snap('27-cap-form');
await capFill('שמלת תחרה'); await snap('28-cap-form-filled');
await capGo(); await sleep(2200); await p.mouse.move(5, 5); await snap('29-cap-results');
await clickText(p, '', '.vopt[aria-label="מצב טבלה"]'); await sleep(500); await p.mouse.move(5, 5); await snap('30-cap-table');
if (which === 'real') {
  await capOpen(); await capFill('שמלת תחרה'); await p.evaluate(() => { window.__delay = 3500; }); await capGo(); await sleep(700); await snap('31-cap-loading'); await sleep(3500); await p.evaluate(() => { window.__delay = 30; });
  await capOpen(); { const z = await p.$('#adv-size'); if (z) { await z.click(); await z.type('36'); await p.keyboard.press('Escape'); } } await capGo(); await sleep(300); await snap('32-cap-model-required');
  await capOpen(); await capFill('הרבה'); await capGo(); await sleep(900); await snap('33-cap-pair-limit');
  await capOpen(); await capFill('תקלה'); await capGo(); await sleep(900); await p.mouse.move(5, 5); await snap('34-cap-error');
  await p.evaluate(() => { window.__capOk = true; }); await clickText(p, 'לנסות שוב'); await sleep(1500); await p.mouse.move(5, 5); await snap('35-cap-retry-ok'); await p.evaluate(() => { window.__capOk = false; });
}
// כספים (5.10.2026, HM-03; בעיצוב מאחורי ה"+"): טופס, טופס ממולא, תוצאות, טבלה — מול הדמו; ובדף האמיתי בלבד — בורר "סטטוס הזמנה" עם ערך נבחר, שגיאת שרת
const extraOpen = async (label) => { await fresh(); await clickText(p, 'לחיפוש מתקדם'); await sleep(500); const pl = await p.$('.advplus'); if (pl) { await pl.click(); await sleep(900); } await p.evaluate((t) => { const b = [...document.querySelectorAll('.advextra .advfb')].find((x) => x.textContent.includes(t)); if (b) b.click(); }, label); await sleep(800); };
const finFill = async () => {
  const a = await p.$('#adv-amount'); if (a) { await a.click(); await a.type('450'); }
  const n = await p.$('#adv-name'); if (n) { await n.click(); await n.type('רחל'); await sleep(300); await p.keyboard.press('Escape'); }
  const fl = await p.$('.advflags .advfl'); if (fl) await fl.click();
  await p.mouse.move(5, 5);
};
await extraOpen('כספים'); await p.mouse.move(5, 5); await snap('40-fin-form');
await finFill(); await snap('41-fin-form-filled');
await clickText(p, 'חיפוש', '.advp .advact .btn.primary'); await sleep(2200); await p.mouse.move(5, 5); await snap('42-fin-results');
await clickText(p, '', '.vopt[aria-label="מצב טבלה"]'); await sleep(500); await p.mouse.move(5, 5); await snap('43-fin-table');
if (which === 'real') {
  await extraOpen('כספים'); await p.select('#adv-ordst', 'הושכר'); await p.mouse.move(5, 5); await snap('44-fin-status-selected');
  await extraOpen('כספים'); { const n = await p.$('#adv-name'); if (n) { await n.click(); await n.type('תקלה'); await p.keyboard.press('Escape'); } } await clickText(p, 'חיפוש', '.advp .advact .btn.primary'); await sleep(1200); await p.mouse.move(5, 5); await snap('45-fin-error');
}
// התראות (5.10.2026, HM-04 / F23; ההצעה בלבד — אין תחום כזה בדמו המאושר, לכן רק בדף האמיתי): טופס, סוג נבחר, תוצאות (3 שורות עם תג החזרה/הזמנה וצ'יפ), טבלה, הודעת "חלק לא נטען", ריק, שגיאה
if (which === 'real') {
  await extraOpen('התראות'); await p.mouse.move(5, 5); await snap('46-alerts-form');
  { const fl = await p.$('.advflags .advfl'); if (fl) { await fl.click(); await p.mouse.move(5, 5); } } await snap('47-alerts-form-type-selected');
  await extraOpen('התראות'); await clickText(p, 'חיפוש', '.advp .advact .btn.primary'); await sleep(2200); await p.mouse.move(5, 5); await snap('48-alerts-results');
  await clickText(p, '', '.vopt[aria-label="מצב טבלה"]'); await sleep(500); await p.mouse.move(5, 5); await snap('49-alerts-table');
  await extraOpen('התראות'); { const n = await p.$('#adv-name'); if (n) { await n.click(); await n.type('חלקי'); await p.keyboard.press('Escape'); } } await clickText(p, 'חיפוש', '.advp .advact .btn.primary'); await sleep(900); await snap('50-alerts-partial-toast');
  await extraOpen('התראות'); { const n = await p.$('#adv-name'); if (n) { await n.click(); await n.type('ריק'); await p.keyboard.press('Escape'); } } await clickText(p, 'חיפוש', '.advp .advact .btn.primary'); await sleep(1500); await p.mouse.move(5, 5); await snap('51-alerts-empty');
  await extraOpen('התראות'); { const n = await p.$('#adv-name'); if (n) { await n.click(); await n.type('שגיאה'); await p.keyboard.press('Escape'); } } await clickText(p, 'חיפוש', '.advp .advact .btn.primary'); await sleep(1500); await p.mouse.move(5, 5); await snap('52-alerts-error');
}
// חיפוש ברקוד (4.10.2026, בדף האמיתי בלבד — אין שלב כזה בעיצוב): שלוש השכרות של אותו פריט, לכל אחת שורה שנייה — הזמנה · לקוחה · תאריך עברי · מצב
if (which === 'real') {
  await fresh(); await type('5511205'); await p.keyboard.press('Enter'); await sleep(2200); await p.mouse.move(5, 5); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await snap('36-barcode-results');
  await clickText(p, '', '.vopt[aria-label="מצב טבלה"]'); await sleep(500); await p.mouse.move(5, 5); await snap('37-barcode-table');
}
} // !onlyFloat

/* 36-37: הכותרת הצפה של החיפוש החכם (4.10.2026, "הכותרת לא צפה כמו בקובץ הדמו"). בעיצוב: כשכותרת כרטיס השיחה (.advp.aiw>.card-h) יוצאת מתחת
   לסרגל העליון, מופיע עותק מכווץ שלה (.card-h.aibar, position:fixed, ישירות תחת body) 8px מתחת לסרגל, צר ב-34px מכל צד, ו"חיפוש חכם" עולה לשורת
   הכפתורים; הוא נעלם כשהכרטיס נגמר. נמדד ביחס לסרגל ולכותרת (לא בפיקסלים מוחלטים), בשיחה קצרה ובשיחה ארוכה. בדף האמיתי אין סרגל ב-harness,
   ולכן מוזרק סרגל דביק בגובה --gm-snav-h (כמו .snav של MenuA5Shell). */
const FLOAT = () => {
  const nav = document.querySelector('.snav'); const nb = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
  const ch = document.querySelector('.advp.aiw>.card-h:not(.aibar)'); const bar = document.querySelector('.card-h.aibar');
  if (!ch) return { err: 'no chat head' };
  const R = (el) => el.getBoundingClientRect(); const hr = R(ch), cr = R(ch.parentElement);
  const o = { sy: Math.round(scrollY), nb: Math.round(nb), chBottomRel: Math.round(hr.bottom - nb), cardBottomRel: Math.round(cr.bottom - nb) };
  if (!bar) return { ...o, bar: null };
  const br = R(bar), cs = getComputedStyle(bar), h2 = bar.querySelector('h2'), hs = h2 && getComputedStyle(h2);
  const wrap = bar.parentElement; let host = wrap; while (host && host.parentElement !== document.body) host = host.parentElement;
  const kids = [...bar.children].map((c) => ({ k: c.tagName === 'H2' ? 'h2:' + c.textContent.trim() : (c.getAttribute('aria-label') || c.className), x: Math.round(R(c).left + R(c).width / 2), y: Math.round(R(c).top + R(c).height / 2) }))
    .sort((a, b) => (Math.round(a.y / 20) - Math.round(b.y / 20)) || b.x - a.x).map((c) => c.k); // RTL: מימין לשמאל
  return { ...o, on: bar.classList.contains('on'), op: cs.opacity, vis: cs.visibility, tf: cs.transform, pos: cs.position, z: cs.zIndex, pe: cs.pointerEvents,
    topRel: Math.round(br.top - nb), h: Math.round(br.height), leftOff: Math.round(br.left - hr.left), rightOff: Math.round(hr.right - br.right), wDiff: Math.round(hr.width - br.width),
    pad: cs.padding, rad: cs.borderTopLeftRadius, bi: cs.backgroundImage.replace(/ /g, '').slice(0, 60), bf: cs.backdropFilter, bd: cs.borderTopColor.replace(/ /g, '') + '/' + cs.borderTopWidth, wrap: wrap.className,
    underBody: !!host, h2: hs && { fs: hs.fontSize, fw: hs.fontWeight, col: hs.color.replace(/ /g, ''), order: hs.order, ms: hs.marginInlineStart, flex: hs.flex }, kids };
};
const float = {};
const floatRun = async (label, followUps) => {
  await fresh();
  if (which === 'real') await p.evaluate(() => { const h = document.createElement('header'); h.className = 'snav'; h.style.cssText = 'position:sticky;top:0;z-index:950;height:var(--gm-snav-h,64px);background:#0a2242'; document.body.prepend(h); });
  await clickText(p, 'לחיפוש חכם'); await type('הזמנות של כהן'); await p.keyboard.press('Enter'); await sleep(2500);
  for (let i = 0; i < followUps; i++) { const fi = await p.$('#fuQ'); if (!fi) break; await fi.click(); await fi.type('עוד הזמנות ' + i); await p.keyboard.press('Enter'); await sleep(2300); }
  // בדף הדמו יש מתחת לכרטיס תוכן (לוח בקרה, כותרת תחתונה) ולכן אפשר לגלול אל מעבר לסוף הכרטיס; ב-harness של הדף האמיתי אין, מוסיפים מרווח
  if (which === 'real') await p.evaluate(() => { const sp = document.createElement('div'); sp.style.cssText = 'height:1800px'; document.body.appendChild(sp); });
  await p.mouse.move(5, 5); await p.evaluate(() => document.activeElement && document.activeElement.blur());
  // מיקומי גלילה ביחס לכותרת ולתחתית הכרטיס: למעלה / הכותרת עוד גלויה / הכותרת יצאה / אמצע / ממש לפני סוף הכרטיס / אחרי הסוף
  const abs = await p.evaluate(() => { const ch = document.querySelector('.advp.aiw>.card-h'); const nav = document.querySelector('.snav'); const nh = nav ? nav.getBoundingClientRect().height : 0;
    const hb = ch.getBoundingClientRect().bottom + scrollY, cb = ch.parentElement.getBoundingClientRect().bottom + scrollY; return { hb, cb, nh }; });
  const pts = { top: 0, headVisible: abs.hb - abs.nh - 20, headGone: abs.hb - abs.nh + 10, mid: abs.cb - abs.nh - 300, cardEndOn: abs.cb - abs.nh - 80, cardEndOff: abs.cb - abs.nh - 60, past: abs.cb };
  const res = {};
  for (const [k, y] of Object.entries(pts)) {
    await p.evaluate((y) => window.scrollTo(0, Math.max(0, y)), y); await sleep(450);
    res[k] = await p.evaluate(FLOAT);
    if (k === 'headGone' || k === 'mid') await p.screenshot({ path: `${OUT}/${which}-${width}-${theme}-${label}-${k}.png` });
  }
  float[label] = res;
};
await floatRun('36-ai-float-short', 0);
await floatRun('37-ai-float-long', 4);
fs.writeFileSync(`${OUT}/${which}-${width}-${theme}-float.json`, JSON.stringify(float, null, 1));

/* 38: ה-X (ניקוי) בשורת שאלת ההמשך של החיפוש החכם (4.10.2026): ריק = אין X (כמו בשאר שורות החיפוש); הקלדה = X; לחיצה על X = השדה ריק וה-X נעלם. */
{
  await fresh();
  await clickText(p, 'לחיפוש חכם'); await type('הזמנות של כהן'); await p.keyboard.press('Enter'); await sleep(2500);
  const X = '.fu .scan .ibtn[aria-label="ניקוי הטקסט"]';
  const st = () => p.evaluate((X) => { const b = document.querySelector(X); const i = document.querySelector('#fuQ'); if (!b || !i) return { err: 'missing' }; const r = b.getBoundingClientRect();
    return { value: i.value, shown: getComputedStyle(b).display !== 'none' && r.width > 0 && r.height > 0, hiddenAttr: b.hidden }; }, X);
  const fu = {};
  fu.empty = await st();
  await p.click('#fuQ'); await p.type('#fuQ', 'עוד'); fu.typed = await st();
  await p.click(X); await sleep(150); fu.afterClear = await st();
  fu.focusAfterClear = await p.evaluate(() => document.activeElement && document.activeElement.id);
  await p.type('#fuQ', 'א'); await p.keyboard.press('Backspace'); fu.typedThenErased = await st();
  fs.writeFileSync(`${OUT}/${which}-${width}-${theme}-fuclear.json`, JSON.stringify(fu, null, 1));
  console.log('fuclear', which, JSON.stringify(fu));
}
if (!onlyFloat) {
fs.writeFileSync(`${OUT}/${which}-${width}-${theme}.json`, JSON.stringify(results, null, 1));
fs.writeFileSync(`${OUT}/${which}-${width}-${theme}-layout.json`, JSON.stringify(layout, null, 1));
}
console.log('done', which, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
