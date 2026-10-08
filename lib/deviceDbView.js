// lib/deviceDbView.js - "מצב גיבוי במחשב הזה בלבד".
//
// המתג הגלובלי (SystemSetting web_backup_mode, ר' app/lib/prisma.js) מעביר את כל האתר ל-TEST_DATABASE_URL לכולם.
// כאן אותו יעד (מסד הגיבוי של אותו גמח) אבל לפי דפדפן: עוגייה חתומה gemach_db_view. בקשות שמגיעות עם עוגייה תקפה
// ניגשות למסד הגיבוי, כל השאר ממשיכות לראות את המסד האמיתי (או את מה שהמתג הגלובלי קובע).
//
// העוגייה חתומה ב-HMAC (AUTH_SECRET) ובעלת תפוגה, כדי שלא ניתן יהיה "להמציא" אותה מהקונסול של הדפדפן:
// רק מתכנת מחובר מקבל אותה (POST /api/admin/db-view). מודול טהור, CommonJS כמו lib/authTokens.js.

const crypto = require('crypto');

const DEVICE_DB_VIEW_COOKIE = 'gemach_db_view';
const VERSION = 'v1';
const DEVICE_DB_VIEW_MAX_AGE_SECONDS = 60 * 60 * 24; // יממה - אחרי זה המחשב חוזר לבד לנתונים האמיתיים

function getSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  // בפיתוח מקומי אין תמיד AUTH_SECRET; בפרודקשן בלי סוד - אי אפשר לחתום ולכן לא מקבלים עוגייה בכלל
  return process.env.NODE_ENV !== 'production' ? 'dev-only-db-view-secret' : null;
}

function sign(exp, secret) {
  return crypto.createHmac('sha256', secret).update(`dbview.${VERSION}.backup.${exp}`).digest('base64url');
}

/** ערך עוגייה חתום: מצב גיבוי עד now+maxAge. null אם אי אפשר לחתום. */
function createDeviceDbViewToken(now = Date.now(), secret = getSecret()) {
  if (!secret) return null;
  const exp = now + DEVICE_DB_VIEW_MAX_AGE_SECONDS * 1000;
  return `${VERSION}.${exp}.${sign(exp, secret)}`;
}

/** true רק לעוגייה אמיתית, חתומה ושלא פגה. לעולם לא זורק. */
function isDeviceBackupToken(token, now = Date.now(), secret = getSecret()) {
  try {
    if (!secret || !token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== VERSION) return false;
    const exp = Number(parts[1]);
    if (!Number.isFinite(exp) || now > exp) return false;
    const expected = Buffer.from(sign(parts[1], secret), 'base64url');
    const given = Buffer.from(parts[2], 'base64url');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  } catch (e) {
    return false;
  }
}

module.exports = {
  DEVICE_DB_VIEW_COOKIE,
  DEVICE_DB_VIEW_MAX_AGE_SECONDS,
  createDeviceDbViewToken,
  isDeviceBackupToken,
};
