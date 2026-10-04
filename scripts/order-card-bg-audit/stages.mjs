// מצלם כל מצב של כרטיס ההזמנה בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט באזורים
// הנבדקים (ROOTS). שימוש: node stages.mjs demo|real [רוחב=1280]
// גנרי: STAGES = [{name, real?, demo?}] - פונקציה לכל צד (חסרה = לא מצולם בצד הזה). W8 מוסיף שלבים/אזורים כאן.
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const D = which === 'demo';
// אזורי המעטפת (W1): שורת הכותרת, הלשוניות, הטוסט, שני החלונות. התוכן של הלשוניות והרייל - של הזרמים האחרים (W8 מרחיב).
const ROOTS = [['TOP', '#app > .topbar'], ['TABS', '#tabs'], ['TOAST', '#toast'], ['DLG', '#dlg'], ['DLG2', '#dlg2']];
const DUMP = (roots) => {
  const out = [];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  roots.forEach(([label, rootSel]) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { let s = e.tagName.toLowerCase(); const c = [...e.classList].filter((x) => !/^(on|act|pulse|fresh|ia-h|enter|out)$/.test(x) && !/^ia-/.test(x) && !/^(oc|pv)-/.test(x)).sort().slice(0, 3).join('.'); if (c) s += '.' + c; p.unshift(s); e = e.parentElement; } return label + '>' + p.join('>'); };
    const all = [root, ...root.querySelectorAll('*')];
    all.forEach((el) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|mark|bdi|i)$/i.test(el.tagName)) return;
      const bg = cs.backgroundColor, bi = cs.backgroundImage, bf = cs.backdropFilter || cs.webkitBackdropFilter;
      const p = parse(bg); const has = p && p.a > 0;
      const bw = cs.borderTopWidth, bsty = cs.borderTopStyle;
      out.push({ sel: el === root ? label : sel(el), bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').slice(0, 70), bf: bf && bf !== 'none' ? bf : '',
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
p.on('response', (r) => { if (r.status() === 404 && !/\/api\//.test(r.url())) console.log('404', r.url().slice(0, 140)); });
p.on('pageerror', (e) => console.log('PAGEERR', which, e.message));
// כשיש שינויים שלא נשמרו הכרטיס מגן ביציאה (beforeunload) - בהרתמה מאשרים כדי לעבור לשלב הבא
p.on('dialog', (dl) => dl.accept().catch(() => {}));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', which, m.text().slice(0, 200)); });
const results = {};
const snap = async (name) => { await sleep(600); await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, fullPage: false }); results[name] = await p.evaluate(DUMP, ROOTS); };
// לחיצה אמיתית בעכבר; כשהאלמנט מכוסה (בעיצוב: סרגל ההדגמה / כפתור השאלות הצף במסך צר) - el.click() במקום
const clickAt = async (sel) => {
  await p.waitForSelector(sel, { visible: true, timeout: 5000 }); await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(150);
  const r = await p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); const x = bb.left + bb.width / 2, y = bb.top + bb.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, ok: !!hit && (hit === el || el.contains(hit)) }; });
  if (!r.ok) { await p.$eval(sel, (el) => el.click()); return; }
  await p.mouse.move(r.x, r.y); await sleep(120); await p.mouse.click(r.x, r.y);
};
const hover = async (sel) => { await p.$eval(sel, (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(100); const r = await p.$eval(sel, (el) => { const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; }); await p.mouse.move(r.x, r.y); await sleep(400); };
const away = async () => { await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(250); };
async function fresh(scn) {
  await p.goto(D ? DEMO : `http://127.0.0.1:${PORT}/?scn=${scn || 'neve'}`, { waitUntil: 'load' });
  await sleep(1500);
  // בעיצוב: מסתירים את שכבת הסקירה ואת כל מה שצף מעל הדף (סרגל האתר, כפתור השאלות) כדי שריחוף ולחיצה יגיעו לדף עצמו
  if (D) await p.evaluate(() => {
    document.documentElement.classList.add('pv-off');
    const t = document.getElementById('demoTog'); if (t && t.getAttribute('aria-pressed') === 'true') t.click();
    const keep = (el) => el.closest('#app,#scrim,#scrim2,#toast,#tt,#rt');
    document.querySelectorAll('body *').forEach((el) => { const pos = getComputedStyle(el).position; if ((pos === 'fixed' || pos === 'sticky') && !keep(el)) el.style.setProperty('visibility', 'hidden', 'important'); });
    // במסך צר הרייל של העיצוב (גיליון תחתון) מכסה את שורת הכותרת ובולע את הריחוף - לא חלק מהבדיקה של המעטפת
    const rail = document.getElementById('rail'); if (rail && innerWidth < 1024) rail.style.setProperty('pointer-events', 'none', 'important');
  });
  await p.evaluate(() => window.scrollTo(0, 0));
}
const restoreDraft = async () => { await clickAt('.oc-banner .nb-go'); await sleep(300); await p.evaluate(() => { const t = document.querySelector('#toast .tclose'); if (t) t.click(); }); await sleep(400); };
const demoLocked = async () => { await p.select('#pvState', 'locked'); await sleep(400); };
// בעיצוב: חלון הדגמה לפי מזהה ההחלטה (שכבת הסקירה, data-pvgo → WIN[open]) - pv-main עטוף ב-IIFE ולכן אין גישה ישירה ל-WIN
const demoWin = async (id) => { await p.evaluate((x) => { const b = document.createElement('button'); b.dataset.pvgo = x; document.body.append(b); b.click(); b.remove(); }, id); await sleep(500); };

const STAGES = [
  { name: '01-default', real: async () => fresh('neve'), demo: async () => fresh() },
  { name: '02-hover-tab', real: async () => { await fresh('neve'); await hover('#tabs .tab[data-tab="items"]'); }, demo: async () => { await fresh(); await hover('#tabs .tab[data-tab="items"]'); } },
  { name: '03-tab-payments', real: async () => { await fresh('neve'); await clickAt('#tabs .tab[data-tab="payments"]'); await away(); }, demo: async () => { await fresh(); await clickAt('#tabs .tab[data-tab="payments"]'); await away(); } },
  { name: '04-hover-back', real: async () => { await fresh('neve'); await hover('#app > .topbar .back'); }, demo: async () => { await fresh(); await hover('#app > .topbar .back'); } },
  { name: '05-dlg-delete', real: async () => { await fresh('neve'); await clickAt('.tools .xlbtn[data-act="delete"]'); await away(); }, demo: async () => { await fresh(); await clickAt('.tools .xlbtn[data-act="delete"]'); await away(); } },
  { name: '06-toast', real: async () => { await fresh('neve'); await clickAt('.tools .xlbtn.xlg'); await away(); }, demo: async () => { await fresh(); await clickAt('.tools .xlbtn.xlg'); await away(); } },
  { name: '07-locked', real: async () => { await fresh('locked'); await clickAt('.tools .xlbtn[data-act="lockbtn"]'); await away(); }, demo: async () => { await fresh(); await demoLocked(); await clickAt('.tools .xlbtn[data-pvact="lockbtn"]'); await away(); } },
  { name: '08-approval', real: async () => { await fresh('locked'); await clickAt('.tools .xlbtn[data-act="lockbtn"]'); await sleep(300); await clickAt('#dlg .btn.primary'); await sleep(500); await away(); }, demo: async () => { await fresh(); await demoLocked(); await demoWin('R46'); await away(); } },
  { name: '09-approval-picked', real: async () => { await fresh('locked'); await clickAt('.tools .xlbtn[data-act="lockbtn"]'); await sleep(300); await clickAt('#dlg .btn.primary'); await sleep(500); await clickAt('#dlg2 .oc-emps .opt:nth-child(2)'); await p.type('#oc-appr-code', '9'); await sleep(200); }, demo: async () => { await fresh(); await demoLocked(); await demoWin('R46'); await clickAt('#dlg2 .pv-emps .opt:nth-child(2)'); await p.type('#pvAp', '9'); await sleep(200); } },
  { name: '10-conflict', real: async () => { await fresh('conflict'); await restoreDraft(); await clickAt('#rail .btn.primary'); await sleep(700); await away(); }, demo: async () => { await fresh(); await demoWin('R12'); await away(); } },
  { name: '11-stock', real: async () => { await fresh('stock'); await restoreDraft(); await clickAt('#rail .btn.primary'); await sleep(700); await away(); }, demo: async () => { await fresh(); await demoWin('R48'); await away(); } },
  // רק בדף האמיתי (צילום + JSON, בלי השוואה)
  { name: '20-main-org1', real: async () => { await fresh('main'); await away(); } },
  { name: '21-exit-d2', real: async () => { await fresh('draft'); await restoreDraft(); await clickAt('#app > .topbar .back'); await sleep(400); await away(); } },
  { name: '22-deleted', real: async () => { await fresh('deleted'); await away(); } },
  { name: '23-draft-banner', real: async () => { await fresh('draft'); await away(); } },
  { name: '24-missing-debt', real: async () => { await fresh('missing'); await away(); await hover('#tabs .tab[data-tab="details"] .tabmk'); } },
  { name: '25-notfound', real: async () => { await fresh('notfound'); await away(); } },
  { name: '26-loading', real: async () => { await fresh('loading'); await away(); } },
  { name: '27-summary-neve', real: async () => { await fresh('draft'); await restoreDraft(); await clickAt('#rail .btn.primary'); await sleep(700); await away(); } },
  // שחרור נעילה מקצה לקצה: קוד שגוי → הודעה; קוד נכון (1234 במוק) → verify-pin עם context, הלחצן נעלם, טוסט
  { name: '28-unlock-flow', real: async () => {
    await fresh('locked'); await clickAt('.tools .xlbtn[data-act="lockbtn"]'); await sleep(300); await clickAt('#dlg .btn.primary'); await sleep(500);
    await clickAt('#dlg2 .oc-emps .opt:nth-child(1)'); await p.type('#oc-appr-code', '0000'); await p.keyboard.press('Enter'); await sleep(500);
    const msg = await p.$eval('#dlg2 .amsg', (e) => e.textContent);
    await p.type('#oc-appr-code', '1234'); await p.keyboard.press('Enter'); await sleep(700);
    const st = await p.evaluate(() => ({ lock: !!document.querySelector('.tools .xlbtn[data-act="lockbtn"]'), dlg2: document.getElementById('scrim2').classList.contains('on'), toast: (document.querySelector('#toast b') || {}).textContent || '', vp: (window.__calls || []).filter((c) => c.url === '/api/auth/verify-pin').map((c) => JSON.parse(c.body)) }));
    checks.push(['unlock: הודעת קוד שגוי', /סיסמה שגויה/.test(msg)], ['unlock: הלחצן נעלם והחלון נסגר', !st.lock && !st.dlg2], ['unlock: טוסט', st.toast === 'ההזמנה שוחררה לעריכה'],
      ['unlock: verify-pin עם context ו-requiredLevel של הישן', st.vp.length === 2 && st.vp[1].requiredLevel === 'feature:locked_order_edit' && st.vp[1].context && st.vp[1].context.orderId === 53375 && st.vp[1].pin === '<redacted>' && st.vp[1].employeeId === 'e1']);
  } },
  // שמירה מקצה לקצה (ארגון ראשי, בלי D1): PUT עם cardVariant + extraDay והגוף של הישן; אחרי השמירה אין שינויים
  { name: '29-save-flow', real: async () => {
    await fresh('conflict'); await restoreDraft(); await clickAt('#rail .btn.primary'); await sleep(700); await clickAt('#dlg .btn.primary'); await sleep(900);
    const st = await p.evaluate(() => ({ puts: (window.__calls || []).filter((c) => c.method === 'PUT').map((c) => JSON.parse(c.body)), badge: (document.querySelector('#rail .cart .badge') || {}).textContent }));
    checks.push(['save: 409 → דרוס → PUT שני עם overwriteConflict', st.puts.length === 2 && st.puts[1].overwriteConflict === true],
      ['save: cardVariant a5 + extraDay בגוף', st.puts[0].cardVariant === 'a5' && 'extraDay' in st.puts[0] && st.puts[0].notes === 'הערה מטיוטה שלא נשמרה'],
      ['save: אחרי השמירה אין שינויים ברייל', st.badge === '0']);
  } },
];
const checks = [];

for (const st of STAGES) {
  const fn = D ? st.demo : st.real;
  if (!fn) continue;
  try { await fn(); await snap(st.name); } catch (e) { console.log('STAGE-ERR', which, st.name, e.message); }
}
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
if (checks.length) { checks.forEach(([n, ok]) => console.log(ok ? 'CHECK ok  ' : 'CHECK FAIL', n)); if (checks.some(([, ok]) => !ok)) process.exitCode = 1; }
if (!D) fs.writeFileSync(`${OUT}/calls-${width}.json`, JSON.stringify(await p.evaluate(() => window.__calls || []), null, 1));
console.log('done', which, width, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(process.exitCode || 0);
