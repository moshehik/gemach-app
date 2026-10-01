// lib/loginDeviceRegistry.js - "מחשב משותף" לדף הכניסה החדש (החלטת הבעלים 1.10.2026, L09/L17).
//
// לכל דפדפן מונפקת פעם אחת עוגייה ארוכת-טווח login_device עם טוקן אקראי (httpOnly, ~400 יום). בכל כניסה
// מוצלחת השרת מוסיף את מפתח העובד (sha256 מקוצר של Employee.id - לא המזהה עצמו) לרשומת המחשב. מעל
// SHARED_COMPUTER_THRESHOLD (3) עובדים שונים המחשב "משותף": "זכור אותי" לא מוצע ולא מכובד.
// הרישום הזה נפרד לגמרי מ"מחשב מהימן" (lib/trustedDevice.js) וחל על כל מחשב.
//
// איפה הרשומה נשמרת:
//   1. טבלת "LoginDevice" - ה-SQL ליצירתה ב-prisma/migrations-pending/2026-10-02-login-device.sql (לא הורץ;
//      אין DDL בענף הזה). גישה ב-SQL גולמי כדי שהקוד יעבוד גם לפני שהמודל נוסף ל-schema.prisma.
//   2. כשהטבלה לא קיימת (או שגיאת DB): נפילה שקטה לרשימה חתומה (HMAC עם AUTH_SECRET) בעוגייה
//      login_device_emps באותו דפדפן. הלקוח לא יכול לזייף אותה (ובלי AUTH_SECRET - לכל היותר
//      "להפוך" את המחשב שלו ללא-משותף, מה שרק מאפשר לו "זכור אותי" על המחשב שלו עצמו).
// שתי הדרכים נותנות אותה תשובה לאותה שאלה: כמה עובדים שונים נכנסו מהמחשב הזה.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import prisma from '@/app/lib/prisma';
import { addEmployeeKeyToDevice, isSharedComputer } from '@/lib/loginFlow';

export const LOGIN_DEVICE_COOKIE = 'login_device';
export const LOGIN_DEVICE_LIST_COOKIE = 'login_device_emps';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
const TABLE_RECHECK_MS = 10 * 60 * 1000;

let tableMissingUntil = 0; // זמן עד שבודקים שוב אם הטבלה קיימת (אחרי שגיאת "relation does not exist")

function cookieOptions(name) {
  return {
    name,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/** מפתח עובד לרשומת המחשב: לא Employee.id עצמו (לא צריך את המזהה כדי לספור). */
export function employeeKey(employeeId) {
  return createHash('sha256').update(`login-device:${employeeId}`).digest('hex').slice(0, 16);
}

function isMissingTableError(e) {
  const msg = String((e && (e.message || e.meta?.message)) || '');
  return /does not exist|relation .* LoginDevice|42P01/i.test(msg);
}

// ---- עוגיית הרשימה החתומה (הנפילה הרכה) ----
function listSecret() {
  return process.env.AUTH_SECRET || '';
}

export function encodeSignedList(keys, secret = listSecret()) {
  const body = Buffer.from(JSON.stringify(Array.isArray(keys) ? keys : []), 'utf8').toString('base64url');
  const sig = secret ? createHmac('sha256', secret).update(body).digest('base64url') : '';
  return `${body}.${sig}`;
}

export function decodeSignedList(value, secret = listSecret()) {
  try {
    if (!value || typeof value !== 'string') return [];
    const [body, sig = ''] = value.split('.');
    if (!body) return [];
    if (secret) {
      const expected = createHmac('sha256', secret).update(body).digest('base64url');
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return [];
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string' && /^[a-f0-9]{16}$/.test(k)) : [];
  } catch (e) {
    return [];
  }
}

// ---- טבלת LoginDevice (SQL גולמי, נופל בשקט כשאינה קיימת) ----
async function readDbKeys(tokenHash) {
  if (Date.now() < tableMissingUntil) return null;
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT "employeeKeys" FROM "LoginDevice" WHERE "tokenHash" = $1 LIMIT 1', tokenHash);
    if (!rows || !rows.length) return [];
    try {
      const parsed = JSON.parse(rows[0].employeeKeys || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  } catch (e) {
    if (isMissingTableError(e)) {
      tableMissingUntil = Date.now() + TABLE_RECHECK_MS;
    } else {
      console.warn('LoginDevice read failed:', e?.message || e);
    }
    return null;
  }
}

async function writeDbKeys(tokenHash, keys) {
  if (Date.now() < tableMissingUntil) return false;
  try {
    const json = JSON.stringify(keys);
    await prisma.$executeRawUnsafe(
      'INSERT INTO "LoginDevice" ("id", "tokenHash", "employeeKeys", "firstSeenAt", "lastSeenAt") VALUES ($1, $2, $3, NOW(), NOW()) '
      + 'ON CONFLICT ("tokenHash") DO UPDATE SET "employeeKeys" = EXCLUDED."employeeKeys", "lastSeenAt" = NOW()',
      randomBytes(16).toString('hex'), tokenHash, json
    );
    return true;
  } catch (e) {
    if (isMissingTableError(e)) {
      tableMissingUntil = Date.now() + TABLE_RECHECK_MS;
    } else {
      console.warn('LoginDevice write failed:', e?.message || e);
    }
    return false;
  }
}

/** מצב המחשב בלי לשנות דבר (לדף הכניסה לפני ההזדהות): { shared, distinctCount }. */
export async function getDeviceSharedStatus(cookieStore) {
  try {
    const token = cookieStore.get(LOGIN_DEVICE_COOKIE)?.value;
    let keys = null;
    if (token) keys = await readDbKeys(hashToken(token));
    if (keys === null) keys = decodeSignedList(cookieStore.get(LOGIN_DEVICE_LIST_COOKIE)?.value);
    return { shared: isSharedComputer(keys.length), distinctCount: keys.length };
  } catch (e) {
    return { shared: false, distinctCount: 0 };
  }
}

/**
 * אחרי כניסה מוצלחת: רושם את העובד למחשב הזה (מנפיק עוגיית מכשיר אם אין) ומחזיר אם המחשב משותף.
 * best-effort: לעולם לא זורק ולא חוסם כניסה.
 */
export async function recordLoginOnDevice(cookieStore, employeeId) {
  try {
    let token = cookieStore.get(LOGIN_DEVICE_COOKIE)?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      token = randomBytes(32).toString('hex');
      cookieStore.set({ ...cookieOptions(LOGIN_DEVICE_COOKIE), value: token });
    }
    const key = employeeKey(employeeId);
    const tokenHash = hashToken(token);

    // מקור אחד לרשימה: ה-DB כשיש טבלה, אחרת העוגייה החתומה. מאחדים את שניהם כדי שמעבר בין
    // המצבים (הטבלה נוצרת מאוחר יותר) לא יאפס את הספירה.
    const fromDb = await readDbKeys(tokenHash);
    const fromCookie = decodeSignedList(cookieStore.get(LOGIN_DEVICE_LIST_COOKIE)?.value);
    let keys = Array.isArray(fromDb) ? fromDb : [];
    for (const k of fromCookie) keys = addEmployeeKeyToDevice(keys, k);
    keys = addEmployeeKeyToDevice(keys, key);

    const wrote = fromDb !== null ? await writeDbKeys(tokenHash, keys) : false;
    // העוגייה החתומה נשמרת תמיד (גם כשיש DB) - כך אין אובדן ספירה אם הטבלה תוסר, ואין קריאה כפולה.
    cookieStore.set({ ...cookieOptions(LOGIN_DEVICE_LIST_COOKIE), value: encodeSignedList(keys) });

    return { shared: isSharedComputer(keys.length), distinctCount: keys.length, persistedInDb: wrote };
  } catch (e) {
    console.warn('recordLoginOnDevice failed:', e?.message || e);
    return { shared: false, distinctCount: 0, persistedInDb: false };
  }
}
