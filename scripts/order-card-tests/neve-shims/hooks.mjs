// מפנה את התלויות של lib/deliveryJoin.js (prisma, settingsCache) לדמויות בזיכרון - לבדיקות neve.server.test.mjs בלבד
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SHIMS = {
  '@/app/lib/prisma': 'prisma.mjs',
  '@/lib/settingsCache': 'settings.mjs',
};
export async function resolve(specifier, context, nextResolve) {
  if (SHIMS[specifier]) return { url: pathToFileURL(path.join(process.env.PROJ, 'scripts/order-card-tests/neve-shims', SHIMS[specifier])).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
