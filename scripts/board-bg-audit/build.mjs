// בונה את הלוח החודשי האמיתי לחבילה אחת (esbuild) - אותו מתכון כמו scripts/profile-bg-audit/build.mjs.
// ESBUILD_DIR=<תיקיית esbuild> אם אינו ב-node_modules של הפרויקט.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(HERE, '../..');
const req = createRequire(path.join(root, 'package.json'));
let esbuild;
try { esbuild = req(process.env.ESBUILD_DIR || 'esbuild'); } catch { console.error('esbuild לא נמצא (npm i --no-save esbuild או ESBUILD_DIR=...)'); process.exit(1); }
const here = (f) => path.join(HERE, f);
await esbuild.build({
  entryPoints: [here('entry.jsx')], bundle: true, outdir: here('dist'), format: 'iife', jsx: 'automatic',
  loader: { '.js': 'jsx', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  external: ['/design-system/home-bg.jpg', '/design-system/*.jpg', '/design-system/*.png', '/design-system/*.svg', '/fonts/*'],
  alias: { '@': root, 'next/navigation': here('stubs.js'), 'next/link': here('stubs.js'), 'next/image': here('stubs.js') },
  logLevel: 'warning',
  nodePaths: [path.join(root, 'node_modules')],
});
console.log('built', here('dist'));
