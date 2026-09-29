import { randomBytes, createHash } from 'crypto';

// מפתחות API להתחברות ללא שם משתמש וסיסמה (Moshe, 2026-09-28).
//
// מודל האמון: מתכנת מנפיק מפתח ב-/admin/site-settings/api-keys. השרת מייצר 256 ביט אקראיים,
// שומר ב-ApiKey רק את ה-SHA-256 שלהם, ומציג את המפתח המלא פעם אחת בלבד (אי אפשר לשחזר אותו
// אחר כך - מפתח שאבד מבטלים ומנפיקים חדש). מי שמחזיק במפתח מחליף אותו ב-/api/auth/api-key-login
// בעוגיות הכניסה הרגילות (auth_token + auth_session) - בדיוק כמו כניסה אמיתית, ולכן כל שאר
// המערכת (checkAuth, הרשאות, יומן שינויים) עובדת בלי שינוי.
//
// כל מפתח קשור ל"עובד שירות" ייעודי משלו (לא לעובד אמיתי), כדי שיומן השינויים יראה בבירור
// "מפתח API: <שם>" ולא ישייך פעולות אוטומטיות לאדם. ביטול המפתח מכבה גם את עובד השירות.

export const API_KEY_PREFIX = 'gmk_';

// עובדי שירות (מפתחות API, וגם כניסת הסוכן הישנה 999999) חיים בטווח legacyId שמעל כל טווח אמיתי
// בשני הגמחים, כדי שאפשר יהיה לזהות אותם ולהסתיר אותם מרשימות ציבוריות.
export const SERVICE_EMPLOYEE_LEGACY_ID_MIN = 900000;
export const SERVICE_EMPLOYEE_LEGACY_ID_MAX = 999999;

// תפקידים שמותר לקשור למפתח. אותו סדר בכירות כמו ROLE_RANK ב-lib/auth.js.
export const API_KEY_ROLES = [
  { roleId: 1, label: 'מנהל סניף' },
  { roleId: 0, label: 'הנהלה ראשית' },
  { roleId: 2, label: 'מתכנת (הרשאה מלאה)' },
];

export const API_KEY_EXPIRY_OPTIONS_DAYS = [1, 7, 30, 90, 365];

export function generateApiKey() {
  return API_KEY_PREFIX + randomBytes(32).toString('base64url');
}

export function hashApiKey(key) {
  return createHash('sha256').update(String(key)).digest('hex');
}

// הקידומת המוצגת ברשימה (לזיהוי בלבד - לא מספיקה כדי לנחש את המפתח).
export function apiKeyPreview(key) {
  return `${String(key).slice(0, API_KEY_PREFIX.length + 4)}…`;
}

export function looksLikeApiKey(value) {
  return typeof value === 'string' && value.startsWith(API_KEY_PREFIX) && value.length >= 40 && value.length <= 128;
}

// המפתח מתקבל ב-Authorization: Bearer / X-API-Key / גוף JSON. ב-query string (GET) רק לנוחות
// כניסה מדפדפן - ר' הערה ב-api-key-login.
export function extractApiKeyFromHeaders(headers) {
  const auth = headers.get('authorization') || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  return (bearer && bearer[1].trim()) || (headers.get('x-api-key') || '').trim() || null;
}

// מצב תקף של מפתח: לא בוטל ולא פג תוקף.
export function apiKeyState(row, now = new Date()) {
  if (!row) return 'missing';
  if (row.revokedAt) return 'revoked';
  if (row.expiresAt && row.expiresAt <= now) return 'expired';
  return 'active';
}
