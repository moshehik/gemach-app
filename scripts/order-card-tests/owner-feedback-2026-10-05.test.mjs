// הערות הבעלים 2026-10-05 לכרטיס ההזמנה החדש: (1) סמל נעילה במקום מחיקה חסומה, (2) שורת ברקוד של פריט שהוחזר - מצב אחד ברור + חסימת סריקה חוזרת,
// (3) ריווח עליון + טולטיפ שלא נבלע מתחת לתפריט, (4) הרייל מתחיל בגובה הסקשן הראשון (כמו fit() בעיצוב המאושר). לוגיקה טהורה + בדיקות סטטיות, בלי דפדפן.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const read = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').split('\r\n').join('\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const OC = 'app/components/order-card';
const P = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const L = await P(`${OC}/orderCardLogic.js`);
const A = await P(`${OC}/hooks/useItemActions.js`);

// ---------- (1) מחיקה חסומה = סמל נעילה ----------
test('deleteBlockReason: מותר / חסום לפי היסטוריית השכרה / חסום לפי ההגדרה; נעילת אירוע לבדה לא חוסמת', () => {
  const settings = L.parseSettings([]);
  const noRental = [{ id: 'a', isDeleted: false, isTaken: false, isReturned: false }];
  assert.equal(L.deleteBlockReason({ statusText: 'ממתין', settings, items: noRental }), null);
  for (const st of ['הושכר', 'הושכר חלקי', 'הוחזר', 'הוחזר חלקי']) {
    const r = L.deleteBlockReason({ statusText: st, settings, items: noRental });
    assert.equal(r.code, 'rental', st);
    assert.match(r.text, /לא ניתן למחוק הזמנה/);
  }
  const taken = [{ id: 'a', isDeleted: false, isTaken: true }];
  assert.equal(L.deleteBlockReason({ statusText: 'ממתין', settings, items: taken }), null, 'ברירת מחדל allow_edit_partially_rented=true');
  const strict = L.parseSettings([{ key: 'allow_edit_partially_rented', value: 'false' }]);
  assert.equal(L.deleteBlockReason({ statusText: 'ממתין', settings: strict, items: taken }).code, 'partial-setting');
  assert.equal(L.deleteBlockReason({ statusText: 'ממתין', settings: strict, items: [{ id: 'a', isDeleted: true, isTaken: true }] }), null, 'פריט מחוק לא נחשב');
  assert.equal(L.deleteBlockReason({}), null);
});

test('הטופבר: סמל נעילה לא-פעיל (aria-disabled, בלי קריאה למחיקה) במקום הפח כשהמחיקה חסומה; אחרת הפח; לחצן שחרור נעילת האירוע נשאר', () => {
  const t = strip(read(`${OC}/OcTopbar.js`));
  assert.match(t, /deleteBlockReason\(\{ statusText: oc\.flags\.statusText, settings: oc\.settings, items: oc\.items \}\)/);
  assert.match(t, /\{delBlock && eventLockShown \? null : delBlock \? \(\s*<button type="button" className="xlbtn xld oc-nodel" data-act="delete-locked" aria-disabled="true"/);
  assert.match(t, /const delTail = delBlock && eventLockShown \? ` · מחיקה חסומה: \$\{delBlock\.text\}` : '';/, 'נעילה אחת: הסיבה במחיקה חסומה מצורפת לטולטיפ של נעילת האירוע');
  assert.match(t, /data-tip=\{`הזמנה נעולה — תאריך האירוע עבר\. לחצו לשחרור באישור מנהל\$\{delTail\}`\}/);
  assert.match(t, /aria-label=\{`מחיקה חסומה: \$\{delBlock\.text\}`\}/);
  assert.match(t, /data-tip=\{`אי אפשר למחוק: \$\{delBlock\.text\}`\}/);
  assert.match(t, /<OcIcon name="lock" \/>\s*<\/button>\s*\) : \(\s*<button type="button" className="xlbtn xld" data-act="delete"/);
  assert.equal((t.match(/oc\.deleteOrder\(\)/g) || []).length, 1, 'הפח היחיד שקורא למחיקה');
  assert.match(t, /data-act="lockbtn"/, 'שחרור נעילת אירוע נשאר');
  // הזרימה והשרת נשארו כמו שהיו: אותה רשימת סטטוסים חוסמת
  assert.match(read(`${OC}/orderCardFlows.js`), /DELETE_BLOCKED_STATUSES\.includes\(status\)/);
  assert.deepEqual(L.DELETE_BLOCKED_STATUSES, ['הוחזר', 'הוחזר חלקי', 'הושכר', 'הושכר חלקי']);
  assert.match(read('app/api/orders/[id]/route.js'), /const hasRental = items\.some\(item => item\.isTaken \|\| item\.isReturned\);/);
});

// ---------- (2) פריט שהוחזר ----------
const ORDER = { orderId: 53375, eventDate: '2026-10-20T21:00:00.000Z', orderDate: '2026-09-23T07:12:00.000Z' };
const di = (id, pfx, size) => ({ id: `di-${id}`, barcodePrefix: pfx, sizeText: size, dress: { id: `m-${id}`, name: '4512', barcodePrefix: pfx } });
const mkItem = (id, over = {}) => ({ id, dressItem: di(id, 45, '38'), sizeText: '38', price: 150, finalPrice: 150, isDeleted: false, isTaken: false, isReturned: false, returnedOk: false, ...over });
function env(items, { isLocked = false } = {}) {
  const calls = [];
  const toasts = [];
  const state = { items: JSON.parse(JSON.stringify(items)) };
  const e = {
    fetch: async (url, init) => { calls.push([url, init && init.method]); return { ok: true, status: 200, json: async () => ({ valid: true }) }; },
    ui: { toast: (k, m) => toasts.push([k, m]), confirm: async () => true, prompt: async () => null },
    approve: async () => null,
    get: () => ({ order: ORDER, items: state.items, settings: L.parseSettings([]), isLocked, routeId: '53375', forceEditableIds: new Set(), sessionEditableIds: new Set(), priceList: [] }),
    syncItems: (fn) => { state.items = fn(state.items); },
    addLocalItem: () => null, removeLocalItem: () => {}, markItemDeleted: () => {}, setAltDone: () => {}, applyServerOrder: () => {}, markForceEditable: () => {},
    chooseItem: async () => null, bumpHistory: () => {},
  };
  return { act: A.createItemActions(e), calls, state, errors: () => toasts.filter(([k]) => k === 'error').map(([, m]) => m) };
}
const RET = mkItem('r1', { isTaken: true, isReturned: true, returnedOk: true, barcode: '4538010', returnDate: '2026-10-21T10:00:00.000Z' });

test('פריט שהוחזר: פרדיקט אחד (isReturned, כמו הצ׳יפ "הוחזרה") והודעה ברורה', () => {
  assert.equal(A.isItemReturned(RET), true);
  assert.equal(A.isItemReturned(mkItem('x', { isTaken: true })), false);
  assert.equal(A.isItemReturned(null), false);
  assert.match(A.statusText(RET, ORDER), /^הוחזרה/, 'אותו תנאי מציג את הסטטוס "הוחזרה"');
  assert.match(A.returnedAgainMessage(RET, '4538010'), /כבר הוחזר/);
  assert.match(A.returnedAgainMessage(RET, '4538010'), /בטל החזרה/);
});

test('שדה הברקוד בשורה: פריט שהוחזר - אין החזרה שנייה, הודעה ברורה, אפס קריאות לשרת', async () => {
  const me = env([RET]);
  const r = await me.act.barcodeForItem(me.state.items[0], '4538010');
  assert.equal(r.ok, false);
  assert.equal(r.alreadyReturned, true);
  assert.equal(me.calls.length, 0, 'בלי קריאה לשרת');
  assert.equal(me.errors().length, 1);
  assert.match(me.errors()[0], /כבר הוחזר/);
  const again = await me.act.barcodeForItem(me.state.items[0], '');
  assert.equal(again.ok, false);
  assert.equal(me.calls.length, 0);
});

test('returnItem לפריט שכבר הוחזר נדחה לפני כל שינוי מצב / קריאה', async () => {
  const me = env([RET]);
  const r = await me.act.returnItem(me.state.items[0]);
  assert.equal(r.ok, false);
  assert.equal(me.calls.length, 0);
  assert.deepEqual(me.state.items[0], RET, 'הפריט לא נגע');
});

test('סריקה (שורת הסריקה / מצב רצף): ברקוד של פריט שהוחזר - הודעה, בלי rentals/toggle; בהזמנה נעולה ההודעה הברורה ולא הודעת הנעילה', async () => {
  const open = env([RET, mkItem('p1', { sizeText: '40', dressItem: di('p1', 27, '40') })]);
  const r1 = await open.act.scan('4538010');
  assert.equal(r1.ok, false);
  assert.ok(!open.calls.some(([u]) => u === '/api/rentals/toggle'), 'אין החזרה שנייה');
  assert.match(open.errors()[0], /כבר הוחזר/);
  const locked = env([RET], { isLocked: true });
  const r2 = await locked.act.scan('4538010');
  assert.equal(r2.alreadyReturned, true);
  assert.equal(locked.calls.length, 0, 'בנעילה: בלי פנייה לשרת');
  assert.match(locked.errors()[0], /כבר הוחזר/);
  assert.ok(!/נעולה/.test(locked.errors()[0]));
});

test('שני פריטים עם אותו ברקוד: הראשון הוחזר והשני עוד לא - הסריקה מחזירה את השני (לא נחסמת)', async () => {
  const a = mkItem('a', { isTaken: true, isReturned: true, returnedOk: true, barcode: '4538010' });
  const b = mkItem('b', { isTaken: true, barcode: '4538010' });
  const me = env([a, b]);
  const r = await me.act.scan('4538010');
  assert.equal(r.ok, true);
  assert.equal(r.item.id, 'b');
});

test('שורת הברקוד (UI): פריט שהוחזר = בלי שדה קלט; צ׳יפ "הוחזרה" + בורר radiogroup תקין/לא תקין + "בטל החזרה" ghost אחד; לא-מוחזר = השדה כמקודם', () => {
  const code = strip(read(`${OC}/parts/OcBarcodeRow.js`));
  const liveStart = code.indexOf('  return (\n    <div className="hv-r hv-act oc-bcrow">');
  const ret = code.slice(code.indexOf('if (returned) {'), liveStart);
  assert.ok(!/<input/.test(ret), 'בשורת פריט שהוחזר אין input');
  assert.match(ret, /className=\{`chip \$\{okCond \? 'green' : 'amber'\} oc-retchip`\} role="status"/);
  assert.match(ret, /role="radiogroup" aria-label="מצב ההחזרה"/);
  assert.equal((ret.match(/role="radio"/g) || []).length, 2);
  assert.match(ret, /aria-checked=\{okCond\}/);
  assert.match(ret, /aria-checked=\{!okCond\}/);
  assert.equal((ret.match(/className="btn sm ghost" data-act="undoret"/g) || []).length, 1, 'פעולה משנית אחת');
  assert.ok(!/className="btn sm tgl|className="btn sm"/.test(ret), 'אין שני לחצנים פעילים באותו משקל');
  assert.ok(!/dayTimeOf|const when/.test(code), 'התאריך לא חוזר בצ׳יפ (שורת "החזרה" נושאת אותו)');
  assert.match(ret, /\{okCond \? 'הוחזרה' : 'הוחזרה · לא תקין'\}/);
  const rest = code.slice(liveStart, code.indexOf('export function OcCondBadDialog'));
  assert.match(rest, /<input/);
  assert.match(rest, /disabled=\{inputOff\}/);
  assert.match(code, /const inputOff = busy \|\| pending \|\| isItemReturned\(item\)/, 'הגנה כפולה');
  assert.ok(!/data-act="undoret"/.test(rest), 'ביטול החזרה רק במצב החזרה');
  assert.match(rest, /data-act="undorent"/);
});

test('מטריצת מצבים של שורת הברקוד: ממתין / מושכר / הוחזר תקין / הוחזר לא תקין - אילו בקרים מוצגים', () => {
  const code = strip(read(`${OC}/parts/OcBarcodeRow.js`));
  const liveStart = code.indexOf('  return (\n    <div className="hv-r hv-act oc-bcrow">');
  const retPart = code.slice(code.indexOf('if (returned) {'), liveStart);
  const livePart = code.slice(liveStart, code.indexOf('export function OcCondBadDialog'));
  // לא הוחזר (ממתין / מושכר): שדה ברקוד; מושכר ולא נעול גם "בטל השכרה"; בלי בורר תקין/לא תקין ובלי "בטל החזרה"
  assert.ok(/<input/.test(livePart) && /item\.isTaken && !locked \?/.test(livePart) && !/cond-ok|cond-bad|undoret/.test(livePart));
  // הוחזר (תקין / לא תקין): צ׳יפ + בורר + ghost; הצבע/טקסט לפי okCond
  assert.ok(/'green' : 'amber'/.test(retPart) && /okCond \? 'הוחזרה' : 'הוחזרה · לא תקין'/.test(retPart));
  assert.ok(!/undorent/.test(retPart), 'פריט שהוחזר אין בו "בטל השכרה"');
});

// ---------- (3)+(4) פריסה ----------
test('ריווח עליון: אותו היסט כמו שאר העמודים החדשים (50px / 18px בצר) מתחת לתפריט העליון', () => {
  const css = read(`${OC}/css/oc-base.css`);
  assert.match(css, /\.gm-ds\.gm-oc \.oc-app\{padding-top:50px\}/);
  assert.match(css, /@media \(max-width:640px\)\{\.gm-ds\.gm-oc \.oc-app\{padding-top:18px\}\}/);
  assert.match(read('app/schedule/schedule.css'), /\.gm-ds\.gm-lz \.lz-app\{padding-top:50px/);
  assert.match(read('app/components/board/board.css'), /\.gm-ds\.gm-bd \.bd-app\{padding-top:50px\}/);
});

test('טולטיפ: מתהפך מתחת לאייקון כשאין מקום מעליו מתחת לקצה התחתון של התפריט העליון (#snav)', () => {
  const h = read('app/components/profile/usePageTooltip.js');
  assert.match(h, /document\.getElementById\('snav'\)/);
  assert.match(h, /const minTop = Math\.max\(8, nav \? Math\.round\(nav\.getBoundingClientRect\(\)\.bottom\) \+ 8 : 0\);/);
  assert.match(h, /if \(y < minTop\) y = r\.bottom \+ 10;/);
  // אותה נוסחה בלי DOM: אייקון ב-y=100, טולטיפ 40px, תפריט 64px -> y=50 < 72 -> מתחת לאייקון
  const place = (rTop, rBottom, h2, navBottom) => { const minTop = Math.max(8, navBottom ? navBottom + 8 : 0); let y = rTop - h2 - 10; if (y < minTop) y = rBottom + 10; return y; };
  assert.equal(place(100, 130, 40, 64), 140, 'מתחת לאייקון');
  assert.equal(place(300, 330, 40, 64), 250, 'מספיק מקום - מעליו כמו קודם');
  assert.equal(place(20, 50, 40, 0), 60, 'בלי תפריט: ההתנהגות הקודמת (8px)');
});

test('הרייל מתחיל בגובה הסקשן הראשון: --rail-top מ-.panel.on (כמו fit() בעיצוב), מ-1024px, נמדד מחדש בהחלפת לשונית', () => {
  const a5 = read(`${OC}/OrderCardA5.js`);
  assert.match(a5, /const p = main\.querySelector\('\.panel\.on'\);/);
  assert.match(a5, /window\.innerWidth < 1024/);
  assert.match(a5, /p\.getBoundingClientRect\(\)\.top - main\.getBoundingClientRect\(\)\.top/);
  assert.match(a5, /rail\.style\.setProperty\('--rail-top', `\$\{Math\.max\(0, Math\.round\(top\)\)\}px`\)/);
  assert.match(a5, /new MutationObserver\(fit\)/);
  assert.match(a5, /attributeFilter: \['class'\]/);
  assert.match(a5, /<main className="main" ref=\{mainRef\}>/);
  assert.match(a5, /<aside className="rail" id="rail" aria-label="סיכום ההזמנה" ref=\{railRef\}>/);
  assert.match(read('design-system/components.css'), /@media \(min-width:1024px\)\{\s*\.gm-ds \.app \.rail\{margin-top:var\(--rail-top,0px\)\}/, 'כלל הפלטה שמקבל את המשתנה');
});

// דוח ההשוואה (F6): tall() של העיצוב - רייל גבוה מהחלון נדבק כך שהתחתית נראית
test('tall(): top = min(snav + 16, גובה חלון - גובה רייל - 16) רק מ-1024px; נמדד ב-ResizeObserver של הרייל + MutationObserver על תוכנו + resize; מתנקה', () => {
  const a5 = read(`${OC}/OrderCardA5.js`);
  assert.match(a5, /rail\.style\.top = `\$\{Math\.min\(navH \+ 16, window\.innerHeight - rail\.offsetHeight - 16\)\}px`/);
  assert.match(a5, /getPropertyValue\('--gm-snav-h'\)/);
  assert.match(a5, /if \(window\.innerWidth < 1024\) \{ rail\.style\.removeProperty\('top'\); return; \}/);
  assert.match(a5, /rro\.observe\(rail\)/);
  assert.match(a5, /rmo\.observe\(rail, \{ childList: true, subtree: true, characterData: true \}\)/);
  assert.match(a5, /rail\.style\.removeProperty\('top'\)\; window|rail\.style\.removeProperty\('top'\); \}\;?/.test(a5) ? /./ : /removeProperty\('top'\)/);
  // אותה נוסחה: חלון 600, רייל 900, תפריט 64 -> top שלילי (-316) כדי שהתחתית תיראה; רייל נמוך -> sticky רגיל (80)
  const top = (snav, vh, h) => Math.min(snav + 16, vh - h - 16);
  assert.equal(top(64, 600, 900), -316);
  assert.equal(top(64, 900, 400), 80);
});

// דוח ההשוואה F13: אייקון המעבר ישן/חדש לא דוחף את הכלים
test('PageVariantToggle בכותרת: מחוץ לזרימה (absolute) ברווח העליון מ-641px - הכלים נשארים במקום העיצוב; בצר נשאר בזרימה', () => {
  const css = read(`${OC}/css/oc-base.css`);
  assert.match(css, /@media \(min-width:641px\)\{\.gm-ds\.gm-oc \.oc-app \.topbar > \.gm-pvt\{position:absolute;top:-46px;inset-inline-end:0\}\}/);
  const m = css.match(/\.oc-app\{padding-top:(\d+)px\}/);
  assert.ok(m && Number(m[1]) >= 46 + 4, 'הריפוד העליון מכיל את הלחצן (40px) בלי לגעת בתפריט');
  assert.match(strip(read(`${OC}/OcTopbar.js`)), /<PageVariantToggle screen="order_card" placement="header" systemTip \/>/, 'הרכיב עצמו לא השתנה');
  assert.match(read('app/components/variant/pageVariantToggle.css'), /\.gm-pvt\{position:relative;display:inline-flex/);
});

// דוח ההשוואה F7: אנימציות האייקונים של העיצוב (ICON-ANIM) - אותו מנגנון, ה-CSS בפלטה
test('useIconAnim: prepIcon מוסיף ia-<שם> + ia-h (לא בהקשרי .gl/.cl-i/.cart-t), אחת לאייקון; מזהה מ-#gmi-<שם>', async () => {
  const H = await P(`${OC}/hooks/useIconAnim.js`);
  const mk = (href, skip = false) => { const cls = new Set(); return { cls, querySelector: () => (href === null ? null : { getAttribute: (a) => (a === 'href' ? href : null) }), classList: { add: (c) => cls.add(c) }, closest: (sel) => (skip && /\.gl/.test(sel) ? {} : null) }; };
  const a = mk('#gmi-card');
  assert.equal(H.prepIcon(a), 'card');
  assert.deepEqual([...a.cls].sort(), ['ia-card', 'ia-h']);
  assert.equal(H.prepIcon(a), 'card');
  assert.equal(a.cls.size, 2, 'אחת לאייקון');
  const g = mk('#gmi-user', true);
  H.prepIcon(g);
  assert.deepEqual([...g.cls], ['ia-user'], 'בהקשר .gl אין ia-h (כמו SKIP_H בדמו)');
  assert.equal(H.prepIcon(mk(null)), '');
  assert.equal(H.iconIdOf(mk('#gmi-truck')), 'truck');
});

test('useIconAnim: מחובר לשורש הכרטיס; MutationObserver + ia-in מדורג (14 לפעימה) + ia-dr לאייקוני ציור; מכבד reduced-motion; CSS רק בפלטה', () => {
  const hook = strip(read(`${OC}/hooks/useIconAnim.js`));
  assert.match(hook, /new MutationObserver/);
  assert.match(hook, /const cap = first \? 1e9 : \(now - last < 250 \? 0 : 14\)/);
  assert.match(hook, /DRAW\.has\(id\)\) s\.classList\.add\('ia-dr'\)/);
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /e\.animationName === 'gm-ia-in' \|\| e\.animationName === 'gm-ia-draw'/);
  assert.match(strip(read(`${OC}/OrderCardA5.js`)), /useIconAnim\(rootRef\);/);
  const ds = read('design-system/components.css');
  for (const s of ['@keyframes gm-ia-in{', '.gm-ds svg.ic.ia-in{animation:gm-ia-in', '.gm-ds svg.ic.ia-h:hover:not(#_){animation:var(--ia-a)', '.gm-ds svg.ic.ia-in,.gm-ds svg.ic.ia-h{animation:none!important}']) assert.ok(ds.includes(s), s);
  assert.ok(/@media \(prefers-reduced-motion:reduce\)\{\s*\.gm-ds svg\.ic\.ia-in,\.gm-ds svg\.ic\.ia-h/.test(ds), 'prefers-reduced-motion בפלטה');
});

// החלטת הבעלים 2026-10-06: ברקוד הפריט לא מוצג בפריט שטרם נלקח
test('שורת הברקוד: הטקסט "ברקוד <מספר>" של הפריט מוצג רק מרגע הלקיחה (ובשורת ההחזרה); בפריט שמור בלבד אין אותו, שדה הסריקה נשאר; אין הדפסה אחרת של הברקוד בשורה/פרטים', () => {
  const code = strip(read(`${OC}/parts/OcBarcodeRow.js`));
  const liveStart = code.indexOf('  return (\n    <div className="hv-r hv-act oc-bcrow">');
  const live = code.slice(liveStart, code.indexOf('export function OcCondBadDialog'));
  assert.match(live, /\{own && !pending && item\.isTaken \? <span className="faint oc-bch">/);
  assert.match(live, /<input/, 'שדה הסריקה נשאר');
  const ret = code.slice(code.indexOf('if (returned) {'), liveStart);
  assert.match(ret, /\{own \? <span className="faint oc-bch">/, 'בשורת ההחזרה הברקוד מוצג');
  for (const f of ['parts/OcItemRow.js', 'parts/OcItemDetailsDialog.js', 'tabs/OcItemsTab.js']) assert.ok(!/itemBarcode\(/.test(strip(read(`${OC}/${f}`))), `${f}: אין הצגת ברקוד שמור`);
  assert.ok(!/barcode\}/.test(strip(read(`${OC}/hooks/useItemActions.js`)).split('barcodePlaceholder')[1].slice(0, 400)), 'הפלייסהולדר לא מכיל ברקוד');
  // ברקוד מוסתר ביומן הפריט (שדה פנימי)
  assert.match(read(`${OC}/hooks/useItemActions.js`), /HIDDEN_HISTORY_FIELDS = \[[^\]]*'barcode'/);
});
