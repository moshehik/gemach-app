// בדיקת יחידה לבוני המסמכים של דפי ההדפסה / ה-PDF (app/components/a5-print/pkSpecs.js + pkRegistry.js): כללי הבעלים "אין נתון כפול ואין נתון לא רלוונטי",
// סדר קבוצות, עמודות מותנות, שורת סיכום אחת, מצבי ריק, מדבקות 18 לגיליון, ורישום המשטחים מול רשימת ההרשאות בשרת.
// הרצה: node scripts/test_a5_print_specs.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  customersListDoc, deptOrder, employeesListDoc, money, ordersListDoc, itemAtoms, modelCardDoc, modelItemsDoc, modelLabelsDoc, modelRentalsDoc, modelsListDoc, rentWindow, LABELS_PER_SHEET,
} from '../app/components/a5-print/pkSpecs.js';
import { PRINT_DOCS } from '../app/components/a5-print/pkRegistry.js';
import { PDF_HTML_SURFACE_KEYS } from '../lib/printAccessKeys.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const ctx = { hDate: (k) => `H(${String(k).slice(0, 10)})`, hm: () => '09:30', todayKey: '2026-10-09' };
const text = (atoms) => atoms.map((a) => a.html.replace(/<[^>]+>/g, ' ')).join(' ');
const kinds = (atoms) => atoms.map((a) => a.kind);

const emp = (i, o = {}) => ({ id: `e${i}`, code: String(100 + i), full: `עובד ${i}`, dept: 'מכירות', roleId: 4, phone: `050-${i}`, email: `e${i}@x.com`, active: true, last: '2026-10-08T07:00:00Z', ...o });

console.log('רשימת עובדים');
t('מחלקה = שורת קבוצה, לא עמודה; הספירה פעם אחת (בכותרת); אין עמודת סטטוס כשכולם פעילים', () => {
  const d = employeesListDoc({ rows: [emp(1), emp(2, { dept: 'הנהלה', roleId: 0 })], state: { sel: {}, q: '', sort: { k: 'name' } }, filters: [] }, ctx);
  assert.equal(d.kind, 'flow');
  assert.deepEqual(kinds(d.atoms), ['group', 'row', 'group', 'row']);
  assert.ok(!d.atoms[1].thead.includes('מחלקה'));
  assert.ok(!d.atoms[1].thead.includes('סטטוס'));
  assert.equal(d.head.sum, '2 עובדים');
  assert.equal(d.head.sub, ''); // אין סינון / חיפוש פעיל -> אין שורת סינון
  assert.ok(!/עובדים/.test(text(d.atoms)), 'הספירה לא חוזרת בגוף');
});
t('הנהלה (roleId 0) לפני מכירות כשהמיון לא לפי מחלקה; במיון לפי מחלקה - לפי סדר הרשימה', () => {
  const rows = [emp(1), emp(2, { dept: 'הנהלה', roleId: 0 }), emp(3, { dept: 'א-מחסן', roleId: 6 })];
  assert.deepEqual(deptOrder(rows, 'name'), ['הנהלה', 'מכירות', 'א-מחסן']);
  assert.deepEqual(deptOrder(rows, 'dept'), ['מכירות', 'הנהלה', 'א-מחסן']);
});
t('עמודת סטטוס רק כשהרשימה מערבבת פעילים ולא פעילים', () => {
  const d = employeesListDoc({ rows: [emp(1), emp(2, { active: false })], state: { sel: {}, sort: { k: 'name' } }, filters: [] }, ctx);
  assert.ok(d.atoms[1].thead.includes('סטטוס'));
  assert.match(text(d.atoms), /לא פעיל/);
});
t('שורת סינון: רק כשיש סינון / חיפוש, עם תווית "מחלקה"', () => {
  const filters = [{ key: 'dept', label: 'מחלקה', options: [{ k: 'd:מכירות', l: 'מכירות' }] }, { key: 'status', label: 'סטטוס', options: [{ k: 'active', l: 'פעילים' }] }];
  const d = employeesListDoc({ rows: [emp(1)], state: { sel: { dept: ['d:מכירות'], status: ['active'] }, q: 'שרה', sort: { k: 'name' } }, filters }, ctx);
  assert.equal(d.head.sub, 'מחלקה: מכירות · פעילים · חיפוש: ״שרה״');
});
t('לא מודפס: מחובר / סיסמה / מזהה פנימי; כניסה אחרונה בעברית + שעה', () => {
  const d = employeesListDoc({ rows: [emp(1, { conn: true, pwd: true })], state: { sel: {}, sort: { k: 'name' } }, filters: [] }, ctx);
  const tx = text(d.atoms);
  assert.ok(!/מחובר|סיסמה|e1\b/.test(tx.replace(/e1@x\.com/, '')));
  assert.match(tx, /H\(2026-10-08\)/);
  assert.match(tx, /09:30/);
});
t('רשימה ריקה -> empty עם הודעה', () => {
  assert.ok(employeesListDoc({ rows: [] }, ctx).empty.title);
});
t('שורה בלי כניסה אחרונה / בלי טלפון: מקף, לא ריק ולא undefined', () => {
  const d = employeesListDoc({ rows: [emp(1, { last: null, phone: '' })], state: { sel: {}, sort: { k: 'name' } }, filters: [] }, ctx);
  assert.ok(!/undefined|null/.test(d.atoms[1].html));
  assert.ok((d.atoms[1].html.match(/—/g) || []).length >= 2);
});
t('החלפת שמות / HTML מוברחים (escape)', () => {
  const d = employeesListDoc({ rows: [emp(1, { full: '<b>x</b>' })], state: { sel: {}, sort: { k: 'name' } }, filters: [] }, ctx);
  assert.ok(!d.atoms[1].html.includes('<b>x</b>'));
});

console.log('קטלוג דגמים');
const mdl = (i, o = {}) => ({ id: `m${i}`, code: 1000 + i, name: `דגם ${i}`, entry: '2025-01-05', items: 3, inactive: 0, reserve: 1, repair: 0, rentals: 12, deleted: false, ...o });
const st = (m) => (m.deleted ? 'מחוק' : 'פעיל');
t('אפס = מקף, שורת סיכום אחת בסוף עם סכומים בלבד (בלי ספירה), בלי עמודת סטטוס כשכולם פעילים', () => {
  const rows = [mdl(1), mdl(2, { items: 0, rentals: 0 })];
  const d = modelsListDoc({ rows, state: { sel: {} }, filters: [], statusText: st }, ctx);
  assert.equal(d.atoms.filter((a) => a.kind === 'tot').length, 1);
  assert.equal(d.atoms[d.atoms.length - 1].kind, 'tot');
  assert.ok(!d.atoms[0].thead.includes('סטטוס'));
  assert.match(d.atoms[1].html, /—/);
  assert.equal(d.head.sum, '2 דגמים');
  const tot = d.atoms[d.atoms.length - 1].html;
  assert.ok(tot.includes('>3<') && tot.includes('>12<'));
  assert.ok(!/דגמים/.test(tot));
});
t('עמודת סטטוס כשמעורב', () => {
  const d = modelsListDoc({ rows: [mdl(1), mdl(2, { deleted: true })], state: { sel: {} }, filters: [], statusText: st }, ctx);
  assert.ok(d.atoms[0].thead.includes('סטטוס'));
});
t('242 דגמים: כל השורות + סיכום (לא רק עמוד 50)', () => {
  const d = modelsListDoc({ rows: Array.from({ length: 242 }, (_, i) => mdl(i)), state: { sel: {} }, filters: [], statusText: st }, ctx);
  assert.equal(d.atoms.filter((a) => a.kind === 'row').length, 242);
  assert.equal(d.head.sum, '242 דגמים');
});

console.log('כרטיס דגם');
const it = (size, serial, o = {}) => ({ id: `${size}-${serial}`, size, serial, bc: '', loc: 'חנות', carton: '', repair: false, unused: false, why: '', del: false, ...o });
const model = { id: 'D1', name: 'שרלוט', code: '4321', cat: 'A', notes: '', active: true, reason: '', exit: '', entry: '2024-03-01' };
const items = [it('38', 1), it('36', 2), it('36', 1), it('36', 3, { del: true })];
const rent = (order, event, o = {}) => ({ order, cust: `לקוחה ${order}`, event, taken: event, ret: 'ok', retDate: event, note: '', ...o });
t('כרטיס: קוד וברקוד רק בכותרת; מידות כקבוצות; פריטים מחוקים לא מודפסים; בלי עמודת סטטוס כשהכול תקין', () => {
  const d = modelCardDoc({ model, items, rentals: [], prefix: '4321' }, ctx);
  assert.equal(d.head.barcode, '4321');
  assert.equal(d.head.title, 'שרלוט');
  const groups = d.atoms.filter((a) => a.kind === 'group').map((a) => a.html.replace(/<[^>]+>/g, ''));
  assert.deepEqual(groups, ['מידה 36', 'מידה 38']);
  const rows = d.atoms.filter((a) => a.kind === 'row');
  assert.equal(rows.length, 3);
  assert.ok(!rows[0].thead.includes('סטטוס'));
  // 4321 מופיע כברקוד-טקסט של הפריטים אבל לא כשורת "קוד" נפרדת
  assert.ok(!/קוד דגם/.test(text(d.atoms)));
});
t('כרטיס: צ׳יפים - "זמינים" רק אם שונה מהסה״כ; אפסים לא מוצגים', () => {
  const same = modelCardDoc({ model, items: [it('36', 1), it('36', 2)], rentals: [], prefix: '1' }, ctx);
  const st1 = same.atoms.find((a) => /pk-stats/.test(a.html)).html;
  assert.ok(!/זמינים|בתיקון|לא בשימוש|ברזרבה/.test(st1));
  const diff = modelCardDoc({ model, items: [it('36', 1), it('36', 2, { repair: true }), it('36', 3, { unused: true, why: 'כתם' })], rentals: [], prefix: '1' }, ctx);
  const st2 = diff.atoms.find((a) => /pk-stats/.test(a.html)).html;
  assert.match(st2, /זמינים/); assert.match(st2, /בתיקון/); assert.match(st2, /לא בשימוש/);
  assert.ok(diff.atoms.find((a) => a.kind === 'row').thead.includes('סטטוס'));
  assert.match(text(diff.atoms), /כתם/);
});
t('כרטיס: השכרות רק מ-12 החודשים האחרונים, החדשות ראשונות; בלי השכרות אין מקטע', () => {
  const rentals = [rent(1, '2024-01-01'), rent(2, '2026-09-01'), rent(3, '2026-03-01'), rent(4, '2025-10-09'), rent(5, '2025-10-08')];
  assert.deepEqual(rentWindow(rentals, '2026-10-09').map((r) => r.order), [2, 3, 4]);
  const d = modelCardDoc({ model, items, rentals, prefix: '4321' }, ctx);
  assert.ok(d.atoms.some((a) => a.kind === 'block' && /השכרות ב-12/.test(a.html)));
  const none = modelCardDoc({ model, items, rentals: [rent(9, '2020-01-01')], prefix: '4321' }, ctx);
  assert.ok(!none.atoms.some((a) => /השכרות ב-12/.test(a.html)));
});
t('כרטיס: דגם לא פעיל מציג סיבה ויציאה; פעיל - לא; בלי הערות אין בלוק הערות; בלי פריטים הודעה', () => {
  const inactive = modelCardDoc({ model: { ...model, active: false, reason: 'ישן', exit: '2026-01-01' }, items: [], rentals: [], prefix: '1' }, ctx);
  const tx = text(inactive.atoms);
  assert.match(tx, /ישן/); assert.match(tx, /אין פריטים בדגם/);
  const act = modelCardDoc({ model, items, rentals: [], prefix: '1' }, ctx);
  assert.ok(!/סיבת אי-פעילות/.test(text(act.atoms)));
  assert.ok(!act.atoms.some((a) => /pk-note/.test(a.html)));
  assert.ok(modelCardDoc({ model: { ...model, notes: 'שימי לב' }, items, rentals: [], prefix: '1' }, ctx).atoms.some((a) => /pk-note/.test(a.html)));
});
t('כרטיס: לא מודפסים יומן שינויים / תמונה / מצב עריכה', () => {
  const tx = text(modelCardDoc({ model: { ...model, img: 'x.jpg' }, items, rentals: [], prefix: '1' }, ctx).atoms);
  assert.ok(!/שינויים|תמונה|ממתין לשמירה|x\.jpg/.test(tx));
});
t('רשימת פריטים: ברקוד גרפי; מהלשונית - בסדר המסך ורק פריטים שמורים (חדשים שלא נשמרו נשמטים)', () => {
  const list = [items[1], { id: 'tmp-1', size: '36', serial: 9, loc: 'חנות' }, items[0]];
  const d = modelItemsDoc({ model, items, prefix: '4321', list, state: { sel: { loc: ['חנות'] }, q: '' }, filters: [{ key: 'loc', options: [{ k: 'חנות', l: 'חנות' }] }] });
  const rows = d.atoms.filter((a) => a.kind === 'row');
  assert.equal(rows.length, 2);
  assert.ok(/<svg/.test(rows[0].html));
  assert.equal(d.head.sub, 'מיקום: חנות');
  assert.equal(d.head.sum, '2 פריטים');
  const menu = modelItemsDoc({ model, items, prefix: '4321' });
  assert.equal(menu.head.sub, '');
  assert.equal(menu.atoms.filter((a) => a.kind === 'row').length, 3);
});
t('רשימת פריטים ריקה / השכרות ריקות -> empty', () => {
  assert.ok(modelItemsDoc({ model, items: [], prefix: '1' }).empty);
  assert.ok(modelRentalsDoc({ model, rentals: [] }, ctx).empty);
});
t('רשימת השכרות: מהתפריט "12 החודשים האחרונים"; החזרה עם בעיה מציגה הערה קטנה; "טרם הוחזר"', () => {
  const rentals = [rent(1, '2026-09-01', { ret: 'bad', note: 'כתם' }), rent(2, '2026-08-01', { ret: 'out' })];
  const d = modelRentalsDoc({ model, rentals }, ctx);
  assert.equal(d.head.sub, 'ב-12 החודשים האחרונים');
  const tx = d.atoms.map((a) => a.html).join(' ');
  assert.match(tx, /הוחזר עם בעיה: כתם/);
  assert.match(tx, /טרם הוחזר/);
  assert.match(tx, /#1/);
});
t('מדבקות: 18 לגיליון, כותרת צרה, גיליון לכל 18', () => {
  const many = Array.from({ length: 40 }, (_, i) => it('36', i + 1));
  const d = modelLabelsDoc({ model, items: many, prefix: '4321' });
  assert.equal(d.kind, 'pages');
  assert.equal(d.pages.length, Math.ceil(40 / LABELS_PER_SHEET));
  assert.equal(LABELS_PER_SHEET, 18);
  assert.ok(d.pages.every((p) => p.slim));
  assert.equal((d.pages[0].body.match(/class="pk-lab"/g) || []).length, 18);
  assert.equal((d.pages[2].body.match(/class="pk-lab"/g) || []).length, 4);
  assert.ok(modelLabelsDoc({ model, items: [], prefix: '1' }).empty);
});
t('itemAtoms: הקבוצות לפי סדר הופעה, כותרת "(המשך)" נשמרת בשורה', () => {
  const a = itemAtoms([it('36', 1), it('36', 2), it('38', 1)], false, '1');
  assert.deepEqual(kinds(a), ['group', 'row', 'row', 'group', 'row']);
  assert.match(a[1].grpCont, /מידה 36 \(המשך\)/);
});

console.log('דוח הזמנות / רשימת לקוחות (print-specs.md)');
const oRow = (orderId, customer, day, items, total, balance = '') => ({ orderId, customer, day, items, total, balance });
const ordersSheet = (withDebt) => ({
  title: 'דוח הזמנות', subtitle: 'סטטוס הזמנה: הושכר', hasDebt: withDebt,
  groups: [
    { title: 'תשרי תשפ״ז', rows: [oRow(11, 'כהן', 'ט׳ תשרי', 3, 1200, withDebt ? 300 : ''), oRow(12, 'לוי', 'י׳ תשרי', '', 800)], total: 2000, paid: 1700, debt: 300 },
    { title: 'ללא תאריך אירוע', rows: [oRow(13, 'פרץ', '', 1, 500)], total: 500, paid: 500, debt: 0 },
  ],
  totals: { count: 3, total: 2500, paid: 2200, debt: withDebt ? 300 : 0, credit: 0 },
});
t('הזמנות: קבוצות לפי חודש, שורת סיכום אחת בסוף, הספירה בכותרת בלבד, עמודת חוב רק כשיש חוב', () => {
  const d = ordersListDoc({ sheet: ordersSheet(true) }, ctx);
  assert.deepEqual(kinds(d.atoms), ['group', 'row', 'row', 'group', 'row', 'tot']);
  assert.equal(d.head.sum, '3 הזמנות');
  assert.equal(d.head.sub, 'סטטוס הזמנה: הושכר');
  assert.ok(d.atoms[0].thead.includes('חוב'));
  assert.equal(d.atoms.filter((a) => a.kind === 'tot').length, 1);
  assert.ok(d.atoms[5].html.includes(money(2500)) && d.atoms[5].html.includes(money(300)));
  assert.ok(!/הזמנות/.test(d.atoms[5].html), 'הספירה לא חוזרת בשורת הסיכום');
  const noDebt = ordersListDoc({ sheet: ordersSheet(false) }, ctx);
  assert.ok(!noDebt.atoms[0].thead.includes('חוב'));
});
t('הזמנות: אין סטטוס / משלוח / תשלום בעמודות; יום בלי חודש (החודש הוא כותרת הקבוצה)', () => {
  const d = ordersListDoc({ sheet: ordersSheet(true) }, ctx);
  assert.ok(!/סטטוס|משלוח|שולם/.test(d.atoms[0].thead));
  assert.match(d.atoms[1].html, /ט׳ תשרי/);
  assert.ok(!/תשפ״ז/.test(d.atoms[1].html));
  assert.match(d.atoms[4].html, /—/); // ללא תאריך אירוע
  assert.ok(ordersListDoc({ sheet: { groups: [], totals: { count: 0 } } }, ctx).empty);
});
const cSheet = (o = {}) => ({
  title: 'רשימת לקוחות', subtitle: '', hasOrders: o.orders !== false, hasDebt: !!o.debt,
  rows: [{ number: 5, name: 'כהן שרה', phone: '050', email: 'a@b.c', city: 'ירושלים', ...(o.orders !== false ? { orders: 2 } : {}), ...(o.debt ? { debt: 150 } : {}) }, { number: '', name: 'לוי', phone: '', email: '', city: '', ...(o.orders !== false ? { orders: '' } : {}), ...(o.debt ? { debt: '' } : {}) }],
  totals: { count: 2, debt: o.debt ? 150 : 0 },
});
t('לקוחות: בלי קבוצות; "הזמנות" / "חוב" רק כשיש; סיכום חוב פעם אחת רק כשיש חוב; הספירה בכותרת', () => {
  const plain = customersListDoc({ sheet: cSheet({ orders: false }) }, ctx);
  assert.deepEqual(kinds(plain.atoms), ['row', 'row']);
  assert.ok(!plain.atoms[0].thead.includes('הזמנות') && !plain.atoms[0].thead.includes('חוב'));
  assert.equal(plain.head.sum, '2 לקוחות');
  const full = customersListDoc({ sheet: cSheet({ debt: true }) }, ctx);
  assert.deepEqual(kinds(full.atoms), ['row', 'row', 'tot']);
  assert.ok(full.atoms[0].thead.includes('הזמנות') && full.atoms[0].thead.includes('חוב'));
  assert.ok(full.atoms[2].html.includes(money(150)));
  assert.ok(customersListDoc({ sheet: { rows: [], totals: {} } }, ctx).empty);
});
t('לקוחות: אין כתובת / ת״ז / בנק / הערות בעמודות; תא ריק = מקף', () => {
  const d = customersListDoc({ sheet: cSheet({ debt: true }) }, ctx);
  assert.ok(!/כתובת|זהות|בנק|הערות/.test(d.atoms[0].thead));
  assert.match(d.atoms[1].html, /—/);
});

console.log('רישום והרשאות');
t('כל מסמך רשום עם build ו-surface שמופיע ברשימת ההרשאות של השרת', () => {
  Object.entries(PRINT_DOCS).forEach(([id, d]) => {
    assert.equal(typeof d.build, 'function', id);
    assert.ok(Object.prototype.hasOwnProperty.call(PDF_HTML_SURFACE_KEYS, d.surface), `${id}: ${d.surface}`);
    assert.ok(PDF_HTML_SURFACE_KEYS[d.surface].every((k) => k.startsWith('page:')));
  });
});
t('רשימת העובדים מוגבלת להרשאת page:employees (הנהלה בלבד) ולא לדגמים', () => {
  assert.deepEqual(PDF_HTML_SURFACE_KEYS['a5-employees-list'], ['page:employees']);
  assert.ok(!PDF_HTML_SURFACE_KEYS['a5-models-list'].includes('page:employees'));
});
t('השרת: route.js קורא ל-pdfHtmlSurfaceKeys ודוחה surface לא מוכר; printAccess מייצא אותו', () => {
  const route = fs.readFileSync(new URL('../app/api/pdf/route.js', import.meta.url), 'utf8');
  const access = fs.readFileSync(new URL('../lib/printAccess.js', import.meta.url), 'utf8');
  assert.match(route, /pdfHtmlSurfaceKeys\(surface\)/);
  assert.match(route, /surface לא נתמך/);
  assert.match(access, /export function pdfHtmlSurfaceKeys/);
  assert.match(access, /hasOwnProperty\.call\(PDF_HTML_SURFACE_KEYS/);
});

console.log(`\n${passed} passed`);
