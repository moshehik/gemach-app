// Compares the computed styles + sizes of the built pages (out/<name>.html from pp-g2.render.mjs) against the approved design
// (תצוגות-עיצוב/סיימתי-לעבוד/דפי-הדפסה-עיצוב.html) element by element: the design's own page builders (PAGES[i].build) are executed in
// the design file, then for every selector pair (design selector -> shipped selector) the first matches are compared on font,
// colour, background, borders, padding, margin, line-height and rendered size (mm).
//   node scripts/schedule-print-tests/pp-g2.design-compare.mjs   (needs out/PP-03a|PP-03b|PP-04|PP-08|PP-09.html from pp-g2.render.mjs, and
//   out/PP-01.html, out/PP-15.html from render.mjs - the shell's two reference pages are compared here too)
// Output: out/design-compare.json + a console summary of every difference. Exit 1 on a difference that is not on the allow-list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const DESIGN = process.env.PP_DESIGN || 'C:/Users/moshe/Desktop/גמח שמלות חדש/תצוגות-עיצוב/סיימתי-לעבוד/דפי-הדפסה-עיצוב.html';

const SHELL = [['.sheet.slim .sh-head', '.pp-sheet.slim .pp-head'], ['.sheet .sh-tb', '.pp-sheet .pp-tb'], ['.sh-tb h1', '.pp-tb h1'], ['.sh-tb .sh-chip', '.pp-tb .pp-chip'], ['.sh-tb p', '.pp-tb p'], ['.sh-tb .sh-sum', '.pp-tb .pp-sum'], ['.sh-id b', '.pp-id b'], ['.sh-date', '.pp-date']];
const TABLE = [['.t', '.pp-t'], ['.t th', '.pp-t th'], ['.t tbody tr:not(.g) td', '.pp-t tbody tr:not(.g) td'], ['.t tr.g td', '.pp-t tr.g td'], ['.ck', '.pp-ck'], ['.cks', '.pp-cks'], ['td.bcc', '.pp-t td.bcc'], ['td.bcc svg', '.pp-t td.bcc svg'], ['td.bcc small', '.pp-t td.bcc small'], ['.t td small', '.pp-t td small']];
const CASES = [
  { name: 'PP-03a', id: '03', version: 'a', pairs: [...SHELL.slice(1), ...TABLE, ['.dg', '.pp-dg'], ['.dg span', '.pp-dg span'], ['.ob', '.pp-ob'], ['.ob-h', '.pp-ob-h'], ['.ob-h b', '.pp-ob-h b'], ['.ob-h span', '.pp-ob-h span'], ['.ob-n', '.pp-ob-n'], ['.ob .t th', '.pp-ob .pp-t th'], ['.ob .t td', '.pp-ob .pp-t td'], ['.dsum', '.pp-dsum'], ['.ob-h .sp svg', '.pp-ob-h .sp svg']] },
  { name: 'PP-03b', id: '03', version: 'b', pairs: [...SHELL.slice(1), ...TABLE, ['.note', '.pp-note'], ['.note b', '.pp-note b'], ['.dsum', '.pp-dsum']] },
  { name: 'PP-04', id: '04', version: null, pairs: [...SHELL, ['.lab-grid', '.pp-lab-grid'], ['.lab', '.pp-lab'], ['.lab .l1', '.pp-lab .l1'], ['.lab .nm', '.pp-lab .nm'], ['.lab .md', '.pp-lab .md'], ['.lab .fx', '.pp-lab .fx'], ['.lab .bcw', '.pp-lab .bcw'], ['.lab .bcw svg', '.pp-lab .bcw svg'], ['.lab .bcw small', '.pp-lab .bcw small']] },
  { name: 'PP-08', id: '08', version: null, pairs: [...SHELL, ['.lab-grid', '.pp-lab-grid'], ['.lab', '.pp-lab'], ['.lab .row', '.pp-lab .row'], ['.lab .big', '.pp-lab .big'], ['.lab .fl', '.pp-lab .pp-fl'], ['.lab .nm', '.pp-lab .nm'], ['.lab .md', '.pp-lab .md'], ['.lab .bcw', '.pp-lab .bcw'], ['.lab .bcw svg', '.pp-lab .bcw svg'], ['.lab .bcw small', '.pp-lab .bcw small']] },
  { name: 'PP-09', id: '09', version: null, pairs: [...SHELL.slice(1), ...TABLE, ['.note', '.pp-note'], ['.signs', '.pp-signs'], ['.signs div', '.pp-signs div']] },
  // the two reference pages of the shell (01 summary + table with a total row, 15 simple table with group rows): built by render.mjs
  // (node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/render.mjs PP-01,PP-15), same design page
  { name: 'PP-01', id: '01', version: null, pairs: [['.sheet .sh-head', '.pp-sheet .pp-head'], ...SHELL.slice(1), ...TABLE, ['.stats', '.pp-stats'], ['.stats div', '.pp-stats div'], ['.stats b', '.pp-stats b'], ['.t tr.tot td', '.pp-t tr.tot td']] },
  { name: 'PP-15', id: '15', version: null, pairs: [['.sheet .sh-head', '.pp-sheet .pp-head'], ...SHELL.slice(1), ...TABLE, ['.stats', '.pp-stats'], ['.stats div', '.pp-stats div'], ['.stats b', '.pp-stats b'], ['.t tr.g td span', '.pp-t tr.g td span']] },
];
// known, intentional / environment differences (listed in the report); key = "<design selector> -> <built selector>|<property>"
const ALLOW = new Set([
  '.ck -> .pp-ck|whiteSpace', // a lone checkbox (1 dress) is not wrapped in .cks by the shared Check primitive; identical look
  '.t th -> .pp-t th|color', '.ob .t th -> .pp-ob .pp-t th|color', // design-overrides.css prints every thead th in #000 (!important) vs the design's #111: invisible, shell-wide
  '.sh-tb .sh-sum -> .pp-tb .pp-sum|marginRight', // margin-inline-start:auto = free space, depends on the text of the title bar
  '.lab .bcw -> .pp-lab .bcw|marginTop', // margin-top:auto = free space in the sticker, depends on how many text lines the sticker has
]);
// sizes (w/h) depend on the sample data (the design has its own names/dates), so they are reported but never fail; styles do.

const PROPS = ['fontSize', 'fontWeight', 'fontStyle', 'color', 'backgroundColor', 'lineHeight', 'letterSpacing', 'textAlign', 'whiteSpace', 'display', 'flexDirection', 'justifyContent', 'alignItems',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderRightWidth', 'borderRightStyle', 'borderRightColor', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor', 'borderLeftWidth', 'borderLeftStyle', 'borderLeftColor', 'borderRadius',
  'gridTemplateColumns', 'gridAutoRows', 'rowGap', 'columnGap'];

async function measure(tab, selectors) {
  return tab.evaluate((selectors, PROPS) => {
    const mm = (px) => +(px / 96 * 25.4).toFixed(2);
    return selectors.map((sel) => {
      const all = document.querySelectorAll(sel);
      return {
        sel,
        count: all.length,
        items: [...all].slice(0, 3).map((e) => {
          const s = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          const o = { w: mm(r.width), h: mm(r.height) };
          for (const k of PROPS) o[k] = s[k];
          // in RTL 'start' and 'right' are the same edge: the live page inherits globals.css text-align:right (dir=rtl body rules)
          // while the design says text-align:start on the same elements - same rendering, different keyword
          if (s.direction === 'rtl' && o.textAlign === 'start') o.textAlign = 'right';
          return o;
        }),
      };
    });
  }, selectors, PROPS);
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const report = {};
let bad = 0;
try {
  const dtab = await browser.newPage();
  await dtab.setViewport({ width: 1100, height: 1400 });
  await dtab.goto(pathToFileURL(DESIGN).href, { waitUntil: 'networkidle0', timeout: 60000 });
  for (const c of CASES) {
    // design side: its own builder, mounted in a clean container
    await dtab.evaluate((id, v) => {
      document.querySelectorAll('#cmp').forEach((e) => e.remove());
      const box = document.createElement('div');
      box.id = 'cmp';
      box.style.cssText = 'position:absolute;left:0;top:0;width:210mm;background:#fff;z-index:99999';
      document.body.appendChild(box);
      const p = PAGES.find((x) => x.id === id);
      const r = p.build(p, undefined, v || (p.variants ? p.variants[0].k : undefined));
      box.innerHTML = Array.isArray(r) ? r[0] : r;
    }, c.id, c.version);
    const d = await measure(dtab, c.pairs.map((p) => '#cmp ' + p[0]));
    const mtab = await browser.newPage();
    // built side under PRINT media at the printable width (A4 minus 12mm side margins = 186mm = 703px) - the on-screen preview differs by design (table padding is ignored in the collapsed shell table)
    await mtab.setViewport({ width: 703, height: 1400 });
    await mtab.emulateMediaType('print');
    await mtab.goto(pathToFileURL(path.join(OUT, c.name + '.html')).href, { waitUntil: 'networkidle0', timeout: 60000 });
    const m = await measure(mtab, c.pairs.map((p) => p[1]));
    await mtab.close();
    const diffs = [];
    const sizes = [];
    c.pairs.forEach((p, i) => {
      const a = d[i];
      const b = m[i];
      if (!a.count && !b.count) return;
      if (!a.count || !b.count) { diffs.push({ pair: p.join(' -> '), what: 'missing', design: a.count, built: b.count }); return; }
      const n = Math.min(a.items.length, b.items.length);
      for (let k = 0; k < n; k++) {
        for (const key of Object.keys(a.items[k])) {
          const va = a.items[k][key];
          const vb = b.items[k][key];
          if (String(va) === String(vb)) continue;
          if (key === 'w' || key === 'h') { sizes.push({ pair: p.join(' -> '), idx: k, prop: key, design: va, built: vb }); continue; }
          // a border colour is irrelevant when that border is not drawn (0 width)
          const side = (key.match(/^border(Top|Right|Bottom|Left)(Color|Style)$/) || [])[1];
          if (side && a.items[k]['border' + side + 'Width'] === '0px' && b.items[k]['border' + side + 'Width'] === '0px') continue;
          diffs.push({ pair: p.join(' -> '), idx: k, prop: key, design: va, built: vb });
        }
      }
    });
    report[c.name] = { diffs, sizeDiffsInfoOnly: sizes, pairs: c.pairs.length };
    const real = diffs.filter((x) => !ALLOW.has(x.pair + '|' + x.prop));
    bad += real.length;
    console.log((real.length ? 'DIFF ' : 'SAME ') + c.name.padEnd(8) + ' pairs=' + c.pairs.length + ' style-differences=' + real.length + ' (allow-listed ' + (diffs.length - real.length) + ', size-only info ' + sizes.length + ')');
    for (const x of real.slice(0, 60)) console.log('   ', JSON.stringify(x));
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'design-compare.json'), JSON.stringify(report, null, 2));
process.exit(bad ? 1 : 0);
