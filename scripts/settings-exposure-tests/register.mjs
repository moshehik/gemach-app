// node --no-warnings --import ./scripts/settings-exposure-tests/register.mjs --test scripts/settings-exposure-tests/settings-exposure.test.mjs
// Same module-resolution hooks and in-memory prisma / lib-auth shims as scripts/cpu-reduction-tests (so the REAL app/api/settings/route.js,
// lib/settingsCache.js and lib/publicSettings.js run end to end, no DB, no server). globalThis.__AUTH = false makes the shimmed checkAuth() fail.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SPDIR = path.join(here, '..', 'cpu-reduction-tests');
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(here, '..', 'business-days-tests', 'hooks.mjs')).href);
