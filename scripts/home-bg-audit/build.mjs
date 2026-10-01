// בונה את דף הבית האמיתי (HomeA5 + home.css + קבצי ה-CSS הגלובליים של האתר) לחבילה אחת שנטענת בדפדפן, עם API מדומה (entry.jsx).
// דורש esbuild: ברירת מחדל מה-node_modules של הפרויקט; אחרת ESBUILD_DIR=<נתיב לתיקיית esbuild>.
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
await esbuild.build({
  entryPoints: [here('entry.jsx')], bundle: true, outdir: here('dist'), format: 'iife', jsx: 'automatic',
  loader: { '.js': 'jsx', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  external: ['/design-system/*', '/fonts/*'],
  alias: { '@': root, 'next/navigation': here('stubs.js'), 'next/link': here('stubs.js'), 'next/image': here('stubs.js') },
  plugins: [{ name: 'stub-setting-panel', setup(b) { b.onResolve({ filter: /SettingQuickPanel$/ }, () => ({ path: here('sqp.js') })); } }],
  logLevel: 'warning',
  nodePaths: [path.join(root, 'node_modules')],
});
console.log('built', here('dist'));
