// Static guard: no client component of the schedule / schedule-print UI may (transitively) import a
// server-only module. The unit tests mock next/headers (schedule-tests/register.mjs), so they never saw
// that `next build` failed on app/schedule/print/[page]/page.js -> registry.js -> lib/printAccess.js
// -> lib/permissions.js (next/headers + prisma). This test walks the real import graph from every
// 'use client' file under app/components/schedule/** and app/schedule/** and fails on any path that
// reaches a server-only module. No DB, no bundler - just source parsing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const proj = process.env.PROJ || process.cwd();
const ROOTS = ['app/components/schedule', 'app/schedule'];

// Bare specifiers that must never reach the client bundle.
const FORBIDDEN_SPECIFIERS = [/^next\/headers$/, /^@prisma\/client/, /^server-only$/, /^bcrypt(js)?$/, /^node:/, /^(fs|child_process|crypto)$/];
// Project files that are server-only (import prisma / next/headers / secrets).
const FORBIDDEN_FILES = ['lib/permissions.js', 'lib/prisma.js', 'lib/printAccess.js', 'lib/auth.js', 'lib/authTokens.js'];

function walkDir(dir, out = []) {
  const abs = path.join(proj, dir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.posix.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(rel, out);
    else if (/\.(m?js|jsx)$/.test(ent.name)) out.push(rel);
  }
  return out;
}

const directive = (src) => {
  const m = src.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '').match(/^['"]use (client|server)['"]/);
  return m ? m[1] : null;
};

function specifiers(src) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
  const out = new Set();
  const re = /(?:^|[;\s])(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|(?:^|[;\s])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm;
  let m;
  while ((m = re.exec(noComments))) out.add(m[1] || m[2] || m[3]);
  return [...out];
}

function resolve(fromRel, spec) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  else return null; // bare package
  for (const cand of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}/index.js`]) {
    const abs = path.join(proj, cand);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return cand;
  }
  return undefined; // unresolved (css, json, missing)
}

const clientEntries = ROOTS.flatMap((r) => walkDir(r)).filter((f) => directive(fs.readFileSync(path.join(proj, f), 'utf8')) === 'client');

test('there are client entries to check', () => {
  assert.ok(clientEntries.includes('app/schedule/print/[page]/page.js'), 'print page entry found');
  assert.ok(clientEntries.includes('app/components/schedule/print/PrintWizard.js'), 'PrintWizard entry found');
});

test('no schedule client component transitively imports a server-only module', () => {
  const problems = [];
  for (const entry of clientEntries) {
    const seen = new Set([entry]);
    const stack = [[entry, [entry]]];
    while (stack.length) {
      const [file, chain] = stack.pop();
      const src = fs.readFileSync(path.join(proj, file), 'utf8');
      if (file !== entry && directive(src) === 'server') continue; // server actions are allowed from the client
      for (const spec of specifiers(src)) {
        if (FORBIDDEN_SPECIFIERS.some((re) => re.test(spec))) { problems.push(`${chain.join(' -> ')} -> ${spec}`); continue; }
        const rel = resolve(file, spec);
        if (!rel) continue;
        if (FORBIDDEN_FILES.includes(rel)) { problems.push(`${chain.join(' -> ')} -> ${rel}`); continue; }
        if (!seen.has(rel)) { seen.add(rel); stack.push([rel, [...chain, rel]]); }
      }
    }
  }
  assert.deepEqual([...new Set(problems)], []);
});

test('lib/printAccessKeys.js stays import-free', () => {
  const src = fs.readFileSync(path.join(proj, 'lib/printAccessKeys.js'), 'utf8');
  assert.deepEqual(specifiers(src), []);
});
