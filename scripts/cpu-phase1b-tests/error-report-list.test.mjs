// GET /api/error-report (CPU phase 1B): no new params -> the OLD full shape for everyone (LegacyErrorReportButton, old clients);
// ?take=N (+cursor) -> slim paged list (no replies bodies / attachments); ?id= -> one full report. In-memory prisma, no DB.
//   node --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/error-report-list.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/error-report/route.js');
const LIST = await L('lib/errorReportList.js');

// ---- tiny where-evaluator (only the operators the route/helper use) ----
function matches(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND') { if (!v.every((w) => matches(row, w))) return false; continue; }
    if (k === 'OR') { if (!v.some((w) => matches(row, w))) return false; continue; }
    const val = row[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('not' in v && val === v.not) return false;
      if ('lt' in v && !(val < v.lt)) return false;
    } else if (v instanceof Date) { if (new Date(val).getTime() !== v.getTime()) return false; }
    else if (val !== v) return false;
  }
  return true;
}
const sortRows = (rows, orderBy) => {
  const o = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of o) {
      const [[f, dir]] = Object.entries(spec);
      const x = a[f] instanceof Date ? a[f].getTime() : a[f], y = b[f] instanceof Date ? b[f].getTime() : b[f];
      if (x !== y) return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
    }
    return 0;
  });
};

const BIG_DATA_URL = 'data:image/png;base64,' + 'A'.repeat(20000);
const EMP = { firstName: 'דנה', lastName: 'כהן' };
let REPORTS = [];
let REPLIES = [];
function seed({ n = 120, replyEvery = 1 } = {}) {
  REPORTS = []; REPLIES = [];
  for (let i = 0; i < n; i++) {
    const id = `r-${String(i).padStart(4, '0')}`;
    REPORTS.push({
      id, employeeId: i % 5 === 0 ? 'emp-user' : 'emp-other', time: '12:00', url: `/orders/${i}`, title: `עמוד ${i}`, queryParams: 'אין',
      lastButtons: JSON.stringify(['a', 'b']), userText: `תיאור הדיווח מספר ${i} ` + 'ארוך '.repeat(300),
      attachmentUrls: JSON.stringify([BIG_DATA_URL]), status: i < 80 ? 'ARCHIVED' : 'OPEN',
      isReadByUser: true, isReadByProgrammer: !(i === 3 || i === 99 || i === 118), isHandled: false, needsHuman: false,
      createdAt: new Date(Date.UTC(2026, 0, 1) + i * 3600e3), updatedAt: new Date(Date.UTC(2026, 0, 1) + i * 3600e3), employee: EMP,
    });
    for (let k = 0; k < replyEvery * 4; k++) {
      REPLIES.push({
        id: `rep-${i}-${k}`, errorReportId: id, employeeId: k % 2 ? 'prog' : null, isProgrammer: k % 2 === 0, text: 'תגובה '.repeat(80),
        isQuestion: k === replyEvery * 4 - 1 && i % 7 === 0, attachmentUrls: null, sketchHtml: k === 1 ? '<html>' + 'x'.repeat(5000) : null, sketchStatus: null,
        previewUrl: null, createdAt: new Date(Date.UTC(2026, 0, 1) + i * 3600e3 + k * 60e3), employee: EMP,
      });
    }
  }
}
const repliesOf = (id) => REPLIES.filter((r) => r.errorReportId === id);
function project(row, args) {
  if (args.select) {
    const out = {};
    for (const [k, v] of Object.entries(args.select)) {
      if (k === '_count') out._count = { replies: repliesOf(row.id).length };
      else if (k === 'replies') {
        let reps = sortRows(repliesOf(row.id), v.orderBy || { createdAt: 'asc' });
        if (v.take) reps = reps.slice(0, v.take);
        out.replies = reps.map((r) => Object.fromEntries(Object.keys(v.select).map((f) => [f, r[f]])));
      } else if (k === 'employee') out.employee = row.employee;
      else if (v) out[k] = row[k];
    }
    return out;
  }
  const out = { ...row };
  if (args.include && args.include.replies) out.replies = sortRows(repliesOf(row.id), args.include.replies.orderBy || { createdAt: 'asc' }).map((r) => ({ ...r }));
  return out;
}
globalThis.__PRISMA = {
  systemSetting: { findMany: async () => [], findUnique: async () => null },
  employee: { findUnique: async ({ where }) => ({ id: where.id, roleId: where.id === 'emp-prog' ? 2 : where.id === 'emp-mgr' ? 1 : 3, firstName: 'x', lastName: 'y' }) },
  errorReport: {
    findMany: async (args) => {
      let rows = REPORTS.filter((r) => matches(r, args.where));
      rows = sortRows(rows, args.orderBy || { createdAt: 'asc' });
      if (args.take) rows = rows.slice(0, args.take);
      return rows.map((r) => project(r, args));
    },
    findFirst: async (args) => { const r = REPORTS.find((x) => matches(x, args.where)); return r ? project(r, args) : null; },
    count: async ({ where }) => REPORTS.filter((r) => matches(r, where)).length,
  },
  errorReportReply: {},
  $queryRawUnsafe: async () => [],
};

const as = (who) => { globalThis.__COOKIES = { auth_token: who }; };
const get = async (qs = '') => {
  const res = await route.GET(new Request(`http://test.local/api/error-report${qs}`));
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) };
};
const kb = (t) => Buffer.byteLength(t) / 1024;

test('no params: the old full shape for a programmer (every report, every reply, sketchHtml replaced by hasSketch, attachments kept)', async () => {
  seed(); as('emp-prog');
  const { json } = await get();
  assert.equal(json.success, true);
  assert.equal(json.isProgrammer, true);
  assert.equal(json.reports.length, 120);
  assert.equal(json.reports[0].replies.length, 4);
  assert.ok('attachmentUrls' in json.reports[0]);
  assert.ok(!('partial' in json.reports[0]) && !('repliesCount' in json.reports[0]) && !('paging' in json));
  assert.equal(json.reports[0].replies[1].hasSketch, true);
  assert.ok(!('sketchHtml' in json.reports[0].replies[1]));
  assert.equal(json.reports[0].updatedAt !== undefined, true);
  // newest first (updatedAt desc), like before
  assert.ok(new Date(json.reports[0].updatedAt) >= new Date(json.reports[1].updatedAt));
});

test('?light=1 is untouched by the new params code (and ignores take/id)', async () => {
  seed(); as('emp-prog');
  const { json } = await get('?light=1&take=5&id=r-0001');
  assert.equal(json.reports.length, 120);
  assert.deepEqual(Object.keys(json.reports[0]).sort(), ['id', 'isReadByProgrammer', 'isReadByUser', 'status']);
});

test('?take=50: slim list - no attachments / lastButtons / reply bodies, short userText, last reply flags + repliesCount', async () => {
  seed(); as('emp-prog');
  const { json } = await get('?take=50');
  assert.equal(json.success, true);
  const r = json.reports[0];
  assert.equal(r.partial, true);
  assert.ok(!('attachmentUrls' in r) && !('lastButtons' in r) && !('queryParams' in r));
  assert.ok(r.userText.length <= LIST.LIST_USER_TEXT_MAX + 1);
  assert.equal(r.repliesCount, 4);
  assert.equal(r.replies.length, 1, 'only the last reply');
  assert.deepEqual(Object.keys(r.replies[0]).sort(), ['createdAt', 'employeeId', 'id', 'isProgrammer', 'isQuestion', 'text']);
  assert.equal(r.replies[0].text, '', 'reply text is not shipped in the list');
  assert.equal(r.replies[0].id, 'rep-119-3', 'it is the newest reply');
  assert.ok(r.employee && r.employee.firstName);
});

test('?take=50 pages: first page = 50 newest + every open unread report (exact badge counts), nextCursor walks the rest without gaps', async () => {
  seed(); as('emp-prog');
  const first = (await get('?take=50')).json;
  const ids1 = first.reports.map((x) => x.id);
  assert.ok(first.paging.hasMore);
  assert.equal(first.paging.total, 120);
  assert.equal(first.paging.archivedTotal, 80);
  // unread open reports (3 is archived -> not counted; 99 and 118 are open+unread; 118 is already inside the newest 50)
  const unreadOpenAll = REPORTS.filter((x) => x.status !== 'ARCHIVED' && !x.isReadByProgrammer).map((x) => x.id).sort();
  const unreadOpenLoaded = first.reports.filter((x) => x.status !== 'ARCHIVED' && !x.isReadByProgrammer).map((x) => x.id).sort();
  assert.deepEqual(unreadOpenLoaded, unreadOpenAll, 'the unread counter computed on the loaded page equals the true counter');
  // walk all pages
  const all = new Map(first.reports.map((x) => [x.id, x]));
  let cursor = first.paging.nextCursor; let pages = 1;
  while (cursor) {
    const next = (await get(`?take=50&cursor=${encodeURIComponent(cursor)}`)).json;
    assert.ok(!('total' in next.paging), 'counts only on the first page');
    for (const x of next.reports) all.set(x.id, x);
    cursor = next.paging.nextCursor; pages++;
    assert.ok(pages < 10);
  }
  assert.equal(all.size, 120, 'every report arrives exactly once across pages (after de-duplication)');
  assert.equal(pages, 3);
  // order inside a page is updatedAt desc
  const ts = first.reports.map((x) => new Date(x.updatedAt).getTime());
  assert.deepEqual(ts, [...ts].sort((a, b) => b - a));
  assert.ok(ids1.length >= 50);
});

test('payload sizes: the slim first page is a small fraction of the old full list (data: URL screenshots + every reply)', async () => {
  seed(); as('emp-prog');
  const full = await get();
  const slim = await get('?take=50');
  console.log(`      full=${kb(full.text).toFixed(0)} KB  slim page 1=${kb(slim.text).toFixed(0)} KB`);
  assert.ok(kb(full.text) > 1000);
  assert.ok(kb(slim.text) < 80, 'slim page < 80 KB');
  assert.ok(kb(slim.text) < kb(full.text) / 15);
});

test('?id=: one full report with all replies, hasSketch instead of sketchHtml, attachments + lastButtons present, partial=false', async () => {
  seed(); as('emp-prog');
  const { status, json } = await get('?id=r-0100');
  assert.equal(status, 200);
  assert.equal(json.report.id, 'r-0100');
  assert.equal(json.report.partial, false);
  assert.equal(json.report.replies.length, 4);
  assert.equal(json.report.replies[1].hasSketch, true);
  assert.ok(!('sketchHtml' in json.report.replies[1]));
  assert.ok(json.report.attachmentUrls && json.report.lastButtons);
  assert.ok(json.report.userText.length > LIST.LIST_USER_TEXT_MAX, 'full text, not the list excerpt');
});

test('?id= for a missing report is 404; a regular user cannot read someone else\'s report (same scope as the list)', async () => {
  seed(); as('emp-prog');
  assert.equal((await get('?id=nope')).status, 404);
  as('emp-user');
  assert.equal((await get('?id=r-0001')).status, 404, 'r-0001 belongs to emp-other');
  const own = await get('?id=r-0000');
  assert.equal(own.status, 200);
});

test('regular user: take list is scoped to own reports, first page carries all their open reports', async () => {
  seed(); as('emp-user');
  const { json } = await get('?take=5');
  assert.equal(json.isProgrammer, false);
  assert.ok(json.reports.every((x) => x.employeeId === 'emp-user'));
  const openOwn = REPORTS.filter((x) => x.employeeId === 'emp-user' && x.status !== 'ARCHIVED').map((x) => x.id);
  for (const id of openOwn) assert.ok(json.reports.some((x) => x.id === id), `open own report ${id} is on page 1`);
  // the old no-param call for the same user is unchanged
  const old = (await get()).json;
  assert.equal(old.reports.length, REPORTS.filter((x) => x.employeeId === 'emp-user').length);
});

test('take is clamped to 100; a garbage take falls back to 50; a corrupt cursor behaves like page 1', async () => {
  seed(); as('emp-prog');
  assert.equal((await get('?take=100000')).json.paging.take, 100);
  assert.equal((await get('?take=abc')).json.paging.take, 50);
  const c = await get('?take=10&cursor=garbage');
  assert.equal(c.json.paging.total, 120);
});

test('unauthenticated: 401 for every variant', async () => {
  seed(); globalThis.__COOKIES = {};
  for (const qs of ['', '?take=10', '?id=r-0001', '?light=1']) assert.equal((await get(qs)).status, 401, qs);
});
