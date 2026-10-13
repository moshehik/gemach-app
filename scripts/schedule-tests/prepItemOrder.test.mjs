// סדר הפריטים בשורות הלו״ז (דפי הכנות, 12.10.2026): הפריטים נשלפים בלי ORDER BY (סדר הכנסה) ולכן יצאו "10, 6, 8".
// getScheduleDay על נתוני הדמה: שלב 4 (הכנה) - דגם לפי מספר עולה, בתוך הדגם מידה עולה. הסידור נעשה פעם אחת ב-buildEventStageRow, ולכן כל שלבי האירוע וגם "הזמנה בודדת" (כרטיס הזמנה, singleOrder.js) מקבלים אותו סדר.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, ORDERS, NOW, DAY, SETTINGS_ORG2 } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { getScheduleDay } = await L('lib/schedule/index.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { sortItemViews } = await L('lib/schedule/itemOrder.js');

const settingsMap = (rows) => Object.fromEntries(rows.map((r) => [r.key, r.value]));
const manager = { id: 'emp-head', roleId: 0 };
const day = () => getScheduleDay({ date: DAY, user: manager, now: NOW, settings: resolveScheduleSettings(settingsMap(SETTINGS_ORG2)) });

// עותק של הזמנת הכנה קיימת (1006: הכנה 15.10) עם פריטים בסדר הכנסה "שגוי"; barcodePrefix 555 = 'לילך', 123 = 'ורד' (DRESS_MODELS)
function withItems(specs) {
  const base = structuredClone(ORDERS.find((o) => o.orderId === 1006));
  base.items = specs.map(([prefix, size], i) => ({ ...structuredClone(base.items[0]), id: 'ord-it-' + i, barcodePrefix: prefix, sizeText: size, dressItem: null }));
  return base;
}

beforeEach(() => { invalidateSettingsCache(); });

test('stage 4 prep: items sorted by model number ascending, then size ascending (10 after 8, 06.1 between 6 and 8, empty last)', async () => {
  const o = withItems([[555, '10'], [555, '8'], [123, '12'], [555, '06.1'], [123, '6'], [123, null], [555, '6']]);
  installDb({ extra: { order: ORDERS.map((x) => (x.orderId === 1006 ? o : x)) } });
  const res = await day();
  const row = res.stages.find((s) => s.key === 'prep').items.find((r) => r.orderId === 1006);
  assert.deepEqual(row.items.map((i) => [i.modelPrefix, i.size]), [
    [123, '6'], [123, '12'], [123, null],
    [555, '6'], [555, '06.1'], [555, '8'], [555, '10'],
  ]);
  assert.equal(row.dressCount, 7, 'sorting changes nothing about the count');
  assert.deepEqual([...new Set(row.items.map((i) => i.orderItemId))].length, 7, 'every item kept once');
});

test('sortItemViews: pure, stable, model fallback to the model name when there is no prefix, does not mutate', () => {
  const src = [
    { orderItemId: 'a', modelPrefix: null, model: 'ורד', size: '40' },
    { orderItemId: 'b', modelPrefix: 4512, model: 'x', size: '38' },
    { orderItemId: 'c', modelPrefix: 522, model: 'y', size: '44' },
    { orderItemId: 'd', modelPrefix: 522, model: 'y', size: '8' },
    { orderItemId: 'e', modelPrefix: 522, model: 'y', size: '8' },
  ];
  const before = src.map((x) => x.orderItemId).join('');
  const out = sortItemViews(src);
  assert.deepEqual(out.map((x) => x.orderItemId), ['d', 'e', 'c', 'b', 'a'], 'numeric prefixes first (522 < 4512), name-only last; equal items keep input order');
  assert.equal(src.map((x) => x.orderItemId).join(''), before);
  assert.deepEqual(sortItemViews([]), []);
  // wrapper form (PP-08)
  const w = sortItemViews([{ it: { modelPrefix: 2, size: '10' } }, { it: { modelPrefix: 2, size: '8' } }], (x) => x.it);
  assert.deepEqual(w.map((x) => x.it.size), ['8', '10']);
});
