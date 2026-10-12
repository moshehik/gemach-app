// Module hooks for the SSR smoke test: '@/..' -> project root, extension-less relative imports, .css -> empty module, next/link + next/navigation -> tiny stubs,
// and JSX in project .js files is compiled with Next's own SWC binary (@next/swc-win32-x64-msvc or the platform equivalent). No dev server involved.
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const PROJ = process.env.PROJ;
const SPDIR = process.env.SPDIR;
const req = createRequire(path.join(PROJ, 'package.json'));
let swc = null;
function getSwc() {
  if (swc) return swc;
  for (const p of ['@next/swc-win32-x64-msvc', '@next/swc-darwin-arm64', '@next/swc-linux-x64-gnu']) { try { swc = req(p); return swc; } catch { /* next */ } }
  throw new Error('SWC binary not found');
}
const STUB = (n) => pathToFileURL(path.join(SPDIR, 'ssr-shims', n)).href;

async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch { /* next */ } }
    throw e;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.css')) return { url: STUB('empty.mjs'), shortCircuit: true };
  if (specifier === 'next/link') return { url: STUB('link.mjs'), shortCircuit: true };
  if (specifier === 'next/navigation') return { url: STUB('navigation.mjs'), shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  return tryResolve(specifier, context, nextResolve);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.js') && !url.includes('/node_modules/')) {
    const file = fileURLToPath(url);
    if (file.startsWith(PROJ)) {
      const src = fs.readFileSync(file, 'utf8');
      const opts = {
        filename: file,
        jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' },
        module: { type: 'es6' },
        sourceMaps: false,
      };
      const out = await getSwc().transform(src, true, Buffer.from(JSON.stringify(opts)));
      return { format: 'module', source: out.code, shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}
