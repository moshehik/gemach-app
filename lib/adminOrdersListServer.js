// lib/adminOrdersListServer.js - השאילתות של רשימת ההזמנות לניהול (נקרא רק מ-app/api/admin/orders-list/*, שמוגן להנהלה ראשית / מתכנת).
// כל החיפוש (שם / טלפון / מספר הזמנה / ברקוד / דגם / תאריך עברי, הצלת מקלדת, שמות דומים) הוא אותם עוזרים של /api/orders (lib/listSearch.js,
// lib/searchDb.js) - הרשימה הזו לא ממציאה כללי חיפוש. הלוגיקה הטהורה (סטטוס נגזר, סינון, מיון, ספירות) ב-lib/adminOrdersList.js.
//
// עלות (ר' docs/a5-staff-models/orders-list-notes.md): שאילתת צבירה אחת לכל ההזמנות ("תמונה", ORDER_SNAPSHOT_SQL) במטמון של 30 שניות עם איחוד בקשות
// -> סינון / מיון / ספירות / חוב נגזרים בזיכרון. בכל בקשת רשימה נשלפות מה-DB רק שורות העמוד (לפי מזהה) + (בחיפוש) מזהי ההזמנות התואמות.
// כל שאילתה עוברת דרך guarded() (SET LOCAL statement_timeout) ובקשה כבדה דרך runLimited (מגבלת מקביליות) - חריגה = 503 "צמצמו את הסינון".

import prisma from '@/app/lib/prisma';
import { getCachedSetting } from '@/lib/settingsCache';
import { currentDbModeTag } from '@/lib/dbMode';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { buildMultiWordRelationNameCondition } from '@/lib/searchUtils';
import {
  planListSearch, planNeedsPhoneIds, planModelLookup, orderSearchCondition, buildRetryVariants, shouldRetryEmptySearch, memoLookup, NOTICE_PARTIAL,
} from '@/lib/listSearch';
import { findCustomerIdsByPhone, findFuzzyCustomerIds } from '@/lib/searchDb';
import { ORDER_SNAPSHOT_SQL, buildFact, countFacts, filterFacts, orderRowsSql, shapeOrderRow, sortFacts } from '@/lib/adminOrdersList';
import { guarded, runLimited } from '@/lib/adminListDb';
import { AGG_TTL_MS, BudgetError, COUNTS_TTL_MS, MSG_NARROWER, createDeadline, createTtlCache } from '@/lib/adminListGuards';

const SNAPSHOT_TTL_MS = 30 * 1000; // התמונה משקפת הזמנות שנוצרו / שונו עד 30 שניות אחורה (הספירות, הסדר והעימוד; שורות העמוד עצמן תמיד טריות)
const SNAPSHOT_TIMEOUT_MS = 12000;
const SEARCH_IDS_CAP = 20000; // חיפוש רחב מזה = "צמצמו את החיפוש"

const snapshotCache = createTtlCache({ ttl: SNAPSHOT_TTL_MS, max: 4 });
const searchCache = createTtlCache({ ttl: COUNTS_TTL_MS, max: 200 });

async function draftsAsDeletedSetting() {
  try {
    const s = await getCachedSetting('draft_orders_show_as_deleted');
    return !s || s.value !== 'false'; // כמו הדף הישן: ברירת מחדל "true"
  } catch { return true; }
}

async function makeContext() {
  return { todayKey: getIsraelTodayKey(), draftsAsDeleted: await draftsAsDeletedSetting() };
}

/** תמונת כל ההזמנות (מערך עובדות), מטמון 30 שנ' לכל מסד / יום / הגדרת טיוטות, בקשות במקביל מאוחדות. */
export async function loadOrderFacts(ctx) {
  const key = `${String(currentDbModeTag())}|${ctx.todayKey}|${ctx.draftsAsDeleted}`;
  return snapshotCache.get(key, async () => {
    const rows = await guarded(prisma.$queryRawUnsafe(ORDER_SNAPSHOT_SQL), SNAPSHOT_TIMEOUT_MS);
    return rows.map((r) => buildFact(r, ctx));
  });
}

/* ----------------------------------- חיפוש ----------------------------------- */

async function searchCondition(plan, cache, variant) {
  const search = plan.text;
  const modelLookup = planModelLookup(plan);
  const [prefixes, phoneIds, fuzzyIds] = await Promise.all([
    modelLookup
      ? memoLookup(cache, `models:${modelLookup.name}|${modelLookup.prefix}`, () => prisma.dressModel.findMany({
        where: {
          barcodePrefix: { not: null },
          OR: [
            ...(modelLookup.name ? [{ name: { contains: modelLookup.name } }] : []),
            ...(modelLookup.prefix !== null && modelLookup.prefix !== undefined ? [{ barcodePrefix: modelLookup.prefix }] : []),
          ],
        },
        select: { barcodePrefix: true },
      }))
      : [],
    planNeedsPhoneIds(plan) ? memoLookup(cache, `phone:${JSON.stringify(plan.phone)}`, () => findCustomerIdsByPhone(plan.phone)) : [],
    variant.fuzzy ? memoLookup(cache, `fuzzy:${search}`, () => findFuzzyCustomerIds(search)) : [],
  ]);
  const cond = orderSearchCondition(plan, {
    modelPrefixes: prefixes.map((m) => m.barcodePrefix).filter((p) => p !== null && p !== undefined),
    phoneIds,
    fuzzyIds,
    barcodeStage: !!variant.barcode,
    dateStage: !!variant.dateStage,
    multiNameCond: plan.nameText ? buildMultiWordRelationNameCondition(plan.nameText, 'customer', 'firstName', 'lastName') : null,
    multiRestCond: plan.kw && plan.kw.rest ? buildMultiWordRelationNameCondition(plan.kw.rest, 'customer', 'firstName', 'lastName') : null,
  });
  return { cond, partial: !!(phoneIds && phoneIds.capped) };
}

/** מזהי ההזמנות התואמות לחיפוש (Set), מטמון 60 שנ' - מספרים בלבד, בלי שורות. חיפוש רחב מדי = BudgetError. */
async function searchIds(plan, cache, variant) {
  const sc = await searchCondition(plan, cache, variant);
  const key = `${String(currentDbModeTag())}|${plan.text}|${JSON.stringify(variant)}`;
  const ids = await searchCache.get(key, async () => {
    const rows = await guarded(prisma.order.findMany({ where: sc.cond, select: { orderId: true }, take: SEARCH_IDS_CAP + 1 }));
    if (rows.length > SEARCH_IDS_CAP) throw new BudgetError('timeout', MSG_NARROWER);
    return new Set(rows.map((r) => r.orderId));
  });
  return { ids, partial: sc.partial };
}

/** החיפוש עם נסיונות חוזרים (כמו GET /api/orders) מול העובדות המסוננות (בלי החיפוש): { search: {ids}|null, variantIdx, notices }. */
async function resolveSearch(params, base, { retry }) {
  const plan = planListSearch(params.search);
  if (plan.empty) return { search: null, variantIdx: 0, notices: [] };
  const cache = new Map();
  const variants = buildRetryVariants(plan, { scopeRestricted: false });
  const partialNotice = (p) => (p ? [{ kind: 'partial', text: NOTICE_PARTIAL }] : []);
  const matchCount = (s) => { let n = 0; for (const f of base) if (s.ids.has(f.id)) n++; return n; };
  if (params.variant > 0) {
    const v = variants[params.variant - 1];
    if (v) {
      const s = await searchIds(v.text ? planListSearch(v.text) : plan, cache, v);
      return { search: s, variantIdx: params.variant, notices: [...v.notices, ...partialNotice(s.partial)] };
    }
  }
  const first = await searchIds(plan, cache, {});
  if (!retry || matchCount(first) > 0 || !shouldRetryEmptySearch(plan, { filterStatus: 'all' })) return { search: first, variantIdx: 0, notices: partialNotice(first.partial) };
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const s = await searchIds(v.text ? planListSearch(v.text) : plan, cache, v);
    if (matchCount(s) > 0) return { search: s, variantIdx: i + 1, notices: [...v.notices, ...partialNotice(s.partial)] };
  }
  return { search: first, variantIdx: 0, notices: partialNotice(first.partial) };
}

/* ----------------------------------- הרשימה ----------------------------------- */

export async function queryOrdersList(params) {
  return runLimited(async () => {
    const deadline = createDeadline();
    const ctx = await makeContext();
    const facts = await loadOrderFacts(ctx);
    deadline.check();
    const base = filterFacts(facts, params, ctx.todayKey);
    const resolved = await resolveSearch(params, base, { retry: true });
    deadline.check();
    const matched = resolved.search ? base.filter((f) => resolved.search.ids.has(f.id)) : base;
    const sorted = sortFacts(matched, params.sort, params.dir);
    const skip = (params.page - 1) * params.limit;
    const pageIds = sorted.slice(skip, skip + params.limit).map((f) => f.id);
    let rows = [];
    if (pageIds.length) {
      rows = await guarded(prisma.$queryRawUnsafe(orderRowsSql(params.export), pageIds));
      const pos = new Map(pageIds.map((id, i) => [id, i]));
      rows.sort((a, b) => pos.get(a.orderId) - pos.get(b.orderId));
    }
    return {
      data: rows.map((o) => shapeOrderRow(o, ctx, params.export)),
      total: sorted.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(sorted.length / params.limit)),
      notices: resolved.notices,
      variant: resolved.variantIdx,
    };
  });
}

/* ------------------------------- ספירת האפשרויות ------------------------------- */

export async function queryOrdersCounts(params) {
  return runLimited(async () => {
    const ctx = await makeContext();
    const [facts, branchSetting, branchList] = await Promise.all([
      loadOrderFacts(ctx),
      getCachedSetting('branches_enabled').catch(() => null),
      getCachedSetting('branch_list').catch(() => null),
    ]);
    const base = filterFacts(facts, params, ctx.todayKey);
    const resolved = await resolveSearch(params, base, { retry: false }); // variant מגיע מהרשימה; בלי variant - החיפוש כפי שהוקלד
    const branchesOn = branchSetting && branchSetting.value === 'true';
    const names = branchesOn ? String((branchList && branchList.value) || '').split(',').map((s) => s.trim()).filter(Boolean) : [];
    const out = countFacts(facts, params, ctx.todayKey, { searchIds: resolved.search ? resolved.search.ids : null, branchNames: names, draftsAsDeleted: ctx.draftsAsDeleted });
    return { ...out, branchNames: names, draftsAsDeleted: ctx.draftsAsDeleted };
  });
}

export { AGG_TTL_MS };
