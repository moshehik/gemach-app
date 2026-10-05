// node probe.mjs real|demo "<js expression returning JSON>" [width] [scn]
import { serve, launch, sleep, PORT, DEMO } from './lib.mjs';
const [which, expr, w = '1280', scn = ''] = process.argv.slice(2);
const s = which === 'real' ? await serve() : null;
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: Number(w), height: 900 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(which === 'real' ? `http://127.0.0.1:${PORT}/${scn ? `?scn=${scn}` : ''}` : DEMO, { waitUntil: 'load' });
await sleep(1500);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close(); if (s) s.close(); process.exit(0);
