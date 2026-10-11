// history-lists-profile.mjs - מדידת העלות של שתי רשימות היומנים (היסטוריית נתונים / היסטוריית שאילתות ו-API) מול TEST בלבד, קריאה בלבד (+ טבלה זמנית בסשן אחד לבדיקת קנה מידה).
// הרצה:  node --import ./scripts/perf/register.mjs scripts/perf/history-lists-profile.mjs [--explain] [--scale=400000]
// לכל תרחיש: זמן קיר ומספר שאילתות (כולל RTT לרשת ~0.8 שנ' לשאילתה מהמחשב המקומי מול Neon - ההשוואה האמיתית היא מספר השאילתות וזמן הביצוע בשרת ה-DB),
// ובמצב --explain: EXPLAIN (ANALYZE, BUFFERS) לשאילתת הרשימה והספירה. --scale=N: יוצר טבלה זמנית (pg_temp, נעלמת עם הטרנזקציה - לא נוגע בסכמה אמיתית)
// בגודל N שורות עם אותם אינדקסים כמו AuditLog ומודד את אותן שאילתות, כדי לראות מה קורה כשהיומן גדל פי כמה.
import prisma from './stub-prisma.mjs';
import { getIsraelDayRange, getIsraelTodayKey } from '../../lib/hebrewDate.js';
import { queryAuditList, queryAuditCounts } from '../../lib/adminAuditListServer.js';
import { queryVisitList, queryVisitCounts } from '../../lib/adminVisitListServer.js';
import { buildAuditWhere, auditOrderBy, parseAuditListParams } from '../../lib/adminAuditList.js';
import { buildVisitWhere, parseVisitListParams, visitOrderBy } from '../../lib/adminVisitList.js';
import { COUNT_CAP } from '../../lib/adminLogList.js';

const explain = process.argv.includes('--explain');
const scaleArg = (process.argv.find((a) => a.startsWith('--scale=')) || '').slice(8);
const viewer = { isHead: true };
const ctx = { isHead: true, todayKey: getIsraelTodayKey(), dayRange: getIsraelDayRange };

const AUD = [
  ['audit: default list', {}],
  ['audit: type Order', { types: 'Order' }],
  ['audit: action update', { actions: 'update' }],
  ['audit: employee', { employees: 'system' }],
  ['audit: period d7', { period: 'd7' }],
  ['audit: search phone text', { search: '050' }],
  ['audit: search order no', { search: '28315' }],
  ['audit: sort employee', { sort: 'employee', dir: 'asc' }],
  ['audit: sort size desc', { sort: 'size' }],
  ['audit: page 30', { page: 30 }],
  ['audit: export page (500)', { limit: 500, export: '1' }],
];
const VIS = [
  ['visits: default (api)', { types: 'api' }],
  ['visits: pages', { types: 'pages' }],
  ['visits: errors', { status: 'error' }],
  ['visits: guest', { employees: 'guest' }],
  ['visits: period d7', { period: 'd7' }],
  ['visits: search path', { search: 'orders' }],
  ['visits: sort size', { sort: 'size' }],
  ['visits: sort employee', { sort: 'employee', dir: 'asc' }],
  ['visits: page 100', { page: 100 }],
];

async function run(name, fn) {
  globalThis.__queries.length = 0;
  const t0 = Date.now();
  let res; let err = '';
  try { res = await fn(); } catch (e) { err = String(e.message).slice(0, 120); }
  const wall = Date.now() - t0;
  const qs = globalThis.__queries.filter((q) => !/^(BEGIN|COMMIT|SET LOCAL)/i.test(q.sql));
  console.log(`${name.padEnd(30)} wall ${String(wall).padStart(5)} ms | stmts ${String(qs.length).padStart(2)} (+${globalThis.__queries.length - qs.length} tx) | rows ${res && res.data ? res.data.length : '-'} total ${res && res.total !== undefined ? res.total : '-'}${err ? ` ERR ${err}` : ''}`);
}

async function explainOf(label, sql, args) {
  const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`, ...args);
  const lines = rows.map((r) => r['QUERY PLAN']);
  const main = lines.filter((l) => /Scan|Sort|Limit|Aggregate|Execution Time|Planning Time/.test(l)).map((l) => l.trim()).slice(0, 7);
  console.log(`  EXPLAIN ${label}\n    ${main.join('\n    ')}`);
}

console.log('== היסטוריית נתונים (AuditLog) - הבקשה האמיתית של השרת');
for (const [n, p] of AUD) await run(n, () => queryAuditList(p, viewer));
// (counts in --scale only)
await run('audit: COUNTS default', () => queryAuditCounts({}, viewer));
await run('audit: COUNTS type Order', () => queryAuditCounts({ types: 'Order' }, viewer));
console.log('== היסטוריית שאילתות (PageVisitLog)');
for (const [n, p] of VIS) await run(n, () => queryVisitList(p));
await run('visits: COUNTS default', () => queryVisitCounts({}));

if (explain) {
  console.log('== EXPLAIN (ANALYZE) - AuditLog');
  for (const [n, p] of [AUD[0], AUD[1], AUD[2], AUD[4], AUD[5], AUD[7]]) {
    const params = parseAuditListParams(p);
    const w = buildAuditWhere(params, ctx); const ob = auditOrderBy(params.sort, params.dir);
    await explainOf(`${n} (list)`, `SELECT a.id, a."entityType", a."entityId", a."action", a."createdAt", length(a."changesJson") FROM "AuditLog" a ${ob.join ? 'LEFT JOIN "Employee" e ON e.id = a."employeeId"' : ''} ${w.where} ORDER BY ${ob.sql} LIMIT 50 OFFSET 0`, w.args);
    await explainOf(`${n} (count, cap ${COUNT_CAP})`, `SELECT count(*) FROM (SELECT 1 FROM "AuditLog" a ${w.where} LIMIT ${COUNT_CAP + 1}) s`, w.args);
  }
  console.log('== EXPLAIN (ANALYZE) - PageVisitLog');
  for (const [n, p] of [VIS[0], VIS[2], VIS[4], VIS[5], VIS[6]]) {
    const params = parseVisitListParams(p);
    const w = buildVisitWhere(params, ctx);
    await explainOf(`${n} (list)`, `SELECT v.id, v."pageUrl", v."timestamp" FROM "PageVisitLog" v ${w.where} ORDER BY ${visitOrderBy(params.sort, params.dir)} LIMIT 50 OFFSET 0`, w.args);
    await explainOf(`${n} (count, cap ${COUNT_CAP})`, `SELECT count(*) FROM (SELECT 1 FROM "PageVisitLog" v ${w.where} LIMIT ${COUNT_CAP + 1}) s`, w.args);
  }
}

if (scaleArg) {
  const N = parseInt(scaleArg, 10);
  console.log(`== קנה מידה: טבלה זמנית של ${N.toLocaleString()} שורות (אותם אינדקסים כמו AuditLog; נעלמת בסוף הטרנזקציה)`);
  const T = 'pg_temp.aud_scale';
  const out = [];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 0');
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE aud_scale (LIKE "AuditLog" INCLUDING DEFAULTS) ON COMMIT DROP`);
      await tx.$executeRawUnsafe(`CREATE INDEX aud_scale_et ON aud_scale ("entityType", "entityId")`);
      await tx.$executeRawUnsafe(`CREATE INDEX aud_scale_emp ON aud_scale ("employeeId")`);
      await tx.$executeRawUnsafe(`INSERT INTO aud_scale (id, "entityType", "entityId", action, "changesJson", "createdAt", "employeeId", "updatedAt")
        SELECT gen_random_uuid()::text, (ARRAY['Order','OrderItem','Payment','PaymentObligation','Customer','DressItem','DressModel','Employee'])[1 + (i % 8)], md5(i::text),
          (ARRAY['UPDATE','UPDATE','UPDATE','CREATE','DELETE','CONFIRM_RENTAL','CANCEL_ITEM'])[1 + (i % 7)],
          '{"phone1":{"from":"05012' || (i % 100000) || '","to":"05298' || (i % 99991) || '"},"city":{"from":"ירושלים","to":"בני ברק"},"notes":"' || repeat('x', 60) || '"}',
          now() - (i % 900) * interval '1 day' - (i % 86400) * interval '1 second', CASE WHEN i % 5 = 0 THEN NULL ELSE md5((i % 40)::text) END, now()
        FROM generate_series(1, ${N}) i`);
      await tx.$executeRawUnsafe('ANALYZE aud_scale');
      const sw = (s) => s.replace(/"AuditLog" a/g, `${T} a`);
      const cases = [
        ['default (no filter)', {}], ['type Order', { types: 'Order' }], ['action update', { actions: 'update' }], ['employee system', { employees: 'system' }],
        ['period d30', { period: 'd30' }], ['search text', { search: '05012345' }], ['sort employee', { sort: 'employee', dir: 'asc' }], ['sort size', { sort: 'size' }],
      ];
      for (const [label, p] of cases) {
        const params = parseAuditListParams(p);
        const w = buildAuditWhere(params, ctx); const ob = auditOrderBy(params.sort, params.dir);
        const listSql = sw(`SELECT a.id, a."entityType", a."entityId", a."action", a."createdAt", length(a."changesJson") FROM "AuditLog" a ${ob.join ? 'LEFT JOIN "Employee" e ON e.id = a."employeeId"' : ''} ${w.where} ORDER BY ${ob.sql} LIMIT 50 OFFSET 0`);
        const cntSql = sw(`SELECT count(*) FROM (SELECT 1 FROM "AuditLog" a ${w.where} LIMIT ${COUNT_CAP + 1}) s`);
        const grpSql = sw(`SELECT a."entityType" k, count(*) FROM (SELECT a."entityType", a."action", a."employeeId", a."createdAt" FROM "AuditLog" a ${w.where} LIMIT ${COUNT_CAP + 1}) a GROUP BY 1`);
        const time = async (sql) => {
          const r = await tx.$queryRawUnsafe(`EXPLAIN (ANALYZE, FORMAT TEXT) ${sql}`, ...w.args);
          const l = r.map((x) => x['QUERY PLAN']);
          const ex = l.find((x) => /Execution Time/.test(x)) || '';
          const scan = (l.find((x) => /(Seq Scan|Index Scan|Index Only Scan|Bitmap Heap Scan)/.test(x)) || '').trim().replace(/\(cost.*$/, '');
          return `${ex.replace('Execution Time: ', '').trim()} [${scan}]`;
        };
        out.push(`${label.padEnd(20)} list ${await time(listSql)}\n${''.padEnd(20)} count ${await time(cntSql)}\n${''.padEnd(20)} group ${await time(grpSql)}`);
      }
      throw new Error('ROLLBACK_ON_PURPOSE');
    }, { timeout: 600000, maxWait: 60000 });
  } catch (e) { if (!/ROLLBACK_ON_PURPOSE/.test(e.message)) console.log('ERR', e.message.slice(0, 300)); }
  console.log(out.join('\n'));
}
process.exit(0);
