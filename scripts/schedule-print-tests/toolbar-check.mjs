// Toolbar + wizard fidelity check against the approved demo (תצוגות-עיצוב/לוז-יומי.html), headless Chrome, no server.
//   node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/toolbar-check.mjs
// Renders the real ScheduleToolbarActions (initial state) and PrintWizard (open, print mode) to static HTML inside the
// page's real CSS (globals, design-overrides, components.css, schedule.css, ScheduleToolbarActions.css), screenshots
// them, and compares the computed style of the two round buttons (size, radius, background, border, icon size) with
// the demo's .xlbtn.xld / .xlbtn.xlp. Output: scripts/schedule-print-tests/out/toolbar-*.png + a diff list.
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
const DEMO = process.env.DEMO_HTML || 'file:///C:/Users/moshe/Desktop/' + encodeURI('גמח שמלות חדש/תצוגות-עיצוב/לוז-יומי.html');

const { default: ScheduleToolbarActions } = await L('app/components/schedule/ScheduleToolbarActions.js');
const { default: PrintWizard } = await L('app/components/schedule/print/PrintWizard.js');
const { MenuSprite } = await L('app/components/menu/menuParts.js').catch(() => ({ MenuSprite: null }));

const stageData = { stages: [{ key: 'order', counts: { total: 2 } }, { key: 'repair', counts: { total: 3 } }, { key: 'prep', counts: { total: 4 } }, { key: 'dout', counts: { total: 1 } }, { key: 'pick', counts: { total: 2 } }, { key: 'event', counts: { total: 5 } }, { key: 'manret', counts: { total: 2 } }, { key: 'dback', counts: { total: 1 } }] };
const toolbar = renderToStaticMarkup(React.createElement(ScheduleToolbarActions, { date: '2026-10-14', branch: '', stageData }));
const wizard = renderToStaticMarkup(React.createElement(PrintWizard, { mode: 'print', date: '2026-10-14', branch: '', stageData, onClose() {} }));
const sprite = MenuSprite ? renderToStaticMarkup(React.createElement(MenuSprite)) : '';
const css = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">
<link rel="stylesheet" href="${css('app/components/schedule/print/ScheduleToolbarActions.css')}"></head>
<body><div class="gm-ds gm-home gm-lz home-bg">${sprite}<div class="app lz-app"><div class="topbar"><div class="ttl"><h1 class="pg-ttl"><small>יום רביעי · כ״ג תשרי תשפ״ז</small><bdi>לוח זמנים</bdi></h1></div>${toolbar}</div>
<div id="wiz" style="position:relative;min-height:900px">${wizard}</div></div></div></body></html>`;
const htmlPath = path.join(OUT, 'toolbar.html');
fs.writeFileSync(htmlPath, html);

const PROPS = ['width', 'height', 'borderRadius', 'backgroundColor', 'borderColor', 'borderWidth', 'display', 'padding'];
const grab = () => {
  const cs = getComputedStyle;
  const pick = (el) => { if (!el) return null; const s = cs(el); const o = {}; for (const p of ['width', 'height', 'borderRadius', 'backgroundColor', 'borderColor', 'borderWidth', 'display', 'padding']) o[p] = s[p]; const svg = el.querySelector('svg'); if (svg) { const r = svg.getBoundingClientRect(); o.icon = Math.round(r.width) + 'x' + Math.round(r.height); } o.title = el.getAttribute('data-tip') || el.getAttribute('title'); return o; };
  const dl = document.querySelector('.topbar .xlbtn.xld'), pr = document.querySelector('.topbar .xlbtn.xlp');
  const order = [...document.querySelectorAll('.topbar .xlbtn')].map((b) => ({ cls: b.className, x: Math.round(b.getBoundingClientRect().left) }));
  return { dl: pick(dl), pr: pick(pr), order, gap: dl && pr ? Math.round(Math.abs(dl.getBoundingClientRect().left - pr.getBoundingClientRect().left) - dl.getBoundingClientRect().width) : null };
};

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
try {
  const real = await browser.newPage();
  await real.setViewport({ width: 1280, height: 1000 });
  await real.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  const wiz0 = await real.$('.lz-wiz');
  if (wiz0) await wiz0.screenshot({ path: path.join(OUT, 'wizard-real.png') });
  const wizInfo = await real.evaluate(() => {
    const d = document.querySelector('.lz-wiz'); if (!d) return null; const s = getComputedStyle(d);
    return { width: s.width, radius: s.borderRadius, bg: s.backgroundColor, tabs: [...d.querySelectorAll('.lz-wt .tab')].map((t) => t.textContent.trim()), rows: d.querySelectorAll('.lz-wr').length, todo: d.querySelectorAll('.lz-wtodo').length, go: d.querySelector('.lz-wf .btn.primary').textContent.trim(), all: d.querySelector('.lz-wf .btn:not(.primary):not(.ghost)').textContent.trim(), preview: !!d.querySelector('iframe.lz-wpf'), previewSrc: d.querySelector('iframe.lz-wpf') && d.querySelector('iframe.lz-wpf').getAttribute('src') };
  });
  // the wizard scrim covers the top bar - hide it for the toolbar shots
  await real.addStyleTag({ content: '.lz-wscrim{display:none!important}' });
  const top = await real.$('.topbar');
  await top.screenshot({ path: path.join(OUT, 'toolbar-real.png') });
  await real.hover('.topbar .xlbtn.xld');
  await top.screenshot({ path: path.join(OUT, 'toolbar-real-hover-dl.png') });
  await real.hover('.topbar .xlbtn.xlp');
  await top.screenshot({ path: path.join(OUT, 'toolbar-real-hover-print.png') });
  const mine = await real.evaluate(grab);

  const demo = await browser.newPage();
  await demo.setViewport({ width: 1280, height: 1000 });
  await demo.goto(DEMO, { waitUntil: 'networkidle0', timeout: 90000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  const dtop = await demo.$('.topbar');
  if (dtop) await dtop.screenshot({ path: path.join(OUT, 'toolbar-demo.png') });
  const theirs = await demo.evaluate(grab);
  await demo.close();

  const diffs = [];
  for (const b of ['dl', 'pr']) {
    for (const p of PROPS.concat(['icon'])) {
      if (!theirs[b] || !mine[b]) { diffs.push(`${b}: missing (${!theirs[b] ? 'demo' : 'real'})`); break; }
      if (String(theirs[b][p]) !== String(mine[b][p])) diffs.push(`${b}.${p}: demo=${theirs[b][p]} real=${mine[b][p]}`);
    }
  }
  console.log('demo buttons :', JSON.stringify(theirs));
  console.log('real buttons :', JSON.stringify(mine));
  console.log('wizard       :', JSON.stringify(wizInfo));
  console.log(diffs.length ? 'DIFFS:\n  ' + diffs.join('\n  ') : 'buttons match the demo (size, radius, colours, border, icon size, tooltip)');
  process.exitCode = diffs.length ? 1 : 0;
} finally {
  await browser.close();
}
