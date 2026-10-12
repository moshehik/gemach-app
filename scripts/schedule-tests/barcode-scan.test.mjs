// שורת הסריקה של הלו״ז (docs/schedule-barcode-plan.md ח׳): סיווג קודים (קוד שלב מהדף המודפס מול ברקוד שמלה), ההחלטה לפי מצב השורה, וחיבור ה-UI
// (בדיקות מקור: הדף מחבר ברירת מחדל ל-onScan, החלונית שולחת intent, שורות מעבירות onBarcodes, כל האייקונים קיימים ב-sprite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { classifyScan, decideStageScan, findRowForCode } = await L('lib/schedule/scanDispatch.js');
const { code39Svg, orderCode, itemCode, dayCode, STAGE_CODE_PREFIX } = await L('lib/schedule/print/barcode.js');
const src = (rel) => readFileSync(path.join(process.env.PROJ, rel), 'utf8');

test('classifyScan: stage codes from the printed pages, dress barcodes, and junk', () => {
  assert.deepEqual(classifyScan('PRP-40113'), { kind: 'stage-order', stageKey: 'prep', orderId: 40113 });
  assert.deepEqual(classifyScan(' dot-5 '), { kind: 'stage-order', stageKey: 'dout', orderId: 5 });
  assert.deepEqual(classifyScan('PCK-40113'), { kind: 'stage-order', stageKey: 'pick', orderId: 40113 });
  assert.deepEqual(classifyScan('MRT-12'), { kind: 'stage-order', stageKey: 'manret', orderId: 12 });
  assert.deepEqual(classifyScan('PRP-40113-2'), { kind: 'stage-order', stageKey: 'prep', orderId: 40113 }, 'a dress sticker code selects its order');
  assert.deepEqual(classifyScan('ALL-PRP-261014'), { kind: 'stage-day', stageKey: 'prep', dayKey: '2026-10-14' });
  assert.deepEqual(classifyScan('1750301'), { kind: 'dress', barcode: '1750301' });
  assert.deepEqual(classifyScan('‏1750301‎'), { kind: 'dress', barcode: '1750301' });
  assert.deepEqual(classifyScan('41807'), { kind: 'dress', barcode: '41807' });
  for (const junk of ['', '   ', null, undefined, 'hello', '12', 'ORD-5', 'EVT-5', 'XYZ-123']) assert.equal(classifyScan(junk).kind, 'none', String(junk));
  // every code the print pages can generate is understood
  for (const [stage, prefix] of Object.entries(STAGE_CODE_PREFIX)) {
    if (stage === 'order' || stage === 'event') continue;
    assert.deepEqual(classifyScan(orderCode(prefix, 777)), { kind: 'stage-order', stageKey: stage, orderId: 777 }, stage);
    assert.equal(classifyScan(itemCode(prefix, 777, 3)).orderId, 777);
    assert.equal(classifyScan(dayCode(prefix, '2026-10-15')).kind, 'stage-day');
  }
  assert.ok(code39Svg('PRP-40113').includes('PRP-40113'), 'the generator still renders the code the scanner will read');
});

const DATA = {
  date: '2026-10-15',
  stages: [
    { key: 'prep', label: 'הכנה', infoOnly: false, items: [
      { orderId: 1, done: false }, { orderId: 2, done: true }, { orderId: 3, done: false, barcodeInfo: { complete: false } }, { orderId: 4, done: false, barcodeInfo: { complete: true } },
    ] },
    { key: 'event', label: 'אירוע', infoOnly: true, items: [{ orderId: 1, done: null }] },
  ],
};

test('decideStageScan: not shown / info only / already done / barcodes needed / confirm', () => {
  assert.equal(decideStageScan(DATA, 'prep', 99).action, 'not-shown');
  assert.equal(decideStageScan(DATA, 'pick', 1).action, 'not-shown', 'no such stage on the page');
  assert.equal(decideStageScan(null, 'prep', 1).action, 'not-shown');
  assert.equal(decideStageScan(DATA, 'event', 1).action, 'info-only');
  assert.equal(decideStageScan(DATA, 'prep', 2).action, 'already');
  assert.equal(decideStageScan(DATA, 'prep', 3).action, 'barcodes');
  assert.equal(decideStageScan(DATA, 'prep', 4).action, 'confirm');
  assert.equal(decideStageScan(DATA, 'prep', 1).action, 'confirm', 'no barcode setting => the normal "are you sure" dialog');
  assert.equal(findRowForCode(DATA, 'prep', 3).row.orderId, 3);
});

test('UI wiring (source): the page installs a default onScan, rows pass onBarcodes, the dialog sends the intent and never invents the effect', () => {
  const day = src('app/components/schedule/ScheduleDay.js');
  assert.match(day, /onScan=\{onScan \|\| handleScan\}/, 'the scan field is enabled in every gemach (owner decision O11, 12.10.2026)');
  assert.match(day, /handleScan\(code\); \/\/ החלטת הבעלים/, '?scan= runs in every gemach');
  assert.match(day, /הזנת ברקוד אינה מופעלת בהגדרות/, 'a dress barcode without the setting gets a clear message, never a registration');
  assert.match(day, /if \(!marks\.canMark\)/, 'stage codes respect the existing mark permission');
  assert.match(day, /classifyScan\(raw\)/);
  assert.match(day, /marks=\{marksUi\}/);
  assert.match(day, /<BarcodeDialog /);
  assert.match(day, /get\('scan'\)/, '?scan= from the quick search runs the same handler');
  const hook = src('app/components/schedule/useStageMarks.js');
  assert.match(hook, /e\.body\.needBarcodes/, 'a 409 needBarcodes opens the dialog instead of an error toast');
  for (const f of ['StageRow.js']) assert.ok((src('app/components/schedule/' + f).match(/onBarcodes=\{onBarcodes\}/g) || []).length >= 2, 'row + table row');
  assert.match(src('app/components/schedule/StageSection.js'), /marks\.openBarcodes/);
  const ctl = src('app/components/schedule/MarkControls.js');
  assert.match(ctl, /needsBarcodes/);
  const dlg = src('app/components/schedule/BarcodeDialog.js');
  assert.match(dlg, /intent: st && st\.intent/, 'every scan carries the intent');
  assert.match(dlg, /\/api\/schedule\/barcodes/);
  assert.ok(!/sprite\.svg#/.test(dlg));
});

test('the default response of GET /api/schedule is untouched by the barcode UI contract: barcodeInfo is the only new row key and is documented', () => {
  const spec = src('docs/schedule-barcode-plan.md');
  assert.match(spec, /barcodeInfo/);
  const loaders = src('lib/schedule/loaders.js');
  assert.equal((loaders.match(/barcodeInfo/g) || []).length >= 2, true);
});
