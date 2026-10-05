// GET /api/poll - שירות המונים (lib/pollCounts.js) + מטמון/דלי אסימונים (lib/pollCache.js) עם prisma מזויף. בלי DB ובלי רשת.
// הרצה: node scripts/poll-endpoint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createPollService } = await import(pathToFileURL(path.join(ROOT, 'lib/pollCounts.js')).href);
const { createPollCache, pollCache, invalidateErrorReportCounts, invalidateNotificationCounts, BUCKET_CAPACITY, ER_TTL_MS } =
  await import(pathToFileURL(path.join(ROOT, 'lib/pollCache.js')).href);

// ---- prisma מזויף -----------------------------------------------------------------
function makeEnv({ reports = [], notifs = [], employees = { p1: { id: 'p1', roleId: 2 }, u1: { id: 'u1', roleId: 3 }, u2: { id: 'u2', roleId: 3 } }, perms = {} } = {}) {
  let t = 1_000_000;
  const calls = { count: [], notif: [], emp: 0, perm: [] };
  const state = { reports, notifs };
  const prisma = {
    employee: { findUnique: async ({ where }) => { calls.emp += 1; return employees[where.id] || null; } },
    errorReport: {
      // מימוש נאמן של ה-where שהשירות בונה (employeeId / status != ARCHIVED / isRead*=false)
      count: async ({ where }) => {
        calls.count.push(where);
        return state.reports.filter((r) =>
          (where.employeeId === undefined || r.employeeId === where.employeeId) &&
          (!where.status || r.status !== where.status.not) &&
          (where.isReadByProgrammer === undefined || r.isReadByProgrammer === where.isReadByProgrammer) &&
          (where.isReadByUser === undefined || r.isReadByUser === where.isReadByUser)).length;
      },
    },
    notification: {
      findMany: async (args) => {
        calls.notif.push(args);
        const id = args.where.OR[0].receiverId;
        return state.notifs.filter((n) => n.receiverId === id || n.receiverId === null).slice(0, args.take);
      },
    },
  };
  const hasPermission = async (emp, key) => { calls.perm.push([emp.id, emp.roleId, key]); return perms[emp.id] ?? (emp.roleId === 2 || emp.roleId === 0); };
  const cache = createPollCache({ now: () => t });
  const svc = createPollService({ prisma, hasPermission, cache });
  return { svc, calls, state, cache, advance: (ms) => { t += ms; }, setReports: (r) => { state.reports = r; }, setNotifs: (n) => { state.notifs = n; } };
}
const R = (o) => ({ employeeId: 'u1', status: 'OPEN', isReadByUser: true, isReadByProgrammer: false, ...o });
const N = (o) => ({ receiverId: 'u1', isRead: false, isArchived: false, readBy: '[]', archivedBy: '[]', ...o });

// ---- הסמנטיקה זהה לנתיבים הישנים ---------------------------------------------------------
test('דיווחי תקלות: מתכנת סופר את כל הארגון (לא נקרא ע"י מתכנת, לא בארכיון); משתמש רגיל רק את שלו (isReadByUser)', async () => {
  const reports = [
    R({ employeeId: 'u1', isReadByProgrammer: false, isReadByUser: false }), // של u1, לא נקרא גם לו וגם למתכנת
    R({ employeeId: 'u2', isReadByProgrammer: false, isReadByUser: true }),  // של u2: למתכנת לא נקרא
    R({ employeeId: 'u2', isReadByProgrammer: true, isReadByUser: false }),  // נקרא ע"י המתכנת
    R({ employeeId: 'u1', status: 'ARCHIVED', isReadByProgrammer: false, isReadByUser: false }), // ארכיון - לא נספר אצל אף אחד
  ];
  const e = makeEnv({ reports });
  const prog = await e.svc.getPollCounts({ employeeId: 'p1', sessionRoleId: 2 });
  assert.equal(prog.body.errorReports.unread, 2);
  assert.equal(prog.body.errorReports.isProgrammer, true);
  assert.equal(prog.body.errorReports.isManager, true);
  const u1 = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(u1.body.errorReports.unread, 1); // רק שלו, לא בארכיון, לא נקרא
  assert.equal(u1.body.errorReports.isProgrammer, false);
  assert.equal(u1.body.errorReports.isManager, false); // hasPermission(feature:error_reports) = false לתפקיד 3
  const u2 = await e.svc.getPollCounts({ employeeId: 'u2', sessionRoleId: 3 });
  assert.equal(u2.body.errorReports.unread, 1);
  // ההרשאה נבדקת על feature:error_reports עם {id, roleId} של העובד
  assert.deepEqual(e.calls.perm.find((c) => c[0] === 'u1'), ['u1', 3, 'feature:error_reports']);
});

test('isManager: חריגה אישית (override) מתקבלת דרך hasPermission', async () => {
  const e = makeEnv({ perms: { u1: true } });
  const r = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(r.body.errorReports.isManager, true);
});

test('התראות: אישיות לפי isRead/isArchived, כלליות לפי readBy/archivedBy של העובד; take 150 ו-where כמו בנתיב הישן', async () => {
  const notifs = [
    N({}),                                                                    // אישית, לא נקראה -> נספרת
    N({ isRead: true }),                                                      // נקראה
    N({ isArchived: true }),                                                  // בארכיון
    N({ receiverId: null }),                                                  // כללית, לא נקראה -> נספרת
    N({ receiverId: null, readBy: JSON.stringify(['u1']) }),                  // כללית שנקראה ע"י u1
    N({ receiverId: null, archivedBy: JSON.stringify(['u1']) }),              // כללית בארכיון של u1
    N({ receiverId: null, readBy: JSON.stringify(['u2']) }),                  // נקראה ע"י u2 בלבד -> אצל u1 לא נקראה -> נספרת
    N({ receiverId: null, readBy: 'not json' }),                              // JSON שבור = רשימה ריקה -> לא נקראה -> נספרת
    N({ receiverId: 'u2' }),                                                  // של עובד אחר - לא מגיע ל-u1 בכלל
  ];
  const e = makeEnv({ notifs });
  const r = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(r.body.notifications.unread, 4);
  const args = e.calls.notif[0];
  assert.deepEqual(args.where, { OR: [{ receiverId: 'u1' }, { receiverId: null }] });
  assert.equal(args.take, 150);
  assert.deepEqual(args.orderBy, { createdAt: 'desc' });
  assert.deepEqual(Object.keys(args.select).sort(), ['archivedBy', 'isArchived', 'isRead', 'readBy', 'receiverId']);
});

test('העובד מקבל רק את המונים של עצמו (אין דליפה בין עובדים במטמון)', async () => {
  const e = makeEnv({ notifs: [N({ receiverId: 'u1' }), N({ receiverId: 'u1' })] });
  const a = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  const b = await e.svc.getPollCounts({ employeeId: 'u2', sessionRoleId: 3 });
  assert.equal(a.body.notifications.unread, 2);
  assert.equal(b.body.notifications.unread, 0);
});

// ---- אימות -----------------------------------------------------------------------------
test('בלי employeeId: 401. טוקן טרי (sessionRoleId) = אפס שאילתות Employee; בלי טוקן: שאילתה אחת, ועובד שנמחק = 404', async () => {
  const e = makeEnv();
  assert.equal((await e.svc.getPollCounts({})).status, 401);
  await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(e.calls.emp, 0);
  const e2 = makeEnv();
  const r = await e2.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: null });
  assert.equal(r.status, 200);
  assert.equal(e2.calls.emp, 1);
  const gone = await e2.svc.getPollCounts({ employeeId: 'ghost', sessionRoleId: null });
  assert.equal(gone.status, 404);
});

test('תפקיד לא נלקח מהמטמון כשהטוקן הטרי אומר אחרת (הורדת מתכנת בדרגה)', async () => {
  const e = makeEnv({ reports: [R({ employeeId: 'x', isReadByProgrammer: false, isReadByUser: true })] });
  const asProg = await e.svc.getPollCounts({ employeeId: 'p1', sessionRoleId: 2 });
  assert.equal(asProg.body.errorReports.unread, 1);
  const asUser = await e.svc.getPollCounts({ employeeId: 'p1', sessionRoleId: 3 });
  assert.equal(asUser.body.errorReports.isProgrammer, false);
  assert.equal(asUser.body.errorReports.unread, 0); // רק דיווחים של עצמו
});

// ---- מטמון ---------------------------------------------------------------------------------
test('מטמון: פגיעה (בלי שאילתות), החמצה אחרי TTL, ביטול, ו-fresh עוקף', async () => {
  const e = makeEnv({ reports: [R({ isReadByUser: false })], notifs: [N({})] });
  const q = () => e.calls.count.length + e.calls.notif.length;
  await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(q(), 2);
  e.advance(21000); // מעל 20 שנ' (אסימון נוסף) אבל מתחת ל-TTL
  const hit = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(q(), 2, 'פגיעה במטמון - בלי שאילתות נוספות');
  assert.equal(hit.body.errorReports.unread, 1);

  e.setReports([]); e.setNotifs([]);
  const stale = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(stale.body.errorReports.unread, 1, 'עדיין הערך מהמטמון');

  e.advance(ER_TTL_MS + 1000);
  const miss = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(miss.body.errorReports.unread, 0);
  assert.equal(miss.body.notifications.unread, 0);
  assert.equal(q(), 4, 'החמצה אחרי TTL - שאילתות חדשות');

  // ביטול (אינסטנס-מקומי)
  e.setNotifs([N({}), N({})]);
  e.cache.invalidate('nf', 'u1');
  e.advance(21000);
  const afterInv = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(afterInv.body.notifications.unread, 2);
  // fresh עוקף מטמון
  e.setNotifs([N({})]);
  e.advance(21000);
  const fresh = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3, fresh: true });
  assert.equal(fresh.body.notifications.unread, 1);
});

test('ביטול כללי של סוג (invalidate בלי id) והסינגלטון של האינסטנס', () => {
  const c = createPollCache({ now: () => 0 });
  c.set('er', 'a', { x: 1 }); c.set('er', 'b', { x: 2 }); c.set('nf', 'a', { x: 3 });
  c.invalidate('er');
  assert.equal(c.get('er', 'a'), null);
  assert.equal(c.get('er', 'b'), null);
  assert.ok(c.get('nf', 'a'));
  pollCache.set('er', 'zz', { roleId: 1 });
  invalidateErrorReportCounts('zz');
  assert.equal(pollCache.get('er', 'zz'), null);
  pollCache.set('nf', 'zz', { unread: 1 });
  invalidateNotificationCounts('zz');
  assert.equal(pollCache.get('nf', 'zz'), null);
});

// ---- דלי אסימונים ------------------------------------------------------------------------------
test('דלי אסימונים: פרץ קטן מותר, מעבר לזה מוגבל והמטמון מוגש (בלי שגיאה ובלי שאילתות), ומתמלא כל 20 שנ׳', async () => {
  const e = makeEnv({ notifs: [N({})] });
  const q = () => e.calls.count.length + e.calls.notif.length;
  const results = [];
  for (let i = 0; i < BUCKET_CAPACITY + 2; i += 1) results.push(await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 }));
  assert.deepEqual(results.map((r) => r.limited), [false, false, false, true, true].slice(0, BUCKET_CAPACITY + 2));
  assert.ok(results.every((r) => r.status === 200 && r.body.success));
  assert.equal(q(), 2, 'כל הבקשות אחרי הראשונה הוגשו מהמטמון');
  // fresh כשמוגבל: ערך המטמון מוגש (אין עקיפה של ההגבלה)
  const lim = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3, fresh: true });
  assert.equal(lim.limited, true);
  assert.equal(q(), 2);
  e.advance(20000);
  const ok = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(ok.limited, false, 'אסימון אחד התמלא אחרי 20 שניות');
  // עובד אחר לא מושפע
  const other = await e.svc.getPollCounts({ employeeId: 'u2', sessionRoleId: 3 });
  assert.equal(other.limited, false);
});

test('מוגבל בלי מטמון בכלל: מחשבים (לא מחזירים ריק או שגיאה)', async () => {
  const e = makeEnv({ notifs: [N({})] });
  for (let i = 0; i < BUCKET_CAPACITY; i += 1) e.cache.takeToken('u1');
  const r = await e.svc.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(r.limited, true);
  assert.equal(r.status, 200);
  assert.equal(r.body.notifications.unread, 1);
});

test('תקלה בחלק אחד לא מפילה את השני; תקלה בשניהם = 500', async () => {
  const failing = createPollService({
    prisma: {
      employee: { findUnique: async () => ({ id: 'u1', roleId: 3 }) },
      errorReport: { count: async () => { throw new Error('db down'); } },
      notification: { findMany: async () => [N({})] },
    },
    hasPermission: async () => false,
    cache: createPollCache(),
  });
  const r = await failing.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(r.status, 200);
  assert.equal(r.body.errorReports, null);
  assert.equal(r.body.notifications.unread, 1);
  const allFail = createPollService({
    prisma: { errorReport: { count: async () => { throw new Error('x'); } }, notification: { findMany: async () => { throw new Error('y'); } } },
    hasPermission: async () => false,
    cache: createPollCache(),
  });
  const r2 = await allFail.getPollCounts({ employeeId: 'u1', sessionRoleId: 3 });
  assert.equal(r2.status, 500);
});

// ---- סטטי: הנתיב והנתיבים הישנים -----------------------------------------------------------------
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('סטטי: /api/poll - no-store, X-Poll-Limited, אימות חתום, טוקן טרי; הנתיבים הישנים ?light=1 לא שונו', () => {
  const route = read('app/api/poll/route.js');
  assert.match(route, /getVerifiedAuthCookie\(cookieStore\)/);
  assert.match(route, /readVerifiedSession\(cookieStore\)/);
  assert.match(route, /'Cache-Control': 'no-store'/);
  assert.ok(!/max-age/.test(route.replace(/\/\/.*$/gm, '')), 'אין max-age בנתיב');
  assert.match(route, /X-Poll-Limited/);
  assert.match(route, /searchParams\.get\('fresh'\) === '1'/);
  // הנתיבים הישנים: עדיין מטפלים ב-light=1 כמו קודם
  const er = read('app/api/error-report/route.js');
  assert.match(er, /searchParams\.get\('light'\) === '1'/);
  assert.match(er, /select: \{ id: true, status: true, isReadByProgrammer: true, isReadByUser: true \}/);
  const nf = read('app/api/notifications/route.js');
  assert.match(nf, /searchParams\.get\('light'\) === '1'/);
  assert.match(nf, /take: 150/);
});

test('סטטי: ה-where של הספירה בשרת תואם ל-countUnread של הלקוח (erModel) - מקור אמת אחד לסמנטיקה', () => {
  const model = read('app/components/errorReport/erModel.js');
  assert.match(model, /isUnread = \(r, isProgrammer\) => \(isProgrammer \? !r\.isReadByProgrammer : !r\.isReadByUser\)/);
  assert.match(model, /r\.status !== 'ARCHIVED' && isUnread\(r, isProgrammer\)/);
  const svc = read('lib/pollCounts.js');
  assert.match(svc, /isProgrammer = roleId === 2/);
  assert.match(svc, /status: \{ not: 'ARCHIVED' \}/);
  assert.match(svc, /isReadByProgrammer: false/);
  assert.match(svc, /isReadByUser: false/);
  const schema = read('prisma/schema.prisma');
  const m = schema.match(/model ErrorReport \{[\s\S]*?\n\}/)[0];
  assert.match(m, /status\s+String\s+@default\("OPEN"\)/); // לא nullable: status != 'ARCHIVED' ב-SQL זהה ל-JS
  assert.match(m, /isReadByUser\s+Boolean\s+@default\(true\)/);
  assert.match(m, /isReadByProgrammer\s+Boolean\s+@default\(false\)/);
});
