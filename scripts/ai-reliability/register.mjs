// טוען את ה-hooks שמאפשרים להריץ את נתיבי ה-AI האמיתיים (app/api/**/route.js) מחוץ ל-Next.js.
// שימוש: node --no-warnings --import ./scripts/ai-reliability/register.mjs scripts/ai-reliability/run.mjs core
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SPDIR = process.env.SPDIR || here;
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, 'hooks.mjs')).href);
