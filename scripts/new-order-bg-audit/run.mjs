// הרצה אחת: בונה את אשף ההזמנה החדשה האמיתי, מצלם כל מצב בדף האמיתי ובעיצוב המאושר (הזמנה-חדשה.html) ומדפיס הבדלי
// רקע/צבע/גבול/צל/רדיוס/גופן לפי מצב. שימוש: node scripts/new-order-bg-audit/run.mjs [רוחב=1280]
// פלט: scripts/new-order-bg-audit/out/ (צילומי מסך + JSON). בלי שרת פיתוח, בלי DB. ר' scripts/home-bg-audit/README.md לשיטה.
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
