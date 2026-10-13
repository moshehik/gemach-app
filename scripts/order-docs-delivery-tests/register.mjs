// node --import ./scripts/order-docs-delivery-tests/register.mjs --test scripts/order-docs-delivery-tests/<file>.test.mjs
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, 'hooks.mjs')).href);
