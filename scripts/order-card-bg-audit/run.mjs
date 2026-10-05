// הרצה אחת: בונה את כרטיס ההזמנה האמיתי, מצלם כל מצב בדף האמיתי ובעיצוב המאושר (כרטיס-הזמנה.html) ומדפיס הבדלי
// רקע/צבע/גבול/צל/רדיוס/גופן/גודל לפי מצב. שימוש: node scripts/order-card-bg-audit/run.mjs [רוחב=1280]
// פלט: scripts/order-card-bg-audit/out/ (צילומי מסך + JSON + calls-<רוחב>.json של קריאות ה-API המדומות). בלי שרת פיתוח, בלי DB.
// esbuild: ESBUILD_DIR=<נתיב ל-node_modules/esbuild> אם אינו בפרויקט. Chrome: CHROME_PATH. פורט: AUDIT_PORT (ברירת מחדל 5185).
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
