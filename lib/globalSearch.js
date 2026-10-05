// lib/globalSearch.js - הלוגיקה של GET /api/global-search (חיפוש ראשי של דף הבית, שורת החיפוש העליונה והדף הישן). השרת בלבד (prisma).
// ה-route (app/api/global-search/route.js) דק: התחברות, קריאת q / extras, והפעלת runGlobalSearch.
//
// מה כאן, לפי החלטות הבעלים 5.10.2026 (scratch/search-improvement/A-map-main-search.md):
//   - שלוש השאילתות הרגילות (לקוחות / הזמנות / פריטי השכרה) כמו קודם, עם: הברחת % ו-_ (LIKE), טלפון לפי ספרות בלבד ("050-123" = "050123", +972),
//     phone2 גם בהזמנות, מס' הזמנה מדויק קודם (ORDER BY), תאריך עברי/לועזי בהתאמה מדויקת (לא תת-מחרוזת), וסטטוס הזמנה מחושב (calculateOrderStatus).
//   - extras=1 (רק הבית החדש): שורות "מלאי" לברקוד (פרטי הפריט + כל המידות של הדגם), חיפוש מילות מפתח "מידה 2 דגם 3" והצ'יפים של הלו"ז ליום שהוקלד.
//     אלה לא נשלחות לצרכנים האחרים (סרגל עליון / דף ישן) - אין להם עלות ואין בהם שדות חדשים שהם לא מכירים.
//   - הרשאות מוכרעות כאן, בשרת: קישור לכרטיס הדגם (page:dresses_catalog) ושדות מוסתרים; הלו"ז (page:schedule) - בלעדיה לא נשלח כלום מהלו"ז.
//
// אבטחה: רשימות עמודות מפורשות בכל SELECT (אין * ולא o.* / oi.*) - ר' scripts/test_search_leak_gate.mjs. כל קריאה ל-DB היא קריאה בלבד,
// ובלי טרנזקציות (אין שליפות בתוך $transaction).

import prisma from '@/app/lib/prisma';
import { buildMultiWordNameSql, buildFuzzyNameSql } from '@/lib/searchUtils';
import { findCustomerIdsByPhone } from '@/lib/searchDb';
import { canOpenPage } from '@/lib/permissions';
import { getCachedSetting } from '@/lib/settingsCache';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { getIsraelDayRange, getHebrewDateString } from '@/lib/hebrewDate';
import { escapeLike, gregorianCandidateKeys, israelDayKey, sizeKey, sizeMatches } from '@/lib/searchNormalize';
import { hebrewDateKeyRanges } from '@/lib/listSearch';
import { planGlobalSearch, rowLimit } from '@/lib/homeSearchPlan';
import { bucketModelSizes, buildInventoryRow, compareInventoryRows, projectInventoryRow, MODEL_CARD_PAGE_KEY } from '@/lib/homeSearchInventory';

export const SCHEDULE_PAGE_KEY = 'page:schedule';
const INT32_MAX = 2147483647;
const KEYWORD_ROWS_CAP = 20;   // שורות מלאי של מילות מפתח שנשלחות (השאר: truncated)
const KEYWORD_MODELS_CAP = 20; // דגמים שנכנסים לחישוב הזמינות (קריאה אחת ל-getBulkAvailableInventory, לכל היותר 20 דגמים): חיפוש "מידה N" בלי דגם או דגם לפי שם (קודם 60 - חישוב זמינות יקר)
const SCHEDULE_TTL_MS = 30 * 1000;

const EMPTY = () => ({ customers: [], orders: [], rentals: [] });

// ---------------------------------------------------------------------------------------------------------------------------------
// שלוש השאילתות הרגילות
// ---------------------------------------------------------------------------------------------------------------------------------

export const PHONE_PARTIAL_MIN_DIGITS = 5; // תת-מחרוזת ספרות קצרה מזה לא נשלחת לחיפוש טלפון (רחבה מדי, וסורקת את כל הלקוחות)

/**
 * מזהי לקוחות לפי טלפון, בשאילתה אחת קטנה (lib/searchDb.js findCustomerIdsByPhone: regexp_replace רק על טבלת Customer, חסום ב-LIMIT 300 ובמיון id) -
 * ואז השאילתות הראשיות מסננות לפי "customerId = ANY(...)" במקום להריץ regexp_replace על כל שורת הזמנה אחרי ה-JOIN (2-6 פעמים לשורה).
 * מספר שלם = שוויון לצורות השקולות (0501234567 / 972501234567, וגם 501234567 בלי 0); חלקי = תת-מחרוזת ספרות מ-5 ספרות ומעלה (קצר מזה: לא מחפשים לפי
 * ספרות - נשאר רק ה-LIKE הרגיל על מה שהוקלד). מחזיר [] כשאין מה לחפש / לא נמצא.
 */
export async function resolvePhoneIds(plan) {
  const ph = plan.phone;
  if (!ph || !ph.key) return [];
  if (!ph.partial) {
    const exact = [...(ph.equivalents || [])];
    // מספר בלי 0 מוביל (501234567): מתאים לערך השמור במלואו עם 0
    if (!ph.key.startsWith('0') && ph.key.length === 9) exact.push('0' + ph.key);
    return exact.length ? findCustomerIdsByPhone({ exact: [...new Set(exact)], partial: null }) : [];
  }
  if (ph.key.length < PHONE_PARTIAL_MIN_DIGITS) return [];
  return findCustomerIdsByPhone({ exact: [], partial: ph.key });
}

/** תנאי תאריך להזמנות: טקסט עברי באסימונים שלמים (regex אחרי הסרת גרשיים) + eventDate בטווחי היום הישראלי של המפתחות המועמדים. */
function dateConds(plan, params) {
  if (!plan.date) return [];
  const out = [];
  if (plan.date.regex) {
    params.push(plan.date.regex);
    out.push(`regexp_replace(COALESCE(o."eventDateHebrew", ''), '["״׳'']', '', 'g') ~ $${params.length}`);
  }
  // טווחי eventDate: אותם מחוללי טווחים כמו רשימת ההזמנות (lib/listSearch.js hebrewDateKeyRanges / gregorianCandidateKeys עם אותו חלון שנים), כדי שאותו תאריך
  // יחזיר את אותן הזמנות בדף הבית ובמסך ההזמנות. plan.date.keys (חלון צר: שנה אחורה) נשאר רק ללו"ז / זמינות (צ'יפים והשורה "מלאי").
  const ranges = plan.date.calendar === 'hebrew'
    ? hebrewDateKeyRanges(plan.date.parsed)
    : gregorianCandidateKeys(plan.date.parsed, { back: 8, forward: 2 }).map((k) => [k, k]);
  for (const [from, to] of ranges) {
    params.push(getIsraelDayRange(from).start, getIsraelDayRange(to).end);
    out.push(`(o."eventDate" >= $${params.length - 1} AND o."eventDate" <= $${params.length})`);
  }
  return out;
}

async function runCustomers(plan, limit, phoneIds) {
  const params = [plan.likePattern || '%', plan.orderNumber ?? -1, plan.text];
  const words = escapeLike(plan.text);
  const nameWords = buildMultiWordNameSql(words, params.length + 1, '"firstName"', '"lastName"');
  if (nameWords) params.push(...nameWords.params);
  const fuzzy = buildFuzzyNameSql(plan.text, params.length + 1, '"firstName"', '"lastName"', '"firstNamePhoneticKey"', '"lastNamePhoneticKey"');
  if (fuzzy) params.push(...fuzzy.params);
  const conds = [
    '"firstName" LIKE $1', '"lastName" LIKE $1', 'phone1 LIKE $1', 'phone2 LIKE $1', 'city LIKE $1', 'id = $3',
    ...(nameWords ? [nameWords.clauseSql] : []),
  ];
  if (phoneIds.length) { params.push(phoneIds); conds.push(`"id" = ANY($${params.length}::text[])`); }
  const exactSql = conds.join(' OR ');
  return prisma.$queryRawUnsafe(`
        SELECT "id", "firstName", "lastName", "phone1", "phone2", "city",
          COALESCE(
            ${exactSql}
          , false) AS "isExactMatch",
          ${fuzzy ? fuzzy.scoreSql : '0'} AS "fuzzyScore"
        FROM "Customer"
        WHERE "isDeleted" = false
        AND (
          ${exactSql}
          ${fuzzy ? `OR ${fuzzy.clauseSql}` : ''}
        )
        ORDER BY "isExactMatch" DESC, "fuzzyScore" DESC NULLS LAST, "updatedAt" DESC
        LIMIT ${limit}
      `, ...params);
}

async function runOrders(plan, limit, phoneIds) {
  const hasText = !!plan.text;
  const params = [plan.likePattern || '%', plan.orderNumber ?? -1, plan.text];
  const nameWords = hasText ? buildMultiWordNameSql(escapeLike(plan.text), params.length + 1, 'c."firstName"', 'c."lastName"') : null;
  if (nameWords) params.push(...nameWords.params);
  const fuzzy = hasText ? buildFuzzyNameSql(plan.text, params.length + 1, 'c."firstName"', 'c."lastName"', 'c."firstNamePhoneticKey"', 'c."lastNamePhoneticKey"') : null;
  if (fuzzy) params.push(...fuzzy.params);
  const conds = [];
  if (hasText) {
    conds.push('c."firstName" LIKE $1', 'c."lastName" LIKE $1', 'c.phone1 LIKE $1', 'c.phone2 LIKE $1', 'o.id = $3');
    if (!plan.date) {
      // התנהגות קודמת לטקסט שאינו תאריך מזוהה (למשל שנה לבדה): חיפוש תת-מחרוזת בתאריך
      conds.push('o."eventDateHebrew" LIKE $1');
      if (/[/-]/.test(plan.text)) conds.push(`TO_CHAR(o."eventDate", 'DD/MM/YYYY') LIKE $1`, `TO_CHAR(o."eventDate", 'DD-MM-YYYY') LIKE $1`);
    }
    if (nameWords) conds.push(nameWords.clauseSql);
  }
  if (plan.orderNumber !== null) conds.push('o."orderId" = $2');
  if (phoneIds.length) { params.push(phoneIds); conds.push(`o."customerId" = ANY($${params.length}::text[])`); }
  conds.push(...dateConds(plan, params));
  const exactSql = conds.join(' OR ');
  const orderFirst = plan.orderNumber !== null ? 'CASE WHEN o."orderId" = $2 THEN 0 ELSE 1 END, ' : '';
  const itemStats = `(SELECT json_build_object(
            'n', COUNT(*) FILTER (WHERE NOT oi."isDeleted"),
            'all', COUNT(*),
            'taken', COUNT(*) FILTER (WHERE NOT oi."isDeleted" AND oi."isTaken"),
            'returned', COUNT(*) FILTER (WHERE NOT oi."isDeleted" AND oi."isReturned")
          ) FROM "OrderItem" oi WHERE oi."orderId" = o."orderId") AS "itemStats"`;
  return prisma.$queryRawUnsafe(`
        SELECT o."id", o."orderId", o."customerId", o."status", o."totalAmount",
          o."eventDate", o."eventDateHebrew", c."firstName", c."lastName",
          (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o."orderId" AND oi."isDeleted" = false) as "itemCount",
          ${itemStats},
          COALESCE(
            ${exactSql}
          , false) AS "isExactMatch",
          ${fuzzy ? fuzzy.scoreSql : '0'} AS "fuzzyScore"
        FROM "Order" o
        LEFT JOIN "Customer" c ON o."customerId" = c.id
        WHERE o."isDeleted" = false
        AND (
          ${exactSql}
          ${fuzzy ? `OR ${fuzzy.clauseSql}` : ''}
        )
        ORDER BY ${orderFirst}"isExactMatch" DESC, "fuzzyScore" DESC NULLS LAST, o."orderId" DESC
        LIMIT ${limit}
      `, ...params);
}

async function runRentals(plan, limit) {
  // חיפוש שנראה כמו ברקוד: ברקוד חוזר בהזמנות רבות לאורך השנים, ולכן הפריט שמושכר עכשיו (נלקח ולא הוחזר) קודם.
  const rentalsOrderBy = plan.barcode
    ? `CASE WHEN oi."isTaken" AND NOT oi."isReturned" THEN 0 ELSE 1 END, oi."createdAt" DESC`
    : `oi."createdAt" DESC`;
  const params = [plan.likePattern, plan.orderNumber ?? -1, plan.text];
  // d."dressName"/d."barcodePrefix" הם שדות ישנים (לפני המיגרציה); פריטים חדשים נושאים שם/ברקוד ב-DressModel, ולכן COALESCE על שניהם.
  // Order + Customer: ברקוד אחד חוזר בהשכרות רבות - כל שורה נושאת מה שמבדיל ביניהן (תאריך אירוע ושם הלקוחה). שני ה-JOIN הם 1:1 על מפתח ייחודי.
  return prisma.$queryRawUnsafe(`
        SELECT oi."id", oi."orderId", oi."barcode", oi."sizeText", oi."description",
          oi."isTaken", oi."isReturned",
          COALESCE(d."dressName", dm."name") as "catalogName",
          COALESCE(d."barcodePrefix", dm."barcodePrefix") as "catalogBarcode",
          o."eventDate", o."eventDateHebrew", c."firstName", c."lastName"
        FROM "OrderItem" oi
        LEFT JOIN "DressItem" d ON oi."dressItemId" = d.id
        LEFT JOIN "DressModel" dm ON d."dressModelId" = dm.id
        LEFT JOIN "Order" o ON o."orderId" = oi."orderId"
        LEFT JOIN "Customer" c ON o."customerId" = c.id
        WHERE oi."isDeleted" = false
        AND (
          oi.description LIKE $1 OR
          oi."sizeText" LIKE $1 OR
          COALESCE(d."dressName", dm."name") LIKE $1 OR
          oi.barcode LIKE $1 OR
          CAST(oi."barcodePrefix" AS TEXT) LIKE $1 OR
          CAST(COALESCE(d."barcodePrefix", dm."barcodePrefix") AS TEXT) LIKE $1 OR
          oi."orderId" = $2 OR
          oi.id = $3
        )
        ORDER BY ${rentalsOrderBy}
        LIMIT ${limit}
      `, ...params);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// סטטוס הזמנה מחושב (lib/orderStatus.js) מתוך ספירות הפריטים שהשאילתה החזירה
// ---------------------------------------------------------------------------------------------------------------------------------

/** בונה רשימת פריטים סינתטית מהספירות, כך ש-calculateOrderStatus (הפונקציה היחידה שמגדירה סטטוס) תחושב בדיוק כמו במסך ההזמנות. */
export function orderStatusFromStats(order, stats, { draftsAsDeleted = false, now = new Date() } = {}) {
  const st = stats || {};
  const all = Number(st.all) || 0;
  const n = Number(st.n) || 0;
  const taken = Number(st.taken) || 0;
  const returned = Number(st.returned) || 0;
  const items = [];
  for (let i = 0; i < all; i++) {
    const valid = i >= all - n;           // המחוקים קודם במערך
    const j = i - (all - n);              // אינדקס בין הלא-מחוקים
    items.push({ isDeleted: !valid, isReturned: valid && j < returned, isTaken: valid && j < taken });
  }
  return calculateOrderStatus({ status: order.status, isDeleted: false, eventDate: order.eventDate, items }, { draftsAsDeleted, now });
}

async function loadDraftsAsDeleted() {
  try {
    const row = await getCachedSetting('draft_orders_show_as_deleted');
    return row ? row.value === 'true' : true; // ברירת המחדל כמו בכרטיס ההזמנה (orderCardLogic.js)
  } catch { return true; }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// extras: מלאי לברקוד, מילות מפתח, צ'יפים של הלו"ז
// ---------------------------------------------------------------------------------------------------------------------------------

const noonUtc = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); };
// הזמינות מחושבת ל-12:00 UTC של היום (אותו יום קלנדרי בישראל גם בימי מעבר שעון - ר' lib/stockCheck.js)

function dateLabelFor(plan, todayKey) {
  const key = plan.date && plan.date.key ? plan.date.key : todayKey;
  if (!plan.date || !plan.date.key) return { key, label: 'היום' };
  const [y, m, d] = key.split('-').map(Number);
  return { key, label: getHebrewDateString(new Date(y, m - 1, d)) };
}

async function findBarcodeModel(plan) {
  const b = plan.barcode;
  // 1) הפריט עצמו (DressItem.dressBarcode, מאונדקס) - אומת מול app/api/rentals/scan/route.js
  const item = await prisma.dressItem.findFirst({
    where: { dressBarcode: b.digits, isDeleted: false },
    select: {
      id: true, dressBarcode: true, sizeText: true, serialNumber: true, location: true, inRepair: true, notInUse: true,
      dress: { select: { id: true, name: true, barcodePrefix: true, isDeleted: true } },
    },
  });
  if (item && item.dress && !item.dress.isDeleted) return { item, model: item.dress, itemMissing: false };
  // 2) הפריט לא קיים (למשל ברקוד שמעולם לא נוסף): הדגם לפי הקידומת, רק אם הוא חד-משמעי.
  //    רק מ-7 ספרות: 5-6 ספרות הן קודם כל מס' הזמנה (classifyQuery), והברקוד הוא פרשנות שנייה - אין מנחשים ממנו דגם (קידומת של 1-2 ספרות הייתה מציגה "דגם 5" להזמנה 52103).
  if (b.digits.length < 7) return null;
  const prefix = Number(b.prefix);
  if (!b.prefix || !Number.isSafeInteger(prefix) || prefix > INT32_MAX) return null;
  const models = await prisma.dressModel.findMany({ where: { barcodePrefix: prefix, isDeleted: false }, select: { id: true, name: true, barcodePrefix: true }, take: 2 });
  if (models.length !== 1) return null;
  return { item: null, model: models[0], itemMissing: true };
}

async function barcodeInventory(plan, rentals, todayKey, getBulk) {
  const found = await findBarcodeModel(plan);
  if (!found) return [];
  const { key, label } = dateLabelFor(plan, todayKey);
  const bulk = await getBulk(noonUtc(key), [found.model.id]);
  const sizes = bucketModelSizes(bulk[found.model.id]);
  const rentedNow = (rentals || []).some((r) => String(r.barcode) === plan.barcode.digits && r.isTaken && !r.isReturned);
  const ownKey = sizeKey(found.item ? found.item.sizeText : plan.barcode.size);
  return [buildInventoryRow({
    type: 'barcode', model: found.model, item: found.item, barcode: plan.barcode.digits, rentedNow, sizes,
    dateKey: key, dateLabel: label, ownSizeKey: ownKey, itemMissing: found.itemMissing,
  })];
}

// דגמים לפי מילות המפתח. דגם: מספר = קידומת ברקוד מדויקת (או שם שמכיל); טקסט = שם שמכיל; התאמה מדויקת מנצחת חלקית (כמו lib/stockCheck.js).
// מידה בלבד: כל הדגמים שיש להם פריט פעיל במידה (התאמה מדויקת לפי מפתח המידה: "2" = "02", לעולם לא 12).
async function resolveKeywordModels(kw) {
  if (kw.model) {
    const num = /^\d+$/.test(kw.model) ? parseInt(kw.model, 10) : null;
    const numOk = num !== null && num <= INT32_MAX;
    const rows = await prisma.dressModel.findMany({
      where: { isDeleted: false, OR: [{ name: { contains: kw.model, mode: 'insensitive' } }, ...(numOk ? [{ barcodePrefix: num }] : [])] },
      select: { id: true, name: true, barcodePrefix: true },
      orderBy: { barcodePrefix: 'asc' },
      take: KEYWORD_MODELS_CAP + 1, // אחד מעבר לתקרה - כדי לדעת אם נחתכנו
    });
    const exact = rows.filter((m) => m.name === kw.model || (numOk && m.barcodePrefix === num));
    return { models: (exact.length ? exact : rows).slice(0, KEYWORD_MODELS_CAP), capped: rows.length > KEYWORD_MODELS_CAP };
  }
  const existing = await prisma.dressItem.groupBy({ by: ['sizeText'], where: { isDeleted: false, notInUse: false, inRepair: false, dressModelId: { not: null } } });
  const raws = existing.map((r) => r.sizeText).filter((v) => v != null && v !== '' && sizeMatches(v, kw.size));
  if (!raws.length) return { models: [], capped: false };
  const groups = await prisma.dressItem.groupBy({ by: ['dressModelId'], where: { isDeleted: false, notInUse: false, inRepair: false, dressModelId: { not: null }, sizeText: { in: raws } } });
  const ids = [...new Set(groups.map((g) => g.dressModelId).filter(Boolean))];
  if (!ids.length) return { models: [], capped: false };
  const rows = await prisma.dressModel.findMany({ where: { id: { in: ids }, isDeleted: false }, select: { id: true, name: true, barcodePrefix: true }, orderBy: { barcodePrefix: 'asc' }, take: KEYWORD_MODELS_CAP });
  return { models: rows, capped: ids.length > KEYWORD_MODELS_CAP };
}

async function keywordInventory(plan, todayKey, getBulk) {
  const kw = plan.keywords;
  const { models, capped } = await resolveKeywordModels(kw);
  if (!models.length) return { rows: [], truncated: false };
  const { key, label } = dateLabelFor(plan, todayKey);
  const bulk = await getBulk(noonUtc(key), models.map((m) => m.id));
  const wantKey = kw.size ? sizeKey(kw.size) : null;
  const rows = [];
  for (const m of models) {
    let sizes = bucketModelSizes(bulk[m.id]);
    if (wantKey) sizes = sizes.filter((s) => s.key === wantKey);
    if (!sizes.length) continue;
    rows.push(buildInventoryRow({ type: 'model', model: m, sizes, dateKey: key, dateLabel: label, ownSizeKey: wantKey }));
  }
  rows.sort(compareInventoryRows);
  return { rows: rows.slice(0, KEYWORD_ROWS_CAP), truncated: capped || rows.length > KEYWORD_ROWS_CAP };
}

const scheduleCache = new Map(); // dayKey -> { at, day }
export function __resetGlobalSearchCache() { scheduleCache.clear(); }

async function scheduleChips(plan, now, getDay) {
  const key = plan.date && plan.date.key;
  if (!key) return null;
  // ההרשאה נבדקת לפני כל חישוב: בלי page:schedule לא נטען לו"ז ולא נשלחים מונים (הלו"ז כולו נחסם ב-/api/schedule לאותה עובדת)
  if (!(await canOpenPage(SCHEDULE_PAGE_KEY))) return null;
  let hit = scheduleCache.get(key);
  if (!hit || now.getTime() - hit.at > SCHEDULE_TTL_MS) {
    const day = await getDay({ date: key, user: null, skipStaff: true, now });
    hit = { at: now.getTime(), day };
    if (scheduleCache.size >= 20) scheduleCache.delete(scheduleCache.keys().next().value);
    scheduleCache.set(key, hit);
  }
  const day = hit.day;
  return {
    date: key,
    dateHebrew: day.dateHebrew || '',
    weekday: day.weekday || '',
    nonWorkingDay: !!day.nonWorkingDay,
    nonWorkingTitles: (day.dayStatus && day.dayStatus.titles) || [],
    link: '/schedule?date=' + key,
    chips: (day.stages || [])
      .filter((s) => s.enabled && s.counts && s.counts.total > 0)
      .map((s) => ({ key: s.key, label: s.plural || s.label, total: s.counts.total, pending: s.counts.pending || 0, alerts: s.counts.alerts || 0, infoOnly: !!s.infoOnly })),
  };
}

async function loadExtras(plan, rentals, now, deps) {
  const todayKey = israelDayKey(now);
  const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { console.error('global-search extras error:', e && e.message); return fallback; } };
  const [barcodeRows, kw, dateChips] = await Promise.all([
    plan.barcode ? safe(async () => barcodeInventory(plan, rentals, todayKey, await deps.getBulk()), []) : [],
    plan.keywords ? safe(async () => keywordInventory(plan, todayKey, await deps.getBulk()), { rows: [], truncated: false }) : { rows: [], truncated: false },
    plan.date && plan.date.key ? safe(async () => scheduleChips(plan, now, await deps.getDay()), null) : null,
  ]);
  const full = [...barcodeRows, ...kw.rows];
  let inventory = [];
  if (full.length) {
    // ההרשאה לכרטיס הדגם נבדקת פעם אחת, רק כשיש שורה להציג
    const canLink = await safe(() => canOpenPage(MODEL_CARD_PAGE_KEY), false);
    inventory = full.map((r) => projectInventoryRow(r, { canLink: !!canLink }));
  }
  return { inventory, inventoryTruncated: !!kw.truncated, dateChips };
}

const defaultDeps = {
  getBulk: async () => (await import('@/lib/inventory')).getBulkAvailableInventory,
  getDay: async () => (await import('@/lib/schedule')).getScheduleDay,
};

// ---------------------------------------------------------------------------------------------------------------------------------
// נקודת הכניסה
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * @param {string} q       מה שהוקלד
 * @param {{extras?: boolean, now?: Date, deps?: object}} [opts]
 * @returns {Promise<{customers: any[], orders: any[], rentals: any[], inventory?: any[], inventoryTruncated?: boolean, dateChips?: object|null}>}
 */
export async function runGlobalSearch(q, { extras = false, now = new Date(), deps = defaultDeps } = {}) {
  const plan = planGlobalSearch(q, { now });
  const empty = EMPTY();
  if (plan.kind === 'empty' || plan.tooShort) return extras ? { ...empty, inventory: [], inventoryTruncated: false, dateChips: null } : empty;
  const limit = rowLimit(plan);

  // טלפון: קודם מזהי הלקוחות (שאילתה קטנה וחסומה), ואז שלוש החיפושים הרגילים במקביל; הברחת LIKE נעשית ב-plan.likePattern
  const phoneIds = plan.phone && (plan.run.customers || plan.run.orders) ? await resolvePhoneIds(plan) : [];
  const [customers, orders, rentals] = await Promise.all([
    plan.run.customers ? runCustomers(plan, limit, phoneIds) : [],
    plan.run.orders ? runOrders(plan, limit, phoneIds) : [],
    plan.run.rentals ? runRentals(plan, limit) : [],
  ]);

  const draftsAsDeleted = orders.length ? await loadDraftsAsDeleted() : false;
  const processedOrders = orders.map((o) => {
    const { itemStats, ...rest } = o;
    return {
      ...rest,
      itemCount: o.itemCount ? Number(o.itemCount) : 0,
      // הסטטוס המחושב (כמו במסך ההזמנות); השדה status נשאר כפי שנשמר - צרכנים ישנים קוראים אותו
      computedStatus: orderStatusFromStats(o, itemStats, { draftsAsDeleted, now }),
    };
  });

  const out = { customers, orders: processedOrders, rentals };
  if (!extras) return out;
  const ex = await loadExtras(plan, rentals, now, deps);
  return { ...out, ...ex };
}
