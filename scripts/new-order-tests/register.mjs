// node --import ./scripts/new-order-tests/register.mjs --test scripts/new-order-tests/<file>.test.mjs
// מאפשר לייבא ב-node את קבצי האשף החדש (app/components/new-order/*.js) כמו ש-Next מייבא אותם: '@/…' -> שורש הפרויקט,
// ייבוא בלי סיומת -> .js. אותו דפוס כמו scripts/schedule-tests/register.mjs (בלי shims - הקבצים הנבדקים לא נוגעים ב-DB).
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, 'hooks.mjs')).href);
