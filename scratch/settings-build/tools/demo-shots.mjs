import puppeteer from 'puppeteer-core';
const file = 'file:///C:/Users/moshe/Desktop/' + encodeURIComponent('גמח שמלות חדש') + '/' + encodeURIComponent('תצוגות-עיצוב') + '/' + encodeURIComponent('הגדרות-סימולציה.html');
const out = 'C:/Users/moshe/Desktop/wt-settings/scratch/settings-build/demo-shots/';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
for (const [w, h, tag] of [[1440, 900, 'desk'], [390, 844, 'mob']]) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.goto(file + '#sys', { waitUntil: 'networkidle0', timeout: 60000 }).catch(e => console.log('goto', e.message));
  await p.evaluate(() => { const c = document.querySelector('[data-rv-clean]'); if (c) c.click(); const q = document.getElementById('qp-host'); if (q) q.remove(); });
  await new Promise(r => setTimeout(r, 800));
  for (const [view, tabs] of [['sys', ['cfg', 'pay', 'ord', 'disp', 'unused']], ['site', ['db', 'sys', 'mail']], ['names', []]]) {
    await p.evaluate((v) => window.__sim && window.__sim.go(v), view);
    await new Promise(r => setTimeout(r, 400));
    const list = tabs.length ? tabs : [null];
    for (const t of list) {
      if (t) await p.evaluate((v, t) => { const b = document.querySelector(`[data-view="${v}"] .st-stab[data-tab="${t}"]`) ; if (b) b.click(); }, view, t);
      await new Promise(r => setTimeout(r, 300));
      await p.screenshot({ path: `${out}${tag}-${view}-${t || 'main'}.png`, fullPage: tag === 'desk' ? false : false });
    }
  }
  // dirty state
  await p.evaluate(() => window.__sim.go('sys'));
  await p.evaluate(() => { document.querySelector('[data-view="sys"] .st-stab[data-tab="cfg"]').click(); const i = document.querySelector('[data-view="sys"] .sw input'); i.click(); const t = document.querySelector('#f-p_gmach_address'); t.value = 'רחוב חדש 5'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: `${out}${tag}-sys-dirty.png` });
  await p.evaluate(() => window.__sim.go('site'));
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: `${out}${tag}-unsaved-dialog.png` });
  await p.close();
}
await b.close();
console.log('done');
