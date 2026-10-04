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
async function fresh(scn, extra = '') {
  await p.goto(D ? DEMO : `http://127.0.0.1:${PORT}/?scn=${scn || 'neve'}${extra}`, { waitUntil: 'load' });
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


// ---- W7 (מסמכים): תפריט הדפסה, שער תקנון, כתובת מייל חסרה, מייל מהיר, ייצוא ----
const SHEET_TMP = path.join(OUT, 'extra-file.pdf'); fs.writeFileSync(SHEET_TMP, '%PDF-1.4 extra');
const openMenu = async () => { await clickAt('.tools .xlbtn.xlp'); await sleep(350); };
// בעיצוב: לחצן התפריט מציג קודם את שער התקנון כשההזמנה לא חתומה - "כן, חתם" פותח את התפריט
const demoMenu = async () => { await clickAt('.tools [data-act="menu"]'); await sleep(350); if (await p.$('#scrim.on')) { await clickAt('[data-pvact="regs-yes"]'); await sleep(600); } };
const qmButton = '#qm-host [data-act="mail-open"]';
const openQuick = async (scn = 'unsignedq') => { await fresh(scn, '&qmhost=1'); await clickAt(qmButton); await sleep(800); };
const calls = () => p.evaluate(() => window.__calls || []);
const emailPosts = async () => (await calls()).filter((c) => c.url === '/api/orders/53375/email' && c.method === 'POST' && !/returnHtmlOnly/.test(c.body)).map((c) => JSON.parse(c.body));
const toastText = () => p.evaluate(() => (document.querySelector('#toast b') || {}).textContent || '');
// הטוסט נעלם אחרי 2.6 ש׳ - בודקים בדגימה חוזרת עד שהוא מופיע (המכונה/הרוחב משנים את זמן ההכנה של ה-PDF)
const waitToast = async (re, ms = 9000) => { const t0 = Date.now(); let t = ''; while (Date.now() - t0 < ms) { t = await toastText(); if (re.test(t)) return t; await sleep(150); } return t; };
const mailFlow = {
  fillQuick: async () => { await p.type('#m-body', 'שלום, הזמנה #53375 מוכנה.'); await clickAt('.mfile[data-id="ord"]'); await clickAt('.mfile[data-id="pay"]'); await away(); },
};

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

  // ---------- W7: מסמכים (תפריט הדפסה, שער תקנון, מייל חסר, מייל מהיר) - מושווים לעיצוב ----------
  { name: '40-regs-gate', real: async () => { await fresh('unsignedq'); await clickAt('.tools .xlbtn.xlp'); await sleep(500); await away(); }, demo: async () => { await fresh(); await clickAt('.tools [data-act="menu"]'); await sleep(500); await away(); } },
  { name: '41-print-menu', real: async () => { await fresh('signed'); await openMenu(); await away(); }, demo: async () => { await fresh(); await demoMenu(); await away(); } },
  { name: '42-print-menu-hover', real: async () => { await fresh('signed'); await openMenu(); await hover('#pmenu button:nth-child(1)'); }, demo: async () => { await fresh(); await demoMenu(); await hover('#pmenu button:nth-child(1)'); } },
  { name: '43-missing-email', real: async () => { await fresh('missmail'); await openMenu(); await clickAt('#pmenu [data-act="pm-mail-order"]'); await sleep(500); await away(); }, demo: async () => { await fresh(); await demoWin('R6'); await away(); } },
  { name: '44-mail-quick', real: async () => { await openQuick(); await away(); }, demo: async () => { await fresh(); await demoWin('A8'); await away(); } },
  { name: '45-mail-filled', real: async () => { await openQuick(); await mailFlow.fillQuick(); }, demo: async () => { await fresh(); await demoWin('A8'); await mailFlow.fillQuick(); } },
  { name: '46-mail-preview', real: async () => { await openQuick(); await clickAt('.mfe[data-id="ord"]'); await away(); }, demo: async () => { await fresh(); await demoWin('A8'); await clickAt('.mfe[data-id="ord"]'); await away(); } },
  // רק בדף האמיתי: תפריט בארגון בלי משלוחים, חלון "שליחה במייל" (doc), אפשרויות הקבצים (R8)
  { name: '47-print-menu-org1', real: async () => { await fresh('msigned'); await openMenu(); await away(); } },
  { name: '48-mail-doc', real: async () => { await fresh('signed'); await openMenu(); await clickAt('#pmenu [data-act="pm-mail-rental"]'); await sleep(800); await away(); } },
  { name: '49-mail-extras', real: async () => {
    await openQuick(); const input = await p.$('#dlg input[type=file]'); await input.uploadFile(SHEET_TMP); await sleep(300);
    await clickAt('#dlg [data-dest="both"]'); await away();
  } },
  // ---------- W7: התנהגות מקצה לקצה (בדיקות, בלי השוואה לעיצוב) ----------
  { name: '50-print-actions', real: async () => {
    await fresh('signed'); await openMenu();
    const labels = await p.$$eval('#pmenu [role=menuitem]', (b) => b.map((x) => x.textContent.trim()));
    for (const act of ['pm-order', 'pm-rental', 'pm-prep', 'pm-delivery']) { await p.$eval('#pmenu [data-act="' + act + '"]', (el) => el.click()); await sleep(150); await openMenu(); }
    const opened = await p.evaluate(() => window.__opened);
    const evs = (await calls()).filter((c) => c.url === '/api/orders/events');
    checks.push(['print menu: שש שורות לפי R6 (הזמנה עם משלוח, משלוחים דלוקים)', JSON.stringify(labels) === JSON.stringify(['הדפסת סיכום ללקוח', 'הדפסת השכרה', 'דף הכנה למחסן', 'דף משלוח', 'שליחה במייל', 'שליחת מייל השכרה'])],
      ['print: כתובות ההדפסה (סיכום/השכרה/PP-07 גרסה ב׳/PP-12 עם orderId)', JSON.stringify(opened) === JSON.stringify(['/print/order?orderId=53375&type=order', '/print/order?orderId=53375&type=rental', '/schedule/print/PP-07?orderId=53375&version=PP-07%3Ab', '/schedule/print/PP-12?orderId=53375'])],
      ['print: הכרטיס לא רושם ORDER_PRINTED (הדפים רושמים בעצמם)', evs.length === 0]);
  } },
  { name: '51-print-menu-variants', real: async () => {
    await fresh('msigned'); await openMenu();
    const org1 = await p.$$eval('#pmenu [role=menuitem]', (b) => b.map((x) => x.dataset.act));
    await fresh('noschedule'); await openMenu();
    const noSched = await p.$$eval('#pmenu [role=menuitem]', (b) => b.map((x) => x.dataset.act));
    checks.push(['print menu: ארגון בלי משלוחים = בלי דף משלוח', JSON.stringify(org1) === JSON.stringify(['pm-order', 'pm-rental', 'pm-prep', 'pm-mail-order', 'pm-mail-rental'])],
      ['print menu: בלי page:schedule (403) = בלי דף הכנה ובלי דף משלוח', JSON.stringify(noSched) === JSON.stringify(['pm-order', 'pm-rental', 'pm-mail-order', 'pm-mail-rental'])]);
  } },
  { name: '52-regs-gate-flow', real: async () => {
    await fresh('unsignedq'); await clickAt('.tools .xlbtn.xlp'); await sleep(400);
    const title = await p.$eval('#dlg h2', (e) => e.textContent);
    await clickAt('#dlg .btn.ghost'); await sleep(400);
    const afterNo = await p.evaluate(() => ({ menu: document.getElementById('pmenu').classList.contains('open'), puts: (window.__calls || []).filter((c) => c.method === 'PUT').length }));
    await clickAt('.tools .xlbtn.xlp'); await sleep(400); await clickAt('#dlg .btn.primary'); await sleep(900);
    const afterYes = await p.evaluate(() => ({ menu: document.getElementById('pmenu').classList.contains('open'), puts: (window.__calls || []).filter((c) => c.method === 'PUT').map((c) => JSON.parse(c.body)) }));
    checks.push(['regs: כותרת "חתימה על תקנון"', title === 'חתימה על תקנון'], ['regs: "לא (ביטול)" = לא נשמר כלום והתפריט סגור', !afterNo.menu && afterNo.puts === 0],
      ['regs: "כן, חתם" = PUT חתימה בלבד והתפריט נפתח', afterYes.menu && afterYes.puts.length === 1 && afterYes.puts[0].hasSignedRegulations === true && !('items' in afterYes.puts[0])]);
  } },
  { name: '53-missing-email-flow', real: async () => {
    await fresh('missmail'); await openMenu(); await clickAt('#pmenu [data-act="pm-mail-order"]'); await sleep(500);
    await p.type('#oc-miss-mail', 'bad'); await p.keyboard.press('Enter'); await sleep(300);
    const err = await p.$eval('#dlg .amsg', (e) => e.textContent);
    await p.$eval('#oc-miss-mail', (e) => { e.select(); }); await p.type('#oc-miss-mail', 'new.addr@example.com'); await p.keyboard.press('Enter'); await sleep(1000);
    const st = await p.evaluate(() => ({ puts: (window.__calls || []).filter((c) => c.url === '/api/customers/c1').map((c) => JSON.parse(c.body)), sheet: !!document.querySelector('#dlg.mailwin'), to: (document.getElementById('m-to') || {}).value }));
    checks.push(['missing email: כתובת לא תקינה = הודעה ובלי שמירה', /אינה תקינה/.test(err)], ['missing email: PUT לכרטיס הלקוח עם כל השדות + המייל החדש', st.puts.length === 1 && st.puts[0].email === 'new.addr@example.com' && st.puts[0].firstName === 'מרים'],
      ['missing email: אחרי השמירה נפתח חלון המייל עם הכתובת החדשה', st.sheet && st.to === 'new.addr@example.com']);
  } },
  { name: '54-mail-doc-send', real: async () => {
    await fresh('signed'); await openMenu(); await clickAt('#pmenu [data-act="pm-mail-rental"]'); await sleep(800);
    const head = await p.$eval('#dlg h2', (e) => e.textContent);
    await clickAt('#m-send'); const toast = await waitToast(/^נשלח ל-/); await sleep(300);
    const posts = await emailPosts(); const pdfCalls = (await calls()).filter((c) => c.url === '/api/pdf');
    const html = (await calls()).filter((c) => c.url === '/api/orders/53375/email' && /returnHtmlOnly/.test(c.body || '')).map((c) => JSON.parse(c.body));
    checks.push(['mail doc: כותרת "שליחת מייל השכרה"', /שליחת מייל השכרה/.test(head)], ['mail doc: HTML של השכרה → PDF → POST עם pdfBase64 וה-type', html.length === 1 && html[0].type === 'rental' && pdfCalls.length === 1 && posts.length === 1 && posts[0].type === 'rental' && !!posts[0].pdfBase64 && posts[0].email === 'miriam.abr@example.com'],
      ['mail doc: טוסט "נשלח ל-…" והחלון נסגר', /^נשלח ל-miriam\.abr@example\.com/.test(toast) && !(await p.$('#dlg .mh'))]);
  } },
  { name: '55-mail-quick-send', real: async () => {
    await openQuick('signed'); await p.$eval('#m-sub', (e) => { e.select(); }); await p.type('#m-sub', 'תזכורת לקיחה'); await p.type('#m-body', 'שלום, נשמח לראותך.');
    const disabledBefore = await p.$eval('#m-send', (b) => b.disabled);
    await clickAt('.mfile[data-id="ord"]'); await clickAt('.mfile[data-id="pay"]'); await clickAt('.mfile[data-id="del"]'); await clickAt('.mfile[data-id="inv"]'); await clickAt('.mfile[data-id="img"]');
    const input = await p.$('#dlg input[type=file]'); await input.uploadFile(SHEET_TMP); await sleep(300); await clickAt('#dlg [data-dest="drive"]');
    await clickAt('#m-send'); const toast = await waitToast(/^נשלח ל-/); await sleep(300);
    const posts = await emailPosts(); const pdfs = (await calls()).filter((c) => c.url === '/api/pdf').map((c) => JSON.parse(c.body));
    const b = posts[0] || {};
    checks.push(['quick: שלח זמין כשיש נושא + תוכן', disabledBefore === false], ['quick: quick:{subject,bodyText} בלי pdfBase64', !!b.quick && b.quick.subject === 'תזכורת לקיחה' && b.quick.bodyText === 'שלום, נשמח לראותך.' && !('pdfBase64' in b)],
      ['quick: צרופות לפי kind (כל ששת הסוגים + קובץ נוסף) כולן ב-dest drive', JSON.stringify((b.extraAttachments || []).map((a) => [a.kind, a.dest])) === JSON.stringify([['order-pdf', 'drive'], ['payments', 'drive'], ['delivery', 'drive'], ['receipt', 'drive'], ['model-photos', 'drive'], ['file', 'drive']]) && b.sendMode === 'drive'],
      ['quick: תמונות הדגמים הוטמעו כ-data URI בדף ה-PDF, הקבלה נבנתה מהתשלומים', pdfs.some((x) => x.html && /^<!DOCTYPE/.test(x.html) && x.html.includes('תמונות הדגמים') && /<img src="data:image\/jpeg;base64,/.test(x.html)) && pdfs.some((x) => x.html && x.html.includes('אישור קבלת תשלום'))],
      ['quick: משלוח נוצר מדף הלו״ז של ההזמנה (path עם orderId ו-downloadPdf)', pdfs.some((x) => x.path === '/schedule/print/PP-12?orderId=53375&downloadPdf=true')],
      ['quick: טוסט "נשלח ל-…"', /^נשלח ל-miriam/.test(toast)]);
  } },
  { name: '56-mail-approval-flow', real: async () => {
    await openQuick('mailapprove'); await p.type('#m-body', 'שלום'); await clickAt('#m-send'); await sleep(1500);
    const dlg2 = await p.evaluate(() => ({ on: document.getElementById('scrim2').classList.contains('on'), title: (document.querySelector('#dlg2 h2') || {}).textContent, mail: !!document.querySelector('#dlg .mh') }));
    await clickAt('#dlg2 .oc-emps .opt:nth-child(1)'); await p.type('#oc-appr-code', '1234'); await p.keyboard.press('Enter'); await sleep(2500);
    const posts = await emailPosts(); const vp = (await calls()).filter((c) => c.url === '/api/auth/verify-pin').map((c) => JSON.parse(c.body));
    checks.push(['approval: 403 approval_required → חלון אישור מנהל מעל החלון', dlg2.on && dlg2.title === 'אישור מנהל' && dlg2.mail], ['approval: verify-pin עם feature:customer_email_approval ו-context של ההזמנה', vp.length === 1 && vp[0].requiredLevel === 'feature:customer_email_approval' && !!vp[0].context && vp[0].context.orderId === 53375],
      ['approval: שליחה חוזרת עם emailApproverId/Pin (שני POST)', posts.length === 2 && !posts[0].emailApproverId && posts[1].emailApproverId === 'e1' && posts[1].emailApproverPin === '<redacted>'], ['approval: החלון נסגר אחרי הצלחה', !(await p.$('#dlg .mh'))]);
  } },
  { name: '57-mail-fail', real: async () => {
    await openQuick('mailfail'); await p.type('#m-body', 'שלום'); await clickAt('#m-send'); await sleep(1800);
    const st = await p.evaluate(() => ({ err: (document.querySelector('#dlg .oc-mail-err') || {}).textContent, open: !!document.querySelector('#dlg .mh'), send: (document.getElementById('m-send') || {}).disabled }));
    checks.push(['fail: הודעת שגיאה בחלון, החלון נשאר פתוח והשליחה זמינה לניסיון חוזר', /השליחה נכשלה/.test(st.err || '') && st.open && st.send === false]);
    await away();
  } },
  { name: '58-mail-discard-guard', real: async () => {
    await openQuick('signed'); await p.type('#m-body', 'טיוטה');
    await clickAt('#dlg .ibtn.mx'); await sleep(500);
    const g = await p.evaluate(() => ({ on: document.getElementById('scrim2').classList.contains('on'), title: (document.querySelector('#dlg2 h2') || {}).textContent }));
    await clickAt('#dlg2 .btn.ghost'); await sleep(500);
    const kept = await p.evaluate(() => ({ open: !!document.querySelector('#dlg .mh'), v: (document.getElementById('m-body') || {}).value }));
    await p.keyboard.press('Escape'); await sleep(500);
    const again = await p.evaluate(() => document.getElementById('scrim2').classList.contains('on'));
    await clickAt('#dlg2 .btn.primary'); await sleep(600);
    const closed = await p.evaluate(() => ({ sheet: !!document.querySelector('#dlg .mh'), scrim: document.getElementById('scrim').classList.contains('on') }));
    checks.push(['discard: סגירה עם תוכן = "לזרוק את המייל?" בשכבה 2', g.on && g.title === 'לזרוק את המייל?'], ['discard: "המשך עריכה" שומר את הטקסט', kept.open && kept.v === 'טיוטה'], ['discard: Escape שואל שוב; "כן, סגור" סוגר', again && !closed.sheet && !closed.scrim]);
    await clickAt(qmButton); await sleep(600); await clickAt('#dlg .ibtn.mx'); await sleep(500);
    checks.push(['discard: בלי עריכה נסגר מיד', !(await p.$('#dlg .mh'))]);
  } },
  { name: '59-exports', real: async () => {
    await fresh('signed'); await clickAt('.tools .xlbtn.xlg'); await sleep(500); const t1 = await toastText(); await sleep(2800);
    await clickAt('.tools .xlbtn.xld[data-act="export-pdf"]'); await sleep(500); const t2 = await toastText(); await sleep(2500);
    const cs = await calls(); const evs = cs.filter((c) => c.url === '/api/orders/events').map((c) => JSON.parse(c.body));
    const pdf = cs.filter((c) => c.url === '/api/pdf').map((c) => JSON.parse(c.body));
    checks.push(['exports: Excel → טוסט מיידי "קובץ Excel של ההזמנה יורד" + ORDER_XLSX_EXPORTED עם שם הקובץ', /Excel של ההזמנה יורד/.test(t1) && evs.some((e) => e.action === 'ORDER_XLSX_EXPORTED' && e.meta.fileName === 'הזמנה 53375.xlsx' && e.orderIds[0] === 53375)],
      ['exports: הורדה → טוסט מיידי + HTML של הזמנה → /api/pdf → ORDER_PDF_DOWNLOADED {doc:order}', pdf.length === 1 && /דוח order/.test(pdf[0].html) && /סיכום ההזמנה יורד/.test(t2) && evs.some((e) => e.action === 'ORDER_PDF_DOWNLOADED' && e.meta.doc === 'order' && e.meta.fileName === 'הזמנה 53375.pdf')]);
  } },
  { name: '60-quick-mail-setting', real: async () => {
    await fresh('noqm', '&qmhost=1'); const off = await p.$(qmButton); await fresh('signed', '&qmhost=1'); const on = await p.$(qmButton);
    checks.push(['A8: הלחצן מוסתר בלי order_quick_mail_enabled ומוצג איתה', !off && !!on]);
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
