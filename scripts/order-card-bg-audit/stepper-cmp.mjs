// ציר האירוע (OcStepper) מול העיצוב המאושר: מצלם את #stepper בדגימה (מסירים את הסתרת שכבת הסקירה #stepper{display:none!important}, שורה 5231) ואת .stepper
// בכרטיס האמיתי (אותו תרחיש: משלוח הלוך-חזור, היום 24.9), משווה computed style לכל צומת ומצלם גם את הכרטיס העשיר. שימוש: node stepper-cmp.mjs [רוחב=1280] [תרחיש=neve]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const width = Number(process.argv[2] || 1280);
const scn = process.argv[3] || 'neve';
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const PROPS = ['backgroundColor', 'backgroundImage', 'color', 'borderTopColor', 'borderTopWidth', 'borderTopStyle', 'borderRadius', 'boxShadow', 'fontSize', 'fontWeight', 'width', 'height', 'paddingTop', 'paddingInline', 'marginTop', 'gap', 'display', 'flexDirection', 'gridTemplateColumns'];
const DUMP = (rootSel) => {
  const root = document.querySelector(rootSel);
  if (!root) return null;
  const pick = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); const o = { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; ['backgroundColor', 'backgroundImage', 'color', 'borderTopColor', 'borderTopWidth', 'borderTopStyle', 'borderRadius', 'boxShadow', 'fontSize', 'fontWeight', 'paddingTop', 'marginTop', 'display', 'flexDirection', 'gridTemplateColumns', 'animationName'].forEach((k) => { o[k] = String(cs[k]).replace(/ /g, '').slice(0, 90); }); const a = getComputedStyle(el, '::after'); o.afterBg = a.backgroundImage === 'none' ? a.backgroundColor : a.backgroundImage.replace(/ /g, '').slice(0, 120); o.afterW = a.width; o.afterTop = a.top; return o; };
  const out = { stepper: pick(root), tlx: pick(root.querySelector('.tlx')), nodes: [] };
  root.querySelectorAll('.tx').forEach((tx) => { out.nodes.push({ cls: tx.className.replace(/\b(fresh)\b/g, '').trim(), self: pick(tx), dot: pick(tx.querySelector('.dot')), ck: tx.querySelector('.ck') ? pick(tx.querySelector('.ck')) : null, b: pick(tx.querySelector('.tt b')), spans: [...tx.querySelectorAll('.tt span')].map(pick), today: tx.querySelector('.today') ? pick(tx.querySelector('.today .pinm')) : null, pin: tx.querySelector('.dot .pinm') ? pick(tx.querySelector('.dot .pinm')) : null, text: tx.querySelector('.tt').innerText.replace(/\s+/g, ' ') }); });
  return out;
};
const run = async (which) => {
  const b = await launch(); const p = await b.newPage();
  await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('PAGEERR', which, e.message));
  let s; if (which === 'real') s = await serve();
  const url = which === 'demo' ? DEMO : `http://127.0.0.1:${PORT}/?scn=${scn}`;
  await p.goto(url, { waitUntil: 'load', timeout: 90000 }); await sleep(2500);
  if (which === 'demo') {
    await p.evaluate(() => { document.documentElement.classList.add('pv-off'); const t = document.getElementById('demoTog'); if (t && t.getAttribute('aria-pressed') === 'true') t.click(); document.getElementById('stepper').style.setProperty('display', 'block', 'important'); document.querySelectorAll('body *').forEach((el) => { const pos = getComputedStyle(el).position; if ((pos === 'fixed' || pos === 'sticky') && !el.closest('#app,#rt,#tt')) el.style.setProperty('visibility', 'hidden', 'important'); }); });
    await sleep(900);
  }
  const sel = which === 'demo' ? '#stepper' : '.stepper#stepper';
  await p.waitForSelector(`${sel} .tx`, { timeout: 20000 });
  const d = await p.evaluate(DUMP, sel);
  const el = await p.$(sel); await el.scrollIntoView(); await sleep(300);
  await el.screenshot({ path: `${OUT}/stepper-${which}-${width}.png` });
  // כרטיס עשיר: ריחוף על הצומת השני
  const second = (await p.$$(`${sel} .tx`))[1]; const bb = await (await second.$('.dot')).boundingBox();
  await p.mouse.move(2, 2); await sleep(600); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(700);
  const rich = await p.evaluate((w) => { const el = w === 'demo' ? document.querySelector('#rt.on') : document.querySelector('.oc-portal .pl-rt.on'); if (!el) return null; const r = el.getBoundingClientRect(); return { rows: [...el.querySelectorAll('.rr1')].map((x) => x.innerText.trim()), side: el.dataset.side, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(el).backgroundColor, bd: getComputedStyle(el).borderTopColor }; }, which);
  await p.screenshot({ path: `${OUT}/stepper-${which}-${width}-rich.png`, clip: { x: 0, y: Math.max(0, bb.y - 220), width, height: 330 } });
  await b.close(); if (s) s.close();
  return { d, rich };
};
const demo = await run('demo'); const real = await run('real');
fs.writeFileSync(`${OUT}/stepper-${width}.json`, JSON.stringify({ demo, real }, null, 1));
const diffs = [];
const cmp = (path, a, b) => { if (!a || !b) { if (!!a !== !!b) diffs.push(`${path}: ${a ? 'only demo' : 'only real'}`); return; } for (const k of Object.keys(a)) if (!/^(x|y)$/.test(k) && a[k] !== b[k]) diffs.push(`${path}.${k}: demo=${a[k]} real=${b[k]}`); };
cmp('stepper', demo.d.stepper, real.d.stepper); cmp('tlx', demo.d.tlx, real.d.tlx);
console.log('nodes demo', demo.d.nodes.length, 'real', real.d.nodes.length);
demo.d.nodes.forEach((n, i) => { const r = real.d.nodes[i]; if (!r) return; console.log(i, 'demo:', n.cls, '|', n.text, '   real:', r.cls, '|', r.text); ['self', 'dot', 'ck', 'b', 'today', 'pin'].forEach((k) => cmp(`node${i}.${k}`, n[k], r[k])); n.spans.forEach((sp, j) => cmp(`node${i}.span${j}`, sp, r.spans[j])); });
console.log('rich demo', JSON.stringify(demo.rich)); console.log('rich real', JSON.stringify(real.rich));
console.log(diffs.length ? diffs.join('\n') : 'NO STYLE DIFFS');
