// הרצה אחת: בונה את כרטיס העובד האמיתי, מצלם כל מצב בדף האמיתי ובעיצוב המאושר (כרטיס-עובד-ניהול.html) ומדפיס הבדלי computed style.
// שימוש: node scripts/employee-card-audit/run.mjs [רוחב=1280]   (ESBUILD_DIR=... אם esbuild לא מותקן). בלי שרת פיתוח, בלי DB, API מדומה.
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
