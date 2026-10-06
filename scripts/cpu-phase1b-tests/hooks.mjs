// Module-resolution hooks for the phase-1B route tests: '@/...' alias, extensionless relative imports, and a table of heavy/Next-only
// modules replaced by tiny stand-ins from ./shims (prisma, auth, next/headers, authTokens, permissions, mailer, gemini, ...).
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJ = process.env.PROJ;
const SH = (f) => pathToFileURL(path.join(process.env.SPDIR, 'shims', f)).href;

const STUBS = [
  ['/app/lib/prisma.js', 'prisma.mjs'],
  ['/lib/auth.js', 'auth.mjs'],
  ['/lib/authTokens.js', 'authTokens.mjs'],
  ['/lib/permissions.js', 'permissions.mjs'],
  ['/lib/mailer.js', 'noop.mjs'],
  ['/lib/ai/gemini.js', 'noop.mjs'],
  ['/lib/emailTemplates.js', 'noop.mjs'],
  ['/lib/emailCatalog.js', 'noop.mjs'],
  ['/lib/attachmentUpload.js', 'noop.mjs'],
];

async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} }
    throw e;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers') return { url: SH('next-headers.mjs'), shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (!r.url.includes('node_modules')) {
    for (const [suffix, shim] of STUBS) if (r.url.endsWith(suffix)) return { url: SH(shim), shortCircuit: true };
  }
  return r;
}
