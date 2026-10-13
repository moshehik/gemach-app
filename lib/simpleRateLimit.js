// lib/simpleRateLimit.js - הגבלת קצב פשוטה בזיכרון האינסטנס (מספיקה להגנה מלולאה/הצפה; לא מחליפה הגנה מבוזרת).
const buckets = new Map();

/** true = מותר (נספר); false = חרג. */
export function allow(key, max, windowMs, now = Date.now()) {
  if (buckets.size > 5000) for (const [k, b] of buckets) if (now - b.start >= b.windowMs) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) { b = { start: now, count: 0, windowMs }; buckets.set(key, b); }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export function resetRateLimits() { buckets.clear(); }
