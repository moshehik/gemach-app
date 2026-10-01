// הרצה אחת: בונה את הדף האמיתי, מצלם כל שלב בדף האמיתי ובעיצוב (דף-הבית.html), ומדפיס הבדלי רקע/צבע/גבול/צל לפי שלב.
// שימוש: node scripts/home-bg-audit/run.mjs [רוחב=1280] [light|dark]
// פלט: scripts/home-bg-audit/out/ (צילומי מסך + JSON). אין לשנות כלום באתר, אין שרת פיתוח, אין DB.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { HERE } from './lib.mjs';

const width = process.argv[2] || '1280';
const theme = process.argv[3] || 'light';
const run = (file, args) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(HERE, file), ...args], { stdio: 'inherit', cwd: HERE });
  p.on('exit', (c) => (c ? reject(new Error(`${file} exit ${c}`)) : resolve()));
});
await run('build.mjs', []);
await Promise.all([run('stages.mjs', ['demo', width, theme]), run('stages.mjs', ['real', width, theme])]);
await run('cmp.mjs', [width, theme]);
