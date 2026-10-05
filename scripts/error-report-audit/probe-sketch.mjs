// עזר חד-פעמי: מיקום אייקון הדיווח (#snErr), הסרגל והכפתור הצף בסקיצה, כדי שהדף המדומה יציב את העוגן באותו מקום.
import { launch, sleep, DEMO } from './lib.mjs';
const b = await launch(); const p = await b.newPage();
for (const w of [1280, 375]) {
  await p.setViewport({ width: w, height: w > 600 ? 900 : 812 });
  await p.goto(DEMO, { waitUntil: 'load' }); await sleep(1200);
  const r = await p.evaluate(() => {
    document.querySelector('#erSw').style.display = 'none';
    window.dispatchEvent(new Event('resize'));
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    return { snErr: q('#snErr'), snav: q('#snav') || q('.snav'), pfSave: q('#pfSave'), fab: q('#erFab'), bodyCls: document.body.className, ER: !!window.ER, role: window.ER && window.ER.S.role };
  });
  console.log(w, JSON.stringify(r));
}
await b.close();
