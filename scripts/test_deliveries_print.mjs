// בדיקת יחידה ללוגיקה הטהורה של כפתורי ההדפסה במסך /deliveries (lib/deliveriesPrint.js). בלי DB, רשת או דפדפן.
// הרצה: node scripts/test_deliveries_print.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DELIVERY_NEW_PAGES, legacyDeliveryPrintUrl, newDeliveryPrintUrl, distinctDispatchDates,
  deliveryPrintWantsNew, planDeliveryPrint, deliveryPrintHint,
} from '../lib/deliveriesPrint.js';

let failed = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const ALL = ['PP-10', 'PP-12', 'PP-18'];
const D = '2026-10-07';

t('מיפוי: כל מפתח רשום ב-registry כ-ready ומחליף את המשטח הישן המתאים (קריאת טקסט - ה-registry משתמש בכינוי @/)', () => {
  const src = fs.readFileSync(new URL('../lib/schedule/print/registry.js', import.meta.url), 'utf8');
  const entry = (k) => { const i = src.indexOf("key: '" + k + "'"); assert.ok(i > 0, k); const j = src.indexOf('{ key:', i + 5); return src.slice(i, j > 0 ? j : undefined); };
  for (const k of ALL) assert.match(entry(k), /status: 'ready'/, k);
  assert.match(entry('PP-12'), /replaces: '\/print\/delivery-bag'/);
  assert.match(entry('PP-10'), /replaces: '\/print\/delivery-courier\?direction=out'/);
  assert.match(entry('PP-18'), /replaces: '\/print\/delivery-courier\?direction=return'/);
  assert.deepEqual(DELIVERY_NEW_PAGES.bag, ['PP-12']);
  assert.deepEqual(DELIVERY_NEW_PAGES.both, ['PP-10', 'PP-18']);
});

t('כתובות הדפים הישנים לא השתנו', () => {
  assert.equal(legacyDeliveryPrintUrl('bag', { bagDate: D }), `/print/delivery-bag?date=${D}`);
  assert.equal(legacyDeliveryPrintUrl('courier', { direction: 'out', from: D, to: '2026-10-09' }), `/print/delivery-courier?direction=out&from=${D}&to=2026-10-09`);
});

t('נתונים לשקית -> PP-12 עם התאריך שנבחר', () => {
  const p = planDeliveryPrint({ kind: 'bag', bagDate: D, allowedKeys: ALL });
  assert.equal(p.mode, 'new');
  assert.equal(p.url, `/schedule/print/PP-12?date=${D}`);
});

t('משלוחן יום אחד: הלוך -> PP-10, חזור -> PP-18, שניהם -> PP-10,PP-18', () => {
  const u = (direction) => planDeliveryPrint({ kind: 'courier', direction, from: D, to: D, allowedKeys: ALL }).url;
  assert.equal(u('out'), `/schedule/print/PP-10?date=${D}`);
  assert.equal(u('return'), `/schedule/print/PP-18?date=${D}`);
  assert.equal(u('both'), `/schedule/print/PP-10,PP-18?date=${D}`);
  // to חסר = אותו יום
  assert.equal(planDeliveryPrint({ kind: 'courier', direction: 'out', from: D, allowedKeys: ALL }).mode, 'new');
});

t('טווח של יותר מיום -> הדף הישן (הדפים החדשים הם ליום אחד)', () => {
  const p = planDeliveryPrint({ kind: 'courier', direction: 'both', from: D, to: '2026-10-08', allowedKeys: ALL });
  assert.equal(p.mode, 'legacy'); assert.equal(p.reason, 'range');
  assert.equal(p.url, `/print/delivery-courier?direction=both&from=${D}&to=2026-10-08`);
});

t('אין הרשאה (או לא ידוע) לאחד הדפים -> הדף הישן', () => {
  assert.equal(planDeliveryPrint({ kind: 'bag', bagDate: D, allowedKeys: ['PP-10'] }).reason, 'no-access');
  assert.equal(planDeliveryPrint({ kind: 'courier', direction: 'both', from: D, allowedKeys: ['PP-10'] }).mode, 'legacy');
  assert.equal(planDeliveryPrint({ kind: 'bag', bagDate: D, allowedKeys: null }).mode, 'legacy');
  assert.equal(planDeliveryPrint({ kind: 'courier', direction: 'out', from: D, allowedKeys: ['PP-10'] }).mode, 'new');
});

t('תאריך לא תקין -> הדף הישן (שמציג את השגיאה בעצמו)', () => {
  assert.equal(planDeliveryPrint({ kind: 'bag', bagDate: '', allowedKeys: ALL }).reason, 'bad-date');
  assert.equal(planDeliveryPrint({ kind: 'courier', from: '07/10/2026', allowedKeys: ALL }).reason, 'bad-date');
});

t('בחירה לפי תאריך אירוע: משלוחן -> ישן; תעודות -> PP-12 ליום הוצאה יחיד, אחרת ישן', () => {
  assert.equal(planDeliveryPrint({ kind: 'courier', direction: 'out', from: D, byEventDate: true, allowedKeys: ALL }).reason, 'event-date-courier');
  const base = { kind: 'bag', bagDate: '2026-10-12', byEventDate: true, allowedKeys: ALL };
  const one = planDeliveryPrint({ ...base, eventModeDispatchDates: ['2026-10-09'] });
  assert.equal(one.url, '/schedule/print/PP-12?date=2026-10-09');
  assert.equal(planDeliveryPrint({ ...base, eventModeDispatchDates: ['2026-10-08', '2026-10-09'] }).reason, 'no-dispatch-date');
  assert.equal(planDeliveryPrint({ ...base, eventModeDispatchDates: [] }).mode, 'legacy');
  assert.equal(planDeliveryPrint({ ...base, eventModeDispatchDates: null }).mode, 'legacy');
});

t('distinctDispatchDates: רק הכיוון המבוקש, בלי כפילויות, ממוין, מתעלם מזבל', () => {
  const rows = [
    { directions: ['out'], dispatchDates: { out: '2026-10-09' } },
    { directions: ['out', 'return'], dispatchDates: { out: '2026-10-08', return: '2026-10-15' } },
    { directions: ['out'], dispatchDates: { out: '2026-10-09' } },
    { directions: ['return'], dispatchDates: { return: '2026-10-20' } },
    { directions: ['out'] }, { directions: ['out'], dispatchDates: { out: 'x' } }, null,
  ];
  assert.deepEqual(distinctDispatchDates(rows, 'out'), ['2026-10-08', '2026-10-09']);
  assert.deepEqual(distinctDispatchDates(rows, 'return'), ['2026-10-15', '2026-10-20']);
  assert.deepEqual(distinctDispatchDates(undefined, 'out'), []);
});

t('הערות במודל: רק כשיש מה להסביר', () => {
  assert.equal(deliveryPrintHint({ kind: 'courier', from: D, to: D }), null);
  assert.match(deliveryPrintHint({ kind: 'courier', from: D, to: '2026-10-09' }), /טווח/);
  assert.match(deliveryPrintHint({ kind: 'courier', from: D, to: D, byEventDate: true }), /אירוע/);
  assert.equal(deliveryPrintHint({ kind: 'bag', bagDate: D }), null);
  assert.match(deliveryPrintHint({ kind: 'bag', bagDate: D, byEventDate: true }), /יום ההוצאה/);
  assert.equal(deliveryPrintWantsNew({ kind: 'bag', bagDate: D }).wantsNew, true);
  assert.equal(newDeliveryPrintUrl(['PP-12'], D), `/schedule/print/PP-12?date=${D}`);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
