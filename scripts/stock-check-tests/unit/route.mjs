// בדיקות לנתיב app/api/stock-check/route.js (הרשאה, פענוח פרמטרים, קודי שגיאה) מול מסד בזיכרון.
//   node --no-warnings --import ./scripts/stock-check-tests/register.mjs scripts/stock-check-tests/unit/route.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildDb, TARGET } from '../fixture.mjs';

const load = (rel) => import(pathToFileURL(path.join(process.env.PROJ, rel)).href);
const route = await load('app/api/stock-check/route.js');
const lib = await load('lib/stockCheck.js');
const { invalidateSettingsCache } = await load('lib/settingsCache.js');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n   got : ' + JSON.stringify(got) + '\n   want: ' + JSON.stringify(want)));
};
const get = (qs) => route.GET(new Request('http://local/api/stock-check' + qs));
const reset = () => { globalThis.__DB = buildDb(); invalidateSettingsCache(); globalThis.__AUTH_OK = true; globalThis.__PAGE_OK = true; globalThis.__PAGE_ALLOW = null; globalThis.__PAGE_KEYS = []; };

eq('route exports: only Next handler exports (page key lives in lib/stockCheck.js)', [route.dynamic, route.maxDuration, 'STOCK_CHECK_PAGE_KEY' in route, lib.STOCK_CHECK_PAGE_KEY], ['force-dynamic', 30, false, 'page:orders']);

reset();
globalThis.__AUTH_OK = false;
let res = await get(`?date=${TARGET}&sizes=36`);
eq('401 when not logged in', [res.status, res.__json], [401, { error: 'Unauthorized' }]);

reset();
globalThis.__PAGE_OK = false;
res = await get(`?date=${TARGET}&sizes=36`);
eq('403 when page gate closed; asked page:orders', [res.status, res.__json, globalThis.__PAGE_KEYS], [403, { error: 'Forbidden' }, ['page:orders']]);

// results[].link only for callers who may open the model card (page:dresses_catalog)
reset();
globalThis.__PAGE_ALLOW = { 'page:orders': true, 'page:dresses_catalog': false };
res = await get(`?date=${TARGET}&sizes=36`);
eq('no page:dresses_catalog -> rows without link; both keys asked once', [res.status, res.__json.results.map((r) => 'link' in r), globalThis.__PAGE_KEYS], [200, [false, false], ['page:orders', 'page:dresses_catalog']]);
reset();
res = await get(`?date=${TARGET}&model=xyz`);
eq('empty results -> catalog key not even asked', globalThis.__PAGE_KEYS, ['page:orders']);

reset();
res = await get('?sizes=36');
eq('400 missing date', [res.status, res.__json.code], [400, 'invalid_date']);
res = await get(`?date=${TARGET}`);
eq('400 neither model nor size', [res.status, res.__json.code, res.__json.error], [400, 'missing_filter', 'חובה דגם או מידה, או שניהם']);
res = await get(`?date=${TARGET}&sizes=,`);
eq('sizes="," -> treated as no sizes -> missing_filter', [res.status, res.__json.code], [400, 'missing_filter']);

res = await get(`?date=${TARGET}&sizes=36`);
eq('200 size only', [res.status, res.__json.results.map((r) => [r.modelCode, r.free, r.link])], [200, [[549, 1, '/dashboard/dresses/mA'], [622, 1, '/dashboard/dresses/mB']]]);
eq('200 body shape', Object.keys(res.__json).sort(), ['branchesEnabled', 'date', 'dateHebrew', 'query', 'results', 'truncated', 'warnings']);
eq('200 result row shape (with link: caller may open the model card)', Object.keys(res.__json.results[0]).sort(), ['branches', 'free', 'link', 'modelCode', 'modelId', 'modelName', 'sizes']);

res = await get(`?date=${TARGET}&sizes=12,%2036&flex=12`);
eq('sizes with spaces + flex list', res.__json.query.sizes.map((s) => [s.size, s.flexible]), [['12', true], ['36', false]]);
eq('mixed flex result', res.__json.results.map((r) => [r.modelCode, r.free]), [[549, 1]]);

res = await get(`?date=${TARGET}&sizes=12&flex=all`);
eq('flex=all', [res.__json.query.sizes[0].flexible, res.__json.results.map((r) => r.modelCode)], [true, [549, 811]]);

res = await get(`?date=${TARGET}&model=549&model=%D7%A9%D7%9E%D7%9C%D7%AA%20%D7%AA%D7%97%D7%A8%D7%94`);
eq('model repeated (number + hebrew name)', res.__json.results.map((r) => r.modelCode), [549, 811]);

res = await get(`?date=${TARGET}&model=xyz&sizes=36`);
eq('unknown model -> 200 with warning', [res.status, res.__json.results.length, res.__json.warnings], [200, 0, ['הדגם "xyz" לא נמצא']]);

res = await get(`?date=2026-13-01&sizes=36`);
eq('invalid month', [res.status, res.__json.code], [400, 'invalid_date']);

// החלטות הבעלים 2.10.2026 + כתיבי מידה
res = await get('?date=2020-01-01&model=549');
eq('GQ-06d: past date allowed through the route', [res.status, res.__json.date, res.__json.results.length], [200, '2020-01-01', 1]);
res = await get(`?date=${TARGET}&sizes=06,6,%2008&flex=06`);
eq('"06"/"6" collapse, " 08" trimmed, flex by spelling', res.__json.query.sizes.map((s) => [s.size, s.flexible, s.candidates]), [['06', true, ['4', '6', '8']], ['08', false, ['8']]]);
eq('padded sizes find model F', res.__json.results.map((r) => [r.modelCode, r.free]), [[700, 2]]);
res = await get(`?date=${TARGET}&sizes=38-40&flex=all`);
eq('flex=all on a non-numeric size -> exact, flexible:false', [res.__json.query.sizes[0].flexible, res.__json.results.map((r) => r.modelCode)], [false, [811]]);

// שגיאה פנימית (DB נופל) -> 500 בלי דליפת פרטים (השגיאה נרשמת ללוג בכוונה - זה הרעש שמודפס כאן)
globalThis.__DB = null;
res = await get(`?date=${TARGET}&sizes=36`);
eq('500 on internal failure', [res.status, res.__json], [500, { error: 'שגיאה בבדיקת המלאי' }]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
