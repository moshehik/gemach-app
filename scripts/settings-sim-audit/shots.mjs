// צילומי מסך של מסכי ההגדרות האמיתיים (dist/ — אחרי build.mjs) בכל לשונית, ב-1440 וב-390, + שגיאות קונסול.
// שימוש: node scripts/settings-sim-audit/shots.mjs   → scripts/settings-sim-audit/out/*.png
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT } from './lib.mjs';

const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const server = await serve();
const browser = await launch();
const errors = [];
const only = process.argv[2] || '';
try {
  for (const [w, h, tag] of [[1440, 900, 'desk'], [390, 844, 'mob']]) {
    for (const view of ['sys', 'site', 'names']) {
      if (only && only !== view) continue;
      const p = await browser.newPage();
      p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}/${view}: ${m.text()}`); });
      p.on('pageerror', (e) => errors.push(`${tag}/${view}: PAGEERROR ${e.message}`));
      await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await p.goto(`http://127.0.0.1:${PORT}/index.html?view=${view}`, { waitUntil: 'networkidle0' });
      await sleep(600);
      const tabs = await p.$$eval(tag === 'desk' ? '.st-stab' : '.st-toptabs .tab', (b) => b.map((x) => x.getAttribute('data-tab')));
      for (const t of tabs) {
        await p.evaluate((sel) => { const b = document.querySelector(sel); if (b) b.click(); window.scrollTo(0, 0); }, `${tag === 'desk' ? '.st-stab' : '.st-toptabs .tab'}[data-tab="${t}"]`);
        await sleep(250);
        await p.screenshot({ path: path.join(OUT, `${tag}-${view}-${t}.png`), fullPage: true });
      }
      await p.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
