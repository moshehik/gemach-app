// Module-resolution hooks for the pure-lib tests: '@/…' -> project root, extension-less relative imports get '.js'.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PROJ = process.env.PROJ;
async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} }
    throw e;
  }
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  return tryResolve(specifier, context, nextResolve);
}
