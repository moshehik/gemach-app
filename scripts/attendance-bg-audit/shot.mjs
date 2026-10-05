// צילום מהיר של כתובת אחת בשרת הבדיקה (לאבחון): node shot.mjs "<path?query>" <רוחב> <גובה> <שם> ["<JS להרצה לפני הצילום>"]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT } from './lib.mjs';
const [url, w, h, name, js] = process.argv.slice(2);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: +w || 1280, height: +h || 900 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:${PORT}/${url}`, { waitUntil: 'load' });
await sleep(1500);
if (js) { await p.evaluate(js); await sleep(1500); }
await p.screenshot({ path: `${OUT}/shot-${name}.png`, fullPage: false });
console.log('saved', `${OUT}/shot-${name}.png`);
await b.close(); s.close();
process.exit(0);
