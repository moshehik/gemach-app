// "ברגע שפריט נלקח - התיקון נרשם כבוצע (משוער)" (בעלים 2026-10-06): lib/schedule/autoAlterationDone.js מחובר ל-rentals/toggle (rent בלבד) ול-rentals/confirm (גורף), מעל התוסף האמיתי של
// app/lib/prisma.js (שורת AuditLog ALTERATION_DONE עם העובדת, estimated:true) ומסד בזיכרון. בודק: alterationDone=true + המשפט בסוף alterationDetails, טקסט קיים נשמר, אידמפוטנטי (בלי כפילות),
// סימון ידני לא נוגעים, פריט בלי תיקון / מבוטלת / החזרה בלבד - לא נוגעים, כישלון לא מפיל את ההשכרה, מוגבל בזמן, ושימוש בלי $transaction / AuditLog ידני.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJ = process.env.PROJ;
const SHIMS = path.join(PROJ, 'scripts', 'schedule-tests', 'shims');
const fileUrl = (p) => pathToFileURL(p).href;
const hooks = `
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PROJ = ${JSON.stringify(PROJ)};
const NS = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-server.mjs')))};
const NH = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-headers.mjs')))};
const FAKE = ${JSON.stringify(fileUrl(path.join(PROJ, 'scripts', 'order-card-tests', 'actor-fake-client.mjs')))};
async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) { for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} } throw e; }
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return { url: NS, shortCircuit: true };
  if (specifier === 'next/headers') return { url: NH, shortCircuit: true };
  if (specifier === '@prisma/client') return { url: FAKE, shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  return tryResolve(specifier, context, nextResolve);
}
`;
register('data:text/javascript,' + encodeURIComponent(hooks));
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://fake:fake@127.0.0.1:1/fake';

const { test, beforeEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const fs = await import('node:fs');
const L = (rel) => import(fileUrl(path.join(PROJ, rel)));
const toggle = await L('app/api/rentals/toggle/route.js');
const confirm = await L('app/api/rentals/confirm/route.js');
const alt = await L('lib/schedule/autoAlterationDone.js');
const E = await L('lib/alterationEstimate.js');
const autoPrep = await L('lib/schedule/autoPrepMark.js');
const marksMod = await L('lib/schedule/marks.js');
const SC = await L('lib/settingsCache.js');
const afterMod = await L('lib/schedule/afterResponse.js');
const P = await L('app/lib/prisma.js');

const post = (body) => ({ method: 'POST', url: 'http://x/api', headers: new Map(), json: async () => body });
const FUTURE = new Date(Date.now() + 10 * 864e5);
const item = (id, over = {}) => ({ id, orderId: 53375, barcode: null, isTaken: false, takenDate: null, isReturned: false, returnedOk: false, returnDate: null, isDeleted: false, dressItemId: null,
  neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: null, alterationDetails: null, alterationDone: false, order: { orderId: 53375, eventDate: FUTURE, isDeleted: false }, ...over });
const items = () => globalThis.__MOCK_DB.order[0].items;
const byId = (id) => items().find((i) => i.id === id);
const audits = () => globalThis.__MOCK_DB.auditLog;

const SETTING_ON = { key: 'auto_alteration_done_on_take', value: 'true' };
beforeEach(() => {
  SC.invalidateSettingsCache();
  globalThis.__MOCK_AFTER = undefined;
  autoPrep.resetAutoPrepMemo();
  marksMod.resetMarksTableState();
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_BEFORE_WRITE = undefined;
  globalThis.__MOCK_WRITABLE = ['orderItem', 'auditLog', 'dressItem', 'scheduleStageMark'];
  globalThis.__MOCK_DB = {
    order: [{ orderId: 53375, isDeleted: false, orderDate: new Date(), eventDate: FUTURE, isAbroad: false, isDelivery: false, items: [
      item('neck', { neckAlteration: 1 }),
      item('len', { lengthAlteration: '5', alterationDetails: 'לקצר 5 ס״מ' }),
      item('plain'),
      item('manual', { sleeveAlteration: 1, alterationDone: true, alterationDetails: 'סומן ע״י תופרת' }),
      item('gone', { neckAlteration: 1, isDeleted: true }),
    ] }],
    auditLog: [], systemSetting: [{ ...SETTING_ON }], dressItem: [], employee: [], scheduleStageMark: [],
  };
  globalThis.__AUTH_TOKEN = 'emp-rachel';
});

test('לקיחה (rentals/toggle rent): alterationDone=true + המשפט המשוער; בלי טקסט קודם = המשפט לבד; טקסט קיים נשמר והמשפט מתווסף בשורה חדשה; שורת היומן ALTERATION_DONE עם העובדת ו-estimated', async () => {
  assert.equal((await toggle.POST(post({ itemId: 'neck', action: 'rent' }))).status, 200);
  assert.equal(byId('neck').alterationDone, true);
  assert.equal(byId('neck').alterationDetails, E.ESTIMATE_NOTE);
  assert.equal((await toggle.POST(post({ itemId: 'len', action: 'rent' }))).status, 200);
  assert.equal(byId('len').alterationDetails, `לקצר 5 ס״מ\n${E.ESTIMATE_NOTE}`);
  const rows = audits().filter((a) => a.action === 'ALTERATION_DONE');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].employeeId, 'emp-rachel');
  const c = JSON.parse(rows[1].changesJson);
  assert.equal(c.estimated, true);
  assert.deepEqual(c.alterationDone, { from: false, to: true });
  assert.equal(c.alterationDetails.from, 'לקצר 5 ס״מ');
  assert.ok(E.isAlterationEstimated(byId('len')));
  assert.equal(E.alterationDoneLabel(byId('len')), 'בוצע (משוער)');
});

test('אידמפוטנטי: קריאה חוזרת לא יוצרת כפילות של המשפט ולא שורת יומן נוספת; סימון ידני (done=true) לא נוגעים בו ובטקסט שלו', async () => {
  await toggle.POST(post({ itemId: 'neck', action: 'rent' }));
  assert.deepEqual(await alt.autoMarkAlterationForItem('neck'), { status: 'skipped' });
  await alt.autoMarkAlterationForItem('neck');
  assert.equal(byId('neck').alterationDetails.split(E.ESTIMATE_NOTE).length - 1, 1);
  assert.equal(audits().filter((a) => a.action === 'ALTERATION_DONE').length, 1);
  const manual = await toggle.POST(post({ itemId: 'manual', action: 'rent' }));
  assert.equal(manual.status, 200);
  assert.equal(byId('manual').alterationDetails, 'סומן ע״י תופרת', 'סימון של אדם לא נדרס ולא מקבל סמן');
  assert.ok(!E.isAlterationEstimated(byId('manual')));
  assert.equal(audits().filter((a) => a.action === 'ALTERATION_DONE').length, 1);
});

test('לא נוגעים: פריט בלי תיקון, פריט מחוק, הזמנה מבוטלת, החזרה בלבד (action=return), לקיחה שבוטלה', async () => {
  await toggle.POST(post({ itemId: 'plain', action: 'rent' }));
  assert.equal(byId('plain').alterationDone, false);
  assert.equal(byId('plain').alterationDetails, null);
  byId('gone').isTaken = true;
  assert.equal((await alt.autoMarkAlterationForItem('gone')).status, 'skipped');
  assert.equal(byId('gone').alterationDone, false);
  byId('neck').isTaken = true;
  globalThis.__MOCK_DB.order[0].items.forEach((i) => { i.order = { ...i.order, isDeleted: true }; });
  assert.equal((await alt.autoMarkAlterationForItem('neck')).status, 'skipped', 'הזמנה מבוטלת');
  globalThis.__MOCK_DB.order[0].items.forEach((i) => { i.order = { ...i.order, isDeleted: false }; });
  // החזרה בלבד: הפריט לא נלקח במערכת (isTaken=false) ולכן אין רישום; גם toggle return לא קורא ל-autoMarkAlteration
  byId('len').isTaken = false;
  assert.equal((await alt.autoMarkAlterationForItem('len')).status, 'skipped', 'לא נלקח - אין רישום');
  const tsrc = fs.readFileSync(path.join(PROJ, 'app/api/rentals/toggle/route.js'), 'utf8');
  assert.match(tsrc, /if \(action === 'rent'\) afterTasks\.push\(\(\) => autoMarkAlterationForItem\(itemId\)\);/);
  assert.ok(!/autoMarkAlteration/.test(fs.readFileSync(path.join(PROJ, 'app/api/returns/scan/route.js'), 'utf8')), 'returns/scan לא נוגע בתיקונים');
});

test('אישור גורף (rentals/confirm): כל הפריטים שנלקחו עם תיקון ממתין מקבלים בוצע (משוער); האחרים לא', async () => {
  byId('neck').barcode = '4538010';
  byId('len').barcode = '3136010';
  byId('plain').barcode = '2740010';
  const r = await confirm.POST(post({ orderId: 53375 }));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(byId('neck').alterationDone, true);
  assert.equal(byId('len').alterationDone, true);
  assert.ok(E.hasEstimateMarker(byId('len').alterationDetails));
  assert.equal(byId('plain').alterationDone, false);
  assert.equal(byId('manual').alterationDetails, 'סומן ע״י תופרת');
  assert.equal(audits().filter((a) => a.action === 'ALTERATION_DONE').length, 2);
});

test('כישלון בכתיבה לא מפיל את ההשכרה; מוגבל בזמן (bounded)', async () => {
  const origErr = console.error;
  console.error = () => {};
  try {
    globalThis.__MOCK_BEFORE_WRITE = (model, method, args) => { if (model === 'orderItem' && args && args.data && 'alterationDetails' in args.data) throw new Error('boom'); };
    const r = await toggle.POST(post({ itemId: 'neck', action: 'rent' }));
    assert.equal(r.status, 200, 'ההשכרה הצליחה');
    assert.equal(byId('neck').isTaken, true);
    assert.equal(byId('neck').alterationDone, false);
  } finally { console.error = origErr; }
  globalThis.__MOCK_BEFORE_WRITE = undefined;
  assert.equal((await alt.autoMarkAlterationBounded('len', 1500)).status, 'skipped', 'לא נלקח עדיין');
  const src = fs.readFileSync(path.join(PROJ, 'lib/schedule/autoAlterationDone.js'), 'utf8');
  assert.match(src, /Promise\.race\(\[work, limit\]\)/);
  assert.match(src, /AUTO_ALT_TIMEOUT_MS = 1500/);
});

test('כללי הריפו: בלי $transaction ובלי כתיבת AuditLog ידנית; הכתיבה דרך prisma.orderItem.update(auditAs); ללא DDL (שדה קיים alterationDetails)', () => {
  const src = fs.readFileSync(path.join(PROJ, 'lib/schedule/autoAlterationDone.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\$transaction/.test(src));
  assert.ok(!/auditLog\./.test(src));
  assert.match(src, /prisma\.orderItem\.update\(auditAs\('ALTERATION_DONE'/);
  const schema = fs.readFileSync(path.join(PROJ, 'prisma/schema.prisma'), 'utf8');
  assert.match(schema, /alterationDetails String\?/);
  assert.match(schema, /alterationDone\s+Boolean\s+@default\(false\)/);
});

// ================= תיקוני הביקורת (2026-10-06) =================
const settingRows = (value) => (value === undefined ? [] : [{ key: 'auto_alteration_done_on_take', value }]);
const setSetting = (value) => { globalThis.__MOCK_DB.systemSetting = settingRows(value); SC.invalidateSettingsCache(); };

test('שער ההגדרה auto_alteration_done_on_take: רק "true" מפעיל; חסר / false / כל ערך אחר = בלי רישום משוער בלקיחה, באישור הגורף ובכל הפונקציות - הלקיחה עצמה עובדת', async () => {
  for (const value of [undefined, 'false', 'TRUE', '1', '']) {
    setSetting(value);
    byId('neck').isTaken = false; byId('neck').alterationDone = false; byId('neck').alterationDetails = null; byId('neck').barcode = null;
    const r = await toggle.POST(post({ itemId: 'neck', action: 'rent' }));
    assert.equal(r.status, 200);
    assert.equal(byId('neck').isTaken, true, 'הלקיחה עצמה עבדה');
    assert.equal(byId('neck').alterationDone, false, `value=${JSON.stringify(value)}`);
    assert.equal(byId('neck').alterationDetails, null);
    assert.deepEqual(await alt.autoMarkAlterationForItem('neck'), { status: 'disabled' });
    assert.deepEqual(await alt.autoMarkAlterationsForItems(['neck', 'len']), { status: 'disabled', count: 0 });
    byId('len').barcode = '3136010';
    assert.equal((await confirm.POST(post({ orderId: 53375 }))).status, 200);
    assert.equal(byId('len').isTaken, true);
    assert.equal(byId('len').alterationDone, false);
    byId('len').isTaken = false; byId('len').barcode = null;
  }
  assert.equal(audits().filter((a) => a.action === 'ALTERATION_DONE').length, 0);
  setSetting('true');
  byId('neck').isTaken = false;
  assert.equal((await toggle.POST(post({ itemId: 'neck', action: 'rent' }))).status, 200);
  assert.equal(byId('neck').alterationDone, true, 'true מפעיל');
  assert.match(fs.readFileSync(path.join(PROJ, 'lib/schedule/autoAlterationDone.js'), 'utf8'), /\(await getCachedSettingValue\(AUTO_ALT_SETTING_KEY, null\)\) === 'true'/);
});

test('ביטול השכרה (undoRent): תיקון משוער חוזר ל"לא בוצע" והסמן יורד (טקסט אדם נשמר, ריק -> null); סימון של אדם לא נוגעים; בשורת היומן estimated', async () => {
  await toggle.POST(post({ itemId: 'len', action: 'rent' }));
  await toggle.POST(post({ itemId: 'neck', action: 'rent' }));
  assert.ok(E.isAlterationEstimated(byId('len')) && E.isAlterationEstimated(byId('neck')));
  assert.equal((await toggle.POST(post({ itemId: 'len', action: 'undoRent' }))).status, 200);
  assert.equal(byId('len').isTaken, false);
  assert.equal(byId('len').alterationDone, false);
  assert.equal(byId('len').alterationDetails, 'לקצר 5 ס״מ', 'הטקסט של האדם נשמר');
  assert.equal((await toggle.POST(post({ itemId: 'neck', action: 'undoRent' }))).status, 200);
  assert.equal(byId('neck').alterationDone, false);
  assert.equal(byId('neck').alterationDetails, null, 'היה רק המשפט -> null');
  const cancel = audits().filter((a) => a.action === 'CANCEL_RENTAL');
  assert.equal(cancel.length, 2);
  const c = JSON.parse(cancel[0].changesJson);
  assert.deepEqual(c.alterationDone, { from: true, to: false });
  assert.deepEqual(c.estimated, { from: true, to: false });
  // סימון של אדם (בלי הסמן): ביטול השכרה לא מבטל אותו
  byId('manual').isTaken = true;
  assert.equal((await toggle.POST(post({ itemId: 'manual', action: 'undoRent' }))).status, 200);
  assert.equal(byId('manual').isTaken, false);
  assert.equal(byId('manual').alterationDone, true);
  assert.equal(byId('manual').alterationDetails, 'סומן ע״י תופרת');
  const cm = JSON.parse(audits().filter((a) => a.action === 'CANCEL_RENTAL')[2].changesJson);
  assert.ok(!('alterationDone' in cm) && !('estimated' in cm));
  // סמן בלי done (טקסט שנשאר) - לא נוגעים
  byId('plain').isTaken = true; byId('plain').alterationDetails = E.ESTIMATE_NOTE;
  await toggle.POST(post({ itemId: 'plain', action: 'undoRent' }));
  assert.equal(byId('plain').alterationDetails, E.ESTIMATE_NOTE);
});

test('אישור גורף: רק הפריטים שאושרו בפועל (לא פריט שנלקח קודם והתיקון שלו ממתין), שאילתה אחת עם select - בלי findUnique לכל פריט', async () => {
  byId('neck').barcode = '4538010';
  byId('len').barcode = '3136010';
  // נלקח קודם (למשל כשההגדרה הייתה כבויה) - לא חלק מהאישור הגורף הזה
  globalThis.__MOCK_DB.order[0].items.push(item('earlier', { sleeveAlteration: 1, isTaken: true, takenDate: new Date() }));
  globalThis.__MOCK_CALLS = [];
  const r = await confirm.POST(post({ orderId: 53375 }));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(byId('neck').alterationDone, true);
  assert.equal(byId('len').alterationDone, true);
  assert.equal(byId('earlier').alterationDone, false, 'לא אושר עכשיו - לא נוגעים');
  const itemReads = globalThis.__MOCK_CALLS.filter((c) => c.model === 'orderItem' && (c.method === 'findUnique' || c.method === 'findMany'));
  assert.equal(itemReads.filter((c) => c.method === 'findUnique').length, 0, 'בלי findUnique לכל פריט');
  const bulk = itemReads.filter((c) => c.method === 'findMany' && c.args && c.args.where && c.args.where.id);
  assert.equal(bulk.length, 1, 'שאילתה אחת לכל הפריטים');
  assert.deepEqual([...bulk[0].args.where.id.in].sort(), ['len', 'neck']);
  assert.ok(bulk[0].args.select && bulk[0].args.select.alterationDetails && bulk[0].args.select.order, 'select עם מה שצריך');
  assert.deepEqual(await alt.autoMarkAlterationsForItems([]), { status: 'skipped', count: 0 });
});

test('כתיבה מותנית (where alterationDone:false): סימון שנעשה בין הקריאה לכתיבה לא נדרס ולא יוצר שורת יומן כפולה (P2025 = דילוג שקט, בלי console.error)', async () => {
  await toggle.POST(post({ itemId: 'neck', action: 'rent' }));
  const upd = globalThis.__MOCK_CALLS.find((c) => c.model === 'orderItem' && c.method === 'update' && c.args && c.args.data && 'alterationDetails' in c.args.data);
  assert.deepEqual(upd.args.where, { id: 'neck', alterationDone: false });
  // מרוץ: אדם מסמן "בוצע" אחרי שהאוטומציה קראה את הפריט ולפני שכתבה
  byId('len').isTaken = true;
  const origErr = console.error; let errs = 0; console.error = () => { errs++; };
  try {
    globalThis.__MOCK_BEFORE_WRITE = (model, method, args) => { if (model === 'orderItem' && args.data && 'alterationDetails' in args.data) { byId('len').alterationDone = true; byId('len').alterationDetails = 'אדם סימן'; } };
    assert.deepEqual(await alt.autoMarkAlterationForItem('len'), { status: 'skipped' });
  } finally { console.error = origErr; globalThis.__MOCK_BEFORE_WRITE = undefined; }
  assert.equal(errs, 0);
  assert.equal(byId('len').alterationDetails, 'אדם סימן');
  assert.equal(audits().filter((a) => a.action === 'ALTERATION_DONE').length, 1, 'רק של neck');
});

test('אמינות (after): הרישום המשוער והכנה רצים אחרי התשובה (לא לפניה), הכתיבה על שם העובדת גם כש-cookies() כבר לא זמין, ושגיאה לא מפילה את התשובה', async () => {
  const queued = [];
  globalThis.__MOCK_AFTER = (fn) => { queued.push(fn); };
  const r = await toggle.POST(post({ itemId: 'neck', action: 'rent' }));
  assert.equal(r.status, 200);
  assert.equal(byId('neck').isTaken, true);
  assert.equal(byId('neck').alterationDone, false, 'עדיין לא - זה רץ אחרי התשובה');
  assert.equal(queued.length, 1, 'כל העבודה (הכנה + תיקון) ב-after אחד');
  globalThis.__AUTH_TOKEN = undefined; // כמו after() בראוט: אין גישה ל-cookies
  await queued[0]();
  assert.equal(byId('neck').alterationDone, true);
  const row = audits().find((a) => a.action === 'ALTERATION_DONE');
  assert.equal(row.employeeId, 'emp-rachel', 'העובדת נקראה לפני ה-await הראשון ועברה ל-after');
  // אישור גורף: אותו מסלול
  byId('len').barcode = '3136010';
  globalThis.__AUTH_TOKEN = 'emp-rachel';
  await confirm.POST(post({ orderId: 53375 }));
  assert.equal(queued.length, 2);
  assert.equal(byId('len').alterationDone, false);
  globalThis.__AUTH_TOKEN = undefined;
  await queued[1]();
  assert.equal(byId('len').alterationDone, true);
  assert.equal(audits().filter((a) => a.action === 'ALTERATION_DONE')[1].employeeId, 'emp-rachel');
  // after שזורק (מחוץ להקשר בקשה) -> ריצה מקומית
  globalThis.__MOCK_AFTER = () => { throw new Error('outside request scope'); };
  globalThis.__AUTH_TOKEN = 'emp-rachel';
  byId('neck').isTaken = false; byId('neck').alterationDone = false; byId('neck').alterationDetails = null;
  assert.equal((await toggle.POST(post({ itemId: 'neck', action: 'rent' }))).status, 200);
  assert.equal(byId('neck').alterationDone, true, 'נפילה לריצה מקומית');
});

test('runAfterResponse: after מוזרק = ריצה מאוחרת בעובד שהועבר, משימות במקביל, כשל במשימה לא זורק; בלי after / after זורק = ריצה מקומית מוגבלת בזמן; בלי משימות = none', async () => {
  const ran = [];
  let captured;
  const res = await afterMod.runAfterResponse([async () => { ran.push('a'); }], { actorId: 'emp-x', afterFn: (fn) => { captured = fn; } });
  assert.equal(res.mode, 'after');
  assert.deepEqual(ran, [], 'לא רץ לפני ה-callback');
  globalThis.__AUTH_TOKEN = undefined;
  let seen;
  let pending;
  await afterMod.runAfterResponse([async () => { seen = await P.getActingEmployeeId(); }], { actorId: 'emp-x', afterFn: (fn) => { pending = fn(); } });
  await pending;
  assert.equal(seen, 'emp-x', 'getActingEmployeeId מכבד את העובד שהועבר');
  assert.equal(await P.getActingEmployeeId(), null, 'ומחוץ ל-runAsActor חוזר לעוגייה');
  await captured();
  assert.deepEqual(ran, ['a']);
  // מקביל
  const t0 = Date.now();
  await afterMod.runAfterResponse([() => new Promise((r) => setTimeout(r, 60)), () => new Promise((r) => setTimeout(r, 60))], { actorId: null, afterFn: null });
  assert.ok(Date.now() - t0 < 110, `משימות במקביל (${Date.now() - t0}ms)`);
  // כשל לא זורק
  const failing = await afterMod.runAfterResponse([async () => { throw new Error('x'); }, () => { throw new Error('sync'); }, async () => { ran.push('ok'); }], { afterFn: null });
  assert.equal(failing.mode, 'inline');
  assert.ok(ran.includes('ok'));
  // after זורק -> inline
  const thrown = await afterMod.runAfterResponse([async () => { ran.push('inline'); }], { afterFn: () => { throw new Error('outside'); } });
  assert.equal(thrown.mode, 'inline');
  assert.ok(ran.includes('inline'));
  // תקרת זמן בריצה מקומית
  const slow = await afterMod.runAfterResponse([() => new Promise(() => {})], { afterFn: null, timeoutMs: 30 });
  assert.deepEqual(slow, { mode: 'inline', timedOut: true });
  assert.deepEqual(await afterMod.runAfterResponse([], {}), { mode: 'none' });
  const src = fs.readFileSync(path.join(PROJ, 'lib/schedule/afterResponse.js'), 'utf8');
  assert.match(src, /import \* as nextServer from 'next\/server'/);
  assert.match(src, /afterFn = nextServer\.after/);
});
