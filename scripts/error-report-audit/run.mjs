// הרצה אחת: בונה את החלון האמיתי, מצלם כל מצב בחלון האמיתי ובסקיצה המאושרת (דיווח-שגיאות-סקיצות-2.html) ומדפיס הבדלי
// רקע/צבע/גבול/צל/רדיוס/גופן/ריפוד + מיקום ה-X לפי מצב. שימוש: node scripts/error-report-audit/run.mjs [רוחב=1280]
// פלט: scripts/error-report-audit/out/ (או ER_AUDIT_OUT) - צילומי מסך demo-*/real-*, JSON, cmp-<רוחב>.txt. בלי שרת פיתוח, בלי DB.
// esbuild: ESBUILD_DIR=<נתיב לתיקיית esbuild> (לא תלות של הפרויקט). README.md לשיטה ולהבדלים המכוונים.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, OUT } from './lib.mjs';
const width = process.argv[2] || '1280';
const run = (file, args, outFile) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(HERE, file), ...args], { stdio: outFile ? ['ignore', 'pipe', 'inherit'] : 'inherit', cwd: HERE });
  if (outFile) { const chunks = []; p.stdout.on('data', (c) => chunks.push(c)); p.on('exit', () => fs.writeFileSync(outFile, Buffer.concat(chunks))); }
  p.on('exit', (c) => (c ? reject(new Error(`${file} exit ${c}`)) : resolve()));
});
fs.mkdirSync(OUT, { recursive: true });
await run('build.mjs', []);
await Promise.all([run('stages.mjs', ['demo', width]), run('stages.mjs', ['real', width])]);
await run('cmp.mjs', [width], path.join(OUT, `cmp-${width}.txt`));
const txt = fs.readFileSync(path.join(OUT, `cmp-${width}.txt`), 'utf8');
console.log(txt.split('\n').filter((l) => l.startsWith('==') || l.startsWith('TOTAL') || l.startsWith('EXPECTED')).join('\n'));
