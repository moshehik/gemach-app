// בדיקת יחידה לשני יומני הניהול החדשים - היסטוריית נתונים (/admin/data-history, AuditLog) והיסטוריית שאילתות ו-API (/management/history, PageVisitLog):
// ניקוי קלט, בניית ה-WHERE (פרמטרים בלבד, בלי שרשור קלט), הסתרת סודות / UUID / שכר בשינויים, שמות ישויות אנושיים, מיפוי סינון -> פרמטרי API, גיליון ההדפסה, וחוזה סטטי
// (שערים, מגבלות עלות, אין window.confirm/alert, רישום הדפסה / משטח PDF, קובצי Legacy קפואים). אין DB / דפדפן / רשת.
// הרצה: node scripts/test_a5_history_lists.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  COUNT_CAP, SqlArgs, clampInt, likePattern, parsePaging, periodBounds, periodSql, resolvePeriod, cappedTotal, pagingError,
} from '../lib/adminLogList.js';
import {
  ACTION_GROUPS, ACTION_GROUP_KEYS, ENTITY_META, HEAD_ONLY_AUDIT_ENTITIES, WAGE_KEYS, actionGroupCase, auditOrderBy, buildAuditWhere, buildChangeList, entityIdsByType,
  entityLabel, nameFromChanges, parseAuditListParams, sentenceOf, shapeEntity, subjectOf, verbOf, visibleTypes, SECRET_ROW_RE_SQL,
} from '../lib/adminAuditList.js';
import {
  buildVisitWhere, formatSize, isApiPath, pathOnly, parseVisitListParams, screenName, sizeLevel, visitOrderBy, SECRET_BODY_WORDS, OLD_RECORDS_DAYS, URL_SECRET_RE_SQL,
} from '../lib/adminVisitList.js';
import {
  buildAuditFilters, buildAuditQuery, buildAuditSheet, auditPairs, auditRow, changeLines, changeSummary, formatChangeValue, sheetFlatRows as auditFlat, DEFAULT_SORT as A_SORT, SORTS as A_SORTS,
} from '../app/components/history-lists/dataHistoryLogic.js';
import {
  buildVisitFilters, buildVisitQuery, buildVisitSheet, visitPairs, visitRow, sheetFlatRows as visitFlat, DEFAULT_TYPES, SORTS as V_SORTS,
} from '../app/components/history-lists/visitLogLogic.js';
import { baseQuery, dynamicOptions, groupByDay, countOf, PRINT_MAX, EXPORT_MAX, printTooLong, printLimitText } from '../app/components/history-lists/historyShared.js';
import { auditLogDoc, visitLogDoc } from '../app/components/a5-print/pkSpecsHistory.js';
import { PRINT_DOCS } from '../app/components/a5-print/pkRegistry.js';
import { PDF_HTML_SURFACE_KEYS } from '../lib/printAccessKeys.js';
import { isOptionHidden } from '../app/components/a5-list/listLogic.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const dayRange = (k) => ({ start: new Date(`${k}T00:00:00.000Z`), end: new Date(`${k}T23:59:59.999Z`) });
const ctx = (isHead = true) => ({ isHead, todayKey: '2026-10-11', dayRange });
const fns = { hDate: (iso) => `H(${iso.slice(0, 10)})`, hm: (iso) => iso.slice(11, 16), rel: (iso) => `rel(${iso.slice(0, 10)})`, dayKey: (iso) => iso.slice(0, 10), dayLabel: (k) => `יום ${k}` };
const fmt = { label: (k) => ({ phone1: 'טלפון', city: 'עיר', totalAmount: 'סכום כולל' }[k] || k), value: (k, v) => formatChangeValue(k, v, fns, null) };

console.log('1. ניקוי קלט / עימוד / SQL');
t('עימוד: עמוד 1.., גודל עד 100 (ייצוא 500), לא "הכול"', () => {
  assert.deepEqual(parsePaging({}), { page: 1, export: false, limit: 50 });
  assert.equal(parsePaging({ limit: 100000 }).limit, 100);
  assert.equal(parsePaging({ limit: 100000, export: '1' }).limit, 500);
  assert.equal(parsePaging({ page: -5 }).page, 1);
  assert.equal(clampInt('x', 7, 1, 9), 7);
  assert.equal(pagingError({ page: 100000, limit: 50, export: false }) !== '', true);
  assert.equal(pagingError({ page: 2000, limit: 50, export: false }), '');
});
t('likePattern מבריחה % _ \\ ; SqlArgs ממספר פרמטרים', () => {
  assert.equal(likePattern('50%_a\\b'), '%50\\%\\_a\\\\b%');
  const a = new SqlArgs(); assert.equal(a.p('x'), '$1'); assert.equal(a.p('y'), '$2'); assert.deepEqual(a.args, ['x', 'y']);
});
t('תקופות: מפתח -> ימים -> גבולות instant', () => {
  assert.deepEqual(resolvePeriod('today', '2026-10-11'), { from: '2026-10-11', to: '2026-10-11' });
  assert.deepEqual(resolvePeriod('d7', '2026-10-11'), { from: '2026-10-05', to: '2026-10-11' });
  assert.equal(resolvePeriod('custom', '2026-10-11'), null);
  const b = periodBounds({ from: '2026-10-01', to: '2026-10-03' }, dayRange);
  assert.equal(b.gte.toISOString(), '2026-10-01T00:00:00.000Z'); assert.equal(b.lt.toISOString(), '2026-10-04T00:00:00.000Z');
  const a = new SqlArgs();
  assert.match(periodSql('x', ['today', 'custom'], '', '', '2026-10-11', dayRange, a), /^\(\(x >= \$1 AND x < \$2\)\)$/);
  assert.equal(periodSql('x', [], '', '', '2026-10-11', dayRange, new SqlArgs()), '');
});
t('סך חסום: מעל התקרה = COUNT_CAP + capped', () => {
  assert.deepEqual(cappedTotal(120), { total: 120, capped: false });
  assert.deepEqual(cappedTotal(COUNT_CAP + 1), { total: COUNT_CAP, capped: true });
});

console.log('2. היסטוריית נתונים - פרמטרים / WHERE / הרשאות');
t('parseAuditListParams: רק מפתחות מוכרים; סוגי רשומה / מזהי עובד נבדקים בתבנית', () => {
  const p = parseAuditListParams({ types: 'Order,Bad Type;DROP,Customer', actions: 'update,hack,delete', employees: 'system,abcd1234-aaaa,x;y', sort: 'nope', dir: 'asc', search: ' a '.repeat(200) });
  assert.deepEqual(p.types, ['Order', 'Customer']); assert.deepEqual(p.actions, ['update', 'delete']); assert.deepEqual(p.employees, ['system', 'abcd1234-aaaa']);
  assert.equal(p.sort, 'time'); assert.equal(p.dir, 'asc'); assert.ok(p.search.length <= 200);
});
t('buildAuditWhere: כל קלט משתמש בפרמטר ($n) ולעולם לא בטקסט ה-SQL', () => {
  const p = parseAuditListParams({ types: 'Order', actions: 'update,cancel', employees: 'system,abcdef12-1', period: 'd7', search: "x'; DROP TABLE \"AuditLog\"; --" });
  const w = buildAuditWhere(p, ctx());
  assert.ok(!/DROP|abcdef12/.test(w.where), w.where);
  assert.match(w.where, /a\."entityType" = ANY\(\$1::text\[\]\)/);
  assert.match(w.where, /a\."employeeId" IS NULL/);
  assert.match(w.where, /ILIKE \$\d+ ESCAPE/);
  assert.ok(w.args.some((x) => String(x).includes('DROP TABLE')));
});
t('הרשאות: סוגי הנהלה בלבד נחתכים מכל מי שאינו הנהלה - גם בלי סינון וגם עם סינון מפורש', () => {
  assert.equal(visibleTypes(['Employee', 'Order'], true).length, 2);
  assert.deepEqual(visibleTypes(['Employee', 'Order'], false), ['Order']);
  assert.deepEqual(visibleTypes(['Employee', 'Shift'], false), []);
  const w = buildAuditWhere(parseAuditListParams({ types: 'Employee' }), ctx(false));
  assert.equal(w.empty, true);
  const open = buildAuditWhere(parseAuditListParams({}), ctx(false));
  assert.match(open.where, /<> ALL\(/); assert.deepEqual(open.args[0], [...HEAD_ONLY_AUDIT_ENTITIES]);
  assert.equal(buildAuditWhere(parseAuditListParams({}), ctx(true)).where, '');
  const route = read('../app/api/audit/route.js');
  const m = route.match(/HEAD_ONLY_AUDIT_ENTITIES = (\[[^\]]+\])/);
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')), [...HEAD_ONLY_AUDIT_ENTITIES], 'אותה רשימה כמו /api/audit');
});
t('קבוצות פעולה: CASE ו-WHERE מכסים את כל הפעולות (create / update / delete / cancel / other)', () => {
  assert.deepEqual(ACTION_GROUP_KEYS, ['create', 'update', 'delete', 'cancel', 'other']);
  assert.match(actionGroupCase('a."action"'), /CANCEL\\_%/);
  assert.match(ACTION_GROUPS.update.sql('c'), /UPDATE_ORDER/);
});
t('מיון: רק רשימה לבנה; עובד דורש JOIN; תיקו יציב', () => {
  assert.equal(auditOrderBy('employee', 'asc').join, true);
  assert.equal(auditOrderBy('time', 'desc').join, false);
  assert.match(auditOrderBy('DROP', 'desc').sql, /"createdAt" DESC/);
  assert.match(auditOrderBy('size', 'asc').sql, /length\(a\."changesJson"\) ASC/);
});

console.log('3. שינויים: בלי UUID / סודות / שכר / רעש');
const uuid = '3f2c9a1e-5b7d-4e8a-9c01-aabbccddeeff';
t('UPDATE לפני/אחרי: רק שדות שהשתנו; ריקים ושווים נזרקים', () => {
  const r = buildChangeList(JSON.stringify({ phone1: { from: '050', to: '052' }, city: { from: 'a', to: 'a' }, notes: { from: null, to: '' }, totalAmount: { from: 1, to: 2 } }));
  assert.deepEqual(r.list.map((x) => x.key), ['phone1', 'totalAmount']); assert.equal(r.n, 2);
});
t('UUID לעולם לא מוצג: שדה שערכו UUID נעלם; החלפת הפניה הופכת ל"הוחלף / נקבע / הוסר"', () => {
  const r = buildChangeList({ customerId: uuid, dressItemId: { from: uuid, to: '11111111-2222-3333-4444-555555555555' }, dressModelId: { from: null, to: uuid }, x: { from: uuid, to: null } });
  assert.deepEqual(r.list.map((x) => x.to), ['הוחלף', 'נקבע', 'הוסר']);
  assert.ok(!JSON.stringify(r.list).includes(uuid) && !JSON.stringify(r.list).includes('11111111'));
  assert.ok(!JSON.stringify(buildChangeList({ note: `פריט #${uuid} חזר` }).list).includes(uuid), 'גם בתוך טקסט');
});
t('שדות פנימיים ורועשים לא מופיעים; "לא" / 0 רק לשדות משמעותיים', () => {
  const r = buildChangeList({ id: uuid, legacyId: 5, createdAt: 'x', updatedAt: 'y', themeColor: '{"v":1}', isWeekdayEvent: true, city: 'ירושלים', isPaid: false, quantity: 0, isDeleted: false });
  assert.deepEqual(r.list.map((x) => x.key), ['city', 'isPaid', 'isDeleted']);
});
t('סודות: סיסמה / PIN / מפתח / בנק / ת"ז / טוקן - הערך לא נשלח (masked), גם בלי פורמט לפני/אחרי', () => {
  const r = buildChangeList({ password: 'abc123', pinHash: { from: 'a', to: 'b' }, keyHash: '***', bankAccount: '123456789', zeout: '012345678', token: 't', body: 'סיסמה זמנית: Xy12', city: 'חיפה' });
  assert.equal(r.list.filter((x) => x.masked).length, 7);
  const dump = JSON.stringify(r.list);
  for (const secret of ['abc123', '123456789', '012345678', 'Xy12', '"a"', '"b"']) assert.ok(!dump.includes(secret), secret);
  assert.equal(r.list.find((x) => x.key === 'city').to, 'חיפה');
});
t('שכר: מוסתר למי שאינו הנהלה ראשית, מוצג להנהלה', () => {
  const c = { hourlyWage: 50, totalCalculated: 100, paymentMethod: 'cash', city: 'x' };
  assert.deepEqual(buildChangeList(c, { canSeeWages: false }).list.map((x) => x.key), ['city']);
  assert.equal(buildChangeList(c, { canSeeWages: true }).list.length, 4);
  assert.ok(WAGE_KEYS.includes('hourlyWageSnapshot'));
});
t('טקסט: כרטיס אשראי מוסתר, חיתוך ל-300 תווים, אובייקטים כטקסט חתוך; JSON שבור / ריק לא זורק', () => {
  const r = buildChangeList({ notes: 'שולם בכרטיס 4580 1234 5678 9012 תודה', long: 'x'.repeat(900), obj: { a: 1 } });
  assert.ok(!r.list[0].to.includes('5678 9012')); assert.ok(r.list[1].to.length <= 301);
  assert.deepEqual(buildChangeList('{not json'), { list: [], n: 0 }); assert.deepEqual(buildChangeList(null), { list: [], n: 0 });
  assert.equal(buildChangeList({ a: 1, b: 2 }, { limit: 1 }).list.length, 1);
});

console.log('4. שמות אנושיים לרשומות');
t('המשפט: "הזמנה #53375 · עודכנה" (מגדר), פעולות מיוחדות לפי התרגום, בלי מזהה = סוג בלבד', () => {
  assert.equal(sentenceOf('Order', 'UPDATE', { ref: '53375' }), 'הזמנה #53375 · עודכנה');
  assert.equal(sentenceOf('Customer', 'CREATE', { name: 'דוד כהן' }), 'לקוח דוד כהן · נוצר');
  assert.equal(sentenceOf('Order', 'UPDATE_ORDER', { ref: '1' }), 'הזמנה #1 · עודכנה');
  assert.equal(sentenceOf('OrderItem', 'CONFIRM_RENTAL', { ref: '28315', within: true }, { CONFIRM_RENTAL: 'אישור השכרה' }), 'פריט בהזמנה #28315 · אישור השכרה');
  assert.equal(sentenceOf('Payment', 'DELETE', { ref: '7', within: true }), 'תשלום בהזמנה #7 · נמחק');
  assert.equal(sentenceOf('Employee', 'UPDATE', { ref: '', name: '' }), 'עובד · עודכן');
  assert.equal(subjectOf('Foo', null), 'Foo'); assert.equal(verbOf('Order', 'WEIRD_ACTION'), 'weird action');
  assert.equal(entityLabel('DressModel'), 'דגם');
});
t('shapeEntity: מספר הזמנה / שם לקוח / דגם; ישות שנמחקה = בלי מזהה; הקישור לדף קיים; ErrorReport = 8 תווים', () => {
  assert.deepEqual(shapeEntity('Order', { orderId: 53375, customer: { firstName: 'א', lastName: 'ב' } }), { ref: '53375', name: '', href: '/orders/53375', who: 'א ב' });
  assert.equal(shapeEntity('Order', undefined).ref, '');
  assert.equal(shapeEntity('Customer', { id: 'c1', legacyId: 31100, firstName: 'דוד', lastName: 'כהן' }).name, 'דוד כהן');
  assert.equal(shapeEntity('OrderItem', { orderId: 28315 }).within, true);
  assert.equal(shapeEntity('DressItem', { dressModelId: 'm', sizeText: '36', dressModel: { name: 'ורד' } }).name, 'ורד (36)');
  assert.equal(shapeEntity('ErrorReport', { id: 'ce5f318b-aaaa' }).ref, 'ce5f318b');
  assert.equal(nameFromChanges('PermissionPageGroup', '{"name":"שורה"}'), 'שורה');
  assert.equal(nameFromChanges('Order', '{"name":"x"}'), '');
  const by = entityIdsByType([{ entityType: 'Order', entityId: 'a' }, { entityType: 'Order', entityId: 'a' }, { entityType: 'Customer', entityId: 'b' }]);
  assert.equal(by.Order.size, 1); assert.equal(by.Customer.size, 1);
  assert.ok(Object.keys(ENTITY_META).every((k) => ENTITY_META[k].l && ['m', 'f'].includes(ENTITY_META[k].g)));
});

console.log('5. מסך נתונים - מצב -> API, אפשרויות, שורה, גיליון');
t('buildAuditQuery: רק מה שנבחר נשלח; טווח מותאם רק כשנבחר', () => {
  assert.deepEqual(buildAuditQuery({ sort: A_SORT }), { page: 1, limit: 50, sort: 'time', dir: 'desc' });
  const q = buildAuditQuery({ sel: { types: ['Order', 'Customer'], actions: ['update'], employees: ['system'], period: ['custom'] }, custom: { from: '2026-10-01', to: '2026-10-05' }, q: ' טלפון ', page: 3, sort: { k: 'type', dir: 1 } });
  assert.deepEqual(q, { page: 3, limit: 50, sort: 'type', dir: 'asc', search: 'טלפון', types: 'Order,Customer', actions: 'update', employees: 'system', period: 'custom', from: '2026-10-01', to: '2026-10-05' });
  assert.equal(buildAuditQuery({ sel: { period: ['d7'] }, custom: { from: 'x' }, sort: A_SORT }).from, undefined);
});
t('אפשרויות סינון: אפס מוסתר (אלא אם נבחר), ספירה חסומה = אין הסתרה, לפני טעינה = כל הסוגים בלי מספר', () => {
  const counts = { types: { Order: 5, Customer: 0 }, actions: { create: 1, update: 0, delete: 0, cancel: 0, other: 0 }, employees: { system: 3, e1: 2 }, employeeNames: { e1: 'דנה' }, period: { today: 0, d7: 4, d30: 4, year: 4 } };
  const g = buildAuditFilters(counts, { sel: { types: ['Foo'] } });
  assert.deepEqual(g.map((x) => x.key), ['types', 'actions', 'employees', 'period']);
  const types = g[0].options; assert.deepEqual(types.map((o) => o.k), ['Order', 'Customer', 'Foo']);
  assert.equal(isOptionHidden(types[1].count, false), true); assert.equal(isOptionHidden(types[2].count, true), false);
  assert.equal(g[2].options.find((o) => o.k === 'e1').l, 'דנה'); assert.equal(g[2].options.find((o) => o.k === 'system').l, 'מערכת (ללא עובד)');
  const capped = buildAuditFilters({ ...counts, capped: true });
  assert.ok(capped.every((grp) => grp.options.every((o) => o.count === '')), 'חסום: אפשרויות גלויות בלי מספר');
  const pre = buildAuditFilters(null, { knownTypes: ['Order', 'Customer'] });
  assert.deepEqual(pre[0].options.map((o) => o.k), ['Order', 'Customer']); assert.ok(pre[0].options.every((o) => o.count === ''));
  assert.deepEqual(pre.map((x) => x.key), ['types', 'actions', 'period'], 'בלי קבוצת עובדים עד שהספירות נטענו');
  assert.equal(countOf(null, 'types', 'x'), '');
});
t('שורה: משפט אנושי, אייקון, זוגות (מספר שדות רק כשיש יותר מאחד, מערכת בלי עובד)', () => {
  const d = { id: 'r1', t: '2026-10-11T12:30:00.000Z', type: 'Order', action: 'UPDATE', who: 'דנה', system: false, entity: { ref: '53375', name: '', href: '/orders/53375' }, changes: [{ key: 'phone1', edit: true, from: '050', to: '052' }, { key: 'city', edit: true, from: 'a', to: 'b' }], n: 2, big: false };
  const r = auditRow(d, {});
  assert.equal(r.title, 'הזמנה #53375 · עודכנה'); assert.equal(r.subject, 'הזמנה #53375'); assert.equal(r.verb, 'עודכנה');
  const pairs = auditPairs(r, fns); assert.deepEqual(pairs.map((p) => p.key), ['when', 'who', 'n']);
  assert.equal(auditPairs({ ...r, n: 1, system: true, who: '' }, fns).map((p) => p.text).join('|'), 'rel(2026-10-11) · 12:30|מערכת');
  assert.equal(auditRow({ ...d, action: 'DELETE' }, {}).icon, 'trash');
});
t('ערכים: כן/לא, תאריך עברי (+שעה רק כשיש), ₪, ריק; לפני ← אחרי; סיכום עם "ועוד N"', () => {
  assert.equal(formatChangeValue('isPaid', true, fns), 'כן');
  assert.equal(formatChangeValue('eventDate', '2026-10-03T00:00:00.000Z', fns), 'H(2026-10-03)');
  assert.equal(formatChangeValue('x', '2026-10-03T14:05:00.000Z', fns), 'H(2026-10-03) · 14:05');
  assert.match(formatChangeValue('amount', 1200, fns), /₪1,?200/);
  assert.equal(formatChangeValue('x', '', fns), '(ריק)');
  assert.equal(formatChangeValue('x', 'k', fns, () => 'תווית'), 'תווית');
  const r = { changes: [{ key: 'phone1', edit: true, from: '050', to: '052' }, { key: 'city', edit: false, from: null, to: 'חיפה' }, { key: 'password', masked: true }, { key: 'totalAmount', edit: false, to: 5 }], n: 6, big: false };
  const lines = changeLines(r.changes, fmt);
  assert.deepEqual(lines.map((l) => [l.label, l.before, l.after]), [['טלפון', '050', '052'], ['עיר', '', 'חיפה'], ['password', '', ''], ['סכום כולל', '', '₪5']]);
  assert.equal(changeSummary(r, fmt, 2), 'טלפון: 050 ← 052 · עיר: חיפה · ועוד 4');
  assert.equal(changeSummary({ changes: [], big: true }, fmt), 'שינוי גדול - לא מוצג');
});
t('גיליון "יומן שינויים": מקובץ ליום, בלי UUID, עמודות שעה / מי / מה / השינוי; Excel שטוח; מסמך הדפסה', () => {
  const mk = (id, t, who, extra = {}) => auditRow({ id, t, type: 'Order', action: 'UPDATE', who, system: !who, entity: { ref: '1' }, changes: [{ key: 'city', edit: true, from: 'a', to: 'b' }], n: 1, ...extra }, {});
  const rows = [mk('a', '2026-10-10T08:00:00.000Z', 'דנה'), mk('b', '2026-10-11T09:00:00.000Z', ''), mk('c', '2026-10-11T07:00:00.000Z', 'רבקה')];
  const sh = buildAuditSheet(rows, 'פעולה: עדכון', fns, fmt);
  assert.deepEqual(sh.groups.map((g) => g.title), ['יום 2026-10-11', 'יום 2026-10-10']);
  assert.deepEqual(sh.groups[0].rows.map((r) => r.time), ['09:00', '07:00']);
  assert.deepEqual(sh.groups[0].rows[0], { time: '09:00', who: 'מערכת', what: 'הזמנה #1 · עודכנה', change: 'עיר: a ← b' });
  assert.equal(buildAuditSheet(rows, '', fns, fmt, true).groups[0].title, 'יום 2026-10-10');
  const flat = auditFlat(sh); assert.equal(flat.rows.length, 3); assert.equal(flat.head.length, flat.rows[0].length);
  const doc = auditLogDoc({ sheet: sh });
  assert.equal(doc.kind, 'flow'); assert.equal(doc.head.sum, '3 שינויים'); assert.equal(doc.head.sub, 'פעולה: עדכון');
  assert.equal(doc.atoms.filter((a) => a.kind === 'group').length, 2); assert.equal(doc.atoms.filter((a) => a.kind === 'row').length, 3);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(doc)), 'אין UUID בדוח');
  assert.ok(auditLogDoc({ sheet: buildAuditSheet([], '', fns, fmt) }).empty);
});

console.log('6. היסטוריית שאילתות');
t('parseVisitListParams + buildVisitWhere: סוג יחיד = LIKE, שניים = בלי תנאי; חיפוש לא נוגע בגופי בקשה רגישים', () => {
  const p = parseVisitListParams({ types: 'api,pages,zzz', status: 'error', employees: 'guest,abcdef12-3', period: 'today', search: 'login', sort: 'size', dir: 'asc' });
  assert.deepEqual(p.types, ['api', 'pages']); assert.equal(p.sort, 'size');
  const w = buildVisitWhere(p, ctx());
  assert.ok(!w.where.includes("LIKE '%/api/%'"), 'שני סוגים = בלי תנאי סוג');
  assert.match(w.where, /v\."isGuest" = true/); assert.match(w.where, /loadingError" <> ''/);
  const api = buildVisitWhere(parseVisitListParams({ types: 'api' }), ctx());
  assert.match(api.where, /"pageUrl" LIKE '%\/api\/%'/);
  const s = buildVisitWhere(parseVisitListParams({ search: 'abc' }), ctx());
  for (const w2 of SECRET_BODY_WORDS) assert.ok(s.where.includes(`NOT ILIKE '%${w2}%'`), w2);
  for (const pth of ['/api/login', '/api/auth/', '/api/attendance']) assert.ok(s.where.includes(`NOT LIKE '%${pth}%'`));
  assert.deepEqual(s.args, ['%abc%']);
  const route = read('../app/api/history/route.js');
  for (const w2 of SECRET_BODY_WORDS) assert.ok(route.includes(`'${w2}'`), `${w2} - אותה רשימה כמו /api/history`);
  assert.equal(OLD_RECORDS_DAYS, 90);
});
t('מיון נפח / משך: NULLS LAST בשני הכיוונים; מיון לא מוכר = זמן', () => {
  assert.match(visitOrderBy('size', 'desc'), /responseSize" DESC NULLS LAST/); assert.match(visitOrderBy('duration', 'asc'), /executionTime" ASC NULLS LAST/);
  assert.match(visitOrderBy('x', 'desc'), /^v\."timestamp" DESC/);
});
t('שם מסך / נתיב / נפח', () => {
  assert.equal(screenName('/orders/123'), 'הזמנות'); assert.equal(screenName('/api/orders'), 'שאילתת שרת (API)'); assert.equal(screenName('/foo'), '/foo');
  assert.equal(isApiPath('/api/x'), true); assert.equal(pathOnly('/api/x?a=1'), '/api/x');
  assert.equal(formatSize(2048), '2.0 KB'); assert.equal(formatSize(null), ''); assert.equal(sizeLevel(2000000), 'danger');
});
t('buildVisitQuery / מסננים: ברירת מחדל "שאילתות API" (כמו הדף הישן), מצב תקלה, שורה: תקין ריק לא מופיע', () => {
  assert.deepEqual(DEFAULT_TYPES, ['api']);
  const g = buildVisitFilters({ types: { api: 3, pages: 0 }, status: { error: 1, ok: 2 }, employees: { guest: 2 }, employeeNames: { guest: 'אורחים' }, period: {} });
  assert.deepEqual(g.map((x) => x.key), ['types', 'status', 'employees', 'period']); assert.deepEqual(g[0].def, ['api']);
  assert.deepEqual(buildVisitQuery({ sel: { types: ['api'], status: ['error'] }, sort: { k: 'size', dir: -1 } }), { page: 1, limit: 50, sort: 'size', dir: 'desc', types: 'api', status: 'error' });
  const ok = visitRow({ id: '1', t: '2026-10-11T10:00:00.000Z', path: '/api/orders?x=1', api: true, screen: 'שאילתת שרת (API)', who: 'דנה', guest: false, size: 3000, ms: 12, error: '', query: '' });
  assert.equal(ok.title, '/api/orders'); assert.deepEqual(visitPairs(ok, fns).map((p) => p.key), ['when', 'who', 'size', 'ms']);
  const bad = visitRow({ id: '2', t: '2026-10-11T10:00:00.000Z', path: '/orders/5', api: false, screen: 'הזמנות', who: '', guest: true, size: null, ms: null, error: 'x'.repeat(100), query: '' });
  assert.equal(bad.title, 'הזמנות'); assert.deepEqual(visitPairs(bad, fns).map((p) => p.key), ['when', 'who', 'err']); assert.ok(visitPairs(bad, fns).find((p) => p.key === 'err').warn);
  assert.ok(V_SORTS.length === 6 && A_SORTS.length === 5);
});
t('גיליון "יומן שאילתות": מקובץ ליום; "תקלה" רק כשיש תקלות; מסמך הדפסה', () => {
  const mk = (id, t, extra) => visitRow({ id, t, path: '/api/a', api: true, screen: '', who: 'דנה', guest: false, size: 1024, ms: 5, error: '', query: '', ...extra });
  const clean = buildVisitSheet([mk('1', '2026-10-11T10:00:00.000Z')], '', fns);
  assert.equal(clean.hasErr, false); assert.equal(visitFlat(clean).head.length, 6); assert.equal(visitLogDoc({ sheet: clean }).head.sum, 'רשומה אחת');
  const withErr = buildVisitSheet([mk('1', '2026-10-11T10:00:00.000Z'), mk('2', '2026-10-10T10:00:00.000Z', { error: 'boom' })], 'מצב: עם תקלה', fns);
  assert.equal(withErr.hasErr, true); assert.equal(visitFlat(withErr).head.length, 7); assert.equal(withErr.groups.length, 2);
  assert.equal(visitLogDoc({ sheet: withErr }).atoms.filter((a) => a.kind === 'row').length, 2);
  assert.ok(visitLogDoc({ sheet: buildVisitSheet([], '', fns) }).empty);
});
t('helpers: dynamicOptions / groupByDay / baseQuery', () => {
  assert.deepEqual(dynamicOptions({ g: { a: 1, b: 5 } }, 'g', [], { labelOf: (k) => k, iconOf: () => 'x' }).map((o) => o.k), ['b', 'a']);
  assert.equal(groupByDay([{ t: '2026-10-10T01:00:00Z' }, { t: '2026-10-11T01:00:00Z' }], fns).length, 2);
  assert.equal(baseQuery({ sort: { k: 'k', dir: 1 }, groups: [] }).dir, 'asc');
});

t('תקרת הדפסה / PDF: מעל 1,500 שורות = הודעה (לא בונים גיליונות); Excel לא מושפע; הסך החסום נחשב ארוך', () => {
  assert.equal(PRINT_MAX, 1500); assert.ok(EXPORT_MAX > PRINT_MAX);
  assert.equal(printTooLong('print', 1500), false); assert.equal(printTooLong('print', 1501), true); assert.equal(printTooLong('download', 3446), true);
  assert.equal(printTooLong('excel', 100000), false); assert.equal(printTooLong('print', 100000), true); assert.equal(printTooLong('print', 0), false);
  assert.match(printLimitText(), /הרשימה ארוכה מדי להדפסה - צמצמו את הסינון \(נדרש עד 1,500 שורות\)/);
  for (const f of ['DataHistoryA5.js', 'ManagementHistoryA5.js']) {
    const src = read(`../app/components/history-lists/${f}`);
    assert.ok(src.indexOf('printTooLong(kind, info.total)') > 0 && src.indexOf('printTooLong(kind, info.total)') < src.indexOf('L.fetchAll(EXPORT_MAX)'), `${f}: הבדיקה לפני טעינת השורות`);
  }
});

console.log('7. חוזה סטטי: שערים, עלות, חלונות, רישום, Legacy');
t('שני נתיבי ה-API (רשימה + ספירות) שומרים על הנהלה ראשית לפני כל שאילתה ומשתמשים בגבולות העלות', () => {
  for (const f of ['data-history/route.js', 'data-history/counts/route.js', 'management-history/route.js', 'management-history/counts/route.js']) {
    const src = read(`../app/api/admin/${f}`);
    assert.ok(src.indexOf("checkAuth('הנהלה ראשית')") > 0 && src.indexOf("checkAuth('הנהלה ראשית')") < src.indexOf('await query'), f);
    assert.match(src, /errorResponse\(error\)/, f); assert.match(src, /force-dynamic/, f);
  }
  for (const f of ['data-history/route.js', 'management-history/route.js']) assert.match(read(`../app/api/admin/${f}`), /pagingError/);
  for (const f of ['../lib/adminAuditListServer.js', '../lib/adminVisitListServer.js']) {
    const src = read(f);
    assert.match(src, /runLimited/); assert.match(src, /createTtlCache/); assert.match(src, /COUNT_CAP/); assert.match(src, /guarded\(/);
    assert.ok(!/\$queryRawUnsafe\(`[^`]*\$\{(params|input|p\.)/.test(src), 'אין שרשור קלט משתמש');
    assert.ok(!/\.count\(\)|auditLog\.count|pageVisitLog\.count|count\(\*\) FROM "(AuditLog|PageVisitLog)" [a-z]*\s*(WHERE|`)/.test(src.replace(/LIMIT \$\{COUNT_CAP \+ 1\}/g, '')), 'אין COUNT מלא');
  }
  assert.match(read('../lib/adminAuditListServer.js'), /length\(a\."changesJson"\) > \$\{BIG_CHANGES\}/);
});
t('בלי window.confirm / alert / prompt / customAuthPrompt בקומפוננטות החדשות; חלונות כהים (Dlg); אין מחיקה בלי קוד מנהל', () => {
  for (const f of ['DataHistoryA5.js', 'ManagementHistoryA5.js', 'PinDialog.js', 'DataHistorySwitch.js', 'ManagementHistorySwitch.js']) {
    const src = read(`../app/components/history-lists/${f}`).replace(/\/\/.*$/gm, '');
    assert.ok(!/window\.(confirm|alert|prompt)|\balert\(|customAuthPrompt|customConfirm/.test(src), f);
  }
  const mg = read('../app/components/history-lists/ManagementHistoryA5.js');
  assert.match(mg, /method: 'DELETE'/); assert.match(mg, /<PinDialog/); assert.match(read('../app/components/history-lists/PinDialog.js'), /<Dlg /);
  assert.ok(!mg.includes('/api/history?'), 'הדף החדש לא קורא ל-GET /api/history (פתוח לכל מחובר)');
});
t('רישום הדפסה + משטח PDF + מתג הישן/חדש (switch / Legacy / PageVariantToggle בכותרת)', () => {
  assert.equal(PRINT_DOCS['data-history'].surface, 'a5-data-history'); assert.equal(PRINT_DOCS['visit-log'].surface, 'a5-management-history');
  for (const s of ['a5-data-history', 'a5-management-history']) assert.deepEqual(PDF_HTML_SURFACE_KEYS[s], ['page:admin']);
  assert.match(read('../app/components/history-lists/DataHistorySwitch.js'), /return <VariantFrame screen="data_history" variant="a5"><DataHistoryA5 \/><\/VariantFrame>/);
  assert.match(read('../app/components/history-lists/ManagementHistorySwitch.js'), /return <VariantFrame screen="management_history" variant="a5"><ManagementHistoryA5 \/><\/VariantFrame>/);
  assert.match(read('../app/components/history-lists/DataHistoryA5.js'), /<PageVariantToggle screen="data_history" placement="header" systemTip \/>/);
  assert.match(read('../app/components/history-lists/ManagementHistoryA5.js'), /<PageVariantToggle screen="management_history" placement="header" systemTip \/>/);
  assert.match(read('../app/admin/data-history/page.js'), /DataHistorySwitch/); assert.match(read('../app/management/history/page.js'), /ManagementHistorySwitch/);
});
t('קבצי ה-Legacy זהים בייט-בבייט לדפים של main (15dc7a0d) שהם החליפו', () => {
  for (const [from, to] of [['app/admin/data-history/page.js', 'app/admin/data-history/LegacyDataHistoryPage.js'], ['app/management/history/page.js', 'app/management/history/LegacyManagementHistoryPage.js']]) {
    let blob;
    try { blob = execFileSync('git', ['rev-parse', `15dc7a0d:${from}`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).trim(); } catch { console.log('         (אין היסטוריית git - דילוג)'); return; }
    const own = execFileSync('git', ['hash-object', to], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).trim();
    assert.equal(own, blob, to);
  }
});
t('HistoryViewer הישן לא שונה (הרכיב הישן משותף); /api/audit שונה רק בהקשחת סודות (ביקורת אבטחה 11.10.2026, F10): שערים ורשימת HEAD_ONLY בעינם', () => {
  const diff = execFileSync('git', ['status', '--porcelain', 'components/HistoryViewer.js'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).trim();
  assert.equal(diff, '');
  const audit = read('../app/api/audit/route.js').replace(/\r\n/g, '\n');
  assert.ok(audit.includes("const HEAD_ONLY_AUDIT_ENTITIES = ['Employee', 'Shift', 'EmployeePermissionOverride', 'DepartmentPermission', 'PermissionPageGroup', 'TrustedDevice', 'ApiKey', 'Department'];"));
  assert.ok(audit.indexOf("if (!(await checkAuth()))") > -1 && audit.includes("checkAuth('הנהלה ראשית')"));
  assert.ok(audit.includes("'סיסמה זמנית'"), 'חיפוש הטקסט לא מחזיר שורות עם סיסמה זמנית (F10)');
});
t('F10: השורות ביומן השינויים אינן נושאות גוף מייל (כתיבה + קריאה), והחיפוש בשרת/ב-API לא משמש אורקל לסודות', () => {
  const prismaSrc = read('../app/lib/prisma.js'); const auditLogSrc = read('../app/lib/auditLog.js');
  assert.match(prismaSrc, /EmailLog: \['body', 'confirmToken'\]/); assert.match(auditLogSrc, /EmailLog: \['body', 'confirmToken'\]/);
  const w = buildAuditWhere(parseAuditListParams({ search: 'x' }), ctx());
  assert.ok(w.where.includes(`!~ ${SECRET_ROW_RE_SQL}`), 'חיפוש בלי הרחקת שורות סודיות');
  const w0 = buildAuditWhere(parseAuditListParams({}), ctx());
  assert.ok(!w0.where.includes('!~'), 'בלי חיפוש אין תנאי נוסף');
  const v = buildVisitWhere(parseVisitListParams({ search: 'x' }), ctx());
  assert.ok(v.where.includes(`!~* ${URL_SECRET_RE_SQL}`), 'חיפוש בכתובת עם פרמטר סודי');
  const route = read('../app/api/history/route.js').replace(/\r\n/g, '\n');
  const del = route.slice(route.indexOf('export async function DELETE'));
  assert.ok(del.indexOf("checkAuth('הנהלה ראשית')") > -1 && del.indexOf("checkAuth('הנהלה ראשית')") < del.indexOf('request.json()'), 'DELETE /api/history: שער הנהלה ראשית לפני כל קריאה (F12)');
  assert.match(del, /typeof body\.username === 'string'/);
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
