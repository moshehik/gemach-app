// Module hooks for scripts/shared_delivery_reprice.mjs: '@/...' -> project root (+ extensionless relative imports get '.js'),
// '@/app/lib/prisma' -> a plain PrismaClient on SD_DATABASE_URL (shared-delivery-script-prisma.mjs), next/headers -> empty cookies.
// So the script runs the REAL lib/sharedDelivery.js (one source of truth) outside Next.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJ = process.env.PROJ;
const HERE = path.join(PROJ, 'scripts', 'lib');
const SH = (f) => pathToFileURL(path.join(HERE, f)).href;

async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} }
    throw e;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers') return { url: SH('shared-delivery-script-next-headers.mjs'), shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (r.url.endsWith('/app/lib/prisma.js') && !r.url.includes('node_modules')) return { url: SH('shared-delivery-script-prisma.mjs'), shortCircuit: true };
  return r;
}
