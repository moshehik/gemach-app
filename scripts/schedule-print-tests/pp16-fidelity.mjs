// PP-16 design fidelity: the real template (PrintDocument -> PP16) rendered from the real data pipeline vs p16() of the approved
// design page (דפי-הדפסה-עיצוב.html), for the SAME people / dresses, both on screen media in headless Chrome.
//   node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/pp16-fidelity.mjs
// What is compared, node by node (parallel DOM walk of the sheet body: design .sh-body vs ours .pp-body):
//   tag names, bounding boxes (px, tolerance 0.6), normalised text, and a set of computed styles (font, colour, borders, padding,
//   background). Item rows may come in a different order (we sort by model, the design lists them as generated) - their text is
//   compared as a multiset and their boxes by position. Output: out/PP-16-fidelity.json + a summary line; exit 1 on any difference.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { installDb, NOW } from '../schedule-tests/fixtures.mjs';

const PROJ = process.env.PROJ;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);

const DESIGN_CANDIDATES = [
  process.env.DESIGN_HTML,
  'C:/Users/moshe/Desktop/גמח שמלות חדש/תצוגות-עיצוב/סיימתי-לעבוד/דפי-הדפסה-עיצוב.html',
  'C:/Users/moshe/Desktop/גמח שמלות חדש/תצוגות-עיצוב/דפי-הדפסה-עיצוב.html',
].filter(Boolean);
const DESIGN = DESIGN_CANDIDATES.find((f) => fs.existsSync(f));
if (!DESIGN) { console.error('design page not found'); process.exit(2); }
const css = (rel) => pathToFileURL(path.join(PROJ, rel)).href;
const DAY = '2026-10-01';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
let diffs = [];
let summary;
try {
  // ---- design side: the people/dresses of p16() and its HTML ----
  const dpage = await browser.newPage();
  await dpage.setViewport({ width: 1000, height: 1400 });
  await dpage.goto(pathToFileURL(DESIGN).href, { waitUntil: 'load' });
  const design = await dpage.evaluate(() => {
    const idx = [1, 4, 7, 19, 25];
    const people = idx.map((i) => { const r = ORD[i]; return { i, id: r.id, first: r.first, last: r.last, ph: r.ph, city: r.city, street: r.street, n: r.n, dresses: dresses(r) }; });
    // the design hard-codes the event day of the sample (13.10); ours comes from the data (Wed 30.9 -> returns Thu 1.10)
    return { people, html: p16({}, { bc: 'head', tone: 'bw' }).split(hDay('2026-10-13')).join(hDay('2026-09-30')) };
  });

  // ---- our side: the same families through the real pipeline ----
  const d = (iso) => new Date(iso);
  const mkItem = (o, k, dr) => ({
    id: `it-${o.id}-${k}`, description: dr.name, sizeText: String(dr.size), barcodePrefix: dr.pre, isTaken: true, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false,
    neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDetails: null, alterationDone: false,
    dressItem: { location: 'חנות', inRepair: false, sizeText: String(dr.size), dress: { name: dr.name, barcodePrefix: dr.pre } },
  });
  // the design's late days: 3 and 9 before the printed day (Thu 1.10): due Mon 28.9 (3) and Tue 22.9 (9)
  const spec = [
    { p: design.people[0], event: '2026-09-29T21:00:00Z' }, { p: design.people[1], event: '2026-09-29T21:00:00Z' }, { p: design.people[2], event: '2026-09-29T21:00:00Z' },
    { p: design.people[3], event: '2026-09-21T21:00:00Z', to: '2026-09-28T00:00:00Z' }, { p: design.people[4], event: '2026-09-15T21:00:00Z', to: '2026-09-22T00:00:00Z' },
  ];
  const orders = spec.map(({ p, event, to }) => ({
    orderId: p.id, status: null, isDeleted: false, orderDate: d('2026-09-01T08:00:00Z'), eventDate: d(event), eventDateHebrew: null, fromDate: null, toDate: to ? d(to) : null, returnDate: null,
    isAbroad: false, isWeekdayEvent: false, extraDay: null, customSpacing: null, branch: null, pickupBranch: null, notes: '', internalNotes: '', isDelivery: false, deliveryDirection: null,
    customer: { firstName: p.first, lastName: p.last, phone1: p.ph, phone2: '', city: p.city, street: p.street, houseNum: null },
    employee: null, obligations: [], items: p.dresses.map((dr, k) => mkItem(p, k, { name: dr.name, pre: dr.pre, size: dr.size })),
  }));
  const orderItems = orders.flatMap((o) => o.items.map((it) => ({ ...it, orderId: o.orderId })));
  installDb({ extra: { order: orders, orderItem: orderItems, dressModel: [] } });
  const { getScheduleDay } = await L('lib/schedule/index.js');
  const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
  const { getPrintPage } = await L('lib/schedule/print/registry.js');
  const day = await getScheduleDay({ date: DAY, user: { id: 'emp-head', roleId: 0 }, now: NOW });
  const def = getPrintPage('PP-16');
  const extras = await loadExtras(day, [def]);
  const payload = buildPrintPayload({ day, keys: ['PP-16'], extras, gmach: { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' }, printedBy: 'מנהלת (דוגמה)', now: NOW });
  const { PrintDocument } = await L('app/components/schedule/print/PrintShell.js');
  const body = renderToStaticMarkup(React.createElement(PrintDocument, { payload }));
  const pageCss = fs.readdirSync(path.join(PROJ, 'app/components/schedule/print/pages')).filter((f) => /^pp.*\.css$/i.test(f)).map((f) => `<link rel="stylesheet" href="${css('app/components/schedule/print/pages/' + f)}">`).join('');
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="${css('app/globals.css')}"><link rel="stylesheet" href="${css('app/design-overrides.css')}"><link rel="stylesheet" href="${css('app/design-system.css')}">
<link rel="stylesheet" href="${css('design-system/components.css')}"><link rel="stylesheet" href="${css('app/schedule/schedule.css')}">${pageCss}<link rel="stylesheet" href="${css('app/components/schedule/print/print.css')}"></head>
<body class="hide-global-nav pp-print-mode">${body}</body></html>`;
  const htmlPath = path.join(OUT, 'PP-16-fidelity-ours.html');
  fs.writeFileSync(htmlPath, html);

  // ---- measure both ----
  const MEASURE = `(rootSel, flat) => {
    const root = document.querySelector(rootSel);
    const ro = root.getBoundingClientRect();
    const PROPS = ['fontFamily','fontSize','fontWeight','color','backgroundColor','borderTopWidth','borderBottomWidth','borderTopColor','borderBottomColor','borderTopStyle','borderBottomStyle','borderLeftWidth','borderRightWidth','paddingTop','paddingBottom','paddingLeft','paddingRight','textAlign','direction','lineHeight','display','whiteSpace','borderRadius','minWidth','outlineWidth','outlineStyle','boxShadow','position','zIndex','opacity','textTransform','letterSpacing','verticalAlign','textDecorationLine'];
    const norm = (el) => el.tagName === 'svg' || el.tagName === 'SVG' ? 'svg:' + el.getAttribute('data-code') : (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').replace(/\\u00a0/g, ' ').trim();
    const walk = (el) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      const st = {}; for (const p of PROPS) st[p] = cs[p];
      return { tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class') || '').replace(/pp-/g, ''), text: el.children.length === 0 || el.tagName.toLowerCase() === 'svg' ? norm(el) : null,
        box: [r.left - ro.left, r.top - ro.top, r.width, r.height], st, kids: [...el.children].map(walk) };
    };
    return walk(root);
  }`;
  const measure = async (url, setup, sel) => {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1000, height: 1400 });
    if (url) await tab.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
    if (setup) await setup(tab);
    const r = await tab.evaluate(`(${MEASURE})(${JSON.stringify(sel)})`);
    await tab.close();
    return r;
  };
  // the design lists the sample families in its own order; the schedule sorts the day's returns by family name (he) and ours puts
  // the most-late first - reorder the design's blocks the same way (data order, not layout) before measuring
  const reorder = () => {
    const body = document.querySelector('.sh-body');
    const kids = [...body.children];
    const dgs = kids.filter((k) => k.classList.contains('dg'));
    const section = (from, to) => kids.filter((k) => k.classList.contains('ob') && kids.indexOf(k) > kids.indexOf(from) && (!to || kids.indexOf(k) < kids.indexOf(to)));
    const fam = (el) => el.querySelector('.ob-h b').textContent.replace('משפחת ', '');
    const today = section(dgs[0], dgs[1]).sort((a, b) => fam(a).localeCompare(fam(b), 'he'));
    const late = section(dgs[1], null).sort((a, b) => Number(b.querySelector('.fl').textContent.match(/\d+/)[0]) - Number(a.querySelector('.fl').textContent.match(/\d+/)[0]));
    dgs[1].before(...today);
    body.append(...late);
  };
  const designTree = await measure(pathToFileURL(DESIGN).href, async (tab) => {
    await tab.evaluate((h) => { document.body.innerHTML = h; document.body.style.padding = '0'; document.body.style.margin = '0'; }, design.html);
    await tab.evaluate(`(${reorder})()`);
  }, '.sh-body');
  const oursTree = await measure(pathToFileURL(htmlPath).href, null, '.pp-body');

  // ---- parallel compare ----
  const TOL = 0.6;
  const colour = (v) => String(v).replace(/\s+/g, '');
  const SKIP_STYLE_FOR_TAGS = new Set(['svg', 'rect']);
  function cmp(a, b, p, loose = false) {
    const here = `${p}/${a.tag}${a.cls ? '.' + a.cls.split(' ')[0] : ''}`;
    if (a.tag !== b.tag) { diffs.push({ at: here, what: 'tag', design: a.tag, ours: b.tag }); return; }
    if (a.text !== null && b.text !== null && a.text !== b.text) diffs.push({ at: here, what: 'text', design: a.text, ours: b.text });
    for (let i = 0; i < 4; i++) if (Math.abs(a.box[i] - b.box[i]) > TOL && !(i < 2 && a.tag === 'tr') && !(p === 'body' && i === 3) && !(loose && !['tr', 'td'].includes(a.tag) && i !== 3)) { diffs.push({ at: here, what: ['x', 'y', 'width', 'height'][i], design: +a.box[i].toFixed(2), ours: +b.box[i].toFixed(2) }); break; }
    if (!SKIP_STYLE_FOR_TAGS.has(a.tag)) {
      for (const k of Object.keys(a.st)) {
        if (k === 'fontFamily') { if (!/Segoe UI|Noto Sans Hebrew/.test(b.st[k])) diffs.push({ at: here, what: k, design: a.st[k], ours: b.st[k] }); continue; }
        if (k === 'minWidth' && p === 'body') continue;
        if (k === 'lineHeight' || k === 'minWidth') { if (a.st[k] !== b.st[k] && !(a.st[k] === 'normal' || b.st[k] === 'normal')) diffs.push({ at: here, what: k, design: a.st[k], ours: b.st[k] }); continue; }
        if (/^border(Top|Bottom)Color$/.test(k) && parseFloat(a.st[k.replace('Color', 'Width')]) === 0 && parseFloat(b.st[k.replace('Color', 'Width')]) === 0) continue;
        if (k === 'outlineWidth' && a.st.outlineStyle === 'none' && b.st.outlineStyle === 'none') continue;
        if (k === 'textAlign') { const rtl = (v) => ({ start: 'right', end: 'left' }[v] || v); if (rtl(a.st[k]) === rtl(b.st[k])) continue; }
        if (colour(a.st[k]) !== colour(b.st[k])) diffs.push({ at: here, what: k, design: a.st[k], ours: b.st[k] });
      }
    }
    if (a.kids.length !== b.kids.length) { diffs.push({ at: here, what: 'children', design: a.kids.length, ours: b.kids.length }); return; }
    // item rows: same boxes by position; text as multiset (we sort the dresses of a family by model)
    const isBody = a.tag === 'tbody';
    if (isBody) {
      // (the first cell is "k מתוך n" - numbering follows our order, so it is left out of the multiset)
      const ta = a.kids.map((r) => r.kids.slice(1).map((c) => c.text ?? c.kids.map((x) => x.text).join(' ')).join('|')).sort();
      const tb = b.kids.map((r) => r.kids.slice(1).map((c) => c.text ?? c.kids.map((x) => x.text).join(' ')).join('|')).sort();
      if (JSON.stringify(ta) !== JSON.stringify(tb)) diffs.push({ at: here, what: 'rows-text (multiset)', design: ta, ours: tb });
      a.kids.forEach((r, i) => { const rb = b.kids[i]; const s = (x) => ({ ...x, text: null }); cmpNoText(r, rb, `${here}/tr[${i}]`, true); });
      return;
    }
    a.kids.forEach((k, i) => cmp(k, b.kids[i], here + `[${i}]`, loose));
  }
  function cmpNoText(a, b, p, loose) {
    const strip = (n) => ({ ...n, text: null, kids: n.kids.map(strip) });
    cmp(strip(a), strip(b), p, loose);
  }
  cmp(designTree, oursTree, 'body');
  const count = (n) => 1 + n.kids.reduce((s, k) => s + count(k), 0);
  summary = { nodesCompared: count(designTree), differences: diffs.length, designPage: DESIGN };
  fs.writeFileSync(path.join(OUT, 'PP-16-fidelity.json'), JSON.stringify({ summary, diffs }, null, 2));
  // screenshots of both for the eye
  const shot = async (url, setup, file) => { const t = await browser.newPage(); await t.setViewport({ width: 1000, height: 1250 }); if (url) await t.goto(url, { waitUntil: 'networkidle0' }).catch(() => {}); if (setup) await setup(t); const el = await t.$('.sheet, .pp-sheet'); await (el || t).screenshot({ path: path.join(OUT, file), ...(el ? {} : { fullPage: true }) }); await t.close(); };
  await shot(pathToFileURL(DESIGN).href, async (t) => {
    await t.evaluate((h) => { document.body.innerHTML = h; document.body.style.cssText = 'padding:0;margin:0;background:#fff;display:block;overflow:visible'; document.documentElement.style.background = '#fff'; }, design.html);
    await t.evaluate(`(${reorder})()`);
  }, 'PP-16-design.png');
  await shot(pathToFileURL(htmlPath).href, null, 'PP-16-ours.png');
} finally {
  await browser.close();
}
console.log(`PP-16 fidelity vs design: ${summary.nodesCompared} nodes compared, ${summary.differences} difference(s)`);
for (const x of diffs.slice(0, 25)) console.log('  ', JSON.stringify(x).slice(0, 300));
process.exit(diffs.length ? 1 : 0);
