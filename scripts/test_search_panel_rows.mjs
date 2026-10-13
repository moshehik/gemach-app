// פאנל התפוסה כשורות תוצאה רגילות (13.10.2026): בדיקות טהורות (lib/searchPanelRows.js) + רינדור SSR (renderToString) של הפאנל ושל HomeResults עם שורות הפאנל.
// מוודא: אין תגיות / צ'יפים בכותרת הפאנל, "איפה אני?" היא שורת התוצאה הראשונה באותו רכיב ובאותן מחלקות כמו שורת תוצאה של דף הבית (home/ResultRow.js),
// אין באנר אפור "חזרה לתפוסה", ה-N בכותרת סופר הכול, בלי כפילות מול תוצאות רגילות, הרחבת "איפה אני?" בעיצוב הרחבת שורת הלו״ז, ריווח מטוקן ב-CSS.
// SSR: SWC של Next (בלי DB, בלי שרת, בלי דפדפן). הרצה: node scripts/test_search_panel_rows.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

/* ---------- הרצת JSX / ESM של האתר ב-Node: SWC של Next -> CommonJS, כינוי @/, מחלקות CSS ו-next/link מדומים ---------- */
const swc = require(path.join(ROOT, 'node_modules/next/dist/build/swc'));
await swc.loadBindings();
const origLoad = Module._load;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...rest) {
  if (typeof request === 'string' && request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  return origResolve.call(this, request, ...rest);
};
Module._load = function load(request, ...rest) {
  if (typeof request === 'string' && request.endsWith('.css')) return {};
  // @hebcal/core (ESM בלבד) נטען בשרשרת הייבוא של homeLogic אך לא נקרא בשום נתיב שהבדיקה מפעילה (רק תאריכים עבריים בצ'יפים)
  if (request === '@hebcal/core' || request.startsWith('@hebcal/')) return new Proxy({}, { get: (_t, k) => (k === '__esModule' ? true : class {}) });
  if (request === 'next/link') {
    const React = origLoad.call(this, 'react', ...rest);
    return { __esModule: true, default: ({ href, children, ...p }) => React.createElement('a', { href, ...p }, children) };
  }
  return origLoad.call(this, request, ...rest);
};
const origJs = Module._extensions['.js'];
Module._extensions['.js'] = function ext(module, filename) {
  const norm = filename.split(path.sep).join('/');
  if (!norm.startsWith(ROOT.split(path.sep).join('/')) || norm.includes('/node_modules/')) return origJs(module, filename);
  const out = swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  return module._compile(out.code, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const h = React.createElement;
const { buildPanelModel } = require(path.join(ROOT, 'app/components/search/SearchPanel.js'));
const HomeResults = require(path.join(ROOT, 'app/components/home/HomeResults.js')).default;
const rowsLib = require(path.join(ROOT, 'lib/searchPanelRows.js'));
const homeLogic = require(path.join(ROOT, 'app/components/home/homeLogic.js'));

const html = (node) => renderToStaticMarkup(node);
const classes = (s) => [...s.matchAll(/class="([^"]*)"/g)].map((m) => m[1]);
const hasClass = (s, c) => classes(s).some((x) => x.split(/\s+/).includes(c));

/* ---------- נתוני פאנל סינתטיים (בצורה שהשרת שולח) ---------- */
const sRow = (extra) => ({ key: 'k' + Math.random(), orderId: 50274, name: 'קעטבי שירל', phone: '0506206661', hebDate: 'ד ניסן', state: 'returned', barcode: '5110403', size: '04', ...extra });
const panel = (extra = {}) => ({
  mode: 'model', model: { id: 'm1', name: '', prefix: 511 }, sizes: ['40'], date: { isToday: true, label: 'היום' },
  tiles: { stock: 0, busy: 0, reserve: 0, free: 0 }, perSize: [], modelLink: '/dashboard/dresses/m1',
  sections: {
    out: { total: 1, rows: [sRow({ key: 'o1', orderId: 60001, state: 'out', name: 'לוי דנה', late: true })] },
    returned: { total: 2, rows: [sRow({ key: 'r1' }), sRow({ key: 'r2', orderId: 49301, name: 'ענבה מלכי' })] },
    pending: { total: 0, rows: [] },
  },
  ...extra,
});
const sel = {};
const base = (p, over = {}) => ({ s: { state: 'ok', panel: p, sel, pickModel() {}, pickSize() {}, retry() {} }, wh: { state: 'idle', panel: null, retry() {} }, whereOpen: false, setWhereOpen() {}, more: {}, setMore() {}, compact: false, onOpen: undefined, ...over });
const whereRows = [
  { key: 'w1', barcode: '5110401', size: '06', state: 'out', stateLabel: 'מושכר', orderId: 60001, name: 'לוי דנה', phone: '0501111111', hebDate: 'ה אדר', late: false },
  { key: 'w2', barcode: '5110402', size: '06', state: 'out', stateLabel: 'מושכר', orderId: 60002, name: 'כהן שרה', phone: '', hebDate: 'ו אדר' },
  { key: 'w3', barcode: '5110403', size: '06', state: 'place', stateLabel: 'במקום', place: 'חנות', placeKnown: true },
];
const whereData = { mode: 'where', model: { id: 'm1', name: '', prefix: 511 }, total: 3, rows: whereRows, truncated: false, counts: {} };

console.log('lib/searchPanelRows.js');
t('מיפוי אייקונים/תוויות: בחוץ+הוחזרו = פריט (dress), ממתינות = הזמנה (file), איפה אני = pin', () => {
  assert.deepEqual({ ...rowsLib.GROUP_ROW.out }, { icon: 'dress', kind: 'פריט' });
  assert.deepEqual({ ...rowsLib.GROUP_ROW.returned }, { icon: 'dress', kind: 'פריט' });
  assert.deepEqual({ ...rowsLib.GROUP_ROW.pending }, { icon: 'file', kind: 'הזמנה' });
  assert.equal(rowsLib.GROUP_ROW.where.icon, 'pin');
});
t('אותו אייקון/תווית כמו שורה מאותו סוג בתוצאות דף הבית (unifiedRows)', () => {
  const rows = homeLogic.unifiedRows({ orders: [{ uuid: 'u', id: 1, n: 'א', url: '/orders/1', h: '', st: 'הוחזר' }], customers: [], rentals: [{ b: '5110403', n: 'א', url: '/orders/1', s: '04', rs: 'הוחזר', orderId: 1, cn: 'א', h: '' }] });
  const item = rows.find((r) => r.kind === 'פריט');
  const order = rows.find((r) => r.kind === 'הזמנה');
  assert.equal(rowsLib.GROUP_ROW.returned.icon, item.icon);
  assert.equal(rowsLib.GROUP_ROW.returned.kind, item.kind);
  assert.equal(rowsLib.GROUP_ROW.pending.icon, order.icon);
  assert.equal(rowsLib.GROUP_ROW.pending.kind, order.kind);
});
t('סטטוסים: אותם [מחלקה, אייקון] כמו RENTAL_STATE_STYLE של דף הבית', () => {
  const style = homeLogic.RENTAL_STATE_STYLE;
  const byLabel = (g) => rowsLib.rowStatuses({}, g)[0];
  for (const g of ['out', 'returned', 'pending']) {
    const s = byLabel(g);
    assert.ok(style[s.label], 'אין סטטוס ' + s.label + ' ב-RENTAL_STATE_STYLE');
    assert.deepEqual([s.cls, s.icon], style[s.label], g);
  }
  assert.deepEqual(rowsLib.rowStatuses({ late: true, alter: true, requires: true, draft: true }, 'pending').map((s) => s.label), ['טרם נלקח', 'באיחור', 'טיוטה', 'בהתאמה', 'חייבת את הפריט']);
});
t('מקומות / הזמנות רלוונטיות / דדופ', () => {
  assert.equal(rowsLib.whereLocation({ state: 'place', placeKnown: true, place: 'קרטון 3' }), 'קרטון 3');
  assert.equal(rowsLib.whereLocation({ state: 'place', placeKnown: false, place: '' }), 'לא מוגדר');
  assert.equal(rowsLib.whereLocation({ state: 'out', stateLabel: 'מושכר' }), 'מושכר');
  assert.deepEqual(rowsLib.whereOrders(whereRows), [60001, 60002]);
  const keys = rowsLib.leadKeys([{ orderId: 5, barcode: '111' }, { orderId: 6, barcode: '' }, {}]);
  assert.ok(rowsLib.isCovered(keys, { kind: 'order', orderId: 5 }));
  assert.ok(rowsLib.isCovered(keys, { kind: 'order', orderId: '6' }));
  assert.ok(rowsLib.isCovered(keys, { kind: 'item', orderId: 5, barcode: '111' }));
  assert.ok(!rowsLib.isCovered(keys, { kind: 'item', orderId: 5, barcode: '222' }));
  assert.ok(!rowsLib.isCovered(keys, { kind: 'item', orderId: 6, barcode: '' }));
  assert.ok(!rowsLib.isCovered(keys, { kind: 'customer', orderId: 5 }));
  const rows = [{ kind: 'הזמנה', orderId: 5 }, { kind: 'פריט', orderId: 5, barcode: '111' }, { kind: 'פריט', orderId: 5, barcode: '999' }, { kind: 'לקוח' }, { kind: 'הזמנה', orderId: 7 }];
  assert.deepEqual(rowsLib.dropCovered(rows, keys).map((r) => r.kind + (r.orderId || '')), ['פריט5', 'לקוח', 'הזמנה7']);
  assert.equal(rowsLib.dropCovered(rows, rowsLib.leadKeys([])), rows);
  assert.equal(rowsLib.leadCount([{ count: 1 }, { count: 0 }, { count: 1 }, {}]), 2);
});

console.log('כותרת הפאנל (ללא תגיות)');
const model = buildPanelModel(base(panel()));
const head = html(model.head);
t('אין תגיות / צ\'יפים בכותרת: לא class=chip, ובכותרת רק טקסט פשוט + ריבועים', () => {
  assert.ok(!hasClass(head, 'chip'), 'נשארה תגית בכותרת: ' + classes(head).filter((c) => /chip/.test(c)).join(' | '));
  assert.ok(!/btnlike/.test(head));
  assert.ok(head.includes('capstats') && head.includes('במלאי') && head.includes('בתפוסה היום') && head.includes('רזרבה'));
  assert.match(head, /<b>דגם <bdi dir="ltr">511<\/bdi> · מידה <bdi>40<\/bdi><\/b>/); // כותרת הדגם = טקסט פשוט, בלי רקע/מסגרת
  assert.match(head, /class="sp-meta">היום · פנויים <bdi>0<\/bdi> · <a href="\/dashboard\/dresses\/m1" class="sp-lnk">כרטיס הדגם<\/a>/); // פעולת "כרטיס הדגם" = קישור טקסט שקט
});
t('אין באנר אפור "חזרה לתפוסה" ואין .sp-where בשום מקום (גם לא בשורות)', () => {
  const all = head + model.lead.map((x) => html(x.node)).join('');
  assert.ok(!all.includes('חזרה לתפוסה') && !/sp-where[ "]/.test(all.replace(/data-sp-where=/g, '')));
  const opened = buildPanelModel(base(panel(), { whereOpen: true, wh: { state: 'ok', panel: whereData, retry() {} } }));
  const allOpen = html(opened.head) + opened.lead.map((x) => html(x.node)).join('');
  assert.ok(!allOpen.includes('חזרה לתפוסה') && !allOpen.includes('class="sp-where') && !/sp-where[ "]/.test(allOpen.replace(/data-sp-where=/g, '')));
});
t('בחירת מידה כשיש כמה: כפתורי טקסט (sp-lnk) ולא תגיות; "חזרה לכל המידות" כקישור טקסט', () => {
  const m = buildPanelModel(base(panel({ sizes: [], perSize: [{ key: 'a', size: '40', free: 0, stock: 2, busy: 2, reserve: 0 }, { key: 'b', size: '42', free: 1, stock: 2, busy: 1, reserve: 0 }] })));
  const s = html(m.head);
  assert.ok(!hasClass(s, 'chip') && s.includes('class="sp-lnk"') && s.includes('פירוט לפי מידה'));
  const m2 = buildPanelModel(base(panel(), { s: { state: 'ok', panel: panel(), sel: { size: '40' }, pickModel() {}, pickSize() {}, retry() {} } }));
  assert.ok(html(m2.head).includes('חזרה לכל המידות') && !hasClass(html(m2.head), 'chip'));
});
t('מצב פריט (ברקוד): בלי תגיות; מס׳ סידורי / מיקום / דגלים כטקסט עזר', () => {
  const item = panel({ mode: 'item', item: { barcode: '5110403', size: '04', serial: 7, location: 'חנות' }, itemMissing: false, flags: ['בתיקון'], tiles: { status: { kind: 'free' }, rentCount: 2, required: 0 }, date: undefined });
  const m = buildPanelModel(base(item));
  const s = html(m.head);
  assert.ok(!hasClass(s, 'chip'));
  assert.ok(s.includes('מס׳ סידורי') && s.includes('בתיקון') && s.includes('סיכום הפריט'));
  assert.ok(html(m.lead[0].node).includes('איפה המידה שלי?'));
});
t('מצב בחירת דגם: השבבים הפכו לשורות תוצאה (פעולה: בחירה), הכותרת טקסט פשוט', () => {
  const m = buildPanelModel(base({ mode: 'choose', candidatesTotal: 2, candidates: [{ prefix: 511, name: 'ורוד' }, { prefix: 512, name: '' }] }));
  assert.ok(!hasClass(html(m.head), 'chip') && html(m.head).includes('נמצאו 2 דגמים'));
  assert.equal(m.lead.length, 2);
  const s = html(m.lead[0].node);
  assert.ok(hasClass(s, 'lrow') && hasClass(s, 'rlink') && s.includes('ic-b') && s.includes('דגם') && !hasClass(s, 'chip'));
});

console.log('שורות הפאנל בתוך רשימת התוצאות');
const res = { customers: [], orders: [{ uuid: 'u1', id: 60001, n: 'לוי דנה', url: '/orders/60001', h: 'ה אדר', st: 'הושכר' }, { uuid: 'u2', id: 777, n: 'גולד אסתר', url: '/orders/777', h: 'ז אדר', st: 'בקרוב' }], rentals: [], dateChips: null };
const rendered = html(h(HomeResults, { res, query: '', lead: model.lead, none: false, table: false, onTable() {}, onExport() {} }));
t('"איפה אני?" היא שורת התוצאה הראשונה ברשימה, במחלקות ובמבנה של שורת תוצאה (li rlink lrow + ic-b/rlbl + t + go)', () => {
  const list = rendered.slice(rendered.indexOf('class="list"'));
  const firstRow = /<(?:a|div)[^>]*class="li rlink lrow[^"]*"[\s\S]*?<\/div><svg[^>]*class="ic sm go"/.exec(list);
  assert.ok(firstRow, 'לא נמצאה שורה ראשונה');
  assert.ok(firstRow[0].includes('איפה אני?'), 'השורה הראשונה אינה "איפה אני?"');
  assert.ok(firstRow[0].includes('class="ic-b"') && firstRow[0].includes('class="rlbl">מיקום<') && firstRow[0].includes('#gmi-pin') && firstRow[0].includes('class="t"'));
  assert.ok(firstRow[0].includes('המיקום של כל ברקוד בדגם 511 מידה 40'));
});
t('אותה צורת שורה בדיוק (שורות הפאנל והתוצאות הרגילות): כל שורה li rlink lrow עם ic-b + rlbl + t + go', () => {
  const rowStarts = [...rendered.matchAll(/class="li (?:rlink )?lrow[^"]*"[^>]*>(.{0,260})/g)];
  assert.ok(rowStarts.length >= 5, 'מעט שורות: ' + rowStarts.length);
  for (const m of rowStarts) assert.match(m[1], /^<div class="ic-b"><svg class="ic"[^>]*><use [^>]*><\/use><\/svg><span class="rlbl">[^<]+<\/span><\/div><div class="t">/);
});
t('כותרות קבוצה (rgrp-h) ומצב ריק (empty rgrp-empty) באותה רשימה; בחוץ/הוחזרו/ממתינות', () => {
  assert.equal((rendered.match(/class="rgrp-h"/g) || []).length, 3);
  assert.ok(rendered.includes('בחוץ (מושכרים)') && rendered.includes('הוחזרו (האחרונים)') && rendered.includes('הזמנות שצריכות את הדגם והמידה ועדיין לא נלקחו'));
  assert.ok(rendered.includes('class="empty rgrp-empty">אין הזמנות עתידיות שממתינות'));
  const iOut = rendered.indexOf('בחוץ (מושכרים)'); const iRet = rendered.indexOf('הוחזרו (האחרונים)'); const iPend = rendered.indexOf('ממתינות</div>');
  assert.ok(rendered.indexOf('איפה אני?') < iOut && iOut < iRet && iRet < iPend);
});
t('אייקונים/תוויות/סטטוסים של שורות הפאנל: שורת פריט (dress / "פריט") עם Stx, מושכר = bag, הוחזר = check ok, באיחור = warn', () => {
  assert.ok(rendered.includes('<span class="rlbl">פריט</span>') && rendered.includes('#gmi-dress'));
  assert.ok(rendered.includes('class="stx "><svg class="ic" focusable="false" aria-hidden="true"><use href="#gmi-bag"') || /class="stx "[^>]*><svg[^>]*><use href="#gmi-bag"/.test(rendered));
  assert.ok(/class="stx ok"[^>]*><svg[^>]*><use href="#gmi-check"/.test(rendered));
  assert.ok(/class="stx warn"[^>]*><svg[^>]*><use href="#gmi-clock"/.test(rendered) && rendered.includes('באיחור'));
  assert.ok(!hasClass(rendered, 'chip') || !/class="chip/.test(rendered.slice(rendered.indexOf('class="list"'))), 'נשארו תגיות ברשימה');
});
t('"תוצאות (N)" סופר את כל השורות: איפה אני (1) + בחוץ (1) + הוחזרו (2) + תוצאות רגילות שלא כוסו (הזמנה 777; 60001 כבר בפאנל = לא מוכפלת)', () => {
  assert.ok(rendered.includes('(<!-- -->5<!-- -->)') || /תוצאות <span class="faint">\(5\)<\/span>/.test(rendered) || /\(<!-- -->5<!-- -->\)/.test(rendered) || />\(5\)</.test(rendered), 'N != 5');
  assert.equal((rendered.match(/href="\/orders\/60001"/g) || []).length, 1, 'הזמנה 60001 מופיעה יותר מפעם אחת');
  assert.equal((rendered.match(/href="\/orders\/777"/g) || []).length, 1);
});
t('בלי תוצאות רגילות: אין "אין תוצאות לחיפוש הזה" מעל שורות הפאנל; בלי פאנל - ההודעה נשארת', () => {
  const none = html(h(HomeResults, { res: { customers: [], orders: [], rentals: [], dateChips: null }, query: '', lead: model.lead, none: true, table: false, onTable() {}, onExport() {} }));
  assert.ok(!none.includes('אין תוצאות לחיפוש הזה') && none.includes('איפה אני?'));
  const noLead = html(h(HomeResults, { res: { customers: [], orders: [], rentals: [], dateChips: null }, query: '', none: true, table: false, onTable() {}, onExport() {} }));
  assert.ok(noLead.includes('אין תוצאות לחיפוש הזה'));
});

console.log('הרחבת "איפה אני?" (עיצוב הרחבת שורת לו״ז)');
const opened = buildPanelModel(base(panel(), { whereOpen: true, wh: { state: 'ok', panel: whereData, retry() {} } }));
const openHtml = html(h(HomeResults, { res: { customers: [], orders: [], rentals: [], dateChips: null }, query: '', lead: opened.lead, none: true, table: false, onTable() {}, onExport() {} }));
t('נפתחת מתחת לשורה, באותם רכיבים: .hres > .hrow.open > .hdet > .hdet-in > .hv-r (small = תווית, b = ערך)', () => {
  assert.equal(opened.lead[1].key, 'where-x');
  assert.ok(openHtml.includes('<div class="hres sp-xp"') && openHtml.includes('<div class="hrow open"><div class="hdet"><div class="hdet-in">'));
  assert.ok(/<div class="hv-r"><small>שמלה<\/small><b>/.test(openHtml));
  assert.ok(openHtml.indexOf('איפה אני?') < openHtml.indexOf('class="hres sp-xp"') && openHtml.indexOf('class="hres sp-xp"') < openHtml.indexOf('בחוץ (מושכרים)'));
  assert.ok(openHtml.includes('aria-expanded="true"') && openHtml.includes('li rlink lrow sp-open'));
});
t('שורה לכל ברקוד: "דגם 511 · מידה 06 · ברקוד" + שבב מיקום עם אייקון סיכה (chip gray) - מושכר / חנות', () => {
  assert.equal((openHtml.match(/<small>שמלה<\/small>/g) || []).length, 3);
  assert.ok(openHtml.includes('<span class="chip gray"><svg class="ic" focusable="false" aria-hidden="true"><use href="#gmi-pin"') || /<span class="chip gray"><svg[^>]*><use href="#gmi-pin"[^>]*\/><\/svg>מיקום: <!-- -->מושכר<\/span>/.test(openHtml) || /מיקום: (?:<!-- -->)?מושכר/.test(openHtml));
  assert.ok(/מיקום: (?:<!-- -->)?חנות/.test(openHtml));
});
t('בשורות מושכרות: שם + טלפון + הזמנה, ולחצן "מעבר להזמנה" (btn ghost sm) לכל הזמנה; ומעבר להזמנות הרלוונטיות כשיש כמה', () => {
  assert.equal((openHtml.match(/>מעבר להזמנה<\/a>/g) || []).length, 2);
  assert.ok(/href="\/orders\/60001" class="btn ghost sm sp-ordbtn"/.test(openHtml) && /href="\/orders\/60002" class="btn ghost sm sp-ordbtn"/.test(openHtml));
  assert.ok(openHtml.includes('לוי דנה') && openHtml.includes('0501111111'));
  assert.ok(openHtml.includes('מעבר להזמנות הרלוונטיות:') && openHtml.includes('>#60001<') && openHtml.includes('>#60002<'));
});
t('הרחבה עם הזמנה אחת: אין "מעבר להזמנות הרלוונטיות"; בלי ברקודים: "לא נמצאו ברקודים" כהודעה פשוטה; טעינה / שגיאה', () => {
  const one = buildPanelModel(base(panel(), { whereOpen: true, wh: { state: 'ok', panel: { ...whereData, rows: whereRows.slice(0, 1) }, retry() {} } }));
  assert.ok(!html(one.lead[1].node).includes('מעבר להזמנות הרלוונטיות') && html(one.lead[1].node).includes('מעבר להזמנה'));
  const empty = buildPanelModel(base(panel(), { whereOpen: true, wh: { state: 'ok', panel: { ...whereData, rows: [] }, retry() {} } }));
  assert.ok(html(empty.lead[1].node).includes('לא נמצאו ברקודים'));
  const loading = buildPanelModel(base(panel(), { whereOpen: true, wh: { state: 'loading', panel: null, retry() {} } }));
  assert.ok(html(loading.lead[1].node).includes('aria-busy="true"'));
  const err = buildPanelModel(base(panel(), { whereOpen: true, wh: { state: 'error', panel: null, retry() {} } }));
  assert.ok(html(err.lead[1].node).includes('נסו שוב'));
});
t('פרטיות: בלי שם / טלפון (מושכר בלי הרשאה) - אין חשיפה, נשאר "משפחה" ולחצן ההזמנה', () => {
  const red = { ...whereData, rows: whereRows.map((r) => ({ ...r, name: '', phone: '' })) };
  const m = buildPanelModel(base(panel(), { whereOpen: true, wh: { state: 'ok', panel: red, retry() {} } }));
  const s = html(m.lead[1].node);
  assert.ok(!s.includes('לוי דנה') && !s.includes('0501111111') && s.includes('משפחה') && s.includes('מעבר להזמנה'));
});

console.log('חיפוש מהיר (compact)');
const cm = buildPanelModel(base(panel(), { compact: true }));
t('compact: כותרת בלי תגיות; שורות sn-link עם sn-li (אייקון), סטטוס כ-sn-k, "איפה אני?" ראשונה, כותרות קבוצה sn-st', () => {
  assert.ok(!hasClass(html(cm.head), 'chip') && html(cm.head).includes('sp-compact'));
  const rows = cm.lead.map((x) => html(x.node));
  assert.ok(rows[0].includes('sn-link') && rows[0].includes('sn-li') && rows[0].includes('איפה אני?') && rows[0].includes('aria-expanded="false"'));
  assert.ok(rows.some((r) => r.includes('sn-st sp-sh') && r.includes('בחוץ (מושכרים)')));
  assert.ok(rows.some((r) => /class="sn-k sp-st">מושכר עכשיו</.test(r)) && rows.some((r) => r.includes('הוחזר</span>')));
  assert.ok(rows.every((r) => !hasClass(r, 'chip')));
  assert.equal(rowsLib.leadCount(cm.lead), 4); // איפה אני + בחוץ + 2 הוחזרו
});
t('compact: ההרחבה באותו עיצוב (hres/hdet/hv-r + לחצני מעבר להזמנה) ובלי חזרה-לתפוסה', () => {
  const o = buildPanelModel(base(panel(), { compact: true, whereOpen: true, wh: { state: 'ok', panel: whereData, retry() {} } }));
  const s = html(o.lead[1].node);
  assert.ok(s.includes('hres sp-xp') && s.includes('hrow open') && s.includes('hdet-in') && s.includes('hv-r') && s.includes('btn ghost sm sp-ordbtn') && !s.includes('חזרה לתפוסה'));
});

console.log('CSS / חיווט (סטטי)');
t('ריווח מטוקן: .sp עם padding:var(--gm-s2), הצורה הדחוסה var(--gm-s1); בלי גובה/צבע קשיחים חדשים ובלי כללי תגית', () => {
  const css = read('app/components/search/searchPanel.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.gm-ds \.sp\{[^}]*padding:var\(--gm-s2\)/);
  assert.match(css, /\.gm-ds \.sp\.sp-compact\{[^}]*padding:var\(--gm-s1\)/);
  assert.ok(!/sp-chips|sp-where|btnlike/.test(css) && css.match(/\.chip/g).length === 1 && css.includes('.sp-itm .chip{margin:0}'), 'נשארו כללי תגית ב-searchPanel.css'); // התגית היחידה: שבב המיקום בהרחבה (עיצוב הלו״ז)
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css.replace(/background:#fff/g, '').replace(/#fff/g, '')), 'צבע hex קשיח חדש');
});
t('HomeA5 מזין את HomeResults ב-lead מאותו hook; MenuSearchPanel מזין את רשימת התפריט ובלי כפילות מול תוצאות החיפוש', () => {
  const a5 = read('app/components/home/HomeA5.js');
  assert.ok(a5.includes('useSearchPanelModel(resQuery') && a5.includes('lead={panel.lead}') && a5.includes('{panelOn ? panel.head : null}') && !a5.includes('<SearchPanel'));
  const menu = read('app/components/menu/MenuSearchPanel.js');
  assert.ok(menu.includes('useSearchPanelModel(panelTerm') && menu.includes('panel.lead.map') && menu.includes('isCovered(panelKeys') && !menu.includes('<SearchPanel'));
});
t('שורת התוצאה היא רכיב אחד: HomeResults משתמש ב-ResultRow (אותו קוד כמו הפאנל), בלי עותק של .li.rlink.lrow ב-HomeResults', () => {
  const res2 = read('app/components/home/HomeResults.js');
  assert.ok(res2.includes("from './ResultRow'") && res2.includes('<ResultRow') && !/className="li rlink lrow"/.test(res2) && !res2.includes('function Stx'));
  const sp = read('app/components/search/SearchPanel.js');
  assert.ok(sp.includes("from '../home/ResultRow'") && sp.includes('<ResultRow') && !/className="li (rlink )?lrow/.test(sp));
});
t('אין "טוגל" בקבצים ששונו', () => {
  for (const f of ['app/components/search/SearchPanel.js', 'app/components/home/ResultRow.js', 'lib/searchPanelRows.js', 'app/components/search/searchPanel.css']) assert.ok(!/טוגל/.test(read(f)), f);
});

console.log(`\n${passed} passed`);
if (process.exitCode) console.error('FAILED');
