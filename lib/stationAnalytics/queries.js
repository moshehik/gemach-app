// lib/stationAnalytics/queries.js - שליפות ה-DB למדדי ההמרה של העמדה הציבורית. אגרגציות ממוקדות (SQL גולמי, פרמטרים מקושרים), בלי PII ברשימות המצטברות.
// ה-db מוזרק: prisma מ-@/app/lib/prisma באפליקציה, או מתאם דק על pg בבדיקות (שניהם מממשים $queryRawUnsafe / $executeRawUnsafe).
// הטבלה StationEvent נוצרת ידנית (scripts/station_event_table.sql) - לכן אין שימוש במודל Prisma (הלקוח המיוצר לא מכיר אותו), וחסרון הטבלה מטופל בנימוס.
import { kioskRegistrationState } from '@/lib/kioskRegistration';
import { getIsraelDayRange, addDaysToDateKey } from '@/lib/hebrewDate';
import { NON_ORDER_STATUSES } from './constants';

const CUSTOMER_CHUNK = 800;
const MAX_REGISTRATION_ROWS = 20000;

/** האם השגיאה היא "הטבלה StationEvent לא קיימת" (Prisma P2010 / pg 42P01). */
export function isMissingTableError(e) {
  if (!e) return false;
  const msg = String((e && e.message) || e);
  const code = (e && e.code) || (e && e.meta && e.meta.code) || '';
  if (code === '42P01') return true;
  return /StationEvent/.test(msg) && /does not exist|doesn't exist|42P01/i.test(msg);
}

/** ספירות אנונימיות לפי יום / סוג / ערוץ. */
export async function loadEventCounts(db, fromDay, toDay) {
  const rows = await db.$queryRawUnsafe(
    `SELECT "dayKey", "type", "channel", count(*)::int AS "count"
       FROM "StationEvent"
      WHERE "dayKey" >= $1 AND "dayKey" <= $2 AND "type" <> 'register'
      GROUP BY "dayKey", "type", "channel"`,
    fromDay, toDay,
  );
  return rows.map((r) => ({ dayKey: r.dayKey, type: r.type, channel: r.channel, count: Number(r.count) }));
}

/** אירועי רישום (register) בטווח ימים. ממוינים לפי זמן. מוגבל כגודל. */
export async function loadRegistrationEvents(db, fromDay, toDay, { channel = null } = {}) {
  const args = [fromDay, toDay];
  let chan = '';
  if (channel && channel !== 'all') { args.push(channel); chan = `AND "channel" = $3`; }
  const rows = await db.$queryRawUnsafe(
    `SELECT "customerId", "dayKey", "at", "channel", "outcome"
       FROM "StationEvent"
      WHERE "type" = 'register' AND "customerId" IS NOT NULL AND "dayKey" >= $1 AND "dayKey" <= $2 ${chan}
      ORDER BY "at" ASC
      LIMIT ${MAX_REGISTRATION_ROWS}`,
    ...args,
  );
  return rows.map((r) => ({ customerId: r.customerId, dayKey: r.dayKey, at: r.at, channel: r.channel, outcome: r.outcome || '' }));
}

/** לקוחות לפי מזהים: מחוקה / מצב סימון העמדה הנוכחי (+ שמות כשנדרש). */
export async function loadCustomers(db, ids, { withNames = false } = {}) {
  const map = new Map();
  const uniq = [...new Set((ids || []).filter(Boolean))];
  for (let i = 0; i < uniq.length; i += CUSTOMER_CHUNK) {
    const chunk = uniq.slice(i, i + CUSTOMER_CHUNK);
    const rows = await db.$queryRawUnsafe(
      `SELECT "id", "firstName", "lastName", "officeNotes", "isDeleted" FROM "Customer" WHERE "id" = ANY($1::text[])`,
      chunk,
    );
    for (const r of rows) {
      map.set(r.id, {
        isDeleted: r.isDeleted === true,
        state: kioskRegistrationState(r.officeNotes),
        ...(withNames ? { firstName: r.firstName || '', lastName: r.lastName || '' } : {}),
      });
    }
  }
  return map;
}

/**
 * הזמנות אמיתיות של הלקוחות שנוצרו (Order.orderDate) בין שני רגעים. "אמיתית" = לא מחוקה, וסטטוס שאינו טיוטה / שמור-לחיוב
 * (COALESCE: ב-Order.status יש NULL רבים - לעולם לא NOT IN ישיר). confirmed = יש פריט פעיל עם החזקה קבועה; hasItem = יש פריט פעיל כלשהו.
 */
export async function loadOrders(db, customerIds, fromAt, toAt) {
  const out = [];
  const uniq = [...new Set((customerIds || []).filter(Boolean))];
  for (let i = 0; i < uniq.length; i += CUSTOMER_CHUNK) {
    const chunk = uniq.slice(i, i + CUSTOMER_CHUNK);
    const rows = await db.$queryRawUnsafe(
      `SELECT o."customerId", o."orderId", o."orderDate",
              EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."orderId" AND i."isDeleted" = false) AS "hasItem",
              EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."orderId" AND i."isDeleted" = false AND i."cartStatus" = 'confirmed') AS "confirmed"
         FROM "Order" o
        WHERE o."customerId" = ANY($1::text[])
          AND o."isDeleted" = false
          AND COALESCE(o."status", '') <> ALL($2::text[])
          AND o."orderDate" >= $3 AND o."orderDate" <= $4`,
      chunk, [...NON_ORDER_STATUSES], fromAt, toAt,
    );
    for (const r of rows) out.push({ customerId: r.customerId, orderId: r.orderId, orderDate: r.orderDate, hasItem: r.hasItem === true, confirmed: r.confirmed === true });
  }
  return out;
}

/** גבולות הזמן (UTC) שמכסים את כל ההזמנות שיכולות להשפיע על רישומים בטווח הימים. */
export function orderWindowBounds(fromDay, toDay, windowDays) {
  return { fromAt: getIsraelDayRange(fromDay).start, toAt: getIsraelDayRange(addDaysToDateKey(toDay, windowDays)).end };
}
