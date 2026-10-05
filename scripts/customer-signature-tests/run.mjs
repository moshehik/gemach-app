// מריץ את בדיקות חתימת התקנון ברמת הלקוח (routes / logic / backfill-sql) בכמה אזורי זמן - בלי DB, בלי שרת.
//   node scripts/customer-signature-tests/run.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..', '..');
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();
const zones = (process.env.SIGNATURE_TEST_TZS || 'UTC,Asia/Jerusalem,America/Los_Angeles').split(',');
let failed = 0;
const summary = [];
for (const tz of zones) {
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.join(here, 'register.mjs')).href, '--test', path.join(here, file)], {
      cwd: proj, encoding: 'utf8', env: { ...process.env, TZ: tz, PROJ: proj, SPDIR: here },
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const pass = (out.match(/^ℹ pass (\d+)/m) || [])[1] || '?';
    const fail = (out.match(/^ℹ fail (\d+)/m) || [])[1] || '?';
    const ok = r.status === 0;
    if (!ok) { failed++; console.log(out); }
    summary.push(`${ok ? 'OK  ' : 'FAIL'}  TZ=${tz.padEnd(19)} ${file.padEnd(24)} pass=${pass} fail=${fail}`);
  }
}
console.log('\n' + summary.join('\n'));
console.log(failed ? `\n${failed} run(s) failed` : '\nall runs passed');
process.exit(failed ? 1 : 0);
