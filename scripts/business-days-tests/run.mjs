// מריץ את בדיקות "ימים ללא פעילות" (lib/businessDays.js + החיבורים ל-lib/deliveries.js ו-lib/lateReturn.js)
// בכמה אזורי זמן של תהליך (UTC כמו Vercel, ישראל, ושני אזורים קיצוניים) - בלי DB, בלי שרת, בלי כתיבה.
// שימוש (מתוך gemach-app/):
//   node scripts/business-days-tests/run.mjs             # הכל
//   node scripts/business-days-tests/run.mjs deliveries  # רק קבצים שמכילים "deliveries"
//   VERBOSE=1 ...                                        # להדפיס גם פלט של ריצות שעברו
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..', '..');
const filter = process.argv[2] || '';
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs') && f.includes(filter)).sort();
const zones = (process.env.BUSINESS_DAYS_TEST_TZS || 'UTC,Asia/Jerusalem,America/Los_Angeles,Pacific/Kiritimati').split(',');

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
    summary.push(`${ok ? 'OK  ' : 'FAIL'}  TZ=${tz.padEnd(19)} ${file.padEnd(32)} pass=${pass} fail=${fail}`);
    if (!ok || process.env.VERBOSE) console.log(out);
    else { const info = out.match(/^# INFO .*$/gm); if (info) console.log(info.map((l) => `[TZ=${tz}] ${l}`).join('\n')); }
  }
}
console.log('\n' + summary.join('\n'));
console.log(failed ? `\n${failed} run(s) failed` : '\nall runs passed');
process.exit(failed ? 1 : 0);
