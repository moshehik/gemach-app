// Render harness for the schedule print pages - no dev server, no DB, no port 3000.
//   node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/render.mjs [PP-01,PP-15] [long]
// 1. Builds the real payload: fixtures (scripts/schedule-tests/fixtures.mjs) -> real getScheduleDay (mock prisma) ->
//    loadExtras -> buildPrintPayload. With "long" the stage rows are multiplied (~90 rows) to force several pages.
// 2. Renders the real React templates (PrintDocument + PrintShell + pages/*) to static HTML with react-dom/server,
//    inside the SAME global CSS the live page gets (globals.css, design-overrides.css, components.css, schedule.css)
//    plus print.css - so a theme/palette leak into the print sheet shows up here.
// 3. Headless Chrome (puppeteer-core): screenshot (screen media), computed-style checks under print media
//    (white background, no theme colours, Segoe/Noto font, row spacing --rp), then page.pdf() with the CSS @page.
// 4. pypdf: page count, header repeated on every page, "עמוד X מתוך Y" counters, no row split across pages.
// Output: scripts/schedule-print-tests/out/<key>[-long].{html,png,pdf,json} + a summary line per page.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { installDb, ORDERS, NOW } from '../schedule-tests/fixtures.mjs';

const PROJ = process.env.PROJ;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);

const keysArg = (process.argv[2] || 'PP-15,PP-01').split(',');
const long = process.argv.includes('long');
const DAY = '2026-10-01';

// ---- 1. payload ---------------------------------------------------------------------------------
let orders = ORDERS.map((o) => (o.orderId === 1001
  ? { ...o, totalAmount: 1200, isPaid: false, isDelivery: true, deliveryDirection: 'הלוך-חזור', payments: [{ amount: 400, isDeleted: false }] }
  : o.orderId === 1021 ? { ...o, totalAmount: 500, payments: [] } : o));
if (long) {
  // 90 extra orders: 45 events on the day (stage 7) and 45 registered on the day (stage 1)
  const d = (iso) => new Date(iso);
  for (let i = 0; i < 45; i++) {
    const base = ORDERS.find((o) => o.orderId === 1011);
    orders.push({ ...base, orderId: 5000 + i, customer: { ...base.customer, firstName: 'לקוחה' + String.fromCharCode(0x5d0 + (i % 22)), lastName: 'ארוכה', city: i % 2 ? 'בית שמש' : 'ירושלים' }, notes: i % 3 ? '' : 'הערה לדוגמה מספר ' + i });
    const b1 = ORDERS.find((o) => o.orderId === 1001);
    orders.push({ ...b1, orderId: 6000 + i, totalAmount: 800 + i * 10, payments: [{ amount: 300, isDeleted: false }], customer: { ...b1.customer, firstName: 'רשומה' + String.fromCharCode(0x5d0 + (i % 22)), lastName: 'היום' }, orderDate: d('2026-10-01T06:00:00Z') });
  }
}
installDb({ extra: { order: orders } });
const { getScheduleDay } = await L('lib/schedule/index.js');
const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');
const day = await getScheduleDay({ date: DAY, user: { id: 'emp-head', roleId: 0 }, now: NOW });
const defs = keysArg.map(getPrintPage);
const extras = await loadExtras(day, defs);
const payload = buildPrintPayload({ day, keys: keysArg, extras, gmach: { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' }, printedBy: 'מנהלת (דוגמה)', now: NOW });

// ---- 2. static HTML with the live page's global CSS + print.css -------------------------------
const { PrintDocument } = await L('app/components/schedule/print/PrintShell.js');
const css = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
const FONT_FREE = process.env.NO_WEBFONTS === '1';
const results = [];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
try {
  for (const page of payload.pages) {
    const single = { meta: payload.meta, pages: [page] };
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { payload: single }));
    const name = page.key + (long ? '-long' : '');
    const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${page.def.label}</title>
<link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">
<link rel="stylesheet" href="${css('app/components/schedule/print/print.css')}">${process.env.PDF_FONT ? `<style>@media print{.pp-root,.pp-root *{font-family:${process.env.PDF_FONT}!important}}</style>` : ''}</head>
<body class="hide-global-nav pp-print-mode"><nav class="navbar">תפריט (מדמה את המעטפת)</nav><div data-print-ready="true">${body}</div></body></html>`;
    const htmlPath = path.join(OUT, name + '.html');
    fs.writeFileSync(htmlPath, html);

    const tab = await browser.newPage();
    if (FONT_FREE) await tab.setRequestInterception(true), tab.on('request', (r) => (/fonts\.g/.test(r.url()) ? r.abort() : r.continue()));
    await tab.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 1 });
    await tab.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
    await tab.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });

    // ---- 3. computed styles under print media ----
    await tab.emulateMediaType('print');
    const styles = await tab.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      const root = document.querySelector('.pp-root');
      const sheet = document.querySelector('.pp-sheet');
      const th = document.querySelector('.pp-t th');
      const td = document.querySelector('.pp-t tbody tr:not(.g) td');
      const h1 = document.querySelector('.pp-tb h1');
      const nav = document.querySelector('.navbar');
      const trs = [...document.querySelectorAll('.pp-t tbody tr')];
      const bad = [];
      for (const el of document.querySelectorAll('.pp-root, .pp-root *')) {
        const s = cs(el);
        const bg = s.backgroundColor;
        // allowed: transparent, white, the soft greys of the design; anything saturated = leak
        const m = bg.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (m && m[4] !== '0' && (Math.max(m[1], m[2], m[3]) - Math.min(m[1], m[2], m[3]) > 12)) bad.push({ tag: el.tagName, cls: el.className && el.className.baseVal === undefined ? el.className : '', bg });
        if (s.backgroundImage && s.backgroundImage !== 'none' && !/repeating-linear-gradient/.test(s.backgroundImage) && el.tagName !== 'rect') bad.push({ tag: el.tagName, cls: el.className, bgi: s.backgroundImage.slice(0, 60) });
      }
      return {
        bodyBg: cs(document.body).backgroundColor,
        rootBg: cs(root).backgroundColor, rootColor: cs(root).color, rootFont: cs(root).fontFamily, rootDir: cs(root).direction,
        sheetBg: sheet ? cs(sheet).backgroundColor : null,
        h1Font: h1 ? cs(h1).fontFamily : null, h1Color: h1 ? cs(h1).color : null, h1Size: h1 ? cs(h1).fontSize : null,
        thBg: th ? cs(th).backgroundColor : null, thBorderBottom: th ? cs(th).borderBottomWidth : null, thPosition: th ? cs(th).position : null,
        tdPaddingTop: td ? cs(td).paddingTop : null, tdBreak: td ? cs(td.parentElement).breakInside : null,
        rp: root ? cs(root).getPropertyValue('--rp').trim() : null,
        navDisplay: nav ? cs(nav).display : null,
        rows: trs.length,
        theadDisplay: sheet ? cs(sheet.tHead).display : null, tfootDisplay: sheet ? cs(sheet.tFoot).display : null,
        leaks: bad.slice(0, 10), leakCount: bad.length,
      };
    });

    // ---- 4. PDF + pypdf ----
    const pdfPath = path.join(OUT, name + '.pdf');
    await tab.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
    const jsonPath = path.join(OUT, name + '.pdf.json');
    const py = spawnSync('python', [path.join(HERE, 'pdfcheck.py'), pdfPath, jsonPath], { encoding: 'utf8' });
    let pdf = { pages: null, text: [] };
    if (py.status === 0 && fs.existsSync(jsonPath)) pdf = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const pdfChecks = checkPdf(pdf, page);
    const r = { key: page.key, name, rows: styles.rows, pdfPages: pdf.pages, styles, pdfChecks, pyError: py.status === 0 ? null : (py.stderr || '').slice(0, 200) };
    results.push(r);
    await tab.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'summary' + (long ? '-long' : '') + '.json'), JSON.stringify(results, null, 2));

let failed = 0;
for (const r of results) {
  const s = r.styles;
  const problems = [];
  if (s.bodyBg !== 'rgb(255, 255, 255)') problems.push('body bg ' + s.bodyBg);
  if (s.rootBg !== 'rgb(255, 255, 255)') problems.push('root bg ' + s.rootBg);
  if (s.rootColor !== 'rgb(17, 17, 17)') problems.push('root color ' + s.rootColor);
  if (!/Segoe UI|Noto Sans Hebrew/.test(s.rootFont)) problems.push('root font ' + s.rootFont);
  if (s.h1Font && !/Segoe UI|Noto Sans Hebrew/.test(s.h1Font)) problems.push('h1 font leak ' + s.h1Font);
  if (s.h1Size !== '21px') problems.push('h1 size ' + s.h1Size);
  if (s.rootDir !== 'rtl') problems.push('dir ' + s.rootDir);
  if (s.thBg && s.thBg !== 'rgba(0, 0, 0, 0)') problems.push('th bg ' + s.thBg);
  if (s.thPosition && s.thPosition !== 'static') problems.push('th position (sticky leak) ' + s.thPosition);
  if (s.rp !== '2.3mm') problems.push('--rp ' + s.rp);
  if (s.tdBreak && s.tdBreak !== 'avoid') problems.push('row break-inside ' + s.tdBreak);
  if (s.navDisplay !== 'none') problems.push('navbar visible in print: ' + s.navDisplay);
  if (s.theadDisplay !== 'table-header-group') problems.push('thead ' + s.theadDisplay);
  if (s.tfootDisplay !== 'table-footer-group') problems.push('tfoot ' + s.tfootDisplay);
  if (s.leakCount) problems.push('coloured backgrounds: ' + s.leakCount + ' ' + JSON.stringify(s.leaks.slice(0, 3)));
  for (const [k, v] of Object.entries(r.pdfChecks)) if (v !== true) problems.push('pdf ' + k + ': ' + v);
  if (r.pyError) problems.push('pypdf: ' + r.pyError);
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'OK  '} ${r.name.padEnd(12)} rows=${String(r.rows).padEnd(3)} pdfPages=${r.pdfPages} ${problems.join(' | ')}`);
}
console.log(failed ? `\n${failed} page(s) failed` : '\nall pages passed');
process.exit(failed ? 1 : 0);

function checkPdf(pdf, page) {
  const out = {};
  if (!pdf.pages) return { parsed: 'no pdf text (pypdf missing?)' };
  const texts = pdf.text.map((t) => t.replace(/\s+/g, ' '));
  // header (gmach name + page title) and footer on every page
  out.headerOnEveryPage = texts.every((t) => t.includes('גמ״ח שמלות') && t.includes(page.def.label.split(' ')[0])) || 'missing on page ' + (texts.findIndex((t) => !t.includes('גמ״ח שמלות')) + 1);
  out.footerOnEveryPage = texts.every((t) => t.includes('הופק מהמערכת')) || 'missing on page ' + (texts.findIndex((t) => !t.includes('הופק מהמערכת')) + 1);
  // page counters from @page margin box (Chrome 131+); report as a value, not a failure, when absent
  // pypdf emits the RTL margin box reversed ("1 מתוך1עמוד"); accept both orders
  const counters = texts.map((t) => { let m = t.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/); if (m) return [Number(m[1]), Number(m[2])]; m = t.match(/(\d+)\s*מתוך\s*(\d+)\s*עמוד/); return m ? [Number(m[2]), Number(m[1])] : null; });
  out.pageCounters = counters.every((c, i) => c && c[0] === i + 1 && c[1] === pdf.pages) ? true : 'counters: ' + JSON.stringify(counters);
  // no row split: each "#id" must be on the same page as the customer name that follows it in the row
  const rows = page.key === 'PP-15' ? page.data.groups.flatMap((g) => g.rows) : page.data.rows;
  let split = [];
  for (const r of rows) {
    const idx = texts.findIndex((t) => t.includes(String(r.orderId))); // '#' is dropped by the extractor
    if (idx < 0) { split.push(r.orderId + ':missing'); continue; }
    const nameFirst = (r.name || '').split(' ')[0];
    if (nameFirst && !texts[idx].includes(nameFirst)) split.push(r.orderId + ':name-on-other-page');
  }
  out.noRowSplit = split.length ? split.slice(0, 5).join(',') : true;
  out.allRowsPrinted = rows.every((r) => texts.some((t) => t.includes(String(r.orderId)))) || 'some rows missing';
  return out;
}
