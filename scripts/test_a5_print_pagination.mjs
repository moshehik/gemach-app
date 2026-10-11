// בדיקת יחידה למנוע העימוד של דפי ההדפסה (app/components/a5-print/pkCore.js paginate): ה-adapter כאן מדמה גובה בפיקסלים לכל אטום (בלי DOM).
// בודק: כל שורה מופיעה בדיוק פעם אחת ובסדר; כותרת הטבלה חוזרת בכל גיליון; קבוצה שממשיכה מקבלת "(המשך)"; כותרת קבוצה לא נשארת אחרונה בגיליון;
// שורת סיכום לא נשארת לבד; אטום גדול מהגיליון מתקבל בלי לולאה אינסופית; מספר העמודים "מתוך N".
// הרצה: node scripts/test_a5_print_pagination.mjs
import assert from 'node:assert/strict';
import {
  bc, block, filterLine, fixN, heading, paginate, plural, shell, table,
} from '../app/components/a5-print/pkCore.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// adapter מדומה: לכל אטום גובה (a.h או לפי kind); לטבלה חדשה בגיליון יש עלות כותרת
const HEAD_H = 20;
const ROW_H = 10;
const hOf = (a) => (a.kind === 'row' || a.kind === 'group' || a.kind === 'tot' ? ROW_H : 30);
function fakeAdapter(capacity) {
  let page = null;
  const pages = [];
  const used = () => page.items.reduce((s, it) => s + it.h, 0) + page.tables.length * HEAD_H;
  return {
    pages,
    newPage(n) { page = { n, items: [], tables: [] }; },
    put(a, prev) {
      let tbl = prev ? prev.tbl : null;
      if (a.table && !tbl) { tbl = { id: a.table }; page.tables.push(tbl); }
      const it = { a, h: a.h != null ? a.h : hOf(a), tbl };
      page.items.push(it);
      return { it, tbl };
    },
    remove(handle) {
      page.items.splice(page.items.indexOf(handle.it), 1);
      if (handle.tbl && !page.items.some((i) => i.tbl === handle.tbl)) page.tables.splice(page.tables.indexOf(handle.tbl), 1);
    },
    fits() { return used() <= capacity; },
    finalize() { const snap = { n: page.n, items: page.items.map((i) => i.a), tables: page.tables.length }; pages.push(snap); return snap; },
  };
}
const run = (atoms, capacity) => { const ad = fakeAdapter(capacity); const out = paginate(atoms, ad); return { out, pages: ad.pages }; };

const T = table('t', [{ t: 'א', w: '10mm' }, { t: 'ב', w: '10mm' }]);
const rowHtml = (a) => a.html.replace(/<[^>]+>/g, '|');
const CAP = 100 + HEAD_H; // 10 שורות לגיליון

console.log('עימוד');
t('שורות בלי קבוצות: כולן, פעם אחת, בסדר, ובכל גיליון כותרת טבלה אחת', () => {
  const atoms = Array.from({ length: 23 }, (_, i) => T.row([`r${i}`, 'x']));
  const { pages } = run(atoms, CAP);
  assert.equal(pages.length, 3);
  assert.deepEqual(pages.map((p) => p.items.length), [10, 10, 3]);
  assert.ok(pages.every((p) => p.tables === 1));
  assert.deepEqual(pages.flatMap((p) => p.items.map(rowHtml)), atoms.map(rowHtml));
});

t('קבוצה שממשיכה בגיליון חדש מקבלת שוב כותרת עם "(המשך)"', () => {
  const atoms = [T.group('מידה 36')];
  for (let i = 0; i < 14; i++) atoms.push(T.row([`s${i}`, 'x'], 'מידה 36'));
  const { pages } = run(atoms, CAP);
  assert.equal(pages.length, 2);
  assert.match(pages[1].items[0].html, /מידה 36 \(המשך\)/);
  assert.equal(pages[1].items[0].kind, 'group');
  assert.doesNotMatch(pages[0].items[0].html, /המשך/);
  assert.equal(pages.flatMap((p) => p.items).filter((a) => a.kind === 'row').length, 14);
});

t('כותרת קבוצה לא נשארת אחרונה בגיליון - עוברת עם השורה הראשונה שלה', () => {
  const atoms = [];
  for (let i = 0; i < 9; i++) atoms.push(T.row([`a${i}`, 'x']));
  atoms.push(T.group('קבוצה ב'));
  atoms.push(T.row(['b0', 'x'], 'קבוצה ב'));
  const { pages } = run(atoms, CAP);
  assert.equal(pages.length, 2);
  assert.notEqual(pages[0].items[pages[0].items.length - 1].kind, 'group');
  assert.equal(pages[1].items[0].kind, 'group');
  assert.match(pages[1].items[0].html, /קבוצה ב/);
  assert.doesNotMatch(pages[1].items[0].html, /המשך/); // הכותרת המקורית שנגררה, לא עותק "המשך"
});

t('שורת סיכום לא נשארת לבד בגיליון: נגררת איתה שורה אחרונה אחת לפחות', () => {
  const atoms = Array.from({ length: 10 }, (_, i) => T.row([`r${i}`, 'x']));
  atoms.push(T.tot(['סה״כ', '1']));
  const { pages } = run(atoms, CAP);
  assert.equal(pages.length, 2);
  assert.ok(pages[1].items.length >= 2);
  assert.equal(pages[1].items[pages[1].items.length - 1].kind, 'tot');
  assert.equal(pages[0].items.length, 9);
});

t('שורת הסיכום מופיעה פעם אחת בלבד, בסוף', () => {
  const atoms = Array.from({ length: 37 }, (_, i) => T.row([`r${i}`, 'x']));
  atoms.push(T.tot(['סה״כ', '1']));
  const { pages } = run(atoms, CAP);
  assert.equal(pages.flatMap((p) => p.items).filter((a) => a.kind === 'tot').length, 1);
  const lastPage = pages[pages.length - 1];
  assert.equal(lastPage.items[lastPage.items.length - 1].kind, 'tot');
});

t('כותרת הטבלה חוזרת בכל גיליון; בלוקים לא מוסיפים טבלה', () => {
  const atoms = [block('<p>מבוא</p>'), heading('כותרת')];
  for (let i = 0; i < 25; i++) atoms.push(T.row([`r${i}`, 'x']));
  const { pages } = run(atoms, CAP);
  assert.ok(pages.length >= 3);
  assert.ok(pages.every((p) => p.tables === 1));
});

t('כותרת מקטע (kwn) צמודה לתוכן: heading בסוף גיליון עוברת עם הטבלה', () => {
  const atoms = [];
  for (let i = 0; i < 8; i++) atoms.push(T.row([`r${i}`, 'x']));
  atoms.push(heading('מקטע חדש'));
  atoms.push(table('u', [{ t: 'א', w: '10mm' }]).row(['u0']));
  const { pages } = run(atoms, CAP);
  assert.notEqual(pages[0].items[pages[0].items.length - 1].kind, 'block');
  assert.equal(pages[1].items[0].kind, 'block');
});

t('אטום גדול מהגיליון מתקבל כמו שהוא (אין לולאה אינסופית)', () => {
  const big = Object.assign(block('<div>ענק</div>'), { h: 500 });
  const { pages } = run([big, T.row(['x', 'y'])], 100);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].items[0], big);
});

t('אין אטומים = אין גיליונות; אטום אחד = גיליון אחד', () => {
  assert.equal(run([], 100).out.length, 0);
  assert.equal(run([T.row(['a', 'b'])], 100).out.length, 1);
});

t('312 שורות + סיכום: כל שורה בדיוק פעם אחת, סדר שמור', () => {
  const atoms = Array.from({ length: 312 }, (_, i) => T.row([`m${i}`, 'x']));
  atoms.push(T.tot(['סה״כ', 'x']));
  const { pages } = run(atoms, 25 * ROW_H + HEAD_H);
  const flat = pages.flatMap((p) => p.items).filter((a) => a.kind === 'row').map(rowHtml);
  assert.deepEqual(flat, atoms.slice(0, 312).map(rowHtml));
});

console.log('גיליון וכותרת');
t('shell: "מתוך __N__" מוחלף ב-fixN; ברקוד רק כשנתבקש', () => {
  const ctx = { gm: { name: 'גמ״ח', addr: 'רחוב 1', phone: '02-1' }, dateLine: 'יום א · ב׳ תשרי', greg: '01/10/2026', time: '09:30', who: 'שרה' };
  const a = shell({ title: 'דוח', pn: 1 }, ctx);
  const b = shell({ title: 'דוח', pn: 2, barcode: '1234' }, ctx);
  assert.doesNotMatch(a, /pk-bc/);
  assert.match(b, /pk-bc/);
  const fixed = fixN([a, b]);
  assert.match(fixed[0], /עמוד 1 מתוך 2/);
  assert.match(fixed[1], /עמוד 2 מתוך 2/);
  assert.match(a, /הדפיסה: שרה/);
  assert.match(a, /01\/10\/2026/);
});
t('shell: בלי כתובת / טלפון אין שורת כתובת', () => {
  const s = shell({ title: 'x' }, { gm: { name: 'שם', addr: '', phone: '' }, dateLine: '', greg: '', time: '' });
  assert.doesNotMatch(s, /<span><\/span>/);
  assert.match(s, /<b>שם<\/b>/);
});
t('ברקוד Code 39: SVG שחור עם פסים', () => {
  const s = bc('A1', 8, 0.2);
  assert.match(s, /fill="#000"/);
  assert.match(s, /<rect /);
});
t('filterLine: ריק כשאין בחירה; קבוצות עם תווית; חיפוש', () => {
  const filters = [{ key: 'dept', options: [{ k: 'a', l: 'מכירות' }, { k: 'b', l: 'תפירה' }] }, { key: 'status', options: [{ k: 'active', l: 'פעילים' }] }];
  assert.equal(filterLine(filters, {}, ''), '');
  assert.equal(filterLine(filters, { dept: ['a', 'b'], status: ['active'] }, ' שרה ', { dept: 'מחלקה' }), 'מחלקה: מכירות / תפירה · פעילים · חיפוש: ״שרה״');
  assert.equal(filterLine(filters, {}, 'x', null, { ai: true }), 'חיפוש חכם: ״x״');
});
t('plural', () => {
  assert.equal(plural(1, 'עובד אחד', 'עובדים'), 'עובד אחד');
  assert.equal(plural(5, 'עובד אחד', 'עובדים'), '5 עובדים');
});

console.log(`\n${passed} passed`);
