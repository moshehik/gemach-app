// בונה את דף בדיקת המלאי האמיתי לחבילה אחת (esbuild) - אותו מתכון כמו scripts/home-bg-audit/build.mjs.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(HERE, '../..');
const req = createRequire(path.join(root, 'package.json'));
let esbuild;
try { esbuild = req(process.env.ESBUILD_DIR || 'esbuild'); } catch { console.error('esbuild לא נמצא (npm i --no-save esbuild או ESBUILD_DIR=...)'); process.exit(1); }
const here = (f) => path.join(HERE, f);
const stubs = path.join(root, 'scripts/home-bg-audit/stubs.js');
await esbuild.build({
  entryPoints: [here('entry.jsx')], bundle: true, outdir: here('dist'), format: 'iife', jsx: 'automatic',
  loader: { '.js': 'jsx', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  external: ['/design-system/*', '/fonts/*'],
  alias: { '@': root, 'next/navigation': stubs, 'next/link': stubs, 'next/image': stubs },
  logLevel: 'warning',
  nodePaths: [path.join(root, 'node_modules')],
});
console.log('built', here('dist'));
