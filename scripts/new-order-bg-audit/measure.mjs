// מדידת מלבנים של אלמנטים בטופס הרציף (שכל הגושים מוצגים בו גם נעולים): node measure.mjs <רוחב> <selector>[,<selector>...] - לבדיקות RTL / ריווח
import { serve, launch, sleep, PORT } from './lib.mjs';
const [w, sels = ''] = process.argv.slice(2);
const s = await serve(); const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: Number(w || 375), height: 812 });
await p.goto(`http://127.0.0.1:${PORT}/?layout=continuous`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
for (const sel of sels.split(',')) {
  const r = await p.evaluate((q) => [...document.querySelectorAll(q)].map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { t: Math.round(r.top + scrollY), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right), pad: cs.padding, mar: cs.margin }; }), sel);
  console.log(sel, JSON.stringify(r));
}
await b.close(); s.close();
