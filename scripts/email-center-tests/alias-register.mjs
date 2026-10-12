// טוען "@/..." (ויבוא יחסי בלי סיומת) לבדיקות node בלי Next: import './alias-register.mjs' לפני ייבוא קבצים שמשתמשים ב-alias.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..') + path.sep).href;
const hooks = String.raw`
const ROOT = ${'${JSON}'};
const hasExt = (x) => /\.[a-z]+$/.test(x);
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) return next(ROOT + spec.slice(2) + (hasExt(spec) ? '' : '.js'), ctx);
  try { return await next(spec, ctx); } catch (e) {
    if (spec.startsWith('.') && !hasExt(spec)) return next(spec + '.js', ctx);
    throw e;
  }
}`.replace('${JSON}', JSON.stringify(ROOT));
register('data:text/javascript,' + encodeURIComponent(hooks), import.meta.url);
