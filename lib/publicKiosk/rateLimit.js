// lib/publicKiosk/rateLimit.js - מגבלת קצב לנתיבים הציבוריים של עמדת הלקוח (/api/public-kiosk/*).
// בריפו אין מגביל IP קיים (lib/eventRateLimit.js מגביל לפי עובד מחובר, לא מתאים לציבור) - לכן מגביל חלון-קבוע בזיכרון התהליך.
// מגבלה מוכרת: זיכרון לכל אינסטנס serverless (כמו lib/eventRateLimit.js) - מספיק לבלימת הצפה/ניחוש מאותו מקור, לא הגנה מבוזרת מלאה.
// לכן יש בנוסף תקרה גלובלית לכל אינסטנס (GLOBAL) שחוסמת הצפה מאלפי כתובות שונות.
export const WINDOW_MS = 60 * 1000;

// { perIp: מקס' בקשות לכתובת בחלון, global: מקס' בקשות לכל הכתובות יחד בחלון } לכל סוג בקשה
export const LIMITS = Object.freeze({
  config: { perIp: 60, global: 3000 },
  models: { perIp: 40, global: 2000 },
  register: { perIp: 6, global: 120 }, // רישום: עמדת חנות אחת לא תעבור 6 לקוחות בדקה; הצפה אוטומטית נחסמת מהר
  event: { perIp: 30, global: 3000 }, // אירועי ספירה אנונימיים של העמדה הציבורית (ביקור / בדיקת זמינות / פתיחת טופס): עד 3 לסשן
});

const buckets = new Map(); // `${kind}|${ip}` -> { start, n }
const globals = new Map(); // kind -> { start, n }
const MAX_BUCKETS = 5000;

function hit(map, key, limit, now) {
  let w = map.get(key);
  if (!w || now - w.start >= WINDOW_MS) { w = { start: now, n: 0 }; map.set(key, w); }
  w.n += 1;
  return w.n <= limit;
}

/** { ok:true } או { ok:false, retryAfterSec }. ip כבר מנורמל (clientIp). */
export function checkRate(kind, ip, now = Date.now()) {
  const lim = LIMITS[kind];
  if (!lim) return { ok: true };
  if (buckets.size > MAX_BUCKETS) for (const [k, w] of buckets) if (now - w.start >= WINDOW_MS) buckets.delete(k);
  // תקרה גלובלית נבדקת ראשונה: בקשה שנחסמה בה לא "אוכלת" את מכסת הכתובת
  const g = globals.get(kind);
  if (g && now - g.start < WINDOW_MS && g.n >= lim.global) return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - g.start)) / 1000) };
  const okIp = hit(buckets, `${kind}|${ip}`, lim.perIp, now);
  if (!okIp) {
    const w = buckets.get(`${kind}|${ip}`);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((WINDOW_MS - (now - w.start)) / 1000)) };
  }
  hit(globals, kind, lim.global, now);
  return { ok: true };
}

export function resetRateLimits() {
  buckets.clear();
  globals.clear();
}

/** כתובת הלקוח מכותרות Vercel / proxy. ב-Vercel x-forwarded-for נקבע ע"י הפלטפורמה (הערך הראשון = הלקוח). */
export function clientIp(headers) {
  const get = (n) => { try { return headers.get(n) || ''; } catch (e) { return ''; } };
  const raw = get('x-vercel-forwarded-for') || get('x-real-ip') || get('x-forwarded-for').split(',')[0] || '';
  const ip = String(raw).trim().slice(0, 64);
  return ip || 'unknown';
}
