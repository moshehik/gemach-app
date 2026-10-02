// Reference extractor for group 3 (PP-07, 10, 11, 12, 18): loads the APPROVED design page in headless Chrome, dumps the sample
// data it uses (ORD / dresses / repairs) to fixtures/ppg3-design-sample.json and screenshots the design sheets + measures them
// (out/design-<id>.png, out/design-metrics.json), so the real templates can be rendered from the SAME data and compared.
//   node scripts/schedule-print-tests/ppg3-design-ref.mjs [path-to-design.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(PROJ, 'package.json'));
const puppeteer = require('puppeteer-core');
const design = process.argv[2] || 'C:/Users/moshe/Desktop/גמח שמלות חדש/תצוגות-עיצוב/סיימתי-לעבוד/דפי-הדפסה-עיצוב.html';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const metrics = {};
try {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1000, height: 1300 });
  await tab.goto(pathToFileURL(design).href, { waitUntil: 'networkidle0', timeout: 60000 });
  const sample = await tab.evaluate(() => ({
    day: DAY,
    ord: ORD.map((o) => ({ ...o, dresses: dresses(o).map((d, k) => ({ ...d, rep: repOf(o.i, k), repTxt: repTxt(repOf(o.i, k)) })) })),
  }));
  fs.writeFileSync(path.join(HERE, 'fixtures', 'ppg3-design-sample.json'), JSON.stringify(sample, null, 1));
  const wanted = [['07', 'a'], ['07', 'b'], ['10'], ['11'], ['12'], ['18']];
  for (const [id, v] of wanted) {
    const name = `design-${id}${v ? v : ''}`;
    const count = await tab.evaluate((id, v) => {
      const sheets = pageSheets(id, undefined, v);
      let host = document.getElementById('cmp');
      if (!host) { host = document.createElement('div'); host.id = 'cmp'; host.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;background:#888'; document.body.appendChild(host); }
      host.innerHTML = sheets.map((h) => '<div class="cmp-s" style="margin-bottom:10px">' + h + '</div>').join('');
      return sheets.length;
    }, id, v);
    const els = await tab.$$('#cmp .sheet');
    for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(OUT, `${name}${count > 1 ? '-' + (i + 1) : ''}.png`) });
    metrics[name] = await tab.evaluate(() => [...document.querySelectorAll('#cmp .sheet')].map((s) => {
      const q = (sel) => s.querySelector(sel);
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
      const rowsH = [...s.querySelectorAll('.sh-body .t tbody tr')].map((tr) => +tr.getBoundingClientRect().height.toFixed(1));
      const ths = [...s.querySelectorAll('.sh-body .t thead th')].map((th) => +th.getBoundingClientRect().width.toFixed(1));
      const cs = (el, p) => (el ? getComputedStyle(el)[p] : null);
      return {
        h1: cs(q('.sh-tb h1'), 'fontSize'), tbH: r(q('.sh-tb'))?.h, headH: r(q('.sh-head'))?.h, rowsH, thW: ths,
        td: cs(q('.sh-body .t tbody td'), 'paddingTop'), tdFont: cs(q('.sh-body .t tbody td'), 'fontSize'),
        dn: r(q('.dn')), nm: cs(q('.dn .nm'), 'fontSize'), ad: cs(q('.dn .ad'), 'fontSize'),
      };
    }));
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'design-metrics.json'), JSON.stringify(metrics, null, 1));
console.log('ok', Object.keys(metrics).join(','));
