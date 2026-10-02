// רשימת 15 דפי ההדפסה: מפתחות יציבים, בלי 05/06/14/17, גרסאות לפי החלטות PQ-04/PQ-05, ברקוד רק לדפי "בוצע",
// ופענוח פרמטרי הכתובת (page, version).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const R = await L('lib/schedule/print/registry.js');
const { PAGE_MODULES } = await L('lib/schedule/print/pages/index.js');
const { STAGE_KEYS } = await L('lib/schedule/stages.js');

test('exactly the 15 pages the owner approved, stable PP-xx keys, 14/17 removed, 05/06 never existed', () => {
  assert.equal(R.PRINT_PAGES.length, 15);
  assert.deepEqual(R.PRINT_PAGE_KEYS, ['PP-01', 'PP-02', 'PP-03', 'PP-04', 'PP-07', 'PP-08', 'PP-09', 'PP-10', 'PP-11', 'PP-12', 'PP-13', 'PP-15', 'PP-16', 'PP-18', 'PP-19']);
  for (const k of ['PP-05', 'PP-06', 'PP-14', 'PP-17']) assert.equal(R.getPrintPage(k), null, k);
  assert.ok(R.REMOVED_PAGE_KEYS['PP-14'] && R.REMOVED_PAGE_KEYS['PP-17']);
});

test('every page feeds from existing schedule stages and has the required fields', () => {
  for (const p of R.PRINT_PAGES) {
    assert.match(p.key, /^PP-\d{2}$/);
    assert.equal(p.key, 'PP-' + p.num);
    assert.ok(p.label && p.chip && p.desc, p.key);
    assert.ok(p.stages.length >= 1, p.key);
    for (const s of p.stages) assert.ok(STAGE_KEYS.includes(s), `${p.key} stage ${s}`);
    assert.equal(p.orientation, 'portrait', p.key);
    assert.ok(Array.isArray(p.extraPageKeys), p.key);
    assert.ok(['ready', 'todo'].includes(p.status), p.key);
    assert.deepEqual(R.publicPageInfo(p).key, p.key);
    assert.equal('extraPageKeys' in R.publicPageInfo(p), false, 'permission keys never leave the server');
  }
});

test('barcode prefixes match the stage scheme', async () => {
  const { STAGE_CODE_PREFIX } = await L('lib/schedule/print/barcode.js');
  for (const p of R.PRINT_PAGES) {
    if (p.info) { assert.equal(p.barcode, null, p.key); continue; }
    assert.equal(p.barcode.prefix, STAGE_CODE_PREFIX[p.stages[0]], p.key);
  }
  assert.equal(R.getPrintPage('PP-16').barcode.prefix, 'MRT');
  assert.equal(R.getPrintPage('PP-13').barcode.prefix, 'PCK');
  assert.equal(R.getPrintPage('PP-12').barcode.rows, null, 'delivery note: header barcode only (PP-12 decision)');
});

test('versions: only 03 (א/ב by model+size) and 07 (א/ב one order per page); 12 is always one order per page', () => {
  const withVersions = R.PRINT_PAGES.filter((p) => p.versions).map((p) => p.key);
  assert.deepEqual(withVersions, ['PP-03', 'PP-07']);
  assert.equal(R.defaultVersion(R.getPrintPage('PP-03')), 'a');
  assert.equal(R.isPerOrderPage(R.getPrintPage('PP-07'), 'a'), false);
  assert.equal(R.isPerOrderPage(R.getPrintPage('PP-07'), 'b'), true);
  assert.equal(R.isPerOrderPage(R.getPrintPage('PP-12'), null), true);
  assert.equal(R.isPerOrderPage(R.getPrintPage('PP-15'), null), false);
});

test('money / delivery / alterations pages need the same extra page permission as the existing print surfaces', async () => {
  const PA = await L('lib/printAccess.js');
  for (const k of ['PP-01', 'PP-02', 'PP-13']) assert.deepEqual(R.getPrintPage(k).extraPageKeys, PA.PRINT_ORDER_PAGE_KEYS, k);
  for (const k of ['PP-10', 'PP-11', 'PP-12', 'PP-18', 'PP-19']) assert.deepEqual(R.getPrintPage(k).extraPageKeys, PA.PRINT_DELIVERIES_PAGE_KEYS, k);
  for (const k of ['PP-03', 'PP-04']) assert.deepEqual(R.getPrintPage(k).extraPageKeys, PA.PRINT_ALTERATIONS_PAGE_KEYS, k);
  for (const k of ['PP-07', 'PP-08', 'PP-09', 'PP-15', 'PP-16']) assert.deepEqual(R.getPrintPage(k).extraPageKeys, [], k);
});

test('status "ready" <=> a page module exists (pages/index.js)', () => {
  for (const p of R.PRINT_PAGES) {
    assert.equal(p.status === 'ready', !!PAGE_MODULES[p.key], `${p.key}: status=${p.status}, module=${!!PAGE_MODULES[p.key]}`);
  }
  for (const [k, m] of Object.entries(PAGE_MODULES)) {
    assert.equal(typeof m.build, 'function', k);
    assert.equal(typeof m.toRows, 'function', k);
    assert.ok(m.SHEET_NAME && m.SHEET_NAME.length <= 31, k);
  }
});

test('parsePageList / parseVersions / versionsParam', () => {
  assert.deepEqual(R.parsePageList('PP-01,PP-15,pp-01'), { keys: ['PP-01', 'PP-15'], bad: [], removed: [] });
  assert.deepEqual(R.parsePageList('PP-01+PP-14'), { keys: ['PP-01'], bad: [], removed: ['PP-14'] });
  assert.deepEqual(R.parsePageList('foo'), { keys: [], bad: ['foo'], removed: [] });
  assert.deepEqual(R.parsePageList(''), { keys: [], bad: [], removed: [] });
  assert.deepEqual(R.parseVersions('b', ['PP-03']), { 'PP-03': 'b' });
  assert.deepEqual(R.parseVersions('b', ['PP-15']), {}, 'a page without versions ignores a bare version');
  assert.deepEqual(R.parseVersions('PP-03:b,PP-07:a,PP-15:b,PP-03:zz', ['PP-03', 'PP-07', 'PP-15']), { 'PP-03': 'b', 'PP-07': 'a' });
  assert.equal(R.versionsParam({ 'PP-03': 'b', 'PP-07': 'a', 'PP-99': 'b' }), 'PP-03:b,PP-07:a');
  assert.deepEqual(R.pagesForStage('dout').map((p) => p.key), ['PP-10', 'PP-11', 'PP-12']);
});
