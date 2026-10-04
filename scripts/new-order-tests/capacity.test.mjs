// R22: חלון "בדוק תפוסה" בפלטה (app/components/new-order/NoCapacity.js + noCapacityLogic.js) מול החלונות הישנים
// (components/orders/ItemCapacityModal.js, components/CapacitySearchModal.js, components/CapacityCalendar.js) - הקוד הישן מחולץ בזמן הבדיקה.
// בלי DB, בלי רשת. ההכרעות על הפונקציות הטהורות; מה שאי אפשר (JSX) - בדיקה סטטית של הקוד.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as C from '../../app/components/new-order/noCapacityLogic.js';

const PROJ = process.env.PROJ;
const rd = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').replace(/\r\n/g, '\n');
const ITEM_SRC = rd('components/orders/ItemCapacityModal.js');
const SEARCH_SRC = rd('components/CapacitySearchModal.js');
const CAL_SRC = rd('components/CapacityCalendar.js');
const LOGIC_SRC = rd('app/components/new-order/noCapacityLogic.js');
const NEW_SRC = rd('app/components/new-order/NoCapacity.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const NEW_CODE = strip(NEW_SRC);
const cut = (src, from, to) => {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `legacy: ${from}`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b >= 0, `legacy: ${to}`);
  return src.slice(a, b);
};
// eslint-disable-next-line no-new-func
const fn = (args, body) => new Function(...args, body);
const IL = (process.env.TZ || '') === 'Asia/Jerusalem';

// ---------- תפוסה לפריט: טווח, בדיקות מקדימות, בקשה ----------
const legacyRange = fn(['order'], cut(ITEM_SRC, 'const eventDate = new Date(order.eventDate);', 'let prefix =').replace(/setDateRange\([^;]*\);/, '')
  + '\nreturn { fromDate: fromDate.toISOString().split("T")[0], toDate: toDate.toISOString().split("T")[0] };');

test('R22: טווח חודש לפני/אחרי תאריך האירוע זהה לישן (כולל גלישת סוף חודש)', () => {
  for (const d of ['2026-11-12', '2026-03-31', '2026-01-31', '2026-10-31', '2026-12-31', '2027-02-28', '2026-11-12T00:00:00.000Z', '2026-11-11T22:00:00.000Z', '2026-04-01']) {
    assert.deepStrictEqual(C.itemCapacityRange(d), legacyRange({ eventDate: d }), d);
  }
});

const legacyPre = fn(['item', 'order'], [
  cut(ITEM_SRC, 'const hasIdentifier =', '\n'),
  cut(ITEM_SRC, 'const actualSize =', '\n'),
  'let out = null; const setError = (m) => { out = { error: m }; }; const setResults = () => {}; const fetchCapacity = (s) => { out = { fetch: s }; };',
  cut(ITEM_SRC, 'if (isOpen) {', '\n  }, [isOpen, item, order]').replace('if (isOpen) {', 'if (true) {'),
  'return out;'].join('\n'));

test('R22: הודעות השגיאה והסדר לפני הבקשה זהים לישן', () => {
  const items = [
    { dressModelId: 'm1', sizeText: '38' }, { dressModelId: 'm1', size: '40' }, { dressModelId: 'm1' }, { barcodePrefix: 1893, sizeText: '36' },
    { dressItem: { barcodePrefix: 5, dressModelId: 'm2' }, sizeText: '34' }, { dressItem: { dress: { barcodePrefix: 7 } }, size: '42' }, { sizeText: '38' }, {}, { description: 'כללי', size: '38' },
  ];
  const orders = [{ eventDate: '2026-11-12' }, { eventDate: '' }, {}, { eventDate: null }];
  for (const item of items) {
    for (const order of orders) {
      const l = legacyPre(item, order);
      const err = C.itemCapacityPrecheck(item, order);
      if (l && l.error) assert.equal(err, l.error, JSON.stringify([item, order]));
      else { assert.equal(err, null, JSON.stringify([item, order])); assert.equal(C.itemCapacityActualSize(item), l.fetch); }
    }
  }
});

test('R22: אותן נקודות קצה ואותו סדר פרמטרים (capacity / models / sizes)', () => {
  assert.equal(C.capacityQuery({ barcodePrefix: '1893', size: '38', fromDate: '2026-10-12', toDate: '2026-12-12' }), 'barcodePrefix=1893&size=38&fromDate=2026-10-12&toDate=2026-12-12');
  assert.match(ITEM_SRC.replace(/\s+/g, ' '), /barcodePrefix: prefix, size: actualSize, fromDate: [^,]+, toDate:/);
  assert.match(SEARCH_SRC.replace(/\s+/g, ' '), /barcodePrefix: pPrefix, size: pSize, fromDate: pFromDate, toDate: pToDate/);
  for (const url of ['/api/inventory/capacity', '/api/inventory/models', '/api/inventory/models?hasActiveItems=true', '/api/inventory/sizes?barcodePrefix=']) {
    assert.ok(NEW_SRC.includes(url), `חדש: ${url}`);
    assert.ok((ITEM_SRC + SEARCH_SRC).includes(url), `ישן: ${url}`);
  }
  assert.match(NEW_CODE, /capacity\?\$\{C\.capacityQuery\(/);
  assert.match(NEW_CODE, /C\.itemCapacityRange\(order\.eventDate\)/);
  for (const msg of ['לא נמצא קוד פריט', 'שגיאה בטעינת נתונים', 'שגיאה בחיפוש']) {
    assert.ok(NEW_SRC.includes(msg) || LOGIC_SRC.includes(msg), msg);
    assert.ok((ITEM_SRC + SEARCH_SRC).includes(msg), msg);
  }
});

// ---------- חיפוש: ברירות מחדל, היסטוריה, הצעות ----------
test('R22: חיפוש - טווח ברירת מחדל (היום ועד חצי שנה), אימות דגם+מידה, היסטוריה (50, אותם שדות)', () => {
  assert.equal(C.SEARCH_NEEDS_MODEL_AND_SIZE, 'יש להזין דגם ומידה');
  assert.ok(SEARCH_SRC.includes("'יש להזין דגם ומידה'"));
  assert.deepStrictEqual(C.searchRangeDefaults('2026-10-04'), { fromDate: '2026-10-04', toDate: '2027-04-04' });
  assert.deepStrictEqual(C.resolveSearchRange('', '', '2026-08-31'), { fromDate: '2026-08-31', toDate: '2027-03-03' }, 'גלישת סוף חודש כמו addMonthsToDateKey');
  assert.deepStrictEqual(C.resolveSearchRange('2026-11-01', '2026-11-20', '2026-10-04'), { fromDate: '2026-11-01', toDate: '2026-11-20' });
  assert.match(SEARCH_SRC, /pFromDate = getIsraelTodayKey\(\)/);
  assert.match(SEARCH_SRC, /pToDate = addMonthsToDateKey\(getIsraelTodayKey\(\), 6\)/);
  assert.equal(C.CAPACITY_HISTORY_KEY, 'capacity_search_history');
  assert.ok(SEARCH_SRC.includes("'capacity_search_history'") && SEARCH_SRC.includes('.slice(0, 50)'));
  const legacyKeys = [...cut(SEARCH_SRC, 'const newSearch = {', '};').matchAll(/^\s+(\w+):/gm)].map(m => m[1]);
  const e = C.buildHistoryEntry({ employeeCode: '', customerName: '', barcodePrefix: '1', size: '38', fromDate: 'a', toDate: 'b' }, new Date('2026-10-04T10:00:00Z'));
  assert.deepStrictEqual(Object.keys(e), legacyKeys);
  const many = Array.from({ length: 60 }, (_, i) => ({ id: i }));
  const out = C.pushHistory(many, e);
  assert.equal(out.length, 50);
  assert.equal(out[0], e);
  assert.deepStrictEqual(C.pushHistory(null, e), [e]);
});

test('R22: סינון הצעות הדגמים (שם או קוד) כמו הישן', () => {
  const models = [{ id: 1, name: 'שמלת תחרה קרם', barcodePrefix: '4512' }, { id: 2, name: 'ללא שם 17', barcodePrefix: '1893' }, { id: 3, name: '4512', barcodePrefix: '4512' }];
  assert.deepStrictEqual(C.filterModels(models, '').map(m => m.id), [1, 2, 3]);
  assert.deepStrictEqual(C.filterModels(models, ' תחרה ').map(m => m.id), [1]);
  assert.deepStrictEqual(C.filterModels(models, '4512').map(m => m.id), [1, 3]);
  assert.deepStrictEqual(C.filterModels(models, '18').map(m => m.id), [2]);
  assert.match(SEARCH_SRC, /String\(m\.name \|\| ''\)\.includes\(modelQuery\.trim\(\)\) \|\| String\(m\.barcodePrefix \|\| ''\)\.includes\(modelQuery\.trim\(\)\)/);
  assert.equal(C.modelLabel(models[0]), 'שמלת תחרה קרם (4512)');
});

// ---------- לוח: תפוסה ליום לפי אותו כלל כמו CapacityCalendar ----------
const legacyOcc = fn(['occupiedOrders'], cut(CAL_SRC, 'const getDayOccupancy = (hd) => {', 'const isDayInRange').replace(/\n {2}};\n[\s\S]*$/, '\n  };') + '\nreturn getDayOccupancy;');
const keyToLocal = (k) => { const [y, m, d] = k.split('-').map(Number); return { greg: () => new Date(y, m - 1, d) }; };

test('R22: תפוסה ליום בלוח - אותו כלל כמו CapacityCalendar (חפיפה eventDate..returnDate, כמות מסוכמת); לפי יום ישראלי בכל אזור זמן', () => {
  // התאריכים נשמרים כחצות ישראל (22:00Z חורף / 21:00Z קיץ) או כחצות UTC - בשני המקרים היום הוא היום הישראלי
  const orders = [
    { id: 1, orderId: 101, eventDate: '2026-11-11T22:00:00.000Z', returnDate: null, quantity: 1 },
    { id: 2, orderId: 102, eventDate: '2026-11-14T22:00:00.000Z', returnDate: '2026-11-17T22:00:00.000Z', quantity: 2 },
    { id: 3, orderId: 103, eventDate: '2026-11-15T00:00:00.000Z', returnDate: '2026-11-16T00:00:00.000Z', quantity: 3 },
    { id: 4, orderId: 104, eventDate: '2026-10-25T22:00:00.000Z', returnDate: null, quantity: 1 },
  ];
  const days = [];
  for (let i = 0; i < 40; i++) days.push(new Date(Date.UTC(2026, 9, 20 + i)).toISOString().slice(0, 10));
  const expected = (k) => { const r = C.occupancyOn(orders, k); return { total: r.total, ids: r.orders.map(o => o.id) }; };
  // אי-תלות באזור הזמן: הערכים קבועים (היום הישראלי)
  assert.deepStrictEqual(expected('2026-11-12'), { total: 1, ids: [1] });
  assert.deepStrictEqual(expected('2026-11-15'), { total: 2 + 3, ids: [2, 3] });
  assert.deepStrictEqual(expected('2026-11-16'), { total: 2 + 3, ids: [2, 3] });
  assert.deepStrictEqual(expected('2026-11-18'), { total: 2, ids: [2] });
  assert.deepStrictEqual(expected('2026-10-26'), { total: 1, ids: [4] });
  assert.deepStrictEqual(expected('2026-11-11'), { total: 0, ids: [] });
  if (IL) {
    const l = legacyOcc(orders);
    for (const k of days) {
      const a = l(keyToLocal(k));
      assert.deepStrictEqual({ total: a.total, ids: a.orders.map(o => o.id) }, expected(k), k);
    }
  }
  assert.match(CAL_SRC, /greg >= start && greg <= end/);
});

test('R22: boardMonths - חודשי הטווח (עבריים), בלי חריגה בטווח הפוך/ריק; dayKeyOf לפי יום ישראלי', () => {
  const ms = C.boardMonths('2026-10-12', '2026-12-12');
  assert.ok(ms.length >= 2 && ms.length <= 4, JSON.stringify(ms));
  assert.ok(ms[0] <= '2026-10-12' && ms[ms.length - 1] <= '2026-12-12');
  for (let i = 1; i < ms.length; i++) assert.ok(ms[i] > ms[i - 1]);
  assert.deepStrictEqual(C.boardMonths('', '2026-12-12'), []);
  assert.deepStrictEqual(C.boardMonths('2026-12-12', '2026-10-12'), []);
  assert.equal(C.dayKeyOf(''), '');
  assert.equal(C.dayKeyOf('abc'), '');
  assert.equal(C.dayKeyOf('2026-11-11T22:00:00.000Z'), '2026-11-12');
  assert.equal(C.dayKeyOf('2026-11-12T00:00:00.000Z'), '2026-11-12');
});

// ---------- סטטי: הפלטה, לא הישן ----------
test('R22: האשף משתמש בחלונות הפלטה (#dlg2 כהה ב-portal) ולא בישנים; מתג רשימה/לוח; בלי title= / alert', () => {
  const A5 = strip(rd('app/components/new-order/NewOrderA5.js'));
  assert.ok(!/ItemCapacityModal|CapacitySearchModal/.test(A5), 'ייבוא הישן');
  assert.match(A5, /<ItemCapacityDialog /);
  assert.match(A5, /<CapacitySearchDialog /);
  const portal = /<NoPortal>([\s\S]*?)<\/NoPortal>/.exec(A5);
  assert.ok(portal && /ItemCapacityDialog/.test(portal[1]) && /CapacitySearchDialog/.test(portal[1]), 'בתוך NoPortal');
  assert.equal((NEW_CODE.match(/<DialogFrame layer=\{2\}/g) || []).length, 2);
  assert.match(NEW_CODE, /<SegPill id="capView" options=\{VIEW_OPTIONS\}/);
  assert.match(NEW_SRC, /v: 'list'[\s\S]*v: 'board'/);
  assert.match(NEW_CODE, /<NoHebrewCalendar mode="range"/); // טווח התאריכים בחיפוש = הלוח העברי של האשף
  assert.match(NEW_CODE, /className="hc no-cap-board"/); // הלוח = .hc
  assert.ok(!/modal-backdrop|className="modal|kpi-card|datepicker|data-agy-id/.test(NEW_CODE), 'מחלקות העיצוב הישן');
  assert.ok(!/<[a-z][a-z0-9]*\b[^>]*\stitle=/.test(NEW_CODE), 'title=');
  assert.ok(!/\b(alert|confirm)\(/.test(NEW_CODE));
  // Escape: החלון מהסל נסגר (כמו הישן); חיפוש התפוסה לא נסגר ב-Escape (בישן Escape נחסם בו)
  assert.match(SEARCH_SRC, /e\.key === 'Escape'[\s\S]{0,80}e\.preventDefault\(\)/);
  const ctl = strip(rd('app/components/new-order/useNewOrderController.js'));
  assert.match(ctl, /else if \(capacityItem\) setCapacityItem\(null\)/);
  assert.ok(!/showCapacitySearch\) setShowCapacitySearch\(false\)/.test(ctl));
  const css = rd('app/components/new-order/css/new-order.css');
  assert.match(css, /\.gm-ds\.gm-no \.dlg \.seg\.pill/);
  assert.match(css, /\.gm-ds\.gm-no \.dlg \.hc-d\.occ/);
});
