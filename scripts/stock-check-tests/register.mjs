// טוען את ה-hooks שמריצים את lib/stockCheck.js ואת app/api/stock-check/route.js מחוץ ל-Next.js,
// מול מסד נתונים בזיכרון (shims/prisma.mjs) - בלי חיבור לשום DB אמיתי.
// שימוש (מתוך gemach-app/):
//   node --no-warnings --import ./scripts/stock-check-tests/register.mjs scripts/stock-check-tests/unit/stockCheck.mjs
//   node --no-warnings --import ./scripts/stock-check-tests/register.mjs scripts/stock-check-tests/unit/route.mjs
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SPDIR = process.env.SPDIR || here;
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, 'hooks.mjs')).href);
