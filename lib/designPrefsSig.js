// lib/designPrefsSig.js - חתימת HMAC על עוגיית העדפות העיצוב פר-עובד `designPrefs_<id>` (החלטת הבעלים GQ-01b, 4.10.2026).
//
// הבעיה: העוגייה הכילה JSON גולמי (פלטה / גופן / צפיפות / צבעים מותאמים + uiVariants = איזה מסכים בעיצוב החדש / הישן),
// וה-layout סמך עליה כלשונה - עובד יכול היה לערוך אותה בדפדפן ולהדליק לעצמו מסך A5 שלא הוקצה לו (ר' ההערה ב-lib/uiVariant.js).
// עכשיו העוגייה חתומה, ורק השרת כותב אותה. ערך חסר / לא חתום / חתימה שגויה / של עובד אחר / פג תוקף = "אין עוגייה": ברירות
// המחדל, בלי שגיאה, ו-DesignPrefsSync (GET /api/me/design-prefs) בונה מחדש עוגייה חתומה מה-DB (Employee.themeColor).
// שום דבר לא נלקח מהלקוח כאמת: עוגייה ישנה לא חתומה נזרקת, וה-DB הוא המקור.
//
// פורמט:   dp1.<base64url(JSON payload)>.<base64url(HMAC-SHA256)>
// Payload: { v: 1, p: { palette?, font?, density?, textScale?, customColors?, uiVariants? }, iat: ms, exp: ms }
// החתימה:  HMAC(subkey, `dp1\n<employeeKey>\n<body>`) - כולל את מפתח העובד (ערך auth_token, אותו מפתח ששם העוגייה) ולכן
//          עוגייה של עובד אחד לא "עובדת" אצל אחר (replay), וכוללת את גרסת הפורמט (dp2 עתידי מבטל את כל הקיימות).
//          subkey = HMAC(AUTH_SECRET, 'gemach/designPrefs-cookie/v1') - הפרדת תחום: טוקן auth_session לא יכול לשמש כעוגיית
//          העדפות ולהפך, אף שהסוד אותו סוד.
//
// ESM טהור, בלי Next / prisma (כמו lib/designPrefsSchema.js) - נבדק ב-scripts/test_design_prefs_sig.mjs.
import crypto from 'node:crypto';
import { sanitizeDesignPrefs } from './designPrefsSchema.js';

export const DESIGN_PREFS_COOKIE_FORMAT = 'dp1';
export const DESIGN_PREFS_PAYLOAD_VERSION = 1;
export const DESIGN_PREFS_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 יום; מתחדש ב-DesignPrefsSync כשנשאר פחות ממחצית
export const DESIGN_PREFS_MAX_VALUE_LENGTH = 3000; // כל העוגייה (שם + ערך + תכונות) חייבת להיכנס ב-4096 בתים
// השדות שנכנסים לעוגייה: מה ש-SSR צריך לפני הציור + uiVariants. mode / savedPalettes / autoClockIn נשארים רק ב-DB.
export const DESIGN_PREFS_COOKIE_FIELDS = Object.freeze(['palette', 'font', 'density', 'textScale', 'customColors', 'uiVariants']);

const KEY_DERIVATION_LABEL = 'gemach/designPrefs-cookie/v1';

export function getDesignPrefsSecret(env = process.env) {
  return (env && env.AUTH_SECRET) || null;
}

function subKey(secret) {
  return crypto.createHmac('sha256', secret).update(KEY_DERIVATION_LABEL).digest();
}

function mac(secret, format, employeeKey, body) {
  return crypto.createHmac('sha256', subKey(secret)).update(`${format}\n${employeeKey}\n${body}`).digest();
}

// מנקה (sanitize) ומשאיר רק את שדות העוגייה. אובייקט ריק = אין מה לשמור בעוגייה.
export function pickCookiePrefs(prefs) {
  const clean = sanitizeDesignPrefs(prefs);
  const out = {};
  for (const k of DESIGN_PREFS_COOKIE_FIELDS) if (clean[k] !== undefined) out[k] = clean[k];
  return out;
}

// מחזיר מחרוזת עוגייה חתומה, או null (אין סוד / אין מפתח עובד / גדול מדי). לעולם לא זורק.
export function signDesignPrefsCookie(employeeKey, prefs, secret = getDesignPrefsSecret(), now = Date.now(), opts = {}) {
  try {
    if (!secret || typeof employeeKey !== 'string' || !employeeKey) return null;
    const ttl = typeof opts.ttlSeconds === 'number' ? opts.ttlSeconds : DESIGN_PREFS_COOKIE_TTL_SECONDS;
    const payload = {
      v: typeof opts.version === 'number' ? opts.version : DESIGN_PREFS_PAYLOAD_VERSION,
      p: pickCookiePrefs(prefs),
      iat: now,
      exp: now + ttl * 1000,
    };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const format = opts.format || DESIGN_PREFS_COOKIE_FORMAT;
    const sig = mac(secret, format, employeeKey, body).toString('base64url');
    const value = `${format}.${body}.${sig}`;
    return value.length > DESIGN_PREFS_MAX_VALUE_LENGTH ? null : value;
  } catch (e) {
    return null;
  }
}

/**
 * מאמת עוגייה. לעולם לא זורק.
 * @returns {{ ok: true, prefs: object, iat: number, exp: number } | { ok: false, reason: string }}
 *   reason: 'absent' | 'no-secret' | 'legacy-unsigned' | 'malformed' | 'bad-signature' | 'version' | 'expired'
 */
export function verifyDesignPrefsCookie(raw, employeeKey, secret = getDesignPrefsSecret(), now = Date.now()) {
  try {
    if (raw === undefined || raw === null || raw === '') return { ok: false, reason: 'absent' };
    if (typeof raw !== 'string' || typeof employeeKey !== 'string' || !employeeKey) return { ok: false, reason: 'malformed' };
    if (!secret) return { ok: false, reason: 'no-secret' };
    if (raw.length > DESIGN_PREFS_MAX_VALUE_LENGTH) return { ok: false, reason: 'malformed' };
    // העוגייה הישנה (לא חתומה): JSON מקודד (encodeURIComponent) - מתחיל ב-'{' או '%7B'. נזרקת; לא סומכים על תוכנה.
    if (raw[0] === '{' || /^%7b/i.test(raw)) return { ok: false, reason: 'legacy-unsigned' };
    const parts = raw.split('.');
    if (parts.length !== 3) return { ok: false, reason: 'malformed' };
    if (parts[0] !== DESIGN_PREFS_COOKIE_FORMAT) return { ok: false, reason: parts[0].startsWith('dp') ? 'version' : 'malformed' };
    const expected = mac(secret, parts[0], employeeKey, parts[1]);
    const given = Buffer.from(parts[2], 'base64url');
    // קפדני: מחרוזת החתימה חייבת להיות בדיוק הקידוד הקנוני (base64url מתעלם מתווים זרים).
    if (parts[2] !== expected.toString('base64url')) return { ok: false, reason: 'bad-signature' };
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'bad-signature' };
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object' || payload.v !== DESIGN_PREFS_PAYLOAD_VERSION) return { ok: false, reason: 'version' };
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return { ok: false, reason: 'malformed' };
    if (now > payload.exp) return { ok: false, reason: 'expired' };
    if (!payload.p || typeof payload.p !== 'object' || Array.isArray(payload.p)) return { ok: false, reason: 'malformed' };
    // הגנה בעומק: גם תוכן חתום עובר sanitize (לא אמור להשתנות - נחתם אחרי sanitize).
    return { ok: true, prefs: pickCookiePrefs(payload.p), iat: payload.iat, exp: payload.exp };
  } catch (e) {
    return { ok: false, reason: 'malformed' };
  }
}

// הכלי של ה-layout / uiVariantServer: ההעדפות מהעוגייה, או null (= "אין עוגייה": ברירות מחדל).
export function readDesignPrefsFromCookie(raw, employeeKey, secret = getDesignPrefsSecret(), now = Date.now()) {
  const res = verifyDesignPrefsCookie(raw, employeeKey, secret, now);
  return res.ok ? res.prefs : null;
}

function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/**
 * מה לעשות עם העוגייה בתשובת שרת, כשהמקור (DB) הוא `dbPrefs`.
 *   { action: 'none' }                      - העוגייה תקפה ותואמת ל-DB (ולא קרובה לפקוע), או אין מה לשמור ואין עוגייה.
 *   { action: 'set', value, rebuilt }       - לכתוב עוגייה חתומה חדשה. rebuilt=true כשהעוגייה הקיימת לא הייתה תקפה
 *                                             (חסרה / ישנה לא חתומה / חתימה שגויה / פגה) - ה-DesignPrefsSync משתמש בזה.
 *   { action: 'delete' }                    - יש עוגייה לא תקפה ואין מה לשמור: מוחקים אותה (מוצאים אותה מהדפדפן).
 * אותה פונקציה משמשת גם את הכותבים אחרי שינוי (PUT / POST ui-variant): התוכן החדש שונה מהעוגייה, ולכן 'set'.
 */
export function planDesignPrefsCookie(raw, employeeKey, dbPrefs, secret = getDesignPrefsSecret(), now = Date.now()) {
  const expected = pickCookiePrefs(dbPrefs || {});
  const hasExpected = Object.keys(expected).length > 0;
  const current = verifyDesignPrefsCookie(raw, employeeKey, secret, now);
  const hasRaw = !(raw === undefined || raw === null || raw === '');

  if (current.ok) {
    const sameContent = stableStringify(current.prefs) === stableStringify(expected);
    const halfLife = (current.exp - current.iat) / 2;
    const fresh = current.exp - now > halfLife;
    if (sameContent && fresh) return { action: 'none' };
    if (!hasExpected) return { action: 'delete' }; // ה-DB התרוקן (למשל הבעלים ביטל עקיפות) - לא משאירים עוגייה ישנה
    const value = signDesignPrefsCookie(employeeKey, dbPrefs, secret, now);
    return value ? { action: 'set', value, rebuilt: false } : { action: 'none' };
  }

  if (!secret) return { action: 'none' }; // אי אפשר לחתום; בלי סוד כל העוגיות נזרקות ממילא
  if (!hasExpected) return hasRaw ? { action: 'delete' } : { action: 'none' };
  const value = signDesignPrefsCookie(employeeKey, dbPrefs, secret, now);
  return value ? { action: 'set', value, rebuilt: true } : { action: hasRaw ? 'delete' : 'none' };
}
