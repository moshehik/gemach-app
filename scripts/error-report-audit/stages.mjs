// מצלם כל מצב של חלון "דיווח על שגיאות" בסקיצה המאושרת (demo) ובחלון האמיתי (real) ושומר את ה-computed style של כל אלמנט.
// שימוש: node stages.mjs demo|real [רוחב=1280]
// בסקיצה המצבים נבחרים דרך window.ER.setState (סרגל ההדגמה מוסתר, כך ש---er-sw-vis = 0 כמו באתר); בחלון האמיתי - בלחיצות אמיתיות
// על הדף המדומה (entry.jsx) עם API מדומה. השוואה: cmp.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, PORT, DEMO, OUT } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const D = which === 'demo';
const NARROW = width <= 640;
fs.mkdirSync(OUT, { recursive: true });
const ROOTS = ['#erPop', '#erBig', '#scrim', '#scrim2', '#toast', '#erLayer', '#erPill', '#erRec'];
const DUMP = (rootSels) => {
  const out = [];
  const IGN = /^(on|er-anim|fresh|pulse|reveal|flash|dlg-dark|up|ia-h|ia-in|ia-dr|ia-bg)$/; // מחלקות מצב/הנפשה חולפות
  rootSels.forEach((rootSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const rr = root.getBoundingClientRect();
    if (!rr.width || !rr.height) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !IGN.test(x)).sort().slice(0, 4).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return rootSel + (p.length ? '>' + p.join('>') : ''); };
    [root, ...root.querySelectorAll('*')].forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|bdi|br)$/i.test(el.tagName)) return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const bg = cs.backgroundColor; const m = bg.match(/rgba?\(([^)]+)\)/); const a = m ? (m[1].split(/[ ,/]+/).map(Number)[3] ?? 1) : 0;
      const bw = cs.borderTopWidth; const bst = cs.borderTopStyle;
      out.push({
        sel: sel(el), bg: a > 0 ? bg.replace(/ /g, '') : '', bi: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.replace(/ /g, '').slice(0, 80),
        bf: cs.backdropFilter && cs.backdropFilter !== 'none' ? cs.backdropFilter : '', col: cs.color.replace(/ /g, ''),
        bd: bst === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw + '/' + bst, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 100),
        rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''), fs: cs.fontSize + '/' + cs.fontWeight,
        pad: cs.padding, h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top),
        sbw: el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(cs.overflowY) ? String(el.offsetWidth - el.clientWidth - (parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth))) : '',
        txt: el.children.length === 0 ? (el.textContent || '').trim().slice(0, 40) : '',
      });
    });
  });
  return out;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: NARROW ? 812 : 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
p.on('pageerror', (e) => console.log('PAGEERR', which, e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) console.log('CONSOLE', which, m.text().slice(0, 200)); });
const results = {};
const snap = async (name, wait = 1100) => { // אחרי הנפשות הכניסה של האייקונים בסקיצה (ia-in, עד ~900ms)
  await sleep(wait);
  await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png` });
  results[name] = await p.evaluate(DUMP, ROOTS);
};
const center = async (sel) => p.$eval(sel, (el) => { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
const clickAt = async (sel) => { const c = await center(sel); await p.mouse.move(c.x, c.y); await sleep(80); await p.mouse.click(c.x, c.y); await sleep(250); };
const hover = async (sel) => { const c = await center(sel); await p.mouse.move(c.x, c.y); await sleep(450); };
const away = async () => { await p.mouse.move(2, NARROW ? 700 : 880); await sleep(150); };
const typeIn = async (sel, t) => { await p.focus(sel); await p.keyboard.type(t, { delay: 0 }); };

// ---------------- demo ----------------
async function demo(state, opts = {}) {
  await p.goto(DEMO, { waitUntil: 'load' });
  await sleep(700);
  await p.evaluate(() => { document.querySelector('#erSw').style.display = 'none'; const t = document.querySelector('#toast'); if (t) t.classList.remove('on'); window.dispatchEvent(new Event('resize')); });
  if (opts.prog) await p.evaluate(() => { window.ER.S.role = 'programmer'; });
  if (opts.norec) await p.evaluate(() => { window.ER.S.rec = false; });
  await p.evaluate((n) => window.ER.setState(n), state);
  await sleep(500);
}
// ---------------- real ----------------
async function real(q = '') {
  await p.goto(`http://127.0.0.1:${PORT}/?${q}`, { waitUntil: 'load' });
  await sleep(600);
}
const openCard = async () => { await clickAt('#snErr'); await sleep(500); };
const openPanel = async () => { await openCard(); await clickAt('.er-inb'); await sleep(500); };
const openRow = async (id) => { await clickAt(`.er3-r[data-id="${id}"]`); await sleep(500); };
const pickSave = async () => { await clickAt('.er-cb[data-act="pick"]'); await sleep(200); await clickAt('#pfSave'); await sleep(900); await p.evaluate(() => window.scrollTo(0, 0)); };

// מילוי הטופס כמו "מלא" בסקיצה: טקסט, אלמנט מסומן, קובץ PDF והקלטת פעולות
const fillReal = async (txt) => {
  await typeIn('#erTx', txt); await pickSave();
  const [fc] = await Promise.all([p.waitForFileChooser(), clickAt('.er-cb[data-act="file"]')]); await fc.accept([path.join(OUT, 'דוח-שגיאה.pdf')]); await sleep(500);
  await clickAt('.er-cb[data-act="steps"]'); await clickAt('#firstName'); await clickAt('#other'); await clickAt('#pfSave'); await clickAt('#other'); await clickAt('#erRec .btn'); await sleep(500);
};
const STATES = [
  ['01-empty', async () => { if (D) await demo('empty'); else { await real(); await openCard(); } await away(); }],
  ['02-filled', async () => {
    if (D) await demo('filled');
    else {
      await real(); await openCard(); await fillReal('לחצתי על "שמירת פרטים" והדף נשאר תקוע, בלי הודעה.');
    }
    await away();
  }],
  ['03-picked', async () => { if (D) await demo('picked'); else { await real(); await openCard(); await typeIn('#erTx', 'לחצתי על שמירה והדף קפא'); await pickSave(); } await away(); }],
  ['04-picking', async () => { if (D) { await demo('picking'); } else { await real(); await openCard(); await typeIn('#erTx', 'לחצתי על שמירה והדף קפא'); await clickAt('.er-cb[data-act="pick"]'); await hover('#pfSave'); } }],
  ['05-recording', async () => { if (D) await demo('recording'); else { await real(); await openCard(); await clickAt('.er-cb[data-act="steps"]'); await clickAt('#firstName'); await clickAt('#other'); } await away(); }],
  ['06-invalid', async () => { if (D) await demo('invalid'); else { await real(); await openCard(); await clickAt('.er-send'); } await away(); }],
  ['07-sending', async () => { if (D) await demo('sending'); else { await real('post=slow'); await openCard(); await fillReal('לחצתי על "שמירת פרטים" והדף נשאר תקוע, בלי הודעה.'); await clickAt('.er-send'); } await away(); }],
  ['08-fail', async () => { if (D) await demo('fail'); else { await real('post=fail'); await openCard(); await fillReal('לחצתי על "שמירת פרטים" והדף נשאר תקוע, בלי הודעה.'); await clickAt('.er-send'); await sleep(300); } await away(); }],
  ['09-success', async () => { if (D) await demo('titleFail'); else { await real(); await openCard(); await typeIn('#erTx', 'לחצתי על "שמירת פרטים" והדף נשאר תקוע, בלי הודעה.'); await clickAt('.er-send'); await sleep(900); } await away(); }],
  ['10-list', async () => { if (D) await demo('list'); else { await real(); await openPanel(); } await away(); }],
  ['11-many', async () => { if (D) await demo('many'); else { await real('data=many'); await openPanel(); } await away(); }],
  ['12-listEmpty', async () => { if (D) await demo('listEmpty'); else { await real('data=empty'); await openPanel(); } await away(); }],
  ['13-archive', async () => { if (D) await demo('archive'); else { await real(); await openPanel(); await clickAt('.er3-lnk'); } await away(); }],
  ['14-thread', async () => { if (D) await demo('thread'); else { await real(); await openPanel(); await openRow('r1'); } await away(); }],
  ['15-threadLong', async () => { if (D) await demo('threadLong'); else { await real(); await openPanel(); await openRow('rL'); } await away(); }],
  ['16-thread2', async () => { if (D) await demo('thread2'); else { await real(); await openPanel(); await openRow('r2'); } await away(); }],
  ['17-thread3', async () => { if (D) await demo('thread3'); else { await real(); await openPanel(); await openRow('r3'); } await away(); }],
  ['18-denied', async () => { if (D) await demo('denied'); else { await real('role=user'); await openCard(); } await away(); }],
  ['19-prog-thread2', async () => { if (D) await demo('thread2', { prog: true }); else { await real('role=programmer'); await openPanel(); await openRow('r2'); } await away(); }],
  ['20-lightbox', async () => { if (D) { await demo('thread'); } else { await real(); await openPanel(); await openRow('r1'); } await clickAt('.er3-co'); await sleep(400); await away(); }],
  ['21-icons-hover', async () => { if (D) await demo('empty'); else { await real(); await openCard(); } await hover('#erTx'); }],
  ['22-reply-hover', async () => { if (D) await demo('thread'); else { await real(); await openPanel(); await openRow('r1'); } await hover('#erRt'); }],
];
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
if (!D && !fs.existsSync(path.join(OUT, 'דוח-שגיאה.pdf'))) fs.writeFileSync(path.join(OUT, 'דוח-שגיאה.pdf'), '%PDF-1.1 mock');
for (const [name, fn] of STATES) {
  if (only && !only.test(name)) continue;
  try { await fn(); await snap(name); } catch (e) { console.log('STATE-FAIL', which, width, name, e.message.slice(0, 200)); results[name] = []; }
}
const file = `${OUT}/${which}-${width}.json`;
const prev = only && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
fs.writeFileSync(file, JSON.stringify({ ...prev, ...results }, null, 1));
console.log('done', which, width, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(0);
