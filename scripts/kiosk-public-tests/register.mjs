// node --import ./scripts/kiosk-public-tests/register.mjs --test scripts/kiosk-public-tests/<file>.test.mjs   (או: node scripts/kiosk-public-tests/run.mjs)
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SPDIR = process.env.SPDIR || here;
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, 'hooks.mjs')).href);
