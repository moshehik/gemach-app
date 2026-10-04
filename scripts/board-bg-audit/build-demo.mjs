// בונה את הדמו העצמאי של הלוח החודשי מהרינדור האמיתי (אותו entry.jsx של בדיקות הדפדפן: BoardPage + כל ה-CSS + API מדומה), כקובץ HTML אחד.
// שימוש: ESBUILD_DIR=<תיקיית esbuild> node scripts/board-bg-audit/build-demo.mjs "<נתיב לקובץ היעד>" [קובץ הלו"ז של הדמו, ברירת מחדל לוז-יומי.html]
// הדמו = בדיוק מה שנבנה (אותו קוד), לא העתק ידני: מונים בלבד בתא וברשימה, בלי חלון יום, לחיצה על יום -> דף הלו"ז היומי של הדמו.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(HERE, '../..');
const req = createRequire(path.join(root, 'package.json'));
let esbuild;
try { esbuild = req(process.env.ESBUILD_DIR || 'esbuild'); } catch { console.error('esbuild לא נמצא (ESBUILD_DIR=...)'); process.exit(1); }
const target = process.argv[2];
const schedule = process.argv[3] || 'לוז-יומי.html';
if (!target) { console.error('חסר נתיב יעד'); process.exit(1); }
const here = (f) => path.join(HERE, f);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'board-demo-'));
await esbuild.build({
  entryPoints: [here('entry.jsx')], bundle: true, outdir: out, format: 'iife', jsx: 'automatic', minify: true,
  loader: { '.js': 'jsx', '.svg': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
  external: ['/design-system/*.jpg', '/design-system/*.png', '/design-system/*.svg', '/fonts/*'],
  alias: { '@': root, 'next/navigation': here('stubs.js'), 'next/link': here('stubs.js'), 'next/image': here('stubs.js') },
  logLevel: 'error', nodePaths: [path.join(root, 'node_modules')],
});
const jpg = fs.readFileSync(path.join(root, 'public/design-system/home-bg.jpg')).toString('base64');
const css = fs.readFileSync(path.join(out, 'entry.css'), 'utf8').split('url(/design-system/home-bg.jpg)').join('url(data:image/jpeg;base64,' + jpg + ')');
const js = fs.readFileSync(path.join(out, 'entry.js'), 'utf8').replace(/<\/script/gi, '<\/script');
const html = `<!doctype html>
<html lang="he" dir="rtl" data-theme="light" data-palette="wine">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>לוח חודשי - העיצוב שנבנה</title>
<!-- נוצר אוטומטית: scripts/board-bg-audit/build-demo.mjs. זה הלוח האמיתי (אותו קוד ואותו CSS של האתר) עם נתוני דוגמה; לא עורכים ידנית. -->
<style>${css}</style></head>
<body data-ui-shell="a5"><div class="app-shell"><div class="main"><div class="content" id="root"></div></div></div>
<script>
// לחיצה על יום (גם Ctrl / אמצעי) = הלו"ז היומי של הדמו, עם התאריך אחרי #
(function () {
  var SCHEDULE = ${JSON.stringify(schedule)};
  function go(u) { var m = /date=(\d{4}-\d{2}-\d{2})/.exec(u); location.href = SCHEDULE + (m ? '#' + m[1] : ''); }
  window.__DEMO_GO = go;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="/schedule"]');
    if (!a) return;
    if (e.defaultPrevented) return;
    e.preventDefault(); go(a.getAttribute('href'));
  }, false);
})();
</script>
<script>${js}</script></body></html>`;
fs.writeFileSync(target, html, 'utf8');
console.log('demo written', target, Math.round(html.length / 1024) + 'KB');
