// מצלם כל מצב של "סיכום נוכחות" בדף האמיתי (real, API מדומה מ-data.mjs) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט
// תחת #app ו-#dlg (החלונות). שימוש: node stages.mjs demo|real [רוחב=1280]   (אחרי build.mjs; ר' run.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const D = which === 'demo';
const ROOTS = ['#app', '#dlg'];
const DUMP = (rootSels) => {
  const out = [];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  rootSels.forEach((rootSel, ri) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|pulse|drag|ia-h|open|foc)$/.test(x)).sort().slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return (ri ? 'DLG>' : '') + p.join('>'); };
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      if (el.closest('.lz-wps,.pv-scroll')) return; // התצוגה המקדימה: בעיצוב גיליונות מוטמעים, בדף iframe של דף ההדפסה (נבדק בנפרד ב-print.mjs)
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi)$/i.test(el.tagName)) return;
      const bg = cs.backgroundColor; const bi = cs.backgroundImage; const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      const p = parse(bg); const has = p && p.a > 0;
      const bw = cs.borderTopWidth; const bsty = cs.borderTopStyle;
      out.push({ sel: el === root ? (ri ? 'DLG' : 'ROOT') : sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
        col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw + '/' + bsty, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        fs: cs.fontSize + '/' + cs.fontWeight, pad: cs.padding, h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top + scrollY), txt: (el.children.length ? '' : (el.textContent || '').trim().slice(0, 40)) });
    });
  });
  return out;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log(which, 'PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|ERR_FILE_NOT_FOUND|home-bg/.test(m.text())) console.log(which, 'CONSOLE', m.type(), m.text().slice(0, 200)); });
const results = {};
const snap = async (name) => {
  await sleep(700);
  await p.evaluate(() => { document.querySelectorAll('#qp-host,.demo-tog-row,#demoBar,.pl-tt,#tt').forEach((x) => { x.style.visibility = 'hidden'; }); });
  await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, fullPage: true });
  results[name] = await p.evaluate(DUMP, ROOTS);
};
const click = async (sel) => {
  const ok = await p.evaluate((q) => { const el = document.querySelector(q); if (!el) return false; el.scrollIntoView({ block: 'center' }); return true; }, sel);
  if (!ok) { console.log(which, 'MISSING', sel); return; }
  await sleep(150);
  await p.$eval(sel, (el) => el.click());
  await sleep(350);
};
const away = async () => { await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(200); };
async function fresh(q = {}) {
  if (D) {
    await p.goto(DEMO, { waitUntil: 'load' });
    await sleep(1300);
    // לוח השאלות של הבעלים (QPanel) לא חלק מהדף - סוגרים/מסתירים אותו
    await p.evaluate(() => { try { if (window.QPanel && window.QPanel.close) window.QPanel.close(); } catch (e) { /* */ } const h = document.querySelector('#qp-host'); if (h) h.remove(); });
    if (q.role === 'emp') await p.evaluate(() => document.querySelector('#dRole').click());
    if (q.scn === 'empty') await p.evaluate(() => document.querySelector('#dState').click());
    if (q.view) await p.evaluate((o) => window.__ATT.go(o.view, { empId: o.emp, back: 'month' }), q);
  } else {
    const u = new URLSearchParams({ role: q.role || 'mgr', ...(q.view ? { view: q.view } : {}), ...(q.emp ? { emp: q.emp } : {}), ...(q.scn ? { scn: q.scn } : {}) });
    await p.goto(`http://127.0.0.1:${PORT}/?${u}`, { waitUntil: 'load' });
    await sleep(1300);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await away();
}
await fresh(); await snap('01-month');
await click('tr.at-r[data-id="e1"]'); await away(); await snap('02-row-open');
await fresh(); await click('#cbt-month'); await snap('03-month-combo');
await fresh({ view: 'byemp', emp: 'e1' }); await snap('04-byemp-p1');
await click('.at-pg [data-pg="1"]'); await away(); await snap('05-byemp-p2');
await fresh({ view: 'emp', emp: 'e4' }); await snap('06-edit');
await p.$eval('#showDel', (el) => el.click()); await sleep(500); await away(); await snap('07-edit-deleted');
await fresh({ view: 'emp', emp: 'e4' }); await click('.ec-tool .btn.primary'); await away(); await snap('08-edit-add');
await click('#ecDtb'); await away(); await snap('09-edit-add-calendar');
await fresh({ view: 'emp', emp: 'e4' }); await click('button[aria-label="ערוך רק כניסה ויציאה"]'); await away(); await snap('10-edit-row');
await fresh({ view: 'emp', emp: 'e4' }); await click('.ec-tool .btn:not(.primary)'); await sleep(400); await snap('11-history');
await fresh({ view: 'emp', emp: 'e4' }); await click('button[aria-label="מחק"]'); await sleep(300); await snap('12-confirm-delete');
await fresh(); await click('#atTools .xlbtn.xlp'); await sleep(600); await snap('13-wizard-print');
await fresh(); await click('#atTools .xlbtn.xlg'); await sleep(600); await snap('14-wizard-xl');
await fresh(); await click('tr.at-r[data-id="e2"] .at-rt .xlbtn.xlp'); await sleep(500); await snap('15-quick-print');
await fresh({ role: 'emp' }); await snap('16-emp-month');
await fresh({ role: 'emp', view: 'emp' }); await snap('17-emp-edit');
await fresh({ role: 'emp' }); await click('#atTools .xlbtn.xlp'); await sleep(600); await snap('18-emp-wizard');
await fresh({ role: 'emp', view: 'byemp' }); await snap('19-emp-byemp');
await fresh({ scn: 'empty' }); await snap('20-empty');
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
console.log('done', which, width, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
