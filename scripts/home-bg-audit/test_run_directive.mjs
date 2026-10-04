// בדיקת התנהגות (לא regex): /?run=debts|unsaved על דף בית שנטען מחדש מריץ את החיפוש המתקדם (הזמנות + הדגל) ומנקה את הכתובת.
// בונה את HomeA5 האמיתי (build.mjs), מריץ ב-Chrome headless עם API מדומה, ובודק את הבקשות שיצאו. בלי DB, בלי פורט 3000.
// שימוש: ESBUILD_DIR=<תיקיית esbuild> node scripts/home-bg-audit/test_run_directive.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { serve, launch, sleep, HERE, PORT } from './lib.mjs';

const b = spawnSync(process.execPath, [path.join(HERE, 'build.mjs')], { stdio: 'inherit', cwd: HERE });
if (b.status) process.exit(b.status);
const server = await serve(PORT + 1);
const browser = await launch();
let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log('  ok  ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.message || e).split('\n')[0]); } };
async function open(search) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT + 1}/index.html${search}`, { waitUntil: 'load' });
  await sleep(1500);
  const reqs = (await page.evaluate(() => window.__reqs || [])).filter((u) => /\/api\/a5\/adv/.test(u)).map(decodeURIComponent);
  const url = await page.evaluate(() => location.search);
  const text = await page.evaluate(() => document.body.innerText);
  await page.close();
  return { reqs, url, text };
}
for (const [kind, flag] of [['debts', 'debts'], ['unsaved', 'unsaved']]) {
  await t(`/?run=${kind} על טעינה טרייה: בקשת adv להזמנות עם הדגל, והפרמטר נמחק`, async () => {
    const r = await open('?run=' + kind);
    assert.equal(r.reqs.length, 1, 'בדיוק בקשת adv אחת, נמצאו: ' + JSON.stringify(r.reqs));
    assert.ok(/focus=orders/.test(r.reqs[0]) && r.reqs[0].includes(`"flags":["${flag}"]`), r.reqs[0]);
    assert.equal(r.url, '', 'הפרמטר נמחק מהכתובת');
  });
}
await t('בלי run: אין בקשת adv', async () => { const r = await open(''); assert.equal(r.reqs.length, 0); });
await t('run לא מוכר: אין בקשת adv', async () => { const r = await open('?run=evil'); assert.equal(r.reqs.length, 0); });
await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
