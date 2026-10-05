// מצלם כל מצב של כרטיס העובד בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט.
// שימוש: node stages.mjs demo|real [רוחב=1280]. אותם בוררים בשני הצדדים (מזהי השדות והלחצנים של העיצוב נשמרו בדף האמיתי).
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const D = which === 'demo';
const ROOTS = D ? ['#app', '#toast', '#scrim', '#scrim2'] : ['.gm-ec .app.ec', '#toast', '#scrim', '#scrim2'];
const DUMP = (rootSels) => {
  const out = [];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  const NAMES = ['ROOT', 'TOAST', 'SCRIM', 'SCRIM2'];
  rootSels.forEach((rootSel, ri) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|pulse|drag|fresh|enter|bump|in|no-print|print-area)$/.test(x) && !/^(ia-)/.test(x)).sort().slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return NAMES[ri] + '>' + p.join('>'); };
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      if (el.closest('.demo,#demoBar,.qp,.demo-tog-row')) return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi)$/i.test(el.tagName)) return;
      const bg = cs.backgroundColor; const bi = cs.backgroundImage; const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      const p = parse(bg); const has = p && p.a > 0;
      const bw = cs.borderTopWidth; const bsty = cs.borderTopStyle;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim().slice(0, 70);
      out.push({ sel: el === root ? NAMES[ri] : sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
        col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw + '/' + bsty, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        fs: cs.fontSize + '/' + cs.fontWeight, pad: cs.padding, mar: cs.margin, h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top + scrollY), tx: own });
    });
  });
  return out;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
await p.emulateTimezone('Asia/Jerusalem');
// התאריך של העיצוב: 3.10.2026 (TODAY); בדף האמיתי השעון מוזז לאותו יום כדי שסימון "היום" בלוח העברי וברירת המחדל של החודש יהיו זהים
if (!D) {
  await p.evaluateOnNewDocument(() => {
    const RD = Date; const delta = new RD('2026-10-03T12:00:00+03:00').getTime() - RD.now();
    class FD extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + delta); else super(...a); } static now() { return RD.now() + delta; } }
    window.Date = FD;
  });
}
p.on('pageerror', (e) => console.log('PAGEERR', which, e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|404/.test(m.text())) console.log('CONSOLE', which, m.text().slice(0, 200)); });
p.on('dialog', (d) => d.accept().catch(() => {}));
const base = D ? DEMO : `http://127.0.0.1:${PORT}/`;
const results = {};
const snap = async (name, opts = {}) => {
  await sleep(opts.wait || 650);
  const clip = D && !opts.viewport ? await p.evaluate(() => { const r = document.querySelector('#app').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 10), width: document.documentElement.clientWidth, height: r.height + 20 }; }) : null;
  results[name] = await p.evaluate(DUMP, ROOTS); // המדידה לפני הצילום (הצילום איטי והטוסט נעלם תוך 2.6 שנ')
  await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, ...(clip ? { clip, captureBeyondViewport: true } : { fullPage: !opts.viewport }) });
};
const exists = (sel) => p.$(sel).then((h) => !!h);
const pos = (sel) => p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; });
const clickAt = async (sel) => {
  if (!(await exists(sel))) { console.log('MISSING', which, sel); return false; }
  await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(150);
  const r = await pos(sel);
  await p.mouse.move(r.x, r.y); await sleep(120); await p.mouse.click(r.x, r.y); return true;
};
const hover = async (sel) => {
  if (!(await exists(sel))) { console.log('MISSING', which, sel); return; }
  await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })); await sleep(100);
  const r = await pos(sel);
  await p.mouse.move(r.x, r.y); await sleep(400);
};
const away = async () => { await p.mouse.move(2, 400); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(250); };
async function fresh(scn) {
  await p.goto(D ? base : base + (scn ? `?scn=${scn}` : ''), { waitUntil: 'load', timeout: 120000 });
  await sleep(1500);
  if (D) {
    await p.evaluate(() => { document.body.classList.add('dlg-dark'); });
    const js = (sel) => p.$eval(sel, (el) => el.click());
    if (scn === 'new') await js('#dMode');
    if (scn === 'deptfail') { await js('#dDept'); await js('#dDept'); }
    if (scn === 'deptslow') await js('#dDept');
    await sleep(300);
    await p.evaluate(() => { document.querySelectorAll('.demo,.demo-tog-row,#qpanel,.qp-root,.qp-fab,#rv-css').forEach((e) => e.remove()); });
  }
  await p.evaluate(() => window.scrollTo(0, 0));
}
const typeInto = async (sel, text) => { await clickAt(sel); await p.keyboard.press('End'); await p.keyboard.type(text); await sleep(300); };
const escape = async () => { await p.keyboard.press('Escape'); await sleep(350); };

await fresh(''); await away(); await snap('01-details');
await clickAt('#employee-detail-phone1'); await snap('02-focus-phone');
await away(); await hover('#ecSend'); await snap('03-hover-send', { viewport: true });
await away(); await clickAt('#cbt-dept'); await snap('04-dept-open');
await escape(); await away(); await clickAt('#pwOpen'); await away(); await snap('05-pw-box');
await clickAt('#pwOk'); await snap('06-pw-empty-toast');
await away(); await clickAt('#pwSetOpen'); await snap('07-approval', { viewport: true });
await clickAt('[data-ec=au-pick]'); await snap('08-approval-picked', { viewport: true });
await escape(); await escape();
await away(); if (!D) { await p.evaluate(() => { const r = document.querySelector('[data-row="page:refunds"]'); if (r) r.closest('details').open = true; }); await sleep(300); }
await clickAt(D ? '[data-ec=p-info]' : '[data-row="page:refunds"] [data-ec=p-info]'); await snap('09-perm-info', { viewport: true });
await escape(); await away();
await fresh(''); await clickAt('#t-attendance'); await away(); await snap('10-attendance');
await clickAt('[data-ec=add]'); await away(); await snap('11-add-shift');
await clickAt('#ecDtb'); await snap('12-add-calendar');
await clickAt('[data-ec=add-cancel]'); await away(); await clickAt('[data-ec=sh-edit]'); await away(); await snap('13-edit-row');
await clickAt('[data-ec=edit-cancel]'); await away(); await clickAt('[data-ec=sh-del]'); await snap('14-confirm-delete', { viewport: true });
await escape(); await away(); await clickAt('#showDel + i').catch(() => {}); await away(); await snap('15-show-deleted');
await fresh(''); await clickAt('#t-history'); await away(); await snap('16-history', { wait: 900 });
await clickAt('.hrow[data-hv="4"] .li, .hrow:nth-child(4) .li'); await away(); await snap('17-history-email-open', { wait: 700 });
await fresh(''); await clickAt('#ecSend'); await snap('18-mail', { viewport: true, wait: 900 });
await typeInto('#m-sub', 'שעות עבודה'); await typeInto('#m-body', 'שלום, מצורף לוח המשמרות'); await away(); await snap('19-mail-filled', { viewport: true });
await clickAt('#m-send'); await snap('20-mail-approval', { viewport: true, wait: 900 });
await fresh(''); await clickAt('#ecSave'); await sleep(D ? 1300 : 450); await snap('21-saved-toast', { viewport: true, wait: D ? 650 : 200 });
await fresh('new'); await away(); await snap('30-new');
if (D) { await fresh('deptfail'); await away(); await snap('31-dept-failed'); await fresh('deptslow'); await away(); await snap('32-dept-loading'); }
else { await fresh('deptfail'); await away(); await snap('31-dept-failed'); await fresh('deptslow'); await away(); await snap('32-dept-loading'); }
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
console.log('done', which, width, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
