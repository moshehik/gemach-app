// הרצה אחת: בונה את דף הלו״ז האמיתי, מצלם כל מצב בדף האמיתי ובעיצוב (לוז-יומי.html), ומדפיס הבדלי סגנון/מבנה/יישור לפי מצב.
// שימוש: node scripts/schedule-bg-audit/run.mjs [רוחב=1280]
// פלט: scripts/schedule-bg-audit/out/ (צילומי מסך + JSON + report-<רוחב>.md). אין לשנות כלום באתר, אין שרת פיתוח, אין DB.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { HERE } from './lib.mjs';

const width = process.argv[2] || '1280';
const run = (file, args) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(HERE, file), ...args], { stdio: 'inherit', cwd: HERE });
  p.on('exit', (c) => (c ? reject(new Error(`${file} exit ${c}`)) : resolve()));
});
if (!process.env.SKIP_BUILD) await run('build.mjs', []);
await Promise.all([run('stages.mjs', ['demo', width]), run('stages.mjs', ['real', width])]);
await run('cmp.mjs', [width]);
