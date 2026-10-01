// מריץ את כל בדיקות הלו״ז ב-3 אזורי זמן של תהליך (UTC כמו Vercel, ישראל, ואזור שלילי) - בלי DB,
// בלי שרת פיתוח, בלי כתיבה. שימוש (מתוך gemach-app/):
//   node scripts/schedule-tests/run.mjs            # הכל
//   node scripts/schedule-tests/run.mjs dates      # רק קבצים שמכילים "dates"
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..', '..');
const filter = process.argv[2] || '';
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs') && f.includes(filter)).sort();
const zones = (process.env.SCHEDULE_TEST_TZS || 'UTC,Asia/Jerusalem,America/New_York').split(',');

let failed = 0;
const summary = [];
for (const tz of zones) {
  for (const file of files) {
    // --import חייב להיות file:// URL (ב-Windows נתיב מוחלט נקרא כ-scheme "c:")
    const r = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.join(here, 'register.mjs')).href, '--test', path.join(here, file)], {
      cwd: proj, encoding: 'utf8', env: { ...process.env, TZ: tz, PROJ: proj, SPDIR: here },
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
