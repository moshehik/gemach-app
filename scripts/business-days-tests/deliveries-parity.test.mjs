// lib/deliveries.js before/after on an in-memory DB. "Before" = legacy/deliveries.main.mjs (frozen copy of
// origin/main 00104dc4, post-#220: holidays closed, chol hamoed OPEN, days_after=0 rolls returns forward). For every settings combination (delivery_skip_weekends
// x deliveries_select_by_event_date x days before/after - including both gemachs' real combos) and every requested
// day over ~10 months, both implementations run on the same ~1,100 orders. Claims proven:
//  A. Every difference between main and v2 involves a chol-hamoed day between the event and the (old or new)
//     dispatch day. Away from chol hamoed the two are byte-identical. Counts are printed for the report.
//  B. Integrity of v2 (window mode): every (order, direction) appears on EXACTLY one page, and that page is the
//     independently computed dispatch day (reference walk). Nothing is lost, nothing is duplicated. By-event mode:
//     the same orders as main on every page; only dispatchDates move, and only across chol hamoed.
//  C. Known-answer scenarios (Sukkot 5787 week in the Neve Yaakov configuration; owner ranges/recurring days).
//  D. Result/row shape and the Prisma where clause are unchanged when nothing is skipped.
//  E. A huge delivery_days_before/after setting still cannot hang the server.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { L, LM, eachKey, localMidnight, isFriSat, installDb, makeRef, cholHamoedBetween } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { getDeliveriesForDate: NEW } = await L('lib/deliveries.js');
const { getDeliveriesForDate: MAIN } = await LM('deliveries');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { getIsraelDayRange, isChagDay } = await L('lib/hebrewDate.js');
const REF = makeRef(isChagDay);

// ---- fixtures: one event per day, 3 order variants per day ----
const EVENTS = ['2026-08-01', '2027-07-31'];
const DAYS = ['2026-09-01', '2027-06-30'];
function buildOrders() {
  const orders = [];
  let id = 1000;
  for (const k of eachKey(...EVENTS)) {
    const common = { isDeleted: false, isDelivery: true, status: null, deliveryAddress: 'רחוב 1', deliveryCity: 'ירושלים',
      customer: { firstName: 'א', lastName: 'ב', phone1: '050', phone2: '', city: 'ירושלים', street: 'רחוב', houseNum: '1' },
      items: [{ description: 'דגם', isDeleted: false }], obligations: [{ description: 'משלוח הלוך', isDeleted: false }] };
    orders.push({ ...common, orderId: id++, eventDate: new Date(`${k}T00:00:00.000Z`), deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: false, eventKey: k });
    orders.push({ ...common, orderId: id++, eventDate: new Date(`${k}T00:00:00.000Z`), deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: true, eventKey: k });
    // Access-import storage form (true Israel midnight of the day: previous day 21:00Z in summer, 22:00Z in winter) + one-way order
    orders.push({ ...common, orderId: id++, eventDate: new Date(getIsraelDayRange(k).start), deliveryDirection: 'חזור', deliveryOneDayBefore: false, eventKey: k });
  }
  return orders;
}
const ORDERS = buildOrders();
const BY_ID = new Map(ORDERS.map((o) => [o.orderId, o]));

function settings({ skip, byEvent, before, after, extra }) {
  const rows = [
    { key: 'delivery_days_before', value: String(before) },
    { key: 'delivery_days_after', value: String(after) },
    { key: 'deliveries_select_by_event_date', value: byEvent ? 'true' : 'false' },
    { key: 'delivery_skip_weekends', value: skip ? 'true' : 'false' },
  ];
  if (extra !== undefined) rows.push({ key: B.NON_WORKING_DAYS_SETTING_KEY, value: extra });
  return rows;
}
const sig = (res) => res.data.map((r) => `${r.orderId}:${r.directions.join('+')}${r.dispatchDates ? ':' + (r.dispatchDates.out || '-') + '/' + (r.dispatchDates.return || '-') : ''}`).sort();
// the two gemachs' real combinations first (main gemach: skip off, window mode, 0/0 live and 1/1 seed default;
// Neve Yaakov: skip on, by-event on, 2 before / 1 after), then the full matrix
const REAL = { MAIN_LIVE: { skip: false, byEvent: false, before: 0, after: 0 }, MAIN_SEED: { skip: false, byEvent: false, before: 1, after: 1 }, NEVE: { skip: true, byEvent: true, before: 2, after: 1 } };
const COMBOS = [];
for (const skip of [false, true]) for (const byEvent of [false, true]) for (const [before, after] of [[0, 0], [1, 1], [2, 1], [0, 1], [2, 2]]) COMBOS.push({ skip, byEvent, before, after });
const comboKey = (c) => `skip=${c.skip ? 'on' : 'off'} byEvent=${c.byEvent ? 'on' : 'off'} ${c.before}/${c.after}`;

async function runBoth(combo, day, extra) {
  installDb({ settings: settings({ ...combo, extra }), orders: ORDERS });
  invalidateSettingsCache();
  const a = await MAIN(localMidnight(day));
  invalidateSettingsCache();
  const b = await NEW(localMidnight(day));
  return [a, b];
}
async function runNew(combo, day, extra) {
  installDb({ settings: settings({ ...combo, extra }), orders: ORDERS });
  invalidateSettingsCache();
  return NEW(localMidnight(day));
}

function diffSets(a, b) {
  const sa = new Set(a), sb = new Set(b);
  return { removed: a.filter((x) => !sb.has(x)), added: b.filter((x) => !sa.has(x)) };
}

beforeEach(() => invalidateSettingsCache());

test('A. main vs v2, every combo (both gemachs first): every difference has a chol-hamoed day between the event and the old/new dispatch day; identical elsewhere', async () => {
  const stats = {};
  for (const combo of [REAL.MAIN_LIVE, REAL.MAIN_SEED, REAL.NEVE, ...COMBOS]) {
    const key = comboKey(combo);
    if (stats[key]) continue;
    const st = { runs: 0, changed: 0, added: 0, removed: 0, dispatchMoved: 0, pairsA: 0, pairsB: 0 };
    for (const day of eachKey(...DAYS)) {
      const [a, b] = await runBoth(combo, day, undefined);
      st.runs++;
      // (order, direction) pairs over all pages - a rolled return leaves one page and lands on another, never lost
      st.pairsA += a.data.reduce((n, r) => n + r.directions.length, 0);
      st.pairsB += b.data.reduce((n, r) => n + r.directions.length, 0);
      assert.deepEqual({ daysBefore: b.daysBefore, daysAfter: b.daysAfter, selectByEventDate: b.selectByEventDate }, { daysBefore: a.daysBefore, daysAfter: a.daysAfter, selectByEventDate: a.selectByEventDate });
      const d = diffSets(sig(a), sig(b));
      if (!d.added.length && !d.removed.length) continue;
      st.changed++;
      if (combo.byEvent) {
        // by-event mode: the SAME orders and directions on the event-date page, only dispatchDates move
        assert.deepEqual(b.data.map((r) => r.orderId), a.data.map((r) => r.orderId), `${key} ${day}: by-event mode must list the same orders`);
        for (let i = 0; i < a.data.length; i++) {
          assert.deepEqual(b.data[i].directions, a.data[i].directions);
          for (const dir of ['out', 'return']) {
            const oldD = a.data[i].dispatchDates[dir], newD = b.data[i].dispatchDates[dir];
            if (oldD === newD) continue;
            st.dispatchMoved++;
            const ev = BY_ID.get(a.data[i].orderId).eventKey;
            assert.ok(cholHamoedBetween(ev, oldD) || cholHamoedBetween(ev, newD), `${key} ${day}: order ${a.data[i].orderId} ${dir} moved ${oldD} -> ${newD} without chol hamoed`);
            assert.ok(dir === 'out' ? newD < oldD : newD > oldD, `${key} ${day}: ${dir} must move away from the event (${oldD} -> ${newD})`);
            assert.equal(B.isNonWorkingDay(newD, null, { skipWeekend: combo.skip }), false, `${key} ${day}: new dispatch day ${newD} must be a working day`);
          }
        }
        continue;
      }
      // window mode: a row can only move between pages because of chol hamoed between its event and this page
      for (const s of [...d.removed, ...d.added]) {
        const o = BY_ID.get(Number(s.split(':')[0]));
        assert.ok(cholHamoedBetween(o.eventKey, day), `${key} ${day}: ${s} (event ${o.eventKey}) moved without chol hamoed between`);
        // 0 days before / 0 after: the page is the event day itself, so only "delivery one day before" orders
        // (their own n=-1 window) and returns (days_after=0 rolls a closed event day to the next working day -
        // SCH-DELIV-0, main 4.10.2026 - and under v2 chol hamoed is closed) can ever move
        if (combo.before === 0 && combo.after === 0) {
          const dirsOf = (res) => new Set((res.data.find((r) => r.orderId === o.orderId) || { directions: [] }).directions);
          const da = dirsOf(a), db = dirsOf(b);
          const moved = [...new Set([...da, ...db])].filter((x) => da.has(x) !== db.has(x));
          assert.ok(moved.every((x) => x === 'return' || (x === 'out' && o.deliveryOneDayBefore)), `${key} ${day}: ${s} - only a one-day-before outbound or a rolled return may move (moved: ${moved.join(',')})`);
        }
      }
      st.removed += d.removed.length;
      st.added += d.added.length;
      if (B.isNonWorkingDay(day, null, { skipWeekend: combo.skip }) && combo.before !== 0) {
        assert.equal(b.data.length, 0, `${key} ${day}: non-working day page must be empty`);
      }
    }
    stats[key] = st;
  }
  for (const [k, st] of Object.entries(stats)) {
    const tag = k === comboKey(REAL.MAIN_LIVE) ? ' [MAIN GEMACH live]' : k === comboKey(REAL.MAIN_SEED) ? ' [MAIN GEMACH seed default]' : k === comboKey(REAL.NEVE) ? ' [NEVE YAAKOV]' : '';
    console.log(`# INFO deliveries A ${k}${tag}: ${st.runs} days, ${st.changed} changed${st.dispatchMoved ? `, ${st.dispatchMoved} dispatch dates moved` : `, +${st.added} rows / -${st.removed} rows`}`);
  }
  assert.equal(stats[comboKey(REAL.MAIN_LIVE)].pairsB, stats[comboKey(REAL.MAIN_LIVE)].pairsA, 'main gemach live (0/0): one-day-before outbounds / rolled returns move between pages, none lost or duplicated');
  assert.ok(stats[comboKey(REAL.MAIN_SEED)].changed > 0 && stats[comboKey(REAL.NEVE)].changed > 0, 'chol hamoed handling is active');
});

test('B. integrity (v2, window mode): every (order, direction) is on exactly one page = the reference dispatch day; by-event dispatchDates = reference', async () => {
  // events whose dispatch days (±2 business days, even across Sukkot) stay inside DAYS
  const INNER = ['2026-10-10', '2027-06-10'];
  for (const combo of [REAL.MAIN_LIVE, REAL.MAIN_SEED, REAL.NEVE, ...COMBOS]) {
    const seen = new Map(); // `${orderId}:${dir}` -> [pages]
    for (const day of eachKey(...DAYS)) {
      const res = await runNew(combo, day);
      for (const r of res.data) {
        for (const dir of r.directions) {
          const id = `${r.orderId}:${dir}`;
          if (!seen.has(id)) seen.set(id, []);
          seen.get(id).push(combo.byEvent ? r.dispatchDates[dir] : day);
        }
      }
    }
    let checked = 0;
    for (const o of ORDERS) {
      if (o.eventKey < INNER[0] || o.eventKey > INNER[1]) continue;
      for (const dir of ['out', 'return']) {
        if (dir === 'out' && o.deliveryDirection === 'חזור') continue;
        if (dir === 'return' && o.deliveryDirection === 'הלוך') continue;
        const n = dir === 'out' ? -(o.deliveryOneDayBefore ? 1 : combo.before) : combo.after;
        // days_after=0 (SCH-DELIV-0): the return is collected on the event day rolled forward to a working day under
        // the FULL rule (independent of delivery_skip_weekends); otherwise the n-business-day walk
        const expected = dir === 'return' && n === 0 ? REF.roll(o.eventKey) : REF.walk(o.eventKey, n, undefined, { skipWeekend: combo.skip });
        const pages = seen.get(`${o.orderId}:${dir}`) || [];
        assert.deepEqual(pages, [expected], `${comboKey(combo)}: order ${o.orderId} (event ${o.eventKey}) ${dir} expected once on ${expected}, got [${pages.join(',')}]`);
        checked++;
      }
    }
    assert.ok(checked > 1000, `${comboKey(combo)}: ${checked} rows checked`);
  }
  console.log('# INFO deliveries B integrity: every order/direction on exactly one page in all 20 combos');
});

test('C. known answers: Sukkot 5787 in the Neve Yaakov configuration (skip on, 2 before, 1 after)', async () => {
  const combo = { skip: true, byEvent: true, before: 2, after: 1 };
  // event Sun 4.10.2026 (first working day after Simchat Torah): v2 dispatches Wed 23.9 (last-but-one working day
  // before the chag: Thu 24.9 = 1, Wed 23.9 = 2); main dispatched Wed 30.9 (chol hamoed). Return: Mon 5.10 in both.
  let [a, b] = await runBoth(combo, '2026-10-04');
  const sun = ORDERS.find((o) => o.eventKey === '2026-10-04' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  assert.deepEqual(b.data.find((r) => r.orderId === sun.orderId).dispatchDates, { out: '2026-09-23', return: '2026-10-05' });
  assert.deepEqual(a.data.find((r) => r.orderId === sun.orderId).dispatchDates, { out: '2026-09-30', return: '2026-10-05' });
  // "one day before" variant of the same event: Thu 24.9 (main: Thu 1.10 = chol hamoed)
  const sun1 = ORDERS.find((o) => o.eventKey === '2026-10-04' && o.deliveryOneDayBefore);
  assert.equal(b.data.find((r) => r.orderId === sun1.orderId).dispatchDates.out, '2026-09-24');
  assert.equal(a.data.find((r) => r.orderId === sun1.orderId).dispatchDates.out, '2026-10-01');
  // event Thu 24.9 (before the chag): out Tue 22.9 in both; return v2 Sun 4.10 (main: Sun 27.9 = chol hamoed)
  [a, b] = await runBoth(combo, '2026-09-24');
  const thu = ORDERS.find((o) => o.eventKey === '2026-09-24' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  assert.deepEqual(b.data.find((r) => r.orderId === thu.orderId).dispatchDates, { out: '2026-09-22', return: '2026-10-04' });
  assert.deepEqual(a.data.find((r) => r.orderId === thu.orderId).dispatchDates, { out: '2026-09-22', return: '2026-09-27' });
  // event during chol hamoed (Tue 29.9): still listed on its own event-date page; out Wed 23.9, return Sun 4.10
  [a, b] = await runBoth(combo, '2026-09-29');
  const chm = ORDERS.find((o) => o.eventKey === '2026-09-29' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  assert.deepEqual(b.data.find((r) => r.orderId === chm.orderId).dispatchDates, { out: '2026-09-23', return: '2026-10-04' });
  assert.deepEqual(a.data.find((r) => r.orderId === chm.orderId).dispatchDates, { out: '2026-09-27', return: '2026-09-30' }, 'main: Mon 28.9 = 1, Sun 27.9 = 2');
  assert.deepEqual(b.data.map((r) => r.orderId), a.data.map((r) => r.orderId), 'same orders on the event-date page');
  // window mode (the same Neve settings with by-event off): the pages of chol hamoed days are empty, Wed 23.9 carries
  // every event from Fri 25.9 to Sun 4.10, Sun 4.10 collects every event from Thu 24.9 to Sat 3.10
  const win = { ...combo, byEvent: false };
  for (const day of eachKey('2026-09-25', '2026-10-03')) {
    const res = await runNew(win, day);
    assert.equal(res.data.length, 0, `${day} (closed) must have an empty page`);
  }
  const wed = await runNew(win, '2026-09-23');
  const outEvents = [...new Set(wed.data.filter((r) => r.directions.includes('out') && !BY_ID.get(r.orderId).deliveryOneDayBefore).map((r) => BY_ID.get(r.orderId).eventKey))].sort();
  assert.deepEqual(outEvents, [...eachKey('2026-09-25', '2026-10-04')]);
  const sun4 = await runNew(win, '2026-10-04');
  const retEvents = [...new Set(sun4.data.filter((r) => r.directions.includes('return')).map((r) => BY_ID.get(r.orderId).eventKey))].sort();
  assert.deepEqual(retEvents, [...eachKey('2026-09-24', '2026-10-03')]);
  // Yom Kippur week is unchanged vs main (no chol hamoed involved): event Tue 22.9 dispatches Wed 16.9 in both
  [a, b] = await runBoth(combo, '2026-09-22');
  const tue = ORDERS.find((o) => o.eventKey === '2026-09-22' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  assert.deepEqual(b.data.find((r) => r.orderId === tue.orderId).dispatchDates, a.data.find((r) => r.orderId === tue.orderId).dispatchDates);
  assert.equal(b.data.find((r) => r.orderId === tue.orderId).dispatchDates.out, '2026-09-16');
});

test('C. known answers: owner list v2 (ranges, recurring Hebrew date) moves dispatch days; retired "open" does not open Friday; broken value = defaults', async () => {
  const combo = { skip: true, byEvent: false, before: 1, after: 1 };
  // event Shabbat 7.11.2026: dispatch Thu 5.11, return Sun 8.11
  const sat = ORDERS.find((o) => o.eventKey === '2026-11-07' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  let found = 0;
  for (const day of eachKey('2026-11-01', '2026-11-14')) {
    const res = await runNew(combo, day);
    const row = res.data.find((r) => r.orderId === sat.orderId);
    if (row) { found++; assert.deepEqual(row.directions, day === '2026-11-05' ? ['out'] : ['return']); assert.ok(day === '2026-11-05' || day === '2026-11-08', day); }
  }
  assert.equal(found, 2);
  // owner closes Thu 5.11 (single day) + Sun-Tue 8-10.11 (range): Shabbat event now dispatches Wed 4.11 and returns Wed 11.11
  const extra = JSON.stringify({ version: 2, days: [{ date: '2026-11-05', note: 'ספירת מלאי' }], ranges: [{ from: '2026-11-08', to: '2026-11-10', note: 'חופשה' }], recurringHebrew: [{ month: 'Kislev', day: 5 }] });
  let b = await runNew(combo, '2026-11-04', extra);
  assert.ok(b.data.some((r) => r.orderId === sat.orderId && r.directions.includes('out')));
  for (const day of ['2026-11-05', '2026-11-08', '2026-11-09', '2026-11-10']) {
    b = await runNew(combo, day, extra);
    assert.equal(b.data.length, 0, `${day} closed by the owner: empty page`);
  }
  b = await runNew(combo, '2026-11-11', extra);
  assert.ok(b.data.some((r) => r.orderId === sat.orderId && r.directions.includes('return')));
  // 5 Kislev 5787 = Sun 15.11.2026 (1 Kislev = Wed 11.11): the recurring day has an empty page, and the Shabbat
  // event of 14.11 whose return would have been Sun 15.11 moves to Mon 16.11
  const kislev5 = B.listNonWorkingDays('2026-11-01', '2026-11-30', extra).find((d) => d.reasons.includes('recurring'));
  assert.equal(kislev5.key, '2026-11-15');
  assert.equal(B.hebrewDateOfKey(kislev5.key).label, 'ה׳ כסלו');
  const rec = await runNew(combo, '2026-11-15', extra);
  assert.equal(rec.data.length, 0, '15.11 (5 Kislev, recurring) must have an empty page');
  const sat14 = ORDERS.find((o) => o.eventKey === '2026-11-14' && !o.deliveryOneDayBefore && o.deliveryDirection === 'הלוך-חזור');
  const mon16 = await runNew(combo, '2026-11-16', extra);
  assert.ok(mon16.data.some((r) => r.orderId === sat14.orderId && r.directions.includes('return')));
  const sun15default = await runNew(combo, '2026-11-15');
  assert.ok(sun15default.data.some((r) => r.orderId === sat14.orderId && r.directions.includes('return')), 'without the owner list the return is Sun 15.11');
  // the retired "open" status does NOT open Friday 6.11 (main would have)
  const [a2, b2] = await runBoth(combo, '2026-11-06', '[{"date":"2026-11-06","status":"open"}]');
  assert.ok(a2.data.some((r) => r.orderId === sat.orderId), 'main: Friday opened');
  assert.equal(b2.data.length, 0, 'v2: Friday stays closed');
  // broken setting value = ignored (defaults only)
  const [a3, b3] = await runBoth(combo, '2026-11-05', '{broken');
  assert.ok(b3.data.some((r) => r.orderId === sat.orderId));
  assert.deepEqual(sig(b3), sig(a3));
});

test('E. a huge delivery_days_before/after setting (100000000) does not hang: capped at 366 business days, answers in well under a second', async () => {
  for (const skip of [false, true]) {
    for (const byEvent of [false, true]) {
      installDb({ settings: settings({ skip, byEvent, before: 100000000, after: 100000000 }), orders: ORDERS });
      invalidateSettingsCache();
      const t0 = Date.now();
      const res = await NEW(localMidnight('2026-11-03'));
      assert.ok(Date.now() - t0 < 1000, `skip=${skip} byEvent=${byEvent} took ${Date.now() - t0}ms`);
      assert.equal(res.daysBefore, 100000000, 'the setting value itself is echoed unchanged');
      assert.equal(res.daysAfter, 100000000);
      if (byEvent) {
        assert.ok(res.data.length > 0);
        const row = res.data.find((r) => r.directions.includes('out'));
        assert.equal(row.dispatchDates.out, B.addBusinessDays('2026-11-03', -366, null, { skipWeekend: skip }));
        assert.equal(row.dispatchDates.return, B.addBusinessDays('2026-11-03', 366, null, { skipWeekend: skip }));
      } else {
        assert.ok(res.data.length > 0);
        for (const r of res.data) {
          assert.deepEqual(r.directions, ['out']);
          const o = BY_ID.get(r.orderId);
          assert.equal(o.deliveryOneDayBefore, true);
          assert.equal(o.eventKey, '2026-11-04');
        }
      }
    }
  }
});

test('D. result/row shape and the Prisma where clause are unchanged vs main when nothing is skipped', async () => {
  const combo = { skip: false, byEvent: false, before: 1, after: 1 };
  const [a, b] = await runBoth(combo, '2026-11-03');
  assert.deepEqual(Object.keys(b), Object.keys(a));
  assert.deepEqual(Object.keys(b.data[0]), Object.keys(a.data[0]));
  assert.deepEqual(sig(b), sig(a));
  const q = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order');
  assert.equal(q.length, 2);
  assert.deepEqual(q[1].args, q[0].args, 'identical findMany arguments (main vs v2) on a plain Tuesday');
  assert.deepEqual(q[1].args.where.OR, [
    { eventDate: { gte: getIsraelDayRange('2026-11-04').start, lte: getIsraelDayRange('2026-11-04').end } },
    { eventDate: { gte: getIsraelDayRange('2026-11-02').start, lte: getIsraelDayRange('2026-11-02').end } },
  ]);
  // skip on, Thursday: the outbound window spans Fri..Sun (one contiguous range), return Wed only
  await runBoth({ ...combo, skip: true }, '2026-11-05');
  const q2 = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').at(-1);
  assert.deepEqual(q2.args.where.OR, [
    { eventDate: { gte: getIsraelDayRange('2026-11-06').start, lte: getIsraelDayRange('2026-11-08').end } },
    { eventDate: { gte: getIsraelDayRange('2026-11-04').start, lte: getIsraelDayRange('2026-11-04').end } },
  ]);
  // Shabbat page / chol hamoed page in window mode: no query at all
  for (const day of ['2026-11-07', '2026-09-29']) {
    installDb({ settings: settings({ ...combo, skip: true }), orders: ORDERS });
    invalidateSettingsCache();
    const res = await NEW(localMidnight(day));
    assert.deepEqual(res, { daysBefore: 1, daysAfter: 1, selectByEventDate: false, data: [] });
    assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 0, `${day}: no query`);
  }
  // daysBefore=0: the event day itself, even on Shabbat (n=0 is the day itself)
  installDb({ settings: settings({ ...combo, skip: true, before: 0 }), orders: ORDERS });
  invalidateSettingsCache();
  const res0 = await NEW(localMidnight('2026-11-07'));
  assert.ok(res0.data.some((r) => r.directions.includes('out')));
  assert.ok(!res0.data.some((r) => r.directions.includes('return')), 'return window (n=1) still empty on Shabbat');
});

// F. SCH-DELIV-0 (owner decision 4.10.2026, option B): delivery_days_after = 0 is NOT a parity case any more. The old
// code collected on the event day itself even when it was closed; now a closed event day (Fri / Shabbat / chag / erev
// chag / owner-closed - the full rule, like manual returns, whatever delivery_skip_weekends says) rolls the return
// pick-up to the next working day. The outbound direction must be untouched by the return setting, and on a working
// day with no closed day right before it the result equals the old code exactly.
const D_PREV = (k) => { const [y, m, d] = k.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d - 1)); return t.toISOString().slice(0, 10); };
test('F. days_after=0 (SCH-DELIV-0): returns follow rollForwardToWorkingDay; outbound untouched; working days without a closed run before them = old code', async () => {
  const dirSet = (res, dir) => res.data.filter((r) => r.directions.includes(dir)).map((r) => r.orderId).sort((x, y) => x - y);
  let checks = 0, rolled = 0;
  for (const skip of [false, true]) {
    for (const byEvent of [false, true]) {
      const combo0 = { skip, byEvent, before: 1, after: 0 };
      for (const day of eachKey(...DAYS)) {
        const [a, b] = await runBoth(combo0, day);
        installDb({ settings: settings({ ...combo0, after: 1 }), orders: ORDERS });
        invalidateSettingsCache();
        const b1 = await NEW(localMidnight(day));
        const tag = `${JSON.stringify(combo0)} ${day}`;
        assert.deepEqual(dirSet(b, 'out'), dirSet(b1, 'out'), `${tag}: outbound must not depend on delivery_days_after`);
        if (byEvent) {
          // by-event page = the event day: same orders/directions as the old code, only the return pick-up day may move
          assert.deepEqual(b.data.map((r) => r.orderId), a.data.map((r) => r.orderId), tag);
          for (const r of b.data) {
            if (!r.directions.includes('return')) continue;
            const ev = BY_ID.get(r.orderId).eventKey;
            assert.equal(r.dispatchDates.return, B.rollForwardToWorkingDay(ev), `${tag} order ${r.orderId}`);
            if (r.dispatchDates.return !== ev) { rolled++; assert.ok(B.isNonWorkingDay(ev), `${tag}: only a closed event day moves`); }
          }
        } else {
          const want = ORDERS.filter((o) => o.deliveryDirection !== 'הלוך' && B.rollForwardToWorkingDay(o.eventKey) === day).map((o) => o.orderId).sort((x, y) => x - y);
          assert.deepEqual(dirSet(b, 'return'), want, `${tag}: return = every event whose rolled pick-up day is this day`);
          if (B.isNonWorkingDay(day)) assert.equal(dirSet(b, 'return').length, 0, `${tag}: a closed day collects nothing`);
          else if (!B.isNonWorkingDay(D_PREV(day))) assert.deepEqual(dirSet(b, 'return'), dirSet(a, 'return'), `${tag}: no closed day before -> same as the old code`);
          else rolled++;
        }
        checks++;
      }
    }
  }
  console.log(`# INFO deliveries F (days_after=0): ${checks} day/combo runs checked, ${rolled} roll-forward cases`);
  assert.ok(rolled > 0);
});
