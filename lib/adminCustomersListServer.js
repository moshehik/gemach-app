// lib/adminCustomersListServer.js - השאילתות של רשימת הלקוחות לניהול (נקרא רק מ-app/api/admin/customers-list/*, שמוגן להנהלה ראשית / מתכנת).
// החיפוש (שם / טלפון בכל צורת כתיבה / מייל / עיר, הצלת מקלדת, שמות דומים) הוא אותם עוזרים של /api/customers (lib/listSearch.js, lib/searchDb.js).
//
// עלות (ר' docs/a5-staff-models/customers-list-notes.md): שאילתת צבירה אחת לכל הלקוחות ("תמונה", CUSTOMER_SNAPSHOT_SQL) במטמון של 30 שניות עם איחוד בקשות
// -> סינון / מיון / ספירות / חוב / "הזמנות פעילות" נגזרים בזיכרון. בכל בקשת רשימה נשלפות מה-DB רק שורות העמוד (לפי מזהה) + (בחיפוש) מזהי הלקוחות התואמים.
// כל שאילתה עוברת דרך guarded() (SET LOCAL statement_timeout) ובקשה כבדה דרך runLimited (מגבלת מקביליות) - חריגה = 503 "צמצמו את הסינון".
// שדות רגישים (ת"ז, בנק, הערות) לא יוצאים: בתמונה רק מסכת "שדה ריק" ובשורה רק יש / אין.

import prisma from '@/app/lib/prisma';
import { currentDbModeTag } from '@/lib/dbMode';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { normalizeEmail } from '@/lib/emailUtils';
import { buildMultiWordNameCondition } from '@/lib/searchUtils';
import { requiredFieldsFromSettings } from '@/lib/customerRequiredFields';
import {
  planListSearch, planNeedsPhoneIds, customerSearchCondition, buildRetryVariants, shouldRetryEmptySearch, memoLookup, NOTICE_PARTIAL,
} from '@/lib/listSearch';
import { findCustomerIdsByPhone, findFuzzyCustomerIds } from '@/lib/searchDb';
import {
  CUSTOMER_SNAPSHOT_SQL, buildCustomerFact, countCustomerFacts, filterCustomerFacts, requiredMaskOf, sortCustomerFacts,
} from '@/lib/adminCustomersList';
import { guarded, runLimited } from '@/lib/adminListDb';
import { BudgetError, COUNTS_TTL_MS, MSG_NARROWER, createDeadline, createTtlCache } from '@/lib/adminListGuards';

const SNAPSHOT_TTL_MS = 30 * 1000; // התמונה משקפת שינויים עד 30 שניות אחורה (הספירות, הסדר והעימוד; שורות העמוד עצמן תמיד טריות)
const SNAPSHOT_TIMEOUT_MS = 12000;
const SEARCH_IDS_CAP = 20000;

const snapshotCache = createTtlCache({ ttl: SNAPSHOT_TTL_MS, max: 4 });
const searchCache = createTtlCache({ ttl: COUNTS_TTL_MS, max: 200 });

/** תמונת כל הלקוחות (מערך עובדות), מטמון 30 שנ' לכל מסד, בקשות במקביל מאוחדות. */
export async function loadCustomerFacts() {
  const key = String(currentDbModeTag());
  return snapshotCache.get(key, async () => {
    const rows = await guarded(prisma.$queryRawUnsafe(CUSTOMER_SNAPSHOT_SQL), SNAPSHOT_TIMEOUT_MS);
    return rows.map(buildCustomerFact);
  });
}

async function makeContext() {
  const [facts, settings] = await Promise.all([loadCustomerFacts(), getAllCachedSettings().catch(() => [])]);
  return { todayKey: getIsraelTodayKey(), facts, requiredMask: requiredMaskOf(requiredFieldsFromSettings(settings)) };
}

async function searchCondition(plan, cache, variant) {
  const search = plan.text;
  const [phoneIds, fuzzyIds] = await Promise.all([
    planNeedsPhoneIds(plan) ? memoLookup(cache, `phone:${JSON.stringify(plan.phone)}`, () => findCustomerIdsByPhone(plan.phone)) : [],
    variant.fuzzy ? memoLookup(cache, `fuzzy:${search}`, () => findFuzzyCustomerIds(search)) : [],
  ]);
  return {
    cond: customerSearchCondition(plan, { multiNameCond: search ? buildMultiWordNameCondition(search, 'firstName', 'lastName') : null, phoneIds, fuzzyIds }),
    partial: !!(phoneIds && phoneIds.capped),
  };
}

/** מזהי הלקוחות התואמים לחיפוש (Set), מטמון 60 שנ' - מזהים בלבד. חיפוש רחב מדי = BudgetError. */
async function searchIds(plan, cache, variant) {
  const sc = await searchCondition(plan, cache, variant);
  const key = `${String(currentDbModeTag())}|${plan.text}|${JSON.stringify(variant)}`;
  const ids = await searchCache.get(key, async () => {
    const rows = await guarded(prisma.customer.findMany({ where: { AND: [{ isDeleted: false }, sc.cond] }, select: { id: true }, take: SEARCH_IDS_CAP + 1 }));
    if (rows.length > SEARCH_IDS_CAP) throw new BudgetError('timeout', MSG_NARROWER);
    return new Set(rows.map((r) => r.id));
  });
  return { ids, partial: sc.partial };
}

async function resolveSearch(params, base, { retry }) {
  const plan = planListSearch(params.search);
  if (plan.empty) return { search: null, variantIdx: 0, notices: [] };
  const cache = new Map();
  const variants = buildRetryVariants(plan, { scopeRestricted: false, barcode: false, dateStage: false });
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
  if (!retry || matchCount(first) > 0 || !shouldRetryEmptySearch(plan)) return { search: first, variantIdx: 0, notices: partialNotice(first.partial) };
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const s = await searchIds(v.text ? planListSearch(v.text) : plan, cache, v);
    if (matchCount(s) > 0) return { search: s, variantIdx: i + 1, notices: [...v.notices, ...partialNotice(s.partial)] };
  }
  return { search: first, variantIdx: 0, notices: partialNotice(first.partial) };
}

const SELECT = {
  id: true, firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true, email: true, emailSuffix: true,
  isBlocked: true, blockedReason: true, hasSignedRegulations: true, marketingConsent: true,
  zeout: true, // רק כדי לחשב "יש / אין" (hasId) - הערך עצמו לא נשלח
};

function shape(c, f) {
  const email = normalizeEmail(c.email, c.emailSuffix) || '';
  const address = [[c.street, c.houseNum].filter((x) => x !== null && x !== undefined && String(x).trim() !== '').join(' '), c.city].filter((x) => x && String(x).trim()).join(', ');
  return {
    id: c.id, // לניווט בלבד (/customers/<id>) - לא מוצג
    number: f && f.num ? f.num : null,
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    phone: c.phone1 || c.phone2 || '',
    email,
    city: c.city || '',
    address,
    blocked: !!c.isBlocked,
    blockedReason: c.isBlocked ? (c.blockedReason || '') : '',
    signed: !!c.hasSignedRegulations,
    marketing: !!c.marketingConsent,
    hasId: !!(c.zeout && String(c.zeout).trim()), // רק יש / אין - הערך עצמו לא נשלח
    orders: f ? f.orders : 0,
    activeOrders: f ? f.active : 0,
    debt: f ? f.debt : 0,
    lastOrder: f && f.last ? new Date(f.last * 1000).toISOString() : null,
  };
}

export async function queryCustomersList(params) {
  return runLimited(async () => {
    const deadline = createDeadline();
    const ctx = await makeContext();
    deadline.check();
    const base = filterCustomerFacts(ctx.facts, params, ctx);
    const resolved = await resolveSearch(params, base, { retry: true });
    deadline.check();
    const matched = resolved.search ? base.filter((f) => resolved.search.ids.has(f.id)) : base;
    const sorted = sortCustomerFacts(matched, params.sort, params.dir);
    const skip = (params.page - 1) * params.limit;
    const page = sorted.slice(skip, skip + params.limit);
    let rows = [];
    if (page.length) {
      rows = await guarded(prisma.customer.findMany({ where: { id: { in: page.map((f) => f.id) } }, select: SELECT }));
    }
    const byId = new Map(rows.map((c) => [c.id, c]));
    return {
      data: page.map((f) => byId.get(f.id)).filter(Boolean).map((c, i) => shape(c, page.find((f) => f.id === c.id) || page[i])),
      total: sorted.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(sorted.length / params.limit)),
      notices: resolved.notices,
      variant: resolved.variantIdx,
    };
  });
}

export async function queryCustomersCounts(params) {
  return runLimited(async () => {
    const ctx = await makeContext();
    const base = filterCustomerFacts(ctx.facts, params, ctx);
    const resolved = await resolveSearch(params, base, { retry: false });
    return countCustomerFacts(ctx.facts, params, ctx, { searchIds: resolved.search ? resolved.search.ids : null });
  });
}
