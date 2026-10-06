// node --import ./scripts/logo-measure-tests/register.mjs --test scripts/cpu-reduction-tests/<file>.test.mjs
// Module-resolution hooks (copy of scripts/business-days-tests/hooks.mjs + next/headers and lib/authTokens shims) with this folder's shims.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SPDIR = here;
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, 'hooks.mjs')).href);
