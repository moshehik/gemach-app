// מצלם כל מצב של דף הלו״ז בדף האמיתי (real) ובעיצוב המאושר (demo) ושומר את ה-computed style של כל אלמנט + מלבני מיקום (RTL).
// שימוש: node stages.mjs demo|real [רוחב=1280]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, HERE, PORT, DEMO } from './lib.mjs';
const which = process.argv[2];
const width = Number(process.argv[3] || 1280);
const D = which === 'demo';
const OUT = path.join(HERE, 'out'); fs.mkdirSync(OUT, { recursive: true });
const TODAY = '2026-10-04'; // "היום" של ההדמיה (entry.jsx, יום ראשון); בעיצוב "היום" הוא תאריך המחשב - ההשוואה היא לפי מצב, לא לפי תאריך
const pad = (n) => String(n).padStart(2, '0');
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };

// מפתח האלמנט: רק המחלקות (בלי שם התג - בעיצוב שורת הציר היא div ובדף האמיתי button), בלי מחלקות מצב/הנפשה,
// עם עד שלושה אבות בתוך השורש. אותו מפתח בשני הצדדים = אותו רכיב.
const DUMP = (rootSel) => {
  const root = document.querySelector(rootSel);
  if (!root) return null;
  const out = [];
  const SKIP = /^(on|open|t|fut|z|today|sh|is-miss|lz-flash|hasm|active|done|foc|lz-loading|rv-hl|lz-unstick|ia-h|ia-[a-z]+|ltr|pl-tt-on)$/;
  const key = (el) => {
    const cls = [...el.classList].filter((c) => !SKIP.test(c) && !/^rv-/.test(c)).slice(0, 3);
    return cls.length ? '.' + cls.join('.') : el.tagName.toLowerCase();
  };
  const sel = (el) => { const p = []; let e = el; while (e && e !== root && e.nodeType === 1 && p.length < 3) { p.unshift(key(e)); e = e.parentElement; } return p.join('>'); };
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { a: p.length > 3 ? p[3] : 1 }; };
  const SIZED = /(^|\.)(btn|ibtn|chip|xlbtn|vsw|st-stab|lz-mark|lz-all|adm-hi|ic-b|st-sic|sn-badge|lz-dicon|hc-d|hc-n|lz-go|pg-ttl|adm-h|dbadge|dlg|tb|tclose)(\.|$|>)/;
  root.querySelectorAll('*').forEach((el) => {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
    if (el.closest('.rv-scope,#rvLayer,#tt,.pl-tt') || /^rv-/.test(el.id)) return;
    // חלון "בטוח?" והטוסט נבדקים במצבים משלהם (root = .scrim / #toast), לא כחלק מהדף
    if (rootSel === '.lz-app' && el.closest('.scrim,#toast')) return;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (cs.visibility === 'hidden') return;
    if (/^(script|style|path|use|circle|rect|g|line|polyline|polygon|defs|symbol|bdi)$/i.test(el.tagName)) return;
    const bg = cs.backgroundColor, bi = cs.backgroundImage, bf = cs.backdropFilter || cs.webkitBackdropFilter;
    const p = parse(bg); const has = p && p.a > 0;
    const bw = cs.borderTopWidth, bsty = cs.borderTopStyle;
    const k = sel(el);
    const o = { sel: k, bg: has ? bg.replace(/ /g, '') : '', bi: bi === 'none' ? '' : bi.replace(/ /g, '').replace(/url\([^)]*\)/g, 'url(…)').slice(0, 90), bf: bf && bf !== 'none' ? bf : '',
      col: cs.color.replace(/ /g, ''), bd: bsty === 'none' || bw === '0px' ? '' : cs.borderTopColor.replace(/ /g, '') + '/' + bw, bs: cs.boxShadow === 'none' ? '' : cs.boxShadow.replace(/ /g, '').slice(0, 90),
      rad: cs.borderTopLeftRadius, op: cs.opacity === '1' ? '' : cs.opacity, ff: cs.fontFamily.split(',')[0].replace(/"/g, ''), fs: cs.fontSize, fw: cs.fontWeight,
      pad: cs.padding, cur: cs.cursor === 'auto' ? '' : cs.cursor, tr: cs.transitionDuration.split(',')[0].trim() === '0s' ? '' : cs.transitionDuration.split(',').slice(0, 2).join(',').replace(/ /g, ''),
      dis: el.disabled ? 1 : '' }; // כבוי? (cmp.mjs: הבדל סמן על רכיב כבוי = רעש, לא הבדל עיצוב)
    if (SIZED.test(k.split('>').pop())) o.ht = Math.round(r.height) + 'px';
    out.push(o);
  });
  return out;
};
// מלבנים של נקודות ציון (ימין/שמאל/רוחב) לבדיקת יישור ו-RTL. ב-RTL "ימין" = right גדול יותר.
const LAYOUT = () => {
  const items = [];
  const add = (k, el) => { if (!el) return; const r = el.getBoundingClientRect(); if (r.width) items.push({ k, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }); };
  add('app', document.querySelector('.lz-app'));
  add('topbar', document.querySelector('.lz-app .topbar'));
  add('h1', document.querySelector('.lz-app h1.pg-ttl'));
  add('h1-small', document.querySelector('.lz-app h1.pg-ttl small'));
  add('dicon', document.querySelector('.lz-dicon'));
  add('dtools', document.querySelector('.lz-app .topbar .lz-dtools'));
  document.querySelectorAll('.lz-app .topbar .lz-dtools > *').forEach((b, i) => add('dtool' + i + ':' + (b.getAttribute('aria-label') || b.className), b));
  add('rail', document.querySelector('.lz-rail'));
  add('rail-h', document.querySelector('.lz-rh'));
  add('sbar', document.querySelector('.lz-snav .sbar'));
  add('staff', document.querySelector('.lz-staff'));
  add('main', document.querySelector('.lz-main'));
  add('hb', document.querySelector('.lz-hb'));
  add('vsw', document.querySelector('.vsw'));
  add('dpanel', document.querySelector('.lz-dpanel')); add('dnav', document.querySelector('.lz-dnav')); add('quick', document.querySelector('.lz-quick'));
  add('dlg', document.querySelector('.scrim .dlg')); add('dbtns', document.querySelector('.scrim .dbtns')); add('toast', document.querySelector('#toast.on'));
  add('note', document.querySelector('.lz-note'));
  add('nwd', document.querySelector('.lz-nwd'));
  add('branches', document.querySelector('.lz-branches'));
  const sec = document.querySelector('#stages .lz-sec');
  if (sec) {
    add('sec', sec); add('sec-h2', sec.querySelector('.adm-h')); add('sec-hi', sec.querySelector('.adm-hi')); add('sec-all', sec.querySelector('.lz-all')); add('sec-chips', sec.querySelector('.lz-chips')); add('sec-tools', sec.querySelector('.lz-stools'));
    add('card', sec.querySelector('.lz-st')); add('pbar', sec.querySelector('.lz-pbar'));
    const li = sec.querySelector('.hres .li'); if (li) { add('row', li); add('row-icb', li.querySelector('.ic-b')); add('row-t', li.querySelector('.t')); add('row-act', li.querySelector('.lz-act')); add('row-mark', li.querySelector('.lz-mark')); add('row-go', li.querySelector('.lz-go')); }
  }
  document.querySelectorAll('.st-stab').forEach((b, i) => { if (i < 3) add('stab' + i, b); });
  return items;
};
let s;
if (!D) s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width, height: 900, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
const results = {}; const layout = {};
const snap = async (name, { full = false, wait = 650, root = '.lz-app' } = {}) => {
  await sleep(wait);
  if (full && width >= 768) { const app = await p.$('.lz-app'); if (app) await app.screenshot({ path: `${OUT}/${which}-${width}-${name}.png` }); else await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png`, fullPage: true }); }
  else await p.screenshot({ path: `${OUT}/${which}-${width}-${name}.png` });
  results[name] = (await p.evaluate(DUMP, root)) || [];
  layout[name] = await p.evaluate(LAYOUT);
  console.log('  ', which, name, results[name].length, 'elements');
};
// nav=<n>: כתובת שונה בכל טעינה - בלעדיו מעבר שמשנה רק את ה-#m הוא ניווט בתוך אותו מסמך (בלי טעינה), והמצבים 24/25
// צולמו בטעות על הדף של מצב הטעינה (23) - שלד במקום "אין הרשאה" / תצוגת עובדת
let nav = 0;
const url = (date, mock) => D ? DEMO : `http://127.0.0.1:${PORT}/schedule?${date ? 'date=' + date + '&' : ''}nav=${++nav}#m=${encodeURIComponent(JSON.stringify(mock || {}))}`;
const blur = () => p.evaluate(() => document.activeElement && document.activeElement.blur());
const park = async () => { await p.mouse.move(2, 2); await blur(); await sleep(200); };
const hover = async (selector) => { const el = await p.$(selector); if (!el) { console.log('   (no element for hover:', selector + ')'); return false; } await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(120); const bb = await el.boundingBox(); if (!bb) { console.log('   (not visible for hover:', selector + ')'); return false; } await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
const jsClick = (selector) => p.evaluate((q) => { const e = document.querySelector(q); if (e) e.click(); return !!e; }, selector);
const clickSel = async (selector) => { const el = await p.$(selector); if (!el) { console.log('   (no element for click:', selector + ')'); return false; } await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(120); await el.click(); return true; };
const setDemo = async (id, v) => { if (D) { await p.select('#' + id, v); await sleep(400); } };
async function fresh({ date, mock, demoState = 'normal', demoRole = 'mgmt', scrollTop = true } = {}) {
  await p.goto(url(date, mock), { waitUntil: 'load' });
  if (D) { await p.evaluate(() => { try { localStorage.removeItem('lz_done_v1'); localStorage.removeItem('lz_view'); localStorage.removeItem('lz_cfg_v2'); } catch {} }); await p.goto(url(), { waitUntil: 'load' }); }
  else await p.evaluate(() => { try { localStorage.removeItem('lz_view'); } catch {} });
  await sleep(D ? 1200 : 900);
  if (D) { await setDemo('rvRole', demoRole); await setDemo('rvState', demoState); await setDemo('rvBadges', 'off'); if (demoState !== 'loading') await jsClick('#qToday'); await sleep(300); }
  if (scrollTop) await p.evaluate(() => window.scrollTo(0, 0));
  await park();
}
// 1. היום (יום רגיל) - שורות, ריחוף, פוקוס, לחיצה
await fresh({ date: TODAY });
await snap('01-today', { full: true });
await hover('#stages .hres .li'); await snap('02-row-hover');
await park(); await hover('#stages .lz-go'); await snap('03-go-hover');
await park(); if (await hover('#stages .lz-mark')) await snap('04-mark-hover');
await park(); await p.evaluate(() => { const b = document.querySelector('#stages .lz-mark'); if (b) b.focus(); }); await snap('05-mark-focus');
// לחיצה על "בוצע" -> חלון "בטוח?" (S03) -> "כן" -> טוסט + השורה דלוקה (lz-mark.on) -> ריחוף על הלחצן הדלוק
{ const el = await p.$('#stages .lz-mark'); if (el) { const bb = await el.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await snap('06-mark-active'); await p.mouse.up(); await sleep(500);
  await snap('06b-mark-confirm', { root: '.scrim', wait: 200 });
  await jsClick('.scrim .dbtns .btn.primary'); await sleep(450);
  await snap('06c-mark-toast', { root: '#toast', wait: 200 });
  await park(); await snap('06d-marked-row');
  if (await hover('#stages .lz-mark.on')) await snap('06e-done-hover');
  await park(); await sleep(3600); } }
// "הכל בוצע": ריחוף, ואז לחיצה -> חלון "בטוח?" (S04) -> ביטול
await park(); if (await hover('#stages .lz-all')) await snap('07-all-hover');
if (await jsClick('#stages .lz-all')) { await sleep(500); await snap('07c-all-confirm', { root: '.scrim', wait: 200 }); await jsClick('.scrim .dbtns .btn.ghost'); await sleep(450); }
await park(); if (await hover('#stages .lz-stools .xlbtn')) await snap('07b-stool-hover');
await park(); await hover('.st-stab:nth-child(2)'); await snap('08-rail-hover');
await park(); await jsClick('.st-stab:nth-child(3)'); await park(); await snap('09-rail-filter-on');
await jsClick('.st-stab:nth-child(1)'); await park();
await hover('.vsw'); await snap('10-vsw-hover');
await park(); if (await hover('#stages .lz-retw')) await snap('11-retw-hover');
// "הוחזר לא תקין" (A4): ריחוף עליו, לחיצה -> חלון "בטוח?" (אדום) -> "כן" -> טוסט + שבב "לא תקין" + "בוצע" דלוק (B17)
if (await hover('#stages .lz-retw .lz-bad')) {
  await snap('11b-bad-hover');
  await jsClick('#stages .lz-retw .lz-bad'); await sleep(500); await snap('11c-bad-confirm', { root: '.scrim', wait: 200 });
  await jsClick('.scrim .dbtns .btn.primary'); await sleep(450); await snap('11d-bad-toast', { root: '#toast', wait: 200 });
  await park(); await snap('11e-bad-row'); await sleep(3600);
}
await park();
// 2. תצוגת טבלה
await jsClick(D ? '#vsw .vopt[data-view=table]' : '.vsw .vopt[aria-label="תצוגת טבלה"]'); await park(); await snap('12-table', { full: true });
await hover('#stages .rtbl tbody tr'); await snap('13-table-row-hover');
await park(); await jsClick(D ? '#vsw .vopt[data-view=rows]' : '.vsw .vopt[aria-label="תצוגת שורות"]'); await park();
// 3. בורר התאריך: ריחוף על האייקון פותח את הסרגל; ריחוף על "היום"; לוח התאריך העברי
if (width < 821) await jsClick('.lz-dicon'); // בנייד הסרגל נפתח בלחיצה על האייקון (לא בריחוף)
await hover('.lz-dicon'); await snap('14-date-hover');
await hover('.lz-quick .btn:first-child'); await snap('15-quick-hover');
await hover('.lz-quick .btn:last-child'); await snap('15b-quick2-hover');
await hover('.lz-dnav .ibtn'); await snap('15c-prev-hover');
await jsClick('.lz-date'); await sleep(300); await snap('16-datepick-open');
await hover('.lz-pop .hc-d:not(.on):not(.sh)'); await snap('17-datepick-day-hover');
await p.keyboard.press('Escape'); await park();
// 4. יום שעבר (התראות איחור + שורות שבוצעו)
await fresh({ date: addDays(TODAY, -10), demoState: 'heavy' });
if (D) { for (let i = 0; i < 8; i++) await jsClick('#dPrev'); await sleep(300);
  await p.evaluate(() => { const L = window.LZ; const day = (location.hash || '').slice(1); ['prep', 'repair', 'manret'].forEach((k) => L.itemsFor(day, k).slice(0, 2).forEach((o) => L.setDone(o, k, false))); window.dispatchEvent(new Event('hashchange')); }); await sleep(500); await p.evaluate(() => window.scrollTo(0, 0)); await park(); }
await snap('18-past-late', { full: true });
await hover('#stages .lz-late .li'); await snap('19-past-late-row-hover');
await park(); if (await hover('#stages .lz-mark.on')) await snap('20-past-done-hover');
await park();
// 5. יום עתידי
await fresh({ date: addDays(TODAY, 3) });
if (D) { for (let i = 0; i < 3; i++) await jsClick('#dNext'); await sleep(300); await p.evaluate(() => window.scrollTo(0, 0)); await park(); }
await snap('21-future', { full: true });
// 6. יום ריק
await fresh({ date: addDays(TODAY, 5), demoState: 'empty' });
await snap('22-empty', { full: true });
// 7. טעינה
await fresh({ date: TODAY, mock: { delay: 8000 }, demoState: 'loading' });
await snap('23-loading', { full: true, wait: 400 });
// 8. בלי הרשאה (בעיצוב: תפקיד אורח)
await fresh({ date: TODAY, mock: { err: 403 }, demoRole: 'guest' });
await snap('24-forbidden', { full: true });
// 9. עובדת (בלי הערות פנימיות; בעיצוב: בלי "הכל בוצע" ובלי XL)
await fresh({ date: TODAY, mock: { mgmt: false }, demoRole: 'worker' });
await snap('25-worker', { full: true });
if (!D) {
  await fresh({ date: TODAY, mock: { err: 500 } }); await snap('26-error500-real-only', { full: true });
  await fresh({ date: '2026-10-03' }); await snap('27-nonworking-real-only', { full: true });
  await fresh({ date: TODAY, mock: { branches: true } }); await snap('28-branches-real-only', { full: true });
  // טבלת הסימונים חסרה (שרת ישן): שלבים בלי מקור "בוצע" בלי לחצן ובלי פס; אורח במצב פתוח: לחצן כבוי באותו מראה
  await fresh({ date: TODAY, mock: { marks: false } }); await snap('29-marks-unavailable-real-only', { full: true });
  await fresh({ date: TODAY, mock: { canMark: false } }); await snap('30-cannot-mark-real-only', { full: true });
  if (await hover('#stages .lz-mark')) await snap('30b-cannot-mark-hover');
  await park();
}
fs.writeFileSync(`${OUT}/${which}-${width}.json`, JSON.stringify(results, null, 1));
fs.writeFileSync(`${OUT}/${which}-${width}-layout.json`, JSON.stringify(layout, null, 1));
console.log('done', which, width, Object.keys(results).length, 'states');
await b.close(); if (s) s.close();
process.exit(0);
