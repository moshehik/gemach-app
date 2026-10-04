import { serve, launch, sleep, PORT } from './lib.mjs';
const s = await serve(); const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' }); await sleep(1500);
const r = await p.$eval('.rail [data-rich=pay]', (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + 10, y: bb.top + 10 }; });
await p.mouse.move(r.x, r.y); await sleep(500);
console.log(await p.evaluate(() => { const rt = document.querySelector('#rt'); return [rt.className, rt.parentElement.className, getComputedStyle(rt).backgroundColor]; }));
await b.close(); s.close(); process.exit(0);
