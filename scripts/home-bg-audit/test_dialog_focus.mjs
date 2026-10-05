// בדיקת התנהגות: מיקוד בחלון המדריך (GuideDialog) לא מתאפס כשההורה מצייר מחדש עם onClose חדש (דף הבית מצייר כל הזמן), ו-Escape עדיין סוגר.
// בונה את הרכיב האמיתי עם esbuild (ESBUILD_DIR=<תיקיית esbuild>), Chrome headless, בלי DB ובלי פורט 3000.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launch, sleep, HERE, PORT } from './lib.mjs';
import http from 'node:http';

const root = path.resolve(HERE, '../..');
const req = createRequire(path.join(root, 'package.json'));
const esbuild = req(process.env.ESBUILD_DIR || 'esbuild');
const out = path.join(HERE, 'dist');
fs.mkdirSync(out, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(HERE, 'entry-dialog.jsx')], bundle: true, outfile: path.join(out, 'entry-dialog.js'), format: 'iife', jsx: 'automatic',
  loader: { '.js': 'jsx', '.svg': 'text' }, define: { 'process.env.NODE_ENV': '"development"' }, alias: { '@': root }, logLevel: 'error', nodePaths: [path.join(root, 'node_modules')],
});
const html = '<!doctype html><html dir="rtl"><body><div id="root"></div><script src="entry-dialog.js"></script></body></html>';
const server = await new Promise((r) => { const s = http.createServer((q, res) => { if (q.url.endsWith('entry-dialog.js')) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(fs.readFileSync(path.join(out, 'entry-dialog.js'))); } else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); } }); s.listen(PORT + 2, '127.0.0.1', () => r(s)); });
const browser = await launch();
let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log('  ok  ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.message || e).split('\n')[0]); } };
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT + 2}/`, { waitUntil: 'load' });
await sleep(400);
const active = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.textContent || a.tagName).slice(0, 40) : ''; });
await t('אחרי פתיחה המיקוד על הכפתור הראשון; אחרי Tab על השני', async () => {
  const first = await active(); await page.keyboard.press('Tab'); const second = await active();
  assert.notEqual(first, second);
  await sleep(50);
  globalThis.__second = second;
});
await t('ציור מחדש של ההורה (onClose חדש) לא מחזיר את המיקוד לכפתור הראשון', async () => {
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__bump()); await sleep(120); }
  assert.equal(await active(), globalThis.__second);
});
await t('Escape עדיין סוגר את החלון אחרי ציורים מחדש', async () => {
  await page.keyboard.press('Escape'); await sleep(100);
  assert.equal(await page.evaluate(() => window.__closed()), true);
});
await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
