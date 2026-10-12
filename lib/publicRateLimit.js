// lib/publicRateLimit.js - הגבלת קצב פשוטה לנתיבים ציבוריים בלי התחברות (GET /api/public-terms, GET /api/public-consent-info).
// בזיכרון של האינסטנס (חלון נע של דקה לכל IP): מספיק נגד הצפה / סריקה מאינסטנס חם אחד; בשרתים ללא מצב (Vercel) כל אינסטנס סופר לבד,
// ולכן זו הגנה בסיסית ולא מכסה גלובלית. הנתיבים האלה גם ממוטמנים (ETag + Cache-Control), כך שעומס אמיתי לא מגיע ל-DB.
export const PUBLIC_WINDOW_MS = 60 * 1000;
export const PUBLIC_MAX_PER_WINDOW = 60;

const buckets = new Map(); // key -> { start, n }

/** -> {ok:true} וסופר בקשה, או {ok:false, retryAfterSec}. key = IP (או 'anon' כשאין כותרת). */
export function admitPublic(key, { max = PUBLIC_MAX_PER_WINDOW, windowMs = PUBLIC_WINDOW_MS, now = Date.now() } = {}) {
  const k = String(key || 'anon').slice(0, 80);
  if (buckets.size > 5000) for (const [kk, b] of buckets) if (now - b.start >= windowMs) buckets.delete(kk);
  let b = buckets.get(k);
  if (!b || now - b.start >= windowMs) { b = { start: now, n: 0 }; buckets.set(k, b); }
  if (b.n >= max) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.start + windowMs - now) / 1000)) };
  b.n += 1;
  return { ok: true };
}

/** ה-IP של הפונה מכותרות הבקשה (Vercel: x-forwarded-for, הכתובת הראשונה). */
export function clientIpFromHeaders(headers) {
  try {
    const xff = headers.get('x-forwarded-for') || '';
    const first = xff.split(',')[0].trim();
    return first || headers.get('x-real-ip') || 'anon';
  } catch { return 'anon'; }
}

export function resetPublicRateLimit() { buckets.clear(); }
