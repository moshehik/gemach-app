#!/usr/bin/env node
/* =============================================================================
   parity-check.cjs — proves every prototype's shared components look AND move
   exactly like the order-card sketch (CONSTITUTION C-1.15 / C-1.16, scorecard S14/S15).

   Setup (once):  cd <any scratch dir> && npm i --no-save playwright
   Run:           PW=<that dir>/node_modules/playwright node docs/redesign-v3/prototypes/tools/parity-check.cjs [--only=archetype-list] [--shots] [--motion]
   Chromium:      /opt/pw-browsers/chromium-NNNN/chrome-linux/chrome (auto-detected)

   What it does, per prototype × width (1440, 1024, 390):
   1. STYLE parity — opens the sketch and the prototype, probes the first visible element of each
      shared component and compares computed styles + box size (numbers ±0.5px, strings exact).
   2. MOTION parity — for each component reads animation-name/duration/timing-function/iteration-count
      and transition-property/duration/timing-function in the states: initial, hover (page.hover),
      on/active (the selected tab / open item) and entering (read synchronously right after the
      element is (re)inserted: tab switch → .panel, openDlg → #dlg, row expand → .hfe).
   3. FIELD LAYOUT (C-1.16) — in every form state no two visible inputs/selects/textareas share a
      vertical band.
   4. STATIC checks — @media widths in the allowed set (±1), physical CSS properties, horizontal
      overflow at 360/768/1024/1440, WCAG AA text contrast (sampled).
   5. --shots: side-by-side region screenshots (top bar, rail, tabs, history) → screenshots/parity/
      --motion: frame sequences (0/150/300/600ms) sketch vs customer card → screenshots/parity/motion/
   Output: console tables + tools/parity-results.json (read by PARITY-REPORT.md).
   ============================================================================= */
const fs = require('fs'), path = require('path');
const PW = process.env.PW || 'playwright';
const { chromium } = require(PW);
const ROOT = path.join(__dirname, '..');
const SKETCH = 'file://' + path.join(ROOT, '..', 'sketch', 'order-card-sketch-B.html');
const exe = (() => { const d = '/opt/pw-browsers'; try { const c = fs.readdirSync(d).find(x => /^chromium-\d+$/.test(x)); return c ? path.join(d, c, 'chrome-linux', 'chrome') : undefined; } catch { return undefined; } })();
const ALL = ['archetype-detail-card', 'archetype-board', 'archetype-wizard', 'archetype-list', 'archetype-dashboard', 'archetype-touch', 'archetype-forms'];
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const PROTOS = arg('only') ? [arg('only').replace(/\.html$/, '')] : ALL;
const WIDTHS = [1440, 1024, 390];
const SHOTS = process.argv.includes('--shots'), MOTION = process.argv.includes('--motion');

/* ---------- component probes: selector → computed props ---------- */
const BOX = ['height', 'padding-top', 'padding-inline-start', 'border-top-width', 'border-top-left-radius', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'background-image', 'border-top-color', 'box-shadow', 'gap'];
const MOT = ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count', 'transition-property', 'transition-duration', 'transition-timing-function'];
const C = [
  // [id, selector, props, compareBoxHeight, hoverable]
  ['page html', 'html', ['background-color', 'background-image'], 0],
  ['page body', 'body', ['background-color', 'background-image', 'font-family', 'font-size', 'line-height', 'color'], 0],
  ['app container', '.app', ['max-width', 'padding-top', 'padding-inline-start'], 0],
  ['top bar', '.snav', ['height', 'padding-inline-start', 'gap', 'background-image', 'border-bottom-color', 'box-shadow', 'position'], 1],
  ['top bar brand', '.sn-name', ['font-size', 'font-weight', 'color'], 1],
  ['top bar mark', '.sn-mark', ['width', 'height', 'border-top-left-radius', 'background-image'], 1],
  ['top bar menu item', '.sn-nav .sn-tab', BOX, 1, 1],
  ['top bar icon btn', '.sn-ib', ['width', 'height', 'border-top-left-radius', 'color'], 1, 1],
  ['top bar clock', '.sn-clock', ['height', 'font-size', 'font-weight', 'background-color'], 1],
  ['top bar user', '.sn-user', BOX, 1, 1],
  ['top bar burger', '.sn-burger', ['width', 'height', 'display'], 1],
  ['title back', '.app .topbar .back', ['width', 'height', 'border-top-left-radius', 'background-image', 'border-top-width', 'border-top-color'], 1, 1],
  ['title h1', '.app .topbar .ttl h1', ['font-size', 'font-weight', 'color'], 0],
  ['tabs bar', '.tabs', ['padding-top', 'gap', 'border-top-left-radius', 'background-color'], 1],
  ['tab', '.tabs .tab:not(.on)', BOX, 1, 1],
  ['tab (on)', '.tabs .tab.on', BOX, 1],
  ['tab marker', '.tabmk', ['width', 'height', 'border-top-left-radius'], 1],
  ['panel', '.panel.on', ['gap', 'margin-top', 'animation-name', 'animation-duration'], 0],
  ['card', '.card:not(.hist):not(.cust)', ['padding-top', 'padding-inline-start', 'border-top-width', 'border-top-color', 'border-top-left-radius', 'background-color', 'box-shadow'], 0],
  ['card header h2', '.card-h h2', ['font-size', 'font-weight', 'color'], 0],
  ['card header icon', '.card-h .ico', ['width', 'height', 'border-top-left-radius'], 1],
  ['label/value row', '.kv .f:not(:last-child)', ['padding-top', 'gap', 'border-bottom-color'], 0],
  ['label/value label', '.kv .f small', ['font-size', 'color'], 0],
  ['label/value value', '.kv .f b', ['font-size', 'font-weight', 'color'], 0],
  ['button', '.app .btn:not(.primary):not(.ghost):not(.sm):not(.lg):not(:disabled)', BOX, 1, 1],
  ['button primary', '.app .btn.primary:not(:disabled)', BOX, 0, 1],
  ['button ghost', '.app .btn.ghost:not(:disabled)', BOX, 0, 1],
  ['button sm', '.app .btn.sm:not(:disabled)', BOX, 1, 1],
  ['button lg', '.app .btn.lg:not(:disabled)', BOX, 0, 1],
  ['icon button', '.app .ibtn', ['width', 'height', 'border-top-left-radius', 'background-image', 'border-top-color'], 1, 1],
  ['info tip', '.app .tip:not(.pinm)', ['width', 'height', 'color'], 1, 1],
  ['field input', '.app .inp:not(textarea)', ['height', 'padding-top', 'border-top-width', 'border-top-color', 'border-top-left-radius', 'font-size', 'background-color'], 0],
  ['field label', '.app label.lbl', ['font-size', 'font-weight', 'color', 'margin-bottom'], 0],
  ['segmented', '.seg', ['padding-top', 'gap', 'border-top-left-radius', 'background-color'], 0],
  ['switch', '.sw', ['width', 'height'], 1],
  ['item row', '.itm:not(.hfe)', ['border-top-width', 'border-top-color', 'border-top-left-radius', 'background-color', 'box-shadow'], 0],
  ['item thumb', '.itm .thumb', ['width', 'height', 'border-top-left-radius'], 1],
  ['list row', '.li', ['padding-top', 'gap', 'border-bottom-color'], 0],
  ['rail card', '.rcard', ['padding-top', 'border-top-left-radius', 'background-color', 'color', 'box-shadow'], 0],
  ['rail heading', '.sec-h', ['font-size', 'font-weight', 'color', 'padding-bottom', 'animation-name'], 0],
  ['rail tile', '.gl:not(.sig):not(.pay)', ['height', 'min-height', 'padding-top', 'padding-inline-start', 'border-top-left-radius', 'font-size', 'font-weight', 'background-color', 'color'], 1],
  ['rail change row', '.cl', ['padding-top', 'gap', 'border-top-color'], 0],
  ['rail cart title', '.cart-t b', ['font-size', 'font-weight', 'color'], 0],
  ['status tag', '.tag', ['height', 'padding-inline-start', 'border-top-left-radius', 'font-size', 'font-weight'], 1],
  ['history card', '.card.hist', ['padding-top', 'border-top-left-radius'], 0],
  ['history search', '.hf-s', ['height', 'border-top-left-radius', 'border-top-color'], 1],
  ['history filter btn', '.hf-t', ['height', 'font-size', 'font-weight', 'border-top-left-radius'], 1],
  ['history day header', '.hday', ['padding-top', 'padding-inline-start', 'border-top-left-radius', 'border-inline-start-width', 'background-color', 'margin-bottom'], 0],
  ['history day title', '.hday b', ['font-size', 'font-weight', 'color'], 0],
  ['history entry', '.hfe', ['border-top-color', 'border-top-left-radius', 'animation-name', 'animation-duration', 'animation-timing-function'], 0],
  ['history entry icon', '.hfe .thumb', ['width', 'height', 'border-top-left-radius'], 1],
  ['history entry text', '.hfe .model', ['font-size', 'font-weight'], 0],
  ['history group gap', '.hgrp', ['gap'], 0],
  ['table head', '.tbl th', ['padding-top', 'padding-inline-start', 'font-size', 'font-weight', 'color', 'background-color'], 0],
  ['table cell', '.tbl td', ['padding-top', 'padding-inline-start', 'font-size', 'color', 'border-bottom-color'], 0],
  ['timeline', '.stepper', ['padding-top', 'border-top-left-radius', 'background-image'], 0],
  ['timeline node', '.tx .dot', ['width', 'height', 'border-top-width'], 1],
];
const TABLE_REF = 'archetype-list'; /* the sketch has no table: tables are compared against this prototype (consistency) */

const probeFn = (list) => {
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.demo,#demoMenu,[hidden]'); };
  const out = {};
  for (const [id, sel, props, box] of list) {
    let el = null; try { el = [...document.querySelectorAll(sel)].find(vis); } catch { }
    if (!el) { out[id] = null; continue; }
    const cs = getComputedStyle(el), o = {};
    props.forEach(p => { let v = cs.getPropertyValue(p); if (p === 'font-family') v = v.split(',')[0].replace(/["']/g, '').trim(); o[p] = v; });
    if (box) { const r = el.getBoundingClientRect(); o['box.height'] = Math.round(r.height * 2) / 2; }
    out[id] = o;
  }
  return out;
};
const motionFn = (sel) => { const e = [...document.querySelectorAll(sel)].find(x => x.getBoundingClientRect().width > 0); if (!e) return null; const cs = getComputedStyle(e); const o = {}; ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count', 'transition-property', 'transition-duration', 'transition-timing-function'].forEach(p => o[p] = cs.getPropertyValue(p)); return o; };

const num = v => { const m = String(v).match(/^-?\d*\.?\d+(px)?$/); return m ? parseFloat(v) : null; };
function cmp(a, b) { if (a === b) return true; const x = num(a), y = num(b); if (x != null && y != null) return Math.abs(x - y) <= 0.5; return false; }

async function prep(p, url, w) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.goto(url); await p.waitForTimeout(900);
  await p.addStyleTag({ content: '*{caret-color:transparent!important}' });
}
async function openHistory(p) {
  return p.evaluate(() => { const t = [...document.querySelectorAll('.tabs .tab,[role=tab]')].find(x => /היסטוריה/.test(x.textContent)); if (t) { t.click(); return true; } return false; });
}
async function probeAll(p) {
  const base = await p.evaluate(probeFn, C);
  const hadHist = await openHistory(p); await p.waitForTimeout(450);
  const hist = await p.evaluate(probeFn, C.filter(c => /^history/.test(c[0])));
  Object.keys(hist).forEach(k => { if (hist[k]) base[k] = hist[k]; });
  return base;
}

async function motionStates(p) {
  const m = {};
  // initial + hover for hoverables
  for (const [id, sel, , , hov] of C) {
    if (!hov) continue;
    const init = await p.evaluate(motionFn, sel); if (!init) continue;
    let hover = null;
    try { const loc = p.locator(sel).filter({ visible: true }).first(); await loc.hover({ timeout: 800, force: true }); await p.waitForTimeout(40); hover = await p.evaluate(motionFn, sel); await p.mouse.move(1, 899); } catch { }
    m[id] = { initial: init, hover };
  }
  // entering: tab switch → the newly shown panel
  m['panel (entering)'] = { entering: await p.evaluate(() => { const tabs = [...document.querySelectorAll('.tabs .tab:not(.on)')]; if (!tabs.length) return null; tabs[0].click(); const pn = document.querySelector('.panel.on'); if (!pn) return null; const cs = getComputedStyle(pn); return { 'animation-name': cs.animationName, 'animation-duration': cs.animationDuration, 'animation-timing-function': cs.animationTimingFunction }; }) };
  m['tab (on)'] = { on: await p.evaluate(motionFn, '.tabs .tab.on') };
  // dialog open (shared openDlg in both pages)
  m['dialog (entering)'] = { entering: await p.evaluate(() => { if (typeof openDlg !== 'function') return null; openDlg('<h2>בדיקה</h2><div class="sub">x</div><div class="dbtns"><button class="btn primary lg block">א</button></div>'); const d = document.querySelector('#dlg'); const s = document.querySelector('#scrim'); const cd = getComputedStyle(d), csr = getComputedStyle(s); const r = { dlg: cd.animationName + ' ' + cd.animationDuration + ' ' + cd.animationTimingFunction, scrim: csr.animationName + ' ' + csr.animationDuration }; closeDlg(); return r; }) };
  // history row expand
  await openHistory(p); await p.waitForTimeout(400);
  m['history entry (expand)'] = { on: await p.evaluate(() => { const e = document.querySelector('.hfe'); if (!e) return null; e.click(); const w = e.querySelector('.det-wrap'); const cs = getComputedStyle(w); return { 'transition-property': cs.transitionProperty, 'transition-duration': cs.transitionDuration, 'transition-timing-function': cs.transitionTimingFunction }; }) };
  // toast
  m['toast (entering)'] = { entering: await p.evaluate(() => { if (typeof toast !== 'function') return null; toast('info', 'בדיקה', ''); const t = document.querySelector('#toast'); const cs = getComputedStyle(t); const r = { 'transition-property': cs.transitionProperty, 'transition-duration': cs.transitionDuration, 'transition-timing-function': cs.transitionTimingFunction }; t.classList.remove('on'); return r; }) };
  return m;
}

/* keyframes bound on this page = @keyframes whose binding rule selector matches an element present */
const keyframeUse = () => {
  const names = new Set(), bound = new Set();
  const walk = rules => { for (const r of rules) { if (r.type === 7) names.add(r.name); if (r.cssRules && r.type !== 7) walk(r.cssRules); if (r.style && r.selectorText) { const an = (r.style.animationName || '') + ' ' + (r.style.animation || '') + ' ' + (r.style.getPropertyValue('--ia-a') || '') + ' ' + (r.style.getPropertyValue('--dk') || ''); if (!an.trim()) continue; const sel = r.selectorText.replace(/:(hover|focus-visible|focus|active|focus-within|is\([^)]*\)|where\([^)]*\)|not\(#_\))/g, '').replace(/::?(before|after)/g, ''); let hit = false; try { hit = !!document.querySelector(sel || '*'); } catch { hit = false; } if (hit) an.split(/[\s,]+/).forEach(x => bound.add(x)); } } };
  for (const s of document.styleSheets) { try { walk(s.cssRules); } catch { } }
  return { names: [...names], bound: [...names].filter(n => bound.has(n)) };
};

/* C-1.16 */
const fieldOverlap = () => {
  const els = [...document.querySelectorAll('input,select,textarea')].filter(e => { if (/^(checkbox|radio|hidden|file)$/.test(e.type)) return false; if (e.closest('.demo,.snav,.sn-drawer,.hf-bar,.sn-panel,.acodes,.amtin,.scan')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
  const bad = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect(); if (a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push((els[i].id || els[i].name || els[i].tagName) + '|' + (els[j].id || els[j].name || els[j].tagName)); }
  return { n: els.length, bad };
};
/* per-prototype actions that open form states (added as prototypes expose them) */
const FORM_STATES = {
  'archetype-detail-card': [
    ['details edit', async p => { await p.click('#editBtn'); }],
    ['bank form', async p => { await p.click('#t-refunds'); }],
    ['new customer', async p => { await p.evaluate(() => { const s = document.querySelector('#dMode'); s.value = 'new'; s.dispatchEvent(new Event('change')); }); }],
    ['new customer (errors)', async p => { await p.evaluate(() => { const s = document.querySelector('#dMode'); s.value = 'new'; s.dispatchEvent(new Event('change')); }); await p.click('#newForm [type=submit]'); }],
    ['mail dialog', async p => { await p.evaluate(() => emailDlg()); }],
  ],
};
try { Object.assign(FORM_STATES, require('./parity-forms.cjs')); } catch { }
const genericForms = async p => { /* every visible form/fcol after clicking each tab */ const out = []; const n = await p.evaluate(() => document.querySelectorAll('.tabs .tab').length); for (let i = 0; i < n; i++) { await p.evaluate(i => document.querySelectorAll('.tabs .tab')[i].click(), i); await p.waitForTimeout(200); out.push(['tab ' + (i + 1), await p.evaluate(fieldOverlap)]); } return out; };

/* static */
function staticChecks(file) {
  const h = fs.readFileSync(file, 'utf8');
  const shell = (h.match(/<style id="v3-shell-css">([\s\S]*?)<\/style>/) || [, ''])[1];
  const page = h.replace(/<!-- V3-SHELL:CSS[\s\S]*?\/V3-SHELL:CSS -->/, '');
  const pageCss = [...page.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const OK = new Set([480, 640, 768, 1024, 1440, 1920].flatMap(n => [n, n - 1, n + 1]));
  const mq = css => [...css.matchAll(/@media[^{]*?(\d{3,5})px/g)].map(m => +m[1]).filter(n => n !== 99999);
  const badMq = css => [...new Set(mq(css).filter(n => !OK.has(n)))];
  const PH = /(^|[;{\s])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)/g;
  const phys = css => (css.match(PH) || []).length;
  return { pageMediaBad: badMq(pageCss), shellMediaBad: badMq(shell), pagePhysical: phys(pageCss), shellPhysical: phys(shell), shellSha: (h.match(/V3-SHELL:CSS (v\d+ sha:\w+)/) || [, 'NO SHELL'])[1] };
}
const overflowAt = async (p) => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const contrastFn = () => {
  const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(x => { x = +x / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const alpha = c => { const m = c.match(/[\d.]+/g); return m && m.length > 3 ? +m[3] : 1; };
  const bgOf = e => { while (e) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; if (alpha(cs.backgroundColor) > .9) return cs.backgroundColor; e = e.parentElement; } return 'rgb(220,237,250)'; };
  const bad = []; let n = 0;
  document.querySelectorAll('.app *, .snav *').forEach(e => { if (!e.childNodes.length || ![...e.childNodes].some(t => t.nodeType === 3 && t.textContent.trim())) return; const r = e.getBoundingClientRect(); if (!r.width || e.closest('[disabled],.demo,[aria-hidden=true]')) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < .9) return; const bg = bgOf(e); if (!bg) return; const L1 = lum(cs.color), L2 = lum(bg); if (L1 == null || L2 == null) return; n++; const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700); if (ratio < (large ? 3 : 4.5)) bad.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${e.textContent.trim().slice(0, 20)}" ${ratio.toFixed(2)}`); });
  return { sampled: n, bad: bad.slice(0, 8), badCount: bad.length };
};

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const ctx = await b.newContext({ reducedMotion: 'no-preference' });
  const p = await ctx.newPage();
  const res = { generated: new Date().toISOString(), widths: WIDTHS, protos: {} };
  // sketch reference
  const ref = {}, refMot = {};
  for (const w of WIDTHS) { await prep(p, SKETCH, w); ref[w] = await probeAll(p); if (w === 1440) { await prep(p, SKETCH, w); refMot[w] = await motionStates(p); } }
  let tableRef = {};
  for (const name of PROTOS) {
    const file = path.join(ROOT, name + '.html'); if (!fs.existsSync(file)) continue;
    const url = 'file://' + file; const R = { style: {}, motion: {}, fields: [], overflow: {}, static: staticChecks(file), errors: [] };
    const errs = []; p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push(e.message));
    for (const w of WIDTHS) {
      await prep(p, url, w); const got = await probeAll(p); const rows = [];
      if (name === TABLE_REF) tableRef[w] = { 'table head': got['table head'], 'table cell': got['table cell'] };
      for (const [id] of C) {
        const isTbl = /^table/.test(id); const want = isTbl ? (tableRef[w] || {})[id] : ref[w][id], have = got[id];
        if (!want || !have) { rows.push({ id, status: !have ? 'n/a (not on page)' : 'n/a (not in sketch)', diffs: [] }); continue; }
        const diffs = Object.keys(want).filter(k => k in have && !cmp(want[k], have[k])).map(k => ({ k, sketch: want[k], proto: have[k] }));
        rows.push({ id, status: diffs.length ? 'FAIL' : 'PASS', diffs, values: have });
      }
      R.style[w] = rows;
      R.overflow[w] = await overflowAt(p);
    }
    for (const w of [360, 768]) { await prep(p, url, w); R.overflow[w] = await overflowAt(p); }
    // motion @1440
    await prep(p, url, 1440); const mm = await motionStates(p); const mrows = [];
    for (const k of Object.keys(mm)) { const a = refMot[1440][k], h = mm[k]; if (!a || !h) { mrows.push({ id: k, status: 'n/a', diffs: [] }); continue; }
      const diffs = []; for (const st of Object.keys(a)) { if (!a[st] || !h[st]) continue; for (const q of Object.keys(a[st])) if (String(a[st][q]) !== String(h[st][q])) diffs.push({ k: st + '.' + q, sketch: a[st][q], proto: h[st][q] }); }
      mrows.push({ id: k, status: diffs.length ? 'FAIL' : 'PASS', diffs, values: h }); }
    R.motion = mrows;
    await prep(p, url, 1440); R.keyframes = await p.evaluate(keyframeUse);
    R.contrast = await p.evaluate(contrastFn);
    // fields (C-1.16)
    for (const w of WIDTHS) {
      await prep(p, url, w); R.fields.push({ w, state: 'default', ...(await p.evaluate(fieldOverlap)) });
      for (const [st, r] of await genericForms(p)) R.fields.push({ w, state: st, ...r });
      for (const [st, fn] of (FORM_STATES[name] || [])) { await prep(p, url, w); try { await fn(p); await p.waitForTimeout(350); R.fields.push({ w, state: st, ...(await p.evaluate(fieldOverlap)) }); } catch (e) { R.fields.push({ w, state: st, n: 0, bad: [], error: String(e.message).slice(0, 80) }); } }
    }
    R.errors = [...new Set(errs)];
    res.protos[name] = R;
    // console summary
    const tally = w => { const r = R.style[w]; return `${r.filter(x => x.status === 'PASS').length} PASS / ${r.filter(x => x.status === 'FAIL').length} FAIL / ${r.filter(x => /^n\/a/.test(x.status)).length} n/a`; };
    console.log(`\n=== ${name}  (${R.static.shellSha}) ===`);
    WIDTHS.forEach(w => { console.log(`  style @${w}: ${tally(w)}`); R.style[w].filter(x => x.status === 'FAIL').forEach(x => console.log(`    ✗ ${x.id}: ` + x.diffs.map(d => `${d.k} sketch=${d.sketch} proto=${d.proto}`).join(' ; '))); });
    console.log(`  motion: ${mrows.filter(x => x.status === 'PASS').length} PASS / ${mrows.filter(x => x.status === 'FAIL').length} FAIL / ${mrows.filter(x => x.status === 'n/a').length} n/a`);
    mrows.filter(x => x.status === 'FAIL').forEach(x => console.log(`    ✗ ${x.id}: ` + x.diffs.map(d => `${d.k} sketch=${d.sketch} proto=${d.proto}`).join(' ; ')));
    const fb = R.fields.filter(f => f.bad.length); console.log(`  fields one-per-line: ${fb.length ? 'FAIL ' + fb.map(f => `${f.w}/${f.state}:${f.bad.slice(0, 2).join(',')}`).join(' ; ') : 'PASS'} (${R.fields.length} state×width checks)`);
    console.log(`  overflow: ` + Object.entries(R.overflow).map(([w, o]) => `${w}:${o.sw <= o.cw ? 'ok' : 'OVERFLOW ' + o.sw}`).join(' '));
    console.log(`  static: page @media bad=${JSON.stringify(R.static.pageMediaBad)} shell @media bad=${JSON.stringify(R.static.shellMediaBad)} page physical=${R.static.pagePhysical} shell physical=${R.static.shellPhysical}`);
    console.log(`  contrast: ${R.contrast.badCount} below AA of ${R.contrast.sampled} sampled ${R.contrast.bad.slice(0, 3).join(' | ')}`);
    console.log(`  keyframes bound ${R.keyframes.bound.length}/${R.keyframes.names.length}; page errors: ${R.errors.length ? R.errors.join(' | ') : 'none'}`);
  }
  if (SHOTS) {
    const D = path.join(ROOT, 'screenshots', 'parity'); fs.mkdirSync(D, { recursive: true });
    const REG = [['topbar', '.snav'], ['tabs', '.tabs'], ['rail', '.rail .rcard'], ['history', '.card.hist']];
    for (const [nm, url] of [['sketch', SKETCH], ...PROTOS.map(n => [n.replace('archetype-', ''), 'file://' + path.join(ROOT, n + '.html')])]) {
      for (const w of [1440, 390]) { await prep(p, url, w);
        for (const [rg, sel] of REG) { if (rg === 'history') { await openHistory(p); await p.waitForTimeout(600); }
          const el = p.locator(sel).filter({ visible: true }).first(); if (!(await el.count())) continue;
          try { await el.screenshot({ path: path.join(D, `${rg}-${w}-${nm}.png`), timeout: 3000 }); } catch { } } } }
  }
  if (MOTION) {
    const D = path.join(ROOT, 'screenshots', 'parity', 'motion'); fs.mkdirSync(D, { recursive: true });
    const SEQ = [
      ['tabswitch', async p => p.evaluate(() => { const t = document.querySelectorAll('.tabs .tab')[1]; t && t.click(); }), '.main'],
      ['history-entry', async p => { await openHistory(p); await p.waitForTimeout(900); await p.evaluate(() => { const e = document.querySelector('.hfe'); e && e.click(); }); }, '.card.hist'],
      ['tile', async p => p.evaluate(() => { const g = document.querySelector('.gl.pay,.gl'); if (g) { g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop'); } }), '.rail .rcard'],
      ['dialog', async p => p.evaluate(() => openDlg('<h2>לבטל את כל השינויים?</h2><div class="sub">דוגמה</div><div class="dbtns"><button class="btn primary lg block" data-act="x"><svg class="ic"><use href="#i-undo"/></svg>כן</button><button class="btn ghost block">חזרה</button></div>')), 'body'],
    ];
    for (const [nm, url] of [['sketch', SKETCH], ['detail-card', 'file://' + path.join(ROOT, 'archetype-detail-card.html')]]) {
      for (const [sq, act, sel] of SEQ) { await prep(p, url, 1440); const t0 = Date.now(); await act(p);
        for (const ms of [0, 150, 300, 600]) { const wait = ms - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait); const el = p.locator(sel).first(); try { await (sel === 'body' ? p : el).screenshot({ path: path.join(D, `${sq}-${nm}-${ms}ms.png`), timeout: 2000 }); } catch { } } } }
  }
  fs.writeFileSync(path.join(__dirname, 'parity-results.json'), JSON.stringify(res, null, 1));
  await b.close();
})();
