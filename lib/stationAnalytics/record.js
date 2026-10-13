// lib/stationAnalytics/record.js - כתיבת אירועי העמדה הציבורית ל-StationEvent. פונקציות טהורות + כתיבה עם db מוזרק.
// עקרונות:
//  * אין PII: אירועי הדפדפן נשמרים עם sidHash בלבד (HMAC קטום של "יום + מזהה סשן אקראי"), בלי IP, בלי User-Agent, בלי שום פרט של לקוחה.
//    אירוע register נושא customerId פנימי (קישור להמרה להזמנה) ולא שם / טלפון.
//  * הגנה מניפוח: אירוע אנונימי נספר פעם אחת ליום לכל (סשן, סוג, ערוץ) - אילוץ ייחודיות + ON CONFLICT DO NOTHING.
//  * כתיבה בטוחה: SQL גולמי (עוקף את תוסף ה-AuditLog - אירוע ציבורי לא נרשם כשינוי נתונים), וכשל / טבלה חסרה לעולם לא מפיל את הבקשה הקוראת.
import crypto from 'node:crypto';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { ANON_EVENT_TYPES, EVENT_CHANNELS } from './constants';
import { isMissingTableError } from './queries';

export const SID_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** מנרמל גוף בקשה של אירוע אנונימי: { type } או null אם לא תקין. sid חייב להתאים ל-SID_RE. */
export function parseAnonEvent(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  if (!b) return null;
  const type = typeof b.type === 'string' ? b.type : '';
  const sid = typeof b.sid === 'string' ? b.sid : '';
  if (!ANON_EVENT_TYPES.includes(type) || !SID_RE.test(sid)) return null;
  return { type, sid };
}

/** HMAC קטום של (יום + sid). המפתח: AUTH_SECRET אם קיים. לא ניתן לשחזור, ולא מאפשר לקשר אותו מבקר בין ימים. */
export function hashSid(sid, dayKey, secret = process.env.AUTH_SECRET || 'station-analytics') {
  return crypto.createHmac('sha256', secret).update(`${dayKey}:${sid}`).digest('hex').slice(0, 32);
}

/** אירוע אנונימי: מחזיר { written:boolean, missingTable?:boolean }. */
export async function recordAnonEvent(db, { type, sid, channel = 'public', now = new Date() }) {
  if (!ANON_EVENT_TYPES.includes(type) || !SID_RE.test(sid) || !EVENT_CHANNELS.includes(channel)) return { written: false };
  const dayKey = getIsraelTodayKey(now);
  try {
    const n = await db.$executeRawUnsafe(
      `INSERT INTO "StationEvent" ("id", "type", "channel", "dayKey", "at", "sidHash")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("dayKey", "type", "channel", "sidHash") DO NOTHING`,
      crypto.randomUUID(), type, channel, dayKey, now, hashSid(sid, dayKey),
    );
    return { written: Number(n) > 0 };
  } catch (e) {
    if (isMissingTableError(e)) return { written: false, missingTable: true };
    throw e;
  }
}

/** אירוע רישום שהושלם (נקרא מ-POST /api/public-kiosk/register אחרי performRegistration). לעולם לא זורק. */
export async function recordRegistrationEvent(db, { customerId, channel, outcome, now = new Date() }) {
  if (!customerId || !EVENT_CHANNELS.includes(channel)) return { written: false };
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "StationEvent" ("id", "type", "channel", "dayKey", "at", "customerId", "outcome")
       VALUES ($1, 'register', $2, $3, $4, $5, $6)`,
      crypto.randomUUID(), channel, getIsraelTodayKey(now), now, String(customerId).slice(0, 64), String(outcome || '').slice(0, 40) || null,
    );
    return { written: true };
  } catch (e) {
    if (!isMissingTableError(e)) console.error('station register event failed:', e && e.message ? e.message : e);
    return { written: false, missingTable: isMissingTableError(e) };
  }
}
