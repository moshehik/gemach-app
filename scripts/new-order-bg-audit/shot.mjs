// צילום מהיר של מסך אחד (viewport בלבד) של האשף האמיתי: node shot.mjs <רוחב> <שאילתה> <קובץ-פלט> [גלילה-ל-selector]
import { serve, launch, sleep, PORT } from './lib.mjs';
const [w, q = '', out = 'out/shot.png', sel] = process.argv.slice(2);
const s = await serve(); const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: Number(w || 375), height: 812, deviceScaleFactor: 1 });
await p.goto(`http://127.0.0.1:${PORT}/${q}`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
if (sel) { await p.$eval(sel, (el) => el.scrollIntoView({ block: 'start' })); await sleep(600); }
await p.screenshot({ path: out });
await b.close(); s.close();
