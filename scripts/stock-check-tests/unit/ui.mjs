// בדיקות ל-lib/stockCheckUi.js (הלוגיקה הטהורה של דף בדיקת מלאי: בניית הבקשה, אימות, טקסטים, שבב הכמות).
//   node --no-warnings scripts/stock-check-tests/unit/ui.mjs   (מודול טהור, בלי hooks)
import { pathToFileURL } from 'node:url';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJ = process.env.PROJ || path.resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ui = await import(pathToFileURL(path.join(PROJ, 'lib/stockCheckUi.js')).href);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n   got : ' + JSON.stringify(got) + '\n   want: ' + JSON.stringify(want)));
};

/* ---------- קלט מידות ---------- */
eq('parseSizeInput: commas/spaces, trim, dedupe', ui.parseSizeInput(' 12, 36  14,12 '), ['12', '36', '14']);
eq('addSizes: new sizes not flexible; "06" then "6" = one', ui.addSizes([{ v: '12', flex: true }], '06 6 12'), [{ v: '12', flex: true }, { v: '06', flex: false }]);
eq('addSizes: cap at 10', ui.addSizes([], Array.from({ length: 12 }, (_, i) => String(i + 1)).join(' ')).length, 10);
eq('addSizes: >20 chars dropped', ui.addSizes([], 'x'.repeat(21)), []);
eq('toggleFlex numeric', ui.toggleFlex([{ v: '12', flex: false }], '12'), [{ v: '12', flex: true }]);
eq('toggleFlex non-numeric stays off (B07)', ui.toggleFlex([{ v: 'כללי', flex: false }], 'כללי'), [{ v: 'כללי', flex: false }]);
eq('toggleFlex padded "06" is numeric', ui.toggleFlex([{ v: '06', flex: false }], '06'), [{ v: '06', flex: true }]);
eq('lastSizeToken', ['12 3', '12,', '', ' 7 ', '7'].map(ui.lastSizeToken), ['3', '', '', '', '7']); // רווח סוגר = הקטע הושלם
eq('filterSizeOptions: hides chosen (by key), matches typed "8" to "08"', ui.filterSizeOptions([{ v: '06' }, { v: '08' }, { v: '10' }, { v: '36א' }], [{ v: '6' }], '8'), [{ v: '08' }]);
eq('filterSizeOptions: no typed -> all but chosen', ui.filterSizeOptions([{ v: '06' }, { v: '08' }], [], ''), [{ v: '06' }, { v: '08' }]);

/* ---------- אימות ---------- */
eq('validateForm: missing date', ui.validateForm({ date: '', model: '549', sizes: [] }), { title: 'חסר תאריך', text: 'בחרו תאריך לבדיקה.', focus: 'date' });
eq('validateForm: neither model nor size', ui.validateForm({ date: '2026-10-14', model: '  ', sizes: [] }), { title: 'צריך דגם או מידה', text: 'מלאו לפחות אחד מהם. אפשר גם את שניהם.', focus: 'model' });
eq('validateForm: size only ok', ui.validateForm({ date: '2026-10-14', model: '', sizes: [{ v: '12' }] }), null);
eq('validateForm: past date allowed (GQ-06d)', ui.validateForm({ date: '2020-01-01', model: '549', sizes: [] }), null);

/* ---------- כתובת הבקשה (סדר קבוע: date, model, sizes, flex) ---------- */
eq('buildStockCheckUrl full', ui.buildStockCheckUrl({ date: '2026-10-14', model: ' 549 ', sizes: [{ v: '12', flex: true }, { v: '36', flex: false }, { v: 'כללי', flex: true }] }),
  '/api/stock-check?date=2026-10-14&model=549&sizes=12%2C36%2C%D7%9B%D7%9C%D7%9C%D7%99&flex=12');
eq('buildStockCheckUrl model only', ui.buildStockCheckUrl({ date: '2026-10-14', model: 'תחרה', sizes: [] }), '/api/stock-check?date=2026-10-14&model=%D7%AA%D7%97%D7%A8%D7%94');
eq('buildStockCheckUrl sizes only, no flex param when none', ui.buildStockCheckUrl({ date: '2026-10-14', model: '', sizes: [{ v: '12', flex: false }] }), '/api/stock-check?date=2026-10-14&sizes=12');
eq('buildStockCheckUrl deterministic', ui.buildStockCheckUrl({ date: '2026-10-14', model: 'a', sizes: [{ v: '1', flex: true }] }), ui.buildStockCheckUrl({ date: '2026-10-14', model: 'a', sizes: [{ v: '1', flex: true }] }));
eq('buildOptionsUrl', ui.buildOptionsUrl('model', ' ערב '), '/api/stock-check/options?key=model&typed=%D7%A2%D7%A8%D7%91');

/* ---------- תצוגה ---------- */
eq('freeChipClass (GQ-06c: 3+ good)', [0, 1, 2, 3, 4, 10].map(ui.freeChipClass), ['st-mid', 'st-mid', 'st-mid', 'st-good', 'st-good', 'st-good']);
eq('freeLabel', [1, 2].map(ui.freeLabel), ['1 פנויה', '2 פנויות']);
eq('flexNote empty', ui.flexNote([]), 'אחרי שמוסיפים מידה אפשר להפעיל לה בדיקה גמישה של שתי מידות מעלה ומטה.');
eq('flexNote none on', ui.flexNote([{ v: '12', flex: false }]), 'כל מידה נבדקת בדיוק כפי שהוקלדה.');
eq('flexNote two on', ui.flexNote([{ v: '12', flex: true }, { v: '36', flex: true }, { v: 'כללי', flex: true }]), 'מידה 12 נבדקת גם במידות 10 ו־14 · מידה 36 נבדקת גם במידות 34 ו־38');
eq('summaryParts', ui.summaryParts({ dateText: 'ג׳ חשון תשפ״ז', model: '549', sizes: [{ v: '12', flex: true }, { v: '36', flex: false }] }), ['תאריך ג׳ חשון תשפ״ז', 'דגם 549', 'מידות 12 ±2, 36']);
eq('summaryParts sizes only', ui.summaryParts({ dateText: 'x', model: '', sizes: [{ v: '12', flex: false }] }), ['תאריך x', 'מידות 12']);
eq('FLEX_TIP is the Q06 explanation', ui.FLEX_TIP.includes('סכום') && ui.FLEX_TIP.includes('המינימום'), true);

/* ---------- שחזור מ-sessionStorage ---------- */
eq('sanitizeStoredState: valid', ui.sanitizeStoredState({ date: '2026-10-14', model: '549', sizes: [{ v: '12', flex: true }, { v: 'כללי', flex: true }], view: 'table', res: { results: [] } }),
  { date: '2026-10-14', model: '549', sizes: [{ v: '12', flex: true }, { v: 'כללי', flex: false }], view: 'table', res: { results: [] } });
eq('sanitizeStoredState: garbage -> null', [ui.sanitizeStoredState(null), ui.sanitizeStoredState('x'), ui.sanitizeStoredState({ date: 'bad', sizes: 'no' })], [null, null, null]);
eq('sanitizeStoredState: links from storage validated (model-card path only)', ui.sanitizeStoredState({ model: 'a', res: { results: [{ modelId: 'x', link: '/dashboard/dresses/abc' }, { modelId: 'y', link: 'https://evil/x' }, { modelId: 'z', link: '/dashboard/dresses/' }, { modelId: 'w', link: '/dashboard/dresses/a b' }, null] } }).res.results,
  [{ modelId: 'x', link: '/dashboard/dresses/abc' }, { modelId: 'y' }, { modelId: 'z' }, { modelId: 'w' }]);
eq('safeModelLink', ['/dashboard/dresses/abc', '/dashboard/dresses/abc?x=1', '/orders/1', '', null, '/dashboard/dresses/'].map(ui.safeModelLink), ['/dashboard/dresses/abc', null, null, null, null, null]);
eq('isPastDate (GQ-06d note only, never blocks)', [ui.isPastDate('2026-10-01', '2026-10-02'), ui.isPastDate('2026-10-02', '2026-10-02'), ui.isPastDate('2026-10-03', '2026-10-02'), ui.isPastDate('', '2026-10-02'), ui.isPastDate('2020-01-01', '')], [true, false, false, false, false]);
eq('PAST_DATE_NOTE plain Hebrew', /הוחזרו/.test(ui.PAST_DATE_NOTE) && /פנויות/.test(ui.PAST_DATE_NOTE), true);
eq('sanitizeStoredState: bad res dropped, bad view -> rows', ui.sanitizeStoredState({ model: 'a', res: { foo: 1 }, view: 'cards' }), { date: '', model: 'a', sizes: [], view: 'rows', res: null });

/* ---------- נושא 12 (12.10.2026): תפריט המידות — מידות שלמות בלבד (lib/sizeSort.js) ---------- */
const ss = await import(pathToFileURL(path.join(PROJ, 'lib/sizeSort.js')).href);
eq('isNumericSize (ui): "38.0" / "038" whole, "38.5" / "06.1" not', ['38.0', '038', ' 7 ', '38.5', '06.1', '', 'XL'].map(ui.isNumericSize), [true, true, true, false, false, false, false]);
eq('sizeOptionsQuery: digits only -> full whole-size list (empty query)', ['', '3', '36', '12 3', '12,'].map(ui.sizeOptionsQuery), ['', '', '', '', '']);
eq('sizeOptionsQuery: a non-digit char is sent so the server may add exceptional sizes', ['06.', '36א', 'XL', '12 36א', 'כ'].map(ui.sizeOptionsQuery), ['06.', '36א', 'XL', '36א', 'כ']);
eq('isWholeSize', ['38', '038', ' 38 ', '38.0', '38,00', '0', '00', '999', '1000', '38.5', '06.1', '36א', '38-40', 'XL', '', null].map(ss.isWholeSize),
  [true, true, true, true, true, true, true, true, false, false, false, false, false, false, false, false]);
eq('typedWantsOtherSizes', ['', '3', '36', '36 ', '06.', '36א', 'XL', 'כ', '38-'].map(ss.typedWantsOtherSizes), [false, false, false, false, true, true, true, true, true]);
{
  // תמונת נווה יעקב: מעורב, עם עשרוניות, אות עברית, טווח, מידה ריקה
  const rows = [['06', 120], ['6', 12], ['08', 203], ['8', 37], [' 32', 7], ['32', 90], ['36', 100], ['36.0', 2], ['06.1', 4], ['00.5', 1], ['01.8', 2], ['36א', 1], ['38-40', 1], ['XL', 1], ['', 1], [null, 1], ['40', 5], ['40.5', 1]].map(([sizeText, count]) => ({ sizeText, count }));
  const groups = ss.groupSizeRows(rows);
  eq('groupSizeRows: equivalent spellings merge; most common spelling shown; "36.0" shows as the whole', groups.filter((g) => g.whole).map((g) => [g.key, g.v, g.count]),
    [['6', '06', 132], ['8', '08', 240], ['32', '32', 97], ['36', '36', 102], ['40', '40', 5]]);
  eq('pickSizeMenu: default = whole sizes only (the owner complaint)', ss.pickSizeMenu(groups, '').map((g) => g.v), ['06', '08', '32', '36', '40']);
  eq('pickSizeMenu: digits typed -> still whole only', ss.pickSizeMenu(groups, '3').map((g) => g.v), ['06', '08', '32', '36', '40']);
  eq('pickSizeMenu: typed "06." -> other sizes become eligible (match fn narrows)', ss.pickSizeMenu(groups, '06.', (g, t) => g.v.includes(t)).map((g) => g.v), ['06.1']);
  eq('pickSizeMenu: typed "XL" -> XL', ss.pickSizeMenu(groups, 'XL', (g, t) => g.v.includes(t)).map((g) => g.v), ['XL']);
  eq('pickSizeMenu: typed "40." -> true decimal 40.5 only (40 is a whole size, not matched by "40.")', ss.pickSizeMenu(groups, '40.', (g, t) => g.v.includes(t)).map((g) => g.v), ['40.5']);
  eq('blank sizeText is the general size, never in the whole menu', groups.filter((g) => g.key === 'כללי').map((g) => [g.v, g.whole, g.count]), [['כללי', false, 2]]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
