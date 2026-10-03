// מצלם כל מצב של דף "הפרופיל שלי" בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט.
// שימוש: node stages.mjs demo|real [רוחב=1280]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const D = which === 'demo';
// בעיצוב הדף ב-#app (.app.pf); בדף האמיתי ב-.pf-app. הטוסט (#toast) אח של הדף בשניהם. הטולטיפ וסרגל ההדגמה לא נבדקים.
const ROOTS = D ? ['#app', '#toast'] : ['.pf-app', '#toast'];
const DUMP = (rootSels) => {
  const out = [];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  rootSels.forEach((rootSel, ri) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|pulse|drag|ia-h)$/.test(x)).sort().slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return (ri ? 'TOAST>' : '') + p.join('>'); };
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi)$/i.test(el.tagName)) return;
      const bg = cs.backgroundColor, bi = cs.backgroundImage, bf = cs.backdropFilter || cs.webkitBackdropFilter;
      const p = parse(bg); const has = p && p.a > 0;
      const bw = cs.borderTopWidth, bsty = cs.borderTopStyle;
      out.push({ sel: el === root ? (ri ? 'TOAST' : 'ROOT') : sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
        col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw + '/' + bsty, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        fs: cs.fontSize + '/' + cs.fontWeight, pad: cs.padding, h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top + scrollY) });
    });
  });
  return out;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('response', (r) => { if (r.status() === 404) console.log('404', r.url().slice(0, 140)); });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
const base = D ? DEMO : `http://127.0.0.1:${PORT}/`;
const results = {};
const snap = async (name) => { await sleep(500); await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, fullPage: true }); results[name] = await p.evaluate(DUMP, ROOTS); };
const clickAt = async (sel) => { await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(150); const r = await p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; }); await p.mouse.move(r.x, r.y); await sleep(150); await p.mouse.click(r.x, r.y); };
const hover = async (sel) => { await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(100); const r = await p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; }); await p.mouse.move(r.x, r.y); await sleep(350); };
const away = async () => { await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(250); };
async function fresh(scn) {
  await p.goto(D ? base : base + (scn ? `?scn=${scn}` : ''), { waitUntil: 'load' });
  await sleep(1400);
  if (D && scn === 'photo') await p.evaluate(() => document.querySelector('#dPhoto').click());
  if (D && scn === 'noimg') await p.evaluate(() => document.querySelector('#dImg').click());
  await p.evaluate(() => window.scrollTo(0, 0));
}
const SAVE = '.pf-save .btn', BACK = '.topbar .back', PWOPEN = '.pf-pwact .btn', PWOK = '.pf-pwbtns .btn.primary', PWCANCEL = '.pf-pwbtns .btn.ghost';
await fresh(''); await away(); await snap('01-default');
await hover(SAVE); await snap('02-hover-save');
await hover(BACK); await snap('03-hover-back');
await away(); await p.focus('#profile-firstName'); await snap('04-focus-input');
await away(); await hover('#receiveEmailAlerts'); await snap('05-hover-switch');
await away(); await p.focus('#receiveEmailAlerts'); await p.keyboard.press('Tab'); await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); await snap('06-focus-switch');
await away(); await hover('.pf-up'); await snap('07-hover-upload');
await away(); await hover('#profile-joinDate'); await snap('08-hover-disabled');
await away(); await clickAt(PWOPEN); await sleep(500); await away(); await snap('09-pw-open');
await p.type('#profile-newPassword', 'x1y2z3'); await clickAt('#profile-newPassword + .inpx'); await hover('#profile-newPassword + .inpx'); await snap('10-pw-eye-shown');
await away(); await hover(PWCANCEL); await snap('11-hover-pw-cancel');
await hover(PWOK); await snap('12-hover-pw-ok');
await fresh(''); await clickAt(PWOPEN); await sleep(400); await clickAt(PWOK); await sleep(500); await away(); await snap('13-toast-error');
await fresh('photo'); await away(); await snap('14-photo');
await hover('.pf-avrow .btn'); await snap('15-hover-remove');
await fresh('noimg'); await away(); await snap('16-no-image-setting');
if (!D) {
  await fresh('loading'); await away(); await snap('17-loading');
  await fresh('unauth'); await away(); await snap('18-unauth');
  await fresh('saveerr'); await clickAt(SAVE); await sleep(600); await away(); await snap('19-save-error-toast');
  await fresh(''); await clickAt(SAVE); await sleep(600); await away(); await snap('20-save-ok-toast');
}
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
console.log('done', which, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
