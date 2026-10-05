// הסתרת סודות ופרטים אישיים מהיסטוריית הגלישה (PageVisitLog.requestQuery / pageUrl) ומיומן השגיאות.
// ה-interceptor ב-app/layout.js שומר גוף בקשות /api/* ללא query string, ובעבר זה כלל סיסמאות, PIN, ת"ז,
// פרטי בנק/אשראי וצרופות base64 בטקסט גלוי. שכבה זו רצה בשרת (app/api/log-visit, app/api/history, app/api/logs)
// כך שגם קליינט ישן/זדוני וגם שורות ישנות שכבר נשמרו לא יוצגו / לא יישמרו.
//
// קיימת גרסה מקבילה (inline, בלי import) ב-app/layout.js. חייבות להישאר זהות בהתנהגות:
// scripts/test_redact_sensitive.mjs מריץ את שתיהן על אותו קורפוס ובודק שוויון.
// בכוונה אין כאן backslash בביטויים הרגולריים (משתמשים ב-[/] ו-[0-9]) - כדי שההעתקה לתוך template string לא תישבר
// (באג של PR #188: "\/" בתוך template literal הופך ל-"/" והביטוי כבר לא תפס שום נתיב, וכל קריאות ה-/api הפסיקו להירשם).

export const REDACTED = '[מוסתר]';

// ערכי מחרוזת ארוכים נחתכים (גוף מייל, הערות חופשיות); מחרוזת base64 / data-URI נמחקת כולה.
export const MAX_STRING_LEN = 300;
const BASE64_RUN_RE = /^[A-Za-z0-9+/=_-]{256,}$/;

// נקודות קצה שהגוף שלהן הוא אישורי גישה (או, ב-/api/logs, הודעת השגיאה של ה-alert שעלולה לכלול שם לקוחה) - הגוף לעולם לא נשמר,
// וגם ה-query string של ה-URL נמחק.
const AUTH_ENDPOINT_RE =
  /[/]api[/](login([/]|$)|logout([/]|$)|auth([/]|$)|attendance([/]|$)|dev[/]agent-login|admin[/]api-keys|employees[/][^/?]+[/](reset-|set-)?password)|[/]api[/](history|logs)$/i;

// שם שדה רגיש. "barcode" בכוונה לא נכלל (רק code מדויק / שילובי אימות); cardVariant הוא סימון גרסת כרטיס ולא אשראי.
export function isSensitiveKey(key) {
  const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    k.includes('pass') ||
    k.includes('secret') ||
    k.includes('token') ||
    k.includes('authorization') ||
    k.includes('credential') ||
    k.includes('apikey') ||
    k.includes('privatekey') ||
    k.includes('otp') ||
    k === 'code' ||
    k === 'jwt' ||
    k === 'ssn' ||
    /(pin|pincode|pinhash|authcode|smscode|verificationcode|resetcode|verifycode)$/.test(k) ||
    // PII: ת"ז (zeout / idNumber), בנק (bank* / iban / accountNumber), אשראי (card* / cvv / cvc), תוכן קבצים (base64)
    k.includes('zeout') ||
    k.includes('idnumber') ||
    k.includes('teudat') ||
    k.includes('nationalid') ||
    k.includes('iban') ||
    k.startsWith('bank') ||
    k.includes('accountnumber') ||
    k.includes('creditcard') ||
    k.includes('ccnumber') ||
    k.includes('cvv') ||
    k.includes('cvc') ||
    (k.startsWith('card') && k !== 'cardvariant') ||
    k.includes('filecontent') ||
    k.includes('base64')
  );
}

// טקסט חתוך / לא JSON: אין אפשרות לסנן שדה-שדה - אם הוא מזכיר שם שדה רגיש משמיטים אותו כולו (fail closed)
const TEXT_SECRET_RE =
  /pass|secret|token|pin|otp|authorization|credential|apikey|zeout|idnumber|iban|bank|card|cvv|cvc|filecontent|base64|data:/i;
// גוף חשוף שהוא רק ספרות (PIN / ת"ז / כרטיס) - נמחק
const BARE_DIGITS_RE = /^["']?[0-9][0-9 -]{2,}["']?$/;

export function isAuthEndpoint(url) {
  try {
    return AUTH_ENDPOINT_RE.test(new URL(String(url), 'http://x').pathname);
  } catch {
    return AUTH_ENDPOINT_RE.test(String(url));
  }
}

// ערך מחרוזת: data-URI / base64 ארוך נמחק, שאר המחרוזות הארוכות נחתכות
function redactString(s) {
  if (s.length > 20 && /^data:[^,]*;base64,/i.test(s)) return REDACTED;
  if (s.length >= 256 && BASE64_RUN_RE.test(s)) return REDACTED;
  return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) + '…[נחתך]' : s;
}

function redactValue(v, depth) {
  if (typeof v === 'string') return redactString(v);
  if (!v || typeof v !== 'object') return v;
  // עומק מעבר ל-6: לא סורקים יותר - מוחקים את התת-עץ (fail closed) במקום להחזיר אותו כמו שהוא
  if (depth > 6) return REDACTED;
  if (Array.isArray(v)) return v.map((x) => redactValue(x, depth + 1));
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = isSensitiveKey(k) ? REDACTED : redactValue(val, depth + 1);
  return out;
}

function redactQueryString(qs) {
  const params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
  let changed = false;
  for (const key of [...params.keys()]) {
    const orig = params.get(key);
    const next = isSensitiveKey(key) ? REDACTED : redactString(orig);
    if (next !== orig) { params.set(key, next); changed = true; }
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
      return TEXT_SECRET_RE.test(t) ? null : s;
    }
  }
  if (BARE_DIGITS_RE.test(t) || redactString(t) === REDACTED) return null;
  if (t.startsWith('?') || t.includes('=')) return redactQueryString(t);
  return TEXT_SECRET_RE.test(t) ? null : redactString(s);
}

// מסיר פרמטרים רגישים מ-URL (pageUrl נשמר כולל query string). ב-endpoint של אימות - מוחק את ה-query כולו.
export function redactUrl(url) {
  const s = String(url);
  const i = s.indexOf('?');
  if (i === -1) return s;
  if (isAuthEndpoint(s)) return s.slice(0, i);
  return s.slice(0, i) + redactQueryString(s.slice(i));
}

// טקסט חופשי שנשלח ליומן השגיאות (הודעת alert + כתובת העמוד): חותך, ומסתיר רצפי ספרות ארוכים (ת"ז / טלפון / כרטיס)
// ומחרוזות base64. לא מסתיר שמות (אי אפשר לזהות אותם) - השולח (PopupProvider) לא כולל query string ולא שמות לקוחות.
export function redactLogText(text, max = 500) {
  if (text == null) return '';
  let s = typeof text === 'string' ? text : (() => { try { return JSON.stringify(text); } catch { return String(text); } })();
  s = s.replace(/[0-9][0-9 -]{6,}[0-9]/g, REDACTED);
  s = s.replace(/[A-Za-z0-9+/=_-]{64,}/g, REDACTED);
  return s.length > max ? s.slice(0, max) + '…' : s;
}
