// EXPLAIN (ANALYZE) של שאילתות יומן המיילים על TEST (קריאה בלבד): node scripts/perf/email-logs-explain.mjs
// מדפיס לכל תרחיש את סוג הסריקה, שורות, וזמן ביצוע בשרת. ר' docs/a5-staff-models/email-logs-notes.md ("עלות").
import prisma from './stub-prisma.mjs';
import * as L from '../../lib/adminEmailLogs.js';

const scenarios = {
  'default (newest 50)': { p: {}, ranges: [] },
  'sort by recipient': { p: { sort: 'to', dir: 'asc' }, ranges: [] },
  'sort by type': { p: { sort: 'type' }, ranges: [] },
  'filter type+status': { p: { types: 'orderCard,orderCreated', statuses: 'sent' }, ranges: [] },
  'filter period 30d': { p: { period: 'past30' }, ranges: [{ from: new Date(Date.now() - 30 * 864e5).toISOString(), to: null }] },
  'filter sender none': { p: { senders: 'none' }, ranges: [] },
  'search subject/recipient/body': { p: { search: '26097' }, ranges: [] },
};
for (const [name, s] of Object.entries(scenarios)) {
  const params = L.parseEmailLogsParams(s.p);
  const q = L.listSql(params, s.ranges);
  const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q.sql}`, ...q.args);
  const plan = rows[0]['QUERY PLAN'][0];
  const scans = [];
  (function walk(n) { if (/Scan/.test(n['Node Type'])) scans.push(`${n['Node Type']}${n['Index Name'] ? ' ' + n['Index Name'] : ''}`); (n.Plans || []).forEach(walk); })(plan.Plan);
  console.log(name.padEnd(32), `exec ${plan['Execution Time']} ms, plan ${plan['Planning Time']} ms, scans: ${[...new Set(scans)].join(', ')}, top ${plan.Plan['Node Type']}`);
}
const c = L.countsSql(L.parseEmailLogsParams({}), [], { today: { from: new Date(Date.now() - 864e5).toISOString(), to: new Date().toISOString() } });
for (const k of Object.keys(c)) {
  const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, FORMAT JSON) ${c[k].sql}`, ...c[k].args);
  console.log(('counts ' + k).padEnd(32), `exec ${rows[0]['QUERY PLAN'][0]['Execution Time']} ms`);
}
process.exit(0);
