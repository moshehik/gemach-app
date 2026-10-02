// Loader hooks for the render harness: JSX in app/** and components/** is transformed with Next's own SWC
// (node_modules/next/dist/build/swc), CSS imports become empty modules, next/navigation is stubbed.
// Chained after scripts/schedule-tests/hooks.mjs (which maps '@/…', next/server, next/headers and prisma).
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const PROJ = process.env.PROJ;
const SPDIR = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(PROJ, 'package.json'));
const swc = require('next/dist/build/swc');
let bindingsReady = null;
async function transform(src, opts) {
  if (!bindingsReady) bindingsReady = swc.loadBindings ? swc.loadBindings() : Promise.resolve();
  await bindingsReady;
  return swc.transform(src, opts);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/navigation') return { url: pathToFileURL(path.join(SPDIR, 'shims', 'next-navigation.mjs')).href, shortCircuit: true };
  if (specifier.endsWith('.css')) return { url: 'data:text/javascript,export%20default%20null', shortCircuit: true };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.js')) {
    const file = fileURLToPath(url);
    const rel = path.relative(PROJ, file).replace(/\\/g, '/');
    if ((rel.startsWith('app/') || rel.startsWith('components/')) && !rel.includes('node_modules')) {
      const raw = await nextLoad(url, { ...context, format: 'module' });
      const src = typeof raw.source === 'string' ? raw.source : Buffer.from(raw.source).toString('utf8');
      const out = await transform(src, {
        filename: file,
        jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' },
        module: { type: 'es6' },
      });
      return { format: 'module', source: out.code, shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}
