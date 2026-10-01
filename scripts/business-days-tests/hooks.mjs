// Module-resolution hooks: '@/…' -> project root, app/lib/prisma -> in-memory shim, and relative
// imports without extension ('./hebrewDate') get '.js' appended (webpack resolves them, node ESM
// does not). Same approach as scripts/schedule-tests/hooks.mjs. lib/settingsCache.js is the REAL
// file (it only needs prisma, which is shimmed), so the settings path is exercised end to end.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJ = process.env.PROJ;
const SH = (f) => pathToFileURL(path.join(process.env.SPDIR, 'shims', f)).href;

async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} }
    throw e;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (r.url.endsWith('/app/lib/prisma.js')) return { url: SH('prisma.mjs'), shortCircuit: true };
  return r;
}
