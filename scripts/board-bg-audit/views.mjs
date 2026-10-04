// צילומי מסך של המצבים של הלוח האמיתי (API מדומה): לוח, מסנן פתוח, בורר חודשים, רשימה, טעינה, שער (אין חלונות נוספים - BD-O3).
// שימוש: node views.mjs <רוחב> <תיקיית פלט>
import { serve, launch, sleep, PORT } from './lib.mjs';
const width = Number(process.argv[2] || 1280);
const out = process.argv[3];
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900 });
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 300)); });
const go = async (scn) => { await p.goto(`http://127.0.0.1:${PORT}/${scn ? '?scn=' + scn : ''}`, { waitUntil: 'load' }); await sleep(1300); };
const shot = async (name, full = false) => { await sleep(450); await p.screenshot({ path: `${out}/v-${width}-${name}.png`, fullPage: full }); };
const click = async (sel) => { await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' })); await sleep(120); await p.click(sel); await sleep(250); };
const hover = async (sel) => { await p.$eval(sel, (e) => e.scrollIntoView({ block: 'center' })); await sleep(120); await p.hover(sel); await sleep(350); };

await go('');
await shot('01-board', true);
await click('#bdSearch .hf-t'); await shot('02-filter-open');
await click('#bdSearch .hf-o:nth-child(3)'); await click('#bdSearch .hf-o:nth-child(4)'); await p.mouse.click(5, 5); await shot('03-filter-2sel');
await go('');
await click('#mJump'); await shot('04-month-picker');
await p.keyboard.press('Escape');
await go('');
await click('#mvsw .vopt:nth-child(3)'); await shot('05-list', true);
await go('loading'); await shot('06-loading');
await go('gate'); await shot('07-gate');
await go('guest'); await shot('08-guest');
console.log(errs.join('\n') || 'no errors');
await b.close(); s.close(); process.exit(0);
