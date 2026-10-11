// alias-loader.mjs - טוען ESM לכלי מדידה: ממפה '@/...' לשורש הפרויקט, מנחש סיומת .js לייבוא בלי סיומת, ומחליף 3 מודולים של האתר
// (prisma / settingsCache / dbMode) בגרסאות קלות שעובדות מחוץ ל-Next. כך אפשר להריץ את שאילתות הרשימות האמיתיות (lib/admin*ListServer.js) ב-node מול TEST בלבד.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const here = path.dirname(fileURLToPath(import.meta.url));
const STUBS = {
  '@/app/lib/prisma': 'stub-prisma.mjs',
  '@/lib/settingsCache': 'stub-settings.mjs',
  '@/lib/dbMode': 'stub-dbmode.mjs',
};
const tryFile = (p) => {
  for (const c of [p, `${p}.js`, path.join(p, 'index.js')]) if (existsSync(c) && !c.endsWith(path.sep)) { try { if (require_isFile(c)) return c; } catch { /* */ } }
  return null;
};
import { statSync } from 'node:fs';
const require_isFile = (c) => statSync(c).isFile();

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: pathToFileURL(path.join(here, STUBS[specifier])).href, shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const f = tryFile(path.join(root, specifier.slice(2)));
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL && context.parentURL.startsWith('file:')) {
    const f = tryFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true };
  }
  return next(specifier, context);
}
