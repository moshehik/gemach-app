// Overdue-families popup rule (report 749aaf87): lib/overduePopup.js. Claims proven:
//  1. With both new settings unset the popup decision equals the old one (getLateReturnInfo(o, T).isLate) for every event day,
//     both storage forms of eventDate and several "now" instants - i.e. today's behaviour is unchanged.
//  2. Neve values (threshold 0 + after-hour 14): an order whose event was yesterday (expected return = today) shows only
//     from 14:00 Israel time; an order 2+ working days past its expected return shows at any hour; closed days are skipped.
//  3. The Israel hour is used, not the server clock (this file runs in several process time zones, incl. DST dates).
//  4. Settings parsing: 0 is a valid threshold (no "||" fallback), blank / garbage falls back, hour accepts "14" and "14:00".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, eachKey, addKey } from './fixtures.mjs';

const B = await L('lib/businessDays.js');
const { getLateReturnInfo } = await L('lib/lateReturn.js');
const { parseOverduePopupConfig, getOverduePopupInfo, getIsraelMinutesOfDay } = await L('lib/overduePopup.js');

const ev = (k) => ({ eventDate: `${k}T00:00:00.000Z` });
const NEVE = parseOverduePopupConfig({ popupThreshold: '0', lateThreshold: '7', afterHour: '14' });
const show = (o, cfg, iso) => getOverduePopupInfo(o, cfg, { now: new Date(iso) }).show;

test('config parsing: 0 is valid, blank/garbage falls back, hour accepts 14 / 14:00 / 9:30 and rejects 24 / abc', () => {
  const p = (popupThreshold, afterHour, lateThreshold = '7') => parseOverduePopupConfig({ popupThreshold, lateThreshold, afterHour });
  assert.deepEqual(p('0', '14'), { threshold: 0, afterMinutes: 840 });
  assert.deepEqual(p(undefined, undefined), { threshold: 7, afterMinutes: null }, 'unset = old behaviour');
  assert.deepEqual(p('', '', '3'), { threshold: 3, afterMinutes: null }, 'blank follows late_return_threshold_days');
  assert.deepEqual(p(undefined, undefined, undefined), { threshold: 7, afterMinutes: null }, 'both unset = built-in 7');
  assert.equal(p('abc').threshold, 7);
  assert.equal(p('-1').threshold, 7);
  assert.equal(p('1.5').threshold, 7);
  assert.equal(p('2').threshold, 2);
  assert.equal(p('500').threshold, 90);
  assert.equal(p('0', '14:00').afterMinutes, 840);
  assert.equal(p('0', '9:30').afterMinutes, 570);
  assert.equal(p('0', '0').afterMinutes, 0);
  for (const bad of ['24', 'abc', '14:60', '-1', '1.5']) assert.equal(p('0', bad).afterMinutes, null, bad);
});

test('defaults (both settings unset): popup decision == getLateReturnInfo(o, T).isLate for every event day, both storage forms, several nows', () => {
  const NOWS = ['2026-09-29T09:00:00Z', '2026-10-01T21:30:00Z', '2026-11-04T05:00:00Z', '2027-04-30T12:00:00Z', '2026-03-26T22:30:00Z'];
  let n = 0;
  for (const T of ['7', '3', '1']) {
    const cfg = parseOverduePopupConfig({ lateThreshold: T });
    for (const k of eachKey('2026-08-01', '2027-06-30')) {
      for (const stored of [`${k}T00:00:00.000Z`, `${addKey(k, -1)}T21:00:00.000Z`]) {
        for (const iso of NOWS) {
          const now = new Date(iso);
          const old = getLateReturnInfo({ eventDate: stored }, Number(T), now);
          const neu = getOverduePopupInfo({ eventDate: stored }, cfg, { now });
          assert.equal(neu.show, old.isLate, `${stored} now=${iso} T=${T}`);
          assert.equal(neu.daysLate, old.daysLate);
          n++;
        }
      }
    }
  }
  assert.ok(n > 5000);
});

test('defaults: explicit toDate/returnDate, invalid and missing dates behave as before', () => {
  const cfg = parseOverduePopupConfig({ lateThreshold: '7' });
  const now = new Date('2026-11-20T10:00:00Z');
  for (const o of [{ toDate: '2026-11-10T00:00:00.000Z' }, { returnDate: '2026-11-13T00:00:00.000Z' }, { toDate: 'garbage' }, { eventDate: null }, {}, { eventDate: '2026-11-13T00:00:00.000Z', toDate: '2026-11-19T00:00:00.000Z' }]) {
    assert.equal(getOverduePopupInfo(o, cfg, { now }).show, getLateReturnInfo(o, 7, now).isLate, JSON.stringify(o));
  }
  assert.equal(getOverduePopupInfo(null, cfg, { now }).show, false);
});

test('Neve rule (0 + 14:00): event yesterday shows only from 14:00 Israel; 2+ days ago any hour (winter, UTC+2)', () => {
  // Mon 2.11.2026 event -> expected return Tue 3.11 (working day). 14:00 Israel = 12:00Z in winter.
  const o = ev('2026-11-02');
  assert.equal(show(o, NEVE, '2026-11-02T20:00:00Z'), false, 'event day itself, evening');
  assert.equal(show(o, NEVE, '2026-11-03T00:30:00Z'), false, 'Tue 02:30 Israel');
  assert.equal(show(o, NEVE, '2026-11-03T11:59:00Z'), false, 'Tue 13:59 Israel');
  assert.equal(show(o, NEVE, '2026-11-03T12:00:00Z'), true, 'Tue 14:00 Israel');
  assert.equal(show(o, NEVE, '2026-11-03T18:00:00Z'), true, 'Tue evening');
  assert.equal(show(o, NEVE, '2026-11-03T22:10:00Z'), true, 'Wed 00:10 Israel (daysLate 1, any hour)');
  assert.equal(show(o, NEVE, '2026-11-04T06:00:00Z'), true, 'Wed morning');
  assert.equal(show(ev('2026-10-30'), NEVE, '2026-11-03T05:00:00Z'), true, 'older event, early morning');
});

test('Neve rule: DST (summer, UTC+3) - 14:00 Israel = 11:00Z, not 12:00Z', () => {
  const o = ev('2026-08-03'); // Mon -> expected return Tue 4.8
  assert.equal(show(o, NEVE, '2026-08-04T10:59:00Z'), false, '13:59 Israel');
  assert.equal(show(o, NEVE, '2026-08-04T11:00:00Z'), true, '14:00 Israel');
});

test('Neve rule: closed days are skipped (Thu event -> return Sun; nothing on Fri/Sat; Sun shows from 14:00)', () => {
  const o = ev('2026-11-05'); // Thu
  assert.equal(show(o, NEVE, '2026-11-06T13:00:00Z'), false, 'Fri afternoon');
  assert.equal(show(o, NEVE, '2026-11-07T13:00:00Z'), false, 'Sat afternoon');
  assert.equal(show(o, NEVE, '2026-11-08T11:59:00Z'), false, 'Sun 13:59');
  assert.equal(show(o, NEVE, '2026-11-08T12:00:00Z'), true, 'Sun 14:00');
  // an owner-closed Tuesday after a Monday event pushes the return to Wednesday
  const closed = B.parseNonWorkingDaysSetting(JSON.stringify({ version: 2, days: [{ date: '2026-11-03' }], ranges: [], recurringHebrew: [] }));
  assert.equal(getOverduePopupInfo(ev('2026-11-02'), NEVE, { now: new Date('2026-11-03T18:00:00Z'), nonWorkingDays: closed }).show, false);
  assert.equal(getOverduePopupInfo(ev('2026-11-02'), NEVE, { now: new Date('2026-11-04T12:00:00Z'), nonWorkingDays: closed }).show, true);
});

test('Neve rule: independent reference over every event day (show == expected due day passed, or due day today and >= 14:00 Israel)', () => {
  const dueOf = (k) => B.nextWorkingDay(k, null);
  let n = 0;
  for (const k of eachKey('2026-08-01', '2027-03-31')) {
    const due = dueOf(k);
    for (const iso of [`${addKey(due, -1)}T22:00:00Z`, `${due}T00:00:00Z`, `${due}T09:00:00Z`, `${due}T11:30:00Z`, `${due}T12:30:00Z`, `${due}T20:00:00Z`, `${addKey(due, 1)}T01:00:00Z`, `${addKey(due, 3)}T06:00:00Z`]) {
      const now = new Date(iso);
      const il = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const mins = getIsraelMinutesOfDay(now);
      const want = il > due || (il === due && mins >= 840);
      assert.equal(show(ev(k), NEVE, iso), want, `event ${k} due ${due} now ${iso} (IL ${il} ${mins})`);
      n++;
    }
  }
  assert.ok(n > 1500);
});

test('hour without a day threshold override: after-hour only affects the exact threshold day (T=7 + 14:00)', () => {
  const cfg = parseOverduePopupConfig({ lateThreshold: '7', afterHour: '14' });
  const o = ev('2026-11-02'); // due Tue 3.11 -> daysLate 7 on Tue 10.11
  assert.equal(show(o, cfg, '2026-11-10T09:00:00Z'), false, '11:00 Israel, daysLate 7');
  assert.equal(show(o, cfg, '2026-11-10T12:00:00Z'), true, '14:00 Israel');
  assert.equal(show(o, cfg, '2026-11-11T05:00:00Z'), true, 'daysLate 8 any hour');
  assert.equal(show(o, cfg, '2026-11-09T20:00:00Z'), false, 'daysLate 6 never');
});
