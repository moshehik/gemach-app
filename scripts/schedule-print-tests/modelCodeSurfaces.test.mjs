// כלל תצוגת הדגם (שם ריק / שווה למספר / "דגם N" -> המספר פעם אחת; שם תיאורי שונה -> "שם (מספר)") במשטחים שמעבר לדפי ההכנה (12.10.2026):
// PP-16 (lib/schedule/print/extras/manretDetail.js) מול נתוני הדמה + בדיקות מבנה לבורר הדגם (noCapacityLogic, CapacitySearchModal), כרטיס ההזמנה
// (useItemActions.labelOf, ocDocsLogic) ו-helpers הטהורים (modelNameWithParenCode, collapseSameCodeLabel).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installDb, ORDERS, NOW } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const read = (p) => fs.readFileSync(path.join(process.env.PROJ, p), 'utf8').replace(/\r\n/g, '\n');
const { loadManretDetail } = await L('lib/schedule/print/extras/manretDetail.js');
const { getScheduleDay } = await L('lib/schedule/index.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { modelNameWithParenCode, collapseSameCodeLabel } = await L('lib/modelCodeLabel.js');

const itemsOf = (orders) => orders.flatMap((o) => (o.items || []).map((it) => ({ ...it, orderId: o.orderId })));
function setupWithDress(dress) {
  const orders = structuredClone(ORDERS);
  const o = orders.find((x) => x.orderId === 1013); // returns on 15.10, one item, barcodePrefix 123
  o.items[0].dressItem = { location: 'מדף', inRepair: false, sizeText: '38', dress };
  installDb({ extra: { order: orders, orderItem: itemsOf(orders) } });
  invalidateSettingsCache();
}
async function modelOf1013() {
  const day = await getScheduleDay({ date: '2026-10-15', user: { id: 'emp-head', roleId: 0 }, now: NOW });
  const x = await loadManretDetail(day);
  return x.items[1013][0].model;
}
beforeEach(() => invalidateSettingsCache());

test('PP-16: model name equal to the number prints the number once; "דגם N" too; a real name stays "name - number"', async () => {
  setupWithDress({ name: '123', barcodePrefix: 123 });
  assert.equal(await modelOf1013(), '123');
  setupWithDress({ name: 'דגם 123', barcodePrefix: 123 });
  assert.equal(await modelOf1013(), '123');
  setupWithDress({ name: 'ורד', barcodePrefix: 123 });
  assert.equal(await modelOf1013(), 'ורד - 123');
});

test('modelNameWithParenCode: same -> once, real name -> "name (code)", empty name -> code, empty code -> name', () => {
  assert.equal(modelNameWithParenCode('522', 522), '522');
  assert.equal(modelNameWithParenCode(' 522', '0522'), '0522', 'the stored code, once');
  assert.equal(modelNameWithParenCode('דגם 522', 522), '522');
  assert.equal(modelNameWithParenCode('אבן חרוזים', 440), 'אבן חרוזים (440)');
  assert.equal(modelNameWithParenCode(null, 440), '440');
  assert.equal(modelNameWithParenCode('אבן', ''), 'אבן');
  assert.equal(modelNameWithParenCode(null, null), '');
});

test('collapseSameCodeLabel: only the name=number case changes ("קוד:" kept otherwise, unlike stripCodeLabel)', () => {
  assert.equal(collapseSameCodeLabel('522 (קוד: 522)'), '522');
  assert.equal(collapseSameCodeLabel('522 (קוד: 522) - קיצור'), '522 - קיצור');
  assert.equal(collapseSameCodeLabel('אבן חרוזים (קוד: 440)'), 'אבן חרוזים (קוד: 440)');
  assert.equal(collapseSameCodeLabel('שמלה'), 'שמלה');
  assert.equal(collapseSameCodeLabel(null), '');
});

test('structure: capacity search (new-order + modal), order card cancel label and order docs use the shared helpers', () => {
  const nc = read('app/components/new-order/noCapacityLogic.js');
  assert.match(nc, /modelNameWithParenCode\(m\.name, m\.barcodePrefix\)/);
  assert.doesNotMatch(nc, /`\$\{m\.name\} \(\$\{m\.barcodePrefix\}\)`/);
  const cm = read('components/CapacitySearchModal.js');
  assert.equal((cm.match(/modelNameWithParenCode\(/g) || []).length, 3, 'two setModelQuery + selectedDisplay');
  assert.doesNotMatch(cm, /\$\{m\.name\} \(\$\{m\.barcodePrefix\}\)/);
  assert.match(cm, /!isSameModelCode\(m\.name, m\.barcodePrefix\) && <span className="meta">/);
  assert.match(read('app/components/order-card/hooks/useItemActions.js'), /itemCode\(item\) && !isSameModelCode\(itemName\(item\), itemCode\(item\)\)/);
  assert.match(read('app/components/order-card/parts/ocDocsLogic.js'), /collapseSameCodeLabel\(/);
});
