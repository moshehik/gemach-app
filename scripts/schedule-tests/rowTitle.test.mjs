// כותרת שורת הלו״ז (הבעלים 12.10.2026): בשורה הגדולה רק שם הלקוחה המלא (בלי קוד הזמנה); קוד ההזמנה כקטע ראשון בשורה
// הקטנה ("הזמנה #N · ..."); אין שם בכלל = "ללא שם לקוחה" ולא הקוד; בשלב "אירוע" אין תאריך אירוע בשורה הקטנה.
// רינדור SSR אמיתי של StageRow (JSX דרך SWC של Next, כמו scripts/schedule-print-tests/jsx-hooks.mjs) + בדיקות מקור ל-UpdatedSection / MarkControls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
register(pathToFileURL(path.join(PROJ, 'scripts', 'schedule-print-tests', 'jsx-hooks.mjs')).href);
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const require = createRequire(path.join(PROJ, 'package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { default: StageRow, StageTableRow } = await L('app/components/schedule/StageRow.js');
const { customerDisplayName, NO_CUSTOMER_NAME, subItems, subText, orderCodeText } = await L('app/components/schedule/scheduleMeta.js');

const stage = (key) => ({ key, label: key, items: [], counts: { total: 1 } });
const row = (over = {}) => ({
  orderId: 12345, customer: { firstName: 'שרה', lastName: 'כהן', name: 'שרה כהן', phone1: '050' }, dressCount: 2,
  branch: 'בני ברק', eventDateHebrew: 'ד חשון', ...over,
});
const html = (st, r) => renderToStaticMarkup(React.createElement(StageRow, { stage: stage(st), row: r }));
const bold = (h) => (h.match(/<b>([^<]*)<\/b>/) || [])[1];
const small = (h) => (h.match(/<span class="ln">(.*?)<\/span><\/button>/s) || [])[1] || '';
const text = (h) => h.replace(/<[^>]+>/g, '');

test('customerDisplayName: full name / partial name / no name', () => {
  assert.equal(customerDisplayName({ firstName: 'שרה', lastName: 'כהן', name: 'x' }), 'שרה כהן');
  assert.equal(customerDisplayName({ firstName: 'שרה', lastName: '', name: 'שרה' }), 'שרה');
  assert.equal(customerDisplayName({ firstName: '', lastName: 'כהן', name: 'כהן' }), 'כהן');
  assert.equal(customerDisplayName({ name: 'דינה לוי' }), 'דינה לוי');
  assert.equal(customerDisplayName({ firstName: '', lastName: '', name: 'לא ידוע' }), NO_CUSTOMER_NAME);
  assert.equal(customerDisplayName(null), NO_CUSTOMER_NAME);
  assert.equal(NO_CUSTOMER_NAME, 'ללא שם לקוחה');
});

for (const st of ['order', 'repair', 'prep', 'dout', 'pick', 'event', 'manret', 'dback']) {
  test(`stage ${st}: big line = full name only; order code in the small line`, () => {
    const h = html(st, row());
    assert.equal(bold(h), 'שרה כהן');
    assert.ok(!/#12345/.test(bold(h)), 'no order code in the title');
    assert.ok(/#12345/.test(small(h)), 'order code in the small line');
    assert.ok(text(small(h)).startsWith('הזמנה #12345'), text(small(h)));
    assert.ok(!/<b>[^<]*<bdi>/.test(h), 'no <bdi> inside the title <b>');
    assert.ok(h.includes('aria-label="לכרטיס ההזמנה #12345"'), 'full aria-label still carries the code');
  });
}

test('no name at all -> "ללא שם לקוחה" in the title, never the order code', () => {
  const h = html('prep', row({ customer: { firstName: '', lastName: '', name: 'לא ידוע', phone1: '' } }));
  assert.equal(bold(h), 'ללא שם לקוחה');
  assert.ok(!/12345/.test(bold(h)));
  assert.ok(/הזמנה #12345/.test(small(h)));
});

test('partial name is shown as is', () => {
  assert.equal(bold(html('prep', row({ customer: { firstName: '', lastName: 'כהן', name: 'כהן' } }))), 'כהן');
  assert.equal(bold(html('prep', row({ customer: { firstName: 'שרה', lastName: '', name: 'שרה' } }))), 'שרה');
});

test('event stage: no event date in the small line; other stages keep their dates', () => {
  const ev = html('event', row());
  assert.ok(!/ד חשון/.test(ev), 'event date removed from the event row');
  assert.ok(/הזמנה #12345/.test(ev) && /2 פריטים/.test(text(ev)), 'order code + item count stay');
  assert.deepEqual(subItems('event', row()).map((x) => x.icon), ['dress']);
  assert.equal(subText('event', row()), '2 שמלות בהזמנה');
  // stage 1 (new orders) is a different stage and keeps the event date
  assert.ok(subItems('order', row()).some((x) => x.text === 'ד חשון'));
  assert.ok(/ד חשון/.test(html('order', row())));
  assert.ok(subItems('prep', row()).some((x) => x.text === 'בני ברק'));
});

test('table view: customer cell = name only, order code keeps its own column', () => {
  const h = renderToStaticMarkup(React.createElement('table', null, React.createElement('tbody', null, React.createElement(StageTableRow, { stage: stage('prep'), row: row() }))));
  assert.ok(h.includes('<td><bdi>#12345</bdi></td>'));
  assert.ok(h.includes('<b>שרה כהן</b>'));
});

test('UpdatedSection and the "mark all" dialog list follow the same rule (source)', () => {
  const dir = path.join(PROJ, 'app', 'components', 'schedule');
  const upd = readFileSync(path.join(dir, 'UpdatedSection.js'), 'utf8');
  assert.ok(upd.includes('<b>{customerDisplayName(row.customer)}</b>'));
  assert.ok(upd.includes('orderCodeText(row.orderId)'));
  assert.ok(!/<b>[^<]*<bdi>#\{/.test(upd), 'no code beside the name in UpdatedSection');
  const mc = readFileSync(path.join(dir, 'MarkControls.js'), 'utf8');
  assert.ok(mc.includes('<b>{customerDisplayName(r.customer)}</b>'));
  assert.ok(!/<b>[^<]*#\{r\.orderId\}/.test(mc), 'no code beside the name in the mark-all list');
  assert.equal(orderCodeText(7), 'הזמנה #7');
});
