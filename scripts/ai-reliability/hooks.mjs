import { pathToFileURL, fileURLToPath } from 'node:url';
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
  if ((specifier === 'fs' || specifier === 'node:fs') && context.parentURL && context.parentURL.includes('/app/api/')) {
    return { url: SH('fs.mjs'), shortCircuit: true };
  }
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (r.url.endsWith('/app/lib/prisma.js')) return { url: SH('prisma.mjs'), shortCircuit: true };
  if (r.url.endsWith('/lib/auth.js')) return { url: SH('auth.mjs'), shortCircuit: true };
  return r;
}
