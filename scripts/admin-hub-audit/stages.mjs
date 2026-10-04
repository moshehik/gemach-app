// מצלם כל מצב של מסך הניהול הראשי בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט.
// שימוש: node stages.mjs demo|real [רוחב=1280] [role=0]
// בעיצוב: שכבת הסקירה (rv-*, qpanel) מוסרת לפני הצילום — השורות שהיא הזריקה (כלים שאושרו) נשארות כשורות רגילות, והמונה
// "כלי ניהול N" מוסר (החלטת הבעלים: חיפוש בלי מונה). בעיצוב הדף ב-#app; בדף האמיתי ב-.adm-app.
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const role = process.argv[4] || '0';
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const D = which === 'demo';
const ROOTS = D ? ['#app'] : ['.adm-app'];
const DUMP = (rootSels) => {
  const out = [];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  rootSels.forEach((rootSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|pulse|drag|ia-h|adm-app)$/.test(x)).sort().slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return p.join('>'); };
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi)$/i.test(el.tagName)) return;
      const bg = cs.backgroundColor, bi = cs.backgroundImage, bf = cs.backdropFilter || cs.webkitBackdropFilter;
      const p = parse(bg); const has = p && p.a > 0;
      const bw = cs.borderTopWidth, bsty = cs.borderTopStyle;
      out.push({ sel: el === root ? 'ROOT' : sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
        col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw + '/' + bsty, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        fs: cs.fontSize + '/' + cs.fontWeight + '/' + cs.lineHeight, pad: cs.padding, mar: cs.margin, gap: cs.gap, disp: cs.display, td: cs.textDecorationLine, h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top + scrollY) });
    });
  });
  return out;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('response', (r) => { if (r.status() === 404 && !/favicon/.test(r.url())) console.log('404', r.url().slice(0, 140)); });
p.on('pageerror', (e) => console.log('PAGEERR', which, e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', which, m.type(), m.text().slice(0, 200)); });
const base = D ? DEMO : `http://127.0.0.1:${PORT}/?role=${role}`;
const results = {};
const tag = `${which}-${width}${role !== '0' ? '-r' + role : ''}`;
const snap = async (name) => { await sleep(450); await p.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: true }); results[name] = await p.evaluate(DUMP, ROOTS); };
const hover = async (sel) => { await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(100); const r = await p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; }); await p.mouse.move(r.x, r.y); await sleep(400); };
const away = async () => { await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(250); };
const setView = async (v) => { await p.evaluate((vv) => document.querySelector(`.vopt[data-view="${vv}"]`).click(), v); await sleep(300); };
async function fresh() {
  await p.goto(base, { waitUntil: 'load' });
  await sleep(1300);
  if (D) {
    await p.evaluate(() => {
      ['#rvBar', '#rvIdx', '#rvLayer', '#rvPop', '#qp-host', '#rv-css', '#rvBack'].forEach((s) => { const e = document.querySelector(s); if (e) e.remove(); });
      document.querySelectorAll('#app *').forEach((e) => { [...e.classList].filter((c) => /^rv-/.test(c)).forEach((c) => e.classList.remove(c)); });
      const cnt = document.querySelector('.adm-cnt'); if (cnt) cnt.style.display = 'none';
      // המונה דחף את המתג לקצה; בלעדיו — אותו מיקום כמו בדף האמיתי
      const v = document.querySelector('.adm-bar .vsw'); if (v) v.style.marginInlineStart = 'auto';
    });
  }
  await p.evaluate(() => window.scrollTo(0, 0));
}
await fresh(); await setView('tiles'); await away(); await snap('01-tiles');
await hover('.adm-tile'); await snap('02-hover-tile');
await away(); await setView('rows'); await away(); await snap('03-rows');
await hover('.adm-rows .li'); await snap('04-hover-row');
await away(); await setView('table'); await away(); await snap('05-table');
await hover('.adm-table tbody tr'); await snap('06-hover-table-row');
await away(); await hover('.vsw'); await snap('07-hover-switch');
await away(); await setView('tiles'); await p.focus('.hf-s input'); await snap('08-focus-search');
await p.type('.hf-s input', 'גיבוי'); await sleep(200); if (D) await p.evaluate(() => document.querySelector('#admQ').dispatchEvent(new Event('input'))); await snap('09-search-results');
await p.evaluate(() => { const i = document.querySelector('.hf-s input'); i.select(); }); await p.type('.hf-s input', 'zzzz'); await away(); await snap('10-no-results');
fs.writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(results, null, 1));
console.log('done', tag, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
