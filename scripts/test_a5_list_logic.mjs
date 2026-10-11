// בדיקת יחידה ללוגיקה הטהורה של ערכת הרשימות החדשה (app/components/a5-list/listLogic.js): חיפוש מילים, סינון קבוצתי (OR בתוך קבוצה / AND בין קבוצות),
// ספירות לאפשרויות, מיון יציב (מספרים / עברית), עימוד 50 ומספרי עמודים, הדגשת חיפוש. אין DB / דפדפן.
// הרצה: node scripts/test_a5_list_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  PAGE_SIZE, clampPage, compareValues, computeVisible, filterSummary, findSorter, initialSelection, isOptionHidden, matchesWords, optionCount,
  pageCount, pageList, pageRange, pageSlice, passesGroup, plural, sortItems, splitHighlight, totalSelected, wordsOf,
} from '../app/components/a5-list/listLogic.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const ITEMS = [
  { id: 1, name: 'שרה כהן', dept: 'a', active: true, n: 5, tel: '0501' },
  { id: 2, name: 'רחל לוי', dept: 'b', active: true, n: 12, tel: '0502' },
  { id: 3, name: 'לאה כהן', dept: 'a', active: false, n: 3, tel: '0503' },
  { id: 4, name: 'מרים פרץ', dept: 'c', active: true, n: 12, tel: '0504' },
];
const hay = (x) => `${x.name} ${x.tel}`;
const FILTERS = [
  { key: 'dept', label: 'מחלקה', icon: 'building', def: [], options: ['a', 'b', 'c'].map((k) => ({ k, l: k, test: (x) => x.dept === k })) },
  { key: 'status', label: 'סטטוס', icon: 'userck', def: ['active'], options: [{ k: 'active', l: 'פעילים', test: (x) => x.active }, { k: 'inactive', l: 'לא פעילים', test: (x) => !x.active }] },
];
const SORTS = [{ k: 'name', l: 'שם', get: (x) => x.name }, { k: 'n', l: 'כמות', get: (x) => x.n }];

console.log('חיפוש');
t('wordsOf: אותיות קטנות, בלי ריק, ריווח כפול', () => {
  assert.deepEqual(wordsOf('  Foo   BAR '), ['foo', 'bar']);
  assert.deepEqual(wordsOf(''), []); assert.deepEqual(wordsOf(null), []);
});
t('matchesWords: כל המילים חייבות להופיע (AND), בלי מילים = כן', () => {
  assert.equal(matchesWords('שרה כהן 0501', ['שרה', 'כהן']), true);
  assert.equal(matchesWords('שרה כהן 0501', ['שרה', 'לוי']), false);
  assert.equal(matchesWords('x', []), true);
});

console.log('סינון ומיון');
t('initialSelection לוקח את def של כל קבוצה (עותק, לא הפניה)', () => {
  const sel = initialSelection(FILTERS);
  assert.deepEqual(sel, { dept: [], status: ['active'] });
  sel.status.push('x'); assert.deepEqual(FILTERS[1].def, ['active']);
});
t('passesGroup: בלי בחירה = כן; OR בתוך קבוצה', () => {
  assert.equal(passesGroup(ITEMS[0], FILTERS[0], []), true);
  assert.equal(passesGroup(ITEMS[0], FILTERS[0], ['b', 'a']), true);
  assert.equal(passesGroup(ITEMS[0], FILTERS[0], ['b']), false);
});
t('computeVisible: חיפוש + AND בין קבוצות (פעילים כברירת מחדל) + מיון', () => {
  const sel = { dept: [], status: ['active'] };
  const base = { items: ITEMS, words: [], hay, filters: FILTERS, sel, sorts: SORTS, sort: { k: 'name', dir: 1 } };
  assert.deepEqual(computeVisible(base).map((x) => x.id), [4, 2, 1].sort((a, b) => ITEMS.find((x) => x.id === a).name.localeCompare(ITEMS.find((x) => x.id === b).name, 'he')));
  assert.deepEqual(computeVisible({ ...base, sel: { dept: ['a'], status: ['active', 'inactive'] } }).map((x) => x.id).sort(), [1, 3]);
  assert.deepEqual(computeVisible({ ...base, words: ['כהן'] }).map((x) => x.id), [1]);
  assert.deepEqual(computeVisible({ ...base, words: ['כהן'], localSearch: false }).length, 3, 'localSearch=false: החיפוש כבר נעשה בשרת');
});
t('sortItems: יציב (שווים בסדר המקור), יורד הופך, מספרים לפי ערך ולא לפי מחרוזת', () => {
  const byN = sortItems(ITEMS, findSorter(SORTS, 'n'), 1).map((x) => x.id);
  assert.deepEqual(byN, [3, 1, 2, 4], '12 אחרי 5; 2 לפני 4 (סדר מקור)');
  assert.deepEqual(sortItems(ITEMS, findSorter(SORTS, 'n'), -1).map((x) => x.id), [4, 2, 1, 3], 'יורד (כמו list-core: (r || סדר מקור) * dir) - גם שוויון מתהפך');
  assert.equal(findSorter(SORTS, 'nope'), SORTS[0], 'מפתח לא מוכר -> הראשון');
});
t('compareValues: מספרים, טקסט עברי עם numeric, null', () => {
  assert.ok(compareValues(2, 10) < 0);
  assert.ok(compareValues('דגם 2', 'דגם 10') < 0, 'numeric');
  assert.ok(compareValues('א', 'ב') < 0);
  assert.equal(compareValues(null, ''), 0);
});
t('optionCount: על החיפוש + הקבוצות האחרות, לא על הקבוצה של האפשרות', () => {
  const sel = { dept: [], status: ['active'] };
  const o = { items: ITEMS, words: [], hay, filters: FILTERS, sel };
  assert.equal(optionCount(o, FILTERS[0], FILTERS[0].options[0]), 1, 'מחלקה a בין הפעילים');
  assert.equal(optionCount(o, FILTERS[1], FILTERS[1].options[1]), 1, 'לא פעילים: לא נספר מול הסינון של הסטטוס עצמו');
  assert.equal(optionCount({ ...o, words: ['לאה'] }, FILTERS[1], FILTERS[1].options[0]), 0);
  assert.equal(optionCount(o, FILTERS[0], { k: 'z', count: 7 }), 7, 'מצב שרת: count קבוע');
});
t('isOptionHidden: ספירה 0 ולא נבחרה = מוסתרת; נבחרה = נשארת', () => {
  assert.equal(isOptionHidden(0, false), true); assert.equal(isOptionHidden(0, true), false); assert.equal(isOptionHidden(3, false), false);
});
t('totalSelected / filterSummary', () => {
  assert.equal(totalSelected(FILTERS, { dept: ['a', 'b'], status: ['active'] }), 3);
  assert.equal(filterSummary(FILTERS, { dept: ['a'], status: [] }), 'מחלקה: a');
  assert.equal(filterSummary(FILTERS, { dept: [], status: [] }), '');
});

console.log('עימוד');
t('PAGE_SIZE = 50; pageCount / clampPage / pageSlice / pageRange', () => {
  assert.equal(PAGE_SIZE, 50);
  assert.equal(pageCount(0), 1); assert.equal(pageCount(50), 1); assert.equal(pageCount(51), 2); assert.equal(pageCount(312), 7);
  assert.equal(clampPage(9, 120), 3); assert.equal(clampPage(0, 120), 1); assert.equal(clampPage(2, 120), 2);
  const L = Array.from({ length: 120 }, (_, i) => i);
  assert.equal(pageSlice(L, 3).length, 20); assert.equal(pageSlice(L, 1)[0], 0); assert.equal(pageSlice(L, 2)[0], 50);
  assert.deepEqual(pageRange(120, 3), { from: 101, to: 120 }); assert.deepEqual(pageRange(0, 1), { from: 0, to: 0 });
});
t('pageList: עד 7 עמודים מלא; אחרת 1 / סביב הנוכחי / אחרון עם …', () => {
  assert.deepEqual(pageList(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageList(1, 10), [1, 2, 3, 4, '…', 10]);
  assert.deepEqual(pageList(5, 10), [1, '…', 4, 5, 6, '…', 10]);
  assert.deepEqual(pageList(10, 10), [1, '…', 7, 8, 9, 10]);
  assert.deepEqual(pageList(2, 7), [1, 2, 3, 4, 5, 6, 7]);
});

console.log('הדגשה וניסוח');
t('splitHighlight: לא תלוי רישיות, תווים מיוחדים בטוחים, בלי מילים = חלק אחד', () => {
  assert.deepEqual(splitHighlight('שרה כהן', ['כהן']), [{ t: 'שרה ', mark: false }, { t: 'כהן', mark: true }]);
  assert.deepEqual(splitHighlight('Foo.bar', ['foo']).filter((p) => p.mark).map((p) => p.t), ['Foo']);
  assert.deepEqual(splitHighlight('a+b', ['+']).filter((p) => p.mark).map((p) => p.t), ['+']);
  assert.deepEqual(splitHighlight('abc', []), [{ t: 'abc', mark: false }]);
  assert.deepEqual(splitHighlight('', ['a']), [{ t: '', mark: false }]);
  assert.deepEqual(splitHighlight(null, ['a']), [{ t: '', mark: false }]);
});
t('plural', () => {
  assert.equal(plural(1, 'עובד אחד', 'עובדים'), 'עובד אחד'); assert.equal(plural(5, 'עובד אחד', 'עובדים'), '5 עובדים'); assert.equal(plural(0, 'א', 'ב', 'אין'), 'אין');
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
