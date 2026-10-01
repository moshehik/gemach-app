// בדיקות לנתיב app/api/stock-check/options/route.js (רשימות ההצעות לדגם ולמידה, Q03) מול מסד בזיכרון.
//   node --no-warnings --import ./scripts/stock-check-tests/register.mjs scripts/stock-check-tests/unit/options.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildDb } from '../fixture.mjs';

const load = (rel) => import(pathToFileURL(path.join(process.env.PROJ, rel)).href);
const route = await load('app/api/stock-check/options/route.js');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n   got : ' + JSON.stringify(got) + '\n   want: ' + JSON.stringify(want)));
};
const get = (qs) => route.GET(new Request('http://local/api/stock-check/options' + qs));
const reset = () => { globalThis.__DB = buildDb(); globalThis.__AUTH_OK = true; globalThis.__PAGE_OK = true; globalThis.__PAGE_KEYS = []; };
const vals = (res) => res.__json.options.map((o) => o.v);

eq('route exports', [route.dynamic], ['force-dynamic']);

reset();
globalThis.__AUTH_OK = false;
let res = await get('?key=model');
eq('401 when not logged in', [res.status, res.__json], [401, { error: 'Unauthorized' }]);

reset();
globalThis.__PAGE_OK = false;
res = await get('?key=model');
eq('403 when page gate closed; same key as the check itself (page:orders)', [res.status, globalThis.__PAGE_KEYS], [403, ['page:orders']]);

reset();
res = await get('?key=phone');
eq('unknown key -> 400', [res.status, res.__json.code], [400, 'invalid_key']);
res = await get('');
eq('missing key -> 400', res.status, 400);

/* ---------- דגמים ---------- */
res = await get('?key=model');
eq('models, nothing typed: active models (deleted one excluded) sorted by Hebrew name, with code', res.__json.options,
  [{ v: 'שמלת ילדה', c: 700 }, { v: 'שמלת כלה אלמוג', c: 622 }, { v: 'שמלת ערב ורד', c: 549 }, { v: 'שמלת ערב סגולה', c: 550 }, { v: 'שמלת תחרה', c: 811 }]);
res = await get('?key=model&typed=ערב');
eq('models by name (contains)', vals(res), ['שמלת ערב ורד', 'שמלת ערב סגולה']);
res = await get('?key=model&typed=5');
eq('models by code prefix "5": 549, 550 (code asc); no name contains "5"', res.__json.options.map((o) => o.c), [549, 550]);
res = await get('?key=model&typed=550');
eq('exact code first', res.__json.options.map((o) => o.c), [550]);
res = await get('?key=model&typed=xyz');
eq('no match -> empty list', vals(res), []);
res = await get('?key=model&typed=99999999999');
eq('huge number: no 500, treated as text', [res.status, vals(res)], [200, []]);

/* ---------- מידות ---------- */
res = await get('?key=size');
eq('sizes: every active spelling, merged by normalized key, shown as in DB, sorted by value', vals(res),
  ['2', '04', '06', '06.1', '8', '10', '12', '14', '34', '36', '36א', '38', '38-40', '40', 'כללי']) // "  2" נחתך; "08"/"8" שקולים (1:1) -> הקצר);
globalThis.__DB.dressItem.push({ id: 'x1', dressModelId: 'mF', sizeText: '8', quantity: 1, location: null, inRepair: false, notInUse: false, isDeleted: false, barcodePrefix: 700 });
res = await get('?key=size');
eq('"8" x2 vs "08" x1 -> the more common spelling wins', vals(res).includes('8') && !vals(res).includes('08'), true);
res = await get('?key=size&typed=0');
eq('typed "0": spellings containing 0 and keys starting with 0', vals(res), ['04', '06', '06.1', '10', '38-40', '40']);
res = await get('?key=size&typed=3');
eq('typed "3": keys starting with 3 + spellings containing 3', vals(res), ['34', '36', '36א', '38', '38-40']);
// פריט לא בשימוש / מחוק לא תורם מידה
globalThis.__DB.dressItem.push({ id: 'x2', dressModelId: 'mF', sizeText: '99', quantity: 1, location: null, inRepair: false, notInUse: true, isDeleted: false, barcodePrefix: 700 });
res = await get('?key=size');
eq('notInUse item does not add a size', vals(res).includes('99'), false);

globalThis.__DB = null;
res = await get('?key=model');
eq('500 on internal failure, generic message', [res.status, res.__json], [500, { error: 'שגיאה בטעינת ההצעות' }]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
