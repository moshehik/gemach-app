// בדיקות יחידה ל-lib/stockCheck.js (מריצות את lib/inventory.js האמיתי מול מסד בזיכרון).
//   node --no-warnings --import ./scripts/stock-check-tests/register.mjs scripts/stock-check-tests/unit/stockCheck.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildDb, TARGET } from '../fixture.mjs';

const load = (rel) => import(pathToFileURL(path.join(process.env.PROJ, rel)).href);
const sc = await load('lib/stockCheck.js');
const { invalidateSettingsCache } = await load('lib/settingsCache.js');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n   got : ' + JSON.stringify(got) + '\n   want: ' + JSON.stringify(want)));
};
const throwsCode = async (name, fn, code) => {
  try { await fn(); eq(name, 'no error', code); }
  catch (e) { eq(name, e instanceof sc.StockCheckError ? e.code : 'other:' + e.message, code); }
};
// תמצית תוצאה: [קוד דגם, פנוי, "מידה:פנוי[מועמדות]"...]
const brief = (r) => r.results.map((x) => [x.modelCode, x.free, ...x.sizes.map((s) => `${s.size}:${s.free}` + (s.flexible ? '[' + s.candidates.map((c) => c.size + '=' + c.free).join(',') + ']' : ''))]);
const reset = () => { globalThis.__DB = buildDb(); globalThis.__QUERIES = []; invalidateSettingsCache(); };
const setSetting = (key, value) => { const row = globalThis.__DB.systemSetting.find((s) => s.key === key); if (row) row.value = value; else globalThis.__DB.systemSetting.push({ key, value }); invalidateSettingsCache(); };
const run = (p) => sc.checkStock({ date: TARGET, ...p });

/* ---------- פונקציות טהורות ---------- */
eq('isNumericSize', ['12', '36', ' 8 ', 'כללי', '38-40', '12.5', '', '1234'].map(sc.isNumericSize), [true, true, true, false, false, false, false, false]);
eq('candidates 12 flex', sc.candidateSizes('12', true), ['10', '12', '14']);
eq('candidates 36 flex', sc.candidateSizes('36', true), ['34', '36', '38']);
eq('candidates 1 flex (no non-positive)', sc.candidateSizes('1', true), ['1', '3']);
eq('candidates כללי flex -> exact', sc.candidateSizes('כללי', true), ['כללי']);
eq('candidates 38-40 flex -> exact', sc.candidateSizes('38-40', true), ['38-40']);
eq('candidates 12 not flex', sc.candidateSizes('12', false), ['12']);
eq('normalizeSizeRequests flex list', sc.normalizeSizeRequests(['12', ' 36', '12', 'כללי'], ['12', 'כללי']).map((r) => [r.size, r.flexible, r.candidates.length]), [['12', true, 3], ['36', false, 1], ['כללי', false, 1]]);
eq('normalizeSizeRequests flex all', sc.normalizeSizeRequests(['12', 'כללי'], true).map((r) => r.flexible), [true, false]);

const av = { '10': { available: 1 }, '12': { available: 0 }, '14': { available: 1 }, '36': { available: 2 }, 'כללי': { available: 1 } };
eq('evaluateModel exact 12 -> null (B06)', sc.evaluateModel(av, sc.normalizeSizeRequests(['12'])), null);
eq('evaluateModel flex 12 -> 10+14 (Q06 sum)', sc.evaluateModel(av, sc.normalizeSizeRequests(['12'], true)), { sizes: [{ size: '12', free: 2, flexible: true, candidates: [{ size: '10', free: 1 }, { size: '14', free: 1 }] }], free: 2 });
eq('evaluateModel two sizes -> min (Q06)', sc.evaluateModel(av, sc.normalizeSizeRequests(['36', '10'])).free, 1);
eq('evaluateModel and: one missing -> null (B06)', sc.evaluateModel(av, sc.normalizeSizeRequests(['36', '12'])), null);
eq('evaluateModel model-only: sizes>0 sorted, free=sum', sc.evaluateModel(av, []), { sizes: [
  { size: '10', free: 1, flexible: false, candidates: [{ size: '10', free: 1 }] },
  { size: '14', free: 1, flexible: false, candidates: [{ size: '14', free: 1 }] },
  { size: '36', free: 2, flexible: false, candidates: [{ size: '36', free: 2 }] },
  { size: 'כללי', free: 1, flexible: false, candidates: [{ size: 'כללי', free: 1 }] }], free: 5 });
eq('evaluateModel model-only, nothing free -> null', sc.evaluateModel({ '12': { available: 0 } }, []), null);
eq('evaluateModel unknown model -> null', sc.evaluateModel(undefined, sc.normalizeSizeRequests(['12'])), null);

/* ---------- אימות קלט ---------- */
reset();
await throwsCode('no date', () => sc.checkStock({ sizes: ['12'] }), 'invalid_date');
await throwsCode('bad date 2026-02-30', () => sc.checkStock({ date: '2026-02-30', sizes: ['12'] }), 'invalid_date');
await throwsCode('bad date format', () => sc.checkStock({ date: '14/10/2026', sizes: ['12'] }), 'invalid_date');
await throwsCode('neither model nor size', () => run({}), 'missing_filter');
await throwsCode('empty size', () => run({ sizes: [''] }), 'invalid_size');
await throwsCode('too many sizes', () => run({ sizes: Array.from({ length: 11 }, (_, i) => String(i + 1)) }), 'too_many_sizes');
await throwsCode('too many model tokens', () => run({ models: Array.from({ length: 11 }, (_, i) => 'x' + i) }), 'too_many_models');

/* ---------- מידה בודדת / כמה מידות / גמישה ---------- */
reset();
let r = await run({ sizes: ['36'] });
eq('size 36 exact: A(1), B(1); E dropped (0)', brief(r), [[549, 1, '36:1'], [622, 1, '36:1']]);
eq('size 36 exact: query echo', r.query, { models: [], sizes: [{ size: '36', flexible: false, candidates: ['36'] }] });
eq('size 36 exact: one bookings query, no N+1', globalThis.__QUERIES.filter((q) => q === 'orderItem.findMany').length, 1);

r = await run({ sizes: ['36', '38'] });
eq('sizes 36+38 (and): only B, free=min=1', brief(r), [[622, 1, '36:1', '38:1']]);

r = await run({ sizes: ['12'] });
eq('size 12 exact: only C(2) - A/12 booked, E/12 fresh hold', brief(r), [[811, 2, '12:2']]);

r = await run({ sizes: ['12'], flexible: true });
eq('size 12 flex: A=10+14=2, C=12(2)', brief(r), [[549, 2, '12:2[10=1,14=1]'], [811, 2, '12:2[12=2]']]);

r = await run({ sizes: ['36'], flexible: ['36'] });
eq('size 36 flex: B=36+38=2 first, A=36(1)', brief(r), [[622, 2, '36:2[36=1,38=1]'], [549, 1, '36:1[36=1]']]);

r = await run({ sizes: ['כללי'], flexible: true });
eq('size כללי flex -> exact only, A', brief(r), [[549, 1, 'כללי:1']]);
eq('size כללי flex flag off in echo', r.query.sizes[0].flexible, false);

r = await run({ sizes: ['12', '36'], flexible: ['12'] });
eq('mixed: 12 flex + 36 exact -> A only (C has no 36), free=min(2,1)=1', brief(r), [[549, 1, '12:2[10=1,14=1]', '36:1']]);

/* ---------- דגם בלבד / דגם+מידה / שילוב ---------- */
r = await run({ models: ['549'] });
eq('model 549 only: all free sizes, free=sum', brief(r), [[549, 4, '10:1', '14:1', '36:1', 'כללי:1']]);
eq('model 549 only: names', r.results.map((x) => [x.modelName, x.modelId, x.branches]), [['שמלת ערב ורד', 'mA', []]]);

r = await run({ models: ['549'], sizes: ['12'] });
eq('model 549 + size 12: no results, no size warning (size exists)', [brief(r), r.warnings], [[], []]);

r = await run({ models: ['549'], sizes: ['12'], flexible: true });
eq('model 549 + size 12 flex', brief(r), [[549, 2, '12:2[10=1,14=1]']]);

r = await run({ models: ['שמלת ערב'], sizes: ['12'], flexible: true });
eq('model by name (contains) + flex 12: A yes, E no', brief(r), [[549, 2, '12:2[10=1,14=1]']]);

r = await run({ models: ['שמלת ערב'] });
eq('model by name (contains) only: A and E? E has no free -> A only', brief(r), [[549, 4, '10:1', '14:1', '36:1', 'כללי:1']]);

r = await run({ models: ['שמלת תחרה', '622'] });
eq('two model tokens: exact name + number', brief(r), [[811, 3, '12:2', '38-40:1'], [622, 2, '36:1', '38:1']]);

r = await run({ models: ['999'] });
eq('deleted model -> warning, empty', [brief(r), r.warnings], [[], ['הדגם "999" לא נמצא']]);

globalThis.__QUERIES = [];
r = await run({ models: ['xyz'], sizes: ['36'] });
eq('unknown model + size -> warning, empty, no bookings query', [brief(r), r.warnings, globalThis.__QUERIES.filter((q) => q === 'orderItem.findMany').length], [[], ['הדגם "xyz" לא נמצא'], 0]);

r = await run({ sizes: ['99'] });
eq('size 99 nowhere -> empty + warning', [brief(r), r.warnings], [[], ['אין דגם עם פריט פעיל במידות שביקשתם']]);

r = await run({ models: ['549'], sizes: ['99'] });
eq('model + size that model lacks -> warning', [brief(r), r.warnings], [[], ['המידה "99" לא קיימת בדגמים שנבדקו']]);

r = await run({ sizes: ['38-40'] });
eq('non-numeric size 38-40 exact', brief(r), [[811, 1, '38-40:1']]);

/* ---------- תאריך: יום ישראלי, חציצה, סופ"ש, חו"ל ---------- */
reset();
r = await run({ models: ['549'], sizes: ['12'] });
eq('booking stored 21:00Z prev day counts on IL day', brief(r), []);
r = await sc.checkStock({ date: '2026-10-13', models: ['811', '549'], sizes: ['12'] });
eq('day before: A/12 still blocked by buffer (+1); C fine', brief(r), [[811, 2, '12:2']]);
r = await sc.checkStock({ date: '2026-10-07', models: ['549'], sizes: ['12'] });
eq('a week before: A/12 free', brief(r), [[549, 1, '12:1']]);
r = await run({ models: ['549'], sizes: ['10'] });
eq('buffer 3: booking at +1 business day blocks one of two', brief(r), [[549, 1, '10:1']]);
r = await run({ models: ['549'], sizes: ['14'] });
eq('buffer 3: booking at +4 business days does not block', brief(r), [[549, 1, '14:1']]);
r = await run({ models: ['622'], sizes: ['40'] });
eq('skip weekends: Sunday booking = +2 business days -> blocks', brief(r), []);
r = await run({ models: ['622'], sizes: ['34'] });
eq('prefix-only booking (no dressItem) at -1 blocks', brief(r), []);
r = await run({ models: ['549'], sizes: ['36'] });
eq('buffer 3: booking at -3 business days (Sunday) blocks one of two', brief(r), [[549, 1, '36:1']]);
r = await sc.checkStock({ date: '2026-10-15', models: ['549'], sizes: ['36'] });
eq('next day: that booking is now -4 -> both free', brief(r), [[549, 2, '36:2']]);
// הזמנת חו"ל (טווח): המנוע הקיים סופר כל יום חופף בחלון כיחידה תפוסה נפרדת -
// יומיים בחלון = 2 מתוך 2 תפוסות. הבדיקה מתעדת את ההתנהגות הקיימת, לא מאשרת שהיא רצויה.
r = await run({ models: ['550'], sizes: ['40'] });
eq('abroad 2-day range inside window: engine counts each day -> 0 of 2', brief(r), []);
r = await sc.checkStock({ date: '2026-10-07', models: ['550'], sizes: ['40'] });
eq('abroad range touching window edge (+3) once -> 1 of 2', brief(r), [[550, 1, '40:1']]);
r = await sc.checkStock({ date: '2026-10-25', models: ['550'], sizes: ['40'] });
eq('abroad range far away -> 2 of 2', brief(r), [[550, 2, '40:2']]);

setSetting('inventory_skip_weekends', 'false');
r = await run({ models: ['622'], sizes: ['40'] });
eq('no weekend skip: Sunday = +4 calendar days -> free', brief(r), [[622, 1, '40:1']]);
r = await run({ models: ['549'], sizes: ['10'] });
eq('no weekend skip: +1 still blocks', brief(r), [[549, 1, '10:1']]);

setSetting('inventory_skip_weekends', 'true');
setSetting('inventory_buffer_days', '0');
r = await run({ models: ['549'], sizes: ['10'] });
eq('buffer 0: +1 booking no longer blocks', brief(r), [[549, 2, '10:2']]);
r = await run({ models: ['549'], sizes: ['12'] });
eq('buffer 0: same-day booking still blocks', brief(r), []);

/* ---------- החזקת עגלה ---------- */
reset();
r = await run({ models: ['811'], sizes: ['12'] });
eq('expired cart hold released -> C/12 = 2', brief(r), [[811, 2, '12:2']]);
globalThis.__DB.orderItem.find((o) => o.id === 'o5').cartStatusDate = new Date(Date.now() - 5 * 60 * 1000);
r = await run({ models: ['811'], sizes: ['12'] });
eq('fresh cart hold counted -> C/12 = 1', brief(r), [[811, 1, '12:1']]);
setSetting('inventory_hold_minutes', '2');
r = await run({ models: ['811'], sizes: ['12'] });
eq('hold window shortened to 2 min -> 5-min-old hold released', brief(r), [[811, 2, '12:2']]);
reset();
r = await run({ models: ['550'], sizes: ['36'] });
eq('expired hold but item already taken -> still counted', brief(r), []);
globalThis.__DB.orderItem.find((o) => o.id === 'o10').isTaken = false;
r = await run({ models: ['550'], sizes: ['36'] });
eq('same hold, not taken -> released', brief(r), [[550, 1, '36:1']]);

/* ---------- מחסן / רזרבה ---------- */
reset();
setSetting('inventory_include_warehouse', 'true');
r = await run({ models: ['549'], sizes: ['12'] });
eq('include warehouse: A/12 gets the warehouse unit', brief(r), [[549, 1, '12:1']]);
setSetting('allow_renting_reserve_items', 'true');
r = await run({ models: ['549'], sizes: ['12'] });
eq('include warehouse + reserve: A/12 = 2', brief(r), [[549, 2, '12:2']]);

/* ---------- סניפים, קביעות, גבולות ---------- */
reset();
r = await run({ sizes: ['36'] });
eq('branchesEnabled from setting (false)', r.branchesEnabled, false);
setSetting('branches_enabled', 'true');
r = await run({ sizes: ['36'] });
eq('branchesEnabled from setting (true)', [r.branchesEnabled, r.results[0].branches], [true, []]);
r = await run({ sizes: ['36'], orgSettings: { branchesEnabled: false } });
eq('orgSettings override wins', r.branchesEnabled, false);
eq('dateHebrew present', typeof r.dateHebrew === 'string' && r.dateHebrew.length > 3, true);
eq('date echo', r.date, TARGET);

reset();
const r1 = await run({ sizes: ['36'], flexible: true });
const r2 = await run({ sizes: ['36'], flexible: true });
eq('deterministic: identical output twice', JSON.stringify(r1), JSON.stringify(r2));
eq('sorted: free desc then code asc', r1.results.map((x) => [x.free, x.modelCode]), [[2, 622], [1, 549]]);

// מקרה קצה: 320 דגמים תואמים - אין תקרה על מספר הדגמים בחישוב (כולם נכנסים לקריאה אחת
// למנוע), רק על התצוגה (200 שורות). הדגמים נדחפים בסדר הפוך כדי להוכיח שה-200 שמוצגים
// נקבעים לפי המיון (קוד עולה) ולא לפי הסדר שבו ה-DB החזיר אותם.
reset();
for (let i = 319; i >= 0; i--) {
  globalThis.__DB.dressModel.push({ id: 'z' + i, name: 'דגם המוני ' + i, barcodePrefix: 10000 + i, isDeleted: false });
  globalThis.__DB.dressItem.push({ id: 'zi' + i, dressModelId: 'z' + i, sizeText: '77', quantity: 1, location: null, inRepair: false, notInUse: false, isDeleted: false, barcodePrefix: 10000 + i });
}
globalThis.__QUERIES = [];
r = await run({ sizes: ['77'] });
eq('many models by size: 200 rows shown, truncated, no warning', [r.results.length, r.truncated, r.warnings], [200, true, []]);
eq('many models by size: the 200 shown are the lowest codes (stable, not DB order)', r.results.map((x) => x.modelCode), Array.from({ length: 200 }, (_, i) => 10000 + i));
eq('many models by size: still one bookings query (no chunking)', globalThis.__QUERIES.filter((q) => q === 'orderItem.findMany').length, 1);
// הדגם עם הקוד הגבוה ביותר (האחרון במיון) עדיין נבדק: עם מידה נדירה רק הוא מופיע
globalThis.__DB.dressItem.push({ id: 'zi-top', dressModelId: 'z319', sizeText: '78', quantity: 1, location: null, inRepair: false, notInUse: false, isDeleted: false, barcodePrefix: 10319 });
r = await run({ sizes: ['78'] });
eq('many models by size: model #320 is evaluated too (no 300 cap)', brief(r), [[10319, 1, '78:1']]);
globalThis.__QUERIES = [];
r = await run({ models: ['דגם המוני'] });
// דגם 10319 (פנוי 2 אחרי הפריט הנוסף) ראשון במיון, אחריו 10000..10198 - כולם נבדקו, לא רק 300
eq('many models by name: all 320 evaluated, 200 shown, truncated, no warning', [r.truncated, r.warnings, r.results.length, r.results[0].modelCode, r.results[199].modelCode], [true, [], 200, 10319, 10198]);
eq('many models by name: one bookings query', globalThis.__QUERIES.filter((q) => q === 'orderItem.findMany').length, 1);
r = await run({ models: ['דגם המוני 319'] });
eq('many models by name: exact name beyond #300 found', brief(r), [[10319, 2, '77:1', '78:1']]);

/* ---------- ביטוי דגם מספרי מחוץ לטווח Int ---------- */
reset();
r = await run({ models: ['99999999999'] });
eq('huge numeric token: treated as text -> not found, no 500', [brief(r), r.warnings], [[], ['הדגם "99999999999" לא נמצא']]);
r = await run({ models: ['2147483648'] });
eq('Int32 max + 1: text -> not found', [brief(r), r.warnings], [[], ['הדגם "2147483648" לא נמצא']]);
globalThis.__DB.dressModel.push({ id: 'mMax', name: 'דגם קצה', barcodePrefix: 2147483647, isDeleted: false });
globalThis.__DB.dressItem.push({ id: 'mMax1', dressModelId: 'mMax', sizeText: '10', quantity: 1, location: null, inRepair: false, notInUse: false, isDeleted: false, barcodePrefix: 2147483647 });
r = await run({ models: ['2147483647'] });
eq('Int32 max exactly: still a prefix search', brief(r), [[2147483647, 1, '10:1']]);
globalThis.__DB.dressModel.push({ id: 'mBig', name: 'דגם 99999999999', barcodePrefix: 7, isDeleted: false });
globalThis.__DB.dressItem.push({ id: 'mBig1', dressModelId: 'mBig', sizeText: '10', quantity: 1, location: null, inRepair: false, notInUse: false, isDeleted: false, barcodePrefix: 7 });
r = await run({ models: ['99999999999'] });
eq('huge numeric token: still matches a model whose name contains it', brief(r), [[7, 1, '10:1']]);

/* ---------- ימי מעבר שעון הקיץ: התאריך המבוקש חייב להישאר אותו יום ---------- */
// 27.3.2026 (שישי, כניסת שעון הקיץ ב-02:00) ו-25.10.2026 (ראשון, יציאתו). חציצה 0 כדי שרק
// היום עצמו ייספר: הזמנה ביום X חוסמת רק בבדיקה ל-X, ולא ל-X-1 / X+1.
const dstBooking = (id, iso) => ({
  id, dressItemId: 'a1', dressItem: { id: 'a1', dressModelId: 'mA', sizeText: '10' }, sizeText: '10', barcodePrefix: 549, quantity: 1,
  isDeleted: false, isReturned: false, isTaken: false, barcode: null, cartStatus: 'confirmed', cartStatusDate: new Date(Date.now() - 600 * 60 * 1000),
  order: { orderId: 900, legacyId: 7, isDeleted: false, isAbroad: false, fromDate: null, toDate: null, eventDate: new Date(iso) },
});
for (const [label, day, before, after] of [['DST start Fri', '2026-03-27', '2026-03-26', '2026-03-28'], ['DST end Sun', '2026-10-25', '2026-10-24', '2026-10-26']]) {
  reset();
  setSetting('inventory_buffer_days', '0');
  globalThis.__DB.orderItem = [dstBooking('dst1', day + 'T00:00:00.000Z')];
  r = await sc.checkStock({ date: day, models: ['549'], sizes: ['10'] });
  eq(`${label} ${day}: booking that day blocks 1 of 2`, brief(r), [[549, 1, '10:1']]);
  r = await sc.checkStock({ date: before, models: ['549'], sizes: ['10'] });
  eq(`${label} ${before}: day before unaffected`, brief(r), [[549, 2, '10:2']]);
  r = await sc.checkStock({ date: after, models: ['549'], sizes: ['10'] });
  eq(`${label} ${after}: day after unaffected`, brief(r), [[549, 2, '10:2']]);
  eq(`${label} ${day}: date echoed unchanged`, r.date, after);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
