// lib/eventRateLimit.js - H6 hardening: POST /api/orders/events writes history rows on behalf of the session employee, so any logged-in
// employee could flood the history of every order (or forge a stream of ORDER_PRINTED rows). One in-process guard (per serverless instance,
// enough for flood control; the rows stay attributable to the session employee): at most MAX_ROWS_PER_WINDOW rows per employee per minute
// (a full 200-order batch print is one chunk of 200 rows, so real use is far below the cap). Repeated identical events are deliberately NOT
// collapsed - two prints of the same order are two prints; the client's clientEventId already makes a retry idempotent.
export const WINDOW_MS = 60 * 1000;
export const MAX_ROWS_PER_WINDOW = 1000;

const windows = new Map(); // actor -> { start, rows }

// -> { ok:true } and the rows are counted, or { ok:false } (nothing counted)
export function admitEvents({ actorId, count, now = Date.now() }) {
  const actor = actorId || 'anonymous';
  if (windows.size > 2000) for (const [k, w] of windows) if (now - w.start >= WINDOW_MS) windows.delete(k);
  let w = windows.get(actor);
  if (!w || now - w.start >= WINDOW_MS) { w = { start: now, rows: 0 }; windows.set(actor, w); }
  if (w.rows + count > MAX_ROWS_PER_WINDOW) return { ok: false };
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
