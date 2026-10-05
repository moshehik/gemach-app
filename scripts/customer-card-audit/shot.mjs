// צילום מהיר: node shot.mjs real|demo [width] [scn] -> out/shot-<which>-<w>.png
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const [which = 'real', w = '1280', scn = ''] = process.argv.slice(2);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const s = which === 'real' ? await serve() : null;
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: Number(w), height: 900 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.goto(which === 'real' ? `http://127.0.0.1:${PORT}/${scn ? `?scn=${scn}` : ''}` : DEMO, { waitUntil: 'load' });
await sleep(1500);
await p.screenshot({ path: `${OUT}/shot-${which}-${w}${scn ? '-' + scn : ''}.png`, fullPage: true });
await b.close(); if (s) s.close(); process.exit(0);
