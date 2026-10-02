// Render + comparison harness for group 3 pages (PP-07 א/ב, PP-10, PP-11, PP-12, PP-18). No dev server, no DB, no port 3000.
//   node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/ppg3-render.mjs [scenario,...] [long]
//   (first run once: node scripts/schedule-print-tests/ppg3-design-ref.mjs  -> fixtures/ppg3-design-sample.json + out/design-*.png/metrics)
//
// Scenarios feed the REAL page modules (lib/schedule/print/pages/PP-xx.js via buildPrintPayload + loadExtras on the mock prisma) and the REAL
// React templates (PrintShell + pages/PPxx.js) with the SAME sample data the approved design page uses (fixtures/ppg3-design-sample.json, dumped
// from דפי-הדפסה-עיצוב.html). Per scenario:
//   1. screen render -> out/ppg3-<name>.png (one PNG per sheet), geometry vs the design sheet (row heights, column widths, fonts) and a
//      pixel diff of the head+body region against out/design-<id>.png (python PIL);
//   2. print media: computed styles (white bg, fixed fonts, --rp 2.3mm, no colour leaks, navbar hidden, thead/tfoot repeat);
//   3. page.pdf() + pypdf: page count, header/footer on every page, "עמוד X מתוך Y", no row split, group title not stranded, per-page barcodes.
// CSS order = the live page's: page-local pp*.css (imported by the templates) BEFORE print.css (imported last by app/schedule/print/[page]/page.js).
// "long" = ~60 synthetic rows / many orders to force several pages (repeating thead, per-order pages, overflow of one order).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { installDb } from '../schedule-tests/fixtures.mjs';

const PROJ = process.env.PROJ;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);

const args = process.argv.slice(2);
const long = args.includes('long');
const sweep = args.includes('sweep');
const combo = args.includes('combo');
const only = (args.find((a) => a !== 'long' && a !== 'sweep' && a !== 'combo') || '').split(',').filter(Boolean);
const DAY = '2026-10-14';
const NOW = new Date('2026-10-14T05:12:00Z'); // 08:12 Israel (summer time) -> the design footer says 08:12

const sample = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'ppg3-design-sample.json'), 'utf8'));
const ORD = sample.ord;
const designMetrics = fs.existsSync(path.join(OUT, 'design-metrics.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'design-metrics.json'), 'utf8')) : {};

// ---- sample data -> schedule rows ---------------------------------------------------------------------------------
const cust = (o) => ({ firstName: o.first, lastName: o.last, name: o.name, phone1: o.ph, phone2: o.ph2 || '' });
const prepRow = (o, ev) => ({
  orderId: o.id, stage: 'prep', customer: cust(o), eventKey: ev, eventDateHebrew: null, dressCount: o.n, notes: o.notes || '', done: null, alerts: [],
  items: o.dresses.map((d, k) => ({ orderItemId: `it-${o.id}-${k}`, model: d.lab, size: String(d.size), modelPrefix: d.pre, location: null, inRepair: false })),
});
const delRow = (o, stage, ev, dispatch) => ({
  orderId: o.id, stage, customer: cust(o), eventKey: ev, eventDateHebrew: null, dressCount: o.n, notes: o.notes || '',
  address: { street: o.street, city: o.city, full: o.street && o.city ? `${o.street}, ${o.city}` : (o.street || o.city) },
  dispatchDate: dispatch, chargeExists: false, done: null, alerts: [],
});
const O = (i) => ORD[i];
const mkDay = (stages) => ({ date: DAY, weekday: 'יום רביעי', isToday: false, nonWorkingDay: false, settings: { branchFilter: null, pickupHours: '20:00-21:30' }, stages: Object.entries(stages).map(([key, items]) => ({ key, items })), truncated: false, warnings: [] });
const dbOrders = (list) => list.map((o) => ({
  orderId: o.id, isDelivery: !!o.del, deliveryDirection: 'הלוך',
  items: o.dresses.map((d, k) => {
    const rep = o.i % 3 === 0 ? d.rep : null;
    return { id: `it-${o.id}-${k}`, isDeleted: false, neckAlteration: rep && rep.neck ? rep.neck : 0, lengthAlteration: rep && rep.len ? rep.len : null, sleeveAlteration: rep && rep.sleeve ? rep.sleeve : 0, alterationDetails: rep && rep.det ? rep.det : null };
  }),
}));

// synthetic extras for "long": cycle the design customers under new order ids (ids stay <= 9 digits, Code 39 safe)
const manyOrders = (n, base = 50000) => Array.from({ length: n }, (_, i) => {
  const o = ORD[i % ORD.length];
  const id = base + i * 7;
  return { ...o, id, n: 1 + (i % 4), notes: i % 5 === 0 ? 'הערה לדוגמה מספר ' + i : '', dresses: Array.from({ length: 1 + (i % 4) }, (_, k) => ({ ...o.dresses[k % o.dresses.length], rep: o.dresses[0].rep })) };
});

const SCENARIOS = {};
const add = (name, def) => { SCENARIOS[name] = def; };
if (sweep) {
  // keep-with-next sweep: group 1 grows 10..17 rows, group 2 follows - at some size the 2nd group title lands at the bottom of page 1
  for (let k = 10; k <= 17; k++) {
    const d = manyOrders(k + 4, 100000 + k * 1000);
    add('PP-10-sweep-' + k, { key: 'PP-10', orders: [], day: mkDay({ dout: d.map((o, i) => delRow(o, 'dout', i < k ? '2026-10-15' : '2026-10-16', DAY)) }) });
    add('PP-11-sweep-' + k, { key: 'PP-11', orders: [], day: mkDay({ dout: d.map((o, i) => delRow({ ...o, city: i < k ? 'ירושלים' : 'בני ברק' }, 'dout', '2026-10-15', DAY)) }) });
  }
} else if (combo) {
  // several pages of the group in ONE document (what the wizard prints for "all pages of the day"): page counters must run 1..N over the whole document
  const pr = [0, 2, 1, 4].map(O); const dl = [0, 2, 3, 5].map(O);
  add('combo-07b-10-12-11-18', { keys: ['PP-07', 'PP-10', 'PP-11', 'PP-12'], versions: { 'PP-07': 'b' }, combo: true, orders: pr, expectPages: 4 + 1 + 1 + 4, day: mkDay({ prep: pr.map((o) => prepRow(o, '2026-10-19')), dout: dl.map((o) => delRow(o, 'dout', '2026-10-15', DAY)) }) });
} else if (!long) {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(O);
  // the page prints deliveries first (07 "משלוחים קודם", also in version ב); the design sample lists 0,1,2,4 -> 1 is a pickup, so it moves last
  const b = [0, 2, 1, 4].map(O);
  add('PP-07a', { key: 'PP-07', version: 'a', designId: '07a', pixelUntilOrder: 40152, orders: a, day: mkDay({ prep: a.map((o) => prepRow(o, '2026-10-19')) }), expectPages: 1 });
  add('PP-07b', { key: 'PP-07', version: 'b', designId: '07b', orders: b, day: mkDay({ prep: b.map((o) => prepRow(o, '2026-10-19')) }), expectPages: 4, perOrder: true, designOrder: [1, 3, 2, 4] });
  const g10 = [[ '2026-10-15', [0, 2, 3, 5, 6, 11, 12, 14]], ['2026-10-16', [8, 9, 15, 17, 18, 20]]];
  const d10 = g10.flatMap(([ev, ids]) => ids.map((i) => delRow(O(i), 'dout', ev, DAY)));
  add('PP-10', { key: 'PP-10', designId: '10', orders: [], day: mkDay({ dout: d10 }), expectPages: 1 });
  const ids11 = [0, 6, 11, 15, 20, 2, 21, 17];
  add('PP-11', { key: 'PP-11', designId: '11', orders: [], day: mkDay({ dout: ids11.map((i) => delRow(O(i), 'dout', '2026-10-15', DAY)) }), expectPages: 1 });
  const ids12 = [0, 2, 3, 5];
  add('PP-12', { key: 'PP-12', designId: '12', orders: [], day: mkDay({ dout: ids12.map((i) => delRow(O(i), 'dout', '2026-10-15', DAY)) }), expectPages: 4, perOrder: true });
  // the design lists the 13.10 group first (hand-written order); the page sorts groups by event date like groupDeliveryRowsForCourier, so the dates are swapped to keep the row order comparable
  const g18 = [['2026-10-12', [0, 2, 3, 5, 6, 11, 12]], ['2026-10-13', [9, 14, 15, 18, 20]]];
  add('PP-18', { key: 'PP-18', designId: '18', orders: [], day: mkDay({ dback: g18.flatMap(([ev, ids]) => ids.map((i) => delRow(O(i), 'dback', ev, DAY))) }), expectPages: 1 });
} else {
  const m = manyOrders(46);
  add('PP-07a-long', { key: 'PP-07', version: 'a', orders: m, day: mkDay({ prep: m.map((o, i) => prepRow(o, i % 2 ? '2026-10-19' : '2026-10-20')) }) });
  // order 0 has 14 dresses + a long note: one order that cannot fit one page -> counters must still be right
  const big = { ...manyOrders(1, 70000)[0], n: 26, notes: 'הערה ארוכה להזמנה '.repeat(12) };
  big.dresses = Array.from({ length: 26 }, (_, k) => ({ ...ORD[1].dresses[0], lab: 'דגם ארוך מספר ' + k + ' - ' + (1000 + k), size: 36 + (k % 6) * 2, rep: ORD[0].dresses[0].rep }));
  big.i = 0;
  const mb = [...manyOrders(3, 71000), big, ...manyOrders(2, 72000)];
  add('PP-07b-long', { key: 'PP-07', version: 'b', orders: mb, day: mkDay({ prep: mb.map((o) => prepRow(o, '2026-10-19')) }), perOrder: true });
  add('PP-07b-big', { key: 'PP-07', version: 'b', orders: [big], day: mkDay({ prep: [prepRow(big, '2026-10-19')] }), perOrder: true });
  const d = manyOrders(60, 80000);
  add('PP-10-long', { key: 'PP-10', orders: [], day: mkDay({ dout: d.map((o, i) => delRow(o, 'dout', ['2026-10-15', '2026-10-16', '2026-10-18'][i % 3], DAY)) }) });
  add('PP-11-long', { key: 'PP-11', orders: [], day: mkDay({ dout: d.map((o) => delRow(o, 'dout', '2026-10-15', DAY)) }) });
  const t = manyOrders(9, 90000);
  // one delivery note whose order note is far too long for one page: the rest must continue on page 2 (not be clipped)
  const longNote = { ...manyOrders(1, 91000)[0], notes: Array.from({ length: 160 }, (_, i) => 'הערה ארוכה מאוד מספר ' + i + '.').join(' ') };
  add('PP-12-bignote', { key: 'PP-12', orders: [], day: mkDay({ dout: [delRow(longNote, 'dout', '2026-10-15', DAY)] }), perOrder: true, expectNotePages: 2 });
  add('PP-12-long', { key: 'PP-12', orders: [], day: mkDay({ dout: t.map((o) => delRow(o, 'dout', '2026-10-15', DAY)) }), perOrder: true });
  add('PP-18-long', { key: 'PP-18', orders: [], day: mkDay({ dback: d.map((o, i) => delRow(o, 'dback', ['2026-10-13', '2026-10-12'][i % 2], DAY)) }) });
}

// ---- helpers --------------------------------------------------------------------------------------------------------
const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');
const { PrintDocument } = await L('app/components/schedule/print/PrintShell.js');
const { orderCode, isValidCode39 } = await L('lib/schedule/print/barcode.js');
const css = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
const pageCssDir = path.join(PROJ, 'app/components/schedule/print/pages');
const pageCss = fs.readdirSync(pageCssDir).filter((f) => f.endsWith('.css')).map((f) => `<link rel="stylesheet" href="${css('app/components/schedule/print/pages/' + f)}">`).join('');
const rowsOf = (d) => d.rows || d.orders || (d.groups || []).flatMap((g) => g.rows);
const hasHeb = (t, w) => new RegExp('(^|[^א-ת])' + w + '([^א-ת]|$)').test(t);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const results = [];
try {
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    if (only.length && !only.includes(name) && !only.includes(sc.key)) continue;
    installDb({ extra: { order: dbOrders(sc.orders) } });
    const keys = sc.keys || [sc.key];
    const extras = await loadExtras(sc.day, keys.map(getPrintPage));
    const payload = buildPrintPayload({ day: sc.day, keys, versions: sc.versions || (sc.version ? { [sc.key]: sc.version } : {}), extras, gmach: { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' }, printedBy: 'מנהלת (דוגמה)', now: NOW });
    const page = payload.pages[0];
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { payload }));
    const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${payload.pages.map((x) => x.def.label).join(' · ')}</title>
<link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">
${pageCss}<link rel="stylesheet" href="${css('app/components/schedule/print/print.css')}">
<style>/* harness only: print.css sets border-collapse:collapse on the sheet table, which ignores its own padding on SCREEN - emulate the design's sheet padding so the screen geometry is comparable */@media screen{.pp-paper .pp-sheet{border-collapse:separate!important;border-spacing:0}}</style>${process.env.NOMIN === '1' ? '<style>.pp-root .pp-p7,.pp-root .pp-dn-wrap{min-height:0!important}</style>' : ''}${process.env.NOAVOID === '1' ? '<style>.pp-t tr.g,.pp-t tr.g td{break-after:auto!important;page-break-after:auto!important}</style>' : ''}</head>
<body class="hide-global-nav pp-print-mode"><nav class="navbar">תפריט (מדמה את המעטפת)</nav><div data-print-ready="true">${body}</div></body></html>`;
    const htmlPath = path.join(OUT, 'ppg3-' + name + '.html');
    fs.writeFileSync(htmlPath, html);
    fs.writeFileSync(path.join(OUT, 'ppg3-' + name + '.payload.json'), JSON.stringify({ meta: payload.meta, page: { key: page.key, version: page.version, data: page.data, pageCode: page.pageCode } }, null, 1));

    const tab = await browser.newPage();
    await tab.setViewport({ width: 1000, height: 1300, deviceScaleFactor: 1 });
    await tab.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
    // screen: screenshots per sheet + geometry
    const sheets = await tab.$$('.pp-sheet');
    const shots = [];
    for (let i = 0; i < sheets.length; i++) {
      const f = path.join(OUT, `ppg3-${name}${sheets.length > 1 ? '-' + (i + 1) : ''}.png`);
      if (!long || i < 3) await sheets[i].screenshot({ path: f });
      shots.push(f);
    }
    const dom = await tab.evaluate(() => {
      const cs = (el, p) => (el ? getComputedStyle(el)[p] : null);
      return [...document.querySelectorAll('.pp-sheet')].map((s) => {
        const q = (sel) => s.querySelector(sel);
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), top: +(b.top - s.getBoundingClientRect().top).toFixed(1), bottom: +(b.bottom - s.getBoundingClientRect().top).toFixed(1) }; };
        const trs = [...s.querySelectorAll('.pp-body .pp-t tbody tr')];
        return {
          pid: s.dataset.pid,
          headCode: (q('.pp-head svg.pp-bcsvg') || {}).dataset ? q('.pp-head svg.pp-bcsvg').dataset.code : null,
          headCodeNote: q('.pp-head .pp-bc small') ? q('.pp-head .pp-bc small').textContent : null,
          rowCodes: [...s.querySelectorAll('.pp-body svg.pp-bcsvg')].map((x) => x.dataset.code),
          bcRects: [...s.querySelectorAll('.pp-body svg.pp-bcsvg')].slice(0, 3).map((x) => x.querySelectorAll('rect').length),
          text: s.innerText,
          title: (q('.pp-tb h1') || {}).textContent, sub: (q('.pp-tb p') || {}).textContent, sum: (q('.pp-sum') || {}).textContent, pn: (q('.pp-pn') || {}).textContent,
          h1: cs(q('.pp-tb h1'), 'fontSize'), tbH: (r(q('.pp-tb')) || {}).h, headH: (r(q('.pp-head')) || {}).h,
          rowsH: trs.map((tr) => +tr.getBoundingClientRect().height.toFixed(1)),
          thW: [...s.querySelectorAll('.pp-body .pp-t thead th')].map((th) => +th.getBoundingClientRect().width.toFixed(1)),
          rowBottoms: Object.fromEntries(trs.map((tr) => { const m = tr.textContent.match(/#(\d+)/); return [m ? m[1] : 'x' + Math.random(), +(tr.getBoundingClientRect().bottom - s.getBoundingClientRect().top).toFixed(1)]; })),
          lastRowBottom: trs.length ? +(trs[trs.length - 1].getBoundingClientRect().bottom - s.getBoundingClientRect().top).toFixed(1) : null,
          bodyBottom: (r(q('.pp-body')) || {}).bottom, sheetH: (r(s) || {}).h,
          dn: r(q('.pp-dn')), nm: cs(q('.pp-dn .nm'), 'fontSize'), ad: cs(q('.pp-dn .ad'), 'fontSize'),
          groupTitles: [...s.querySelectorAll('.pp-t tr.g td')].map((td) => td.textContent),
          dnBarcodes: s.querySelectorAll('.pp-dn svg').length,
          bagInputs: s.querySelectorAll('.pp-dn .bagrow .pp-ul').length, sgCells: s.querySelectorAll('.pp-dn .sg div').length,
        };
      });
    });

    // print media: computed styles
    await tab.emulateMediaType('print');
    const styles = await tab.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      const root = document.querySelector('.pp-root'); const sheet = document.querySelector('.pp-sheet');
      const th = document.querySelector('.pp-t th'); const td = document.querySelector('.pp-t tbody tr:not(.g) td');
      const h1 = document.querySelector('.pp-tb h1'); const nav = document.querySelector('.navbar');
      const bad = [];
      for (const el of document.querySelectorAll('.pp-root, .pp-root *')) {
        const s = cs(el); const bg = s.backgroundColor;
        const m = bg.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (m && m[4] !== '0' && (Math.max(m[1], m[2], m[3]) - Math.min(m[1], m[2], m[3]) > 12)) bad.push({ tag: el.tagName, cls: el.className && el.className.baseVal === undefined ? el.className : '', bg });
        if (s.backgroundImage && s.backgroundImage !== 'none' && !/repeating-linear-gradient/.test(s.backgroundImage) && el.tagName !== 'rect') bad.push({ tag: el.tagName, cls: el.className, bgi: s.backgroundImage.slice(0, 60) });
        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
          if (parseFloat(s['border' + side + 'Width']) === 0 || s['border' + side + 'Style'] === 'none') continue;
          const bc = s['border' + side + 'Color'].match(/rgba?\((\d+), (\d+), (\d+)/);
          if (bc && (Math.max(bc[1], bc[2], bc[3]) - Math.min(bc[1], bc[2], bc[3]) > 12)) { bad.push({ tag: el.tagName, cls: String(el.className && el.className.baseVal === undefined ? el.className : ''), border: side + ' ' + s['border' + side + 'Color'] }); break; }
        }
        if (s.boxShadow && s.boxShadow !== 'none' && !el.matches('.pp-paper .pp-sheet') && !el.closest('.pp-status')) bad.push({ tag: el.tagName, cls: String(el.className && el.className.baseVal === undefined ? el.className : ''), shadow: s.boxShadow.slice(0, 40) });
        // colours: text must be black/grey (no theme colour)
        const c = s.color.match(/rgba?\((\d+), (\d+), (\d+)/);
        if (c && (Math.max(c[1], c[2], c[3]) - Math.min(c[1], c[2], c[3]) > 12)) bad.push({ tag: el.tagName, cls: String(el.className && el.className.baseVal === undefined ? el.className : ''), color: s.color });
      }
      return {
        bodyBg: cs(document.body).backgroundColor, rootBg: cs(root).backgroundColor, rootColor: cs(root).color, rootFont: cs(root).fontFamily, rootDir: cs(root).direction,
        h1Font: h1 ? cs(h1).fontFamily : null, h1Size: h1 ? cs(h1).fontSize : null,
        thBg: th ? cs(th).backgroundColor : null, thPosition: th ? cs(th).position : null,
        tdBreak: td ? cs(td.parentElement).breakInside : null, rp: root ? cs(root).getPropertyValue('--rp').trim() : null,
        navDisplay: nav ? cs(nav).display : null, theadDisplay: sheet ? cs(sheet.tHead).display : null, tfootDisplay: sheet ? cs(sheet.tFoot).display : null,
        leaks: bad.slice(0, 10), leakCount: bad.length,
      };
    });
    const pdfPath = path.join(OUT, 'ppg3-' + name + '.pdf');
    await tab.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
    const jsonPath = path.join(OUT, 'ppg3-' + name + '.pdf.json');
    const py = spawnSync('python', [path.join(HERE, 'pdfcheck.py'), pdfPath, jsonPath], { encoding: 'utf8' });
    const pdf = py.status === 0 && fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : { pages: null, text: [] };
    spawnSync('python', [path.join(HERE, 'ppg3-pdfpng.py'), pdfPath, path.join(OUT, 'ppg3-' + name + '-pdf'), long ? '2' : '4'], { encoding: 'utf8' });
    await tab.close();

    // design comparison
    const dm = sc.designId && designMetrics['design-' + sc.designId] ? designMetrics['design-' + sc.designId] : null;
    const cmp = dm ? compare(dm, dom, shots, sc.designId, sc) : null;
    results.push({ name, sc, page, dom, styles, pdf, cmp });
  }
} finally {
  await browser.close();
}

// ---- compare with the design --------------------------------------------------------------------------------------
function compare(dm, dom, shots, designId, sc) {
  const out = { geometry: [], pixel: [] };
  for (let i = 0; i < Math.min(dm.length, dom.length); i++) {
    const di = sc.designOrder ? sc.designOrder[i] - 1 : i;
    const d = dm[di]; const m = dom[i];
    const g = { sheet: i + 1, h1: [d.h1, m.h1], headH: [d.headH, m.headH], tbH: [d.tbH, m.tbH], rows: d.rowsH.length === m.rowsH.length ? 'same count ' + m.rowsH.length : `design ${d.rowsH.length} rows / mine ${m.rowsH.length}` };
    // row heights and column widths: max abs diff over the common prefix
    const dr = d.rowsH.map((h, k) => Math.abs(h - (m.rowsH[k] ?? h)));
    g.rowDiffMax = dr.length ? Math.max(...dr) : 0;
    const dw = d.thW.map((w, k) => Math.abs(w - (m.thW[k] ?? w)));
    g.thWDiffMax = dw.length ? Math.max(...dw) : 0;
    g.thCount = [d.thW.length, m.thW.length];
    if (d.dn) { g.dn = { designFont: [d.nm, d.ad], mineFont: [m.nm, m.ad] }; }
    out.geometry.push(g);
    const dp = path.join(OUT, `design-${designId}${dm.length > 1 ? '-' + (di + 1) : ''}.png`);
    const mp = shots[i];
    if (fs.existsSync(dp) && fs.existsSync(mp)) {
      const until = sc.pixelUntilOrder && m.rowBottoms[sc.pixelUntilOrder];
      const bottom = Math.round(until ? until + 1 : Math.max(m.lastRowBottom || 0, d.dn ? m.dn?.bottom || 0 : 0) + 4);
      const py = spawnSync('python', [path.join(HERE, 'ppg3-pixeldiff.py'), dp, mp, String(bottom || 400), path.join(OUT, `ppg3-diff-${designId}${dm.length > 1 ? '-' + (i + 1) : ''}.png`)], { encoding: 'utf8' });
      try { out.pixel.push(JSON.parse(py.stdout)); } catch { out.pixel.push({ error: (py.stderr || py.stdout || '').slice(0, 160) }); }
    }
  }
  return out;
}

// ---- verdict --------------------------------------------------------------------------------------------------------
const pageOfText = (texts, needle) => texts.findIndex((t) => t.includes(needle));
let failed = 0;
for (const r of results) {
  const { name, sc, dom, styles, pdf } = r;
  const page = r.page;
  const problems = [];
  const info = [];
  const s = styles;
  if (s.bodyBg !== 'rgb(255, 255, 255)') problems.push('body bg ' + s.bodyBg);
  if (s.rootBg !== 'rgb(255, 255, 255)') problems.push('root bg ' + s.rootBg);
  if (s.rootColor !== 'rgb(17, 17, 17)') problems.push('root color ' + s.rootColor);
  if (!/Segoe UI|Noto Sans Hebrew/.test(s.rootFont)) problems.push('root font ' + s.rootFont);
  if (s.h1Font && !/Segoe UI|Noto Sans Hebrew/.test(s.h1Font)) problems.push('h1 font leak ' + s.h1Font);
  if (s.h1Size !== '21px') problems.push('h1 size ' + s.h1Size);
  if (s.rootDir !== 'rtl') problems.push('dir ' + s.rootDir);
  if (s.thBg && s.thBg !== 'rgba(0, 0, 0, 0)') problems.push('th bg ' + s.thBg);
  if (s.thPosition && s.thPosition !== 'static') problems.push('th position ' + s.thPosition);
  if (s.rp !== '2.3mm') problems.push('--rp ' + s.rp);
  if (s.tdBreak && s.tdBreak !== 'avoid') problems.push('row break-inside ' + s.tdBreak);
  if (s.navDisplay !== 'none') problems.push('navbar visible in print');
  if (s.theadDisplay !== 'table-header-group') problems.push('thead ' + s.theadDisplay);
  if (s.tfootDisplay !== 'table-footer-group') problems.push('tfoot ' + s.tfootDisplay);
  if (s.leakCount) problems.push('coloured backgrounds/text: ' + s.leakCount + ' ' + JSON.stringify(s.leaks.slice(0, 3)));
  if (!pdf.pages) { problems.push('no pdf text (pypdf)'); }
  else {
    const texts = pdf.text.map((t) => t.replace(/\s+/g, ' '));
    if (sc.expectPages && pdf.pages !== sc.expectPages) problems.push(`pdf pages ${pdf.pages} != expected ${sc.expectPages}`);
    if (!texts.every((t) => t.includes('גמ״ח שמלות'))) problems.push('gmach header missing on page ' + (texts.findIndex((t) => !t.includes('גמ״ח שמלות')) + 1));
    if (!texts.every((t) => t.includes('הופק מהמערכת'))) problems.push('footer missing on page ' + (texts.findIndex((t) => !t.includes('הופק מהמערכת')) + 1));
    const counters = texts.map((t) => { let m = t.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/); if (m) return [Number(m[1]), Number(m[2])]; m = t.match(/(\d+)\s*מתוך\s*(\d+)\s*עמוד/); return m ? [Number(m[2]), Number(m[1])] : null; });
    if (!counters.every((c, i) => c && c[0] === i + 1 && c[1] === pdf.pages)) problems.push('page counters ' + JSON.stringify(counters));
    if (sc.combo) {
      info.push(`pdf=${pdf.pages}p (combined document: counters run 1..${pdf.pages} over all pages)`);
    } else {
    // every order id printed; none missing
    const ids = rowsOf(page.data).map((x) => x.orderId);
    const missing = ids.filter((id) => !texts.some((t) => t.includes(String(id))));
    if (missing.length) problems.push('orders missing in pdf: ' + missing.slice(0, 5));
    // no row split: row id and customer first name on the same page
    const rows = rowsOf(page.data);
    const split = [];
    for (const row of rows) {
      const idx = texts.findIndex((t) => t.includes(String(row.orderId)));
      const nm = (row.name || '').split(' ')[0];
      if (idx >= 0 && nm && !texts[idx].includes(nm)) split.push(row.orderId);
    }
    if (split.length) problems.push('row split across pages: ' + split.slice(0, 5));
    // group title not stranded: the LAST body line of a page (above the footer) must not be a group-title row (PyMuPDF line positions)
    const marker = { 'PP-07': 'הזמנ', 'PP-10': 'אירועים', 'PP-18': 'אירועים', 'PP-11': 'עצירה' }[sc.key];
    const stranded = { checked: 0, skipped: 0 };
    if (marker && !sc.perOrder) {
      const tail = spawnSync('python', [path.join(HERE, 'ppg3-pdftail.py'), path.join(OUT, 'ppg3-' + name + '.pdf'), marker], { encoding: 'utf8' });
      try {
        const t = JSON.parse(tail.stdout);
        stranded.checked = t.pages.length;
        for (const p of t.pages) if (p.stranded) problems.push(`group title stranded at the bottom of page ${p.page}: ${p.last}`);
      } catch { stranded.skipped = 1; }
    }
    info.push(`pdf=${pdf.pages}p`);
    if (stranded.checked + stranded.skipped) info.push(`tail-check ${stranded.checked ? 'ran on ' + stranded.checked + ' pages' : 'SKIPPED'}`);
    // --- per-page rules ---
    if (sc.perOrder) {
      // exactly one sheet per order, in the DOM and (for non-overflow scenarios) in the PDF; header code is that order's code
      const orders = rowsOf(page.data);
      if (dom.length !== orders.length) problems.push(`sheets ${dom.length} != orders ${orders.length}`);
      dom.forEach((d, i) => {
        const o = orders[i]; if (!o) return;
        const want = orderCode(sc.key === 'PP-12' ? 'DOT' : 'PRP', o.orderId);
        if (d.headCode !== want) problems.push(`sheet ${i + 1} header barcode ${d.headCode} != ${want}`);
        if (d.pn !== `עמוד ${i + 1} מתוך ${orders.length}`) problems.push(`sheet ${i + 1} on-screen counter "${d.pn}"`);
        if (sc.key === 'PP-12' && d.dnBarcodes !== 0) problems.push('duplicate barcode inside the delivery note: ' + d.dnBarcodes);
        if (sc.key === 'PP-07' && d.rowCodes.length) problems.push('row barcodes on a per-order page: ' + d.rowCodes.length);
      });
      // every printed page belongs to exactly one order (its barcode label in the repeated header), in order, none lost, and the
      // closing block of each order (signatures) is printed once per order - catches clipped content
      const pfxOf = sc.key === 'PP-12' ? 'DOT' : 'PRP';
      const owner = texts.map((t) => orders.findIndex((o) => t.includes(orderCode(pfxOf, o.orderId))));
      if (owner.some((x) => x < 0)) problems.push('pdf page without an order barcode in the header: ' + owner.map((x, i) => (x < 0 ? i + 1 : null)).filter(Boolean));
      if (owner.some((x, i) => i && x < owner[i - 1])) problems.push('pages are not in order sequence: ' + owner.join(','));
      const missingOrders = orders.map((o, i) => i).filter((i) => !owner.includes(i));
      if (missingOrders.length) problems.push('orders without a page: ' + missingOrders);
      const signWord = sc.key === 'PP-12' ? 'חתימה' : 'נבדק על ידי';
      const signCount = texts.filter((t) => t.includes(signWord)).length;
      if (signCount !== orders.length) problems.push(`closing block "${signWord}" printed on ${signCount} pages, expected ${orders.length} (content clipped?)`);
      info.push('pages/order=' + orders.map((o, i) => owner.filter((x) => x === i).length).join(','));
      if (!long) {
        orders.forEach((o, i) => {
          const t = texts[i] || '';
          if (!t.includes(orderCode(sc.key === 'PP-12' ? 'DOT' : 'PRP', o.orderId)) && !t.includes(String(o.orderId))) problems.push(`pdf page ${i + 1} is not order ${o.orderId}`);
          const others = orders.filter((x, k) => k !== i && t.includes('#' + x.orderId));
          if (others.length) problems.push(`pdf page ${i + 1} mixes orders ${others.map((x) => x.orderId)}`);
        });
      }
    } else {
      const d0 = dom[0];
      const codeWant = page.pageCode;
      if (d0.headCode !== codeWant) problems.push(`header code ${d0.headCode} != ${codeWant}`);
      const rowsAll = rowsOf(page.data);
      const pfx = { 'PP-07': 'PRP', 'PP-10': 'DOT', 'PP-11': 'DOT', 'PP-18': 'DBK' }[sc.key];
      const want = rowsAll.map((x) => orderCode(pfx, x.orderId));
      if (JSON.stringify(dom.flatMap((d) => d.rowCodes)) !== JSON.stringify(sc.key === 'PP-07' ? sortLike(page) : sortLike(page))) problems.push('row barcodes differ from the rows');
    }
    }
  }
  if (!sc.combo && sc.key === 'PP-07') {
    const all = dom.map((d) => d.text).join('\n');
    if (hasHeb(all, 'יעד')) problems.push('forbidden word "יעד" (owner: no destination field)');
    if (sc.version !== 'b') {
      const t = dom[0].groupTitles.map((x) => x.replace(/\s+/g, ' '));
      if (!t[0] || !t[0].startsWith('משלוחים (הלוך)')) problems.push('first group is not the deliveries: ' + t[0]);
      if (!t.some((x) => x.startsWith('איסוף עצמי'))) problems.push('no pickup group');
    }
    if (sc.version === 'b' && dom.some((d) => !/דף הכנה · הזמנה #\d+/.test(d.title))) problems.push('per-order title');
  }
  if (!sc.combo && sc.key === 'PP-11') {
    const stops = rowsOf(page.data).map((x) => x.stop);
    if (JSON.stringify(stops) !== JSON.stringify(stops.map((_, i) => i + 1))) problems.push('stop numbers are not 1..N');
    info.push(`cities=${page.data.groups.length} stops=${stops.length}`);
  }
  if (!sc.combo && sc.key === 'PP-12') {
    const d0 = dom[0];
    if (d0 && d0.bagInputs !== 2) problems.push('bag row has ' + d0.bagInputs + ' blanks');
    if (d0 && d0.sgCells !== 3) problems.push('signature cells ' + d0.sgCells);
    const dnHeightOk = dom.every((d) => d.dn && d.dn.bottom <= d.sheetH);
    if (!dnHeightOk) problems.push('delivery note taller than its sheet');
  }
  if (r.cmp) {
    for (const g of r.cmp.geometry) {
      info.push(`design#${g.sheet}: h1 ${g.h1[0]}/${g.h1[1]} headH ${g.headH[0]}/${g.headH[1]} rowΔmax=${g.rowDiffMax.toFixed(1)}px thΔmax=${g.thWDiffMax.toFixed(1)}px ${g.rows}`);
      if (g.h1[0] !== g.h1[1]) problems.push('h1 size differs from design');
      if (g.rowDiffMax > 2.5 && g.rows.startsWith('same')) problems.push('row height differs from the design by ' + g.rowDiffMax.toFixed(1) + 'px');
      if (g.dn && (g.dn.designFont[0] !== g.dn.mineFont[0] || g.dn.designFont[1] !== g.dn.mineFont[1])) problems.push('delivery note fonts differ from design ' + JSON.stringify(g.dn));
    }
    r.cmp.pixel.forEach((p, i) => { if (p.error) info.push('pixel err ' + p.error); else info.push(`pixelΔ#${i + 1}=${p.diffPct}%`); });
  }
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'OK  '} ${name.padEnd(13)} ${info.join(' | ')}${problems.length ? '\n      ' + problems.join('\n      ') : ''}`);
}
fs.writeFileSync(path.join(OUT, 'ppg3-summary' + (long ? '-long' : '') + '.json'), JSON.stringify(results.map((r) => ({ name: r.name, pdfPages: r.pdf.pages, cmp: r.cmp, geo: r.dom.map((d) => ({ rowsH: d.rowsH, thW: d.thW, head: d.headH, tb: d.tbH })) })), null, 1));
console.log(failed ? `\n${failed} scenario(s) failed` : '\nall scenarios passed');
process.exit(failed ? 1 : 0);

// the DOM order of row barcodes follows the page data order (page.data.rows is the printed order for 10/18; for 07/11 the groups order)
function sortLike(page) {
  const d = page.data;
  const pfx = { 'PP-07': 'PRP', 'PP-10': 'DOT', 'PP-11': 'DOT', 'PP-18': 'DBK' }[page.key];
  const groups = d.groups || [];
  return rowsOf(d).map((x) => orderCode(pfx, x.orderId));
}
