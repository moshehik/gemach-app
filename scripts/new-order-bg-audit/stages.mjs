// מצלם כל מצב של אשף "הזמנה חדשה" בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט.
// שימוש: node stages.mjs demo|real [רוחב=1280]
// בעיצוב מגיעים לכל מצב דרך הפונקציות שלו (S / go / paint, כמו סרגל הסקירה); בדף האמיתי - בלחיצות ובהקלדה בלבד (מול API מדומה, entry.jsx).
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const D = which === 'demo';
// שורשים: הדף, החלון העליון (#dlg / #dlg2) והטוסט. בעיצוב הדף ב-#app, בדף האמיתי ב-.no-app.
const ROOTS = D ? ['#app', '#scrim.on>#dlg', '#scrim2.on>#dlg2', '#toast.on'] : ['.no-app', '#scrim.on>#dlg', '#scrim2.on>#dlg2', '#toast.on'];
const DUMP = (rootSels) => {
  const out = [];
  const PFX = ['', 'DLG>', 'DLG2>', 'TOAST>'];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  rootSels.forEach((rootSel, ri) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|pulse|drag|ia-h|ia-[a-z0-9-]+|blk|no-[a-z0-9-]+)$/.test(x)).sort().slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return PFX[ri] + p.join('>'); };
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi)$/i.test(el.tagName)) return;
      const bg = cs.backgroundColor, bi = cs.backgroundImage, bf = cs.backdropFilter || cs.webkitBackdropFilter;
      const p = parse(bg); const has = p && p.a > 0;
      const bw = cs.borderTopWidth, bsty = cs.borderTopStyle;
      out.push({ sel: el === root ? (PFX[ri] || 'ROOT') : sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
        col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw + '/' + bsty, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90), rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        fs: cs.fontSize + '/' + cs.fontWeight, pad: cs.padding, h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top + scrollY) });
    });
  });
  return out;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('response', (r) => { if (r.status() === 404) console.log('404', r.url().slice(0, 140)); });
p.on('pageerror', (e) => console.log(which, 'PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log(which, 'CONSOLE', m.type(), m.text().slice(0, 200)); });
const base = D ? DEMO : `http://127.0.0.1:${PORT}/`;
const results = {};
const snap = async (name) => {
  // פוקוס לא נבדק (בדף האמיתי שדה הטלפון מקבל autoFocus כמו בישן; בעיצוב לא) - מורידים אותו בשני הצדדים
  await p.evaluate(() => { const a = document.activeElement; if (a && a !== document.body && !a.closest('#dlg,#dlg2')) a.blur(); });
  await sleep(700);
  await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, fullPage: !D });
  results[name] = await p.evaluate(DUMP, ROOTS);
};
const js = (code) => p.evaluate(code);
const click = async (sel) => { await p.waitForSelector(sel, { timeout: 5000 }); await p.$eval(sel, (el) => { el.scrollIntoView({ block: 'center' }); el.click(); }); await sleep(450); };
const mdown = async (sel) => { await p.waitForSelector(sel, { timeout: 5000 }); await p.$eval(sel, (el) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); await sleep(450); };
const type = async (sel, text) => { await p.waitForSelector(sel, { timeout: 5000 }); await p.focus(sel); await p.keyboard.type(text); await sleep(300); };
const clickText = async (sel, text) => { await p.evaluate((s0, t) => { const el = [...document.querySelectorAll(s0)].find(e => e.textContent.trim() === t || e.textContent.includes(t)); if (!el) throw new Error('no ' + s0 + ' ' + t); el.click(); }, sel, text); await sleep(450); };
const NEXT = '.no-nav .btn.primary';
async function fresh(q = '') {
  await p.goto(base + (D ? '' : q), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2500);
  // בעיצוב: מסירים את שכבת הסקירה (rv*) ומדליקים חלונות כהים (Q2 - הבעלים בחר "כהים"; שכבת הסקירה הציגה בהירים)
  if (D) await p.addStyleTag({ content: '#rvBar,.rv-pop,.rv-b,.rv-ph,.rvb,.rvph,.rvbar{display:none!important}' });
  if (D) await js(() => { try { localStorage.setItem('dlgTheme', 'dark'); } catch (e) { /* */ } document.body.classList.add('dlg-dark'); document.querySelectorAll('#rvBar,.rv-pop,.rv-b,.rv-ph,.rvb,.rvph,#qpanel,.qp-root').forEach(x => x.remove()); if (window.OC) window.OC.paintAll(); });
}
const safe = async (name, fn) => { try { await fn(); await snap(name); } catch (e) { console.log(which, 'STAGE FAIL', name, e.message.slice(0, 160)); } };

await fresh();
await safe('01-phone', async () => {});
await safe('02-list', async () => (D ? js(() => { S.custTab = 'list'; paint('customer'); }) : click('#custSeg button:nth-of-type(2)')));
await safe('03-new', async () => (D ? js(() => { S.custTab = 'new'; paint('customer'); }) : click('#custSeg button:nth-of-type(3)')));
await safe('04-phone-res', async () => {
  if (D) await js(() => { S.custTab = 'phone'; S.phoneQ = '052-3341290'; paint('customer'); document.querySelector('[data-act="phone-search"]').click(); });
  else { await click('#custSeg button:nth-of-type(1)'); await type('#noPhoneQ', '052-3341290'); await click('#phoneRes'); await click('.row .btn.navy'); }
});
// לקוחה + תאריך: אותו יום בשני הצדדים (היום + 12, כמו "מילוי מהיר" בעיצוב)
let dayKey = null;
await safe('05-dates', async () => {
  if (D) await js(() => { S.customer = CUSTOMERS[0]; S.custTab = 'list'; paintAll(); go(2); });
  else { await fresh(); await click('#custSeg button:nth-of-type(2)'); await sleep(600); await click('.hgrp .li.rlink'); await click(NEXT); }
});
await safe('06-dates-sel', async () => {
  if (D) await js(() => { S.ev.date = addDays(TODAY, 12); paintAll(); });
  else {
    dayKey = await js(() => { const d = new Date(); d.setDate(d.getDate() + 12); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    for (let i = 0; i < 2; i++) { if (await p.$(`.hc-d[data-hd="${dayKey}"]`)) break; await click('.hc-nn'); }
    await click(`.hc-d[data-hd="${dayKey}"]`);
  }
});
await safe('07-dates-notes', async () => (D ? js(() => { S.ev.notesOpen = true; paint('dates'); }) : click('details.coll > summary')));
await safe('08-spacing-dlg', async () => (D ? js(() => document.querySelector('#spSeg [data-v="1"]').click()) : click('#spSeg button:nth-of-type(3)')));
// R22: חלון חיפוש התפוסה (נפתח מ"רגע, בדקת מלאי?") - ריק, ואז עם תוצאות. אחר כך חוזרים לחלון הציפוף כדי ששלב 09 יישאר זהה
await safe('08b-capsearch', async () => (D ? js(() => document.querySelector('#spSearch').click()) : clickText('#dlg .btn', 'פתח חיפוש')));
await safe('08c-capsearch-res', async () => {
  if (D) await js(() => { document.querySelector('#csModel').value = '4512'; document.querySelector('#csSize').value = '38'; document.querySelector('#csGo').click(); });
  else { await type('#noCapModel', '4512'); await mdown('#noCapModels .advo'); await p.select('#noCapSize', '38'); await click('#dlg2 button[type=submit]'); await sleep(400); }
});
if (!D) await safe('x3-capsearch-board', async () => { await click('#capView button:nth-of-type(2)'); await sleep(500); });
await safe('08d-back-to-spacing', async () => {
  if (D) await js(() => { closeDlg(); document.querySelector('#spSeg [data-v="1"]').click(); });
  else { await click('#dlg2 .btn.ghost'); await click('#spSeg button:nth-of-type(3)'); }
});
await safe('09-pin-dlg', async () => (D ? js(() => document.querySelector('#spYes').click()) : click('#dlg .btn.primary')));
await safe('10-delivery', async () => {
  if (D) await js(() => { closeDlg(); S.ev.spacing = null; S.ev.notesOpen = false; paintAll(); go(3); });
  else { await click('#dlg .btn.ghost'); await click(NEXT); }
});
await safe('11-delivery-on', async () => {
  if (D) await js(() => { S.del.on = true; S.del.city = 'בית שמש'; paintAll(); });
  else { await click('#noDelOn'); await type('#noDelCity', 'בית שמש'); await js(() => document.activeElement && document.activeElement.blur()); }
});
await safe('12-items', async () => {
  if (D) await js(() => { S.del.on = false; S.del.city = ''; paintAll(); go(4); });
  else { await click('#noDelOn'); await click(NEXT); }
});
await safe('13-items-model', async () => (D ? js(() => { S.add.model = '4512'; paint('items'); }) : mdown('#modelList .advo')));
await safe('14-items-sizes', async () => {
  if (D) await js(() => { S.add.sizes = ['38', '40']; S.add.alt.neck = true; S.add.alt.len = '3'; S.add.alt.note = 'קיצור'; paint('items'); });
  else { await clickText('#addSizes button', '38'); await clickText('#addSizes button', '40'); await click('.altopts .opt'); await type('#noAltLen', '3'); await type('#noAltNote', 'קיצור'); await sleep(600); }
});
await safe('15-items-cart', async () => (D ? js(() => document.querySelector('[data-act="add-cart"]').click()) : click('.addbar .btn.primary')));
// R22: "בדוק תפוסה" לפריט מהסל - רשימה (כמו capacityDlg בעיצוב), ואז הלוח (רק בדף האמיתי)
await safe('15b-capacity', async () => (D ? js(() => document.querySelector('[data-act="capacity"]').click()) : click('.ibtn[aria-label="בדוק תפוסה"]')));
if (!D) await safe('x4-capacity-board', async () => { await click('#capView button:nth-of-type(2)'); await sleep(500); });
await safe('15c-capacity-closed', async () => (D ? js(() => closeDlg()) : click('#dlg2 .btn.ghost')));
await safe('16-summary', async () => (D ? js(() => go(5)) : click(NEXT)));
await safe('17-payment', async () => (D ? js(() => go(6)) : click(NEXT)));
await safe('18-credit', async () => (D ? js(() => document.querySelector('[data-act="credit"]').click()) : clickText('.btn.navy', 'חיוב אשראי')));
await safe('19-exit', async () => {
  if (D) await js(() => { closeDlg(); OC.exitDlg(); });
  else { await click('#dlg .btn.ghost'); await click('.topbar .back'); }
});
await safe('20-success', async () => {
  if (D) { await js(() => { closeDlg(); S.pay.method = 'מזומן'; S.payments.push({ id: 1, method: 'מזומן', icon: 'cash', amt: balance(), note: '' }); finish(true); }); await sleep(2400); }
  else { await click('#dlg .btn.primary'); await clickText('#methods button', 'מזומן'); await click(NEXT); await sleep(1200); }
});
if (!D) {
  // מצבים של הדף בלבד (אין להם מקבילה בעיצוב): הודעת השמירה R29, חוסר מלאי בשינוי תאריך R13, נווה יעקב (ת"ז + דיוור)
  await safe('x1-save409', async () => {
    await fresh('?scn=save409'); await click('#custSeg button:nth-of-type(2)'); await sleep(600); await click('.hgrp .li.rlink'); await click(NEXT);
    for (let i = 0; i < 2; i++) { if (await p.$(`.hc-d[data-hd="${dayKey}"]`)) break; await click('.hc-nn'); }
    await click(`.hc-d[data-hd="${dayKey}"]`); await click(NEXT); await click(NEXT); await mdown('#modelList .advo'); await clickText('#addSizes button', '38');
    await sleep(500); await click('.addbar .btn.primary'); await click(NEXT); await click(NEXT); await clickText('#methods button', 'מזומן'); await click(NEXT); await sleep(1200);
  });
  await safe('x2-org2-new', async () => { await fresh('?org=2'); await click('#custSeg button:nth-of-type(3)'); });
  fs.writeFileSync(`${OUT}/calls-${width}.json`, JSON.stringify(await js(() => window.__calls), null, 1));
}
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results));
await b.close();
if (s) s.close();
console.log(which, width, 'stages', Object.keys(results).length);
