// הסתרת סודות (סיסמאות, PIN, טוקנים) מהיסטוריית הגלישה (PageVisitLog.requestQuery / pageUrl).
// ה-interceptor ב-app/layout.js שומר גוף בקשות /api/* ללא query string, ובעבר זה כלל סיסמאות
// ו-PIN בטקסט גלוי. שכבה זו רצה בשרת (app/api/log-visit) ובקריאה (app/api/history), כדי שגם שורות
// ישנות שכבר נשמרו לא יוצגו. קיימת גם גרסה מקבילה (inline) ב-app/layout.js - לשמור מסונכרנות.

export const REDACTED = '[מוסתר]';

// נקודות קצה שהגוף שלהן הוא אישורי גישה - לעולם לא נשמר כלל.
const AUTH_ENDPOINT_RE = /\/api\/(login|logout|auth(\/|$)|attendance|dev\/agent-login|employees\/[^/?]+\/(reset-)?password)|\/api\/history$/i;

// שם שדה רגיש. "barcode" בכוונה לא נכלל (רק code מדויק / שילובי אימות).
export function isSensitiveKey(key) {
  const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    k.includes('pass') ||
    k.includes('secret') ||
    k.includes('token') ||
    k.includes('authorization') ||
    k.includes('otp') ||
    k === 'code' ||
    /(pin|pincode|pinhash|authcode|smscode|verificationcode|resetcode|verifycode)$/.test(k)
  );
}

export function isAuthEndpoint(url) {
  try {
    return AUTH_ENDPOINT_RE.test(new URL(String(url), 'http://x').pathname);
  } catch {
    return AUTH_ENDPOINT_RE.test(String(url));
  }
}

function redactValue(v, depth) {
  if (depth > 6) return v;
  if (Array.isArray(v)) return v.map((x) => redactValue(x, depth + 1));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = isSensitiveKey(k) ? REDACTED : redactValue(val, depth + 1);
    return out;
  }
  return v;
}

function redactQueryString(qs) {
  const params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
  let changed = false;
  for (const key of [...params.keys()]) {
    if (isSensitiveKey(key)) { params.set(key, REDACTED); changed = true; }
  }
  return changed ? '?' + params.toString() : qs;
}

// מקבל את הטקסט השמור (JSON body או query string) ומחזיר גרסה בטוחה, או null אם צריך להשמיט.
export function redactRequestQuery(text, pageUrl) {
  if (!text) return null;
  if (pageUrl && isAuthEndpoint(pageUrl)) return null;
  const s = String(text);
  const t = s.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.stringify(redactValue(JSON.parse(t), 0));
    } catch {
      // JSON חתוך (נחתך ב-4000 תווים) או לא תקין - אי אפשר לסנן בבטחה. אם יש בו שם שדה רגיש, מוחקים.
      return /pass|secret|token|pin|otp|authorization/i.test(t) ? null : s;
    }
  }
  if (t.startsWith('?') || t.includes('=')) return redactQueryString(t);
  return /pass|secret|token|pin|otp|authorization/i.test(t) ? null : s;
}

// מסיר פרמטרים רגישים מ-URL (pageUrl נשמר כולל query string).
export function redactUrl(url) {
  const s = String(url);
  const i = s.indexOf('?');
  if (i === -1) return s;
  return s.slice(0, i) + redactQueryString(s.slice(i));
}
