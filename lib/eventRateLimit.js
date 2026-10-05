// lib/eventRateLimit.js - H6 hardening: POST /api/orders/events writes history rows on behalf of the session employee, so any logged-in
// employee could flood the history of every order (or forge a stream of ORDER_PRINTED rows). One in-process guard (per serverless instance,
// enough for flood control; the rows stay attributable to the session employee): at most MAX_ROWS_PER_WINDOW rows per employee per minute.
// Sizing: the schedule-day print (app/schedule/print/[page]/page.js) writes ONE ROW PER ORDER PER PAGE of the document, in chunks of 200
// orders per request - a 150-order day printed as a 12-page document is 1800 rows in one go, and a worker reprinting a few days within a
// minute can pass 3000. 1000 used to drop those print-history rows silently (429 on a fire-and-forget request), so the cap is 5000: still
// far above any honest use (a human cannot print more than that in a minute) and, at one row per request-order, a flood is bounded to
// 5000 audit rows per employee per minute instead of unlimited.
// Open mode (require_login off) has no identity: every request is the one 'anonymous' actor, so that single bucket is shared by every
// user of the gemach and gets the larger MAX_ROWS_ANONYMOUS. Repeated identical events are deliberately NOT collapsed - two prints of the
// same order are two prints; the client's clientEventId already makes a retry idempotent.
export const WINDOW_MS = 60 * 1000;
export const MAX_ROWS_PER_WINDOW = 5000;
export const MAX_ROWS_ANONYMOUS = 10000;

const windows = new Map(); // actor -> { start, rows }

// -> { ok:true } and the rows are counted, or { ok:false } (nothing counted)
export function admitEvents({ actorId, count, now = Date.now() }) {
  const actor = actorId || 'anonymous';
  if (windows.size > 2000) for (const [k, w] of windows) if (now - w.start >= WINDOW_MS) windows.delete(k);
  let w = windows.get(actor);
  if (!w || now - w.start >= WINDOW_MS) { w = { start: now, rows: 0 }; windows.set(actor, w); }
  if (w.rows + count > (actorId ? MAX_ROWS_PER_WINDOW : MAX_ROWS_ANONYMOUS)) return { ok: false };
  w.rows += count;
  return { ok: true };
}

// the write failed after admitEvents(): give the rows back so the client's retry is not counted twice
export function releaseEvents({ actorId, count }) {
  const w = windows.get(actorId || 'anonymous');
  if (w) w.rows = Math.max(0, w.rows - count);
}

export function resetEventRateLimit() {
  windows.clear();
}
