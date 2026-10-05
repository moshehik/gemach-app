// מריץ את כל בדיקות אשף ההזמנה החדשה ב-3 אזורי זמן של תהליך (UTC כמו Vercel, ישראל, ואזור שלילי) - בלי DB, בלי שרת,
// בלי דפדפן, בלי כתיבה. שימוש (מתוך שורש הפרויקט):
//   node scripts/new-order-tests/run.mjs            # הכל
//   node scripts/new-order-tests/run.mjs payload    # רק קבצים שמכילים "payload"
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..', '..');
const filter = process.argv[2] || '';
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs') && f.includes(filter)).sort();
const zones = (process.env.NO_TEST_TZS || 'UTC,Asia/Jerusalem,America/New_York').split(',');

let failed = 0;
const summary = [];
for (const tz of zones) {
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.join(here, 'register.mjs')).href, '--test', path.join(here, file)], {
      cwd: proj, encoding: 'utf8', env: { ...process.env, TZ: tz, PROJ: proj },
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const pass = (out.match(/^[#ℹ] pass (\d+)/m) || [])[1] || '?';
    const fail = (out.match(/^[#ℹ] fail (\d+)/m) || [])[1] || '?';
    const ok = r.status === 0;
    if (!ok) failed++;
    summary.push(`${ok ? 'OK  ' : 'FAIL'}  TZ=${tz.padEnd(17)} ${file.padEnd(28)} pass=${pass} fail=${fail}`);
    if (!ok || process.env.VERBOSE) console.log(out);
  }
}
console.log('\n' + summary.join('\n'));
console.log(failed ? `\n${failed} run(s) failed` : '\nall runs passed');
process.exit(failed ? 1 : 0);
