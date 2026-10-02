// Pixel comparison of PP-02 / PP-13 / PP-19 against the approved design page (דפי-הדפסה-עיצוב.html), with THE DESIGN'S OWN SAMPLE DATA:
//   node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/pp02-13-19.design-compare.mjs
// 1. opens the design page in headless Chrome, evaluates p02()/p13()/p19() and measures the sheet (header, title bar, stats, notes,
//    table rows/cells, big total) in CSS px;
// 2. feeds the same sample (customers, amounts, events, streets, phones) through the real build() of each page + the real React template
//    (PrintDocument + PrintShell + print.css + the page-local css) and measures the same boxes;
// 3. prints every difference larger than the tolerance (default 1.5px) and writes out/g1-design-compare.json + side-by-side PNGs.
// (PP-19: the summary text is hard-coded in the design page - '5 ערים · 8 עצירות · 10 שמלות' for 13 rows - so its width is not compared.)
// Rows are matched by order number (the design lists them in its own order); the stop number column and city order may differ (documented).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const PROJ = process.env.PROJ;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const TOL = Number(process.env.TOL || 1.5);

const DESIGN = process.env.DESIGN_HTML || 'C:/Users/moshe/Desktop/גמח שמלות חדש/תצוגות-עיצוב/סיימתי-לעבוד/דפי-הדפסה-עיצוב.html';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ---- measuring function (runs in the page; both sides expose the same logical boxes under different class names) ----
const MEASURE = `(sel) => {
  const q = (s, r) => (r || document).querySelector(s);
  const qa = (s, r) => [...(r || document).querySelectorAll(s)];
  const sheet = q(sel.sheet);
  const sr = sheet.getBoundingClientRect();
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +(r.left - sr.left).toFixed(1), y: +(r.top - sr.top).toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const out = { sheet: { w: +sr.width.toFixed(1) } };
  out.head = box(q(sel.head)); out.tb = box(q(sel.tb)); out.title = box(q(sel.title)); out.sum = box(q(sel.sum));
  out.notes = qa(sel.note).map(box); out.stats = box(q(sel.stats)); out.statItems = qa(sel.stats + ' > div').map(box);
  out.table = box(q(sel.table)); out.bigtot = box(q(sel.bigtot));
  const table = q(sel.table);
  out.ths = qa(':scope > thead th', table).map(box);
  out.rows = qa(':scope > tbody > tr', table).map((tr) => {
    const m = tr.textContent.match(/\\d{5}/);
    const g = tr.classList.contains('g');
    return { id: g ? 'G:' + tr.textContent.replace(/\\s*\\d+ (עצירות|עצירה).*$/, '').trim().slice(0, 14) : (m ? m[0] : '?'), g, h: +tr.getBoundingClientRect().height.toFixed(1), cells: qa(':scope > td', tr).map((td) => ({ w: +td.getBoundingClientRect().width.toFixed(1), x: +(td.getBoundingClientRect().left - sr.left).toFixed(1) })) };
  });
  out.ck = qa(sel.ck).slice(0, 2).map(box); out.ul = qa(sel.ul).slice(0, 2).map(box); out.bc = qa(sel.bc).slice(0, 2).map(box);
  return out;
}`;
const P = '#__cmp ';
const DSEL = { sheet: P + '.sheet', head: P + '.sh-head', tb: P + '.sh-tb', title: P + '.sh-tb h1', sum: P + '.sh-sum', note: P + '.sh-body > .note', stats: P + '.sh-body > .stats', table: P + '.sh-body > table.t', bigtot: P + '.bigtot', ck: P + 'table.t .ck', ul: P + 'table.t .ul', bc: P + 'table.t td.bcc svg' };
const MSEL = { sheet: '.pp-sheet', head: '.pp-head', tb: '.pp-tb', title: '.pp-tb h1', sum: '.pp-sum', note: '.pp-body > .pp-note', stats: '.pp-body > .pp-stats', table: '.pp-body > table.pp-t', bigtot: '.pp-bigtot', ck: 'table.pp-t .pp-ck', ul: 'table.pp-t .pp-ul', bc: 'table.pp-t td.bcc svg' };

// computed-style comparison of representative elements (same logical element on both sides); both pages are checked under print media
const PAIRS = [
  ['th', P + 'table.t th', '.pp-body table.pp-t th'], ['td', P + 'table.t tbody td', '.pp-body table.pp-t tbody td'], ['td.c', P + 'table.t tbody td.c', '.pp-body table.pp-t tbody td.c'],
  ['g td', P + 'table.t tr.g td', '.pp-body table.pp-t tr.g td'], ['td b', P + 'table.t tbody td b', '.pp-body table.pp-t tbody td b'], ['td small', P + 'table.t tbody td small', '.pp-body table.pp-t tbody td small'],
  ['td .ph', P + 'table.t .ph', '.pp-body table.pp-t .pp-ph'], ['td .num', P + 'table.t .num', '.pp-body table.pp-t .pp-num'], ['ck', P + 'table.t .ck', '.pp-body table.pp-t .pp-ck'],
  ['ck.lg', P + 'table.t .ck.lg', '.pp-body table.pp-t .pp-ck.lg'], ['ul', P + 'table.t .ul', '.pp-body table.pp-t .pp-ul'], ['fl', P + 'table.t .fl', '.pp-body table.pp-t .pp-fl'],
  ['bc small', P + 'table.t td.bcc small', '.pp-body table.pp-t td.bcc small'], ['note', P + '.sh-body > .note', '.pp-body > .pp-note'], ['note b', P + '.sh-body > .note b', '.pp-body > .pp-note b'],
  ['note.soft', P + '.sh-body > .note.soft', '.pp-body > .pp-note.soft'], ['stats div', P + '.stats div', '.pp-stats div'], ['stats b', P + '.stats b', '.pp-stats b'],
  ['bigtot', P + '.bigtot', '.pp-bigtot'], ['bigtot b', P + '.bigtot b', '.pp-bigtot b'], ['h1', P + '.sh-tb h1', '.pp-tb h1'], ['chip', P + '.sh-chip', '.pp-chip'], ['sum', P + '.sh-sum', '.pp-sum'],
  ['sum small', P + '.sh-sum small', '.pp-sum small'], ['head b', P + '.sh-id b', '.pp-id b'], ['date', P + '.sh-date', '.pp-date'], ['tb', P + '.sh-tb', '.pp-tb'], ['foot', P + '.sh-foot', '.pp-foot'],
];
const STYLE_PROPS = ['color', 'backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor', 'borderLeftWidth', 'borderLeftColor', 'borderRightWidth', 'borderRightColor',
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'textAlign', 'display', 'whiteSpace', 'boxShadow', 'textShadow', 'textTransform', 'borderRadius', 'minWidth', 'position', 'direction'];
const STYLES = `(pairs, props, which) => Object.fromEntries(pairs.map((p) => { const el = document.querySelector(p[which]); if (!el) return [p[0], null]; const cs = getComputedStyle(el); return [p[0], Object.fromEntries(props.map((k) => [k, cs[k]]))]; }))`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const report = {};
let diffs = 0;
try {
  // ---------- design side ----------
  const dTab = await browser.newPage();
  await dTab.setViewport({ width: 1000, height: 1400 });
  await dTab.goto(pathToFileURL(DESIGN).href, { waitUntil: 'load', timeout: 60000 });
  const sample = await dTab.evaluate(() => {
    const ord = (i) => ORD[i];
    const strip = (r) => ({ id: r.id, first: r.first, last: r.last, name: r.name, ph: r.ph, ph2: r.ph2, city: r.city, street: r.street, n: r.n, total: r.total, paid: r.paid, bal: r.bal });
    const r02 = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map((i) => { const r = Object.assign({}, ORD[i]); if (r.bal <= 0) { r.paid = Math.round(r.total * 0.4 / 10) * 10; r.bal = r.total - r.paid; } return strip(r); });
    return {
      DAY, EV02,
      p02: r02,
      p13: { ev: '2026-10-18', rows: [1, 4, 7, 10, 13, 16, 19, 22, 25].map((i) => strip(ORD[i])) },
      p19: [['ירושלים', [0, 6, 11]], ['בני ברק', [2, 21]], ['מעלה אדומים', [5]], ['בית שמש', [12]], ['ביתר עילית', [3]]].map(([city, ids]) => ({ city, rows: ids.map((i) => strip(ORD[i])) })),
    };
  });
  const designMeasure = {};
  const designStyles = {}; const myStyles = {};
  for (const id of ['02', '13', '19']) {
    designMeasure[id] = await dTab.evaluate((pid, MEASURE_SRC, sel) => {
      document.querySelectorAll('#__cmp').forEach((e) => e.remove());
      const host = document.createElement('div');
      host.id = '__cmp';
      host.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;background:#fff';
      host.innerHTML = (0, eval)('p' + pid)({}, {});
      document.body.appendChild(host);
      return (0, eval)(MEASURE_SRC)(sel);
    }, id, MEASURE, DSEL);
    const el = await dTab.$('#__cmp .sheet');
    await el.screenshot({ path: path.join(OUT, `g1-design-${id}.png`) });
    await dTab.emulateMediaType('print');
    designStyles[id] = await dTab.evaluate((src, pairs, props) => (0, eval)(src)(pairs, props, 1), STYLES, PAIRS.map((p) => [p[0], p[1], p[1]]), STYLE_PROPS);
    await dTab.emulateMediaType('screen');
    await dTab.evaluate(() => document.querySelectorAll('#__cmp').forEach((e) => e.remove()));
  }
  await dTab.close();

  // ---------- my side (same sample through build() + the real templates) ----------
  const { PrintDocument } = await L('app/components/schedule/print/PrintShell.js');
  const { buildPrintPayload } = await L('lib/schedule/print/data.js');
  const { getPrintPage } = await L('lib/schedule/print/registry.js');
  const cust = (r) => ({ firstName: r.first, lastName: r.last, name: r.name, phone1: r.ph, phone2: r.ph2 || '' });
  const base = (r, stage) => ({ orderId: r.id, stage, customer: cust(r), eventKey: null, eventDateHebrew: null, dressCount: r.n, notes: '', done: null, alerts: [] });
  const stages = [
    { key: 'order', items: sample.p02.map((r, k) => ({ ...base(r, 'order'), eventKey: sample.EV02[k], totalAmount: r.total, isPaid: false })) },
    { key: 'pick', items: sample.p13.rows.map((r) => ({ ...base(r, 'pick'), eventKey: sample.p13.ev, done: false })) },
    { key: 'dback', items: sample.p19.flatMap((g) => g.rows.map((r) => ({ ...base(r, 'dback'), address: { street: r.street, city: g.city, full: '' }, returnCondition: null }))) },
  ];
  const day = { date: sample.DAY, weekday: 'רביעי', isToday: true, settings: { pickupHours: '20:00-21:30' }, stages };
  const extras = {
    orderInfo: Object.fromEntries(sample.p02.map((r) => [r.id, { totalPaid: r.paid }])),
    orderBalance: Object.fromEntries(sample.p13.rows.map((r) => [r.id, { total: r.total, paid: r.paid, balance: r.bal }])),
  };
  const payload = buildPrintPayload({ day, keys: ['PP-02', 'PP-13', 'PP-19'], extras, gmach: { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' }, printedBy: 'מנהלת (דוגמה)', now: new Date('2026-10-14T05:12:00Z') });
  const css = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
  const mine = {};
  for (const page of payload.pages) {
    const id = page.key.slice(3);
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { payload: { meta: payload.meta, pages: [page] } }));
    const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}"><link rel="stylesheet" href="${css('app/design-system.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">
<link rel="stylesheet" href="${css('app/components/schedule/print/pages/pp02.css')}"><link rel="stylesheet" href="${css('app/components/schedule/print/pages/pp19.css')}"><link rel="stylesheet" href="${css('app/components/schedule/print/print.css')}">
<style>/* screen-preview only: print.css sets border-collapse:collapse on .pp-sheet, which makes the sheet padding (12mm sides) a no-op on screen (print uses @page margins). Restore it so the screen sheet = the design's A4 box. */.pp-paper .pp-sheet{border-collapse:separate}</style></head><body class="hide-global-nav pp-print-mode">${body}</body></html>`;
    const f = path.join(OUT, `g1-cmp-${id}.html`);
    fs.writeFileSync(f, html);
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1000, height: 1400 });
    await tab.goto(pathToFileURL(f).href, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
    mine[id] = await tab.evaluate((MEASURE_SRC, sel) => (0, eval)(MEASURE_SRC)(sel), MEASURE, MSEL);
    const el = await tab.$('.pp-sheet');
    await el.screenshot({ path: path.join(OUT, `g1-mine-${id}.png`) });
    await tab.emulateMediaType('print');
    myStyles[id] = await tab.evaluate((src, pairs, props) => (0, eval)(src)(pairs, props, 2), STYLES, PAIRS, STYLE_PROPS);
    await tab.close();
  }

  // ---------- compare ----------
  const cmp = (id, label, a, b, out) => {
    a = a || null; b = b || null;
    if (a === null || b === null) { if (a !== b) out.push(`${label}: ${a ? 'only design' : 'only mine'}`); return; }
    for (const k of ['x', 'y', 'w', 'h']) if (Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > TOL) out.push(`${label}.${k}: design ${a[k]} vs mine ${b[k]}`);
  };
  for (const id of ['02', '13', '19']) {
    const a = designMeasure[id]; const b = mine[id]; const out = [];
    out.push(...(Math.abs(a.sheet.w - b.sheet.w) > TOL ? [`sheet.w ${a.sheet.w} vs ${b.sheet.w}`] : []));
    for (const k of ['head', 'tb', 'title', ...(id === '19' ? [] : ['sum']), 'stats', 'table', 'bigtot']) cmp(id, k, a[k], b[k], out);
    if (a.notes.length !== b.notes.length) out.push(`notes count ${a.notes.length} vs ${b.notes.length}`); else a.notes.forEach((n, i) => cmp(id, 'note' + i, n, b.notes[i], out));
    if (a.statItems.length !== b.statItems.length) out.push(`stat items ${a.statItems.length} vs ${b.statItems.length}`); else a.statItems.forEach((n, i) => cmp(id, 'stat' + i, n, b.statItems[i], out));
    if (a.ths.length !== b.ths.length) out.push(`th count ${a.ths.length} vs ${b.ths.length}`); else a.ths.forEach((n, i) => cmp(id, 'th' + i, n, b.ths[i], out));
    a.ck.forEach((n, i) => cmp(id, 'ck' + i, n && { w: n.w, h: n.h }, b.ck[i] && { w: b.ck[i].w, h: b.ck[i].h }, out));
    a.bc.forEach((n, i) => cmp(id, 'barcode' + i, n && { w: n.w, h: n.h }, b.bc[i] && { w: b.bc[i].w, h: b.bc[i].h }, out));
    // rows by order number (design order differs for 19); group rows by label
    const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const ra = byId(a.rows); const rb = byId(b.rows);
    for (const [rid, r] of Object.entries(ra)) {
      const m = rb[rid];
      if (!m) { if (!r.g) out.push(`row ${rid}: missing in mine`); continue; }
      if (Math.abs(r.h - m.h) > TOL) out.push(`row ${rid} height design ${r.h} vs mine ${m.h}`);
      if (r.cells.length !== m.cells.length) { out.push(`row ${rid} cells ${r.cells.length} vs ${m.cells.length}`); continue; }
      r.cells.forEach((c, i) => { if (Math.abs(c.w - m.cells[i].w) > TOL) out.push(`row ${rid} cell ${i} width design ${c.w} vs mine ${m.cells[i].w}`); });
    }
    // computed styles of the representative elements (only elements that exist on BOTH sides; page 02 has no barcode, etc.)
    for (const [label] of PAIRS) {
      const da = designStyles[id][label]; const mb = myStyles[id][label];
      if (!da || !mb) { if (!!da !== !!mb && !['bigtot', 'bigtot b', 'stats div', 'stats b', 'bc small', 'fl', 'g td', 'td small', 'ck.lg', 'ul', 'ck', 'td .num', 'td .ph', 'note', 'note b', 'note.soft'].includes(label)) out.push(`style ${label}: only ${da ? 'design' : 'mine'}`); continue; }
      for (const k of STYLE_PROPS) {
        if (da[k] !== mb[k]) {
          if (k === 'minWidth' && label !== 'ul') continue; // flex-item default (auto vs 0): no visual effect
          const px = (v) => parseFloat(v);
          if (/Width|padding|fontSize|lineHeight|minWidth|borderRadius/.test(k) && Math.abs(px(da[k]) - px(mb[k])) <= 0.6) continue;
          out.push(`style ${label}.${k}: design "${da[k]}" vs mine "${mb[k]}"`);
        }
      }
    }
    const hSum = (rows) => +rows.reduce((s, r) => s + r.h, 0).toFixed(1);
    report[id] = { diffs: out, designTable: a.table, myTable: b.table, rows: a.rows.length, myRows: b.rows.length, rowHeightSum: [hSum(a.rows), hSum(b.rows)] };
    diffs += out.length;
    console.log(`${out.length ? 'DIFF' : 'OK  '} PP-${id}: ${a.rows.length} design rows vs ${b.rows.length} mine; table h ${a.table && a.table.h} vs ${b.table && b.table.h}; sum row heights ${hSum(a.rows)} vs ${hSum(b.rows)}`);
    for (const d of out.slice(0, 40)) console.log('   - ' + d);
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'g1-design-compare.json'), JSON.stringify(report, null, 2));
console.log(diffs ? `\n${diffs} difference(s) over ${TOL}px` : `\nno differences over ${TOL}px`);
