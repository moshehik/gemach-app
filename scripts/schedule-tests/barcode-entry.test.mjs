// ברקוד בלו״ז - הלוגיקה הטהורה (lib/schedule/barcodeEntry.js + lib/rentalItemMatch.js + settings.js): הגדרות, ערך אפקטיבי, מטריצת החסימה בכל תא,
// "נדרש להיסרק", ברקוד לא תקין, וכן שוויון התנהגות של התאמת הפריטים החדשה מול הקוד המקורי של rentals/scan על קלטים רבים.
// docs/schedule-barcode-plan.md ב'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const E = await L('lib/schedule/barcodeEntry.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const M = await L('lib/rentalItemMatch.js');

const item = (over = {}) => ({ id: 'i' + Math.random().toString(36).slice(2, 7), barcodePrefix: 123, sizeText: '38', barcode: null, isTaken: false, takenDate: null, isDeleted: false, ...over });
const DELIVERY = { isDelivery: true, deliveryDirection: 'הלוך' };
const LOCAL = { isDelivery: false, deliveryDirection: null };

test('normalizeWhen: only prep / pickup enable the feature, everything else is off', () => {
  assert.equal(E.normalizeWhen('prep'), 'prep');
  assert.equal(E.normalizeWhen(' PICKUP '), 'pickup');
  for (const v of [undefined, null, '', 'off', 'true', 'yes', 'both', 0, 'הכנה']) assert.equal(E.normalizeWhen(v), 'off', String(v));
});

test('settings: missing rows = off for both kinds (default = behaviour of today), prep without a prep stage becomes pickup', () => {
  const none = resolveScheduleSettings({});
  assert.deepEqual(none.barcode, { delivery: 'off', local: 'off' });
  assert.equal(E.isFeatureOn(none.barcode), false);

  const on = resolveScheduleSettings({ enable_deliveries: 'true', barcode_entry_when_delivery: 'prep', barcode_entry_when_local_pickup: 'pickup' });
  assert.deepEqual(on.barcode, { delivery: 'prep', local: 'pickup' });

  // no prep stage => prep entry makes no sense => pickup
  const noPrep = resolveScheduleSettings({ enable_deliveries: 'true', schedule_stage_prep_enabled: 'false', barcode_entry_when_delivery: 'prep', barcode_entry_when_local_pickup: 'prep' });
  assert.deepEqual(noPrep.barcode, { delivery: 'pickup', local: 'pickup' });

  // deliveries switched off (the main gemach): the delivery setting is irrelevant
  const noDeliveries = resolveScheduleSettings({ barcode_entry_when_delivery: 'prep', barcode_entry_when_local_pickup: 'prep' });
  assert.deepEqual(noDeliveries.barcode, { delivery: 'off', local: 'prep' });

  // garbage values are off
  assert.deepEqual(resolveScheduleSettings({ barcode_entry_when_local_pickup: 'maybe' }).barcode, { delivery: 'off', local: 'off' });
});

test('orderKind follows isDeliveryOut: a return-only delivery is a local pickup for the outbound leg', () => {
  assert.equal(E.orderKind(DELIVERY), 'delivery');
  assert.equal(E.orderKind({ isDelivery: true, deliveryDirection: null }), 'delivery'); // null = הלוך-חזור
  assert.equal(E.orderKind({ isDelivery: true, deliveryDirection: 'הלוך-חזור' }), 'delivery');
  assert.equal(E.orderKind({ isDelivery: true, deliveryDirection: 'חזור' }), 'local');
  assert.equal(E.orderKind(LOCAL), 'local');
  assert.equal(E.orderKind(null), 'local');
});

test('gate matrix: every cell [kind x when x stage]', () => {
  // [kind, when, stage] -> expected gate type
  const cells = [
    ['local', 'off', 'prep', 'none'], ['local', 'off', 'pick', 'none'], ['local', 'off', 'dout', 'none'],
    ['local', 'prep', 'prep', 'register'], ['local', 'prep', 'pick', 'handover'], ['local', 'prep', 'dout', 'none'],
    ['local', 'pickup', 'prep', 'none'], ['local', 'pickup', 'pick', 'handover'], ['local', 'pickup', 'dout', 'none'],
    ['delivery', 'off', 'prep', 'none'], ['delivery', 'off', 'pick', 'none'], ['delivery', 'off', 'dout', 'none'],
    ['delivery', 'prep', 'prep', 'register'], ['delivery', 'prep', 'pick', 'none'], ['delivery', 'prep', 'dout', 'handover'],
    ['delivery', 'pickup', 'prep', 'none'], ['delivery', 'pickup', 'pick', 'none'], ['delivery', 'pickup', 'dout', 'handover'],
  ];
  for (const [kind, when, stage, expected] of cells) assert.equal(E.gateTypeFor(stage, kind, when), expected, `${kind}/${when}/${stage}`);
  // stages that never carry a barcode gate
  for (const stage of ['repair', 'manret', 'dback', 'order', 'event']) {
    for (const when of ['prep', 'pickup']) assert.equal(E.gateTypeFor(stage, 'local', when), 'none', stage);
  }
});

test('itemNeedsBarcode: model identity from the dress, the dress item or the order item; no identity = exempt', () => {
  assert.equal(E.itemNeedsBarcode(item()), true);
  assert.equal(E.itemNeedsBarcode(item({ barcodePrefix: null })), false);
  assert.equal(E.itemNeedsBarcode(item({ barcodePrefix: null, dressItem: { barcodePrefix: 7 } })), true);
  assert.equal(E.itemNeedsBarcode(item({ barcodePrefix: null, dressItem: { dress: { barcodePrefix: 9 } } })), true);
  assert.equal(E.itemNeedsBarcode(item({ barcodePrefix: '' })), false);
});

test('summarizeItems: registered / taken / missing, exempt items, deleted items, taken-without-barcode counts as satisfied', () => {
  const s = E.summarizeItems([
    item({ barcode: '1230301' }),                    // registered
    item({ barcode: '1230302', isTaken: true }),     // registered + taken
    item({ isTaken: true }),                         // taken without barcode (legacy) => satisfied
    item(),                                          // missing
    item({ barcodePrefix: null }),                   // exempt
    item({ isDeleted: true }),                       // ignored
  ]);
  assert.equal(s.total, 5);
  assert.equal(s.required, 4);
  assert.equal(s.registered, 2);
  assert.equal(s.taken, 2);
  assert.equal(s.satisfied, 3);
  assert.equal(s.missing.length, 1);
  assert.equal(s.complete, false);
  assert.equal(s.allTaken, false);
  assert.equal(s.requiredAllTaken, false);

  const done = E.summarizeItems([item({ barcode: '1230301', isTaken: true }), item({ barcodePrefix: null })]);
  assert.equal(done.complete, true);
  assert.equal(done.requiredAllTaken, true);
  assert.equal(done.allTaken, false, 'the exempt item is not taken yet => the order is not fully taken');

  const none = E.summarizeItems([]);
  assert.equal(none.complete, true);
  assert.equal(none.allTaken, false);
});

test('an "invalid barcode" flagged item is NOT registered until management handled it', () => {
  const bad = item({ barcode: '9999999', barcodeInvalid: true, barcodeInvalidHandled: false });
  const handled = item({ barcode: '9999999', barcodeInvalid: true, barcodeInvalidHandled: true });
  assert.equal(E.itemIsRegistered(bad), false);
  assert.equal(E.itemIsRegistered(handled), true);
  assert.equal(E.summarizeItems([bad]).missing.length, 1);
  assert.equal(E.summarizeItems([handled]).missing.length, 0);
});

test('evaluateGate: ok only when every required item has a barcode; "off" never blocks; info is null when the gate does not apply', () => {
  const eff = { delivery: 'prep', local: 'pickup' };
  const two = [item({ barcode: '1230301' }), item()];
  // local + pickup: prep is not gated, pick is
  assert.equal(E.evaluateGate({ stageKey: 'prep', order: LOCAL, items: two, eff }).applies, false);
  const pick = E.evaluateGate({ stageKey: 'pick', order: LOCAL, items: two, eff });
  assert.equal(pick.applies, true);
  assert.equal(pick.gate, 'handover');
  assert.equal(pick.ok, false);
  assert.equal(pick.missing.length, 1);
  // delivery + prep: prep gated (register), dout gated (handover)
  assert.equal(E.evaluateGate({ stageKey: 'prep', order: DELIVERY, items: two, eff }).gate, 'register');
  assert.equal(E.evaluateGate({ stageKey: 'dout', order: DELIVERY, items: two, eff }).gate, 'handover');
  const full = [item({ barcode: '1230301' }), item({ barcode: '1230302' })];
  assert.equal(E.evaluateGate({ stageKey: 'prep', order: DELIVERY, items: full, eff }).ok, true);
  assert.equal(E.rowBarcodeInfo({ stageKey: 'prep', order: LOCAL, items: two, eff }), null, 'no info => the row is identical to today');
  const info = E.rowBarcodeInfo({ stageKey: 'prep', order: DELIVERY, items: two, eff });
  assert.deepEqual(info, { gate: 'register', when: 'prep', required: 2, registered: 1, taken: 0, missing: 1, complete: false, allRequiredTaken: false });
  // feature off for the kind
  assert.equal(E.evaluateGate({ stageKey: 'pick', order: LOCAL, items: two, eff: { delivery: 'off', local: 'off' } }).ok, true);
  assert.equal(E.rowBarcodeInfo({ stageKey: 'pick', order: LOCAL, items: two, eff: { delivery: 'off', local: 'off' } }), null);
});

test('normalizeScannedBarcode strips invisible direction marks and spaces; format is digits only, 5+', () => {
  assert.equal(E.normalizeScannedBarcode('‏ 1750301‎\n'), '1750301');
  assert.equal(E.normalizeScannedBarcode(null), '');
  assert.equal(E.isDressBarcodeFormat('1750301'), true);
  assert.equal(E.isDressBarcodeFormat('41807'), true);
  assert.equal(E.isDressBarcodeFormat('1234'), false);
  assert.equal(E.isDressBarcodeFormat('PRP-123'), false);
  assert.equal(E.isDressBarcodeFormat(''), false);
});

// ---- התאמת פריטים: שוויון מול הקוד המקורי של rentals/scan (העתק מילולי של הפילטר הישן) -------------------------------------------------------

function legacyMatch(potentialItems, barcode) {
  const prefixStr = barcode.substring(0, barcode.length - 4);
  const sizeStr = barcode.substring(barcode.length - 4, barcode.length - 2);
  const barcodePrefix = parseInt(prefixStr);
  const sizeVal = parseInt(sizeStr);
  return potentialItems.filter((it) => {
    const pfx = it.dressItem?.dress?.barcodePrefix || it.dressItem?.barcodePrefix || it.barcodePrefix;
    const sz = it.dressItem?.sizeText || it.sizeText || '';
    return pfx === barcodePrefix && parseInt(sz) === sizeVal;
  });
}
const legacyDup = (matching) => matching.some((it) => it.neckAlteration !== matching[0].neckAlteration || it.lengthAlteration !== matching[0].lengthAlteration || it.sleeveAlteration !== matching[0].sleeveAlteration);

test('rentalItemMatch is behaviour-identical to the old inline code of rentals/scan (randomised, 20000 cases)', () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const prefixes = [123, 123, 175, 175, 555, 4, 12, 1, null, undefined, '175', 0];
  const sizes = ['03', '03', '3', '38', '18', '40', 'כללי', '', null, undefined, '38.5'];
  const barcodes = ['1750301', '1230301', '1233801', '41807', '5550301', '12345', 'ABC1234', '', '0000000', '1750400', '3801', '17503'];
  let nonEmpty = 0;
  for (let n = 0; n < 20000; n++) {
    const items = Array.from({ length: 1 + rnd(4) }, () => ({
      id: 'x' + rnd(1e6),
      barcodePrefix: prefixes[rnd(prefixes.length)],
      sizeText: sizes[rnd(sizes.length)],
      dressItem: rnd(3) === 0 ? { barcodePrefix: prefixes[rnd(prefixes.length)], sizeText: sizes[rnd(sizes.length)], dress: rnd(2) ? { barcodePrefix: prefixes[rnd(prefixes.length)] } : null } : null,
      neckAlteration: rnd(2), lengthAlteration: rnd(2) ? '3' : null, sleeveAlteration: rnd(2),
    }));
    const bc = barcodes[rnd(barcodes.length)];
    const a = M.filterItemsForBarcode(items, bc).map((i) => i.id);
    const b = legacyMatch(items, bc).map((i) => i.id);
    assert.deepEqual(a, b, JSON.stringify({ items, bc }));
    assert.equal(M.matchesDifferInAlterations(M.filterItemsForBarcode(items, bc)), a.length > 1 ? legacyDup(legacyMatch(items, bc)) : false);
    if (a.length) nonEmpty++;
  }
  assert.ok(nonEmpty > 200, 'the generator produced enough matching cases to mean something (' + nonEmpty + ')');
});
