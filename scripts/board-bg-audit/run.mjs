// הבדיקה המלאה של הלוח החודשי בפקודה אחת (בלי שרת פיתוח, בלי DB): בנייה (esbuild), בדיקת התנהגות בדפדפן (interact.mjs),
// השוואת computed style מול העיצוב המאושר ב-1280 וב-375 (cmp.mjs), וצילומי מסך של כל החלונות (views.mjs -> out/).
// שימוש: ESBUILD_DIR=<תיקיית esbuild> node scripts/board-bg-audit/run.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './lib.mjs';
const run = (file, args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [path.join(HERE, file), ...args], { stdio: 'inherit', cwd: HERE });
  p.on('exit', (c) => resolve(c || 0));
});
const out = path.join(HERE, 'out'); fs.mkdirSync(out, { recursive: true });
let bad = 0;
if (await run('build.mjs', [])) process.exit(1);
bad += await run('interact.mjs', []);
bad += await run('cmp.mjs', ['1280']);
bad += await run('cmp.mjs', ['375']);
bad += await run('phone.mjs', ['375,390,320']);
await run('views.mjs', ['1280', out]);
await run('views.mjs', ['375', out]);
console.log(bad ? '\nנכשל' : '\nהכול עבר; צילומים ב-' + out);
process.exit(bad ? 1 : 0);
