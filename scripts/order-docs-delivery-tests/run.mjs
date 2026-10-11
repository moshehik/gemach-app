// מריץ את בדיקות מסמכי המשלוח ב-3 אזורי זמן (UTC כמו Vercel, ישראל, שלילי) - בלי DB ובלי שרת.  node scripts/order-docs-delivery-tests/run.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..', '..');
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const tz of ['UTC', 'Asia/Jerusalem', 'America/New_York']) {
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.join(here, 'register.mjs')).href, '--test', path.join(here, file)], { cwd: proj, encoding: 'utf8', env: { ...process.env, TZ: tz, PROJ: proj } });
    const out = (r.stdout || '') + (r.stderr || '');
    const pass = (out.match(/^[#ℹ] pass (\d+)/m) || [])[1] || '?';
    const fail = (out.match(/^[#ℹ] fail (\d+)/m) || [])[1] || '?';
    if (r.status !== 0) { failed++; console.log(out); }
    console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'} TZ=${tz.padEnd(17)} ${file.padEnd(30)} pass=${pass} fail=${fail}`);
  }
}
process.exit(failed ? 1 : 0);
