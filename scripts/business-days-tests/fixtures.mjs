// Shared helpers for the business-days tests. No DB.
import { pathToFileURL } from 'node:url';

export const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);

export const addKey = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
export const weekday = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const isFriSat = (key) => { const w = weekday(key); return w === 5 || w === 6; };
export const localMidnight = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
export const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function* eachKey(startKey, endKey) {
  for (let k = startKey; k <= endKey; k = addKey(k, 1)) yield k;
}

// Reference implementation of the rule, written independently of lib/businessDays.js:
// Fri/Sat (optional) + holiday (via the EXISTING isChagDay on a local-midnight Date) + closed/open sets.
export function makeRef(isChagDay) {
  // memoized per key: isChagDay builds a hebcal calendar on every call, and the brute-force
  // inverse check below calls it millions of times
  const memo = new Map();
  const holiday = (key) => { let v = memo.get(key); if (v === undefined) { v = isChagDay(localMidnight(key)); memo.set(key, v); } return v; };
  const nonWorking = (key, cfg = { closed: new Set(), open: new Set() }, o = {}) => {
    const skipWeekend = o.skipWeekend !== false, skipHolidays = o.skipHolidays !== false;
    if (cfg.open.has(key) && !cfg.closed.has(key)) return false;
    if (cfg.closed.has(key)) return true;
    if (skipWeekend && isFriSat(key)) return true;
    if (skipHolidays && holiday(key)) return true;
    return false;
  };
  const walk = (key, n, cfg, o) => {
    if (!n) return key;
    const step = n > 0 ? 1 : -1;
    let left = Math.abs(n), cur = key;
    while (left > 0) { cur = addKey(cur, step); if (nonWorking(cur, cfg, o)) continue; left--; }
    return cur;
  };
  // brute-force inverse: all E within ±60 days with walk(E, n) === target
  const inverse = (target, n, cfg, o) => {
    const out = [];
    for (let i = -60; i <= 60; i++) { const e = addKey(target, i); if (walk(e, n, cfg, o) === target) out.push(e); }
    return out;
  };
  return { holiday, nonWorking, walk, inverse };
}

// A config that marks every holiday/erev-chag in [start, end] as "open" - turns the new rule back
// into the OLD rule so before/after can be compared on non-holiday terms. "open" overrides the
// weekend rule as well (by design), so for comparisons that SKIP weekends pass keepWeekend:true
// (holidays falling on Fri/Sat stay closed as weekend days, exactly like the old Fri/Sat rule);
// for plain calendar-day comparisons open everything.
export function allHolidaysOpen(isHolidayKey, startKey, endKey, { keepWeekend = false } = {}) {
  const open = new Set();
  for (const k of eachKey(startKey, endKey)) if (isHolidayKey(k) && !(keepWeekend && isFriSat(k))) open.add(k);
  return { closed: new Set(), open, notes: new Map(), invalid: 0 };
}

export function installDb({ settings = [], orders = [] } = {}) {
  globalThis.__SETTINGS = settings;
  globalThis.__ORDERS = orders;
  globalThis.__MOCK_CALLS = [];
}
