// הרצה אחת: בונה את מסך הניהול הראשי האמיתי, מצלם כל מצב (אריחים / שורות / טבלה, ריחוף, חיפוש, אין תוצאות) בדף האמיתי
// ובעיצוב המאושר (ניהול-ראשי-כרטיסים.html) ומדפיס הבדלי רקע/צבע/גבול/צל/רדיוס/גופן לפי מצב.
// שימוש: node scripts/admin-hub-audit/run.mjs [רוחב=1280]   (ESBUILD_DIR=<תיקייה עם node_modules/esbuild> אם esbuild לא מותקן)
// פלט: scripts/admin-hub-audit/out/ (צילומי מסך + JSON). בלי שרת פיתוח, בלי DB. בדיקת התנהגות ותפקידים: interact.mjs.
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
