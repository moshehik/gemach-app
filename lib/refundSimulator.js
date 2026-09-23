// Pure (no DB, no React) day-level simulator of the cancellation/swap policy implemented in
// lib/pricingCalc.js -> computeOrderObligations, as documented in
// docs/refund-swap-policy-2026-09-22.md (updated 2026-09-22, PR #103 - do NOT confuse with the
// older three-tier-only model this replaced). Used by /admin/refund-planner. Keep in lock-step
// with the real engine - this is a simplified, single-item, day-granularity restatement of it,
// not an independent policy.
//
// Days are handled as integer "day numbers" (whole days since 1970-01-01, UTC) parsed from
// YYYY-MM-DD strings, so DST and time-of-day never shift a boundary. The real engine compares
// full timestamps against a reference moment; at day granularity both cutoffs are inclusive.

export const TIERS = {
  full: { key: 'full', label: 'החזר מלא', short: 'מלא' },
  partial: { key: 'partial', label: 'החזר חלקי', short: 'חלקי' },
  none: { key: 'none', label: 'ללא החזר', short: 'ללא' },
};

// The engine's own fallbacks when a SystemSetting row is missing (getSetting/getNonNegativeNumber
// defaults in lib/pricingCalc.js). instantUndoMinutes is nullable on purpose: null there means
// "not set - falls back to creditMinutes", exactly like the real engine's instant_undo_minutes.
export const DEFAULT_POLICY = {
  fullDays: 7,               // REFUND_DAYS_FROM_ORDER
  noRefundDays: 7,           // NO_REFUND_DAYS_BEFORE_EVENT
  percent: 100,              // REFUND_PERCENTAGE (0-100)
  refundRepairs: false,      // REFUND_REPAIRS
  creditMinutes: 15,         // CANCELLATION_CREDIT_MINUTES - ONLY the replacement-item credit window
  instantUndoMinutes: null,  // instant_undo_minutes - null/empty falls back to creditMinutes
  sameModelSwap: false,      // same_model_swap_no_fee - main switch for free size swap
  swapMinDays: 0,            // swap_min_days_before_event - 0 = no limit
  swapSameCategoryOnly: false, // swap_same_category_only
  swapPairingWindowMinutes: 0, // swap_pairing_window_minutes - 0 = no limit (any active same-model item)
  refundTiersAtDeletion: false, // refund_tiers_at_deletion_time - see explainer in the planner UI
};

const MS_PER_DAY = 86400000;

export function ymdToDay(ymd) {
  if (typeof ymd !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return NaN;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS_PER_DAY);
}

export function dayToYmd(day) {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

// A Date whose *local* getters (getDay/getDate/toLocaleDateString) read the same calendar day
// as the given day number - safe to hand to lib/hebrewDate.js helpers (they use local getters
// and HDate(Date), which itself reads the local calendar day).
export function dayToLocalDate(day) {
  const [y, m, d] = dayToYmd(day).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function todayDay(now = new Date()) {
  // Israel calendar day (the gemach is in Israel; the browser may not be)
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
  return ymdToDay(s);
}

const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
// Like num(), but an empty/invalid value means "unset" (null) rather than falling back to a
// default - mirrors the engine's getNonNegativeNumber() for instant_undo_minutes.
const nullableNonNegNum = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function normalizePolicy(p = {}) {
  const creditMinutes = Math.max(0, num(p.creditMinutes, DEFAULT_POLICY.creditMinutes));
  const instantUndoRaw = nullableNonNegNum(p.instantUndoMinutes);
  return {
    fullDays: Math.max(0, num(p.fullDays, DEFAULT_POLICY.fullDays)),
    noRefundDays: Math.max(0, num(p.noRefundDays, DEFAULT_POLICY.noRefundDays)),
    percent: Math.min(100, Math.max(0, num(p.percent, DEFAULT_POLICY.percent))),
    refundRepairs: !!p.refundRepairs,
    creditMinutes,
    instantUndoMinutes: instantUndoRaw,                    // raw (nullable) - for the UI to show "same as credit window"
    effectiveInstantUndoMinutes: instantUndoRaw !== null ? instantUndoRaw : creditMinutes, // what the engine actually uses
    sameModelSwap: !!p.sameModelSwap,
    swapMinDays: Math.max(0, num(p.swapMinDays, DEFAULT_POLICY.swapMinDays)),
    swapSameCategoryOnly: !!p.swapSameCategoryOnly,
    swapPairingWindowMinutes: Math.max(0, num(p.swapPairingWindowMinutes, DEFAULT_POLICY.swapPairingWindowMinutes)),
    refundTiersAtDeletion: !!p.refundTiersAtDeletion,
  };
}

// Which of the three windows a cancellation on `day` falls into (the "regular cancellation" path -
// unaffected by swap/credit/instant-undo, which are separate mechanisms layered on top).
// Same precedence as the engine: no-refund (near the event) > full (near the order) > partial.
export function tierForDay(day, orderDay, eventDay, policy) {
  const p = normalizePolicy(policy);
  const isNoRefund = day >= eventDay - p.noRefundDays;
  const isFullRefund = day <= orderDay + p.fullDays;
  if (isNoRefund) return 'none';
  if (isFullRefund) return 'full';
  return 'partial';
}

// Whether a free size-swap on `day` would still be eligible on timing alone (same_model_swap_no_fee
// must also be on; category/pairing-window conditions are per-item and modelled by the caller).
export function isSwapWindowOpen(day, eventDay, policy) {
  const p = normalizePolicy(policy);
  if (!p.sameModelSwap) return false;
  if (p.swapMinDays <= 0) return true; // 0/unset = no limit, matches the engine
  return (eventDay - day) >= p.swapMinDays;
}

// Money for cancelling one item in a given tier - mirrors R / C / itemLost / feeAmount in the engine.
//  price   - the dress price (₪), repairs - total repair cost (₪), deposit - fixed middle-tier refund (₪, 0 = use %)
//  swap    - true when a same-model swap pair applies: bypasses the tier entirely with a full
//            refund of the dress (R = itemRefundableValue), exactly like the engine's isSameModelSwap branch.
//            Repairs (itemLost) are still always charged, swap or not.
export function computeItemRefund({ tier, price, repairs = 0, deposit = 0, policy, swap = false }) {
  const p = normalizePolicy(policy);
  const base = Math.max(0, num(price));
  const rep = Math.max(0, num(repairs));
  const dep = Math.max(0, num(deposit));

  const itemLost = p.refundRepairs ? 0 : rep;                 // repairs are never refunded by default
  const refundable = base + (p.refundRepairs ? rep : 0);
  let refund;
  if (swap) refund = refundable;
  else if (tier === 'none') refund = 0;
  else if (tier === 'full') refund = refundable;
  else if (dep > 0) refund = dep + (p.refundRepairs ? rep : 0);
  else refund = refundable * (p.percent / 100);

  refund = Math.min(refundable, Math.max(0, refund));
  const dressFee = Math.max(0, refundable - refund);          // "C" in the engine - the unrefunded dress part
  const originalCharge = base + rep;
  const fee = dressFee + itemLost;                            // דמי ביטול ותיקונים
  return {
    originalCharge,
    refund,                                                   // what the customer effectively gets back
    fee,
    dressFee,
    repairsKept: itemLost,
    refundable,
    refundPct: originalCharge > 0 ? (refund / originalCharge) * 100 : 0,
  };
}

// Contiguous same-tier runs over [startDay, endDay] (inclusive) - the coloured bands of the timeline.
// Swap eligibility is a separate overlay (isSwapWindowOpen), not folded into these segments.
export function buildSegments(startDay, endDay, orderDay, eventDay, policy) {
  const segs = [];
  const p = normalizePolicy(policy);
  for (let d = startDay; d <= endDay; d++) {
    const tier = tierForDay(d, orderDay, eventDay, p);
    const last = segs[segs.length - 1];
    if (last && last.tier === tier) last.to = d;
    else segs.push({ tier, from: d, to: d });
  }
  return segs;
}

// One structured explanation for a cancellation day - the UI renders the Hebrew sentence.
export function explainDay(day, orderDay, eventDay, policy) {
  const p = normalizePolicy(policy);
  const tier = tierForDay(day, orderDay, eventDay, policy);
  const sinceOrder = day - orderDay;
  const untilEvent = eventDay - day;
  const fullOverlapsNone = orderDay + p.fullDays >= eventDay - p.noRefundDays;
  const swapOpen = isSwapWindowOpen(day, eventDay, p);
  let reason;
  if (tier === 'none') {
    reason = untilEvent < 0
      ? 'האירוע כבר עבר - אין החזר.'
      : `נשארו ${untilEvent} ימים לאירוע - פחות מ-${p.noRefundDays} ימי החסימה, ולכן אין החזר (קרבה לאירוע גוברת על כל חלון אחר).`;
  } else if (tier === 'full') {
    reason = sinceOrder < 0
      ? 'לפני ביצוע ההזמנה.'
      : `עברו ${sinceOrder} ימים מביצוע ההזמנה - בתוך חלון ההחזר המלא (${p.fullDays} ימים) והאירוע עוד רחוק (${untilEvent} ימים).`;
  } else {
    reason = `עברו ${sinceOrder} ימים מההזמנה (יותר מ-${p.fullDays}) ועדיין ${untilEvent} ימים לאירוע (יותר מ-${p.noRefundDays}) - אזור אמצעי.`;
  }
  return { tier, sinceOrder, untilEvent, reason, fullOverlapsNone, swapOpen };
}
