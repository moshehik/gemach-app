// Module-resolution hooks for the customer-signature route tests (same approach as scripts/business-days-tests/hooks.mjs):
// '@/…' -> project root, extension-less relative imports get '.js', app/lib/prisma -> in-memory shim, lib/auth -> always-logged-in shim.
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
  if (r.url.endsWith('/lib/auth.js') && !r.url.includes('node_modules')) return { url: SH('auth.mjs'), shortCircuit: true };
  return r;
}
