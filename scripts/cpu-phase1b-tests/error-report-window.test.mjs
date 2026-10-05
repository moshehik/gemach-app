// ErrorReportWindow client logic on the slim paged list (CPU phase 1B): the pure model (erModel.js) gives the same list ordering,
// attention flags and counters from a slim list (last reply only) as from the old full list; mergeReportLists keeps loaded threads.
//   node --no-warnings --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/error-report-window.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const M = await import(pathToFileURL(process.env.PROJ + '/app/components/errorReport/erModel.js').href);
const LIST = await import(pathToFileURL(process.env.PROJ + '/lib/errorReportList.js').href);
const read = (p) => fs.readFileSync(process.env.PROJ + '/' + p, 'utf8');

function fullReport(i, { replies = 3, lastQuestion = false, status = 'OPEN', readProg = true, readUser = true, handled = false } = {}) {
  const reps = [];
  for (let k = 0; k < replies; k++) reps.push({ id: `rep-${i}-${k}`, isProgrammer: k % 2 === 0, employeeId: k % 2 ? 'p' : null, isQuestion: lastQuestion && k === replies - 1 && k % 2 === 0, text: `תגובה ${k}`, attachmentUrls: null, createdAt: `2026-01-0${1 + k}T00:00:00Z` });
  return { id: `r${i}`, employeeId: 'u', userText: `דיווח ${i} ` + 'ארוך '.repeat(200), title: 'עמוד', url: '/x', status, isReadByUser: readUser, isReadByProgrammer: readProg, isHandled: handled, needsHuman: false,
    createdAt: `2026-01-0${(i % 8) + 1}T00:00:00Z`, updatedAt: `2026-02-0${(i % 8) + 1}T00:00:00Z`, employee: { firstName: 'א', lastName: 'ב' }, attachmentUrls: '["data:image/png;base64,AAA"]', lastButtons: '["x"]', queryParams: 'אין', time: 't', replies: reps };
}
// what the DB select (LIST_SELECT) hands to slimListReport: only the whitelisted columns, replies = last one with the whitelisted columns
const pick = (o, sel) => Object.fromEntries(Object.keys(sel).filter((k) => k in o).map((k) => [k, o[k]]));
const toSlim = (r) => LIST.slimListReport({ ...pick(r, LIST.LIST_SELECT), replies: [r.replies[r.replies.length - 1]].filter(Boolean).map((x) => pick(x, LIST.LIST_SELECT.replies.select)), _count: { replies: r.replies.length } });

const FULL = [
  fullReport(1, { readProg: false }), fullReport(2, { lastQuestion: true }), fullReport(3, { status: 'ARCHIVED' }), fullReport(4, { handled: true }),
  fullReport(5, { readUser: false, readProg: false, lastQuestion: true }), fullReport(6, { replies: 0 }), fullReport(7, { status: 'ARCHIVED', readProg: false }),
];
const SLIM = FULL.map(toSlim);

test('slim rows give the same attention / unread / waiting numbers and the same list grouping as full rows (both roles)', () => {
  for (const prog of [true, false]) {
    for (let i = 0; i < FULL.length; i++) {
      assert.equal(M.needsAttention(SLIM[i], prog), M.needsAttention(FULL[i], prog), `needsAttention r${i + 1} prog=${prog}`);
      assert.equal(M.isAwaitingReply(SLIM[i]), M.isAwaitingReply(FULL[i]));
      assert.equal(M.quietLine(SLIM[i], prog), M.quietLine(FULL[i], prog));
      assert.equal(M.showHumanButton(SLIM[i], { isProgrammer: prog, humanButtonEnabled: true }), M.showHumanButton(FULL[i], { isProgrammer: prog, humanButtonEnabled: true }));
      assert.equal(M.displayTitle(SLIM[i]).text, M.displayTitle(FULL[i]).text, 'list title = first words, unaffected by the excerpt');
    }
    assert.equal(M.unreadCount(SLIM, prog), M.unreadCount(FULL, prog));
    assert.equal(M.waitingCount(SLIM, prog), M.waitingCount(FULL, prog));
    const g1 = M.groupOpenReports(SLIM, { isProgrammer: prog }), g2 = M.groupOpenReports(FULL, { isProgrammer: prog });
    assert.deepEqual(g1.top.map((r) => r.id), g2.top.map((r) => r.id));
    assert.deepEqual(g1.others.map((r) => r.id), g2.others.map((r) => r.id));
    assert.deepEqual(M.archivedReports(SLIM).map((r) => r.id), M.archivedReports(FULL).map((r) => r.id));
  }
});

test('slim rows carry partial + repliesCount and no heavy fields', () => {
  const s = SLIM[0];
  assert.equal(s.partial, true);
  assert.equal(s.repliesCount, 3);
  assert.ok(!('attachmentUrls' in s) && !('lastButtons' in s));
  assert.equal(SLIM[5].repliesCount, 0);
  assert.deepEqual(SLIM[5].replies, []);
});

test('mergeReportLists: a loaded thread survives a list refresh when nothing was added; changed flags are taken from the server', () => {
  const loaded = { ...FULL[0], partial: false, repliesCount: 3 };
  const fresh = { ...toSlim(FULL[0]), isReadByProgrammer: true, isHandled: true };
  const merged = M.mergeReportLists([loaded], [fresh]);
  assert.equal(merged[0].partial, false);
  assert.equal(merged[0].replies.length, 3, 'all replies kept');
  assert.equal(merged[0].userText, FULL[0].userText, 'full text kept');
  assert.equal(merged[0].attachmentUrls, FULL[0].attachmentUrls);
  assert.equal(merged[0].isReadByProgrammer, true);
  assert.equal(merged[0].isHandled, true);
});

test('mergeReportLists: a new reply (count or last id differs) turns the row partial again so the thread is re-fetched', () => {
  const loaded = { ...FULL[0], partial: false, repliesCount: 3 };
  const withNew = fullReport(1, { replies: 4 });
  const merged = M.mergeReportLists([loaded], [toSlim(withNew)]);
  assert.equal(merged[0].partial, true);
  const sameCountDifferentLast = toSlim({ ...FULL[0], replies: [...FULL[0].replies.slice(0, 2), { ...FULL[0].replies[2], id: 'other' }] });
  assert.equal(M.mergeReportLists([loaded], [sameCountDifferentLast])[0].partial, true);
});

test('mergeReportLists: unknown / partial previous rows and old-shape (non-partial) incoming rows pass through untouched', () => {
  const a = toSlim(FULL[1]);
  assert.deepEqual(M.mergeReportLists([], [a]), [a]);
  assert.deepEqual(M.mergeReportLists([a], [a]), [a]);
  const old = FULL[2];
  assert.deepEqual(M.mergeReportLists([{ ...old, partial: false }], [old]), [old]);
  assert.deepEqual(M.mergeReportLists(null, null), []);
});

test('static: the window loads the thread on selection, pages with a "load more" control, keeps the old reply flow for loaded threads', () => {
  const w = read('app/components/errorReport/ErrorReportWindow.js');
  assert.match(w, /const REPORTS_LIST_URL = `\/api\/error-report\?take=\$\{REPORTS_PAGE_SIZE\}`;/);
  assert.match(w, /fetch\(`\/api\/error-report\?id=\$\{encodeURIComponent\(id\)\}`/);
  assert.match(w, /useEffect\(\(\) => \{ if \(selectedId && selectedPartial\) loadDetail\(selectedId\); \}/);
  assert.match(w, /טען עוד פניות/);
  assert.match(w, /M\.mergeReportLists\(reportsRef\.current, incoming\)/);
  assert.match(w, /\{isPartial \? null : <div className="er-reply er3-reply">/, 'no composer on a partial row (the reply would be appended to a one-reply stub)');
  assert.match(w, /archivedTotal/);
});

test('static: the frozen legacy window and the light poll still call the old URLs', () => {
  const legacy = read('app/components/LegacyErrorReportButton.js');
  assert.match(legacy, /fetch\(light \? '\/api\/error-report\?light=1' : '\/api\/error-report'\)/);
  assert.ok(!/take=|error-report\?id=/.test(legacy));
  const btn = read('app/components/ErrorReportButton.js');
  assert.match(btn, /fetch\('\/api\/error-report\?light=1'\)/);
});
