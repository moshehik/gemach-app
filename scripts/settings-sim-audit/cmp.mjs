// השוואת סגנון מחושב: מסך ההגדרות האמיתי (dist/) מול העיצוב (הגדרות-סימולציה.html), לפי רכיב, ברוחב נתון.
// שימוש: node scripts/settings-sim-audit/cmp.mjs [רוחב=1440] [view=sys] [tab=pay] [state=rest|dirty]
// מדפיס לכל בורר את המאפיינים ששונים (רקע, צבע, גבול, רדיוס, גופן, ריפוד, גובה, צל). שורה שאין בצד אחד — "missing".
import { serve, launch, sleep, PORT, DEMO } from './lib.mjs';

const [width = '1440', view = 'sys', tab = 'pay', state = 'rest'] = process.argv.slice(2);
const SEL = [
  '.st-sidenav', '.st-stab.on', '.st-stab:not(.on)', '.st-stab.on .st-sic .ic', '.st-stab .st-slb',
  '.layout', '.rail', '.st-main', '.panel.on',
  '.st-card .adm-h', '.adm-hi', '.st-card .card.adm-rows', '.st-row', '.st-row .ic-b', '.st-row .t', '.st-lb', '.st-row .t small', '.st-row .tip',
  '.st-ctl', '.st-ctl input.inp[type=text]', '.st-ctl textarea.inp', '.sw', '.sw i', '.numw', '.numw .numb', '.numw .inp',
  '.seg.pill', '.seg.pill button.on', '.seg.pill button:not(.on)', '.sizes.st-wide-btn button.on', '.sizes.st-wide-btn button:not(.on)',
  '.st-opts', '.st-opts .opt.on', '.st-opts .opt:not(.on)', '.timew', '.timew .inp',
  '.topbar', '.back', '.pg-ttl', '.pg-ttl small', '.st-bar', '.st-bar .hf-s', '.st-bar .hf-s input',
  '.st-chgs', '.st-chgh', '.st-chglist .cl', '.st-chgact .btn.primary', '.st-chgact .btn.ghost', '.st-chg',
];
const PROPS = ['display', 'background-color', 'background-image', 'color', 'border-top-color', 'border-top-width', 'border-top-style', 'border-radius', 'font-size', 'font-weight', 'font-family', 'padding-top', 'padding-inline-start', 'height', 'width', 'box-shadow', 'gap', 'margin-top', 'opacity', 'grid-template-columns'];

async function collect(page) {
  return page.evaluate((SEL, PROPS) => {
    const out = {};
    for (const s of SEL) {
      const els = [...document.querySelectorAll(s)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !e.closest('#rvBar,.rv,#qp-host,[hidden]');
      });
      const view = document.querySelector('.st-view:not([hidden])') || document;
      const e = els.find((x) => view.contains(x));
      if (!e) { out[s] = null; continue; }
      const cs = getComputedStyle(e);
      out[s] = Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)]));
    }
    return out;
  }, SEL, PROPS);
}

const server = await serve();
const browser = await launch();
try {
  const w = Number(width);
  const demo = await browser.newPage();
  await demo.setViewport({ width: w, height: 900 });
  await demo.goto(DEMO + '#' + view, { waitUntil: 'networkidle0' });
  await demo.evaluate((v, t, st) => {
    if (v !== 'sys') { const r = document.querySelector('[data-rv-role="dev"]'); if (r) r.click(); }
    const q = document.getElementById('qp-host'); if (q) q.remove();
    window.__sim.go(v);
    const root = document.querySelector(`[data-view="${v}"]`);
    const b = root.querySelector(`.st-stab[data-tab="${t}"]`) || root.querySelector(`.tab[data-tab="${t}"]`); if (b) b.click();
    if (st === 'dirty') { const i = root.querySelector('.panel.on .sw input'); if (i) i.click(); }
  }, view, tab, state);
  await sleep(700);
  const real = await browser.newPage();
  await real.setViewport({ width: w, height: 900 });
  await real.goto(`http://127.0.0.1:${PORT}/index.html?view=${view}`, { waitUntil: 'networkidle0' });
  await sleep(500);
  await real.evaluate((t, st) => {
    const b = document.querySelector(`.st-stab[aria-controls$="-${t}"]`) || document.querySelector(`.st-toptabs .tab[aria-controls$="-${t}"]`); if (b) b.click();
    if (st === 'dirty') setTimeout(() => { const i = document.querySelector('.panel.on .sw input'); if (i) i.click(); }, 50);
  }, tab, state);
  await sleep(700);
  const a = await collect(demo);
  const b = await collect(real);
  let n = 0;
  for (const s of SEL) {
    if (!a[s] && !b[s]) continue;
    if (!a[s] || !b[s]) { console.log(`${s}: missing in ${a[s] ? 'REAL' : 'DEMO'}`); n++; continue; }
    const diffs = PROPS.filter((p) => a[s][p] !== b[s][p]).map((p) => `  ${p}: demo=${a[s][p]} | real=${b[s][p]}`);
    if (diffs.length) { console.log(s); console.log(diffs.join('\n')); n += diffs.length; }
  }
  console.log(`\n${n} differences (${width}px, ${view}/${tab}/${state})`);
} finally {
  await browser.close();
  server.close();
}
