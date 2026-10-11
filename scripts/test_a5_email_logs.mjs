// בדיקת יחידה ליומן שליחת המיילים החדש (/admin/site-settings/email-logs): סוגי המיילים (כל מזהה בקטלוג מכוסה, אותם כללים ב-JS וב-SQL), פרמטרים, בניית SQL מוצמד,
// פרטיות גוף המייל, שורות, זוגות שורה 2, גיליון ההדפסה / Excel, ורישום המשטח + חוזה סטטי של השערים והדף הישן הקפוא. אין DB / דפדפן / רשת.
// הרצה: node scripts/test_a5_email_logs.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMAIL_CATALOG, listEmailCatalog } from '../lib/emailCatalog.js';
import * as L from '../lib/adminEmailLogs.js';
import * as G from '../lib/adminListGuards.js';
import {
  buildEmailFilters, buildEmailLogSheet, buildEmailQuery, countsKey, emailExcelRows, emailPairs, emailRow, openTarget, rowIcon, SORTS, DEFAULT_SORT,
} from '../app/components/email-logs/emailLogsLogic.js';
import { emailLogDoc } from '../app/components/a5-print/pkSpecsAdmin.js';
import { PRINT_DOCS } from '../app/components/a5-print/pkRegistry.js';
import { PDF_HTML_SURFACE_KEYS } from '../lib/printAccessKeys.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('סוגי מיילים');
t('כל מזהה בקטלוג המיילים מכוסה ע"י סוג אחד לפחות', () => {
  const covered = new Set(L.ALL_TYPES.flatMap((x) => x.catalog));
  for (const id of Object.keys(EMAIL_CATALOG)) assert.ok(covered.has(id), `${id} חסר`);
});
t('נושא לדוגמה של כל מייל בקטלוג מסווג לסוג שמכסה אותו (כרטיס הזמנה = עם קובץ, אישור אוטומטי = בלי)', () => {
  for (const e of listEmailCatalog()) {
    const withFile = e.id === 'orderCard' ? 'a.pdf' : null;
    const got = L.classifyEmail({ subject: e.subjectExample, status: 'success', fileName: withFile });
    assert.ok(L.typeById(got).catalog.includes(e.id), `${e.id} -> ${got} (${e.subjectExample})`);
  }
});
t('רישום לרשימת תפוצה לפי סטטוס; נושא לא מוכר = אחר; סטטוס כשל לא משנה את הסוג', () => {
  assert.equal(L.classifyEmail({ subject: 'mailing-list-subscribe', status: 'subscribed' }), 'mailingList');
  assert.equal(L.classifyEmail({ subject: 'שלום', status: 'success' }), 'other');
  assert.equal(L.classifyEmail({ subject: 'הזמנה #26097 - גמ"ח שמלות', status: 'error', fileName: 'x.pdf' }), 'orderCard');
  assert.equal(L.classifyEmail({}), 'other');
});
t('SQL וגם JS משתמשים באותם ביטויים: כל כלל מופיע ב-CASE, וכל הביטויים מתקמפלים כ-RegExp', () => {
  const sql = L.typeCaseSql();
  for (const x of L.EMAIL_TYPES) { assert.ok(sql.includes(x.re.replace(/'/g, "''")), x.id); assert.doesNotThrow(() => new RegExp(x.re)); }
  assert.match(sql, /^\(CASE WHEN e\."status" = 'subscribed' THEN 'mailingList'/);
  assert.ok(sql.endsWith("ELSE 'other' END)"));
  assert.equal(new Set(L.TYPE_IDS).size, L.TYPE_IDS.length);
});
t('סטטוס: success = נשלח, subscribed = נרשם, כל השאר = נכשל (כמו הדף הישן)', () => {
  assert.equal(L.statusKeyOf('success'), 'sent'); assert.equal(L.statusKeyOf('subscribed'), 'subscribed');
  for (const s of ['error', '', null, 'x']) assert.equal(L.statusKeyOf(s), 'failed');
});

console.log('פרמטרים ו-SQL');
t('parseEmailLogsParams: חיתוך, ברירות מחדל, מפתחות לא מוכרים נזרקים', () => {
  const p = L.parseEmailLogsParams({ page: '0', limit: '99999', sort: 'DROP', dir: 'x', types: 'orderCard,bogus', statuses: 'failed,x', period: 'custom,nope', from: '2026-10-01', to: 'bad', senders: 'none,../x,3f2b8a6e-1111-4222-8333-444455556666', search: ' '.padEnd(300, 'א') });
  assert.equal(p.page, 1); assert.equal(p.limit, 100); assert.equal(p.sort, 'sentAt'); assert.equal(p.dir, 'desc');
  assert.deepEqual(p.types, ['orderCard']); assert.deepEqual(p.statuses, ['failed']); assert.deepEqual(p.period, ['custom']);
  assert.equal(p.from, '2026-10-01'); assert.equal(p.to, ''); assert.deepEqual(p.senders, ['none', '3f2b8a6e-1111-4222-8333-444455556666']);
  assert.ok(p.search.length <= 200);
  assert.equal(L.parseEmailLogsParams({ export: true, limit: 9999 }).limit, 500);
  assert.equal(L.parseEmailLogsParams(null).page, 1);
});
t('validatePaging: היסט מוגזם = הודעה; עמוד רגיל תקין', () => {
  assert.equal(G.validatePaging(L.parseEmailLogsParams({ page: 5 })), '');
  assert.ok(G.validatePaging(L.parseEmailLogsParams({ page: 99999, limit: 100 })));
});
t('listSql: כל ערך משתמש מוצמד ($n) ואינו מוטמע בטקסט; ORDER BY מקבוצה קבועה; כמות ה-$n = כמות הארגומנטים', () => {
  const evil = "x'; DROP TABLE \"EmailLog\"; --";
  const p = L.parseEmailLogsParams({ search: evil, types: 'orderCard', statuses: 'failed', senders: 'none', period: 'today', sort: 'to', dir: 'asc' });
  const { sql, args } = L.listSql(p, [{ from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' }]);
  assert.ok(!sql.includes('DROP TABLE'), 'קלט משתמש לא בטקסט ה-SQL');
  assert.ok(args.some((a) => String(a).includes('DROP TABLE')));
  const maxN = Math.max(...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
  assert.equal(maxN, args.length);
  assert.match(sql, /ORDER BY lower\(e\."to"\) ASC NULLS LAST, e\."sentAt" DESC, e\."id" ASC LIMIT \$\d+::int OFFSET \$\d+::int/);
  assert.match(sql, /::timestamp/);
});
t('כל מפתחות המיון נתמכים ב-SQL, ויש להם שורה בחלון המיון של הדף', () => {
  for (const k of L.EMAIL_SORT_KEYS) { const { sql } = L.listSql(L.parseEmailLogsParams({ sort: k }), []); assert.match(sql, /ORDER BY/); assert.ok(SORTS.some((s) => s.k === k), k); }
  assert.equal(SORTS.length, L.EMAIL_SORT_KEYS.length);
  assert.deepEqual(DEFAULT_SORT, { k: 'sentAt', dir: -1 });
});
t('חיפוש: escape ל-LIKE; גוף המייל לא נחפש במיילים של איפוס סיסמה', () => {
  assert.equal(L.likeEscape('50%_a\\b'), '50\\%\\_a\\\\b');
  const { sql, args } = L.buildWhere(L.parseEmailLogsParams({ search: 'אבג' }));
  assert.match(sql, /"body" ILIKE \$1 AND NOT \(/);
  assert.equal(args[0], '%אבג%');
});
t('פרטיות: גוף של איפוס סיסמה מוחלף ב-NULL ב-SQL של הרשימה, ולא נשלף בייצוא', () => {
  const { sql } = L.listSql(L.parseEmailLogsParams({}), []);
  assert.match(sql, /CASE WHEN \(e\."subject" ~ '\^איפוס סיסמה[^']*'\) THEN NULL ELSE left\(e\."body", 300\) END AS "bodyPreview"/);
  assert.ok(!/"body"/.test(L.listSql(L.parseEmailLogsParams({ export: true }), []).sql.replace(/ILIKE[^)]*\)/g, '')));
  assert.ok(L.EMAIL_TYPES.find((x) => x.id === 'passwordReset').secret);
});
t('בלי סינון: WHERE TRUE; ספירות: כל קבוצה מדלגת על עצמה', () => {
  assert.equal(L.buildWhere(L.parseEmailLogsParams({})).sql, 'TRUE');
  const p = L.parseEmailLogsParams({ types: 'orderCard', statuses: 'failed' });
  const c = L.countsSql(p, [], { today: { from: 'a', to: 'b' } });
  assert.equal([...c.types.sql.matchAll(/ANY/g)].length, 1, 'ספירת הסוגים מחילה רק את הסטטוס');
  assert.equal([...c.statuses.sql.matchAll(/ANY/g)].length, 1);
  assert.equal([...c.total.sql.matchAll(/ANY/g)].length, 2);
  assert.match(c.senders.sql, /LIMIT 25/);
});
t('תקופות: ימים בשעון ישראל -> טווחי זמן; custom חלקי; OR בין כמה', () => {
  const dayRange = (k) => ({ start: new Date(`${k}T00:00:00Z`), end: new Date(`${k}T23:59:59.999Z`) });
  assert.deepEqual(L.resolvePeriod('past7', '2026-10-11'), { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(L.resolvePeriod('past30', '2026-10-11'), { from: '2026-09-12', to: '2026-10-11' });
  assert.deepEqual(L.resolvePeriod('pastYear', '2026-10-11'), { from: '2025-10-12', to: '2026-10-11' });
  assert.equal(L.resolvePeriod('custom', '2026-10-11'), null);
  const r = L.periodTimeRanges(['today', 'custom'], '2026-10-11', '2026-10-01', '', dayRange);
  assert.equal(r.length, 2); assert.equal(r[1].to, null); assert.equal(r[0].from, '2026-10-11T00:00:00.000Z');
  const w = L.buildWhere(L.parseEmailLogsParams({ period: 'today,custom' }), { ranges: r });
  assert.match(w.sql, /\(\(e\."sentAt" >= \$1::timestamp AND e\."sentAt" <= \$2::timestamp\) OR \(e\."sentAt" >= \$3::timestamp\)\)/);
});

console.log('שורות');
const raw = (o = {}) => ({ id: 'a', to: 'x@y.com', cc: null, subject: 'הזמנה #123 - גמ"ח', fileName: 'a.pdf, b.pdf', status: 'success', errorMessage: null, customerId: 'c1', employeeId: 'e1', sentAt: new Date('2026-10-08T10:00:00Z'), type: 'orderCard', orderNo: '123', ...o });
t('mapEmailLogRow: קבצים, הזמנה, לקוח, שולח; שגיאה רק בכשל; קישורי דרייב רק בהצלחה', () => {
  const m = L.mapEmailLogRow(raw({ errorMessage: 'Drive: https://drive.google.com/x, plain' }), { customers: new Map([['c1', { legacyId: 77, firstName: 'שרה', lastName: 'כהן' }]]), employees: new Map([['e1', { fullName: 'דנה לוי' }]]) });
  assert.deepEqual(m.files, ['a.pdf', 'b.pdf']); assert.equal(m.fileCount, 2); assert.equal(m.orderNo, 123); assert.equal(m.customerNo, 77); assert.equal(m.customerName, 'שרה כהן');
  assert.equal(m.senderName, 'דנה לוי'); assert.equal(m.error, ''); assert.equal(m.driveLinks.length, 2); assert.equal(m.driveLinks[0].url, 'https://drive.google.com/x'); assert.equal(m.driveLinks[1].url, null);
  const f = L.mapEmailLogRow(raw({ status: 'error', errorMessage: 'timeout' }));
  assert.equal(f.state, 'failed'); assert.equal(f.error, 'timeout'); assert.deepEqual(f.driveLinks, []);
  assert.equal(L.mapEmailLogRow(raw({ orderNo: null, fileName: null, customerId: null })).fileCount, 0);
});
t('קישור דרייב: רק https דרייב / docs (לא javascript: ולא דומיין אחר)', () => {
  for (const bad of ['javascript:alert(1)', 'https://evil.com/x', 'http://drive.google.com/x']) assert.equal(L.parseDriveLinks(`Drive: ${bad}`)[0].url, null, bad);
  assert.deepEqual(L.parseDriveLinks('שגיאה'), []);
});
t('גוף ממלא של כרטיס ההזמנה לא מוצג; גוף שמוסתר מסומן', () => {
  assert.equal(L.mapEmailLogRow(raw({ bodyPreview: L.ORDER_PDF_BODY_FILLER })).bodyPreview, '');
  assert.equal(L.mapEmailLogRow(raw({ bodyPreview: null, bodyHidden: true })).bodyHidden, true);
});
t('emailPairs: אפס / ריק לא מוצג; סדר: זמן, סוג, סטטוס, קבצים, הזמנה, לקוח; כשל = warn', () => {
  const dt = () => 'ט׳ תשרי';
  const full = emailPairs(emailRow(L.mapEmailLogRow(raw({ status: 'error' }), { customers: new Map([['c1', { legacyId: 77, firstName: 'ש' }]]) })), dt, () => '10:00');
  assert.deepEqual(full.map((p) => p.key), ['time', 'type', 'state', 'files', 'order', 'cust']);
  assert.equal(full[0].text, 'ט׳ תשרי · 10:00'); assert.equal(full[2].warn, true);
  const bare = emailPairs(emailRow(L.mapEmailLogRow(raw({ fileName: null, orderNo: null, customerId: null, type: 'other' }))), dt, () => '10:00');
  assert.deepEqual(bare.map((p) => p.key), ['time', 'type', 'state']);
});
t('openTarget: הזמנה קודם, אחר כך לקוח, אחרת null; אייקון השורה לפי סטטוס', () => {
  assert.equal(openTarget({ orderNo: 5, customerId: 'u' }), '/orders/5'); assert.equal(openTarget({ customerId: 'u' }), '/customers/u'); assert.equal(openTarget({}), null);
  assert.equal(rowIcon({ state: 'failed' }), 'alert'); assert.equal(rowIcon({ state: 'sent' }), 'mail'); assert.equal(rowIcon({ state: 'subscribed' }), 'inbox');
});

console.log('סינון / שאילתה');
t('buildEmailFilters: אפשרות בלי ספירות = גלויה בלי מספר; עם ספירות - לפיהן; קבוצת שולחים רק כשיש', () => {
  const f0 = buildEmailFilters(null);
  assert.deepEqual(f0.map((g) => g.key), ['types', 'statuses', 'period']);
  assert.equal(f0[0].options[0].count, '');
  const f1 = buildEmailFilters({ types: { orderCard: 3 }, statuses: { sent: 2 }, period: { today: 1 }, senders: [{ k: 'none', n: 4 }, { k: 'u1', n: 1, label: 'דנה' }] }, { customLabel: 'X' });
  assert.equal(f1[0].options.find((o) => o.k === 'orderCard').count, 3); assert.equal(f1[0].options.find((o) => o.k === 'other').count, 0);
  assert.equal(f1[2].options.at(-1).l, 'X');
  assert.deepEqual(f1[3].options.map((o) => o.k), ['none', 'u1']); assert.equal(f1[3].options[1].l, 'דנה');
});
t('buildEmailQuery / countsKey: רק מה שנבחר נשלח; הספירות לא תלויות בעמוד / מיון', () => {
  const q = buildEmailQuery({ sel: { types: ['a', 'b'], period: ['custom'] }, sort: { k: 'to', dir: 1 }, q: ' x ', page: 3, custom: { from: '2026-10-01', to: '2026-10-05' } });
  assert.deepEqual(q, { page: 3, limit: 50, sort: 'to', dir: 'asc', search: 'x', types: 'a,b', period: 'custom', from: '2026-10-01', to: '2026-10-05' });
  assert.equal(countsKey(q), countsKey({ ...q, page: 9, sort: 'subject', dir: 'desc' }));
  assert.equal(buildEmailQuery({ sel: { period: ['today'] }, custom: { from: 'a' } }).from, undefined);
});

console.log('הדפסה / Excel');
const rowsFor = [
  { sentAt: '2026-10-08T09:00:00Z', to: 'a@x.com', type: 'orderCard', state: 'sent', error: '', files: ['a.pdf'], cc: '', subject: 's', orderNo: 1, customerName: 'ש', customerNo: 5, senderName: '' },
  { sentAt: '2026-10-08T07:00:00Z', to: 'b@x.com', type: 'refund', state: 'failed', error: 'timeout', files: [], cc: 'c@x.com', subject: 's2', orderNo: null, customerName: '', customerNo: null, senderName: 'דנה' },
  { sentAt: '2026-10-09T07:00:00Z', to: 'c@x.com', type: 'other', state: 'sent', error: '', files: [], cc: '', subject: '', orderNo: null, customerName: '', customerNo: null, senderName: '' },
];
const fns = { dayKey: (iso) => iso.slice(0, 10), dayLabel: (k) => `יום ${k}`, time: (iso) => iso.slice(11, 16) };
t('buildEmailLogSheet: מקובץ לפי יום בסדר כרונולוגי; עמודת סיבה רק כשיש כשל; סיכום', () => {
  const s = buildEmailLogSheet(rowsFor, 'סטטוס: נשלח', fns);
  assert.deepEqual(s.groups.map((g) => g.title), ['יום 2026-10-08', 'יום 2026-10-09']);
  assert.deepEqual(s.groups[0].rows.map((r) => r.time), ['07:00', '09:00']);
  assert.ok(s.hasFail); assert.equal(s.columns.at(-1).key, 'reason'); assert.deepEqual(s.totals, { count: 3, failed: 1 });
  const ok = buildEmailLogSheet([rowsFor[0]], '', fns);
  assert.ok(!ok.hasFail); assert.ok(!ok.columns.some((c) => c.key === 'reason'));
});
t('emailLogDoc: בלי נתון כפול (התאריך רק בכותרת הקבוצה), הספירה והכשלים פעם אחת, ריק = empty', () => {
  const d = emailLogDoc({ sheet: buildEmailLogSheet(rowsFor, 'x', fns) });
  assert.equal(d.kind, 'flow'); assert.equal(d.head.sum, '3 מיילים · 1 נכשלו'); assert.equal(d.head.sub, 'x');
  assert.deepEqual(d.atoms.map((a) => a.kind), ['group', 'row', 'row', 'group', 'row']);
  assert.ok(d.atoms[1].thead.includes('סיבת הכשל') && !d.atoms[1].thead.includes('נושא'));
  assert.ok(!/2026-10-08/.test(d.atoms[1].html));
  const ok = emailLogDoc({ sheet: buildEmailLogSheet([rowsFor[0]], '', fns) });
  assert.ok(!ok.atoms[1].thead.includes('סיבת הכשל')); assert.equal(ok.head.sum, 'מייל אחד');
  assert.ok(emailLogDoc({ sheet: buildEmailLogSheet([], '', fns) }).empty);
});
t('Excel: כל הנתונים (נושא, עותק, קבצים, הזמנה, לקוח, שולח, שגיאה)', () => {
  const x = emailExcelRows(rowsFor, { date: (i) => i.slice(0, 10), time: (i) => i.slice(11, 16) });
  assert.equal(x.head.length, 12); assert.equal(x.rows[0].length, 12);
  assert.equal(x.rows[1][3], 'c@x.com'); assert.equal(x.rows[1][10], 'דנה'); assert.equal(x.rows[1][11], 'timeout'); assert.equal(x.rows[0][9], 'ש #5');
});
t('הרישום: המסמך והמשטח ידועים לשרת (PDF_HTML_SURFACE_KEYS)', () => {
  assert.equal(PRINT_DOCS['email-log'].build, emailLogDoc);
  assert.ok(PDF_HTML_SURFACE_KEYS[PRINT_DOCS['email-log'].surface]);
});

console.log('חוזה סטטי');
t('שערי ה-API: מתכנת בלבד, לפני כל קריאת נתונים; ה-API הישן לא שונה', () => {
  for (const f of ['../app/api/admin/email-logs/route.js', '../app/api/admin/email-logs/counts/route.js']) {
    const s = strip(read(f));
    assert.match(s, /async function handle\(input\) \{\s*if \(!\(await checkAuth\('מתכנת'\)\)\) return NextResponse\.json\(\{ error: [^}]*\}, \{ status: 401 \}\);\s*try \{/, f);
    assert.ok(!/prisma/.test(s), 'הנתיב לא ניגש ל-DB ישירות');
  }
  const old = strip(read('../app/api/email-logs/route.js'));
  assert.match(old, /checkAuth\('מתכנת'\)/);
});
t('שכבת השרת: כל קריאת DB דרך guarded (statement_timeout) ובקשה כבדה דרך runLimited', () => {
  const s = strip(read('../lib/adminEmailLogsServer.js'));
  assert.ok(!/prisma\.\$queryRawUnsafe\([^)]*\)\s*[,\]]/.test(s.replace(/guarded\(prisma\.\$queryRawUnsafe\([^)]*\)\)/g, '')));
  assert.equal([...s.matchAll(/prisma\.(customer|employee)\.findMany/g)].length, [...s.matchAll(/guarded\(prisma\.(customer|employee)\.findMany/g)].length);
  assert.match(s, /runLimited\(async/);
});
t('הדף: Switch + עותק קפוא; הרכיב החדש בלי window.confirm/alert; מתג המסך ברשומה; אין חיפוש חכם / סטטיסטיקה', () => {
  assert.match(read('../app/admin/site-settings/email-logs/page.js'), /EmailLogsSwitch/);
  const sw = read('../app/components/email-logs/EmailLogsSwitch.js');
  assert.match(sw, /<VariantFrame screen="email_logs" variant="legacy"><LegacyEmailLogsPage \/><\/VariantFrame>/);
  assert.match(sw, /<VariantFrame screen="email_logs" variant="a5"><EmailLogsA5 \/><\/VariantFrame>/);
  const a5 = strip(read('../app/components/email-logs/EmailLogsA5.js'));
  assert.ok(!/window\.(confirm|alert|prompt)|customConfirm|\balert\(/.test(a5));
  assert.match(a5, /<PageVariantToggle screen="email_logs" placement="header" systemTip \/>/);
  assert.match(a5, /<A5ListPage/); assert.ok(!/className="topbar"/.test(a5), 'כותרת אחידה מהערכה, לא ידנית');
  assert.ok(!/ai=\{|onStats=/.test(a5));
  assert.ok(!/body\b.*dangerouslySetInnerHTML|dangerouslySetInnerHTML/.test(a5));
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
