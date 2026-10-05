// מצלם כל מצב של כרטיס הלקוח בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט.
// שימוש: node stages.mjs demo|real [רוחב=1280]. אותם בוררים בשני הצדדים (data-act / data-tab / מזהי השדות של העיצוב).
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const D = which === 'demo';
const ROOTS = D ? ['#app', '#toast', '#scrim', '#scrim2', '#rt'] : ['.cc-app', '#toast', '#scrim', '#scrim2', '#rt'];
const DUMP = (rootSels) => {
  const out = [];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  const NAMES = ['ROOT', 'TOAST', 'SCRIM', 'SCRIM2', 'RT'];
  rootSels.forEach((rootSel, ri) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|pulse|drag|fresh|enter|bump|in)$/.test(x) && !/^(ia-|cc-|rv)/.test(x)).sort().slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return NAMES[ri] + '>' + p.join('>'); };
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      if (el.closest('.rvb,.rv-e,.rvd-td,.demo,#demoBar,.qp')) return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi)$/i.test(el.tagName)) return;
      const bg = cs.backgroundColor; const bi = cs.backgroundImage; const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      const p = parse(bg); const has = p && p.a > 0;
      const bw = cs.borderTopWidth; const bsty = cs.borderTopStyle;
      out.push({ sel: el === root ? NAMES[ri] : sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
        col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw + '/' + bsty, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        fs: cs.fontSize + '/' + cs.fontWeight, pad: cs.padding, mar: cs.margin, h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top + scrollY) });
    });
  });
  return out;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERR', which, e.message));
p.on('dialog', (d) => d.accept().catch(() => {}));
const base = D ? DEMO : `http://127.0.0.1:${PORT}/`;
const results = {};
const snap = async (name, opts = {}) => {
  await sleep(opts.wait || 650);
  // העיצוב: רק אזור הכרטיס (#app) - בלי טבלאות שכבת הסקירה שמתחתיו
  const clip = D && !opts.viewport ? await p.evaluate(() => { const r = document.querySelector('#app').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 10), width: document.documentElement.clientWidth, height: r.height + 20 }; }) : null;
  await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, ...(clip ? { clip, captureBeyondViewport: true } : { fullPage: !opts.viewport }) });
  results[name] = await p.evaluate(DUMP, ROOTS);
};
const exists = (sel) => p.$(sel).then((h) => !!h);
const clickAt = async (sel) => {
  if (!(await exists(sel))) { console.log('MISSING', which, sel); return false; }
  await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(150);
  const r = await p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; });
  await p.mouse.move(r.x, r.y); await sleep(120); await p.mouse.click(r.x, r.y); return true;
};
const hover = async (sel) => {
  if (!(await exists(sel))) { console.log('MISSING', which, sel); return; }
  await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(100);
  const r = await p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; });
  await p.mouse.move(r.x, r.y); await sleep(400);
};
const away = async () => { await p.mouse.move(2, 400); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(250); };
async function fresh(scn) {
  await p.goto(D ? base : base + (scn ? `?scn=${scn}` : ''), { waitUntil: 'load' });
  await sleep(1500);
  // העיצוב: חלונות כהים; שכבת הסקירה (תגיות rvb, שורות rv-e/rv-s של הסוקר, סרגל ההדגמה) מוסרת - היא לא חלק מהעיצוב
  if (D) await p.evaluate(() => { try { localStorage.setItem('dlgTheme', 'dark'); } catch (e) { /* noop */ } document.body.classList.add('dlg-dark', 'rv-nob'); document.querySelectorAll('.rvb,.rv-e,.demo,.demo-tog-row,#qpanel,.qp-root,.qp-fab,#rv-css').forEach((e) => e.remove()); });
  await p.evaluate(() => window.scrollTo(0, 0));
}
const typeInto = async (sel, text) => { await clickAt(sel); await p.keyboard.press('End'); await p.keyboard.type(text); await sleep(300); };
const escape = async () => { await p.keyboard.press('Escape'); await sleep(350); };

await fresh(''); await away(); await snap('01-details');
await hover('[data-act=editcust]'); await snap('02-hover-pencil');
await away(); await clickAt('[data-act=editcust]'); await away(); await snap('03-edit');
await clickAt('#cPhone'); await snap('04-focus-phone');
await typeInto('#cCity', ' עילית'); await away(); await snap('05-rail-change-toast');
await hover('.rail [data-rich=pay]'); await snap('06-rich-pay', { viewport: true });
await away(); await hover('.rail .cl'); await snap('07-hover-change', { viewport: true });
await away(); await clickAt('.rail [data-act=save]'); await snap('08-dlg-summary', { viewport: true });
await clickAt('#dlg [data-act=do-save]'); await snap('09-dlg-success', { viewport: true });
await fresh(''); await clickAt('[data-act=editcust]'); await typeInto('#cCity', ' עילית'); await away();
await clickAt('.rail [data-act=discard]'); await snap('10-dlg-discard', { viewport: true });
await escape(); await clickAt('.topbar .back'); await snap('11-dlg-exit', { viewport: true });
await fresh(''); await clickAt('[data-tab=orders]'); await away(); await snap('12-orders');
await clickAt('#p-orders [data-act=oopen]'); await away(); await snap('13-order-open');
await clickAt('#p-orders .vsw button:nth-of-type(2)'); await away(); await snap('14-orders-table');
await clickAt('[data-tab=payments]'); await away(); await snap('15-payments');
await clickAt('#p-payments [data-act=pay-now]'); await snap('16-dlg-pay', { viewport: true });
await escape(); await clickAt('[data-tab=history]'); await away(); await snap('17-history', { wait: 900 });
await clickAt('.hf-t'); await snap('18-history-filter');
await escape(); await away(); await clickAt('#p-history .vsw button:nth-of-type(2)'); await away(); await snap('19-history-table');
await fresh(''); await clickAt('.tools [data-act=menu]'); await snap('20-print-menu', { viewport: true });
await fresh(''); await clickAt('.tools [data-act=delete]'); await snap('21-dlg-delete', { viewport: true });
await fresh(''); await clickAt('#p-details .btn[data-act=mail-open]'); await snap('22-mail', { viewport: true, wait: 900 });
await typeInto('#m-body', 'שלום, מצורפים פרטי הכרטיס'); await clickAt('#m-send'); await snap('23-dlg-approval', { viewport: true, wait: 900 });
if (!D) {
  await fresh('blocked'); await away(); await snap('30-blocked');
  await fresh('new'); await away(); await snap('31-new-customer');
  await fresh('loading'); await away(); await snap('32-loading', { viewport: true });
  await fresh('notfound'); await away(); await snap('33-notfound', { viewport: true });
}
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
console.log('done', which, width, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
