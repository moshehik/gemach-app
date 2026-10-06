// "בוצע (משוער)" - הצד של כרטיס ההזמנה אחרי סקירת 2026-10-06: (1) השיקוף המקומי בלקיחה נשלט באותה הגדרה כמו השרת (auto_alteration_done_on_take === 'true', ברירת מחדל כבוי);
// (2) סמן בלבד (בלי פירוט שהוזן) לא עומד בבדיקת "פירוט תיקון חובה" (validateRepairs ובדיקות ההוספה / האישור ב-useItemActions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fakeServer } from './items.legacy.mjs';

const PROJ = process.env.PROJ;
const read = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').split('\r\n').join('\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const P = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const E = await P('lib/alterationEstimate.js');
const A = await P('app/components/order-card/hooks/useItemActions.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const clone = (x) => JSON.parse(JSON.stringify(x));
const ORDER = { orderId: 53375, eventDate: '2026-10-20T21:00:00.000Z', orderDate: '2026-09-23T07:12:00.000Z' };
const di = { id: 'di-1', dressModelId: 'm-1', barcodePrefix: 45, sizeText: '38', dress: { id: 'm-1', name: '4512', barcodePrefix: 45 } };
const NECK = { id: 'a1', dressItem: di, sizeText: '38', price: 150, finalPrice: 150, isDeleted: false, isTaken: false, isReturned: false, neckAlteration: 1, alterationDone: false, alterationDetails: 'להצר' };

function mine({ items, settings = [], status = 200 }) {
  const srv = fakeServer(() => ({ status, body: status === 200 ? { success: true } : { error: 'x' } }));
  const state = { items: clone(items) };
  const env = {
    fetch: srv.fetch,
    ui: { toast: () => {}, confirm: async () => true, prompt: async () => null },
    approve: async () => null,
    get: () => ({ order: ORDER, items: state.items, settings: L.parseSettings(settings), isLocked: false, routeId: '53375', forceEditableIds: new Set(), sessionEditableIds: new Set(), priceList: [] }),
    syncItems: (fn) => { state.items = fn(state.items); },
    addLocalItem: () => {}, removeLocalItem: () => {}, markItemDeleted: () => {}, setAltDone: () => {}, applyServerOrder: () => {}, markForceEditable: () => {},
    chooseItem: async () => null, bumpHistory: () => {},
  };
  return { act: A.createItemActions(env), state };
}
const ON = [{ key: 'auto_alteration_done_on_take', value: 'true' }];

test('parseSettings: autoAlterationDoneOnTake - רק "true"; חסר / false / TRUE / 1 = כבוי (ברירת מחדל כבוי)', () => {
  assert.equal(L.parseSettings([]).autoAlterationDoneOnTake, false);
  for (const v of ['false', 'TRUE', '1', '', 'yes']) assert.equal(L.parseSettings([{ key: 'auto_alteration_done_on_take', value: v }]).autoAlterationDoneOnTake, false, v);
  assert.equal(L.parseSettings(ON).autoAlterationDoneOnTake, true);
  assert.equal(A.autoAlterationOnTake(L.parseSettings([])), false);
  assert.equal(A.autoAlterationOnTake(L.parseSettings(ON)), true);
  assert.equal(A.autoAlterationOnTake(null), false);
  assert.equal(A.autoAlterationOnTake({}), false);
});

test('לקיחה בכרטיס: ההגדרה כבויה = אין שיקוף מקומי (alterationDone נשאר false); דולקת = בוצע (משוער) מקומי; כישלון שרת מחזיר לאחור', async () => {
  const off = mine({ items: [NECK] });
  assert.equal((await off.act.rentItem(off.state.items[0], '4538010')).ok, true);
  assert.equal(off.state.items[0].isTaken, true);
  assert.equal(off.state.items[0].alterationDone, false);
  assert.equal(off.state.items[0].alterationDetails, 'להצר');

  const on = mine({ items: [NECK], settings: ON });
  assert.equal((await on.act.rentItem(on.state.items[0], '4538010')).ok, true);
  assert.equal(on.state.items[0].alterationDone, true);
  assert.equal(on.state.items[0].alterationDetails, `להצר\n${E.ESTIMATE_NOTE}`);
  assert.ok(E.isAlterationEstimated(on.state.items[0]));

  const failed = mine({ items: [NECK], settings: ON, status: 500 });
  assert.equal((await failed.act.rentItem(failed.state.items[0], '4538010')).ok, false);
  assert.equal(failed.state.items[0].isTaken, false);
  assert.equal(failed.state.items[0].alterationDone, false);
  assert.equal(failed.state.items[0].alterationDetails, 'להצר');
});

test('פירוט חובה: סמן "בוצע (משוער)" בלבד לא נחשב פירוט (validateRepairs + בדיקות האישור / ההוספה); פירוט אדם + סמן עובר', () => {
  const base = { neckAlteration: 1, isDeleted: false };
  assert.ok(L.validateRepairs([{ ...base, alterationDetails: E.ESTIMATE_NOTE }]), 'סמן בלבד = שגיאה');
  assert.ok(L.validateRepairs([{ ...base, alterationDetails: `  \n${E.ESTIMATE_NOTE}` }]));
  assert.ok(L.validateRepairs([{ ...base, alterationDetails: '' }]));
  assert.ok(L.validateRepairs([{ ...base, alterationDetails: null }]));
  assert.equal(L.validateRepairs([{ ...base, alterationDetails: `להצר\n${E.ESTIMATE_NOTE}` }]), null, 'פירוט אדם + סמן עובר');
  assert.equal(L.validateRepairs([{ ...base, alterationDetails: E.ESTIMATE_NOTE, isDeleted: true }]), null, 'פריט מחוק לא נבדק');
  assert.equal(L.validateRepairs([{ neckAlteration: 0, alterationDetails: E.ESTIMATE_NOTE }]), null, 'בלי תיקון לא נדרש פירוט');
  const act = strip(read('app/components/order-card/hooks/useItemActions.js'));
  assert.match(act, /hasRepair && detailsWithoutMarker\(item\.alterationDetails\)\.trim\(\) === ''/);
  assert.match(act, /hasRepair && detailsWithoutMarker\(newItem\.alterationDetails\)\.trim\(\) === ''/);
  assert.ok(!/!item\.alterationDetails \|\| item\.alterationDetails\.trim\(\) === ''/.test(act));
  assert.match(strip(read('app/components/order-card/orderCardLogic.js')), /hasRepair && detailsWithoutMarker\(item\.alterationDetails\)\.trim\(\) === ''/);
});

test('הגדרה רשומה במטא-דאטה בסגנון השכנות: שם + הסבר בעברית, בוליאני, ברירת מחדל כבוי; סקריפט seed (dry-run) קיים ולא מורץ אוטומטית', async () => {
  const M = await P('lib/settingsMetadata.js');
  const K = 'auto_alteration_done_on_take';
  assert.match(M.SETTINGS_HEBREW_NAMES[K], /[֐-׿]/);
  assert.match(M.SETTINGS_HEBREW_NOTES[K], /כבוי \/ חסר/);
  assert.ok(M.SETTINGS_BOOLEAN_KEYS.includes(K));
  assert.ok(M.SETTINGS_ORDER['הזמנות'].includes(K));
  const seed = read('scripts/seed_auto_alteration_done_on_take_setting.js');
  assert.match(seed, /key: 'auto_alteration_done_on_take'/);
  assert.match(seed, /targets: \{ 1: \{ value: 'false', overwrite: false \}, 2: \{ value: 'false', overwrite: false \} \}/);
  assert.match(read('lib/settingsSimLayout.js'), /'enable_alterations', 'auto_alteration_done_on_take'/);
});
