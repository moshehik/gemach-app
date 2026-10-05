// node --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/<file>.test.mjs
// Same module-resolution hooks as scripts/business-days-tests ('@/...' alias, prisma + auth shims) with THIS folder's shims.
// The prisma shim forwards to globalThis.__PRISMA, so every test installs exactly the mock models its route needs.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SPDIR = here;
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, '..', 'business-days-tests', 'hooks.mjs')).href);
