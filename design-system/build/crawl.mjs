// Drives a saved page in headless Edge (CDP), exercises every state, records what is REALLY rendered.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SP = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const which = process.argv[2]; // A | B
const port = which === 'A' ? 9401 : 9402;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = 'file:///' + SP.replace(/\\/g, '/') + '/page' + which + '.html';
const udd = path.join(SP, 'udd_' + which);

const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + udd,
  '--window-size=1300,1000', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function getWs() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json`); const j = await r.json(); const t = j.find(x => x.type === 'page'); if (t) return t.webSocketDebuggerUrl; } catch {}
    await sleep(300);
  }
  throw new Error('no cdp');
}
const wsUrl = await getWs();
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d);
});
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || '') }; return r.result?.result?.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 1000, deviceScaleFactor: 1, mobile: false });

// ---------- instrumentation injected before any page script ----------
const INSTR = `(() => {
  const C = window.__C = { classes: {}, sigs: {}, anims: {}, trans: {}, usedSel: {}, log: [] };
  const sigOf = (el) => el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].sort().join('.') : '');
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    const all = [root, ...root.querySelectorAll('*')];
    for (const el of all) {
      for (const c of el.classList) C.classes[c] = (C.classes[c] || 0) + 1;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      const s = sigOf(el);
      if (!C.sigs[s]) { const anc = []; let p = el.parentElement; while (p && anc.length < 5 && p !== document.body && p !== document.documentElement) { const cs = [...p.classList].filter(c => !/^ia-/.test(c)); if (cs.length || p.id) anc.push({ t: p.tagName.toLowerCase(), c: cs, id: p.id || '' }); p = p.parentElement; } C.sigs[s] = { n: 0, html: el.outerHTML.slice(0, 24000), where: (el.closest('[id]')?.id) || '', anc, body: [...document.body.classList].join(' ') }; }
      const sv = C.sigs[s]; sv.n++;
      if (!sv.variants) sv.variants = [];
      if (sv.variants.length < 8 && (sv.n < 25 || sv.n % 4 === 0)) {
        const oh = el.outerHTML;
        if (oh.length < 9000) {
          const sk = oh.replace(/>[^<]+</g, '><').replace(/ style="[^"]*"/g, '').replace(/ ia-[\w-]+/g, '');
          let hsh = 0; for (let i = 0; i < sk.length; i++) hsh = (hsh * 31 + sk.charCodeAt(i)) | 0;
          if (!sv.variants.some(v => v.sk === hsh)) {
            const anc = []; let p = el.parentElement; while (p && anc.length < 5 && p !== document.body && p !== document.documentElement) { const cs = [...p.classList].filter(c => !/^ia-/.test(c)); if (cs.length || p.id) anc.push({ t: p.tagName.toLowerCase(), c: cs, id: p.id || '' }); p = p.parentElement; }
            sv.variants.push({ sk: hsh, html: oh, anc });
          }
        }
      }
    }
  }
  const start = () => {
    new MutationObserver(ms => { for (const m of ms) { m.addedNodes.forEach(n => scan(n)); if (m.type === 'attributes' && m.target.classList) { for (const c of m.target.classList) C.classes[c] = (C.classes[c]||0)+1; scan(m.target); } } })
      .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    scan(document.documentElement);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  const sigEl = (t) => { try { return t.tagName.toLowerCase() + (t.classList.length ? '.' + [...t.classList].sort().join('.') : '') + (t.id ? '#' + t.id : ''); } catch { return '?'; } };
  document.addEventListener('animationstart', e => { const k = e.animationName; (C.anims[k] = C.anims[k] || { n: 0, els: {} }).n++; C.anims[k].els[sigEl(e.target)] = 1; }, true);
  document.addEventListener('transitionrun', e => { const k = e.propertyName; (C.trans[k] = C.trans[k] || { n: 0, els: {} }).n++; C.trans[k].els[sigEl(e.target)] = 1; }, true);
  window.__markSel = () => {
    let total = 0;
    const strip = (s) => s.replace(/::?(before|after|placeholder|marker|selection|first-line|first-letter|-webkit-[a-z-]+(\\([^)]*\\))?|-moz-[a-z-]+)/g, '')
      .replace(/:(hover|focus-visible|focus-within|focus|active|visited|link|target|fullscreen|-webkit-autofill)/g, '');
    const walk = (rules, ctx) => {
      for (const r of rules) {
        if (r.type === 1) {
          total++;
          const key = ctx + '¦' + r.selectorText;
          if (C.usedSel[key]) continue;
          const parts = r.selectorText.split(/,(?![^()]*\\))/);
          let hit = false;
          for (let p of parts) {
            p = strip(p).trim(); if (!p) { hit = true; break; }
            try { if (document.querySelector(p)) { hit = true; break; } } catch { hit = true; break; }
          }
          if (hit) C.usedSel[key] = 1;
        } else if (r.cssRules && (r.type === 4 || r.type === 12 || r.type === 3)) walk(r.cssRules, ctx + '@' + (r.conditionText || r.media?.mediaText || r.name || ''));
      }
    };
    for (const ss of document.styleSheets) { try { walk(ss.cssRules, ss.ownerNode?.id || ('s' + [...document.styleSheets].indexOf(ss))); } catch {} }
    return total;
  };
})();`;
await send('Page.addScriptToEvaluateOnNewDocument', { source: INSTR });
await send('Page.navigate', { url });
await sleep(4000);


async function saveAll(tag) {
  const H1 = await ev(`(() => { const C = window.__C; window.__markSel(); return { classes: C.classes, sigs: C.sigs, anims: C.anims, trans: C.trans, usedSel: Object.keys(C.usedSel) }; })()`);
  if (H1 && !H1.__err) {
    const f = path.join(SP, 'crawl', `${which}_harvest.json`); let P = null;
    try { P = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    if (P && !process.env.FRESH) {
      for (const c in P.classes) H1.classes[c] = Math.max(H1.classes[c] || 0, P.classes[c]);
      for (const k in P.sigs) { if (!H1.sigs[k]) H1.sigs[k] = P.sigs[k]; else { const a = H1.sigs[k].variants || [], b = P.sigs[k].variants || []; for (const v of b) if (a.length < 12 && !a.some(x => x.sk === v.sk)) a.push(v); H1.sigs[k].variants = a; } }
      for (const k in P.anims) { if (!H1.anims[k]) H1.anims[k] = P.anims[k]; else Object.assign(H1.anims[k].els, P.anims[k].els); }
      for (const k in P.trans) { if (!H1.trans[k]) H1.trans[k] = P.trans[k]; else Object.assign(H1.trans[k].els, P.trans[k].els); }
      H1.usedSel = [...new Set([...(H1.usedSel || []), ...(P.usedSel || [])])];
    }
    fs.writeFileSync(f, JSON.stringify(H1));
  }
  console.log(which, tag, H1 && Object.keys(H1.classes || {}).length);
}

const out = { which, url, steps: [] };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SP, 'crawl', `${which}_${name}.png`), Buffer.from(r.result.data, 'base64')); };
fs.mkdirSync(path.join(SP, 'crawl'), { recursive: true });
await shot('00_load');
out.steps.push({ step: 'load', marks: await ev('window.__markSel()') });

// ---------- interaction: click every interactive element, several rounds ----------
const CLICK = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seen = window.__clicked = window.__clicked || new WeakSet();
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const sel = 'button, [role=button], [role=tab], [role=menuitem], [role=option], summary, .chip.btnlike, label.sw, .tab, .seg button, .sizes button, .methods button, .opt, a[data-sn-link], [data-act], input[type=checkbox], input[type=radio], .li.lrow, .itm .top, .cb-t, .hf-t';
  const els = [...document.querySelectorAll(sel)].filter(e => !seen.has(e) && vis(e)).slice(0, 70);
  let n = 0;
  for (const el of els) {
    seen.add(el);
    const label = (el.getAttribute('data-act') || el.id || el.className || el.tagName) + '';
    if (/delete|reset|exit|logout|sn-link.danger/i.test(label) && !/dlg|demo/i.test(label)) { }
    try { el.scrollIntoView({block:'center'}); el.click(); } catch {}
    n++; await sleep(70); if (n > 70) break;
    // close any open layer so the next click hits the page, but only after it had time to animate
    const scrim = document.querySelector('.scrim.on'); if (scrim) { await sleep(250); window.__markSel(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const b = scrim.querySelector('.btn.ghost, [data-act*=close], [data-act*=cancel]'); if (b) b.click(); await sleep(120); if (document.querySelector('.scrim.on')) scrim.classList.remove('on'); }
  }
  window.__markSel();
  return n;
})()`;
for (let round = 1; round <= 5; round++) {
  const n = await ev(CLICK);
  out.steps.push({ step: 'click-round-' + round, clicked: n, marks: await ev('window.__markSel()') });
  await sleep(600);
  if (n === 0 || n?.__err) break;
}
await shot('01_after_clicks'); await saveAll('clicks');

// ---------- drive <select>s (demo strip states), typing into search, mobile layout ----------
const selInfo = await ev(`[...document.querySelectorAll('select')].map((s,i)=>({i,id:s.id,opts:[...s.options].map(o=>o.value)}))`);
out.selects = selInfo;
for (const s of (selInfo || [])) {
  for (const v of s.opts.slice(0, 8)) {
    await ev(`(() => { const s=[...document.querySelectorAll('select')][${s.i}]; if(!s) return; s.value=${JSON.stringify(v)}; s.dispatchEvent(new Event('input',{bubbles:true})); s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await sleep(500);
    await sleep(200);
  }
}
async function typeSearch(txt) {
  const ok = await ev(`(() => { const i=document.querySelector('#sq, #scanIn, input[type=search], .scan input'); if(!i) return false; i.focus(); i.value=''; return true; })()`);
  if (!ok) return;
  await send('Input.insertText', { text: txt }); await sleep(600);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(1200);
}
await saveAll('selects');
for (const q of ['שרה', '53375', 'שמלה']) { await typeSearch(q); await ev(CLICK); await sleep(300); await ev('window.__markSel()'); }
// click the mode buttons then search again (smart / advanced)
const modes = await ev(`[...document.querySelectorAll('.cmode-b')].length`);
for (let k = 0; k < (modes || 0); k++) {
  await ev(`[...document.querySelectorAll('.cmode-b')][${k}]?.click()`); await sleep(700);
  await typeSearch('כמה שמלות מידה 38'); await ev(CLICK); await sleep(400); await ev(CLICK); await ev('window.__markSel()');
  await shot('02_mode_' + k);
}
await shot('03_after_search'); await saveAll('search');
// mobile layout: drawer, bottom bar, sheets
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(800);
for (let r = 0; r < 3; r++) { await ev(CLICK); await sleep(500); }
await ev(`document.querySelector('.sn-burger')?.click()`); await sleep(500); await ev(CLICK); await sleep(500);
await shot('04_mobile'); await saveAll('mobile');
await send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 1000, deviceScaleFactor: 1, mobile: false });
await sleep(600);
for (let r = 0; r < 2; r++) { await ev(CLICK); await sleep(400); }


// ---------- real hover: move the mouse over every interactive element to trigger :hover animations ----------
const targets = await ev(`(() => { const sel='button,[role=button],a[href],summary,.tab,.li,.lrow,.itm .top,.sn-tab,.sn-ib,.sn-user,.card,.gl,.cl,.tx,.chip.btnlike,.tip,.ibtn,.nf-row,.hf-o,.cb-o,.dpc,.cev,.advpill,.advfl,.xlbtn,.cmode-b,.sn-link,.tbtn,.pl-x';
  const vis=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&r.bottom>0&&r.top<innerHeight};
  return [...document.querySelectorAll(sel)].filter(vis).slice(0,400).map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]}); })()`);
let hovered = 0;
for (const [x, y] of (targets || [])) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); hovered++; await sleep(70);
}
// scroll through the page and hover what is below the fold
const H = await ev('document.documentElement.scrollHeight');
for (let y = 0; y < (H || 0); y += 700) {
  await ev(`window.scrollTo(0, ${y})`); await sleep(200);
  const t2 = await ev(`(() => { const sel='button,[role=button],a[href],summary,.tab,.li,.lrow,.itm .top,.card,.gl,.cl,.tx,.chip.btnlike,.tip,.ibtn,.nf-row,.xlbtn,.cmode-b,.advpill,.advfl,.cev'; const vis=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&r.bottom>0&&r.top<innerHeight}; return [...document.querySelectorAll(sel)].filter(vis).slice(0,60).map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]}); })()`);
  for (const [x, y] of (t2 || [])) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); hovered++; await sleep(50); }
}
await ev('window.scrollTo(0,0)');
out.hovered = hovered;
out.steps.push({ step: 'hover', marks: await ev('window.__markSel()') });


// ---------- tooltips: hover EVERY [data-tip] / [data-rich] and record what #tt / #rt really show ----------
const tipLog = { tt: {}, rt: {} };
async function tipPass() {
  const n = await ev(`document.querySelectorAll('[data-tip],[data-rich]').length`);
  for (let i = 0; i < Math.min(n || 0, 260); i++) {
    const r = await ev(`(() => { const e=[...document.querySelectorAll('[data-tip],[data-rich]')][${i}]; if(!e) return null; e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return {x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2), tip:e.getAttribute('data-tip'), rich:e.getAttribute('data-rich'), sig:e.tagName.toLowerCase()+'.'+[...e.classList].filter(c=>!/^ia-/.test(c)).join('.')}; })()`);
    if (!r || !r.x) continue;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 3, y: 3 }); await sleep(30);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y }); await sleep(260);
    const got = await ev(`(() => { const r=document.getElementById('rt'), t=document.getElementById('tt'); const cs=e=>e?getComputedStyle(e):null; return { rt: r && r.classList.contains('on') ? r.outerHTML : null, tt: t && t.classList.contains('on') ? { html: t.outerHTML, text: t.textContent } : null }; })()`);
    if (got?.tt) tipLog.tt[r.tip || got.tt.text] = { sig: r.sig, html: got.tt.html, tip: r.tip };
    if (got?.rt) tipLog.rt[r.rich || ('i' + i)] = { sig: r.sig, html: got.rt, rich: r.rich };
  }
  fs.writeFileSync(path.join(SP, 'crawl', `${which}_tips.json`), JSON.stringify(tipLog));
  console.log(which, 'tips', Object.keys(tipLog.tt).length, 'rich', Object.keys(tipLog.rt).length);
}
await tipPass();
// ---------- harvest ----------
const H1 = await ev(`(() => { const C = window.__C; return { classes: C.classes, sigs: C.sigs, anims: C.anims, trans: C.trans, usedSel: Object.keys(C.usedSel) }; })()`);
await saveAll('final');
// dump every stylesheet's rules with used flag
const RULES = await ev(`(() => { const C = window.__C; const rows = []; const walk = (rules, ctx, sheet) => { for (const r of rules) { if (r.type === 1) rows.push({ sheet, ctx, sel: r.selectorText, css: r.cssText, used: !!C.usedSel[ctx + '¦' + r.selectorText] }); else if (r.type === 7) rows.push({ sheet, ctx, kf: r.name, css: r.cssText }); else if (r.cssRules && (r.type === 4 || r.type === 12 || r.type === 3)) walk(r.cssRules, ctx + '@' + (r.conditionText || r.media?.mediaText || r.name || ''), sheet); } };
  [...document.styleSheets].forEach((ss, i) => { try { walk(ss.cssRules, ss.ownerNode?.id || ('s' + i), ss.ownerNode?.id || ('s' + i)); } catch {} });
  return rows; })()`);
fs.writeFileSync(path.join(SP, 'crawl', `${which}_rules.json`), JSON.stringify(RULES));
fs.writeFileSync(path.join(SP, 'crawl', `${which}_summary.json`), JSON.stringify(out, null, 1));
console.log(which, 'classes', Object.keys(H1.classes).length, 'sigs', Object.keys(H1.sigs).length, 'anims', Object.keys(H1.anims).length, 'trans', Object.keys(H1.trans).length, 'usedSel', H1.usedSel.length, 'rules', RULES.length, 'hovered', hovered);
ws.close(); proc.kill();
process.exit(0);
