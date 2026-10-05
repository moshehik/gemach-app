// הרצה אחת: בונה את "סיכום נוכחות" האמיתי, מצלם כל מצב בדף האמיתי ובעיצוב המאושר (סיכום-נוכחות.html) ומדפיס הבדלי
// סגנון לפי מצב (cmp.mjs). שימוש: node scripts/attendance-bg-audit/run.mjs [רוחב=1280]  (ESBUILD_DIR=<תיקיית esbuild> אם אין ב-node_modules)
// פלט: scripts/attendance-bg-audit/out/ (צילומי מסך + JSON). בלי שרת פיתוח, בלי DB. הדף המודפס: print.mjs.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { HERE } from './lib.mjs';
const width = process.argv[2] || '1280';
const run = (file, args) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(HERE, file), ...args], { stdio: 'inherit', cwd: HERE });
  p.on('exit', (c) => (c ? reject(new Error(`${file} exit ${c}`)) : resolve()));
});
await run('build.mjs', []);
await Promise.all([run('stages.mjs', ['demo', width]), run('stages.mjs', ['real', width])]);
await run('cmp.mjs', [width]);
