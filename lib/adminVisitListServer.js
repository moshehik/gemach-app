// lib/adminVisitListServer.js - השאילתות של "היסטוריית שאילתות ו-API" (נקרא רק מ-app/api/admin/management-history/*, שמוגן להנהלה ראשית / מתכנת).
// הלוגיקה הטהורה (פרמטרים, WHERE, מיונים, שמות מסכים) ב-lib/adminVisitList.js.
//
// עלות (ר' docs/a5-staff-models/management-history-notes.md): PageVisitLog גדלה בכל ביקור / קריאת API. יש אינדקס על timestamp ועל employeeId (חיפוש / סינון סוג הם סריקה).
//  * כל שאילתה בטרנזקציה עם SET LOCAL statement_timeout (guarded), בקשה כבדה תחת מגבלת מקביליות (runLimited) - חריגה = 503 "צמצמו את הסינון";
//  * אין COUNT(*) מלא ואין COUNT של כל הטבלה: סך חסום (COUNT_CAP) עם מטמון 30 שניות, והסך הכללי להתראה "יותר מ-10,000" הוא אומדן סטטיסטי של Postgres (pg_class.reltuples);
//  * עמוד = שאילתה אחת (LIMIT/OFFSET, עד 100 שורות; גוף הבקשה נחתך ל-6,000 תווים לפני העיבוד).
import prisma from '@/app/lib/prisma';
import { currentDbModeTag } from '@/lib/dbMode';
import { getIsraelDayRange, getIsraelTodayKey } from '@/lib/hebrewDate';
import { guarded, runLimited } from '@/lib/adminListDb';
import { COUNTS_TTL_MS, createDeadline, createTtlCache } from '@/lib/adminListGuards';
import { COUNT_CAP, cappedTotal, logCountsKey, resolvePeriod } from '@/lib/adminLogList';
import { redactRequestQuery, redactUrl } from '@/lib/redactSensitive';
import { LARGE_LOG_WARNING, buildVisitWhere, isApiPath, parseVisitListParams, screenName, visitOrderBy, IS_ERROR_SQL } from '@/lib/adminVisitList';

const NAMED_EMPLOYEES = 30;
const countCache = createTtlCache({ ttl: 30 * 1000, max: 60 });
const optionsCache = createTtlCache({ ttl: COUNTS_TTL_MS, max: 60 });
const overallCache = createTtlCache({ ttl: 5 * 60 * 1000, max: 2 });

const ctxNow = () => ({ todayKey: getIsraelTodayKey(), dayRange: getIsraelDayRange });

/** אומדן מספר השורות בטבלה (סטטיסטיקת Postgres, לא COUNT). -1 = לא ידוע (טבלה שלא נותחה). */
async function estimatedTotal() {
  return overallCache.get(String(currentDbModeTag()), async () => {
    const r = await guarded(prisma.$queryRawUnsafe(`SELECT reltuples::bigint AS n FROM pg_class WHERE oid = '"PageVisitLog"'::regclass`));
    return Number(r[0] && r[0].n);
  });
}

const SELECT_ROWS = `SELECT v.id, left(v."pageUrl", 600) AS "pageUrl", v."employeeId", v."employeeName", v."isGuest", v."timestamp", v."loadingError", v."responseSize", v."executionTime", left(v."requestQuery", 6000) AS "requestQuery"`;

export async function queryVisitList(input) {
  const params = parseVisitListParams(input);
  return runLimited(async () => {
    const deadline = createDeadline();
    const ctx = ctxNow();
    const w = buildVisitWhere(params, ctx);
    const offset = (params.page - 1) * params.limit;
    const sql = `${SELECT_ROWS} FROM "PageVisitLog" v ${w.where} ORDER BY ${visitOrderBy(params.sort, params.dir)} LIMIT ${params.limit} OFFSET ${offset}`;
    const countKey = `${String(currentDbModeTag())}|${logCountsKey(params)}`;
    const countSql = `SELECT count(*)::int AS c FROM (SELECT 1 FROM "PageVisitLog" v ${w.where} LIMIT ${COUNT_CAP + 1}) s`;
    const [rows, scanned, overall] = await Promise.all([
      guarded(prisma.$queryRawUnsafe(sql, ...w.args)),
      countCache.get(countKey, async () => {
        const r = await guarded(prisma.$queryRawUnsafe(countSql, ...w.args));
        return Number(r[0] && r[0].c) || 0;
      }),
      params.page === 1 && !params.export ? estimatedTotal().catch(() => -1) : Promise.resolve(-1),
    ]);
    deadline.check();
    const data = rows.map((r) => {
      const path = redactUrl(r.pageUrl) || '';
      return {
        id: r.id,
        t: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
        path,
        api: isApiPath(path),
        screen: screenName(path),
        who: r.employeeName || '',
        guest: !!r.isGuest,
        size: r.responseSize == null ? null : Number(r.responseSize),
        ms: r.executionTime == null ? null : Number(r.executionTime),
        error: r.loadingError || '',
        query: params.export ? '' : (redactRequestQuery(r.requestQuery, r.pageUrl) || ''),
      };
    });
    const notices = overall > LARGE_LOG_WARNING
      ? [{ kind: 'large-log', text: `ישנן כ-${overall.toLocaleString('he-IL')} רשומות בהיסטוריה. מומלץ למחוק רשומות ישנות כדי לשמור על ביצועי המערכת.` }]
      : [];
    const { total, capped } = cappedTotal(scanned);
    return { data, total, totalCapped: capped, notices, overall: overall >= 0 ? overall : null };
  });
}

export async function queryVisitCounts(input) {
  const params = parseVisitListParams(input);
  const key = `${String(currentDbModeTag())}|${logCountsKey(params)}`;
  return optionsCache.get(key, () => runLimited(async () => {
    const ctx = ctxNow();
    const sample = (w, cols) => `FROM (SELECT ${cols} FROM "PageVisitLog" v ${w.where} LIMIT ${COUNT_CAP + 1}) v`;
    const wTy = buildVisitWhere(params, ctx, 'types');
    const wSt = buildVisitWhere(params, ctx, 'status');
    const wEm = buildVisitWhere(params, ctx, 'employees');
    const wPe = buildVisitWhere(params, ctx, 'period');
    let capped = false;
    const over = (rows) => rows.reduce((n, r) => n + Number(r.c || 0), 0) > COUNT_CAP;

    const types = await guarded(prisma.$queryRawUnsafe(`SELECT CASE WHEN v."pageUrl" LIKE '%/api/%' THEN 'api' ELSE 'pages' END AS k, count(*)::int AS c ${sample(wTy, 'v."pageUrl"')} GROUP BY 1`, ...wTy.args));
    capped = capped || over(types);
    const status = await guarded(prisma.$queryRawUnsafe(`SELECT CASE WHEN ${IS_ERROR_SQL} THEN 'error' ELSE 'ok' END AS k, count(*)::int AS c ${sample(wSt, 'v."loadingError"')} GROUP BY 1`, ...wSt.args));
    capped = capped || over(status);
    const emps = await guarded(prisma.$queryRawUnsafe(
      `SELECT k, max(n) AS n, count(*)::int AS c FROM (SELECT CASE WHEN v."isGuest" THEN 'guest' ELSE v."employeeId" END AS k, v."employeeName" AS n FROM "PageVisitLog" v ${wEm.where} LIMIT ${COUNT_CAP + 1}) s WHERE k IS NOT NULL GROUP BY k ORDER BY c DESC LIMIT ${NAMED_EMPLOYEES}`,
      ...wEm.args));
    const bounds = ['today', 'd7', 'd30', 'year'].map((k) => ({ k, gte: ctx.dayRange(resolvePeriod(k, ctx.todayKey).from).start }));
    const pa = wPe.args.slice();
    const pe = bounds.map((b) => { pa.push(b.gte); return `count(*) FILTER (WHERE v."timestamp" >= $${pa.length})::int AS "${b.k}"`; });
    const periodRow = (await guarded(prisma.$queryRawUnsafe(`SELECT ${pe.join(', ')} ${sample(wPe, 'v."timestamp"')}`, ...pa)))[0] || {};

    const out = { types: { api: 0, pages: 0 }, status: { error: 0, ok: 0 }, employees: {}, employeeNames: {}, period: {}, capped };
    types.forEach((r) => { out.types[r.k] = r.c; });
    status.forEach((r) => { out.status[r.k] = r.c; });
    emps.forEach((r) => { out.employees[r.k] = r.c; out.employeeNames[r.k] = r.k === 'guest' ? 'אורחים' : (r.n || ''); });
    Object.keys(out.employeeNames).forEach((k) => { if (!out.employeeNames[k]) { delete out.employeeNames[k]; delete out.employees[k]; } });
    bounds.forEach((b) => { out.period[b.k] = Number(periodRow[b.k]) || 0; });
    return out;
  }));
}
