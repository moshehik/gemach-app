// צילום מסך של חלון התצוגה בלבד (לא כל הדף): node shotv.mjs real|demo [width] [height] [scn]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const [which = 'real', w = '1280', h = '1400', scn = ''] = process.argv.slice(2);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const s = which === 'real' ? await serve() : null;
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: Number(w), height: Number(h) });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(which === 'real' ? `http://127.0.0.1:${PORT}/${scn ? `?scn=${scn}` : ''}` : DEMO, { waitUntil: 'load' });
await sleep(1500);
if (which === 'demo') await p.evaluate(() => { document.querySelectorAll('.demo,.demo-tog-row,#demoBar,[class*="rv-"],[id^="rv"],.qp-root,#qpanel').forEach((e) => e.remove()); const a = document.querySelector('#app'); if (a) a.scrollIntoView(); });
await sleep(300);
await p.screenshot({ path: `${OUT}/v-${which}-${w}${scn ? '-' + scn : ''}.png` });
await b.close(); if (s) s.close(); process.exit(0);
