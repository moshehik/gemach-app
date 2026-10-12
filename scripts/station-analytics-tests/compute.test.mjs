// בדיקות סינתטיות של חישוב המשפך (lib/stationAnalytics/compute.js + service.parseParams): מקרי קצה, לא נתונים נצפים.
//   node scripts/station-analytics-tests/run.mjs      (או: node --import ./scripts/station-analytics-tests/register.mjs --test scripts/station-analytics-tests/compute.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(`${process.env.PROJ}/${rel}`).href);
const C = await L('lib/stationAnalytics/compute.js');
const S = await L('lib/stationAnalytics/service.js');
const K = await L('lib/stationAnalytics/constants.js');
const { getIsraelDateKey } = await L('lib/hebrewDate.js');

const NOW = new Date('2026-10-12T07:00:00Z'); // 10:00 בישראל (IDT, UTC+3)
const day = (iso) => getIsraelDateKey(new Date(iso));
let seq = 0;
const cust = (o = {}) => ({ isDeleted: false, state: 'pending', ...o });
const reg = (customerId, iso, extra = {}) => ({ customerId, at: new Date(iso), dayKey: day(iso), channel: 'public', outcome: 'created', ...extra });
const ord = (customerId, iso, extra = {}) => ({ customerId, orderId: ++seq, orderDate: new Date(iso), confirmed: true, hasItem: true, ...extra });
const ev = (dayKey, type, count, channel = 'public') => ({ dayKey, type, channel, count });
const run = (o) => C.buildAnalytics({ from: '2026-10-12', to: '2026-10-12', channel: 'public', windowDays: 14, now: NOW, ...o });

test('funnel: counts and rates along the stages (visit -> form -> registered -> verified / closed)', () => {
  const customers = new Map([['a', cust({ state: 'verified' })], ['b', cust({ state: 'verified' })], ['c', cust()], ['d', cust()]]);
  const r = run({
    events: [ev('2026-10-12', 'visit', 100), ev('2026-10-12', 'availability', 40), ev('2026-10-12', 'form_start', 8)],
    registrations: [reg('a', '2026-10-12T05:00:00Z'), reg('b', '2026-10-12T05:10:00Z'), reg('c', '2026-10-12T05:20:00Z'), reg('d', '2026-10-12T05:30:00Z')],
    customers,
    orders: [ord('a', '2026-10-12T06:00:00Z'), ord('c', '2026-10-13T06:00:00Z')],
  });
  const f = Object.fromEntries(r.funnel.map((s) => [s.key, s]));
  assert.equal(f.visits.count, 100);
  assert.equal(f.availability.count, 40);
  assert.equal(f.formStart.count, 8);
  assert.equal(f.registered.count, 4);
  assert.equal(f.verified.count, 2);
  assert.equal(f.closed.count, 2); // a (אותו יום) + c (למחרת, בתוך החלון)
  assert.equal(r.totals.closedSameDay, 1);
  assert.equal(r.rates.visitToRegistered, 0.04);
  assert.equal(r.rates.formToRegistered, 0.5);
  assert.equal(r.rates.registeredToVerified, 0.5);
  assert.equal(r.rates.registeredToClosed, 0.5);
  assert.equal(r.rates.visitToClosed, 0.02);
  assert.equal(f.availability.rateFromParent, 0.4);
  assert.equal(f.registered.rateFromParent, 0.5); // מ-form_start
  assert.equal(f.closed.rateFromParent, 0.5); // מ-registered
  assert.equal(f.closed.rateFromVisits, 0.02);
});

test('same customer registered twice on one day counts once (earliest event), per day and in the range', () => {
  const r = run({
    registrations: [reg('a', '2026-10-12T05:00:00Z'), reg('a', '2026-10-12T08:00:00Z', { outcome: 'existing-marked' })],
    customers: new Map([['a', cust()]]),
  });
  assert.equal(r.daily[0].registered, 1);
  assert.equal(r.totals.registered, 1);
});

test('same customer on two days: each day shows her, the range counts her once (first registration); order after the FIRST one still attributed', () => {
  const r = run({
    from: '2026-10-10', to: '2026-10-12',
    registrations: [reg('a', '2026-10-10T08:00:00Z'), reg('a', '2026-10-12T05:00:00Z', { outcome: 'existing-marked' })],
    customers: new Map([['a', cust()]]),
    orders: [ord('a', '2026-10-11T08:00:00Z')],
  });
  assert.deepEqual(r.daily.map((d) => d.registered), [1, 0, 1]);
  assert.equal(r.totals.registered, 1);
  assert.equal(r.totals.registeredDaySum, 2);
  assert.equal(r.totals.closedInWindow, 1);
  assert.deepEqual(r.daily.map((d) => d.closedInWindow), [1, 0, 0]); // ההזמנה אחרי הרישום של ה-10, לפני הרישום החוזר של ה-12
});

test('deleted customer registration is not counted (reported as droppedDeleted); missing customer row too', () => {
  const r = run({
    registrations: [reg('a', '2026-10-12T05:00:00Z'), reg('ghost', '2026-10-12T05:01:00Z'), reg('b', '2026-10-12T05:02:00Z')],
    customers: new Map([['a', cust({ isDeleted: true })], ['b', cust()]]),
  });
  assert.equal(r.totals.registered, 1);
  assert.equal(r.totals.droppedDeleted, 2);
});

test('order created BEFORE the registration never counts (even earlier the same day / same existing customer)', () => {
  const r = run({
    registrations: [reg('a', '2026-10-12T06:00:00Z', { outcome: 'existing-marked' })],
    customers: new Map([['a', cust({ state: 'repeat' })]]),
    orders: [ord('a', '2026-10-12T05:59:59Z'), ord('a', '2026-10-01T10:00:00Z')],
  });
  assert.equal(r.totals.closedInWindow, 0);
  assert.equal(r.totals.closedSameDay, 0);
  assert.equal(r.rates.registeredToClosed, 0);
});

test('order at the very same instant as the registration counts; one millisecond before does not', () => {
  const at = '2026-10-12T06:00:00.000Z';
  const a = run({ registrations: [reg('a', at)], customers: new Map([['a', cust()]]), orders: [ord('a', at)] });
  assert.equal(a.totals.closedInWindow, 1);
  const b = run({ registrations: [reg('a', at)], customers: new Map([['a', cust()]]), orders: [ord('a', '2026-10-12T05:59:59.999Z')] });
  assert.equal(b.totals.closedInWindow, 0);
});

test('saved-but-not-confirmed order (cancelled cart / unpaid hold) is not a closed order; reported separately as savedUnpaid', () => {
  const r = run({
    registrations: [reg('a', '2026-10-12T05:00:00Z'), reg('b', '2026-10-12T05:00:00Z')],
    customers: new Map([['a', cust()], ['b', cust()]]),
    orders: [ord('a', '2026-10-12T06:00:00Z', { confirmed: false, hasItem: true }), ord('b', '2026-10-12T06:00:00Z', { confirmed: false, hasItem: true }), ord('b', '2026-10-12T06:30:00Z')],
  });
  assert.equal(r.totals.closedInWindow, 1); // b בלבד
  assert.equal(r.totals.savedUnpaid, 1); // a בלבד (ל-b יש גם הזמנה סגורה)
});

test('conversion window: day N after the registration day counts, day N+1 does not (calendar days, Israel)', () => {
  const regIso = '2026-09-20T07:00:00Z'; // 10:00 ישראל
  const base = { from: '2026-09-20', to: '2026-09-20', registrations: [reg('a', regIso)], customers: new Map([['a', cust()]]), windowDays: 14 };
  const lastDay = run({ ...base, orders: [ord('a', '2026-10-04T20:59:00Z')] }); // 23:59 ישראל ביום ה-4.10 (יום 14)
  assert.equal(lastDay.totals.closedInWindow, 1);
  const tooLate = run({ ...base, orders: [ord('a', '2026-10-04T21:00:00Z')] }); // 00:00 ב-5.10 (יום 15)
  assert.equal(tooLate.totals.closedInWindow, 0);
  const w7 = run({ ...base, windowDays: 7, orders: [ord('a', '2026-09-28T07:00:00Z')] }); // יום 8
  assert.equal(w7.totals.closedInWindow, 0);
});

test('Israel midnight boundary: 23:59 and 00:00 local fall on different days (summer, UTC+3)', () => {
  assert.equal(C.dayOf(new Date('2026-10-11T20:59:59Z')), '2026-10-11');
  assert.equal(C.dayOf(new Date('2026-10-11T21:00:00Z')), '2026-10-12');
  const r = run({
    from: '2026-10-11', to: '2026-10-12',
    registrations: [reg('a', '2026-10-11T20:30:00Z')], // 23:30 ישראל ב-11.10
    customers: new Map([['a', cust()]]),
    orders: [ord('a', '2026-10-11T21:30:00Z')], // 00:30 ב-12.10
  });
  assert.deepEqual(r.daily.map((d) => d.registered), [1, 0]);
  assert.equal(r.totals.closedInWindow, 1);
  assert.equal(r.totals.closedSameDay, 0); // ההזמנה כבר ביום הבא בישראל
});

test('DST fall-back (Israel 25.10.2026): window end and day keys stay correct across the extra hour', () => {
  assert.equal(C.dayOf(new Date('2026-10-25T21:30:00Z')), '2026-10-25'); // 23:30 IST
  assert.equal(C.dayOf(new Date('2026-10-25T22:00:00Z')), '2026-10-26'); // 00:00 IST
  const base = { from: '2026-10-24', to: '2026-10-24', registrations: [reg('a', '2026-10-24T08:00:00Z')], customers: new Map([['a', cust()]]), windowDays: 1, now: new Date('2026-11-30T10:00:00Z') };
  assert.equal(run({ ...base, orders: [ord('a', '2026-10-25T21:59:00Z')] }).totals.closedInWindow, 1); // 23:59 ב-25.10 = יום 1
  assert.equal(run({ ...base, orders: [ord('a', '2026-10-25T22:00:00Z')] }).totals.closedInWindow, 0); // 00:00 ב-26.10 = יום 2
});

test('window maturity: recent registrations are flagged still-open; rate on matured ones is separate', () => {
  const r = run({
    from: '2026-09-01', to: '2026-10-12', windowDays: 14,
    registrations: [reg('old', '2026-09-02T07:00:00Z'), reg('old2', '2026-09-03T07:00:00Z'), reg('new', '2026-10-11T07:00:00Z')],
    customers: new Map([['old', cust()], ['old2', cust()], ['new', cust()]]),
    orders: [ord('old', '2026-09-05T07:00:00Z')],
  });
  assert.equal(r.totals.registered, 3);
  assert.equal(r.totals.windowStillOpen, 1);
  assert.equal(r.totals.maturedRegistered, 2);
  assert.equal(r.totals.closedInWindowMatured, 1);
  assert.equal(r.rates.registeredToClosedMatured, 0.5);
});

test('empty days and empty data: zeros, null rates, no NaN / Infinity anywhere', () => {
  const r = run({ from: '2026-10-01', to: '2026-10-12' });
  assert.equal(r.daily.length, 12);
  assert.ok(r.daily.every((d) => d.visits === 0 && d.registered === 0 && d.closedInWindow === 0));
  for (const v of Object.values(r.rates)) assert.equal(v, null);
  for (const s of r.funnel) { assert.ok(s.count === 0); assert.equal(s.rateFromParent, null); }
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(r)));
});

test('divide by zero: registrations with zero recorded visits -> visit conversion is null, registration->order still defined', () => {
  const r = run({ registrations: [reg('a', '2026-10-12T05:00:00Z')], customers: new Map([['a', cust()]]), orders: [ord('a', '2026-10-12T06:00:00Z')] });
  assert.equal(r.rates.visitToRegistered, null);
  assert.equal(r.rates.visitToClosed, null);
  assert.equal(r.rates.formToRegistered, null);
  assert.equal(r.rates.registeredToClosed, 1);
});

test('registrations can exceed form_start (events lost / two people on one device): rate is reported raw, not clamped', () => {
  const r = run({ events: [ev('2026-10-12', 'visit', 5), ev('2026-10-12', 'form_start', 1)], registrations: [reg('a', '2026-10-12T05:00:00Z'), reg('b', '2026-10-12T05:01:00Z')], customers: new Map([['a', cust()], ['b', cust()]]) });
  assert.equal(r.rates.formToRegistered, 2);
});

test('channels: kiosk/all hide the top-of-funnel (public-only measure); registrations filtered by channel; all dedupes a customer', () => {
  const customers = new Map([['a', cust()], ['b', cust()]]);
  const regs = [reg('a', '2026-10-12T05:00:00Z', { channel: 'kiosk' }), reg('b', '2026-10-12T05:00:00Z'), reg('a', '2026-10-12T06:00:00Z')];
  const events = [ev('2026-10-12', 'visit', 50)];
  const pub = run({ channel: 'public', registrations: regs, customers, events });
  assert.equal(pub.totals.registered, 2); // b + a (הרישום הציבורי של a)
  assert.equal(pub.funnel[0].count, 50);
  const kiosk = run({ channel: 'kiosk', registrations: regs, customers, events });
  assert.equal(kiosk.totals.registered, 1);
  assert.equal(kiosk.funnel[0].count, null);
  assert.equal(kiosk.rates.visitToRegistered, null);
  const all = run({ channel: 'all', registrations: regs, customers, events });
  assert.equal(all.totals.registered, 2); // a נספרת פעם אחת
  assert.equal(all.funnel[0].count, null);
  assert.deepEqual(all.totals.registeredByChannel, { public: 2, kiosk: 1 }); // a נספרת בשני הערוצים (נרשמה בשניהם), b בציבורי - בלי קשר לסינון
  assert.deepEqual(pub.totals.registeredByChannel, { public: 2, kiosk: 1 });
  assert.deepEqual(kiosk.totals.registeredByChannel, { public: 2, kiosk: 1 });
});

test('events of the kiosk channel never inflate the public visit counts', () => {
  const r = run({ events: [ev('2026-10-12', 'visit', 10, 'kiosk'), ev('2026-10-12', 'visit', 3, 'public')] });
  assert.equal(r.totals.visits, 3);
});

test('events outside the requested range are ignored', () => {
  const r = run({ from: '2026-10-12', to: '2026-10-12', events: [ev('2026-10-11', 'visit', 99), ev('2026-10-13', 'visit', 99), ev('2026-10-12', 'visit', 4)] });
  assert.equal(r.totals.visits, 4);
});

test('verified: only the CURRENT state "verified" counts (pending / repeat / none do not)', () => {
  const customers = new Map([['a', cust({ state: 'verified' })], ['b', cust({ state: 'pending' })], ['c', cust({ state: 'repeat' })], ['d', cust({ state: null })]]);
  const r = run({ registrations: ['a', 'b', 'c', 'd'].map((id) => reg(id, '2026-10-12T05:00:00Z')), customers });
  assert.equal(r.totals.verified, 1);
  assert.equal(r.daily[0].verified, 1);
});

test('range registrations: a registration whose dayKey is outside the range is ignored', () => {
  const r = run({ registrations: [reg('a', '2026-10-11T05:00:00Z'), reg('b', '2026-10-12T05:00:00Z')], customers: new Map([['a', cust()], ['b', cust()]]) });
  assert.equal(r.totals.registered, 1);
});

test('long range (180 days, 5000 registrations, 3000 orders) computes fast and consistently', () => {
  const from = '2026-04-15';
  const customers = new Map();
  const registrations = [];
  const orders = [];
  for (let i = 0; i < 5000; i++) {
    const id = `c${i}`;
    customers.set(id, cust({ state: i % 3 === 0 ? 'verified' : 'pending' }));
    const t = new Date(Date.UTC(2026, 3, 15, 8) + (i % 180) * 86400000 + (i % 60) * 60000);
    registrations.push(reg(id, t.toISOString()));
    if (i % 5 < 3) orders.push(ord(id, new Date(t.getTime() + (i % 10) * 86400000 + 3600000).toISOString()));
  }
  const t0 = Date.now();
  const r = C.buildAnalytics({ from, to: '2026-10-12', channel: 'public', windowDays: 14, now: NOW, registrations, customers, orders });
  assert.ok(Date.now() - t0 < 2000, 'חישוב איטי מדי');
  assert.equal(r.daily.length, 181);
  assert.equal(r.totals.registered, 5000 - registrations.filter((x) => x.dayKey > '2026-10-12').length);
  assert.equal(r.daily.reduce((a, d) => a + d.registered, 0), r.totals.registeredDaySum);
  assert.ok(r.totals.closedInWindow <= r.totals.registered);
});

test('cards: today vs yesterday vs 7-day average; averages of rates are pooled ratios; missing days count as zero', () => {
  const daily = [
    { day: '2026-10-05', visits: 10, registered: 1, closedInWindow: 1 },
    { day: '2026-10-08', visits: 30, registered: 3, closedInWindow: 0 },
    { day: '2026-10-11', visits: 20, registered: 4, closedInWindow: 2 },
    { day: '2026-10-12', visits: 50, registered: 5, closedInWindow: 1 },
  ];
  const c = C.buildCards({ daily, todayKey: '2026-10-12', topMeasured: true });
  assert.equal(c.today.visits, 50);
  assert.equal(c.today.visitToRegistered, 0.1);
  assert.equal(c.yesterday.registered, 4);
  assert.equal(c.yesterday.registeredToClosed, 0.5);
  // 7 הימים שלפני ה-12.10: 5..11 -> ביקורים 60/7, נרשמו 8/7, שיעור מצטבר 8/60
  assert.equal(c.weekAvg.days, 7);
  assert.ok(Math.abs(c.weekAvg.visits - 60 / 7) < 1e-9);
  assert.ok(Math.abs(c.weekAvg.visitToRegistered - 8 / 60) < 1e-9);
  assert.ok(Math.abs(c.weekAvg.registeredToClosed - 3 / 8) < 1e-9);
  const none = C.buildCards({ daily: [], todayKey: '2026-10-12', topMeasured: true });
  assert.equal(none.today.visitToRegistered, null);
  assert.equal(none.weekAvg.registeredToClosed, null);
});

test('shortName: first name + first letter of the family name, nothing more', () => {
  assert.equal(C.shortName('שרה', 'כהן'), 'שרה כ.');
  assert.equal(C.shortName('', ''), '(ללא שם)');
  assert.equal(C.shortName('רחל', null), 'רחל');
  assert.ok(!C.shortName('שרה', 'כהן-לוי').includes('לוי'));
});

test('enumerateDays: inclusive, handles month/year turn and reversed ranges', () => {
  assert.deepEqual(C.enumerateDays('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(C.enumerateDays('2026-10-12', '2026-10-12'), ['2026-10-12']);
  assert.deepEqual(C.enumerateDays('2026-10-13', '2026-10-12'), []);
});

test('parseParams: defaults (7 days to today, public, window 14), bounds and error messages', () => {
  const ok = S.parseParams({}, NOW);
  assert.deepEqual(ok.params, { from: '2026-10-06', to: '2026-10-12', channel: 'public', windowDays: 14 });
  assert.ok(S.parseParams({ from: '2026-10-13', to: '2026-10-12' }, NOW).error);
  assert.ok(S.parseParams({ from: '2026-02-31', to: '2026-03-01' }, NOW).error); // תאריך לא קיים
  assert.ok(S.parseParams({ from: 'x', to: '2026-03-01' }, NOW).error);
  assert.ok(S.parseParams({ from: '2025-01-01', to: '2026-10-12' }, NOW).error); // יותר מ-180 יום
  assert.ok(S.parseParams({ channel: 'web' }, NOW).error);
  assert.ok(S.parseParams({ windowDays: '0' }, NOW).error);
  assert.ok(S.parseParams({ windowDays: '61' }, NOW).error);
  assert.equal(S.parseParams({ windowDays: '30', channel: 'all' }, NOW).params.windowDays, 30);
  assert.equal(S.parseParams({ from: '2026-04-16', to: '2026-10-12' }, NOW).params.from, '2026-04-16'); // בדיוק 180 יום
});

test('NON_ORDER_STATUSES mirror the real constants of lib/orderReservation.js', async () => {
  const R = await L('lib/orderReservation.js');
  assert.deepEqual([...K.NON_ORDER_STATUSES].sort(), [R.DRAFT_ORDER_STATUS, R.RESERVED_ORDER_STATUS].sort());
});

test('contract: ANON_EVENT_TYPES has no register (register is server-only); every funnel stage has a Hebrew label', () => {
  assert.ok(!K.ANON_EVENT_TYPES.includes('register'));
  for (const s of K.FUNNEL_STAGES) assert.ok(/[֐-׿]/.test(s.label));
});
