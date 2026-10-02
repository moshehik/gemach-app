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
import { g2Payload } from './pp-g2.fixtures.mjs';

const PROJ = process.env.PROJ;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);

// usage: node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/pp-g2.render.mjs [PP-03:a,PP-03:b,PP-04,PP-08,PP-09] [long]
// Same pipeline as render.mjs (real getScheduleDay on the mock DB -> loadExtras -> buildPrintPayload -> real React templates
// -> headless Chrome: screenshot, print-media computed styles, page.pdf() + pypdf) but on the group-2 fixtures
// (pp-g2.fixtures.mjs) and with the page-local CSS files of 03/04/08/09 linked (the harness stubs CSS imports).
// Extra checks for this group: sticker pages = exactly 18 stickers per full page (3x6), versions of PP-03, per-page barcode text.
const specArg = (process.argv[2] && !process.argv[2].startsWith('long') ? process.argv[2] : 'PP-03:a,PP-03:b,PP-04,PP-08,PP-09').split(',');
const long = process.argv.includes('long');
const specs = specArg.map((s) => { const [key, version] = s.split(':'); return { key, version: version || null, name: key + (version || '') + (long ? '-long' : '') }; });
const DAY = '2026-10-01';
const PAGE_CSS = ['pp03.css', 'pp09.css'];

// ---- 1. payloads (one per spec) -----------------------------------------------------------------
const { PrintDocument } = await L('app/components/schedule/print/PrintShell.js');
const payloads = [];
for (const sp of specs) {
  const keys = sp.key === 'ALL' ? ['PP-03', 'PP-04', 'PP-08', 'PP-09'] : [sp.key]; // ALL = the four pages in ONE document (page breaks between sheets, continuous page counter)
  const versions = sp.key === 'ALL' ? { 'PP-03': sp.version || 'a' } : (sp.version ? { [sp.key]: sp.version } : {});
  const { payload } = await g2Payload(keys, { versions, long, base: process.env.G2_BASE === '1' });
  payloads.push({ sp, payload });
}

// ---- 2. static HTML with the live page's global CSS + print.css -------------------------------
const css = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
const FONT_FREE = process.env.NO_WEBFONTS === '1';
const results = [];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
try {
  for (const { sp, payload } of payloads) {
    const page = payload.pages[0];
    const single = sp.key === 'ALL' ? payload : { meta: payload.meta, pages: [page] };
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { payload: single }));
    const name = sp.name;
    const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${page.def.label}</title>
<link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">
<link rel="stylesheet" href="${css('app/components/schedule/print/print.css')}">${PAGE_CSS.map((f) => `<link rel="stylesheet" href="${css('app/components/schedule/print/pages/' + f)}">`).join('')}${process.env.PDF_FONT ? `<style>@media print{.pp-root,.pp-root *{font-family:${process.env.PDF_FONT}!important}}</style>` : ''}</head>
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
        rows: trs.length + document.querySelectorAll('.pp-lab').length,
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
    const pdfChecks = sp.key === 'ALL' ? checkAll(pdf, payload) : checkPdf(pdf, page);
    const r = { key: page.key, name, slim: !!page.def.slim, rows: styles.rows, pdfPages: pdf.pages, styles, pdfChecks, pyError: py.status === 0 ? null : (py.stderr || '').slice(0, 200) };
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
  if (s.h1Size !== (r.slim ? '16px' : '21px')) problems.push('h1 size ' + s.h1Size);
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
  out.headerOnEveryPage = texts.every((t) => t.includes('גמ״ח שמלות') && t.includes(page.data.title.split(' ')[0])) || 'missing on page ' + (texts.findIndex((t) => !t.includes('גמ״ח שמלות')) + 1);
  out.footerOnEveryPage = texts.every((t) => t.includes('הופק מהמערכת')) || 'missing on page ' + (texts.findIndex((t) => !t.includes('הופק מהמערכת')) + 1);
  const counters = texts.map((t) => { let m = t.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/); if (m) return [Number(m[1]), Number(m[2])]; m = t.match(/(\d+)\s*מתוך\s*(\d+)\s*עמוד/); return m ? [Number(m[2]), Number(m[1])] : null; });
  out.pageCounters = counters.every((c, i) => c && c[0] === i + 1 && c[1] === pdf.pages) ? true : 'counters: ' + JSON.stringify(counters);
  const d = page.data;
  // what must be printed, and which strings must share one page (a row is never split across pages)
  let units = [];
  if (page.key === 'PP-03' && d.version === 'a') units = d.days.flatMap((x) => x.orders.map((o) => [String(o.orderId), o.name.split(' ')[0]]));
  else if (page.key === 'PP-03') units = d.groups.flatMap((g) => g.rows.map((r) => [r.code, r.name.split(' ')[0]]));
  else if (page.key === 'PP-04' || page.key === 'PP-08') units = d.labels.map((l) => [l.code, l.name.split(' ')[0]]);
  else if (page.key === 'PP-09') units = d.rows.map((r) => [String(r.orderId), r.name.split(' ')[0]]);
  const pageOf = (s) => texts.findIndex((t) => t.includes(s));
  const missing = []; const split = [];
  for (const u of units) {
    const p0 = pageOf(u[0]);
    if (p0 < 0) { missing.push(u[0]); continue; }
    if (!texts[p0].includes(u[1])) split.push(u[0] + ':name-on-other-page');
  }
  out.allUnitsPrinted = missing.length ? 'missing ' + missing.slice(0, 5).join(',') : true;
  out.noRowSplit = split.length ? split.slice(0, 5).join(',') : true;
  if (page.key === 'PP-04' || page.key === 'PP-08') {
    // exactly perPage stickers on every page except the last; (code text appears once per sticker, ALL-xxx header code is excluded by the regex)
    const re = page.key === 'PP-04' ? /REP-\d+-\d+/g : /PRP-\d+-\d+/g;
    const per = texts.map((t) => (t.match(re) || []).length);
    const want = Array.from({ length: pdf.pages }, (_, i) => (i < pdf.pages - 1 ? d.perPage : d.labels.length - d.perPage * (pdf.pages - 1)));
    out.stickersPerPage = JSON.stringify(per) === JSON.stringify(want) ? true : 'got ' + JSON.stringify(per) + ' want ' + JSON.stringify(want);
    out.pageCountMatches = pdf.pages === Math.ceil(d.labels.length / d.perPage) ? true : 'pages ' + pdf.pages + ' want ' + Math.ceil(d.labels.length / d.perPage);
  }
  return out;
}

// the four pages in one document: every sheet starts a new page, the page counter runs over the whole document,
// and each sheet's own header title is on its own page(s) only
function checkAll(pdf, payload) {
  const out = {};
  const texts = pdf.text.map((t) => t.replace(/\s+/g, ' '));
  const per = payload.pages.map((p) => (p.key === 'PP-04' || p.key === 'PP-08' ? Math.max(1, Math.ceil(p.data.labels.length / p.data.perPage)) : null));
  const expect = payload.pages.reduce((n, _p, i) => n + (per[i] || 1), 0);
  out.pageCountAtLeastOnePerSheet = pdf.pages >= expect ? true : 'pages ' + pdf.pages + ' want >= ' + expect;
  const counters = texts.map((t) => { let m = t.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/); if (m) return [Number(m[1]), Number(m[2])]; m = t.match(/(\d+)\s*מתוך\s*(\d+)\s*עמוד/); return m ? [Number(m[2]), Number(m[1])] : null; });
  out.pageCounters = counters.every((c, i) => c && c[0] === i + 1 && c[1] === pdf.pages) ? true : 'counters: ' + JSON.stringify(counters);
  out.footerOnEveryPage = texts.every((t) => t.includes('הופק מהמערכת')) || 'missing footer';
  const titles = payload.pages.map((p) => p.data.title.split(' ')[0]);
  out.sheetOrder = titles.every((t) => texts.some((x) => x.includes(t))) ? true : 'titles ' + titles.join(',');
  return out;
}
