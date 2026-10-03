// בונה את דף הבית האמיתי עם API מדומה גדול (entry.jsx) ל-dist/. דורש esbuild: ESBUILD_DIR=<תיקיית esbuild> (כמו home-bg-audit).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIT = path.resolve(HERE, '../home-bg-audit');
const root = path.resolve(HERE, '../..');
const req = createRequire(path.join(root, 'package.json'));
let esbuild;
try { esbuild = req(process.env.ESBUILD_DIR || 'esbuild'); } catch {
  console.error('esbuild לא נמצא. התקינו אותו (npm i --no-save esbuild) או הגדירו ESBUILD_DIR=<תיקיית esbuild>.');
  process.exit(1);
}
const here = (f) => path.join(HERE, f);
const aud = (f) => path.join(AUDIT, f);
await esbuild.build({
  entryPoints: [here('entry.jsx')], bundle: true, outdir: here('dist'), format: 'iife', jsx: 'automatic',
  loader: { '.js': 'jsx', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  external: ['/design-system/*', '/fonts/*'],
  alias: { '@': root, 'next/navigation': aud('stubs.js'), 'next/link': aud('stubs.js'), 'next/image': aud('stubs.js') },
  plugins: [{ name: 'palette-css', setup(b) { b.onResolve({ filter: /design-system\/components\.css$/ }, () => ({ path: path.join(root, 'design-system/components.css') })); } },
    { name: 'stub-setting-panel', setup(b) { b.onResolve({ filter: /SettingQuickPanel$/ }, () => ({ path: aud('sqp.js') })); } }],
  logLevel: 'warning',
  nodePaths: [path.join(root, 'node_modules')],
});
console.log('built', here('dist'));
