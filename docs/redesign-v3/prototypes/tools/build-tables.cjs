#!/usr/bin/env node
/* =============================================================================
   build-tables.cjs — injects the ONE table-screen layer (TABLES-PATTERN.md) into
   every list prototype, and keeps their shared shell block identical.

   Usage:  node docs/redesign-v3/prototypes/tools/build-tables.cjs [--check]
     (no args) 1. inject tables/tables.css + tables/tables.js between the
                  V3-TABLES:CSS / V3-TABLES:JS markers of every LIST prototype
               2. copy the three V3-SHELL blocks (CSS/TOP/END) verbatim from the
                  reference prototype (archetype-list.html, which build-shell.cjs
                  maintains) into the list prototypes build-shell.cjs does not know
     --check   exit 1 if any list prototype's table layer or shell block differs
     --shell-ref=<name>  take the shell block from another prototype (default archetype-list)

   The table layer only adds tp-* classes; it never restyles a shell selector.
   ============================================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const LISTS = ['archetype-list', 'archetype-customers-list'];
const SHELL_REF = ((process.argv.find(a => a.startsWith('--shell-ref=')) || '').split('=')[1] || 'archetype-list').replace(/\.html$/, '');
const check = process.argv.includes('--check');

const css = fs.readFileSync(path.join(ROOT, 'tables', 'tables.css'), 'utf8').trim();
const js = fs.readFileSync(path.join(ROOT, 'tables', 'tables.js'), 'utf8').trim();
const sha = crypto.createHash('sha256').update(css + '\n/*--*/\n' + js).digest('hex').slice(0, 12);
const tag = `v1 sha:${sha}`;
const BLOCK = {
  CSS: `<!-- V3-TABLES:CSS ${tag} -->\n<style id="v3-tables-css">\n${css}\n</style>\n<!-- /V3-TABLES:CSS -->`,
  JS: `<!-- V3-TABLES:JS ${tag} -->\n<script id="v3-tables-js">\n${js}\n</script>\n<!-- /V3-TABLES:JS -->`,
};
const reOf = (fam, k) => new RegExp(`<!-- ${fam}:${k} [^\\n]*-->[\\s\\S]*?<!-- /${fam}:${k} -->`);

const ref = fs.readFileSync(path.join(ROOT, SHELL_REF + '.html'), 'utf8');
const shell = {};
for (const k of ['CSS', 'TOP', 'END']) { const m = ref.match(reOf('V3-SHELL', k)); if (m) shell[k] = m[0]; }

let bad = 0;
for (const name of LISTS) {
  const f = path.join(ROOT, name + '.html');
  if (!fs.existsSync(f)) { console.log(`- ${name}: missing`); bad++; continue; }
  let h = fs.readFileSync(f, 'utf8');
  const before = h;
  for (const k of ['CSS', 'JS']) {
    if (!reOf('V3-TABLES', k).test(h)) { console.log(`✗ ${name}: no V3-TABLES:${k} marker`); bad++; continue; }
    h = h.replace(reOf('V3-TABLES', k), () => BLOCK[k]);
  }
  if (name !== SHELL_REF) for (const k of Object.keys(shell)) {
    if (!reOf('V3-SHELL', k).test(h)) { console.log(`✗ ${name}: no V3-SHELL:${k} marker`); bad++; continue; }
    h = h.replace(reOf('V3-SHELL', k), () => shell[k]);
  }
  if (check) { if (h !== before) { console.log(`✗ ${name}: stale (run without --check)`); bad++; } else console.log(`✓ ${name}: tables ${sha}, shell identical to ${SHELL_REF}`); }
  else { fs.writeFileSync(f, h); console.log(`✓ ${name}: tables ${sha}${name !== SHELL_REF ? `, shell copied from ${SHELL_REF}` : ''}`); }
}
if (!check) fs.writeFileSync(path.join(ROOT, 'tables', 'BUILD-INFO.txt'), `tables ${tag}\nlists ${LISTS.join(', ')}\nshell reference ${SHELL_REF}\n`);
process.exit(bad ? 1 : 0);
