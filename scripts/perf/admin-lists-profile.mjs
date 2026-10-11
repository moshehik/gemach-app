// admin-lists-profile.mjs - מדידת העלות של שאילתות רשימות הניהול (הזמנות / לקוחות) מול TEST בלבד, קריאה בלבד.
// הרצה: node --import ./scripts/perf/register.mjs scripts/perf/admin-lists-profile.mjs [--explain] [--only=<חלק משם התרחיש>]
// לכל תרחיש: זמן קיר, מספר שאילתות, סכום משכי Prisma (כולל RTT של הרשת - מהמחשב המקומי ~0.8 שנ' לכל סיבוב מול Neon), ובמצב --explain
// גם EXPLAIN (ANALYZE, BUFFERS) לכל שאילתה: זמן ביצוע בשרת ה-DB (בלי הרשת) + סוג הסריקה הראשי.
import prisma from './stub-prisma.mjs';
import { parseOrdersListParams } from '../../lib/adminOrdersList.js';
import { parseCustomersListParams } from '../../lib/adminCustomersList.js';
import * as O from '../../lib/adminOrdersListServer.js';
import * as C from '../../lib/adminCustomersListServer.js';

const explain = process.argv.includes('--explain');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const T = { today: '2026-10-11' };

const ORD = [
  ['orders: default list', 'list', {}],
  ['orders: status rented', 'list', { states: 'rented' }],
  ['orders: status upcoming+past', 'list', { states: 'upcoming,past' }],
  ['orders: status deleted', 'list', { states: 'deleted' }],
  ['orders: pay=debt', 'list', { pays: 'debt' }],
  ['orders: pay=settled', 'list', { pays: 'settled' }],
  ['orders: pay=credit', 'list', { pays: 'credit' }],
  ['orders: sort balance desc', 'list', { sort: 'balance', dir: 'desc' }],
  ['orders: sort total desc', 'list', { sort: 'total', dir: 'desc' }],
  ['orders: sort itemsCount desc', 'list', { sort: 'itemsCount', dir: 'desc' }],
  ['orders: sort status asc', 'list', { sort: 'status', dir: 'asc' }],
  ['orders: sort customerName', 'list', { sort: 'customerName', dir: 'asc' }],
  ['orders: search phone', 'list', { search: '0548526564' }],
  ['orders: search barcode', 'list', { search: '6323401' }],
  ['orders: search name', 'list', { search: 'כהן' }],
  ['orders: search order no', 'list', { search: '27958' }],
  ['orders: period custom (month)', 'list', { period: 'custom', from: '2026-10-01', to: '2026-10-31' }],
  ['orders: period past30', 'list', { period: 'past30' }],
  ['orders: debt + sort balance', 'list', { pays: 'debt', sort: 'balance', dir: 'desc' }],
  ['orders: page 300', 'list', { page: 300 }],
  ['orders: export page (500 rows, lean)', 'list', { limit: 500, export: '1' }],
  ['orders: COUNTS default', 'counts', {}],
  ['orders: COUNTS debt', 'counts', { pays: 'debt' }],
  ['orders: COUNTS search name', 'counts', { search: 'כהן' }],
];
const CUS = [
  ['customers: default list', 'list', {}],
  ['customers: debt', 'list', { debt: 'yes' }],
  ['customers: active orders', 'list', { orders: 'active' }],
  ['customers: no orders', 'list', { orders: 'none' }],
  ['customers: sort orders desc', 'list', { sort: 'orders', dir: 'desc' }],
  ['customers: sort debt desc', 'list', { sort: 'debt', dir: 'desc' }],
  ['customers: sort lastOrder desc', 'list', { sort: 'lastOrder', dir: 'desc' }],
  ['customers: sort city', 'list', { sort: 'city' }],
  ['customers: first order d90', 'list', { first: 'd90' }],
  ['customers: first order custom', 'list', { first: 'custom', from: '2025-01-01', to: '2025-12-31' }],
  ['customers: missing any', 'list', { missing: 'any' }],
  ['customers: missing email', 'list', { missing: 'email' }],
  ['customers: search phone', 'list', { search: '0527622826' }],
  ['customers: search name', 'list', { search: 'כהן' }],
  ['customers: export page (500 rows)', 'list', { limit: 500, export: '1' }],
  ['customers: COUNTS default', 'counts', {}],
  ['customers: COUNTS search name', 'counts', { search: 'כהן' }],
];

const topNode = (plan) => { const n = plan[0]['Plan']; return `${n['Node Type']}${n['Relation Name'] ? ' on ' + n['Relation Name'] : ''}`; };

async function explainQuery(q) {
  if (!/^\s*(SELECT|WITH)/i.test(q.sql)) return null;
  let params = [];
  try { params = JSON.parse(q.params); } catch { return null; }
  try {
    const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q.sql}`, ...params);
    const plan = rows[0]['QUERY PLAN'];
    return { exec: plan[0]['Execution Time'], plan: topNode(plan), shared: JSON.stringify(plan[0]['Plan']['Shared Hit Blocks'] || 0) + '/' + (plan[0]['Plan']['Shared Read Blocks'] || 0) };
  } catch (e) { return { err: e.message.slice(0, 80) }; }
}

const rtt = [];
for (let i = 0; i < 3; i++) { const s = Date.now(); await prisma.$queryRawUnsafe('SELECT 1'); rtt.push(Date.now() - s); }
console.log(`RTT SELECT 1: ${rtt.join(', ')} ms`);
console.log('scenario | wall ms | queries | sum prisma ms | sum db exec ms (EXPLAIN ANALYZE) | slowest db exec ms | slowest query');

for (const [name, kind, input] of [...ORD, ...CUS]) {
  if (only && !name.includes(only)) continue;
  const isO = name.startsWith('orders');
  const mod = isO ? O : C;
  const params = isO ? parseOrdersListParams(input) : parseCustomersListParams(input);
  globalThis.__queries.length = 0;
  const s = Date.now();
  let err = '';
  try {
    if (kind === 'list') await (isO ? mod.queryOrdersList(params) : mod.queryCustomersList(params));
    else await (isO ? mod.queryOrdersCounts(params) : mod.queryCustomersCounts(params));
  } catch (e) { err = ' ERR ' + e.message.slice(0, 80); }
  const wall = Date.now() - s;
  const qs = globalThis.__queries.slice();
  let worst = null;
  let sumExec = 0;
  let failed = 0;
  if (explain) {
    for (const q of qs) {
      const r = await explainQuery(q);
      if (r && r.err) failed++;
      if (r && r.exec !== undefined) sumExec += r.exec;
      if (r && r.exec !== undefined && (!worst || r.exec > worst.exec)) worst = { ...r, sql: q.sql.replace(/\s+/g, ' ').slice(0, 110) };
    }
  }
  const sum = qs.reduce((a, q) => a + q.ms, 0);
  console.log(`${name} | ${wall} | ${qs.length} | ${sum} | ${explain ? sumExec.toFixed(0) + ' (explain failed: ' + failed + ')' : '-'} | ${worst ? worst.exec.toFixed(0) + ' (' + worst.plan + ')' : '-'} | ${worst ? worst.sql : ''}${err}`);
}
await prisma.$disconnect();
