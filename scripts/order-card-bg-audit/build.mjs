// בונה את כרטיס ההזמנה החדש (OrderCardA5 האמיתי + כל ה-CSS הגלובלי של האתר) לחבילה אחת (esbuild) - אותו מתכון כמו
// scripts/profile-bg-audit/build.mjs. esbuild: ESBUILD_DIR=<נתיב לתיקיית node_modules/esbuild> אם אינו מותקן בפרויקט.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(HERE, '../..');
const req = createRequire(path.join(root, 'package.json'));
let esbuild;
try { esbuild = req(process.env.ESBUILD_DIR || 'esbuild'); } catch { console.error('esbuild לא נמצא (ESBUILD_DIR=... או npm i --prefix <תיקייה מחוץ לריפו> esbuild)'); process.exit(1); }
const here = (f) => path.join(HERE, f);
const stubs = here('stubs.js');
await esbuild.build({
  entryPoints: [here('entry.jsx')], bundle: true, outdir: here('dist'), format: 'iife', jsx: 'automatic',
  loader: { '.js': 'jsx', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  external: ['/design-system/*.jpg', '/design-system/*.png', '/design-system/*.svg', '/fonts/*'],
  alias: { '@': root, 'next/navigation': stubs, 'next/link': stubs, 'next/image': stubs },
  logLevel: 'warning',
  nodePaths: [path.join(root, 'node_modules')],
});
console.log('built', here('dist'));
