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
const ROOTS = [['TOP', '#app > .topbar'], ['TABS', '#tabs'], ['TOAST', '#toast'], ['DLG', '#dlg'], ['DLG2', '#dlg2'], ['ITEMS', '#p-items']];
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
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', which, globalThis.__st || '-', m.text().slice(0, 200)); });
const results = {};
const snap = async (name, roots) => { await sleep(600); await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, fullPage: false }); results[name] = await p.evaluate(DUMP, roots || (/^[45]\d-/.test(name) ? ROOTS : ROOTS.filter((r) => r[0] !== 'ITEMS'))); }; // ITEMS (W3) רק בשלבי הפריטים; roots (W2a) לשלב מסוים
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
const itemsTab = async () => { await clickAt('#tabs .tab[data-tab="items"]'); await sleep(300); await away(); };
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
  // ---- W3: לשונית פריטים (העיצוב: אותם 4 פריטים; הדף האמיתי: תרחיש neve) ----
  { name: '40-items', real: async () => { await fresh('neve'); await itemsTab(); }, demo: async () => { await fresh(); await itemsTab(); } },
  { name: '41-item-open', real: async () => { await fresh('neve'); await itemsTab(); await clickAt('#p-items .irow:nth-child(2) .lrow'); await away(); }, demo: async () => { await fresh(); await itemsTab(); await clickAt('#p-items .irow:nth-child(2) .lrow'); await away(); } },
  { name: '42-items-table', real: async () => { await fresh('neve'); await itemsTab(); await clickAt('#p-items [data-act="view-table"]'); await away(); }, demo: async () => { await fresh(); await itemsTab(); await clickAt('#p-items .vopt[data-iview="table"]'); await away(); } },
  { name: '43-items-deleted', real: async () => { await fresh('neve'); await itemsTab(); await clickAt('#delToggle'); await away(); }, demo: async () => { await fresh(); await itemsTab(); await clickAt('#delToggle'); await away(); } },
  { name: '44-addpanel', real: async () => { await fresh('neve'); await itemsTab(); await clickAt('#p-items [data-act="addtoggle"]'); await clickAt('#addModel'); await p.type('#addModel', '4519'); await sleep(700); await clickAt('#p-items .advlist .advo'); await sleep(300); await clickAt('#p-items .addpanel .sizes button:nth-child(3)'); await sleep(900); await away(); }, demo: async () => { await fresh(); await itemsTab(); await clickAt('#p-items .card-h [data-act="addtoggle"]'); await away(); } },
  { name: '45-dlg-edit', real: async () => { await fresh('neve'); await itemsTab(); await clickAt('#p-items .irow:nth-child(1) .lrow'); await clickAt('#p-items .irow:nth-child(1) [data-act="edititem"]'); await sleep(400); await away(); }, demo: async () => { await fresh(); await itemsTab(); await demoWin('R24'); await away(); } },
  { name: '46-dlg-capacity', real: async () => { await fresh('neve'); await itemsTab(); await clickAt('#p-items .irow:nth-child(1) .lrow'); await clickAt('#p-items .irow:nth-child(1) [data-act="cap"]'); await sleep(500); await away(); }, demo: async () => { await fresh(); await itemsTab(); await demoWin('R29'); await away(); } },
  { name: '47-dlg-itemdet', real: async () => { await fresh('neve'); await itemsTab(); await clickAt('#p-items .irow:nth-child(1) .lrow'); await clickAt('#p-items .irow:nth-child(1) [data-act="itemdet"]'); await sleep(500); await away(); }, demo: async () => { await fresh(); await itemsTab(); await clickAt('#p-items .irow:nth-child(1) .lrow'); await clickAt('#p-items .irow:nth-child(1) [data-pvact="itemdet"]'); await sleep(400); await away(); } },
  { name: '48-items-locked', real: async () => { await fresh('locked'); await itemsTab(); await clickAt('#p-items .irow:nth-child(1) .lrow'); await away(); }, demo: async () => { await fresh(); await demoLocked(); await itemsTab(); await clickAt('#p-items .irow:nth-child(1) .lrow'); await away(); } },
  { name: '49-dlg-condbad', real: async () => { await fresh('items'); await itemsTab(); await clickAt('#p-items .irow:nth-child(4) .lrow'); await clickAt('#p-items .irow:nth-child(4) [data-act="cond-ok"]'); await sleep(300); await clickAt('#p-items .irow:nth-child(4) [data-act="cond-bad"]'); await sleep(400); await away(); }, demo: async () => { await fresh(); await itemsTab(); await demoWin('R27'); await away(); } },
  // W3 בדף האמיתי בלבד: מצבי פריט, סריקה, הוספה (A27), מכסה (R32), מיקום שורת הסריקה (R42), גובה לחצני הסרגל (A10)
  { name: '50-items-states', real: async () => {
    await fresh('items'); await itemsTab(); await clickAt('#p-items .irow:nth-child(3) .lrow'); await clickAt('#p-items .irow:nth-child(4) .lrow'); await away();
    const st = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#p-items .irow')];
      const r3 = rows[2], r4 = rows[3];
      const h = [...document.querySelectorAll('#p-items .hres-bar .btn')].map((b) => Math.round(b.getBoundingClientRect().height));
      const rad = [...document.querySelectorAll('#p-items .irow [data-act="itemdet"], #p-items .irow [data-act="cap"]')].map((b) => getComputedStyle(b).borderTopLeftRadius);
      return { s3: r3 && r3.querySelector('.ln').textContent, s4: r4 && r4.querySelector('.ln').textContent, undoRent: !!(r3 && r3.querySelector('[data-act="undorent"]')), undoRet: !!(r4 && r4.querySelector('[data-act="undoret"]')), condBadOn: !!(r4 && r4.querySelector('[data-act="cond-bad"].on')),
        bar: h, rad, ck: !!document.querySelector('#p-items .hres-bar .btn.on .evck'), modelLinks: document.querySelectorAll('#p-items a[href*="/dashboard/dresses/"]').length, added: (rows[0].querySelector('.hdet-in') || {}).textContent || '' };
    });
    checks.push(['items: מושכר = "נמסרה" (משלוח הלוך-חזור) + "בטל השכרה"', /נמסרה/.test(st.s3) && st.undoRent],
      ['items: הוחזר לא תקין = "נאספה · לא תקין" + "בטל החזרה" + לא תקין מסומן', /נאספה · לא תקין/.test(st.s4) && st.undoRet && st.condBadOn],
      ['A10: כל לחצני הסרגל באותו גובה (32) עם ✓ בנבחר', st.bar.length >= 3 && st.bar.every((x) => x === 32) && st.ck],
      ['R28/R29: לחצני ⓘ ו-📅 עגולים', st.rad.length > 0 && st.rad.every((x) => parseFloat(x) >= 16)],
      ['R30: אין קישור לכרטיס דגם', st.modelLinks === 0]);
  } },
  { name: '51-scan-flow', real: async () => {
    await fresh('items'); await clickAt('#scanIn'); await p.type('#scanIn', '45123801'); await p.keyboard.press('Enter'); await sleep(900);
    const st = await p.evaluate(() => ({ tab: (document.querySelector('#tabs .tab.on') || {}).dataset.tab, calls: (window.__calls || []).filter((c) => /rentals/.test(c.url)).map((c) => [c.url, c.body]), msg: (document.getElementById('scanMsg') || {}).textContent || '', val: document.getElementById('scanIn').value, focus: document.activeElement && document.activeElement.id }));
    await p.type('#scanIn', '27644001'); await p.keyboard.press('Enter'); await sleep(900);
    const st2 = await p.evaluate(() => ({ calls: (window.__calls || []).filter((c) => /rentals/.test(c.url)).map((c) => [c.url, c.body]), msg: (document.getElementById('scanMsg') || {}).textContent || '', a3: (document.querySelectorAll('#p-items .irow')[2] || { textContent: '' }).textContent }));
    const body = (c) => JSON.parse(c[1]);
    checks.push(['R42 סריקה: עובר ללשונית פריטים', st.tab === 'items'],
      ['R42 סריקה: verify-item ואז toggle rent עם הברקוד לפריט המתאים (כמו MIM.scan)', st.calls.length === 2 && st.calls[0][0] === '/api/rentals/verify-item' && body(st.calls[1]).action === 'rent' && body(st.calls[1]).barcode === '45123801' && body(st.calls[1]).itemId === 'a1'],
      ['R42 סריקה: הודעת "הושכר", השדה התאפס ונשאר בפוקוס (סריקה ברצף)', /הושכר/.test(st.msg) && st.val === '' && st.focus === 'scanIn'],
      ['R42 סריקה שנייה: ברקוד של פריט מושכר → החזרה + "הוחזר"', st2.calls.length === 4 && body(st2.calls[3]).action === 'return' && body(st2.calls[3]).itemId === 'a3' && /הוחזר/.test(st2.msg) && /נאספה/.test(st2.a3)]);
  } },
  { name: '52-add-flow', real: async () => {
    await fresh('neve'); await itemsTab(); await clickAt('#p-items [data-act="addtoggle"]'); await clickAt('#addModel'); await p.type('#addModel', '4519'); await sleep(700);
    await clickAt('#p-items .advlist .advo'); await sleep(300); await clickAt('#p-items .addpanel .sizes button:nth-child(3)'); await sleep(900);
    const price = await p.$eval('#p-items .oc-addprice', (e) => e.textContent);
    await clickAt('#p-items [data-act="additem"]'); await sleep(1200); await away();
    const st = await p.evaluate(() => ({ posts: (window.__calls || []).filter((c) => c.url === '/api/orders/53375/items').map((c) => JSON.parse(c.body)), vp: (window.__calls || []).filter((c) => c.url === '/api/auth/verify-pin').length, dlg2: document.getElementById('scrim2').classList.contains('on') }));
    checks.push(['A27: מחיר השכרה ודמי ביטול מהמנוע (preview-pricing), בלי "לפי הגדרות הגמ״ח"', /מחיר השכרה: ₪120/.test(price) && /דמי ביטול ₪40/.test(price) && !/לפי הגדרות/.test(price)],
      ['R47 הוספה (נווה: require_manager_code_for_item_changes) → חלון אישור מנהל לפני POST', st.dlg2 && st.posts.length === 0]);
  } },
  { name: '53-quota-full', real: async () => {
    await fresh('quota'); await itemsTab(); await clickAt('#delToggle'); await away();
    const st = await p.evaluate(() => ({ add: !!document.querySelector('#p-items [data-act="addtoggle"]'), restore: !!document.querySelector('#p-items [data-act="restore"]'), alerts: document.querySelectorAll('#scrim.on').length }));
    checks.push(['R32: מכסה מלאה → אין "הוסף פריט" ואין "שחזור", בלי הודעה', !st.add && !st.restore && st.alerts === 0]);
  } },
  { name: '54-scanbar-rect', real: async () => {
    await fresh('neve'); await away();
    const st = await p.evaluate(() => { const t = document.querySelector('#app > .topbar').getBoundingClientRect(); const s = document.getElementById('sbar').getBoundingClientRect(); const x = document.querySelector('.tools .xlbtn').getBoundingClientRect(); return { tc: t.left + t.width / 2, sc: s.left + s.width / 2, sy: s.top + s.height / 2, xy: x.top + x.height / 2, w: innerWidth, sw: s.width, tw: t.width, below: s.top >= x.bottom - 1 }; });
    checks.push([`R42 מיקום (${width}): במרכז ומיושר עם לחצני ההורדה (≥1100) / שורה מלאה מתחת (<1100)`, st.w >= 1100 ? Math.abs(st.tc - st.sc) <= 2 && Math.abs(st.sy - st.xy) <= 3 : st.below && st.sw >= st.tw * 0.8]);
  } },
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

// ===== W2a: לשוניות פרטים / משלוח, הלוח העברי, החלפת לקוח (אזורים: DET=#p-details, ADV=#adv, DEL=#p-delivery, DLG=#dlg) =====
// אירוע בהדגמה ובמוק: כ״ז תשרי תשפ״ז (8.10.2026) - אותו חודש בלוח. ימים שנבחרים כאן הם בתוך תשרי.
const W2A_DET = [['DET', '#p-details']];
const W2A_DEL = [['DEL', '#p-delivery']];
const W2A_DLG = [['DLG', '#dlg']];
// בעיצוב: מסירים את תגיות "לפי הגדרות" של שכבת הסקירה (pv-cfg - לא נבנות, החלטת הבעלים) ואת לחצן "מייל מהיר" (A8 - slot של W7, נבדק בשלב שלו)
const demoStrip = async () => { if (D) await p.evaluate(() => { if (document.getElementById('w2a-strip')) return; const st = document.createElement('style'); st.id = 'w2a-strip'; st.textContent = '.pv-cfg{display:none!important}.card.cust .kv .f div:has(> [data-act="mail-open"]){display:none!important}.card.cust .kv .f div:has(> .pv-cfg){display:none!important}'; document.head.append(st); }); await sleep(100); };
const openEdit = async () => { await clickAt('#p-details [data-act="editdate"]'); await sleep(300); };
STAGES.push(
  { name: '30-details', roots: W2A_DET, real: async () => { await fresh('neve'); await away(); }, demo: async () => { await fresh(); await demoStrip(); await away(); } },
  { name: '31-details-calendar', roots: W2A_DET, real: async () => { await fresh('neve'); await openEdit(); await away(); }, demo: async () => { await fresh(); await openEdit(); await demoStrip(); await away(); } },
  { name: '32-hover-day', roots: W2A_DET, real: async () => { await fresh('neve'); await openEdit(); await hover('#p-details .hc-d[data-hd="2026-10-01"]'); }, demo: async () => { await fresh(); await openEdit(); await demoStrip(); await hover('#p-details .hc-d[data-hd="2026-10-01"]'); } },
  { name: '33-abroad', roots: W2A_DET, real: async () => { await fresh('neve'); await openEdit(); await clickAt('#evType'); await away(); }, demo: async () => { await fresh(); await openEdit(); await clickAt('#evType'); await demoStrip(); await away(); } },
  { name: '34-adv-open', roots: [['ADV', '#adv']], real: async () => { await fresh('xday'); await clickAt('#adv > summary'); await away(); }, demo: async () => { await fresh(); await clickAt('#adv > summary'); await demoStrip(); await away(); } },
  { name: '35-swap-existing', roots: W2A_DLG, real: async () => { await fresh('neve'); await clickAt('.card.cust [data-act="swap-customer"]'); await sleep(500); await clickAt('#dlg .oc-cs-row'); await away(); }, demo: async () => { await fresh(); await demoWin('R19'); await away(); } },
  { name: '36-swap-new', roots: W2A_DLG, real: async () => { await fresh('neve'); await clickAt('.card.cust [data-act="swap-customer"]'); await sleep(400); await clickAt('#ocCustSeg button:nth-of-type(2)'); await away(); }, demo: async () => { await fresh(); await demoWin('R19'); await clickAt('#dlg [data-pvact="cust-tab"][data-t="1"]'); await away(); } },
  { name: '40-delivery', roots: W2A_DEL, real: async () => { await fresh('neve'); await clickAt('#tabs .tab[data-tab="delivery"]'); await away(); }, demo: async () => { await fresh(); await clickAt('#tabs .tab[data-tab="delivery"]'); await away(); } },
  { name: '41-delivery-city', roots: W2A_DEL, real: async () => { await fresh('neve'); await clickAt('#tabs .tab[data-tab="delivery"]'); await clickAt('#delCityIn'); await sleep(300); }, demo: async () => { await fresh(); await clickAt('#tabs .tab[data-tab="delivery"]'); await clickAt('#delCityIn'); await sleep(300); } },
  { name: '42-delivery-off', roots: W2A_DEL, real: async () => { await fresh('neve'); await clickAt('#tabs .tab[data-tab="delivery"]'); await clickAt('#p-delivery .sw'); await away(); }, demo: async () => { await fresh(); await clickAt('#tabs .tab[data-tab="delivery"]'); await clickAt('#p-delivery .sw'); await away(); } },
  // רק בדף האמיתי (צילום + JSON + בדיקות התנהגות מקצה לקצה עם ה-API המדומה)
  { name: '50-details-org1', roots: W2A_DET, real: async () => { await fresh('main'); await away(); } },
  { name: '51-delivery-inline', roots: W2A_DET, real: async () => { await fresh('inline'); await away(); } },
  { name: '52-xday-range', roots: W2A_DET, real: async () => { await fresh('xday'); await openEdit(); await clickAt('#adv > summary'); await away(); } },
  { name: '53-details-flow', roots: W2A_DET, real: async () => {
    await fresh('neve');
    await openEdit();
    await clickAt('#p-details .hc-d[data-hd="2026-10-01"]'); await sleep(300);
    const t1 = await p.$eval('#p-details .card.oc-evt .big', (e) => e.textContent);
    await clickAt('#evType'); await sleep(200);
    await clickAt('#p-details .hc-d[data-hd="2026-10-09"]'); await clickAt('#p-details .hc-d[data-hd="2026-10-06"]'); await sleep(300);
    const rng = await p.$$eval('#p-details .oc-range .inp', (xs) => xs.map((x) => x.value));
    await p.type('#notes', ' נוסף'); await p.type('#ocInternalNotes', 'לצוות');
    await clickAt('#tabs .tab[data-tab="delivery"]'); await clickAt('#delCityIn');
    await p.evaluate(() => document.getElementById('delCityIn').select());
    await p.keyboard.type('תל אביב'); await p.keyboard.press('Tab'); await sleep(200);
    const cityAfterBad = await p.$eval('#delCityIn', (e) => e.value);
    await clickAt('#delCityIn'); await p.evaluate(() => document.getElementById('delCityIn').select()); await p.keyboard.type('בית'); await sleep(150); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await sleep(200);
    const cityAfterPick = await p.$eval('#delCityIn', (e) => e.value);
    await clickAt('#delOneBtn'); await clickAt('#dirSeg [data-dir="הלוך"]');
    await clickAt('#rail .btn.primary'); await sleep(900);
    if (await p.evaluate(() => document.getElementById('scrim').classList.contains('on'))) { await clickAt('#dlg .btn.primary'); await sleep(900); }
    const puts = await p.evaluate(() => (window.__calls || []).filter((c) => c.method === 'PUT').map((c) => JSON.parse(c.body)));
    const b = puts[puts.length - 1] || {};
    checks.push(['details: כותרת האירוע = יום + תאריך עברי (יום חמישי כ׳ תשרי תשפ״ז)', t1 === 'יום חמישי כ׳ תשרי תשפ״ז'],
      ['details: טווח חו"ל בלוח (לחיצה מאוחרת → מוקדמת מתהפכת)', rng.length === 2 && rng[0] === 'כ״ה תשרי תשפ״ז' && rng[1] === 'כ״ח תשרי תשפ״ז'],
      ['delivery: עיר לא ברשימה חוזרת לערך התקף', cityAfterBad === 'ירושלים'],
      ['delivery: בחירה מההצעות במקלדת', cityAfterPick === 'בית שמש'],
      ['save: PUT עם השדות שנערכו (טווח, הערות, משלוח, extraDay, cardVariant)', puts.length >= 1 && b.isAbroad === true && b.isWeekdayEvent === false && /^2026-10-0(5|6)T/.test(b.fromDate || '') && /^2026-10-0(8|9)T/.test(b.toDate || '') && b.returnDate === b.toDate && b.eventDate === b.fromDate && String(b.notes).includes('נוסף') && b.internalNotes === 'לצוות' && b.deliveryCity === 'בית שמש' && b.deliveryOneDayBefore === true && b.deliveryDirection === 'הלוך' && b.extraDay === null && b.cardVariant === 'a5']);
  } },
  { name: '54-spacing-approval', roots: W2A_DET, real: async () => {
    await fresh('xday'); await clickAt('#adv > summary'); await sleep(200);
    await clickAt('#spacing button:nth-of-type(2)'); await sleep(600); // "0" < ברירת המחדל 2 → אישור מנהל
    const appr = await p.evaluate(() => document.getElementById('scrim2').classList.contains('on'));
    await clickAt('#dlg2 .oc-emps .opt:nth-child(1)'); await p.type('#oc-appr-code', '1234'); await p.keyboard.press('Enter'); await sleep(700);
    const on = await p.$eval('#spacing button.on', (e) => e.textContent);
    await clickAt('#spacing button:nth-of-type(5)'); await sleep(300); // הגדלה (4) - בלי אישור
    const appr2 = await p.evaluate(() => document.getElementById('scrim2').classList.contains('on'));
    await clickAt('#xday button:nth-of-type(3)'); await sleep(300); // "יום אחרי"
    const xd = await p.$eval('#xday button.on', (e) => e.textContent);
    const vp = await p.evaluate(() => (window.__calls || []).filter((c) => c.url === '/api/auth/verify-pin').map((c) => JSON.parse(c.body)));
    checks.push(['spacing: הקטנה פותחת אישור מנהל', appr], ['spacing: verify-pin עם feature:special_spacing_approval + context', vp.length === 1 && vp[0].requiredLevel === 'feature:special_spacing_approval' && vp[0].context && vp[0].context.orderId === 53375],
      ['spacing: הערך נבחר אחרי האישור', on === '0'], ['spacing: הגדלה בלי אישור', !appr2], ['xday: "יום אחרי" נבחר', xd === 'יום אחרי']);
  } },
  { name: '55-swap-flow', roots: W2A_DET, real: async () => {
    await fresh('neve'); await clickAt('.card.cust [data-act="swap-customer"]'); await sleep(500);
    await clickAt('#ocCustSeg button:nth-of-type(2)'); await sleep(200);
    await p.type('#oc-nc-fn', 'שרה'); await p.type('#oc-nc-ln', 'כהן'); await p.type('#oc-nc-ph', '0501112222'); await p.type('#oc-nc-em', 'sara');
    await clickAt('#dlg .oc-cs-gm .btn'); await clickAt('#dlg .btn.primary'); await sleep(500);
    const msg = await p.$eval('#dlg .amsg', (e) => e.textContent).catch(() => '');
    await p.type('#oc-nc-id', '123456782'); await clickAt('#dlg .btn.primary'); await sleep(700);
    const name = await p.$eval('.card.cust .big', (e) => e.textContent);
    const post = await p.evaluate(() => (window.__calls || []).filter((c) => c.url === '/api/customers' && c.method === 'POST').map((c) => JSON.parse(c.body)));
    checks.push(['swap: ת״ז חובה בטופס (require_customer_id_number)', /תעודת זהות/.test(msg)],
      ['swap: POST /api/customers עם גוף הישן + zeout', post.length === 1 && post[0].email === 'sara@gmail.com' && post[0].zeout === '123456782' && Object.keys(post[0]).join(',') === 'firstName,lastName,phone1,email,city,street,houseNum,zeout'],
      ['swap: הלקוח החדש נבחר בכרטיס', name === 'שרה כהן']);
  } },
);

// ===== W2b (R49, פורט נווה יעקב): בורר "הצטרפות למשלוח", באנר מיקום שמלה, רצף ברקודים =====
// בעיצוב המאושר אין חלקים כאלה (D11: רק רכיבי פלטה) - לכן רק בדף האמיתי: צילום + JSON + בדיקות התנהגות מקצה לקצה עם ה-API המדומה.
// "TOTAL 0 מול העיצוב" נבדק בשלבים הקיימים (40-42 משלוח, 01 כותרת וכו') שמורצים בתרחיש neve (כל ההגדרות של W2b כבויות) - החלקים לא משנים אותם.
const W2B_DEL = [['DEL', '#p-delivery']];
const calls = async (re) => p.evaluate((src) => (window.__calls || []).filter((c) => new RegExp(src).test(c.url)).map((c) => ({ url: c.url, method: c.method, body: c.body })), re.source);
const delTab = async () => { await clickAt('#tabs .tab[data-tab="delivery"]'); await sleep(500); };
STAGES.push(
  { name: '70-join-picker', roots: W2B_DEL, real: async () => { await fresh('join'); await delTab(); await away(); } },
  { name: '71-join-open', roots: W2B_DEL, real: async () => { await fresh('join'); await delTab(); await clickAt('#oc-join [data-join="join"]'); await sleep(700); await away(); } },
  { name: '72-join-picked', roots: W2B_DEL, real: async () => { await fresh('join'); await delTab(); await clickAt('#oc-join [data-join="join"]'); await sleep(600); await clickAt('#oc-join .oc-join-row'); await sleep(700); await away(); } },
  { name: '73-join-flow', roots: W2B_DEL, real: async () => {
    await fresh('join'); await delTab();
    const hasPicker = await p.evaluate(() => !!document.getElementById('oc-join'));
    const before = await p.evaluate(() => ({ joinCalls: (window.__calls || []).filter((c) => /deliveries\/join/.test(c.url)).map((c) => c.url) }));
    await clickAt('#oc-join [data-join="join"]'); await sleep(600);
    const rows = await p.$$eval('#oc-join .oc-join-row', (xs) => xs.map((x) => x.textContent));
    await clickAt('#oc-join .oc-join-row'); await sleep(700);
    const st = await p.evaluate(() => ({ city: document.getElementById('delCityIn').value, cityOff: document.getElementById('delCityIn').disabled, addr: document.getElementById('delAddr') ? document.getElementById('delAddr').value : null, addrOff: document.getElementById('delAddr') ? document.getElementById('delAddr').disabled : null, checked: [...document.querySelectorAll('#oc-join .oc-join-row[aria-checked="true"]')].map((x) => x.textContent), badge: (document.querySelector('#rail .cart .badge') || {}).textContent }));
    await clickAt('#oc-join .oc-join-pane:last-of-type .oc-join-row:nth-child(2)'); await sleep(400);
    await clickAt('#tabs .tab[data-tab="payments"]'); await sleep(1200);
    const pv = (await calls(/preview-pricing/)).map((c) => JSON.parse(c.body)).pop();
    await clickAt('#rail .btn.primary'); await sleep(900);
    if (await p.evaluate(() => document.getElementById('scrim').classList.contains('on'))) { await clickAt('#dlg .btn.primary'); await sleep(900); }
    const puts = (await calls(/^\/api\/orders\/53375$/)).filter((c) => c.method === 'PUT').map((c) => JSON.parse(c.body));
    const b = puts[puts.length - 1] || {};
    checks.push(['join: הבורר מוצג כשההגדרה דלוקה והשרת מאשר (info)', hasPicker && before.joinCalls.some((u) => /mode=info/.test(u))],
      ['join: "הצטרפות" טוען מועמדים (2) לפי יום האירוע והכיוון', rows.length === 2 && /#53301/.test(rows[0]) && /שרה כהן/.test(rows[0])],
      ['join: בחירת משלוח: עיר/כתובת נלקחות ממנו ומנוטרלות, השורה מסומנת, ההזמנה "מלוכלכת"', st.city === 'בית שמש' && st.cityOff && st.addr === 'הרב קוק 4' && st.addrOff && st.checked.length >= 1 && Number(st.badge) > 0],
      ['join: התצוגה המקדימה מקבלת deliveryJoinedTo', !!pv && pv.order.deliveryJoinedTo === 53301],
      ['join: PUT עם deliveryJoin {joinedToOrderId, primaryOrderId} + עיר/כתובת של המשלוח', puts.length >= 1 && b.deliveryJoin && b.deliveryJoin.joinedToOrderId === 53301 && b.deliveryJoin.primaryOrderId === 53301 && b.deliveryCity === 'בית שמש' && b.deliveryAddress === 'הרב קוק 4']);
  } },
  { name: '74-join-table-missing', roots: W2B_DEL, real: async () => {
    await fresh('joinoff'); await delTab(); await away();
    const st = await p.evaluate(() => ({ picker: !!document.getElementById('oc-join'), cards: document.querySelectorAll('#p-delivery .card').length }));
    checks.push(['join: הטבלה חסרה / enabled:false מהשרת => הבורר לא מוצג, שאר כרטיסי המשלוח כרגיל', !st.picker && st.cards === 2]);
  } },
  { name: '75-join-off-setting', roots: W2B_DEL, real: async () => {
    await fresh('neve'); await delTab(); await away();
    const st = await p.evaluate(() => ({ picker: !!document.getElementById('oc-join'), joinCalls: (window.__calls || []).filter((c) => /deliveries\/join|dress-location/.test(c.url)).length, seq: !!document.querySelector('#sbar .oc-seq'), scan: !!document.getElementById('scanIn'), banner: !!document.querySelector('.oc-dressloc') }));
    checks.push(['W2b כבוי בהגדרות (ברירת מחדל): אין בורר, אין באנר, אין רצף ברקודים, ואפס קריאות API של W2b', !st.picker && st.joinCalls === 0 && !st.seq && st.scan && !st.banner]);
  } },
  { name: '76-dress-location', roots: [['BAN', '.oc-dressloc']], real: async () => {
    await fresh('dressloc'); await sleep(600); await away();
    const st = await p.evaluate(() => { const el = document.querySelector('.oc-dressloc'); return { has: !!el, text: el ? el.textContent : '', role: el ? el.querySelector('section').getAttribute('role') : null, ym: el ? /20\d\d/.test(el.textContent) : null, rows: el ? el.querySelectorAll('.nb-r').length : 0 }; });
    const cl = await calls(/dress-location-alerts/);
    checks.push(['dress-location: באנר פלטה (.nb-warning) מעל הלשוניות עם כותרת חומרה (critical)', st.has && st.role === 'alert' && /שים לב: שמלות מההזמנה עדיין לא בבית - לא צפויות להגיע בזמן ללא טיפול/.test(st.text)],
      ['dress-location: שורת דגם + יחידות (באירוע אחר / בסניף), תאריכים עבריים בלבד', st.rows === 2 && /דגם 4512 · מידה 38/.test(st.text) && /נמצאת בסניף "בני ברק"/.test(st.text) && /עבר מועד ההחזרה - טרם הוחזרה!/.test(st.text) && st.ym === false],
      ['dress-location: GET עם orderId (קריאה בלבד)', cl.length >= 1 && /orderId=53375/.test(cl[0].url) && cl.every((c) => c.method === 'GET')]);
  } },
  { name: '77-sequence', roots: [['TOP', '#app > .topbar']], real: async () => {
    await fresh('seq'); await sleep(500);
    const init = await p.evaluate(() => ({ seq: !!document.querySelector('#sbar .oc-seq'), focus: document.activeElement && document.activeElement.id, pop: !!document.querySelector('#sbar .oc-seq-pop') }));
    await p.type('#scanIn', '45123801'); await p.keyboard.press('Enter'); await sleep(1100);
    const s1 = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#sbar .oc-seq-bar .chip')].map((x) => x.textContent), feed: [...document.querySelectorAll('#sbar .oc-seq-feed li')].map((x) => x.textContent), focus: document.activeElement && document.activeElement.id, val: document.getElementById('scanIn').value, tab: document.querySelector('#tabs .tab.on') ? document.querySelector('#tabs .tab.on').dataset.tab : null }));
    const c1 = (await calls(/rentals/)).map((c) => ({ url: c.url, body: c.body && JSON.parse(c.body) }));
    await p.type('#scanIn', '99900001'); await p.keyboard.press('Enter'); await sleep(1000);
    const s2 = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#sbar .oc-seq-bar .chip')].map((x) => x.textContent), feed: [...document.querySelectorAll('#sbar .oc-seq-feed li')].map((x) => x.textContent), toast: document.getElementById('toast') ? document.getElementById('toast').className : '', flash: document.querySelector('#sbar .oc-seq').className, liCls: (document.querySelector('#sbar .oc-seq-feed li') || {}).className || '' }));
    await p.type('#scanIn', '27644001'); await p.keyboard.press('Enter'); await sleep(1000);
    const s3 = await p.evaluate(() => ({ feed: [...document.querySelectorAll('#sbar .oc-seq-feed li')].map((x) => x.textContent), chips: [...document.querySelectorAll('#sbar .oc-seq-bar .chip')].map((x) => x.textContent) }));
    await clickAt('#sbar .oc-seq-bar .btn:first-of-type'); await sleep(900); // בטל סריקה אחרונה (החזרת a3)
    const s4 = await p.evaluate(() => ({ feed: [...document.querySelectorAll('#sbar .oc-seq-feed li')].map((x) => x.textContent), chips: [...document.querySelectorAll('#sbar .oc-seq-bar .chip')].map((x) => x.textContent) }));
    const c2 = (await calls(/rentals/)).map((c) => ({ url: c.url, body: c.body && JSON.parse(c.body) }));
    await clickAt('#sbar .oc-seq-bar .btn:nth-of-type(2)'); await sleep(300);
    const sum = await p.evaluate(() => (document.querySelector('#sbar .oc-seq-sum') || {}).textContent || '');
    await away();
    checks.push(['sequence: #sbar מציג את הפאנל במקום השדה הרגיל (enable_barcode_sequence_mode), הפוקוס בשדה', init.seq && init.focus === 'scanIn' && !init.pop],
      ['sequence: ברקוד + Enter = השכרה אוטומטית (verify-item ואז toggle rent), השדה התאפס ובפוקוס, עובר ללשונית פריטים', c1.length === 2 && c1[0].url === '/api/rentals/verify-item' && c1[1].body.action === 'rent' && c1[1].body.barcode === '45123801' && s1.val === '' && s1.focus === 'scanIn' && s1.tab === 'items'],
      ['sequence: יומן "נלקחה", מונה נסרקו 1', s1.chips[0] === 'נסרקו: 1' && /נלקחה/.test(s1.feed[0]) && /45123801/.test(s1.feed[0])],
      ['sequence: ברקוד לא תקף = שגיאה ביומן (נכשלו: 1) ולא כטוסט אדום חוסם', s2.chips[1] === 'נכשלו: 1' && /אינו תקף להשכרה/.test(s2.feed[0]) && !/\bon\b/.test(s2.toast) && /oc-seq-error/.test(s2.liCls)],
      ['sequence: ברקוד של פריט מושכר = החזרה "הוחזרה"', /הוחזרה/.test(s3.feed[0]) && s3.chips[0] === 'נסרקו: 2'],
      ['sequence: "בטל סריקה אחרונה" שולח undoReturn בלי חלון אישור; הרשומה נחצית; המונה יורד', c2.some((c) => c.body && c.body.action === 'undoReturn' && c.body.itemId === 'a3') && s4.chips[0] === 'נסרקו: 1' && s4.feed.some((t) => /בוטל/.test(t))],
      ['sequence: סיכום נסרקו / נכשלו עם הברקוד שנכשל', /נסרקו בהצלחה: 1/.test(sum) && /נכשלו: 1/.test(sum) && /99900001/.test(sum)]);
  } },
);


for (const st of STAGES) {
  const fn = D ? st.demo : st.real;
  if (!fn) continue;
  globalThis.__st = st.name;
  try { await fn(); await snap(st.name, st.roots); } catch (e) { console.log('STAGE-ERR', which, st.name, e.message); }
}
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
if (checks.length) { checks.forEach(([n, ok]) => console.log(ok ? 'CHECK ok  ' : 'CHECK FAIL', n)); if (checks.some(([, ok]) => !ok)) process.exitCode = 1; }
if (!D) fs.writeFileSync(`${OUT}/calls-${width}.json`, JSON.stringify(await p.evaluate(() => window.__calls || []), null, 1));
console.log('done', which, width, Object.keys(results).length);
await b.close(); if (s) s.close();
process.exit(process.exitCode || 0);
