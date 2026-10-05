// בדיקת עשן מהירה: פותח את החלון האמיתי בדף המדומה, מצלם, ומדפיס שגיאות דפדפן. node smoke.mjs [query] [רוחב]
import { serve, launch, sleep, PORT, OUT } from './lib.mjs';
import fs from 'node:fs';
const q = process.argv[2] || '';
const w = Number(process.argv[3] || 1280);
fs.mkdirSync(OUT, { recursive: true });
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: w, height: w > 600 ? 900 : 812 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${PORT}/?${q}`, { waitUntil: 'load' });
await sleep(800);
await p.click(process.argv[4] || '#snErr');
await sleep(1200);
await p.screenshot({ path: `${OUT}/smoke-${w}.png` });
console.log(await p.evaluate(() => ({ pop: !!document.querySelector('#erPop'), dlg: document.querySelector('#dlg') && document.querySelector('#dlg').className, txt: (document.querySelector('.gm-er') || {}).textContent?.slice(0, 200) })));
await b.close(); s.close();
