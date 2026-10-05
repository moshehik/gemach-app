// Shared helpers for the business-days tests. No DB.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { HebrewCalendar, flags } from '@hebcal/core';

export const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
// frozen copies of origin/main (the "before" oracles) - scripts/business-days-tests/legacy/*.main.mjs
export const LM = (name) => import(pathToFileURL(path.join(process.env.SPDIR, 'legacy', `${name}.main.mjs`)).href);

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

// Chol hamoed days straight from hebcal, keyed through the absolute day number (R.D.) -> UTC
// arithmetic: a different path than lib/businessDays.js (which reads greg() local components),
// so the two agree only if both are right. 719163 = R.D. of 1970-01-01.
const chmByYear = new Map();
export function cholHamoedKeys(year) {
  let set = chmByYear.get(year);
  if (set) return set;
  set = new Set();
  for (const ev of HebrewCalendar.calendar({ year, isHebrewYear: false, il: true, noMinorFast: true, noRoshChodesh: true, noModern: true })) {
    if (ev.getFlags() & flags.CHOL_HAMOED) set.add(new Date((ev.getDate().abs() - 719163) * 86400000).toISOString().slice(0, 10));
  }
  chmByYear.set(year, set);
  return set;
}
export const isCholHamoed = (key) => cholHamoedKeys(Number(key.slice(0, 4))).has(key);

// Reference implementation of the v2 rule, written independently of lib/businessDays.js:
// Fri/Sat (optional) + chag/erev chag (via the EXISTING isChagDay on a local-midnight Date) +
// chol hamoed (hebcal, above) + a plain Set of owner-closed keys. No "open" (removed in v2).
export function makeRef(isChagDay) {
  // memoized per key: isChagDay builds a hebcal calendar on every call, and the brute-force
  // inverse check below calls it millions of times
  const memo = new Map();
  const chagOrErev = (key) => { let v = memo.get(key); if (v === undefined) { v = isChagDay(localMidnight(key)); memo.set(key, v); } return v; };
  const holiday = (key) => chagOrErev(key) || isCholHamoed(key);
  const nonWorking = (key, closed = new Set(), o = {}) => {
    const skipWeekend = o.skipWeekend !== false, skipHolidays = o.skipHolidays !== false;
    if (closed.has(key)) return true;
    if (skipWeekend && isFriSat(key)) return true;
    if (skipHolidays && holiday(key)) return true;
    return false;
  };
  const walk = (key, n, closed, o) => {
    if (!n) return key;
    const step = n > 0 ? 1 : -1;
    let left = Math.abs(n), cur = key;
    while (left > 0) { cur = addKey(cur, step); if (nonWorking(cur, closed, o)) continue; left--; }
    return cur;
  };
  // brute-force inverse: all E within ±60 days with walk(E, n) === target
  const inverse = (target, n, closed, o) => {
    const out = [];
    for (let i = -60; i <= 60; i++) { const e = addKey(target, i); if (walk(e, n, closed, o) === target) out.push(e); }
    return out;
  };
  // rollForwardToWorkingDay reference: the day itself when working, else the first working day after it (full rule)
  const roll = (key, closed, o) => (nonWorking(key, closed, o) ? walk(key, 1, closed, o) : key);
  return { chagOrErev, holiday, nonWorking, walk, inverse, roll };
}

// true when a chol-hamoed day lies in the inclusive range between k1 and k2 (either order).
export function cholHamoedBetween(k1, k2) {
  const lo = k1 < k2 ? k1 : k2, hi = k1 < k2 ? k2 : k1;
  for (const k of eachKey(lo, hi)) if (isCholHamoed(k)) return true;
  return false;
}

export function installDb({ settings = [], orders = [] } = {}) {
  globalThis.__SETTINGS = settings;
  globalThis.__ORDERS = orders;
  globalThis.__MOCK_CALLS = [];
}
