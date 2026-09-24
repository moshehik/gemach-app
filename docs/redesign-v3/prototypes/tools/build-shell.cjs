#!/usr/bin/env node
/* =============================================================================
   build-shell.cjs — builds the ONE shared V3 shell block from the order-card
   sketch (docs/redesign-v3/sketch/order-card-sketch-B.html) and injects the
   identical block into every archetype prototype.

   Usage:  node docs/redesign-v3/prototypes/tools/build-shell.cjs [--check]
     (no args) rebuild shell/ artefacts + inject into all prototypes that carry
               the V3-SHELL markers
     --check   exit 1 if any prototype's injected block differs from the build

   The block has three parts, each wrapped in markers so it can be re-injected:
     <!-- V3-SHELL:CSS ... -->  … <!-- /V3-SHELL:CSS -->   (in <head>)
     <!-- V3-SHELL:TOP ... -->  … <!-- /V3-SHELL:TOP -->   (first thing in <body>)
     <!-- V3-SHELL:END ... -->  … <!-- /V3-SHELL:END -->   (before the page script)

   Everything inside comes VERBATIM from the sketch (CSS: all four <style>
   blocks in document order; markup: sprite, site top bar, overlays; JS:
   shell/runtime*.src.js, which are sketch line ranges + small glue marked
   [G…]/"glue"). The only automatic edits are the normalisations N1–N4 below
   (documented in SHELL-BLOCK.md) plus shell/amendments.css (C-1.14 etc.).
   ============================================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SKETCH = path.join(ROOT, '..', 'sketch', 'order-card-sketch-B.html');
const SHELL = path.join(ROOT, 'shell');
const VERSION = 'v1';
const PROTOS = ['archetype-detail-card', 'archetype-board', 'archetype-wizard', 'archetype-list', 'archetype-dashboard', 'archetype-touch', 'archetype-forms'].map(n => path.join(ROOT, n + '.html'));

const src = fs.readFileSync(SKETCH, 'utf8');
const lines = src.split('\n');
const L = (a, b) => lines.slice(a - 1, b).join('\n'); // 1-based inclusive

/* ---------- CSS: every <style> block of the sketch, in order ---------- */
const styleRanges = [];
lines.forEach((ln, i) => { if (ln.trim() === '<style>') styleRanges.push([i + 2, null]); if (ln.trim() === '</style>') styleRanges[styleRanges.length - 1][1] = i; });
let css = styleRanges.map(([a, b]) => `/* ==== sketch L${a}-${b} ==== */\n` + L(a, b)).join('\n');

const log = [];
/* N1 — reduced motion: the sketch disables it for demo purposes; v3 honours it (CONSTITUTION ה.3) */
const n1 = (css.match(/\(prefers-reduced-motion:reduce\) and \(min-width:99999px\)/g) || []).length;
css = css.replace(/\(prefers-reduced-motion:reduce\) and \(min-width:99999px\)/g, '(prefers-reduced-motion:reduce)');
log.push(`N1 reduced-motion media queries re-enabled: ${n1}`);
/* N2 — breakpoints mapped to the allowed set (CONSTITUTION ב.6 / D-15). Top-bar-internal thresholds (1180/1040/900) are kept verbatim — see SHELL-BLOCK.md "deviations". */
const n2a = (css.match(/max-width:1020px/g) || []).length, n2b = (css.match(/max-width:420px/g) || []).length;
css = css.replace(/max-width:1020px/g, 'max-width:1023px').replace(/max-width:420px/g, 'max-width:479px');
log.push(`N2 breakpoints: 1020→1023 ×${n2a}, 420→479 ×${n2b}`);
/* N3 — physical → logical. The document is dir=rtl only, so left≡inline-end and right≡inline-start exactly. */
let n3 = 0;
const PHYS = [
  [/(^|[;{\s])left\s*:/g, '$1inset-inline-end:'], [/(^|[;{\s])right\s*:/g, '$1inset-inline-start:'],
  [/(^|[;{\s])padding-left\s*:/g, '$1padding-inline-end:'], [/(^|[;{\s])padding-right\s*:/g, '$1padding-inline-start:'],
  [/(^|[;{\s])margin-left\s*:/g, '$1margin-inline-end:'], [/(^|[;{\s])margin-right\s*:/g, '$1margin-inline-start:'],
  [/(^|[;{\s])border-left\s*:/g, '$1border-inline-end:'], [/(^|[;{\s])border-right\s*:/g, '$1border-inline-start:'],
  [/(^|[;{\s])border-left-(color|width|style)\s*:/g, '$1border-inline-end-$2:'], [/(^|[;{\s])border-right-(color|width|style)\s*:/g, '$1border-inline-start-$2:'],
  [/text-align\s*:\s*left/g, 'text-align:end'], [/text-align\s*:\s*right/g, 'text-align:start'],
];
for (const [re, to] of PHYS) css = css.replace(re, (...m) => { n3++; return to.replace('$1', m[1]).replace('$2', m[2]); });
log.push(`N3 physical properties converted to logical (RTL-exact): ${n3}`);
/* N4 — fill-mode: `both`/`backwards` removed from entrance animations that have NO delay (visually a no-op, satisfies CONSTITUTION ה.4). Delayed/staggered ones are kept and listed. */
let n4 = 0; const kept = [];
css = css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, sel, body) => {
  if (!/animation\s*:/.test(body)) return whole;
  const hasDelayProp = /animation-delay\s*:/.test(body);
  const nb = body.replace(/animation\s*:([^;]+)/g, (d, val) => {
    const parts = val.split(/,(?![^(]*\))/).map(a => {
      const times = (a.match(/(^|\s)-?\d*\.?\d+m?s(?=\s|$)/g) || []).length;
      const hasDelay = times >= 2 || /var\(--ia-dl/.test(a) || hasDelayProp;
      if (/\b(both|backwards)\b/.test(a)) {
        if (!hasDelay) { n4++; return a.replace(/\s+(both|backwards)\b/, ''); }
        kept.push(sel.trim().slice(0, 80));
      }
      return a;
    });
    return 'animation:' + parts.join(',');
  });
  return sel + '{' + nb + '}';
});
log.push(`N4 fill-mode removed on undelayed entrances: ${n4}; kept on delayed/staggered: ${kept.length}`);

const amend = fs.readFileSync(path.join(SHELL, 'amendments.css'), 'utf8');
const cssAll = css + '\n' + amend;

/* ---------- markup ---------- */
const find = (re, from = 0) => { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i + 1; throw new Error('not found ' + re); };
const spA = find(/^<svg width="0" height="0"/), spB = find(/^<\/svg>/, spA);
const hdA = find(/^<header class="snav"/), hdB = find(/^<div id="snScrim"><\/div>/, hdA);
const nbA = find(/^<div class="nb-area" id="nbArea"/);
const ovA = find(/^<div id="toast"/), ovB = find(/^<div class="scrim" id="scrim2">/, ovA);
const top = `<!-- sketch L${spA}-${spB}: icon sprite -->\n${L(spA, spB)}\n<!-- sketch L${hdA}-${hdB}: site top bar -->\n${L(hdA, hdB)}\n<!-- sketch L${nbA}: notice-bar area -->\n${L(nbA, nbA)}`;
const overlays = `<!-- sketch L${ovA}-${ovB}: toast, tooltip, dialog layers -->\n${L(ovA, ovB)}`;

/* ---------- JS ---------- */
let js = fs.readFileSync(path.join(SHELL, 'runtime.src.js'), 'utf8') + '\n' + fs.readFileSync(path.join(SHELL, 'runtime-tail.src.js'), 'utf8');
const j1 = (js.match(/matchMedia\('\(min-width:99999px\)'\)/g) || []).length;
js = js.replace(/matchMedia\('\(min-width:99999px\)'\)/g, "matchMedia('(prefers-reduced-motion:reduce)')");
log.push(`N1 (JS) reduced-motion checks re-enabled: ${j1}`);
// the runtime is wrapped so the whole block can be dropped into any page; top-level declarations stay global (classic script)

const hash = crypto.createHash('sha256').update(cssAll + top + overlays + js).digest('hex').slice(0, 12);
const tag = `${VERSION} sha:${hash} — generated by tools/build-shell.cjs from sketch/order-card-sketch-B.html; DO NOT EDIT BY HAND`;
const blocks = {
  CSS: `<!-- V3-SHELL:CSS ${tag} -->\n<style id="v3-shell-css">\n${cssAll}\n</style>\n<!-- /V3-SHELL:CSS -->`,
  TOP: `<!-- V3-SHELL:TOP ${tag} -->\n${top}\n<!-- /V3-SHELL:TOP -->`,
  END: `<!-- V3-SHELL:END ${tag} -->\n${overlays}\n<script id="v3-shell-js">\n${js}\n</script>\n<!-- /V3-SHELL:END -->`,
};
fs.writeFileSync(path.join(SHELL, 'shell-block.css'), cssAll);
fs.writeFileSync(path.join(SHELL, 'shell-block.js'), js);
fs.writeFileSync(path.join(SHELL, 'shell-block-top.html'), top);
fs.writeFileSync(path.join(SHELL, 'shell-block-overlays.html'), overlays);
fs.writeFileSync(path.join(SHELL, 'BUILD-INFO.txt'), [`version ${VERSION}`, `sha ${hash}`, ...log, 'N4 kept (delayed/staggered):', ...kept.map(k => '  ' + k)].join('\n') + '\n');

const check = process.argv.includes('--check');
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).replace(/\.html$/,'') : null;
let bad = 0;
for (const f of PROTOS) {
  if (!fs.existsSync(f)) continue;
  if (only && path.basename(f, '.html') !== only) continue;
  let h = fs.readFileSync(f, 'utf8'); const before = h; let found = 0;
  for (const k of Object.keys(blocks)) {
    const re = new RegExp(`<!-- V3-SHELL:${k} [^\\n]*-->[\\s\\S]*?<!-- /V3-SHELL:${k} -->`);
    if (re.test(h)) { found++; h = h.replace(re, () => blocks[k]); }
  }
  const name = path.basename(f);
  if (!found) { console.log(`- ${name}: no V3-SHELL markers (not injected)`); continue; }
  if (found !== 3) { console.log(`! ${name}: only ${found}/3 markers`); bad++; }
  if (check) { if (h !== before) { console.log(`✗ ${name}: shell block out of date`); bad++; } else console.log(`✓ ${name}: shell ${hash}`); }
  else { fs.writeFileSync(f, h); console.log(`✓ ${name}: injected shell ${hash}`); }
}
console.log(log.join('\n'));
console.log('shell sha', hash);
process.exit(bad ? 1 : 0);
