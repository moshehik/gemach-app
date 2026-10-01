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
fs.writeFileSync(`${OUT}/${which}-${width}-${theme}.json`, JSON.stringify(results, null, 1));
fs.writeFileSync(`${OUT}/${which}-${width}-${theme}-layout.json`, JSON.stringify(layout, null, 1));
console.log('done', which, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
