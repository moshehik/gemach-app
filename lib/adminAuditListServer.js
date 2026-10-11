// lib/adminAuditListServer.js - השאילתות של "היסטוריית נתונים" (נקרא רק מ-app/api/admin/data-history/*, שמוגן להנהלה ראשית / מתכנת).
// הלוגיקה הטהורה (פרמטרים, WHERE, שינויים, שמות ישויות) ב-lib/adminAuditList.js.
//
// עלות (ר' docs/a5-staff-models/data-history-notes.md): טבלת AuditLog גדלה בלי גבול והאינדקסים הקיימים הם (entityType, entityId) ו-(employeeId) בלבד -
// אין אינדקס על createdAt, ואסור DDL. לכן:
//  * כל שאילתה בטרנזקציה עם SET LOCAL statement_timeout (guarded) ובקשה כבדה תחת מגבלת מקביליות (runLimited) - חריגה = 503 "צמצמו את הסינון";
//  * אין COUNT(*) מלא: סך חסום (עד COUNT_CAP שורות תואמות נסרקות) ומטמון 30 שניות לכל צירוף סינון (דפדוף לא סופר מחדש);
//  * עמוד = שאילתה אחת (LIMIT/OFFSET) + שליפות מזהה-ראשי קטנות לשמות (עובדים וישויות) - לא יותר מ-100 שורות;
//  * changesJson ענק (שיחת AI / גוף מייל) לא נשלף מעבר ל-60KB - השורה מסומנת "גדולה".
import prisma from '@/app/lib/prisma';
import { currentDbModeTag } from '@/lib/dbMode';
import { getIsraelDayRange, getIsraelTodayKey } from '@/lib/hebrewDate';
import { attachEmployeeNames } from '@/app/lib/auditLog';
import { guarded, runLimited } from '@/lib/adminListDb';
import { COUNTS_TTL_MS, createDeadline, createTtlCache } from '@/lib/adminListGuards';
import { COUNT_CAP, cappedTotal, logCountsKey, resolvePeriod } from '@/lib/adminLogList';
import {
  ACTION_GROUP_KEYS, actionGroupCase, auditOrderBy, buildAuditWhere, buildChangeList, entityIdsByType, nameFromChanges, parseAuditListParams, shapeEntity,
} from '@/lib/adminAuditList';

const BIG_CHANGES = 60000; // changesJson מעל זה לא נשלף
const DETAIL_FIELDS = 40; // שדות לשורה בתשובת רשימה
const EXPORT_FIELDS = 6; // שדות לשורה בבקשת ייצוא (רק לסיכום של שורה)
const NAMED_EMPLOYEES = 30; // כמה עובדים מופיעים בקבוצת הסינון (הפעילים ביותר)
const countCache = createTtlCache({ ttl: 30 * 1000, max: 60 });
const optionsCache = createTtlCache({ ttl: COUNTS_TTL_MS, max: 60 });

function ctxFor(viewer, searchEntityIds = []) {
  return { isHead: !!viewer.isHead, todayKey: getIsraelTodayKey(), dayRange: getIsraelDayRange, searchEntityIds };
}

/** חיפוש מספרי = מספר הזמנה: מוסיף גם את מזהה השורה הפנימי של ההזמנה (שורות היומן האוטומטיות שומרות UUID ולא מספר). שאילתת מפתח ראשי אחת. */
async function searchEntityIds(search) {
  if (!/^\d{1,9}$/.test(search)) return [];
  const o = await guarded(prisma.order.findUnique({ where: { orderId: parseInt(search, 10) }, select: { id: true } }));
  return o ? [o.id] : [];
}

/* --------------------------------- שמות ישויות --------------------------------- */

const NUM_RE = /^\d+$/;
async function loadEntities(rows) {
  const by = entityIdsByType(rows);
  const out = new Map(); // `${type}:${id}` -> found
  const put = (type, list, key = (x) => x.id) => list.forEach((f) => out.set(`${type}:${key(f)}`, f));
  const ids = (t) => [...(by[t] || [])];
  const jobs = [];
  if (by.Order) {
    const all = ids('Order');
    const uuids = all.filter((x) => !NUM_RE.test(x));
    const nums = all.filter((x) => NUM_RE.test(x));
    nums.forEach((n) => out.set(`Order:${n}`, { orderId: parseInt(n, 10), customer: null }));
    if (uuids.length) jobs.push(prisma.order.findMany({ where: { id: { in: uuids } }, select: { id: true, orderId: true, customer: { select: { firstName: true, lastName: true } } } }).then((l) => put('Order', l)));
  }
  for (const t of ['OrderItem', 'Payment', 'PaymentObligation']) {
    const list = ids(t);
    if (list.length) jobs.push(prisma[t.charAt(0).toLowerCase() + t.slice(1)].findMany({ where: { id: { in: list } }, select: { id: true, orderId: true } }).then((l) => put(t, l)));
  }
  if (by.Customer) jobs.push(prisma.customer.findMany({ where: { id: { in: ids('Customer') } }, select: { id: true, legacyId: true, firstName: true, lastName: true } }).then((l) => put('Customer', l)));
  if (by.DressModel) jobs.push(prisma.dressModel.findMany({ where: { id: { in: ids('DressModel') } }, select: { id: true, name: true } }).then((l) => put('DressModel', l)));
  if (by.DressItem) jobs.push(prisma.dressItem.findMany({ where: { id: { in: ids('DressItem') } }, select: { id: true, sizeText: true, dressModelId: true, dressModel: { select: { name: true } } } }).then((l) => put('DressItem', l)));
  if (by.Employee) jobs.push(prisma.employee.findMany({ where: { id: { in: ids('Employee') } }, select: { id: true, fullName: true, firstName: true, lastName: true } }).then((l) => put('Employee', l)));
  if (by.ErrorReport) ids('ErrorReport').forEach((id) => out.set(`ErrorReport:${id}`, { id }));
  // שגיאה בשליפת שם אחת לא מפילה את הרשימה: השורה פשוט מוצגת בלי מספר / שם
  await Promise.all(jobs.map((j) => j.catch(() => null)));
  return out;
}

/* ----------------------------------- רשימה ----------------------------------- */

const SELECT_ROWS = `SELECT a.id, a."entityType", a."entityId", a."action", a."createdAt", a."employeeId",
  CASE WHEN length(a."changesJson") > ${BIG_CHANGES} THEN NULL ELSE a."changesJson" END AS "changesJson", length(a."changesJson")::int AS size`;

/** viewer = { isHead }. מחזיר { data, total, totalCapped, notices }. */
export async function queryAuditList(input, viewer) {
  const params = parseAuditListParams(input);
  return runLimited(async () => {
    const deadline = createDeadline();
    const ctx = ctxFor(viewer, await searchEntityIds(params.search));
    deadline.check();
    const w = buildAuditWhere(params, ctx);
    if (w.empty) return { data: [], total: 0, totalCapped: false, notices: [] };
    const ob = auditOrderBy(params.sort, params.dir);
    const offset = (params.page - 1) * params.limit;
    const lim = `LIMIT ${params.limit} OFFSET ${offset}`;
    const sql = `${SELECT_ROWS} FROM "AuditLog" a ${ob.join ? 'LEFT JOIN "Employee" e ON e.id = a."employeeId"' : ''} ${w.where} ORDER BY ${ob.sql} ${lim}`;
    const countKey = `${String(currentDbModeTag())}|${viewer.isHead ? 1 : 0}|${logCountsKey(params)}|${JSON.stringify(ctx.searchEntityIds)}`;
    const countSql = `SELECT count(*)::int AS c FROM (SELECT 1 FROM "AuditLog" a ${w.where} LIMIT ${COUNT_CAP + 1}) s`;
    const [rawRows, scanned] = await Promise.all([
      guarded(prisma.$queryRawUnsafe(sql, ...w.args)),
      countCache.get(countKey, async () => {
        const r = await guarded(prisma.$queryRawUnsafe(countSql, ...w.args));
        return Number(r[0] && r[0].c) || 0;
      }),
    ]);
    deadline.check();
    const named = await attachEmployeeNames(rawRows.map((r) => ({ ...r, changesJson: r.changesJson })));
    const entities = await loadEntities(rawRows);
    const maxFields = params.export ? EXPORT_FIELDS : DETAIL_FIELDS;
    const data = named.map((r) => {
      const big = r.changesJson == null && r.size > BIG_CHANGES;
      const { list, n } = big ? { list: [], n: 0 } : buildChangeList(r.changesJson, { canSeeWages: !!viewer.isHead, limit: maxFields });
      const found = entities.get(`${r.entityType}:${r.entityId}`);
      const entity = shapeEntity(r.entityType, found);
      if (!entity.name && !entity.ref && !found) {
        const nm = nameFromChanges(r.entityType, r.changesJson);
        if (nm) entity.name = nm;
      }
      return {
        id: r.id,
        t: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        type: r.entityType,
        action: r.action,
        who: r.employeeId ? (r.employeeName || 'עובד שנמחק') : '',
        system: !r.employeeId,
        entity,
        changes: list,
        n,
        big,
      };
    });
    const { total, capped } = cappedTotal(scanned);
    return { data, total, totalCapped: capped, notices: [] };
  });
}

/* ----------------------------------- ספירות ----------------------------------- */

/** ספירות האפשרויות של חלון הסינון (קבוצה = כל השאר + החיפוש). כל ספירה חסומה ל-COUNT_CAP שורות; capped=true => הלקוח לא מסתיר אפשרויות. */
export async function queryAuditCounts(input, viewer) {
  const params = parseAuditListParams(input);
  const key = `${String(currentDbModeTag())}|${viewer.isHead ? 1 : 0}|${logCountsKey(params)}`;
  return optionsCache.get(key, () => runLimited(async () => {
    const ctx = ctxFor(viewer, await searchEntityIds(params.search));
    const sample = (w) => `FROM (SELECT a."entityType", a."action", a."employeeId", a."createdAt" FROM "AuditLog" a ${w.where} LIMIT ${COUNT_CAP + 1}) a`;
    const ctxCap = (rows) => rows.reduce((n, r) => n + Number(r.c || 0), 0) > COUNT_CAP;
    let capped = false;

    const wT = buildAuditWhere(params, ctx, 'types');
    const wA = buildAuditWhere(params, ctx, 'actions');
    const wE = buildAuditWhere(params, ctx, 'employees');
    const wP = buildAuditWhere(params, ctx, 'period');
    if (wT.empty) return { types: {}, actions: {}, employees: {}, employeeNames: {}, period: {}, capped: false };

    const types = await guarded(prisma.$queryRawUnsafe(`SELECT a."entityType" AS k, count(*)::int AS c ${sample(wT)} GROUP BY 1 ORDER BY 2 DESC`, ...wT.args));
    capped = capped || ctxCap(types);
    const actions = await guarded(prisma.$queryRawUnsafe(`SELECT ${actionGroupCase('a."action"')} AS k, count(*)::int AS c ${sample(wA)} GROUP BY 1`, ...wA.args));
    capped = capped || ctxCap(actions);
    const emps = await guarded(prisma.$queryRawUnsafe(`SELECT COALESCE(a."employeeId", 'system') AS k, count(*)::int AS c ${sample(wE)} GROUP BY 1 ORDER BY 2 DESC LIMIT ${NAMED_EMPLOYEES + 1}`, ...wE.args));
    const bounds = periodCounts(ctx);
    const pa = wP.args.slice();
    const pe = bounds.map((b) => { pa.push(b.gte); return `count(*) FILTER (WHERE a."createdAt" >= $${pa.length})::int AS "${b.k}"`; });
    const periodRow = (await guarded(prisma.$queryRawUnsafe(`SELECT ${pe.join(', ')} ${sample(wP)}`, ...pa)))[0] || {};

    const empIds = emps.map((e) => e.k).filter((k) => k !== 'system');
    const names = empIds.length ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullName: true, firstName: true, lastName: true } }) : [];
    const employeeNames = {};
    names.forEach((n) => { employeeNames[n.id] = n.fullName || [n.firstName, n.lastName].filter(Boolean).join(' ') || ''; });
    const employees = {};
    emps.slice(0, NAMED_EMPLOYEES).forEach((e) => { if (e.k === 'system' || employeeNames[e.k]) employees[e.k] = e.c; });
    const out = { types: {}, actions: {}, employees, employeeNames, period: {}, capped };
    types.forEach((t) => { out.types[t.k] = t.c; });
    ACTION_GROUP_KEYS.forEach((k) => { out.actions[k] = 0; });
    actions.forEach((t) => { out.actions[t.k] = t.c; });
    bounds.forEach((b) => { out.period[b.k] = Number(periodRow[b.k]) || 0; });
    return out;
  }));
}

function periodCounts(ctx) {
  return ['today', 'd7', 'd30', 'year'].map((k) => {
    const r = resolvePeriod(k, ctx.todayKey);
    return { k, gte: ctx.dayRange(r.from).start };
  });
}
