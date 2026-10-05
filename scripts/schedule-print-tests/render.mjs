// Render harness for the schedule print pages - no dev server, no DB, no port 3000.
//   node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/render.mjs [PP-01,PP-15 | all] [long] [combined]
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
import { blocksIntact } from './pp16-pdfcheck.mjs';

const PROJ = process.env.PROJ;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);

// pages: "PP-15,PP-01" | "PP-03:b" (a version) | "all" (every page that is 'ready' in this checkout, both versions of 03/07)
let keysArg = (process.argv[2] || 'PP-15,PP-01').split(',');
const versionMap = {};
if (keysArg[0] === 'all') {
  const reg = await L('lib/schedule/print/registry.js');
  keysArg = reg.PRINT_PAGES.filter((p) => p.status === 'ready').flatMap((p) => (p.versions ? p.versions.map((v) => `${p.key}:${v.k}`) : [p.key]));
}
const pageSpecs = keysArg.map((k) => { const [key, v] = k.split(':'); return { key, version: v || null }; });
keysArg = [...new Set(pageSpecs.map((x) => x.key))];
const long = process.argv.includes('long');
// combined: ONE document with every selected page (what the wizard prints for "all pages of the day") -> out/ALL[-long].{html,pdf};
// checks that the sheet/page-break/@page rules of table pages, sticker pages (named page) and per-order pages coexist: page counters
// run 1..N through the whole document, the footer is on every page, and every selected page's title is in the PDF
const combined = process.argv.includes('combined');
const DAY = '2026-10-15'; // = DAY of scripts/schedule-tests/fixtures.mjs

// Leak scan, run in the page under BOTH media (screen = the wizard's preview/iframe, print = paper): the sheet must stay black on white
// with greys only - a saturated background/border/text colour, light text on white, or a gradient image is a theme token leaking in
// (app/design-overrides.css / globals.css rules like "table tbody td{border-bottom-color:var(--divider)!important}").
const leakScan = () => {
  const bad = [];
  const parse = (c) => c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
  const sat = (m) => Math.max(m[1], m[2], m[3]) - Math.min(m[1], m[2], m[3]);
  const lum = (m) => 0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3];
  const bgLum = (el) => {
    for (let e = el; e; e = e.parentElement) { const m = parse(getComputedStyle(e).backgroundColor); if (m && m[4] !== '0') return lum(m); }
    return 255;
  };
  for (const el of document.querySelectorAll('.pp-root, .pp-root *')) {
    const s = getComputedStyle(el);
    const cls = String(el.className && el.className.baseVal === undefined ? el.className : '');
    const m = parse(s.backgroundColor);
    if (m && m[4] !== '0' && sat(m) > 12) bad.push({ tag: el.tagName, cls, bg: s.backgroundColor });
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const c = parse(s.color);
      if (c && (sat(c) > 12 || (lum(c) > 150 && bgLum(el) >= 150))) bad.push({ tag: el.tagName, cls, color: s.color });
    }
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none') {
        const c = parse(s['border' + side + 'Color']);
        if (c && sat(c) > 12) bad.push({ tag: el.tagName, cls, ['border' + side]: s['border' + side + 'Color'] });
      }
    }
    // outlines and shadows are never part of the sheet (the on-screen paper shadow belongs to .pp-sheet only)
    if (parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== 'none') bad.push({ tag: el.tagName, cls, outline: s.outline });
    if (s.boxShadow && s.boxShadow !== 'none' && !el.classList.contains('pp-sheet')) bad.push({ tag: el.tagName, cls, shadow: s.boxShadow.slice(0, 60) });
    if (s.backgroundImage && s.backgroundImage !== 'none' && !/repeating-linear-gradient/.test(s.backgroundImage) && el.tagName !== 'rect') bad.push({ tag: el.tagName, cls, bgi: s.backgroundImage.slice(0, 60) });
  }
  return bad;
};

// @page margins must be white on every PDF page (a dark color-scheme paints them dark and hides the margin-box page counter)
const marginCheck = (pdfPath) => {
  const r = spawnSync('python', [path.join(HERE, 'pdf-margin.py'), pdfPath], { encoding: 'utf8' });
  try { const j = JSON.parse(r.stdout); return j.dark.length ? 'dark page margin ' + JSON.stringify(j.dark.slice(0, 4)) : null; } catch { return 'pdf-margin.py: ' + (r.stderr || '').slice(0, 80); }
};

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
if (long && keysArg.includes('PP-16')) {
  // PP-16 long: 22 manual-return families due on the day (1-4 dresses each) + 8 late ones (due 1-9 days before) -> several pages
  const base = ORDERS.find((o) => o.orderId === 1013);
  const mk = (id, over, nItems) => ({ ...base, orderId: id, ...over, customer: { ...base.customer, firstName: 'לקוחה' + String.fromCharCode(0x5d0 + (id % 22)), lastName: 'משפחה' + String.fromCharCode(0x5d0 + ((id * 7) % 22)), street: id % 5 ? 'הרצל ' + (id % 40) : '', phone2: '' },
    items: Array.from({ length: nItems }, (_, k) => ({ ...base.items[0], id: `it-${id}-${k}`, sizeText: String(36 + 2 * ((id + k) % 6)), barcodePrefix: k % 2 ? 555 : 123, returnedOk: false })) });
  for (let i = 0; i < 22; i++) orders.push(mk(7000 + i, {}, 1 + (i % 4)));
  const lateDays = [30, 29, 28, 24, 23, 22, 30, 29];
  for (let i = 0; i < 8; i++) orders.push(mk(7100 + i, { eventDate: new Date(Date.UTC(2026, 8, lateDays[i] - 1)), toDate: new Date(Date.UTC(2026, 8, lateDays[i])) }, 1 + (i % 3)));
}
// OrderItem rows for the extras that query items directly (PP-16): derived from the orders' embedded items
const orderItems = orders.flatMap((o) => (o.items || []).map((it) => ({ ...it, orderId: o.orderId })));
installDb({ extra: { order: orders, orderItem: orderItems } });
const { getScheduleDay } = await L('lib/schedule/index.js');
const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');
// single=<orderId> (PP-07 / PP-12 only): the "?orderId=" mode - one order's synthetic day (lib/schedule/print/singleOrder.js), as the order card prints it
const singleArg = process.argv.find((a) => a.startsWith('single='));
const day = singleArg
  ? await (await L('lib/schedule/print/singleOrder.js')).loadSingleOrderDay({ orderId: Number(singleArg.slice(7)), keys: keysArg, now: NOW })
  : await getScheduleDay({ date: DAY, user: { id: 'emp-head', roleId: 0 }, now: NOW });
const defs = keysArg.map(getPrintPage);
const extras = await loadExtras(day, defs);
// one payload per (page, version): the same page may be rendered in several versions in one run
const payloads = pageSpecs.map((sp) => buildPrintPayload({ day, keys: [sp.key], versions: sp.version ? { [sp.key]: sp.version } : {}, extras, gmach: { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' }, printedBy: 'מנהלת (דוגמה)', now: NOW }));
const payload = { meta: payloads[0].meta, pages: payloads.flatMap((x) => x.pages) };

// ---- 2. static HTML with the live page's global CSS + print.css -------------------------------
const { PrintDocument } = await L('app/components/schedule/print/PrintShell.js');
const css = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
const FONT_FREE = process.env.NO_WEBFONTS === '1';
// the web font is loaded the way the live page does it (its own <style>@import</style>, lib/schedule/print/font.js) - not via print.css
const { PRINT_FONT_CSS } = await L('lib/schedule/print/font.js');
const fontStyle = FONT_FREE ? '' : `<style>${PRINT_FONT_CSS}</style>`;
// PP_THEME=dark: the live app's dark theme tokens (app/design-system.css [data-theme=dark]) - the print sheet must not follow them
const THEME = process.env.PP_THEME === 'dark' ? 'dark' : 'light';
// page-local stylesheets (app/components/schedule/print/pages/pp*.css): the live page gets them through the templates' own imports,
// which run BEFORE page.js imports print.css - so they are linked before print.css here too (same cascade order as the live page)
const pageCss = fs.readdirSync(path.join(PROJ, 'app/components/schedule/print/pages')).filter((f) => /^pp.*\.css$/i.test(f))
  .map((f) => `<link rel="stylesheet" href="${css('app/components/schedule/print/pages/' + f)}">`).join('');
const results = [];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
try {
  if (combined) {
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { payload }));
    const name = 'ALL' + (long ? '-long' : '');
    const html = `<!doctype html><html lang="he" dir="rtl"${THEME === 'dark' ? ' data-theme="dark"' : ''}><head><meta charset="utf-8">${fontStyle}<title>${name}</title>
<link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}"><link rel="stylesheet" href="${css('app/design-system.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">
${pageCss}<link rel="stylesheet" href="${css('app/components/schedule/print/print.css')}"></head>
<body class="hide-global-nav pp-print-mode"><nav class="navbar">תפריט (מדמה את המעטפת)</nav><div data-print-ready="true">${body}</div></body></html>`;
    const htmlPath = path.join(OUT, name + '.html');
    fs.writeFileSync(htmlPath, html);
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 1 });
    await tab.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
    await tab.emulateMediaType('print');
    const pdfPath = path.join(OUT, name + '.pdf');
    await tab.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
    const jsonPath = path.join(OUT, name + '.pdf.json');
    const py = spawnSync('python', [path.join(HERE, 'pdfcheck.py'), pdfPath, jsonPath], { encoding: 'utf8' });
    const pdf = py.status === 0 && fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : { pages: null, text: [] };
    await tab.close();
    const texts = pdf.text.map((t) => t.replace(/\s+/g, ' '));
    const counters = texts.map((t) => { let m = t.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/); if (m) return [Number(m[1]), Number(m[2])]; m = t.match(/(\d+)\s*מתוך\s*(\d+)\s*עמוד/); return m ? [Number(m[2]), Number(m[1])] : null; });
    const problems = [];
    if (!pdf.pages) problems.push('no pdf');
    const mc = marginCheck(pdfPath); if (mc) problems.push(mc);
    if (!counters.every((c, i) => c && c[0] === i + 1 && c[1] === pdf.pages)) problems.push('counters not continuous: ' + JSON.stringify(counters));
    if (!texts.every((t) => t.includes('הופק מהמערכת'))) problems.push('footer missing on page ' + (texts.findIndex((t) => !t.includes('הופק מהמערכת')) + 1));
    // informational: how many PDF pages mention each selected page's title/label (pypdf glues RTL words with their neighbours, so a 0 here
    // is not a failure - the authoritative per-sheet check is the pixel diff against the standalone PDF below)
    const norm = (t) => String(t).replace(/[^א-ת0-9A-Za-z]/g, '');
    const perPage = {};
    for (const p of payload.pages) {
      const title = norm((p.data && p.data.title) || p.def.label);
      const label = norm(p.def.label);
      perPage[p.key + (p.version ? ':' + p.version : '')] = texts.filter((t) => { const n = norm(t); return n.includes(title) || n.includes(label); }).length;
    }
    // the combined document must be the standalone PDFs laid end to end: page count = sum of the singles (from the last non-combined run's
    // summary), and each sheet's first page pixel-identical to its standalone first page apart from the footer page number (<0.6%) -
    // this is what proves the sticker pages' named @page (8/9mm margins) and the per-order pages keep their layout inside a mixed document
    const sumPath = path.join(OUT, 'summary' + (long ? '-long' : '') + '.json');
    const pageDiffs = {};
    if (fs.existsSync(sumPath)) {
      const singles = JSON.parse(fs.readFileSync(sumPath, 'utf8'));
      let offset = 0; let sum = 0;
      for (const p of payload.pages) {
        const sName = p.key + (p.version && p.def.versions ? '-' + p.version : '') + (long ? '-long' : '');
        const s = singles.find((x) => x.name === sName);
        if (!s || !s.pdfPages) { pageDiffs[sName] = 'no single'; continue; }
        const r = spawnSync('python', [path.join(HERE, 'pdf-pagediff.py'), pdfPath, String(offset + 1), path.join(OUT, sName + '.pdf'), '1'], { encoding: 'utf8' });
        let dp = null; try { dp = JSON.parse(r.stdout).diffPct; } catch { dp = 'err ' + (r.stderr || '').slice(0, 80); }
        pageDiffs[sName] = dp;
        if (typeof dp !== 'number' || dp > 0.6) problems.push(`sheet ${sName} differs from its standalone page (${dp}%)`);
        offset += s.pdfPages; sum += s.pdfPages;
      }
      if (sum !== pdf.pages) problems.push(`page count ${pdf.pages} != sum of singles ${sum}`);
    } else problems.push('run the non-combined pass first (summary json missing) to compare pages with the standalone PDFs');
    console.log(`${problems.length ? 'FAIL' : 'OK  '} ${name.padEnd(12)} sheets=${payload.pages.length} pdfPages=${pdf.pages} ${problems.join(' | ')}`);
    console.log('  PDF pages per selected page: ' + JSON.stringify(perPage));
    console.log('  pixel diff vs standalone first page (%): ' + JSON.stringify(pageDiffs));
    fs.writeFileSync(path.join(OUT, name + '.summary.json'), JSON.stringify({ pdfPages: pdf.pages, counters, perPage, pageDiffs, problems }, null, 2));
    await browser.close();
    process.exit(problems.length ? 1 : 0);
  }
  for (const page of payload.pages) {
    const single = { meta: payload.meta, pages: [page] };
    const body = renderToStaticMarkup(React.createElement(PrintDocument, { payload: single }));
    const name = page.key + (page.version && page.def.versions ? '-' + page.version : '') + (long ? '-long' : '');
    const html = `<!doctype html><html lang="he" dir="rtl"${THEME === 'dark' ? ' data-theme="dark"' : ''}><head><meta charset="utf-8">${fontStyle}<title>${page.def.label}</title>
<link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}"><link rel="stylesheet" href="${css('app/design-system.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">
${pageCss}<link rel="stylesheet" href="${css('app/components/schedule/print/print.css')}">${process.env.PDF_FONT ? `<style>@media print{.pp-root,.pp-root *{font-family:${process.env.PDF_FONT}!important}}</style>` : ''}</head>
<body class="hide-global-nav pp-print-mode"><nav class="navbar">תפריט (מדמה את המעטפת)</nav><div data-print-ready="true">${body}</div></body></html>`;
    const htmlPath = path.join(OUT, name + '.html');
    fs.writeFileSync(htmlPath, html);

    const tab = await browser.newPage();
    if (THEME === 'dark') await tab.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    if (FONT_FREE) await tab.setRequestInterception(true), tab.on('request', (r) => (/fonts\.g/.test(r.url()) ? r.abort() : r.continue()));
    await tab.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 1 });
    await tab.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
    await tab.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });

    const leaksScreen = await tab.evaluate(leakScan);
    // ---- 3. computed styles under print media ----
    await tab.emulateMediaType('print');
    const leaksPrint = await tab.evaluate(leakScan);
    const styles = await tab.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      const root = document.querySelector('.pp-root');
      const sheet = document.querySelector('.pp-sheet');
      const th = document.querySelector('.pp-t th');
      const td = document.querySelector('.pp-t tbody tr:not(.g) td');
      const h1 = document.querySelector('.pp-tb h1');
      const nav = document.querySelector('.navbar');
      const trs = [...document.querySelectorAll('.pp-t tbody tr')];
      return {
        bodyBg: cs(document.body).backgroundColor,
        rootBg: cs(root).backgroundColor, rootColor: cs(root).color, rootFont: cs(root).fontFamily, rootDir: cs(root).direction,
        sheetBg: sheet ? cs(sheet).backgroundColor : null, slim: !!(sheet && sheet.classList.contains('slim')),
        h1Font: h1 ? cs(h1).fontFamily : null, h1Color: h1 ? cs(h1).color : null, h1Size: h1 ? cs(h1).fontSize : null,
        thBg: th ? cs(th).backgroundColor : null, thBorderBottom: th ? cs(th).borderBottomWidth : null, thPosition: th ? cs(th).position : null,
        tdPaddingTop: td ? cs(td).paddingTop : null, tdBreak: td ? cs(td.parentElement).breakInside : null,
        rp: root ? cs(root).getPropertyValue('--rp').trim() : null,
        navDisplay: nav ? cs(nav).display : null,
        rows: trs.length,
        theadDisplay: sheet ? cs(sheet.tHead).display : null, tfootDisplay: sheet ? cs(sheet.tFoot).display : null,
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
    pdfChecks.whiteMargins = marginCheck(pdfPath) || true;
    styles.leaks = leaksPrint.slice(0, 6); styles.leakCount = leaksPrint.length; styles.leaksScreen = leaksScreen.slice(0, 6); styles.leakCountScreen = leaksScreen.length;
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
  if (s.h1Size !== (s.slim ? '16px' : '21px')) problems.push('h1 size ' + s.h1Size + (s.slim ? ' (slim)' : ''));
  if (s.rootDir !== 'rtl') problems.push('dir ' + s.rootDir);
  if (s.thBg && s.thBg !== 'rgba(0, 0, 0, 0)') problems.push('th bg ' + s.thBg);
  if (s.thPosition && s.thPosition !== 'static') problems.push('th position (sticky leak) ' + s.thPosition);
  if (s.rp !== '2.3mm') problems.push('--rp ' + s.rp);
  if (s.tdBreak && s.tdBreak !== 'avoid') problems.push('row break-inside ' + s.tdBreak);
  if (s.navDisplay !== 'none') problems.push('navbar visible in print: ' + s.navDisplay);
  if (s.theadDisplay !== 'table-header-group') problems.push('thead ' + s.theadDisplay);
  if (s.tfootDisplay !== 'table-footer-group') problems.push('tfoot ' + s.tfootDisplay);
  if (s.leakCount) problems.push('theme leaks (print): ' + s.leakCount + ' ' + JSON.stringify(s.leaks.slice(0, 3)));
  if (s.leakCountScreen) problems.push('theme leaks (screen): ' + s.leakCountScreen + ' ' + JSON.stringify(s.leaksScreen.slice(0, 3)));
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
  // the title bar shows data.title when the page sets one (03: "רשימת תיקונים…", 10/18: "משלוחים…", 12: "תעודת משלוח"), else the registry label
  const titleWord = String((page.data && page.data.title) || page.def.label).split(' ')[0];
  const hasHead = (t) => t.includes('גמ״ח שמלות') && (t.includes(titleWord) || t.includes(page.def.label.split(' ')[0]));
  out.headerOnEveryPage = texts.every(hasHead) || 'missing on page ' + (texts.findIndex((t) => !hasHead(t)) + 1);
  out.footerOnEveryPage = texts.every((t) => t.includes('הופק מהמערכת')) || 'missing on page ' + (texts.findIndex((t) => !t.includes('הופק מהמערכת')) + 1);
  // page counters from @page margin box (Chrome 131+); report as a value, not a failure, when absent
  // pypdf emits the RTL margin box reversed ("1 מתוך1עמוד"); accept both orders
  const counters = texts.map((t) => { let m = t.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/); if (m) return [Number(m[1]), Number(m[2])]; m = t.match(/(\d+)\s*מתוך\s*(\d+)\s*עמוד/); return m ? [Number(m[2]), Number(m[1])] : null; });
  out.pageCounters = counters.every((c, i) => c && c[0] === i + 1 && c[1] === pdf.pages) ? true : 'counters: ' + JSON.stringify(counters);
  // no row split: each "#id" must be on the same page as the customer name that follows it in the row
  const rows = page.data.rows || (page.data.groups || []).flatMap((g) => g.rows) || [];
  let split = [];
  for (const r of rows) {
    const idx = texts.findIndex((t) => t.includes(String(r.orderId))); // '#' is dropped by the extractor
    if (idx < 0) { split.push(r.orderId + ':missing'); continue; }
    const nameFirst = (r.name || '').split(' ')[0];
    if (nameFirst && !texts[idx].includes(nameFirst)) split.push(r.orderId + ':name-on-other-page');
  }
  out.noRowSplit = split.length ? split.slice(0, 5).join(',') : true;
  if (page.key === 'PP-16') out.blocksIntact = blocksIntact(pdf.text, rows);
  out.allRowsPrinted = rows.every((r) => texts.some((t) => t.includes(String(r.orderId)))) || 'some rows missing';
  return out;
}
