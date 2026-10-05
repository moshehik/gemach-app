// node --import ./scripts/cpu-reduction-tests/register.mjs --test scripts/cpu-reduction-tests/<file>.test.mjs
// Same module-resolution hooks as scripts/business-days-tests (so '@/…' and prisma/auth shims work), but with THIS folder's shims.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SPDIR = here;
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, '..', 'business-days-tests', 'hooks.mjs')).href);
