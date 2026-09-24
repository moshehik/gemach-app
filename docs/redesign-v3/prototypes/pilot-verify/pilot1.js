const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch(); const log = [];
  for (const w of [360, 768, 1024, 1440]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('http://127.0.0.1:8765/index.html?profile=org2'); await p.waitForTimeout(1200);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log.push(`${w} overflowX=${ov} errors=${JSON.stringify(errs.slice(0, 3))}`);
    await p.screenshot({ path: `pshots/${w}-details.png`, fullPage: true });
    await p.close();
  }
  console.log(log.join('\n')); await b.close();
})();
