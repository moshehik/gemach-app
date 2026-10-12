// מריץ את בדיקות המדדי ההמרה של העמדה הציבורית, בלי DB ובלי שרת:  node scripts/station-analytics-tests/run.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..', '..');
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.join(here, 'register.mjs')).href, '--test', path.join(here, file)], {
    cwd: proj, encoding: 'utf8', env: { ...process.env, TZ: 'Asia/Jerusalem', PROJ: proj, SPDIR: here },
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/^ℹ pass (\d+)/m) || [])[1] || '?';
  const fail = (out.match(/^ℹ fail (\d+)/m) || [])[1] || '?';
  if (r.status !== 0) { failed++; console.log(out); }
  console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'}  ${file.padEnd(24)} pass=${pass} fail=${fail}`);
}
console.log(failed ? `\n${failed} file(s) failed` : '\nall passed');
process.exit(failed ? 1 : 0);
