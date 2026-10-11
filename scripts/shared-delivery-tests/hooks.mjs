// Module-resolution hooks for the schedule tests: '@/…' -> project root, and the Next-only
// modules (next/server, next/headers) + the Prisma client are replaced with the shims in ./shims.
// Same approach as scripts/ai-reliability/hooks.mjs. lib/auth.js and lib/permissions.js are the
// REAL files (they only need next/headers + prisma, both shimmed) so the route test exercises
// the real login/permission gates against the in-memory mock DB.
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
  if (specifier === 'next/server') return { url: SH('next-server.mjs'), shortCircuit: true };
  if (specifier === 'next/headers') return { url: SH('next-headers.mjs'), shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (r.url.endsWith('/app/lib/prisma.js')) return { url: SH('prisma.mjs'), shortCircuit: true };
  return r;
}
