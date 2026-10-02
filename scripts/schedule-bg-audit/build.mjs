// בונה את דף הלו״ז האמיתי (ScheduleDay + schedule.css + הפלטה + כל ה-CSS הגלובלי של האתר) לחבילה אחת שנטענת בדפדפן,
// עם API מדומה (entry.jsx). דורש esbuild: ברירת מחדל מה-node_modules של הפרויקט; אחרת ESBUILD_DIR=<נתיב לתיקיית esbuild>.
import { createRequire } from 'node:module';
import path from 'node:path';
import { HERE } from './lib.mjs';

const root = path.resolve(HERE, '../..');
const req = createRequire(path.join(root, 'package.json'));
let esbuild;
try { esbuild = req(process.env.ESBUILD_DIR || 'esbuild'); } catch {
  console.error('esbuild לא נמצא. התקינו אותו (npm i --no-save esbuild) או הגדירו ESBUILD_DIR=<תיקיית esbuild>.');
  process.exit(1);
}
const here = (f) => path.join(HERE, f);
const stubs = path.join(root, 'scripts', 'home-bg-audit', 'stubs.js');
await esbuild.build({
  entryPoints: [here('entry.jsx')], bundle: true, outdir: here('dist'), format: 'iife', jsx: 'automatic',
  loader: { '.js': 'jsx', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  alias: { '@': root, 'next/navigation': stubs, 'next/link': stubs, 'next/image': stubs },
  // url(/design-system/home-bg.jpg) וכד' בתוך ה-CSS נשארים כמו שהם (השרת הסטטי מגיש אותם מ-public/); ייבוא JS של
  // design-system/components.css (menuParts.js) כן נארז - לכן לא external גורף על /design-system/* כמו בדף הבית.
  plugins: [{ name: 'public-urls', setup(b) { b.onResolve({ filter: /^\/(design-system|fonts)\// }, (a) => (a.kind === 'url-token' || a.kind === 'import-rule' ? { path: a.path, external: true } : undefined)); } }],
  logLevel: 'warning',
  nodePaths: [path.join(root, 'node_modules')],
});
console.log('built', here('dist'));
