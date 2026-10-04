import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getIsraelTodayRange, getIsraelDateKey, getIsraelDayRange, addDaysToDateKey } from '@/lib/hebrewDate';
import { LATE_RETURN_THRESHOLD_DAYS } from '@/lib/lateReturn';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting } from '@/lib/businessDays';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { missingRule, customerMissing, customerMissingWhere } from '@/lib/customerMissing';
import {
  ALERT_COLS, ALERT_LIMITS as L, parseAlertFlags, parseUnsavedIds, orderFilterAnd, classifyOutOrder, mergeReasons, buildAlertRows,
} from '@/lib/advAlerts';

// מיקוד "התראות" בחיפוש המתקדם של דף הבית (F23, החלטת הבעלים HM-04 = א): הזמנות והחזרות עם דגל שדורש טיפול.
// קריאה בלבד, חסום בתקרות (ר' ALERT_LIMITS ב-lib/advAlerts.js), שער הרשאה: page:orders (כמו התחום "הזמנות" / "תפוסה").
// מחזיר את צורת ADV_VIEW של adv / adv-b: { cols, rows, links, al, namesRev, tags, truncated, gaps }.
// כל סוג התראה נטען בנפרד ובמקביל; סוג שנכשל לא מפיל את האחרים (gaps אומר מה חסר), ורק אם כולם נכשלו = 500.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (body, status = 200) => NextResponse.json(body, { status });

const customerSelect = { firstName: true, lastName: true, phone1: true, phone2: true, email: true, city: true, street: true, houseNum: true };
const orderSelect = {
  orderId: true, eventDate: true, eventDateHebrew: true, toDate: true, returnDate: true, totalAmount: true, status: true, isDeleted: true,
  customer: { select: customerSelect },
};

async function loadCfg() {
  const all = await getAllCachedSettings().catch(() => []);
  const m = {};
  for (const s of all) m[s.key] = s.value;
  return m;
}

/* ---- איחור בהחזרה + שמלה שלא חזרה: פריט שנלקח ולא הוחזר, מועמדות = האירוע עבר (עד אתמול) או מועד ההחזרה המפורש עבר את הסף ---- */
async function loadOut(p, ctx, want) {
  const { todayStart } = ctx;
  // כמו /api/orders/overdue: המסנן ב-DB רחב ביום אחד מעבר לסף (דילוג ימים לא עובדים), הסינון המדויק ב-JS
  const cutoff = new Date(ctx.now.getTime() - (ctx.threshold - 1) * 86400000);
  const rows = await prisma.order.findMany({
    where: {
      AND: [
        ...orderFilterAnd(p, DRAFT_ORDER_STATUS),
        { items: { some: { isDeleted: false, isTaken: true, isReturned: false } } },
        { OR: [{ eventDate: { lt: todayStart } }, { toDate: { lte: cutoff } }, { returnDate: { lte: cutoff } }] },
      ],
    },
    orderBy: { eventDate: { sort: 'desc', nulls: 'last' } },
    take: L.OUT_SCAN + 1,
    select: { ...orderSelect, items: { where: { isDeleted: false }, select: { isDeleted: true, isTaken: true, isReturned: true } } },
  });
  const truncated = rows.length > L.OUT_SCAN;
  const out = [];
  for (const o of rows.slice(0, L.OUT_SCAN)) {
    const c = classifyOutOrder(o, ctx);
    if (c && want.has(c.flag)) out.push({ order: o, reason: c });
  }
  return { list: out, truncated };
}

/* ---- חוב פתוח: אותו כלל כמו adv-b "כספים" (שולם < סכום, ללא תשלומים מחוקים), רק לאירועים שעברו, עד שנה אחורה ---- */
async function loadDebt(p, ctx) {
  const { todayStart } = ctx;
  const lookbackStart = getIsraelDayRange(addDaysToDateKey(ctx.todayKey, -L.DEBT_LOOKBACK_DAYS)).start;
  const cand = await prisma.$queryRaw`
    SELECT o."orderId", COALESCE(o."totalAmount", 0) AS total, COALESCE(SUM(pm."amount"), 0) AS paid
    FROM "Order" o
    LEFT JOIN "Payment" pm ON pm."orderId" = o."orderId" AND pm."isDeleted" = false
    WHERE o."isDeleted" = false AND COALESCE(o."totalAmount", 0) > 0
      AND (o."status" IS NULL OR o."status" <> ${DRAFT_ORDER_STATUS})
      AND o."eventDate" >= ${lookbackStart} AND o."eventDate" < ${todayStart}
    GROUP BY o."orderId", o."totalAmount", o."eventDate"
    HAVING COALESCE(SUM(pm."amount"), 0) < o."totalAmount"
    ORDER BY o."eventDate" DESC
    LIMIT ${L.DEBT_IDS + 1}`;
  const idsTruncated = cand.length > L.DEBT_IDS;
  const owed = new Map(cand.slice(0, L.DEBT_IDS).map((r) => [Number(r.orderId), Number(r.total) - Number(r.paid)]));
  if (!owed.size) return { list: [], truncated: false };
  const rows = await prisma.order.findMany({
    where: { AND: [...orderFilterAnd(p, DRAFT_ORDER_STATUS), { orderId: { in: [...owed.keys()] } }] },
    orderBy: { eventDate: { sort: 'desc', nulls: 'last' } },
    take: L.DEBT_ROWS + 1,
    select: orderSelect,
  });
  const truncated = idsTruncated || rows.length > L.DEBT_ROWS;
  return { list: rows.slice(0, L.DEBT_ROWS).map((o) => ({ order: o, reason: { flag: 'ar_debt', amount: owed.get(o.orderId) || 0 } })), truncated };
}

/* ---- פרטי לקוח חסרים: הזמנות שהאירוע שלהן עוד לפנינו (היום והלאה) והלקוחה חסרת פרט חובה ---- */
async function loadMissing(p, ctx) {
  const rule = missingRule(ctx.cfg);
  const rows = await prisma.order.findMany({
    where: { AND: [...orderFilterAnd(p, DRAFT_ORDER_STATUS), { eventDate: { gte: ctx.todayStart } }, { customer: customerMissingWhere(rule) }] },
    orderBy: { eventDate: 'asc' },
    take: L.MISSING_SCAN + 1,
    select: orderSelect,
  });
  const truncated = rows.length > L.MISSING_SCAN;
  return {
    list: rows.slice(0, L.MISSING_SCAN).filter((o) => customerMissing(o.customer, rule)).map((o) => ({ order: o, reason: { flag: 'ar_missing' } })),
    truncated,
  };
}

/* ---- שינויים שלא נשמרו: מספרי ההזמנות שהדפדפן שלח (טיוטות localStorage), רק הזמנות קיימות ולא מחוקות ---- */
async function loadUnsaved(p, ids) {
  if (!ids.length) return { list: [], truncated: false };
  const rows = await prisma.order.findMany({
    where: { AND: [...orderFilterAnd(p, DRAFT_ORDER_STATUS), { orderId: { in: ids } }] },
    orderBy: { eventDate: { sort: 'desc', nulls: 'last' } },
    take: L.UNSAVED_ROWS + 1,
    select: orderSelect,
  });
  return { list: rows.slice(0, L.UNSAVED_ROWS).map((o) => ({ order: o, reason: { flag: 'ar_unsaved' } })), truncated: rows.length > L.UNSAVED_ROWS };
}

const SECTION_LABEL = { out: 'איחורים ושמלות שלא חזרו', ar_debt: 'חובות', ar_missing: 'פרטי לקוח חסרים', ar_unsaved: 'שינויים שלא נשמרו' };

export async function GET(request) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  try {
    // אותו שער כמו התחום "הזמנות" / "תפוסה" (page:orders) — "לכל מי שיש לה הרשאה לדף ההזמנות"
    if (!(await canOpenPage('page:orders'))) return json({ error: 'Forbidden' }, 403);

    const p = Object.fromEntries(new URL(request.url).searchParams.entries());
    const picked = parseAlertFlags(p.flags);
    const want = new Set(picked.length ? picked : ['ar_late', 'ar_unret', 'ar_debt', 'ar_missing', 'ar_unsaved']);
    const cfg = await loadCfg();
    const now = new Date();
    const todayKey = getIsraelDateKey(now);
    const ctx = {
      cfg, now, todayKey,
      todayStart: getIsraelTodayRange(now).start,
      threshold: Number(cfg.late_return_threshold_days) || LATE_RETURN_THRESHOLD_DAYS,
      nonWorkingDays: parseNonWorkingDaysSetting(cfg[NON_WORKING_DAYS_SETTING_KEY] ?? null),
    };

    const jobs = [];
    if (want.has('ar_late') || want.has('ar_unret')) jobs.push(['out', () => loadOut(p, ctx, want)]);
    if (want.has('ar_debt')) jobs.push(['ar_debt', () => loadDebt(p, ctx)]);
    if (want.has('ar_missing')) jobs.push(['ar_missing', () => loadMissing(p, ctx)]);
    const unsavedIds = parseUnsavedIds(p.unsaved);
    if (want.has('ar_unsaved') && unsavedIds.length) jobs.push(['ar_unsaved', () => loadUnsaved(p, unsavedIds)]); // בלי מספרים אין מה לשאול את ה-DB

    const settled = await Promise.allSettled(jobs.map(([, run]) => run()));
    const failedSections = [];
    const all = [];
    let truncated = false;
    let failed = 0;
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') { all.push(...r.value.list); truncated = truncated || r.value.truncated; return; }
      failed++;
      console.error('a5 adv-alerts section ' + jobs[i][0] + ':', r.reason?.message || r.reason);
      failedSections.push(SECTION_LABEL[jobs[i][0]]);
    });
    if (jobs.length && failed === jobs.length) return json({ error: 'שגיאה בחיפוש ההתראות' }, 500);

    let rows = buildAlertRows(mergeReasons(all));
    if (rows.length > L.ROWS) { truncated = true; rows = rows.slice(0, L.ROWS); }
    return json({
      cols: ALERT_COLS,
      rows: rows.map((x) => x.cells),
      links: rows.map((x) => x.link),
      al: [],
      namesRev: rows.map((x) => x.nameRev),
      tags: rows.map((x) => x.tag),
      truncated,
      gaps: [],
      failed: failedSections, // סוגים שלא נטענו (שאילתה נכשלה); שאר הסוגים חזרו — הלקוח מציג הודעה
    });
  } catch (error) {
    console.error('GET /api/a5/adv-alerts error:', error);
    return json({ error: 'שגיאה בחיפוש ההתראות' }, 500);
  }
}
