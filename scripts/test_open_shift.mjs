// בדיקת יחידה ל-lib/openShift.js (המשמרת הפתוחה העדכנית של עובד). prisma מדומה בזיכרון - אין גישה ל-DB ואין כתיבות.
// הרצה: node scripts/test_open_shift.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { pickLatestOpenShift, findLatestOpenShift } from '../lib/openShift.js';

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// prisma מדומה: findMany מסנן לפי employeeId / exitTime:null / isDeleted ממש כמו השאילתה האמיתית, ורושם כל קריאה.
function mockPrisma(rows) {
  const calls = [];
  return {
    calls,
    shift: {
      findMany: async (args) => {
        calls.push(args);
        const w = args.where || {};
        return rows.filter((r) =>
          (w.employeeId === undefined || r.employeeId === w.employeeId) &&
          (w.exitTime !== null || r.exitTime === null) &&
          (w.isDeleted === undefined || r.isDeleted === w.isDeleted)
        );
      },
      // כל מתודת כתיבה / findFirst אסורה בנתיב הזה
      findFirst: async () => { throw new Error('findFirst must not be used'); },
      update: async () => { throw new Error('write attempted'); },
      create: async () => { throw new Error('write attempted'); },
      delete: async () => { throw new Error('write attempted'); },
    },
  };
}
const sh = (id, entry, extra = {}) => ({ id, employeeId: 'e1', entryTime: entry ? new Date(entry) : null, exitTime: null, isDeleted: false, ...extra });

await t('אין משמרות פתוחות -> null', async () => {
  assert.equal(await findLatestOpenShift(mockPrisma([]), 'e1'), null);
  assert.equal(pickLatestOpenShift([]), null);
  assert.equal(pickLatestOpenShift(null), null);
});
await t('משמרת פתוחה אחת -> היא', async () => {
  const a = sh('a', '2026-10-01T05:00:00Z');
  assert.equal((await findLatestOpenShift(mockPrisma([a]), 'e1')).id, 'a');
});
await t('כמה פתוחות -> העדכנית לפי entryTime, בלי תלות ב-id או בסדר המערך', async () => {
  const old1 = sh('zzz', '2022-11-01T07:00:00Z'); // id "גבוה" אך ישנה - זה בדיוק הבאג
  const old2 = sh('yyy', '2022-11-20T07:00:00Z');
  const today = sh('aaa', '2026-10-01T05:00:00Z');
  for (const order of [[old1, old2, today], [today, old1, old2], [old2, today, old1]]) {
    assert.equal((await findLatestOpenShift(mockPrisma(order), 'e1')).id, 'aaa');
  }
});
await t('משמרת שנסגרה (exitTime) לעולם לא מוחזרת, גם אם היא העדכנית', async () => {
  const closedToday = sh('c', '2026-10-01T05:00:00Z', { exitTime: new Date('2026-10-01T13:00:00Z') });
  const oldOpen = sh('o', '2022-11-01T07:00:00Z');
  const p = mockPrisma([closedToday, oldOpen]);
  assert.equal((await findLatestOpenShift(p, 'e1')).id, 'o');
  assert.equal(await findLatestOpenShift(mockPrisma([closedToday]), 'e1'), null);
  assert.deepEqual(p.calls[0].where, { employeeId: 'e1', exitTime: null, isDeleted: false });
});
await t('שוויון באותה שעת כניסה -> דטרמיניסטי (id גדול יותר), בכל סדר קלט', async () => {
  const x = sh('m1', '2026-10-01T05:00:00Z');
  const y = sh('m2', '2026-10-01T05:00:00Z');
  assert.equal(pickLatestOpenShift([x, y]).id, 'm2');
  assert.equal(pickLatestOpenShift([y, x]).id, 'm2');
});
await t('משמרת בלי שעת כניסה נבחרת רק אם אין אחרת', async () => {
  const noEntry = sh('n', null);
  const old = sh('o', '2022-11-01T07:00:00Z');
  assert.equal(pickLatestOpenShift([noEntry, old]).id, 'o');
  assert.equal(pickLatestOpenShift([old, noEntry]).id, 'o');
  assert.equal(pickLatestOpenShift([noEntry]).id, 'n');
});
await t('משמרת פתוחה שנמחקה (isDeleted) או של עובד אחר אינה מוחזרת', async () => {
  const deleted = sh('d', '2026-10-01T05:00:00Z', { isDeleted: true });
  const other = sh('x', '2026-10-01T06:00:00Z', { employeeId: 'e2' });
  const mine = sh('m', '2022-11-01T07:00:00Z');
  assert.equal((await findLatestOpenShift(mockPrisma([deleted, other, mine]), 'e1')).id, 'm');
});
await t('entryTime כמחרוזת ISO וכ-Date מעורבבים נבחרים נכון; הקלט לא משתנה', async () => {
  const a = { id: 'a', entryTime: '2026-10-01T05:00:00.000Z', exitTime: null };
  const b = { id: 'b', entryTime: new Date('2026-09-30T05:00:00Z'), exitTime: null };
  const input = [b, a];
  assert.equal(pickLatestOpenShift(input).id, 'a');
  assert.deepEqual(input.map((s) => s.id), ['b', 'a']);
});
await t('המשמרת המוחזרת היא אובייקט השורה המקורי (צורת התשובה של /api/me לא משתנה)', async () => {
  const a = sh('a', '2026-10-01T05:00:00Z', { hebrewDate: 'כ״ט אלול', totalMinutes: null });
  assert.equal(await findLatestOpenShift(mockPrisma([a]), 'e1'), a);
});

console.log(`\n${passed} passed`);
