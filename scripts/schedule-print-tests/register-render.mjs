// node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/render.mjs
// Registers the schedule-tests hooks (@/ alias, next/server, next/headers, prisma mock) and then the JSX/CSS hooks.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const sched = path.join(here, '..', 'schedule-tests');
process.env.SPDIR = process.env.SPDIR || sched;
process.env.PROJ = process.env.PROJ || path.resolve(here, '..', '..');
register(pathToFileURL(path.join(sched, 'hooks.mjs')).href);
register(pathToFileURL(path.join(here, 'jsx-hooks.mjs')).href);
