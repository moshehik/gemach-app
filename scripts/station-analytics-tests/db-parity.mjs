// בדיקת התאמה מול DB אמיתי של TEST (לא חלק מ-run.mjs - דורשת חיבור): מכניסה תרחיש סינתטי מסומן (מזהים sa-*), מריצה את computeStationAnalytics
// האמיתי (אותן שאילתות SQL כמו בפרודקשן) ומשווה למספרים ש-SQL עצמאי (חישוב אזור זמן ב-PostgreSQL, לא ב-JS) סופר ישירות. בסוף מנקה את כל מה שהוכנס.
//
//   TZ=UTC node --no-warnings --import ./scripts/station-analytics-tests/register.mjs scripts/station-analytics-tests/db-parity.mjs
//
// בטיחות: מסרבת לרוץ אם מארח TEST_DATABASE_URL זהה למארח של PROD_DATABASE_URL / DATABASE_URL. דורשת שהטבלה StationEvent כבר קיימת ב-TEST
// (scripts/station_event_table.sql). כתיבה: INSERT/DELETE גולמי בלבד (עוקף את תוסף ה-AuditLog) על שורות ה-sa-* שלה.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const PROJ = process.env.PROJ;
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const env = {};
for (const f of ['.env', '.env.local']) {
  try { fs.readFileSync(path.join(PROJ, f), 'utf8').split(/\r?\n/).forEach((l) => { const m = /^([A-Z_0-9]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ''); }); } catch { /* */ }
}
const hostOf = (u) => new URL(u).host;
if (!env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL חסר');
for (const k of ['PROD_DATABASE_URL', 'DATABASE_URL', 'PROD_DATABASE_URL_ORG2']) {
  if (env[k] && hostOf(env[k]) === hostOf(env.TEST_DATABASE_URL)) throw new Error(`מסרבת: TEST_DATABASE_URL זהה ל-${k}`);
}

pg.types.setTypeParser(1114, (s) => new Date(`${s.replace(' ', 'T')}Z`)); // timestamp בלי אזור = UTC (כמו Prisma)
const client = new pg.Client({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
for (let i = 0; i < 10; i++) { try { await client.connect(); break; } catch (e) { if (i === 9) throw e; await new Promise((r) => setTimeout(r, 8000)); } }
const prep = (a) => a.map((v) => (v instanceof Date ? v.toISOString() : v));
const db = {
  $queryRawUnsafe: async (sql, ...a) => (await client.query(sql, prep(a))).rows,
  $executeRawUnsafe: async (sql, ...a) => (await client.query(sql, prep(a))).rowCount,
};
const q = (sql, ...a) => db.$queryRawUnsafe(sql, ...a);
// USE_PRISMA=1: הפונקציות הנבדקות רצות דרך PrismaClient אמיתי (קישור הפרמטרים של Prisma: מערכים, תאריכים, מספרים) ולא דרך pg; הכתיבה של התרחיש נשארת ב-pg
let dbSvc = db;
if (process.env.USE_PRISMA === '1') {
  const { PrismaClient } = await import('@prisma/client');
  dbSvc = new PrismaClient({ datasources: { db: { url: env.TEST_DATABASE_URL } } });
  console.log('מצב: PrismaClient אמיתי');
}

const { computeStationAnalytics, listDayRegistrations } = await L('lib/stationAnalytics/service.js');
const { recordAnonEvent, recordRegistrationEvent } = await L('lib/stationAnalytics/record.js');
const { getIsraelDateKey, addDaysToDateKey } = await L('lib/hebrewDate.js');
const { KIOSK_REG_PENDING_TAG, KIOSK_REG_VERIFIED_TAG, KIOSK_REG_REPEAT_TAG } = await L('lib/kioskRegistration.js');

const NOW = new Date();
const MIN = 60000;
const DAY = 86400000;
const ORDER_BASE = 970000000;
let orderSeq = 0;
const cleanup = async () => {
  await db.$executeRawUnsafe(`DELETE FROM "StationEvent" WHERE "customerId" LIKE 'sa-c-%' OR "sidHash" LIKE 'sa-%'`);
  await db.$executeRawUnsafe(`DELETE FROM "OrderItem" WHERE "orderId" >= ${ORDER_BASE} AND "orderId" < ${ORDER_BASE + 1000}`);
  await db.$executeRawUnsafe(`DELETE FROM "Order" WHERE "orderId" >= ${ORDER_BASE} AND "orderId" < ${ORDER_BASE + 1000}`);
  await db.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "id" LIKE 'sa-c-%'`);
};

const addCustomer = (id, { deleted = false, notes = null, first = 'בדיקה', last = 'אוטומטית' } = {}) =>
  db.$executeRawUnsafe(`INSERT INTO "Customer" ("id","firstName","lastName","officeNotes","isDeleted","updatedAt") VALUES ($1,$2,$3,$4,$5,now())`, id, first, last, notes, deleted);
async function addOrder(customerId, at, { status = null, deleted = false, items = ['confirmed'], itemsDeleted = false } = {}) {
  const orderId = ORDER_BASE + (++orderSeq);
  await db.$executeRawUnsafe(`INSERT INTO "Order" ("id","orderId","customerId","status","isDeleted","orderDate","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())`, `sa-o-${orderId}`, orderId, customerId, status, deleted, at);
  for (const [i, cs] of items.entries()) {
    await db.$executeRawUnsafe(`INSERT INTO "OrderItem" ("id","orderId","cartStatus","isDeleted","updatedAt") VALUES ($1,$2,$3,$4,now())`, `sa-i-${orderId}-${i}`, orderId, cs, itemsDeleted);
  }
  return orderId;
}
async function addRegister(customerId, at, { channel = 'public', outcome = 'created' } = {}) {
  await db.$executeRawUnsafe(
    `INSERT INTO "StationEvent" ("id","type","channel","dayKey","at","customerId","outcome") VALUES ($1,'register',$2,$3,$4,$5,$6)`,
    `sa-e-${customerId}-${at.getTime()}`, channel, getIsraelDateKey(at), at, customerId, outcome,
  );
}

const results = [];
const check = (name, fn) => { try { fn(); results.push([true, name]); } catch (e) { results.push([false, `${name}\n      ${e.message.split('\n').slice(0, 4).join('\n      ')}`]); } };

try {
  await cleanup();
  const todayKey = getIsraelDateKey(NOW);
  const regAt = new Date(NOW.getTime() - 30 * MIN);
  const regDay = getIsraelDateKey(regAt);
  const oldReg = new Date(NOW.getTime() - 20 * DAY);
  const oldDay = getIsraelDateKey(oldReg);

  // --- הלקוחות והתרחישים (הצפי לכל אחת מוצהר ידנית; בהמשך מושווה גם ל-SQL עצמאי)
  const S = {}; // id -> { closed, ... }
  const sc = async (id, opts, expect) => { await addCustomer(id, opts); S[id] = expect; };
  await sc('sa-c-01', { notes: `${KIOSK_REG_VERIFIED_TAG} (אומתה)` }, { closed: true, verified: true });                 // נרשמה ואומתה, הזמנה מאושרת אחרי
  await sc('sa-c-02', {}, { closed: false });                                                                             // טיוטה
  await sc('sa-c-03', {}, { closed: false });                                                                             // הזמנה מחוקה
  await sc('sa-c-04', {}, { closed: false });                                                                             // הזמנה מאושרת אבל לפני הרישום
  await sc('sa-c-05', {}, { closed: true });                                                                              // נרשמה פעמיים (אותו יום) + הזמנה
  await sc('sa-c-06', { deleted: true }, { excluded: true });                                                             // לקוחה מחוקה
  await sc('sa-c-07', {}, { closed: false, savedUnpaid: true });                                                          // סטטוס NULL, פריט ממתין (לא שולם)
  await sc('sa-c-08', {}, { closed: false });                                                                             // שמור לחיוב (placeholder)
  await sc('sa-c-09', {}, { closed: false });                                                                             // כל הפריטים נמחקו
  await sc('sa-c-10', { notes: `${KIOSK_REG_PENDING_TAG} 1.1.2026` }, { closed: true, channel: 'kiosk' });               // עמדת חנות, הזמנה
  await sc('sa-c-11', { notes: `${KIOSK_REG_REPEAT_TAG} 1.1.2026` }, { closed: false });                                  // רישום חוזר; הזמנה ישנה בלבד
  await sc('sa-c-12', {}, { closed: true, old: true });                                                                   // רישום לפני 20 יום; הזמנה ביום 14 בדיוק
  await sc('sa-c-13', {}, { closed: false, old: true });                                                                  // רישום לפני 20 יום; הזמנה ביום 15
  await sc('sa-c-14', {}, { closed: false });                                                                             // בלי הזמנה בכלל
  await sc('sa-c-15', {}, { closed: true });                                                                              // הזמנה בסטטוס "חדש" עם פריט confirmed
  for (const id of ['sa-c-01', 'sa-c-02', 'sa-c-03', 'sa-c-04', 'sa-c-05', 'sa-c-06', 'sa-c-07', 'sa-c-08', 'sa-c-09', 'sa-c-11', 'sa-c-14', 'sa-c-15']) await addRegister(id, regAt);
  await addRegister('sa-c-05', new Date(regAt.getTime() + 5 * MIN), { outcome: 'existing-marked' });
  await addRegister('sa-c-10', regAt, { channel: 'kiosk' });
  await addRegister('sa-c-12', oldReg);
  await addRegister('sa-c-13', oldReg);
  const after = new Date(regAt.getTime() + 10 * MIN);
  const before = new Date(regAt.getTime() - 10 * MIN);
  await addOrder('sa-c-01', after);
  await addOrder('sa-c-02', after, { status: 'טיוטה', items: ['pending'] });
  await addOrder('sa-c-03', after, { deleted: true });
  await addOrder('sa-c-04', before);
  await addOrder('sa-c-05', new Date(regAt.getTime() + 20 * MIN));
  await addOrder('sa-c-06', after);
  await addOrder('sa-c-07', after, { items: ['pending'] });
  await addOrder('sa-c-08', after, { status: 'שמור לחיוב', deleted: true, items: [] });
  await addOrder('sa-c-09', after, { itemsDeleted: true });
  await addOrder('sa-c-10', after);
  await addOrder('sa-c-11', new Date(regAt.getTime() - 40 * DAY));
  await addOrder('sa-c-12', new Date(oldReg.getTime() + 14 * DAY - 2 * 3600000)); // 14 ימים פחות שעתיים - עדיין יום 14 בישראל אם הרישום לפני 22:00; ראו חישוב צפי ב-SQL
  await addOrder('sa-c-13', new Date(oldReg.getTime() + 15 * DAY + 2 * 3600000));
  await addOrder('sa-c-15', after, { status: 'חדש' });

  // אירועים אנונימיים דרך הפונקציה האמיתית (אותה כתיבה כמו ב-endpoint)
  const sids = (n, p) => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(18, '0')}`.slice(0, 24));
  // הקידומת sa- נדרשת לניקוי: hashSid מחזיר hex, לכן כותבים ישירות שורות עם sidHash=sa-* במקום recordAnonEvent
  void sids; void recordAnonEvent; void recordRegistrationEvent;
  let sidn = 0;
  const anon = async (type, n, dayKey, channel = 'public') => {
    for (let i = 0; i < n; i++) {
      await db.$executeRawUnsafe(`INSERT INTO "StationEvent" ("id","type","channel","dayKey","at","sidHash") VALUES ($1,$2,$3,$4,$5,$6)`, `sa-v-${++sidn}`, type, channel, dayKey, NOW, `sa-${sidn}`);
    }
  };
  await anon('visit', 40, regDay); await anon('availability', 15, regDay); await anon('form_start', 9, regDay);
  await anon('visit', 25, oldDay); await anon('form_start', 4, oldDay);
  await anon('visit', 7, regDay, 'kiosk'); // לא נספר כביקור ציבורי

  // --- ההרצה האמיתית
  const from = addDaysToDateKey(todayKey, -25);
  const res = await computeStationAnalytics(dbSvc, { from, to: todayKey, channel: 'public', windowDays: 14 }, { now: NOW });
  assert.equal(res.status, 'ok');

  // --- צפי ידני
  const regs = Object.entries(S).filter(([, v]) => !v.excluded);
  const expClosed = regs.filter(([, v]) => v.closed).length;
  const expVerified = regs.filter(([, v]) => v.verified).length;
  const publicRegs = regs.filter(([, v]) => v.channel !== 'kiosk');
  check('מילאו פרטים (ציבורי): 13 לקוחות שונות, בלי המחוקה ובלי עמדת החנות, בלי לספור פעמיים את sa-c-05', () => {
    assert.equal(res.totals.registered, publicRegs.length);
    assert.equal(res.totals.droppedDeleted, 1);
  });
  check('ביקורים / זמינות / פתיחת טופס: סכום האירועים הציבוריים בלבד (עמדת חנות לא נספרת)', () => {
    assert.equal(res.totals.visits, 65);
    assert.equal(res.totals.availability, 15);
    assert.equal(res.totals.formStart, 13);
  });
  check('חלוקה לפי ערוץ ללא קשר לסינון', () => assert.deepEqual(res.totals.registeredByChannel, { public: publicRegs.length, kiosk: 1 }));
  check('אומתו: sa-c-01 בלבד (הסימון הנוכחי), רישום חוזר / ממתינה לא נספרות', () => assert.equal(res.totals.verified, expVerified - 0));

  // --- SQL עצמאי: אזור זמן ב-PostgreSQL, בלי שום קוד של המודול
  const direct = await q(`
    WITH reg AS (
      SELECT e."customerId", min(e."at") AS first_at, (array_agg(e."dayKey" ORDER BY e."at"))[1] AS first_day
        FROM "StationEvent" e JOIN "Customer" c ON c."id" = e."customerId"
       WHERE e."type" = 'register' AND e."channel" = 'public' AND e."dayKey" BETWEEN $1 AND $2 AND NOT c."isDeleted" AND e."customerId" LIKE 'sa-c-%'
       GROUP BY e."customerId"),
    closed AS (
      SELECT r."customerId", r.first_day, r.first_at,
             EXISTS (SELECT 1 FROM "Order" o
                      WHERE o."customerId" = r."customerId" AND NOT o."isDeleted"
                        AND (o."status" IS NULL OR o."status" NOT IN ('טיוטה','שמור לחיוב'))
                        AND o."orderDate" >= r.first_at
                        AND ((o."orderDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::date <= (r.first_day::date + 14)
                        AND EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."orderId" AND NOT i."isDeleted" AND i."cartStatus" = 'confirmed')) AS is_closed,
             EXISTS (SELECT 1 FROM "Order" o
                      WHERE o."customerId" = r."customerId" AND NOT o."isDeleted"
                        AND (o."status" IS NULL OR o."status" NOT IN ('טיוטה','שמור לחיוב'))
                        AND o."orderDate" >= r.first_at
                        AND ((o."orderDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::date = r.first_day::date
                        AND EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."orderId" AND NOT i."isDeleted" AND i."cartStatus" = 'confirmed')) AS same_day
        FROM reg r)
    SELECT (SELECT count(*)::int FROM reg) AS registered,
           (SELECT count(*)::int FROM closed WHERE is_closed) AS closed,
           (SELECT count(*)::int FROM closed WHERE same_day) AS same_day`, from, todayKey);
  const d = direct[0];
  check('SQL עצמאי (אזור זמן ב-Postgres): נרשמו = מה שהמודול מחשב', () => assert.equal(res.totals.registered, d.registered));
  check('SQL עצמאי: סגרו הזמנה בחלון 14 ימים = מה שהמודול מחשב', () => assert.equal(res.totals.closedInWindow, d.closed));
  check('SQL עצמאי: סגרו באותו יום = מה שהמודול מחשב', () => assert.equal(res.totals.closedSameDay, d.same_day));
  check('צפי ידני: sa-c-01/05/10(קיוסק-לא)/12/15 סגרו - 4 בערוץ הציבורי (01, 05, 12, 15)', () => {
    const exp = publicRegs.filter(([, v]) => v.closed).length;
    assert.equal(exp, 4);
    assert.equal(res.totals.closedInWindow, exp);
  });
  void expClosed;
  check('הזמנה שנשמרה ללא תשלום (פריט ממתין, סטטוס NULL) מדווחת כ-savedUnpaid ולא כסגורה', () => assert.equal(res.totals.savedUnpaid, 1));
  check('חלון שטרם הסתיים: 12 נרשמות מהיום עדיין בחלון; 2 ישנות (לפני 20 יום) הבשילו', () => {
    assert.equal(res.totals.maturedRegistered, 2);
    assert.equal(res.totals.windowStillOpen, publicRegs.length - 2);
  });
  check('הסדרה היומית: סכום הרישומים לפי יום = registeredDaySum, ולכל יום ללא פעילות אפס', () => {
    assert.equal(res.daily.reduce((a, r) => a + r.registered, 0), res.totals.registeredDaySum);
    assert.equal(res.daily.length, 26);
    assert.ok(res.daily.filter((r) => r.day !== regDay && r.day !== oldDay).every((r) => r.registered === 0 && r.visits === 0));
  });
  check('שיעורים: ביקור->מילאו פרטים = נרשמו/ביקורים; נרשמו->הזמנה = סגרו/נרשמו', () => {
    assert.equal(res.rates.visitToRegistered, res.totals.registered / 65);
    assert.equal(res.rates.registeredToClosed, res.totals.closedInWindow / res.totals.registered);
  });

  // ערוץ עמדת חנות: top null, לקוחה אחת שסגרה
  const kiosk = await computeStationAnalytics(dbSvc, { from, to: todayKey, channel: 'kiosk', windowDays: 14 }, { now: NOW });
  check('ערוץ עמדת חנות: לקוחה אחת, סגרה, ושלבי הפתיחה לא נמדדים (null)', () => {
    assert.equal(kiosk.totals.registered, 1);
    assert.equal(kiosk.totals.closedInWindow, 1);
    assert.equal(kiosk.funnel[0].count, null);
  });

  // חלון ארוך מ-14 יום: sa-c-13 (הזמנה ביום 15) נכנסת בחלון 30
  const w30 = await computeStationAnalytics(dbSvc, { from, to: todayKey, channel: 'public', windowDays: 30 }, { now: NOW });
  check('חלון 30 יום: ההזמנה של sa-c-13 (יום 15) נספרת, כך שיש סגירה אחת יותר', () => assert.equal(w30.totals.closedInWindow, res.totals.closedInWindow + 1));

  // טווח שלא כולל את הרישומים: אפסים, שיעורים null
  const empty = await computeStationAnalytics(dbSvc, { from: addDaysToDateKey(todayKey, -400), to: addDaysToDateKey(todayKey, -380), channel: 'public', windowDays: 14 }, { now: NOW });
  check('טווח ריק: אפסים ושיעורים null', () => {
    assert.equal(empty.totals.registered, 0);
    assert.ok(Object.values(empty.rates).every((v) => v === null));
  });

  // כרטיסי היום מול אתמול
  check('כרטיסי היום: נרשמו היום = לקוחות היום (אם הרישום היה היום בישראל)', () => {
    const todayRow = res.daily.find((r) => r.day === todayKey);
    assert.equal(res.cards.today.registered, todayRow.registered);
  });

  // רשימת הרישומים של היום
  const list = await listDayRegistrations(dbSvc, { day: regDay, channel: 'all', windowDays: 14 }, { now: NOW });
  check('רשימת הרישומים של היום: שם פרטי + אות ראשונה בלבד, בלי מחוקות, סטטוס אימות, והאם סגרה', () => {
    assert.equal(list.status, 'ok');
    assert.equal(list.rows.length, 12); // 01-05, 07-11, 14, 15 (06 מחוקה, 12-13 ביום אחר)
    assert.ok(!list.rows.some((r) => r.customerId === 'sa-c-06'));
    const r1 = list.rows.find((r) => r.customerId === 'sa-c-01');
    assert.equal(r1.name, 'בדיקה א.');
    assert.equal(r1.verification, 'verified');
    assert.equal(r1.closed, true);
    assert.equal(list.rows.find((r) => r.customerId === 'sa-c-11').verification, 'repeat');
    assert.equal(list.rows.find((r) => r.customerId === 'sa-c-14').closed, false);
    assert.ok(!JSON.stringify(list).includes('אוטומטית'));
  });

  // חסרון הטבלה
  await client.query('BEGIN');
  await client.query('ALTER TABLE "StationEvent" RENAME TO "StationEvent_tmp_sa"');
  let missing;
  try { missing = await computeStationAnalytics(dbSvc, { from, to: todayKey, channel: 'public', windowDays: 14 }, { now: NOW }); } finally { await client.query('ROLLBACK'); }
  check('טבלת StationEvent חסרה: status no_table (לא קריסה)', () => assert.equal(missing.status, 'no_table'));
  const written = await (async () => { await client.query('BEGIN'); await client.query('ALTER TABLE "StationEvent" RENAME TO "StationEvent_tmp_sa"'); try { return await recordAnonEvent(dbSvc, { type: 'visit', sid: 'abcdef0123456789abcdef01' }); } finally { await client.query('ROLLBACK'); } })();
  check('כתיבת אירוע כשהטבלה חסרה: written=false, missingTable=true', () => { assert.equal(written.written, false); assert.equal(written.missingTable, true); });

  // כתיבה אמיתית דרך recordAnonEvent + ייחודיות, מול ה-DB
  const sid = 'sa-realwrite-0123456789abcdef'.replace(/[^A-Za-z0-9_-]/g, '');
  const w1 = await recordAnonEvent(dbSvc, { type: 'visit', sid, now: NOW });
  const w2 = await recordAnonEvent(dbSvc, { type: 'visit', sid, now: NOW });
  const w3 = await recordAnonEvent(dbSvc, { type: 'availability', sid, now: NOW });
  check('recordAnonEvent מול DB: הכפילות נחסמת באילוץ הייחודיות, סוג אחר נכנס', () => {
    assert.equal(w1.written, true);
    assert.equal(w2.written, false);
    assert.equal(w3.written, true);
  });
  await db.$executeRawUnsafe(`DELETE FROM "StationEvent" WHERE "dayKey" = $1 AND "sidHash" IS NOT NULL AND "sidHash" NOT LIKE 'sa-%' AND "at" = $2`, todayKey, NOW);

  // ביצועים: טווח 180 יום על ה-DB (נתוני TEST: ~22K לקוחות / ~27K הזמנות)
  const t0 = Date.now();
  await computeStationAnalytics(dbSvc, { from: addDaysToDateKey(todayKey, -179), to: todayKey, channel: 'public', windowDays: 14 }, { now: NOW });
  const ms = Date.now() - t0;
  check(`ביצועים: טווח 180 יום ב-${ms}ms (נדרש מתחת ל-8 שניות כולל השהיית רשת)`, () => assert.ok(ms < 8000));
} finally {
  await cleanup().catch((e) => console.error('ניקוי נכשל:', e.message));
  const left = await q(`SELECT (SELECT count(*)::int FROM "Customer" WHERE id LIKE 'sa-c-%') c, (SELECT count(*)::int FROM "StationEvent" WHERE "customerId" LIKE 'sa-c-%' OR "sidHash" LIKE 'sa-%') e, (SELECT count(*)::int FROM "Order" WHERE "orderId" >= ${ORDER_BASE} AND "orderId" < ${ORDER_BASE + 1000}) o`).catch(() => []);
  console.log('נשאר אחרי ניקוי:', JSON.stringify(left[0]));
  await client.end();
  if (dbSvc !== db) await dbSvc.$disconnect();
}
let fail = 0;
for (const [ok, name] of results) { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) fail++; }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
