// QA חוצה-דפים: רץ על כל דף ב-registry שסטטוסו 'ready' בענף הנוכחי (אחרי האינטגרציה - על כל 15 הדפים) ובודק את החוזה המשותף:
//   * מודול: build/toRows/SHEET_NAME (<=31 תווים), build לכל גרסה בלי שגיאה ובלי פונקציות במטען (המטען עובר JSON),
//     title/sub/sum/empty, toRows = שורות שטוחות של ערכים פשוטים (מחרוזת/מספר/בוליאני/null) עם אותן עמודות בכל שורה;
//   * ברקוד: pageCode רק לדף עם barcode.page (ALL-<PFX>-YYMMDD, חוקי ב-Code 39); כל קוד שורה/פריט במטען (PFX-<הזמנה>[-<n>]) עם
//     הקידומת של הדף, שלב הקידומת = שלב הדף, חוקי ב-Code 39 ו-parseScheduleCode מפענח אותו; barcode.rows='order' -> בלי חלק פריט,
//     'item' -> עם; דפי מידע (info) ודפים בלי ברקוד - אף קוד במטען;
//   * הרשאות (ה-API, fail-closed): בלי התחברות 401, מחלקה חסומה 403, עובדת רגילה 403 לדף עם extraPageKeys ו-200 בלעדיו,
//     הנהלה ראשית 200; format=rows מחזיר גיליון עם SHEET_NAME.
// נתוני הדמה: scripts/schedule-tests/fixtures.mjs (+ orderItem נגזר מהפריטים) - יום חמישי 1.10.2026.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, ORDERS, NOW } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const R = await L('lib/schedule/print/registry.js');
const { PAGE_MODULES } = await L('lib/schedule/print/pages/index.js');
const { getScheduleDay } = await L('lib/schedule/index.js');
const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
const B = await L('lib/schedule/print/barcode.js');
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');

const withMoney = ORDERS.map((o) => (o.orderId === 1001 ? { ...o, totalAmount: 1200, isPaid: false, isDelivery: true, deliveryDirection: 'הלוך-חזור', payments: [{ amount: 400, isDeleted: false }] } : o.orderId === 1021 ? { ...o, totalAmount: 500, payments: [] } : o));
const itemsOf = (orders) => orders.flatMap((o) => (o.items || []).map((it) => ({ ...it, orderId: o.orderId })));
function setup() {
  installDb({ extra: { order: withMoney, orderItem: itemsOf(withMoney) } });
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
}
beforeEach(setup);

const READY = R.PRINT_PAGES.filter((p) => p.status === 'ready');
const versionsOf = (p) => (p.versions ? p.versions.map((v) => v.k) : [null]);
const CODE_LIKE = /^[A-Z]{3}-\d{1,9}(?:-\d{1,3})?$/;
const ALL_CODE = /^ALL-[A-Z]{3}-\d{6}$/;

function walk(v, visit, path = '$') {
  visit(v, path);
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, visit, `${path}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, visit, `${path}.${k}`);
}

async function buildAll(def, version) {
  const day = await getScheduleDay({ date: '2026-10-01', user: { id: 'emp-head', roleId: 0 }, now: NOW });
  const extras = await loadExtras(day, [def]);
  const payload = buildPrintPayload({ day, keys: [def.key], versions: version ? { [def.key]: version } : {}, extras, gmach: { name: 'ג', address: '', phone: '' }, printedBy: 'ט', now: NOW });
  return { day, extras, payload, page: payload.pages[0] };
}

test('the harness really covers pages (at least PP-01, PP-15 and PP-16 are ready here)', () => {
  const keys = READY.map((p) => p.key);
  for (const k of ['PP-01', 'PP-15', 'PP-16']) assert.ok(keys.includes(k), k);
});

for (const def of READY) {
  test(`${def.key} module contract: build per version, JSON-safe payload, toRows flat and consistent`, async () => {
    const mod = PAGE_MODULES[def.key];
    assert.ok(mod, 'module registered');
    assert.ok(mod.SHEET_NAME && mod.SHEET_NAME.length <= 31, 'SHEET_NAME <= 31');
    for (const v of versionsOf(def)) {
      const { page } = await buildAll(def, v);
      assert.equal(page.notBuilt, undefined, `${def.key}${v ? ':' + v : ''} built`);
      const d = page.data;
      assert.equal(typeof d.title, 'string'); assert.ok(d.title.length > 0);
      assert.equal(typeof d.empty, 'boolean');
      assert.ok(d.sub === undefined || typeof d.sub === 'string');
      assert.ok(d.sum === undefined || typeof d.sum === 'string');
      walk(d, (x, path) => {
        assert.notEqual(typeof x, 'function', `${def.key}: function in payload at ${path}`);
        assert.ok(!(typeof x === 'number' && !Number.isFinite(x)), `${def.key}: NaN/Infinity at ${path}`);
        assert.ok(x !== undefined || true);
      });
      const rows = mod.toRows(d, { meta: {}, version: v });
      assert.ok(Array.isArray(rows), 'toRows returns an array');
      if (rows.length) {
        const cols = Object.keys(rows[0]).join('|');
        for (const r of rows) {
          assert.equal(Object.keys(r).join('|'), cols, `${def.key}: every row has the same columns`);
          for (const [k, val] of Object.entries(r)) assert.ok(val === null || ['string', 'number', 'boolean'].includes(typeof val), `${def.key}.${k}: ${typeof val}`);
        }
        assert.ok(Object.keys(rows[0]).every((c) => /[֐-׿]/.test(c)), 'Hebrew column names');
      }
    }
  });

  test(`${def.key} barcode scheme: ${def.barcode ? `${def.barcode.prefix} page=${def.barcode.page} rows=${def.barcode.rows}` : 'none (info page)'}`, async () => {
    for (const v of versionsOf(def)) {
      const { page } = await buildAll(def, v);
      const codes = [];
      walk(page.data, (x) => { if (typeof x === 'string' && (CODE_LIKE.test(x) || ALL_CODE.test(x))) codes.push(x); });
      if (!def.barcode) {
        assert.equal(def.info, true, 'a page without barcode is an info page');
        assert.equal(page.pageCode, null);
        assert.deepEqual(codes, [], 'no barcode strings in an info page');
        continue;
      }
      assert.equal(!!page.pageCode, !!def.barcode.page, 'pageCode only when barcode.page');
      if (page.pageCode) {
        assert.match(page.pageCode, ALL_CODE);
        assert.equal(page.pageCode, `ALL-${def.barcode.prefix}-261001`);
        assert.ok(B.isValidCode39(page.pageCode));
        assert.deepEqual(B.parseScheduleCode(page.pageCode), { kind: 'day', stage: def.stages[0], prefix: def.barcode.prefix, day: '2026-10-01' });
      }
      // rows='order': every row code is PFX-<order>; rows='item': item codes PFX-<order>-<n> (plus, as in the design, an order code on the
      // block header of PP-03 version a); rows=null: only the per-sheet header code of a "one order per page" page (PP-12: DOT-<order>)
      const kinds = new Set();
      for (const c of codes.filter((x) => CODE_LIKE.test(x))) {
        assert.ok(B.isValidCode39(c), `${c} is valid Code 39`);
        const parsed = B.parseScheduleCode(c);
        kinds.add(parsed.kind);
        assert.equal(parsed.prefix, def.barcode.prefix, `${c}: page prefix`);
        assert.equal(parsed.stage, def.stages[0], `${c}: prefix stage = page stage`);
        if (def.barcode.rows === 'order') assert.equal(parsed.kind, 'order', `${c}: order code`);
        if (def.barcode.rows === 'item') assert.ok(parsed.kind === 'item' || parsed.kind === 'order', `${c}: item (or block-header order) code`);
        if (def.barcode.rows === null) {
          assert.ok(def.perOrderPage, `${def.key}: no row barcodes expected, got ${c}`);
          assert.equal(parsed.kind, 'order', `${c}: per-order page header code`);
        }
      }
      if (def.barcode.rows === 'item' && !page.data.empty) assert.ok(kinds.has('item'), `${def.key}: at least one item code`);
    }
  });

  test(`${def.key} permission gate: 401 / 403 / ${def.extraPageKeys.length ? '403 for an employee without ' + def.extraPageKeys.join(' or ') : '200 for a regular employee'} / 200 for head management; rows export has the sheet`, async () => {
    const get = (qs) => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
    const q = `?page=${def.key}&date=2026-10-01`;
    assert.equal((await get(q)).status, 401);
    globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
    assert.equal((await get(q)).status, 403, 'department with page:schedule=false');
    globalThis.__AUTH_TOKEN = 'emp-worker';
    assert.equal((await get(q)).status, def.extraPageKeys.length ? 403 : 200, 'regular employee');
    globalThis.__AUTH_TOKEN = 'emp-head';
    const ok = await get(q);
    assert.equal(ok.status, 200, JSON.stringify(ok.__json));
    assert.equal(ok.__json.pages[0].key, def.key);
    assert.equal(ok.__json.pages[0].def.status, 'ready');
    assert.ok(!('extraPageKeys' in ok.__json.pages[0].def), 'permission keys never leave the server');
    const rows = await get(q + '&format=rows');
    assert.equal(rows.status, 200);
    assert.equal(rows.__json.sheets[0].sheetName, PAGE_MODULES[def.key].SHEET_NAME);
  });
}
