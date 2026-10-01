// מצלם כל מצב של דף בדיקת המלאי בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט.
// שימוש: node stages.mjs demo|real [רוחב=1280]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
// בעיצוב הדף יושב ב-#app בתוך .gm-ds.gm-home.pgwrap; בדף האמיתי ב-.gm-ds.gm-home.stock-page. הטולטיפ וסרגל ההדגמה לא נבדקים.
const ROOT_SEL = which === 'demo' ? '#app' : '.stock-page';
const DUMP = (rootSel) => {
  const root = document.querySelector(rootSel);
  const out = [];
  const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|adv-in|today|rng|sh|t|ralert|sorted|asc|desc)$/.test(x) && !/^stock-/.test(x)).slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return p.join('>'); };
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  root.querySelectorAll('*').forEach((el) => {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
    if (el.closest('.pl-tt') || el.classList.contains('pl-tt')) return;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi)$/i.test(el.tagName)) return;
    const bg = cs.backgroundColor, bi = cs.backgroundImage, bf = cs.backdropFilter || cs.webkitBackdropFilter;
    const p = parse(bg); const has = p && p.a > 0;
    const bw = cs.borderTopWidth, bsty = cs.borderTopStyle;
    out.push({ sel: sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
      col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, '') });
  });
  // רוחב התא של שדה התאריך מול הדגם (האם .advgrid נערם במובייל)
  const d = root.querySelector('.advdate'), m = root.querySelector('#f-model, #stock-model');
  if (d && m) out.push({ sel: '__grid', bg: '', bi: '', bf: '', col: '', bd: '', bs: '', rad: '', op: '', ff: d.getBoundingClientRect().top === m.getBoundingClientRect().top ? 'side-by-side' : 'stacked' });
  return out;
};
let s;
if (which === 'real') s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
const url = which === 'demo' ? DEMO : `http://127.0.0.1:${PORT}/`;
const results = {};
const snap = async (name) => { await sleep(600); await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, fullPage: true }); results[name] = await p.evaluate(DUMP, ROOT_SEL); };
const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());
const esc = async () => { await p.keyboard.press('Escape'); await blur(); await sleep(250); };
const clickAt = async (sel) => { await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(150); const r = await p.$eval(sel, (el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); await p.mouse.move(r.x, r.y); await sleep(150); await p.mouse.click(r.x, r.y); };
const D = which === 'demo';
const ID = { model: D ? '#f-model' : '#stock-model', size: D ? '#f-size' : '#stock-size', add: D ? '#f-add' : '#stock-add', go: D ? '#b-go' : '#stock-go', date: D ? '#f-date' : '#stock-date', clear: D ? '#b-clear' : '[data-act="adv-clear"]' };
async function fresh(force) {
  await p.goto(url, { waitUntil: 'load' });
  if (!D) { await p.evaluate(() => { try { sessionStorage.clear(); } catch {} }); await p.goto(url, { waitUntil: 'load' }); } // הדף האמיתי משחזר את הבדיקה האחרונה - מתחילים נקי
  await sleep(1500);
  if (D) { await p.select('#demoState', force || 'empty'); await sleep(300); if (!force || force === 'empty') { /* בעיצוב: סניפים כבויים כברירת מחדל של הדף האמיתי */ const on = await p.$eval('#dBr', (b) => b.getAttribute('aria-pressed') === 'true'); if (on) await p.click('#dBr'); } }
  await p.evaluate(() => window.scrollTo(0, 0));
}
// מצב 1: טופס עם מידות 12/36 גמישות, תוצאות עדיין ריקות (בעיצוב: מצב "ריק, לפני בדיקה" שומר את המידות של הדוגמה)
await fresh('empty');
if (!D) { await p.click(ID.size); await p.type(ID.size, '12 36'); await clickAt(ID.add); await esc(); await clickAt('[data-flex="12"]'); await clickAt('[data-flex="36"]'); await p.mouse.move(5, 5); }
await p.mouse.move(5, 5); await snap('01-form-empty-results');
await p.hover(ID.go); await snap('02-hover-go');
await p.hover('[data-flex="12"]'); await snap('03-hover-flex');
await p.mouse.move(5, 5);
await p.click(ID.model); await sleep(500); await snap('04-model-focus-list');
await p.type(ID.model, 'ש'); await sleep(500); await snap('05-model-typed');
await esc();
await p.click(ID.size); await sleep(500); await snap('06-size-focus-list');
await esc();
await p.click(ID.date); await sleep(500); await snap('07-datepicker');
await esc();
// מצב 2: תוצאות (שורות) ואז טבלה
await fresh('live');
if (!D) { await p.click(ID.size); await p.type(ID.size, '12 36'); await clickAt(ID.add); await esc(); await clickAt('[data-flex="12"]'); await clickAt('[data-flex="36"]'); await clickAt(ID.go); await sleep(1500); }
await p.mouse.move(5, 5); await esc(); await snap('08-results-rows');
await p.hover('.list .li'); await snap('09-results-row-hover');
await p.mouse.move(5, 5);
await clickAt('.vsw [aria-label="מצב טבלה"]'); await sleep(400); await p.mouse.move(5, 5); await snap('10-results-table');
await p.hover('.rtbl tbody tr'); await snap('11-table-row-hover');
await p.mouse.move(5, 5);
// מצב 3: אין תוצאות / הודעת חובה / טעינה
await fresh('none');
if (!D) { await p.click(ID.model); await p.type(ID.model, 'none'); await p.keyboard.press('Enter'); await sleep(1200); }
await p.mouse.move(5, 5); await esc(); await snap('12-none');
await fresh('invalid');
if (!D) { await clickAt(ID.go); await sleep(300); }
await p.mouse.move(5, 5); await esc(); await snap('13-invalid');
await fresh('loading');
if (!D) { await p.evaluate(() => { window.__delay = 6000; }); await p.click(ID.model); await p.type(ID.model, 'שיפון'); await p.keyboard.press('Enter'); await sleep(500); }
await p.mouse.move(5, 5); await esc(); await snap('14-loading');
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
console.log('done', which, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
