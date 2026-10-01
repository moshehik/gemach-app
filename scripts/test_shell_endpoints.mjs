// בדיקת יחידה ללוגיקה של ה-endpoints של המעטפת החדשה (PR 2.A):
//   * POST /api/notifications/read|archive עם { all: true }  → lib/notificationLists.js + lib/notificationsBulk.js
//   * POST /api/me/ui-variant/shell ("האתר הישן", legacy בלבד) → buildLegacyShellOverride ב-lib/designPrefsSchema.js
// לא נוגעת ב-DB (לקוח prisma מזויף) ולא ב-Next. הרצה: node scripts/test_shell_endpoints.mjs (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  parseIdList, addIdToList, removeIdFromList, planIdListUpdates, parseNotificationActionBody, NOTIFICATIONS_LIST_WINDOW,
} from '../lib/notificationLists.js';
import { markAllNotificationsRead, archiveAllNotifications, BULK_MAX_ATTEMPTS, BULK_CONCURRENCY } from '../lib/notificationsBulk.js';
import { buildLegacyShellOverride, mergeDesignPrefs, parseStoredDesignPrefs, SHELL_OVERRIDE_ALLOWED_VALUES } from '../lib/designPrefsSchema.js';
import { resolveUiVariant } from '../lib/uiVariant.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
async function ta(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const ME = 'emp-me';
const OTHER = 'emp-other';

console.log('notificationLists — רשימות מזהים (readBy / archivedBy)');
t('addIdToList: מוסיף פעם אחת; לא משנה כשהמזהה כבר שם; חסין ל-JSON שבור / ריק', () => {
  assert.deepEqual(addIdToList('[]', ME), { changed: true, next: JSON.stringify([ME]) });
  assert.deepEqual(addIdToList(JSON.stringify([OTHER]), ME), { changed: true, next: JSON.stringify([OTHER, ME]) });
  assert.deepEqual(addIdToList(JSON.stringify([OTHER, ME]), ME), { changed: false, next: JSON.stringify([OTHER, ME]) });
  for (const bad of [null, undefined, '', 'not json', '{"a":1}']) assert.deepEqual(addIdToList(bad, ME), { changed: true, next: JSON.stringify([ME]) }, String(bad));
  assert.deepEqual(parseIdList(addIdToList('[]', ME).next), [ME]);
});
t('removeIdFromList: מסיר רק אותי; לא משנה כשלא הייתי שם', () => {
  assert.deepEqual(removeIdFromList(JSON.stringify([OTHER, ME]), ME), { changed: true, next: JSON.stringify([OTHER]) });
  assert.deepEqual(removeIdFromList(JSON.stringify([OTHER]), ME), { changed: false, next: JSON.stringify([OTHER]) });
  assert.deepEqual(removeIdFromList('[]', ME), { changed: false, next: '[]' });
});
t('planIdListUpdates: רק שורות שצריכות שינוי, עם הערך שנקרא (from) ל-CAS; זבל נזרק', () => {
  const rows = [
    { id: 'n1', readBy: '[]' },
    { id: 'n2', readBy: JSON.stringify([ME]) },
    { id: 'n3', readBy: JSON.stringify([OTHER]) },
    null, 5, { readBy: '[]' }, { id: 7, readBy: '[]' },
  ];
  assert.deepEqual(planIdListUpdates(rows, ME, 'readBy', true), [
    { id: 'n1', from: '[]', to: JSON.stringify([ME]) },
    { id: 'n3', from: JSON.stringify([OTHER]), to: JSON.stringify([OTHER, ME]) },
  ]);
  assert.deepEqual(planIdListUpdates(rows, ME, 'readBy', false), [{ id: 'n2', from: JSON.stringify([ME]), to: '[]' }]);
  assert.deepEqual(planIdListUpdates(null, ME, 'readBy', true), []); assert.deepEqual(planIdListUpdates(rows, '', 'readBy', true), []);
});
t('parseNotificationActionBody: { notificationId } כמו קודם, { all: true } חדש, שאר הצורות = 400', () => {
  assert.deepEqual(parseNotificationActionBody({ notificationId: 'abc' }), { mode: 'one', notificationId: 'abc' });
  assert.deepEqual(parseNotificationActionBody({ notificationId: 'abc', archive: true }), { mode: 'one', notificationId: 'abc' });
  assert.deepEqual(parseNotificationActionBody({ all: true }), { mode: 'all' });
  assert.deepEqual(parseNotificationActionBody({ all: true, archive: false }), { mode: 'all' });
  // כמו הבדיקה המקורית `if (!notificationId)`: ערך falsy = חסר
  for (const bad of [{}, { notificationId: '' }, { notificationId: null }, { notificationId: 0 }, null, undefined, 'x', [], { archive: true }]) {
    assert.equal(parseNotificationActionBody(bad).error, 'notificationId is required', JSON.stringify(bad));
  }
  // all חייב להיות בדיוק true (לא 'true', לא 1)
  for (const bad of ['true', 1, 'yes', false, null]) assert.match(parseNotificationActionBody({ all: bad }).error, /exactly true/, String(bad));
  // שניהם יחד = דו-משמעי
  assert.match(parseNotificationActionBody({ all: true, notificationId: 'abc' }).error, /not both/);
  assert.equal(NOTIFICATIONS_LIST_WINDOW, 150, 'אותו חלון כמו GET /api/notifications (take: 150)');
});

// --- לקוח prisma מזויף: רק notification.findMany / updateMany, רושם כל קריאה -----------------------------
function fakePrisma(rows, { conflictOnce = [] } = {}) {
  const state = { rows: rows.map((r) => ({ ...r })), calls: [], conflicts: new Set(conflictOnce) };
  const used = new Set();
  const forbid = (name) => () => { used.add(name); throw new Error(`${name} must not be used by the bulk path`); };
  state.prisma = {
    notification: {
      async findMany({ where, select, take, orderBy }) {
        state.calls.push({ op: 'findMany', where, select, take, orderBy });
        let list = state.rows;
        if (where && where.receiverId === null) list = list.filter((r) => r.receiverId === null);
        if (where && where.id && Array.isArray(where.id.in)) list = list.filter((r) => where.id.in.includes(r.id));
        if (orderBy && orderBy.createdAt === 'desc') list = [...list].sort((a, b) => b.createdAt - a.createdAt);
        if (typeof take === 'number') list = list.slice(0, take);
        return list.map((r) => Object.fromEntries(Object.keys(select).map((k) => [k, r[k]])));
      },
      async updateMany({ where, data }) {
        state.calls.push({ op: 'updateMany', where, data });
        let count = 0;
        for (const r of state.rows) {
          let match = true;
          for (const [k, v] of Object.entries(where)) if (r[k] !== v) match = false;
          if (!match) continue;
          // דימוי מרוץ: שורה ברשימת conflictOnce "משתנה" ע"י עובד אחר רגע לפני הכתיבה הראשונה
          if (where.id && state.conflicts.has(where.id)) {
            state.conflicts.delete(where.id);
            const field = Object.keys(data)[0];
            r[field] = JSON.stringify([...parseIdList(r[field]), OTHER]);
            continue; // where.readBy כבר לא תואם → count 0
          }
          Object.assign(r, data); count++;
        }
        return { count };
      },
      update: forbid('update'), delete: forbid('delete'), deleteMany: forbid('deleteMany'), create: forbid('create'),
    },
    $transaction: forbid('$transaction'),
    auditLog: { create: forbid('auditLog.create') },
  };
  state.used = used;
  return state;
}
const row = (id, over) => ({ id, receiverId: null, createdAt: 100, isRead: false, isArchived: false, readBy: '[]', archivedBy: '[]', ...over });

console.log('notificationsBulk — "סמן הכל כנקרא"');
await ta('אישיות: updateMany אחד לשלי שלא נקראו; כלליות: רק שורות בלי המזהה שלי, ב-CAS; של אחרים לא נוגעים', async () => {
  const s = fakePrisma([
    row('p1', { receiverId: ME }), row('p2', { receiverId: ME, isRead: true }), row('p3', { receiverId: OTHER }),
    row('g1'), row('g2', { readBy: JSON.stringify([ME]) }), row('g3', { readBy: JSON.stringify([OTHER]) }),
  ]);
  const r = await markAllNotificationsRead(s.prisma, ME);
  assert.deepEqual(r, { personal: 1, global: 2, conflicts: 0 });
  const byId = Object.fromEntries(s.rows.map((x) => [x.id, x]));
  assert.equal(byId.p1.isRead, true); assert.equal(byId.p2.isRead, true); assert.equal(byId.p3.isRead, false, 'של עובד אחר לא נוגעים');
  assert.deepEqual(parseIdList(byId.g1.readBy), [ME]); assert.deepEqual(parseIdList(byId.g2.readBy), [ME]); assert.deepEqual(parseIdList(byId.g3.readBy), [OTHER, ME]);
  assert.equal(byId.g1.isRead, false, 'בכלליות לא נוגעים ב-isRead');
  // הקריאה הראשונה: updateMany על האישיות עם where מדויק
  assert.deepEqual(s.calls[0], { op: 'updateMany', where: { receiverId: ME, isRead: false }, data: { isRead: true } });
  // הקריאה השנייה: findMany על הכלליות בחלון של ה-GET
  assert.deepEqual(s.calls[1].where, { receiverId: null }); assert.equal(s.calls[1].take, NOTIFICATIONS_LIST_WINDOW);
  assert.deepEqual(s.calls[1].select, { id: true, readBy: true }); assert.deepEqual(s.calls[1].orderBy, { createdAt: 'desc' });
  // כתיבות ה-CAS: where כולל את הערך שנקרא
  const writes = s.calls.filter((c) => c.op === 'updateMany' && c.where.id);
  assert.deepEqual(writes.map((w) => w.where), [{ id: 'g1', readBy: '[]' }, { id: 'g3', readBy: JSON.stringify([OTHER]) }]);
  assert.equal(s.used.size, 0, 'בלי update/delete/$transaction/auditLog');
});
await ta('מרוץ: שורה שהשתנתה בינתיים נקראת מחדש ונכתבת שוב (לא דורסת את הסימון של העובד האחר)', async () => {
  const s = fakePrisma([row('g1'), row('g2')], { conflictOnce: ['g1'] });
  const r = await markAllNotificationsRead(s.prisma, ME);
  assert.deepEqual(r, { personal: 0, global: 2, conflicts: 0 });
  const g1 = s.rows.find((x) => x.id === 'g1');
  assert.deepEqual(parseIdList(g1.readBy), [OTHER, ME], 'גם האחר וגם אני');
  const refetch = s.calls.filter((c) => c.op === 'findMany' && c.where.id);
  assert.equal(refetch.length, 1); assert.deepEqual(refetch[0].where, { id: { in: ['g1'] }, receiverId: null });
});
await ta('מרוץ מתמשך: אחרי BULK_MAX_ATTEMPTS מוותרים ומדווחים conflicts, בלי לזרוק ובלי לדרוס', async () => {
  const s = fakePrisma([row('g1')]);
  // כל כתיבה נכשלת: מישהו "משנה" את השורה לפני כל ניסיון
  const origUpdateMany = s.prisma.notification.updateMany;
  s.prisma.notification.updateMany = async (args) => {
    if (args.where.id) { s.conflicts.add(args.where.id); }
    return origUpdateMany(args);
  };
  const r = await markAllNotificationsRead(s.prisma, ME);
  assert.deepEqual(r, { personal: 0, global: 0, conflicts: 1 });
  const writes = s.calls.filter((c) => c.op === 'updateMany' && c.where.id);
  assert.equal(writes.length, BULK_MAX_ATTEMPTS);
  assert.ok(!parseIdList(s.rows[0].readBy).includes(ME));
});
await ta('הכתיבות רצות במנות (BULK_CONCURRENCY) ולא כולן בבת אחת', async () => {
  const n = BULK_CONCURRENCY * 2 + 3;
  const s = fakePrisma(Array.from({ length: n }, (_, i) => row(`g${i}`, { createdAt: i })));
  let inFlight = 0; let maxInFlight = 0;
  const orig = s.prisma.notification.updateMany;
  s.prisma.notification.updateMany = async (args) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((res) => setTimeout(res, 1));
    try { return await orig(args); } finally { inFlight--; }
  };
  const r = await markAllNotificationsRead(s.prisma, ME);
  assert.equal(r.global, n); assert.ok(maxInFlight <= BULK_CONCURRENCY, `max in flight ${maxInFlight}`); assert.ok(maxInFlight > 1, 'כן במקביל');
});
await ta('חלון: רק NOTIFICATIONS_LIST_WINDOW הכלליות החדשות ביותר (כמו הפעמון); ישנות יותר לא נוגעים', async () => {
  const n = NOTIFICATIONS_LIST_WINDOW + 5;
  const s = fakePrisma(Array.from({ length: n }, (_, i) => row(`g${i}`, { createdAt: i })));
  const r = await markAllNotificationsRead(s.prisma, ME);
  assert.equal(r.global, NOTIFICATIONS_LIST_WINDOW);
  for (let i = 0; i < 5; i++) assert.ok(!parseIdList(s.rows[i].readBy).includes(ME), `g${i} הישנה נשארת`);
  assert.ok(parseIdList(s.rows[n - 1].readBy).includes(ME));
});
await ta('בלי employeeId → זורק (לא נוגע ב-DB)', async () => {
  const s = fakePrisma([row('g1')]);
  await assert.rejects(() => markAllNotificationsRead(s.prisma, ''), /employeeId/);
  await assert.rejects(() => archiveAllNotifications(s.prisma, null, true), /employeeId/);
  assert.equal(s.calls.length, 0);
});

console.log('notificationsBulk — "ניקוי" = ארכיון (לא מחיקה)');
await ta('ארכיון: אישיות isArchived=true, כלליות archivedBy += אני; שום שורה לא נמחקת; readBy לא נוגעים', async () => {
  const s = fakePrisma([
    row('p1', { receiverId: ME }), row('p2', { receiverId: ME, isArchived: true }), row('p3', { receiverId: OTHER }),
    row('g1'), row('g2', { archivedBy: JSON.stringify([ME]) }), row('g3', { archivedBy: JSON.stringify([OTHER]), readBy: JSON.stringify([OTHER]) }),
  ]);
  const before = s.rows.length;
  const r = await archiveAllNotifications(s.prisma, ME, true);
  assert.deepEqual(r, { personal: 1, global: 2, conflicts: 0 });
  assert.equal(s.rows.length, before, 'ארכיון = לא מחיקה');
  const byId = Object.fromEntries(s.rows.map((x) => [x.id, x]));
  assert.equal(byId.p1.isArchived, true); assert.equal(byId.p3.isArchived, false);
  assert.deepEqual(parseIdList(byId.g1.archivedBy), [ME]); assert.deepEqual(parseIdList(byId.g3.archivedBy), [OTHER, ME]);
  assert.deepEqual(parseIdList(byId.g3.readBy), [OTHER], 'readBy לא השתנה');
  assert.deepEqual(s.calls[0], { op: 'updateMany', where: { receiverId: ME, isArchived: false }, data: { isArchived: true } });
  assert.deepEqual(s.calls[1].select, { id: true, archivedBy: true });
  assert.equal(s.used.size, 0);
});
await ta('archive=false: מחזיר הכל מהארכיון (אישיות isArchived=false, כלליות archivedBy -= אני); ברירת מחדל = ארכיון', async () => {
  const s = fakePrisma([row('p1', { receiverId: ME, isArchived: true }), row('g1', { archivedBy: JSON.stringify([OTHER, ME]) }), row('g2')]);
  const r = await archiveAllNotifications(s.prisma, ME, false);
  assert.deepEqual(r, { personal: 1, global: 1, conflicts: 0 });
  assert.equal(s.rows[0].isArchived, false); assert.deepEqual(parseIdList(s.rows[1].archivedBy), [OTHER]); assert.equal(s.rows[2].archivedBy, '[]');
  const d = fakePrisma([row('p1', { receiverId: ME })]);
  await archiveAllNotifications(d.prisma, ME); // בלי פרמטר
  assert.equal(d.rows[0].isArchived, true);
});

console.log('buildLegacyShellOverride — "האתר הישן" (POST /api/me/ui-variant/shell)');
t('מותר רק legacy או null; a5 וכל השאר נדחים עם הודעה בעברית', () => {
  assert.deepEqual([...SHELL_OVERRIDE_ALLOWED_VALUES], ['legacy', null]);
  for (const bad of ['a5', 'A5', 'LEGACY', ' legacy', 'legacy ', '', undefined, 0, false, true, {}, ['legacy'], { shell: 'legacy' }]) {
    const r = buildLegacyShellOverride('{"v":1}', bad);
    assert.equal(r.ok, false, JSON.stringify(bad)); assert.match(r.error, /legacy/); assert.match(r.error, /[א-ת]/, 'עברית');
    assert.equal(r.serialized, undefined);
  }
});
t("value='legacy': כותב uiVariants.shell='legacy', שומר את שאר ההעדפות ואת שאר המסכים", () => {
  const stored = JSON.stringify({ v: 1, palette: 'wine', mode: 'dark', savedPalettes: [{ id: 'p1', name: 'x', primary: '#112233', accent: '#445566' }], uiVariants: { shell: 'a5', home: 'a5' } });
  const r = buildLegacyShellOverride(stored, 'legacy');
  assert.equal(r.ok, true); assert.equal(r.previous, 'a5'); assert.equal(r.changed, true);
  assert.deepEqual(JSON.parse(r.serialized), {
    v: 1, palette: 'wine', mode: 'dark', savedPalettes: [{ id: 'p1', name: 'x', primary: '#112233', accent: '#445566', neutral: '' }], uiVariants: { shell: 'legacy', home: 'a5' },
  });
  // התוצאה אכן מכריעה את המעטפת ל-legacy גם כשהארגון על a5; דף הבית נשאר a5
  const uv = JSON.parse(r.serialized).uiVariants;
  assert.equal(resolveUiVariant('shell', { settings: { ui_variant_shell: 'a5' }, userVariants: uv }), 'legacy');
  assert.equal(resolveUiVariant('home', { settings: { ui_variant_home: 'legacy' }, userVariants: uv }), 'a5');
  // אותו דבר דרך parseStoredDesignPrefs (מה ש-GET /api/me/design-prefs מחזיר)
  assert.deepEqual(parseStoredDesignPrefs(r.serialized).uiVariants, { shell: 'legacy', home: 'a5' });
});
t('value=null: מסיר רק את shell; כש-uiVariants מתרוקן המפתח נעלם לגמרי', () => {
  const a = buildLegacyShellOverride(JSON.stringify({ v: 1, palette: 'wine', uiVariants: { shell: 'legacy', home: 'a5' } }), null);
  assert.equal(a.ok, true); assert.equal(a.previous, 'legacy'); assert.equal(a.changed, true);
  assert.deepEqual(JSON.parse(a.serialized), { v: 1, palette: 'wine', uiVariants: { home: 'a5' } });
  const b = buildLegacyShellOverride(JSON.stringify({ v: 1, palette: 'wine', uiVariants: { shell: 'a5' } }), null);
  assert.deepEqual(JSON.parse(b.serialized), { v: 1, palette: 'wine' });
  assert.ok(!('uiVariants' in b.next));
});
t('ללא שינוי בפועל (changed=false): כבר legacy, או null כשאין עקיפה — ה-route מדלג על הכתיבה', () => {
  const a = buildLegacyShellOverride(JSON.stringify({ v: 1, uiVariants: { shell: 'legacy' } }), 'legacy');
  assert.equal(a.changed, false); assert.equal(a.previous, 'legacy');
  const b = buildLegacyShellOverride(JSON.stringify({ v: 1, palette: 'wine' }), null);
  assert.equal(b.changed, false); assert.equal(b.previous, null); assert.deepEqual(JSON.parse(b.serialized), { v: 1, palette: 'wine' });
  const c = buildLegacyShellOverride(null, null);
  assert.equal(c.changed, false); assert.deepEqual(JSON.parse(c.serialized), { v: 1 });
});
t('עמודה ריקה / ערך legacy ישן ("standard") / JSON שבור: מתחילים מאפס', () => {
  for (const raw of [null, undefined, '', 'standard', 'dark', 'not json', '{"v":2,"palette":"wine"}']) {
    const r = buildLegacyShellOverride(raw, 'legacy');
    assert.equal(r.ok, true, String(raw)); assert.equal(r.previous, null);
    assert.deepEqual(JSON.parse(r.serialized), { v: 1, uiVariants: { shell: 'legacy' } }, String(raw));
  }
});
t('ההגנה של PUT /api/me/design-prefs לא נפגעת: mergeDesignPrefs עדיין מקבל uiVariants רק כשמעבירים לו — ה-route מוחק את המפתח לפני', () => {
  // (ה-route עצמו לא נטען כאן — הוא תלוי ב-Next; זו בדיקת הסכמה שהוא נשען עליה)
  const existing = parseStoredDesignPrefs(JSON.stringify({ v: 1, uiVariants: { shell: 'legacy' } }));
  const safeBody = { mode: 'dark', uiVariants: { shell: 'a5' } }; delete safeBody.uiVariants; // כמו route.js:74-75
  assert.deepEqual(mergeDesignPrefs(existing, safeBody), { v: 1, uiVariants: { shell: 'legacy' }, mode: 'dark' });
  // ובלי המחיקה — זה מה שהיה קורה (ולכן המחיקה שם חובה; הנתיב החדש הוא היוצא מן הכלל, legacy בלבד)
  assert.deepEqual(mergeDesignPrefs(existing, { uiVariants: { shell: 'a5' } }).uiVariants, { shell: 'a5' });
  assert.equal(buildLegacyShellOverride(JSON.stringify({ v: 1 }), 'a5').ok, false);
});
t('גודל: התוצאה נשארת JSON קטן (תחת 8192 כמו design-prefs) להעדפות רגילות', () => {
  const big = { v: 1, palette: 'custom', customColors: { primary: '#112233', accent: '#445566', neutral: '#778899' }, savedPalettes: Array.from({ length: 24 }, (_, i) => ({ id: `p${i}`, name: 'פלטה '.repeat(8), primary: '#112233', accent: '#445566' })) };
  const r = buildLegacyShellOverride(JSON.stringify(big), 'legacy');
  assert.ok(r.serialized.length < 8192, String(r.serialized.length));
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
