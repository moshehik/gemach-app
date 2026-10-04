// בדיקת יחידה ללוגיקה הטהורה של דף הבית החדש (app/components/home/homeLogic.js, homeAdvConfig.js,
// homeDates.js, privacyPolicyText.js). לא נוגעת ב-DB וברשת.
// הרצה: node scripts/test_home_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  buildGreeting, DEFAULT_TITLE, isLegacyDefaultTitle, LEGACY_DEFAULT_TITLE, normalizeTitleForCompare, normalizeSearch, resultsCount, orderStatus, unifiedRows, tableRecords,
  TABLE_COLUMNS, sortRecords, exportRecordsForRows, parseAiTags, safeInternalRoute, botMessageFromResponse,
  botErrorMessage, chatToHistory, chatCopyText, aiRowView, aiRowKind, aiRowHref, richSegments, rowsToCsv,
  threadToCsv, printRowsHtml, printThreadHtml, withoutActionKeys, recentRows, footerGroups, safeCell, isSensitiveKey, rowColumns,
  HOME_SCOPES, HOME_RECENT_VALUES, parseHomeParams, homeDirectiveKey, homeScopeTitle, SCOPE_TITLE_REST, applyScope, scopedAdvFields,
  RENTAL_STATE_STYLE, rentalStatus,
} from '../app/components/home/homeLogic.js';
import { isBarcodeLikeQuery } from '../lib/quickSearchResults.js';
import { HOME_NAV_EVENT, homeNavTarget } from '../lib/menu/homeNav.js';
import { QUICK_PREFIXES, detectQuickPrefix, filterPrefixRows, splitMatch } from '../lib/quickPrefix.js';
import { buildMenuTree as buildMenuTreeRaw } from '../lib/menu/buildMenuTree.js';
const buildMenuTree = (ctx) => buildMenuTreeRaw({ homeA5: true, ...ctx });
import {
  emptyAdv, visibleFoci, navPathSet, buildAdvRequest, unsavedOrderIds, advSummaryParts, advAiPrompt, normalizeAdvResponse,
  ADV_FOCI, ADV_KEYS, ADV_TAG, advMissing, normalizeCapstats, CAP_TILES,
} from '../app/components/home/homeAdvConfig.js';
import { hebText, hebFromInstant, hebMonthStart, hebMonthShift, hebMonthGrid, hebrewYearLetters, isoOf, dateOf } from '../app/components/home/homeDates.js';
import * as advConfig from '../app/components/home/homeAdvConfig.js';
import { ORDER_STATUS_STYLE } from '../app/components/home/homeLogic.js';
import { PRIVACY_SECTIONS, splitPlaceholders, PRIVACY_PLACEHOLDER_COUNT } from '../app/components/home/privacyPolicyText.js';
import { SPRITE_SYMBOLS, SPRITE_ID_PREFIX } from '../app/components/menu/spriteSymbols.js';
import { readFileSync, readdirSync } from 'node:fs';

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

console.log('כותרת');
t('הגדרה ריקה → "ברוכים הבאים לגמ״ח" בשורה אחת, גם כשיש שם', () => {
  assert.deepEqual(buildGreeting('', 'רחל'), { hi: null, q: DEFAULT_TITLE });
  assert.deepEqual(buildGreeting(undefined, ''), { hi: null, q: DEFAULT_TITLE });
  assert.deepEqual(buildGreeting('   ', 'רחל'), { hi: null, q: DEFAULT_TITLE });
});
t('"שלום! מה תרצי לחפש?" → "שלום [שם]," + שורה שנייה', () => {
  assert.deepEqual(buildGreeting('שלום! מה תרצי לחפש?', 'שולמית'), { hi: 'שלום שולמית,', q: 'מה תרצי לחפש?' });
});
t('"שלום!" בלי עובדת מחוברת נשאר "שלום"', () => {
  assert.deepEqual(buildGreeting('שלום! מה תרצי לחפש?', ''), { hi: 'שלום', q: 'מה תרצי לחפש?' });
});
t('הגדרה בלי סימן קריאה + עובדת → ברכה בשם ומתחת ההגדרה', () => {
  assert.deepEqual(buildGreeting('ברוכים הבאים למערכת', 'אסתר'), { hi: 'שלום אסתר,', q: 'ברוכים הבאים למערכת' });
  assert.deepEqual(buildGreeting('ברוכים הבאים למערכת', ''), { hi: null, q: 'ברוכים הבאים למערכת' });
});
t('סימן קריאה בסוף בלי המשך = שורה אחת', () => {
  assert.deepEqual(buildGreeting('ברוכים הבאים!', 'דינה'), { hi: 'שלום דינה,', q: 'ברוכים הבאים!' });
});
t('"בוקר טוב! מה תרצי לחפש?" שומר את הפתיחה כמו שהיא', () => {
  assert.deepEqual(buildGreeting('בוקר טוב! מה תרצי לחפש?', 'דינה'), { hi: 'בוקר טוב', q: 'מה תרצי לחפש?' });
});

t('נוסח ברירת המחדל הישן ("ברוכים הבאים למערכת ניהול הגמ"ח") = לא הותאם → הנוסח המוסכם "שלום [שם]," + "מה תרצי לחפש?"', () => {
  const want = { hi: 'שלום שולמית,', q: 'מה תרצי לחפש?' };
  const variants = [
    'ברוכים הבאים למערכת ניהול הגמ"ח',          // " ASCII
    'ברוכים הבאים למערכת ניהול הגמ״ח',     // ״ גרשיים
    'ברוכים הבאים למערכת ניהול הגמ”ח',     // ”
    'ברוכים הבאים למערכת ניהול הגמ“ח',     // “
    'ברוכים הבאים למערכת ניהול הגמ„ח',     // „
    "ברוכים הבאים למערכת ניהול הגמ''ח",         // שני גרשים
    "ברוכים הבאים למערכת ניהול הגמ'ח",          // גרש יחיד
    'ברוכים הבאים למערכת ניהול הגמ’ח',
    '  ברוכים הבאים  למערכת ניהול הגמ"ח  ', // רווח קשיח, רווחים כפולים, רווחים בקצוות
    'ברוכים הבאים למערכת ניהול הגמ"ח‏',
  ];
  for (const v of variants) {
    assert.ok(isLegacyDefaultTitle(v), JSON.stringify(v));
    assert.deepEqual(buildGreeting(v, 'שולמית'), want, JSON.stringify(v));
  }
  assert.ok(isLegacyDefaultTitle(LEGACY_DEFAULT_TITLE));
  // בלי עובדת מחוברת: "שלום" + השורה השנייה (כמו "שלום! מה תרצי לחפש?" בעיצוב)
  assert.deepEqual(buildGreeting('ברוכים הבאים למערכת ניהול הגמ"ח', ''), { hi: 'שלום', q: 'מה תרצי לחפש?' });
});
t('נוסח מותאם אמיתי נשאר כמו שהוא (ברכה בשם + הטקסט המותאם); ריק → "ברוכים הבאים לגמ״ח"', () => {
  assert.equal(isLegacyDefaultTitle('ברוכים הבאים למערכת ניהול הגמ"ח של נווה'), false);
  assert.equal(isLegacyDefaultTitle('ברוכים הבאים למערכת'), false);
  assert.equal(isLegacyDefaultTitle(''), false); assert.equal(isLegacyDefaultTitle(null), false);
  assert.deepEqual(buildGreeting('ברוכים הבאים למערכת ניהול הגמ"ח של נווה', 'אסתר'), { hi: 'שלום אסתר,', q: 'ברוכים הבאים למערכת ניהול הגמ"ח של נווה' });
  assert.deepEqual(buildGreeting('', 'אסתר'), { hi: null, q: DEFAULT_TITLE });
  assert.deepEqual(buildGreeting(null, ''), { hi: null, q: 'ברוכים הבאים לגמ״ח' });
});
t('המחרוזת המדויקת של העיצוב "שלום! מה תרצי לחפש?" מתפצלת כמו בעיצוב', () => {
  assert.deepEqual(buildGreeting('שלום! מה תרצי לחפש?', 'שולמית'), { hi: 'שלום שולמית,', q: 'מה תרצי לחפש?' });
  assert.equal(normalizeTitleForCompare('א  ב'), 'א ב');
});

console.log('חיפוש כללי');
const RAW = {
  customers: [{ id: 'u1', firstName: 'רחל', lastName: 'כהן', phone1: '052-4418210', city: 'ירושלים', zeout: '123456789', bankAccount: '999', officeNotes: 'סודי' }, { id: 'u2', firstName: null, lastName: 'לוי', phone1: null, city: null }],
  orders: [{ id: 'o1', orderId: 48131, firstName: 'רחל', lastName: 'כהן', eventDateHebrew: 'י״ג תשרי', totalAmount: 900, itemCount: '2', status: '', internalNotes: 'פנימי' }, { id: 'o2', orderId: 47890, firstName: 'לאה', lastName: 'פרידמן', eventDateHebrew: null, totalAmount: null, itemCount: null, status: 'הוחזר' }],
  rentals: [{ orderId: 48131, catalogName: 'שמלת ורד', barcode: null, catalogBarcode: '1024038', sizeText: '38' }, { orderId: 1, description: 'תיאור', barcode: 'B1', sizeText: null }],
};
t('נרמול: מיפוי שדות וחלופות', () => {
  const r = normalizeSearch(RAW);
  assert.equal(r.customers[0].n, 'רחל כהן');
  assert.equal(r.customers[0].nr, 'כהן רחל');
  assert.equal(r.customers[1].n, 'לוי');
  assert.equal(r.customers[1].p, '');
  assert.equal(r.customers[0].url, '/customers/u1');
  assert.equal(r.orders[0].i, 2);
  assert.equal(r.orders[1].h, '');
  assert.equal(r.orders[1].t, 0);
  assert.equal(r.orders[0].url, '/orders/48131');
  assert.equal(r.rentals[0].b, '1024038');
  assert.equal(r.rentals[1].n, 'תיאור');
  assert.equal(r.rentals[1].s, '');
  assert.equal(resultsCount(r), 6);
});
t('נרמול: שדות רגישים של השרת (ת"ז, בנק, הערות פנימיות) לא עוברים לצד הלקוח', () => {
  const json = JSON.stringify(normalizeSearch(RAW));
  for (const bad of ['zeout', '123456789', 'bankAccount', '999', 'officeNotes', 'סודי', 'internalNotes', 'פנימי']) {
    assert.ok(!json.includes(bad), 'דלף: ' + bad);
  }
});
t('נרמול: קלט ריק/חסר', () => {
  assert.deepEqual(normalizeSearch(null), { customers: [], orders: [], rentals: [] });
  assert.deepEqual(normalizeSearch({}), { customers: [], orders: [], rentals: [] });
  assert.equal(resultsCount(null), 0);
});
t('נרמול: מצב פריט (מושכר עכשיו / הוחזר / טרם נלקח) רק כשהשרת שלח את הדגלים', () => {
  const r = normalizeSearch({ rentals: [{ orderId: 1, barcode: 'B', isTaken: true, isReturned: false }, { orderId: 2, barcode: 'B', isTaken: true, isReturned: true }, { orderId: 3, barcode: 'B', isTaken: false, isReturned: false }, { orderId: 4, barcode: 'B' }] });
  assert.deepEqual(r.rentals.map((x) => x.rs), ['מושכר עכשיו', 'הוחזר', 'טרם נלקח', undefined]);
  assert.deepEqual(unifiedRows(r).map((x) => x.state), ['מושכר עכשיו', 'הוחזר', 'טרם נלקח', '']);
});
t('סטטוס הזמנה: ארבעה ערכים, השאר "פעיל"', () => {
  assert.deepEqual(orderStatus('הוחזר'), { cls: 'ok', icon: 'check', label: 'הוחזר' });
  assert.deepEqual(orderStatus('בוטל'), { cls: 'warn', icon: 'x', label: 'בוטל' });
  assert.deepEqual(orderStatus('מושכר'), { cls: '', icon: 'bag', label: 'מושכר' });
  assert.deepEqual(orderStatus(''), { cls: '', icon: 'clock', label: 'פעיל' });
  assert.deepEqual(orderStatus('מצב לא מוכר'), { cls: '', icon: 'clock', label: 'מצב לא מוכר' });
});
t('רשימה מאוחדת: סדר לקוחות, הזמנות, פריטים וכל שורה מסמנת מה היא', () => {
  const rows = unifiedRows(normalizeSearch(RAW));
  assert.deepEqual(rows.map((r) => r.kind), ['לקוח', 'לקוח', 'הזמנה', 'הזמנה', 'פריט', 'פריט']);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, 'מפתחות ייחודיים');
  assert.equal(rows[2].status.label, 'פעיל');
  assert.equal(rows[3].status.label, 'הוחזר');
  assert.deepEqual(unifiedRows(null), []);
});
t('טבלה: 9 עמודות ותאי כל סוג', () => {
  const rec = tableRecords(unifiedRows(normalizeSearch(RAW)));
  assert.deepEqual(TABLE_COLUMNS, ['סוג', 'שם', 'טלפון', 'עיר', 'מזהה / ברקוד', 'הזמנה', 'לקוח', 'תאריך אירוע', 'סטטוס / מידה']);
  assert.ok(rec.every((r) => r.cells.length === TABLE_COLUMNS.length));
  assert.deepEqual(rec[0].cells, ['לקוח', 'רחל כהן', '052-4418210', 'ירושלים', '', '', '', '', '']);
  assert.deepEqual(rec[2].cells, ['הזמנה', 'רחל כהן', '', '', '#48131', '', '', 'י״ג תשרי', 'פעיל']);
  assert.deepEqual(rec[4].cells, ['פריט', 'שמלת ורד', '', '', '1024038', '#48131', '', '', 'מידה 38']);
  assert.equal(rec[5].cells[8], '', 'אין מידה = ריק');
});

console.log('חיפוש ברקוד: כל השכרה של אותו פריט בשורה משלה (4.10.2026)');
// אותו ברקוד בשלוש השכרות שונות — כמו שהשרת מחזיר אחרי ה-JOIN ל-Order/Customer
const BC = {
  rentals: [
    { id: 'i1', orderId: 52001, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: true, isReturned: false, firstName: 'רחל', lastName: 'כהן', eventDateHebrew: 'ט״ו תשרי תשפ״ז', eventDate: '2026-10-03T00:00:00.000Z' },
    { id: 'i2', orderId: 47310, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: true, isReturned: true, firstName: 'לאה', lastName: null, eventDateHebrew: null, eventDate: '2025-06-11T21:00:00.000Z' },
    { id: 'i3', orderId: 39002, catalogName: '551', barcode: '5511205', sizeText: '12', isTaken: false, isReturned: false, firstName: null, lastName: null, eventDateHebrew: '', eventDate: null },
  ],
};
t('נרמול: לקוחה ותאריך אירוע לכל השכרה; תאריך עברי בלבד (שמור, או מחושב לפי יום ישראלי)', () => {
  const r = normalizeSearch(BC).rentals;
  assert.deepEqual(r.map((x) => x.cn), ['רחל כהן', 'לאה', '']);
  assert.equal(r[0].h, 'ט״ו תשרי תשפ״ז', 'הטקסט השמור בהזמנה קודם');
  // 2025-06-11T21:00Z = 12.6.2025 בישראל (לא 11.6 לפי UTC)
  assert.equal(r[1].h, hebText('2025-06-12'));
  assert.notEqual(r[1].h, hebText('2025-06-11'));
  assert.equal(r[2].h, '', 'אין תאריך = ריק, בלי מקף');
  for (const x of r) assert.ok(!/\d|[./]/.test(x.h), 'תאריך לועזי דלף: ' + x.h);
});
t('hebFromInstant: יום ישראלי, ריק לערך חסר/לא תקין', () => {
  assert.equal(hebFromInstant('2026-10-03T00:00:00.000Z'), hebText('2026-10-03'));
  assert.equal(hebFromInstant('2026-10-02T21:30:00.000Z'), hebText('2026-10-03'), 'אחרי חצות בישראל = היום הבא');
  assert.equal(hebFromInstant(new Date('2026-10-03T09:00:00Z')), hebText('2026-10-03'));
  for (const v of [null, undefined, '', 'לא תאריך']) assert.equal(hebFromInstant(v), '');
});
t('שורות פריט: הזמנה, לקוחה, תאריך עברי ותגית מצב; חלק חסר = ריק (בלי מקף)', () => {
  const rows = unifiedRows(normalizeSearch(BC));
  assert.equal(new Set(rows.map((x) => x.key)).size, 3, 'שלוש שורות נפרדות');
  assert.deepEqual(rows.map((x) => x.orderId), [52001, 47310, 39002]);
  assert.deepEqual(rows.map((x) => x.customer), ['רחל כהן', 'לאה', '']);
  assert.deepEqual(rows.map((x) => x.eventHeb), ['ט״ו תשרי תשפ״ז', hebText('2025-06-12'), '']);
  assert.deepEqual(rows.map((x) => x.status), [
    { cls: '', icon: 'bag', label: 'מושכר עכשיו' },
    { cls: 'ok', icon: 'check', label: 'הוחזר' },
    { cls: '', icon: 'clock', label: 'טרם נלקח' },
  ]);
  assert.equal(unifiedRows(normalizeSearch({ rentals: [{ orderId: 1, barcode: 'B' }] }))[0].status, null, 'בלי דגלים — בלי תגית');
});
t('מצב פריט → תגית: שלושת המצבים בלבד; ערך לא מוכר (גם constructor) = null', () => {
  assert.deepEqual(Object.keys(RENTAL_STATE_STYLE), ['מושכר עכשיו', 'הוחזר', 'טרם נלקח']);
  for (const k of ['', 'constructor', '__proto__', 'מושכר', undefined]) assert.equal(rentalStatus(k), null, String(k));
  // תווית התגית = התווית של rentalStateLabel (אותו ניסוח בכל המסכים)
  assert.deepEqual([{ isTaken: true, isReturned: false }, { isTaken: true, isReturned: true }, { isTaken: false, isReturned: false }].map((x) => rentalStatus(normalizeSearch({ rentals: [{ orderId: 1, ...x }] }).rentals[0].rs).label), ['מושכר עכשיו', 'הוחזר', 'טרם נלקח']);
});
t('טבלה + Excel של השכרות: הזמנה, לקוח, תאריך עברי, מצב ומידה', () => {
  const rec = tableRecords(unifiedRows(normalizeSearch(BC)));
  assert.deepEqual(rec[0].cells, ['פריט', '551', '', '', '5511205', '#52001', 'רחל כהן', 'ט״ו תשרי תשפ״ז', 'מושכר עכשיו · מידה 12']);
  assert.deepEqual(rec[2].cells, ['פריט', '551', '', '', '5511205', '#39002', '', '', 'טרם נלקח · מידה 12']);
  const ex = exportRecordsForRows(unifiedRows(normalizeSearch(BC)));
  assert.equal(ex[1]['הזמנה'], '#47310');
  assert.equal(ex[1]['לקוח'], 'לאה');
  assert.equal(ex[1]['תאריך אירוע'], hebText('2025-06-12'));
  assert.equal(ex[1]['סטטוס / מידה'], 'הוחזר · מידה 12');
  // רק שדות תצוגה — לא eventDate גולמי ולא שדות לא מוכרים מהשרת
  const json = JSON.stringify(normalizeSearch({ rentals: [{ ...BC.rentals[1], zeout: '123456789', phone1: '050' }] }));
  for (const bad of ['zeout', '123456789', 'eventDate', '2025-06-11', 'phone1']) assert.ok(!json.includes(bad), 'דלף: ' + bad);
});
t('זיהוי חיפוש-ברקוד (משותף לשרת ולחיפוש המהיר): ספרות בלבד, 5 ומעלה', () => {
  for (const yes of ['5511205', '12345', ' 5511205 ']) assert.equal(isBarcodeLikeQuery(yes), true, yes);
  for (const no of ['1234', 'ddddd', 'd{5,}', '55112a5', '551 1205', '', null, 'כהן']) assert.equal(isBarcodeLikeQuery(no), false, String(no));
});
t('מיון: מספרים לפי ערך, טקסט בעברית, לא משנה את המקור', () => {
  const recs = [{ cells: ['x', '#10'] }, { cells: ['y', '#9'] }, { cells: ['z', '#100'] }];
  assert.deepEqual(sortRecords(recs, 1, 1).map((r) => r.cells[1]), ['#9', '#10', '#100']);
  assert.deepEqual(sortRecords(recs, 1, -1).map((r) => r.cells[1]), ['#100', '#10', '#9']);
  assert.deepEqual(recs.map((r) => r.cells[1]), ['#10', '#9', '#100']);
  const names = [{ cells: ['ת'] }, { cells: ['א'] }, { cells: ['ג'] }];
  assert.deepEqual(sortRecords(names, 0, 1).map((r) => r.cells[0]), ['א', 'ג', 'ת']);
});
t('ייצוא: אובייקט לכל שורה עם כותרות הטבלה', () => {
  const ex = exportRecordsForRows(unifiedRows(normalizeSearch(RAW)));
  assert.deepEqual(Object.keys(ex[0]), TABLE_COLUMNS);
  assert.equal(ex[2]['מזהה / ברקוד'], '#48131');
});

console.log('חיפוש חכם');
t('תגיות: OPEN_SETTING, OPEN_LINK, FILTER מוסרים מהטקסט', () => {
  const r = parseAiTags('זו ההגדרה. [OPEN_SETTING:morning_hour] ראו [OPEN_LINK:/settings|עמוד ההגדרות] [FILTER:ורד]');
  assert.equal(r.t, 'זו ההגדרה.  ראו');
  assert.deepEqual(r.settingKeys, ['morning_hour']);
  assert.deepEqual(r.links, [{ route: '/settings', label: 'עמוד ההגדרות' }]);
  assert.equal(r.filter, 'ורד');
  assert.equal(parseAiTags(null).t, '');
});
t('OPEN_LINK: רק נתיב פנימי', () => {
  assert.equal(safeInternalRoute('/admin/settings'), '/admin/settings');
  assert.equal(safeInternalRoute('//evil.com'), '');
  assert.equal(safeInternalRoute('https://evil.com'), '');
  assert.equal(safeInternalRoute('javascript:alert(1)'), '');
  assert.equal(safeInternalRoute(''), '');
  // צורות שהדפדפן מתייחס אליהן כ"//" או כתובת חיצונית
  for (const bad of ['/\\evil.com', '/\\/evil.com', '/%5Cevil.com', '/%5cevil.com', '/%2Fevil.com', '\\evil.com', '/a\\b', '/ evil', '/a\tb', '/a\nb', '/\u0000x', 'orders/1', '//\\evil.com', 'http:evil.com', '/‮evil']) {
    assert.equal(safeInternalRoute(bad), '', JSON.stringify(bad));
  }
  assert.equal(safeInternalRoute('/orders/123?x=1#y'), '/orders/123?x=1#y');
  assert.equal(safeInternalRoute('/'), '/');
  assert.equal(safeInternalRoute('/rentals?orderId=77'), '/rentals?orderId=77');
  assert.equal(aiRowHref({ _actionUrl: '/\\evil.com' }), '');
  const m = botMessageFromResponse({ response: 'ראו [OPEN_LINK:https://evil.com|אתר]' });
  assert.equal(m.linkRoute, '');
  assert.equal(m.link, 'אתר');
});
t('הודעת בוט: שורות, הגדרה וקישור', () => {
  const m = botMessageFromResponse({ response: 'x [OPEN_SETTING:k1]', data: [{ a: 1 }] });
  assert.equal(m.setting, 'k1');
  assert.deepEqual(m.rows, [{ a: 1 }]);
  assert.equal(m.raw, 'x [OPEN_SETTING:k1]');
  assert.equal(botMessageFromResponse({ response: 'ok', data: [] }).rows, null);
  assert.equal(botMessageFromResponse(null).t, '');
});
t('הודעת שגיאה: כשל שרת מול כשל רשת', () => {
  assert.deepEqual(botErrorMessage(500), { err: true, t: 'שגיאה בחיפוש חכם.' });
  assert.deepEqual(botErrorMessage(0), { err: true, t: 'שגיאת תקשורת.' });
});
t('היסטוריה לשרת: בלי שגיאות, עם הטקסט המקורי של התשובות', () => {
  const chat = [{ me: true, t: 'שאלה' }, { t: 'נקי', raw: 'מקורי [OPEN_SETTING:k]' }, { err: true, t: 'שגיאה' }, { me: true, t: 'עוד' }];
  assert.deepEqual(chatToHistory(chat), [
    { role: 'user', content: 'שאלה' }, { role: 'model', content: 'מקורי [OPEN_SETTING:k]' }, { role: 'user', content: 'עוד' },
  ]);
  assert.deepEqual(chatToHistory(null), []);
});
t('העתקת הודעה: טקסט + טבלה מופרדת בטאב בלי עמודות _action', () => {
  const m = { t: 'תשובה', rows: [{ שם: 'רחל', סכום: 5, _actionUrl: '/orders/1' }, { שם: 'לאה', סכום: null }] };
  assert.equal(chatCopyText(m), 'תשובה\n\nשם\tסכום\nרחל\t5\nלאה\t');
  assert.equal(chatCopyText({ t: 'רק טקסט' }), 'רק טקסט');
  assert.equal(chatCopyText(null), '');
});
t('שורת AI: כותרת מעמודת שם, פרטים, קישור וסוג', () => {
  const r = { 'מספר הזמנה': '48133', 'לקוחה': 'מלכה רוזן', חוב: '₪450', ריק: '', _actionUrl: '/orders/48133', _actionLabel: 'פתיחה' };
  const v = aiRowView(r);
  assert.equal(v.title, 'מלכה רוזן');
  assert.deepEqual(v.parts, [{ k: 'מספר הזמנה', v: '48133' }, { k: 'חוב', v: '₪450' }]);
  assert.deepEqual(aiRowKind(r), ['הזמנה', 'file']);
  assert.deepEqual(aiRowKind({ _actionUrl: '/customers/x' }), ['לקוח', 'user']);
  assert.deepEqual(aiRowKind({}), ['רשומה', 'file']);
  assert.equal(aiRowHref(r), '/orders/48133');
  assert.equal(aiRowHref({ _actionUrl: 'https://evil.com' }), '');
});
t('טקסט עשיר: טלפון/מייל = העתקה, הזמנה N / לקוח X = קישור, בלי HTML גולמי', () => {
  const segs = richSegments('התקשרי בטלפון 052-4418210 או mail@a.co בעניין הזמנה 48133 ולקוח abc-1 <b>x</b>');
  assert.deepEqual(segs.filter((s) => s.type === 'copy').map((s) => s.value), ['052-4418210', 'mail@a.co']);
  assert.deepEqual(segs.filter((s) => s.type === 'link').map((s) => s.href), ['/orders/48133', '/customers/abc-1']);
  assert.ok(segs.some((s) => s.type === 'text' && s.value.includes('<b>x</b>')), 'תגית נשארת טקסט (React מבריח)');
  assert.deepEqual(richSegments(''), []);
  assert.deepEqual(richSegments('לקוח חדש'), [{ type: 'text', value: 'לקוח חדש' }]);
});

console.log('ייצוא');
t('CSV: מירכאות מוכפלות, בלי _action', () => {
  const csv = rowsToCsv([{ a: 'x"y', b: 'ש,ם', _actionUrl: '/u' }]);
  assert.equal(csv, '"a","b"\r\n"x""y","ש,ם"');
  assert.equal(rowsToCsv([]), '');
});
t('CSV שרשור: שאלות, תשובות וטבלאות; שגיאות מדולגות', () => {
  const csv = threadToCsv([{ me: true, t: 'ש' }, { t: 'ת', rows: [{ a: 1 }] }, { err: true, t: 'x' }]);
  assert.equal(csv, '"שאלה","ש"\r\n\r\n"תשובה","ת"\r\n"a"\r\n"1"\r\n');
});
t('HTML הדפסה: RTL, בריחת תווים, בלי משתני ערכת נושא', () => {
  const html = printRowsHtml('כותרת <x>', [{ a: '<script>alert(1)</script>', _actionUrl: '/u' }]);
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(!html.includes('<script>'), 'בריחה');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('var(--'), 'בלי משתני ערכת נושא');
  assert.ok(printThreadHtml('שיחה', [{ me: true, t: 'שלום' }, { t: 'ת', rows: [{ a: 1 }] }]).includes('<h2>שאלה</h2>'));
  assert.deepEqual(withoutActionKeys([{ a: 1, _actionX: 2 }]), [{ a: 1 }]);
});

console.log('אבטחה בצד הלקוח');
t('CSV: תא שמתחיל ב- = + - @ טאב/CR מקבל גרש; מספרים וטלפון נשארים', () => {
  assert.equal(safeCell('=HYPERLINK("http://x","y")'), "'=HYPERLINK(\"http://x\",\"y\")");
  assert.equal(safeCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(safeCell('-2+3'), "'-2+3");
  assert.equal(safeCell('+cmd|calc'), "'+cmd|calc");
  assert.equal(safeCell('\tx'), "'\tx");
  assert.equal(safeCell('\rx'), "'\rx");
  assert.equal(safeCell('+972-50-1234567'), '+972-50-1234567');
  assert.equal(safeCell('-5'), '-5');
  assert.equal(safeCell('052-4418210'), '052-4418210');
  assert.equal(safeCell('רגיל'), 'רגיל');
  assert.equal(safeCell(null), '');
  assert.equal(safeCell(12), '12');
  assert.equal(rowsToCsv([{ a: '=1+1', b: 'x' }]), '"a","b"\r\n"\'=1+1","x"');
  assert.ok(threadToCsv([{ me: true, t: '=evil()' }]).includes('"\'=evil()"'));
  assert.equal(chatCopyText({ t: 't', rows: [{ a: '=1+1' }] }), "t\n\na\n'=1+1");
});
t('עמודות רגישות בתוצאות AI לא מוצגות ולא מיוצאות', () => {
  for (const k of ['zeout', 'bankAccount', 'hokBankName', 'internalNotes', 'officeNotes', 'פרטי בנק', 'ת"ז', 'ת״ז', 'תעודת זהות', 'הערות פנימיות']) assert.ok(isSensitiveKey(k), k);
  for (const k of ['שם', 'טלפון', 'חוב', 'עיר', 'מספר הזמנה']) assert.ok(!isSensitiveKey(k), k);
  const rows = [{ שם: 'רחל', zeout: '123456789', bankAccount: '9', 'הערות פנימיות': 'x', _actionUrl: '/orders/1' }];
  assert.deepEqual(rowColumns(rows), ['שם']);
  assert.deepEqual(withoutActionKeys(rows), [{ שם: 'רחל' }]);
  assert.ok(!rowsToCsv(rows).includes('123456789'));
  assert.ok(!chatCopyText({ t: '', rows }).includes('123456789'));
  assert.ok(!printRowsHtml('x', rows).includes('123456789'));
  assert.deepEqual(aiRowView(rows[0]).parts, []);
});
t('קישורי תוצאות מחיפוש מתקדם: רק פנימיים', () => {
  const r = normalizeAdvResponse({ links: ['/orders/1', '/\\evil.com', 'https://evil.com', '//evil.com', ''] });
  assert.deepEqual(r.links, ['/orders/1', '', '', '', '']);
});

console.log('אחרונים');
t('agy_history → שורות: סוגים מוכרים, מזהה בטוח, שם ברירת מחדל', () => {
  const rows = recentRows([
    { type: 'order', id: 52103, name: 'רחל כהן', subtext: 'הזמנה 52103', timestamp: 5 },
    { type: 'customer', id: 'abc-1', name: '  ' },
    { type: 'dress', id: 'd1', name: 'ורד' },
    { type: 'rental', id: 77, name: 'השכרה' },
    { type: 'other', id: 1 },
    { type: 'order', id: '../../x' },
    null,
  ]);
  assert.deepEqual(rows.map((r) => r.url), ['/orders/52103', '/customers/abc-1', '/dashboard/dresses/d1', '/rentals?orderId=77']);
  assert.equal(rows[1].title, 'לקוח abc-1');
  assert.equal(rows[0].kind, 'הזמנה');
  assert.deepEqual(recentRows('x'), []);
  assert.deepEqual(recentRows(undefined), []);
});

console.log('תחתית');
t('קישורי תחתית: כל פריטי העיצוב מופיעים; לא נבנה / לא מותר = soon (בלי href), מותר = קישור', () => {
  const nav = [{ items: [{ href: '/orders' }, { href: '/customers' }] }];
  const keys = (g) => g.links.map((l) => l.key);
  const soonKeys = (g) => g.links.filter((l) => l.soon).map((l) => l.key);
  let g = footerGroups({ navGroups: nav, isHead: false, authenticated: true });
  assert.deepEqual(g.map((x) => x.h), ['ניווט מהיר', 'עזרה', 'החשבון שלי']);
  assert.deepEqual(keys(g[0]), ['orders', 'customers', 'dresses', 'dashboard']);
  assert.deepEqual(soonKeys(g[0]), ['dresses', 'dashboard'], 'שמלות (אין הרשאה) וסיכום כספי (לא הנהלה) = בקרוב');
  assert.equal(g[0].links[0].href, '/orders'); assert.equal(g[0].links[0].soon, undefined);
  assert.deepEqual(keys(g[1]), ['guide', 'report']);
  assert.equal(g[1].links[0].soon, true, 'מדריך למשתמש: אין דף');
  assert.equal(g[1].links[1].action, 'report'); assert.equal(g[1].links[1].href, undefined);
  assert.deepEqual(keys(g[2]), ['profile', 'display']); assert.deepEqual(soonKeys(g[2]), []);
  assert.equal(g[2].privacy, true);
  g = footerGroups({ navGroups: [...nav, { items: [{ href: '/dashboard/dresses' }] }], isHead: true, authenticated: true });
  assert.deepEqual(soonKeys(g[0]), []);
  assert.equal(g[0].links[3].href, '/dashboard');
  g = footerGroups({ navGroups: null, isHead: false, authenticated: false });
  assert.deepEqual(soonKeys(g[0]), ['orders', 'customers', 'dresses', 'dashboard']);
  assert.deepEqual(soonKeys(g[2]), ['profile', 'display']);
  assert.equal(g[2].privacy, true, 'מדיניות פרטיות תמיד זמינה');
  // שורת "בקרוב" לעולם לא נושאת href (לא קישור)
  for (const grp of g) for (const l of grp.links) if (l.soon) assert.ok(!('href' in l), l.key);
});

console.log('חיפוש מתקדם');
t('תחומים לפי הגדרות ותפקיד', () => {
  const all = navPathSet([{ items: ['/customers', '/orders', '/rentals#rented', '/alterations', '/deliveries', '/dashboard/dresses'].map((href) => ({ href })) }]);
  let v = visibleFoci({ settings: {}, isManager: false, navPaths: all });
  assert.deepEqual(v.main, ['customers', 'orders', 'rentals', 'returns', 'alterations', 'capacity']);
  assert.deepEqual(v.extra, []);
  v = visibleFoci({ settings: { enable_deliveries: 'true', enable_alterations: 'false' }, isManager: true, isHead: true, navPaths: all });
  assert.deepEqual(v.main, ['customers', 'orders', 'rentals', 'returns', 'deliveries', 'capacity']);
  assert.deepEqual(v.extra, ['models', 'employees']);
  assert.ok(!('finance' in ADV_FOCI) && !('stock' in ADV_FOCI) && !('settings' in ADV_FOCI), 'כספים / בדיקת מלאי / הגדרות לא בחיפוש המתקדם');
});
t('תחומים לפי הרשאות התפריט (navPaths): עובדת בלי "הזמנות" לא רואה את התחום', () => {
  const nav = [{ items: [{ href: '/' }, { href: '/customers' }, { href: '/rentals#rented' }, { href: '/rentals#returned' }, { href: '/alterations' }] }];
  const paths = navPathSet(nav);
  assert.ok(paths.has('/rentals') && paths.has('/customers') && !paths.has('/orders'));
  let v = visibleFoci({ settings: {}, isManager: false, navPaths: paths });
  assert.deepEqual(v.main, ['customers', 'rentals', 'returns', 'alterations'], 'בלי "הזמנות" גם תפוסה מוסתרת');
  v = visibleFoci({ settings: { enable_deliveries: 'true' }, isManager: false, navPaths: paths });
  assert.ok(!v.main.includes('deliveries'), 'משלוחים דורש גם עמוד מותר');
  assert.deepEqual(visibleFoci({ settings: {}, isManager: false, navPaths: navPathSet([{ items: [] }]) }).main, []);
  assert.equal(navPathSet(null), null);
  assert.deepEqual(visibleFoci({ settings: {}, isManager: true, isHead: true, navPaths: null }), { main: [], extra: [] }, 'בלי מידע הרשאות: נעילה סגורה');
  const full = navPathSet([{ items: [{ href: '/customers' }, { href: '/orders' }, { href: '/rentals#rented' }, { href: '/alterations' }, { href: '/dashboard/dresses' }] }]);
  assert.deepEqual(visibleFoci({ settings: {}, isManager: true, isHead: false, navPaths: full }).extra, ['models'], 'מנהלת סניף: דגמים כן, עובדים לא');
  assert.deepEqual(visibleFoci({ settings: {}, isManager: true, isHead: true, navPaths: full }).extra, ['models', 'employees']);
  assert.deepEqual(visibleFoci({ settings: {}, isManager: true, isHead: true, navPaths: navPathSet([{ items: [{ href: '/orders' }] }]) }).extra, ['employees'], 'דגמים דורש את עמוד הקטלוג');
});
t('בקשת adv: רק מפתחות מוכרים, מסונן ומקוצץ, flags/ost כמערכים', () => {
  const a = { ...emptyAdv('customers'), first: ' רחל ', phone: '', flags: ['debts'], ost: [] };
  const url = buildAdvRequest('customers', a);
  assert.ok(url.startsWith('/api/a5/adv?'));
  const qs = new URL('http://x' + url).searchParams;
  assert.equal(qs.get('focus'), 'customers');
  assert.deepEqual(JSON.parse(qs.get('adv')), { first: 'רחל', flags: ['debts'] });
  assert.equal(qs.get('unsaved'), null);
});
t('בקשת adv: "לא נשמר" מטיוטות localStorage רק לתחומים שאינם לקוחות', () => {
  const now = 1_000_000_000_000;
  const store = new Map([
    ['gemachOrderDraft:123', JSON.stringify({ savedAt: now - 1000, state: {} })],
    ['gemachOrderDraft:124', JSON.stringify({ savedAt: now - 40 * 86400000, state: {} })],
    ['gemachOrderDraft:xyz', JSON.stringify({ savedAt: now, state: {} })],
    ['gemachOrderDraft:125', 'לא JSON'],
    ['other', '1'],
  ]);
  const storage = { get length() { return store.size; }, key: (i) => [...store.keys()][i], getItem: (k) => store.get(k) };
  assert.deepEqual(unsavedOrderIds(storage, now), [123]);
  const fresh = new Map([['gemachOrderDraft:321', JSON.stringify({ savedAt: Date.now() - 1000, state: {} })]]);
  const freshStorage = { get length() { return fresh.size; }, key: (i) => [...fresh.keys()][i], getItem: (k) => fresh.get(k) };
  const url = buildAdvRequest('orders', emptyAdv('orders'), freshStorage);
  assert.equal(new URL('http://x' + url).searchParams.get('unsaved'), '321', 'orders מקבל unsaved');
  assert.ok(!buildAdvRequest('customers', emptyAdv('customers'), freshStorage).includes('unsaved='));
  assert.deepEqual(unsavedOrderIds({ get length() { throw new Error('חסום'); } }), []);
});
t('בקשת adv-b: כל המפתחות המלאים והרשימות מופרדות בפסיק', () => {
  const a = { ...emptyAdv('deliveries'), city: 'ירושלים', flags: ['dl_out', 'dl_back'], ost: ['ds_today'] };
  const url = buildAdvRequest('deliveries', a);
  assert.ok(url.startsWith('/api/a5/adv-b?'));
  const qs = new URL('http://x' + url).searchParams;
  assert.equal(qs.get('focus'), 'deliveries');
  assert.equal(qs.get('city'), 'ירושלים');
  assert.equal(qs.get('flags'), 'dl_out,dl_back');
  assert.equal(qs.get('ost'), 'ds_today');
  assert.equal(buildAdvRequest('nope', {}), null);
  assert.ok(ADV_KEYS.includes('branch'));
});
t('סיכום סינונים: תוויות, תאריכים עבריים, סימונים וסטטוסים', () => {
  const a = { ...emptyAdv('orders'), name: 'כהן', from: '2026-10-06', flags: ['debts'], ost: ['soon', 'rented'] };
  const p = advSummaryParts(a, 'orders');
  assert.deepEqual(p, ['שם לקוח כהן', 'תאריכים ' + hebText('2026-10-06'), 'חובות', 'סטטוס הזמנה בקרוב או מושכר']);
  assert.deepEqual(advSummaryParts(emptyAdv('orders'), 'orders'), []);
  const c = { ...emptyAdv('customers'), first: 'רחל', city: 'חיפה' };
  assert.deepEqual(advSummaryParts(c, 'customers'), ['שם פרטי רחל', 'עיר מגורים חיפה']);
  assert.equal(advAiPrompt('customers', ['א', 'ב']), 'חפש לקוחות לפי: א, ב');
  const r = { ...emptyAdv('returns'), rdate: '2026-10-06' };
  assert.deepEqual(advSummaryParts(r, 'returns'), ['תאריך החזרה ' + hebText('2026-10-06')]);
});
t('נרמול תשובת adv', () => {
  assert.deepEqual(normalizeAdvResponse(null), { cols: [], rows: [], links: [], al: [], namesRev: [], truncated: false, gaps: [], capstats: null });
  assert.equal(normalizeAdvResponse({ truncated: 1, gaps: ['x'] }).truncated, true);
  assert.deepEqual(normalizeAdvResponse({ gaps: ['x'] }).gaps, ['x']);
});

console.log('חיפוש מתקדם: תפוסה');
const ADVB_ROUTE = readFileSync(new URL('../app/api/a5/adv-b/route.js', import.meta.url), 'utf8');
const ADVB_CAP = ADVB_ROUTE.slice(ADVB_ROUTE.indexOf('async function capacity'), ADVB_ROUTE.indexOf('async function models'));
t('תפוסה: מקום בשורת התחומים כמו בעיצוב (אחרי משלוחים, לפני דגמים), תווית/אייקון, לא תחום AI ולא תחום מנהלות', () => {
  const keys = Object.keys(ADV_FOCI);
  assert.equal(keys.indexOf('capacity'), keys.indexOf('deliveries') + 1);
  assert.equal(keys.indexOf('models'), keys.indexOf('capacity') + 1);
  const c = ADV_FOCI.capacity;
  assert.equal(c.label, 'תפוסה');
  assert.equal(c.icon, 'box');
  assert.equal(c.api, 'advb');
  assert.ok(!c.ai && !c.mgr && !c.needs);
  assert.deepEqual(c.blocks, [{ t: 'cap' }]);
  assert.deepEqual(ADV_TAG.capacity, ['תפוסה', 'box']);
});
t('תפוסה: אותו שער כמו השרת — page:orders (GATE.capacity) = נתיב "/orders" בתפריט', () => {
  assert.ok(/const GATE = \{[^}]*capacity: 'page:orders'/.test(ADVB_ROUTE), 'GATE.capacity בשרת');
  const only = (hrefs, settings = {}) => visibleFoci({ settings, isManager: false, navPaths: navPathSet([{ items: hrefs.map((href) => ({ href })) }]) });
  assert.ok(only(['/orders']).main.includes('capacity'));
  assert.ok(only(['/orders?x=1']).main.includes('capacity'), 'query בכתובת לא משנה');
  assert.ok(!only(['/customers', '/rentals', '/alterations', '/deliveries', '/dashboard/dresses']).main.includes('capacity'), 'בלי הזמנות — אין תפוסה, גם לא דרך עמודים אחרים');
  assert.ok(!visibleFoci({ settings: {}, isManager: true, isHead: true, navPaths: null }).main.includes('capacity'), 'נעילה סגורה בלי boot');
  assert.ok(only(['/orders'], { enable_alterations: 'false', enable_deliveries: 'false' }).main.includes('capacity'), 'הגדרות תיקונים/משלוחים לא נוגעות בתפוסה');
  // אותו שער גם להצעות (/api/a5/options) ול-/stock-check
  assert.ok(readFileSync(new URL('../app/api/a5/options/route.js', import.meta.url), 'utf8').includes("capacity: 'page:orders'"));
  assert.ok(readFileSync(new URL('../lib/stockCheck.js', import.meta.url), 'utf8').includes("STOCK_CHECK_PAGE_KEY = 'page:orders'"));
});
t('תפוסה: בקשה ל-adv-b רק עם model/size/from/to (שאר שדות הטופס לא נשלחים)', () => {
  const a = { ...emptyAdv('capacity'), model: ' שמלת תחרה ', size: '36', from: '2026-10-06', to: '2026-10-08', name: 'לא שייך', flags: ['debts'], ost: ['soon'] };
  const url = buildAdvRequest('capacity', a);
  assert.ok(url.startsWith('/api/a5/adv-b?'));
  const qs = new URL('http://x' + url).searchParams;
  assert.deepEqual([...qs.keys()], ['focus', 'model', 'size', 'from', 'to']);
  assert.equal(qs.get('focus'), 'capacity');
  assert.equal(qs.get('model'), 'שמלת תחרה');
  assert.equal(qs.get('from'), '2026-10-06');
  const b = buildAdvRequest('capacity', { ...emptyAdv('capacity'), model: '549' });
  assert.deepEqual([...new URL('http://x' + b).searchParams.keys()], ['focus', 'model'], 'בלי מידה/תאריך — השרת משלים (כל המידות, היום)');
  for (const k of ADV_FOCI.capacity.keys) assert.ok(new RegExp('p\\.' + k + '\\b').test(ADVB_CAP), 'השרת קורא ' + k);
});
t('תפוסה: דגם חובה — ההודעה זהה לשרת, נבדק לפני שליחה', () => {
  assert.equal(advMissing('capacity', emptyAdv('capacity')), 'נדרש דגם לחיפוש תפוסה');
  assert.equal(advMissing('capacity', { ...emptyAdv('capacity'), size: '36', from: '2026-10-06' }), 'נדרש דגם לחיפוש תפוסה');
  assert.equal(advMissing('capacity', { ...emptyAdv('capacity'), model: '   ' }), 'נדרש דגם לחיפוש תפוסה');
  assert.equal(advMissing('capacity', { ...emptyAdv('capacity'), model: '549' }), '');
  assert.ok(ADVB_CAP.includes("error: '" + advMissing('capacity', {}) + "'"), 'אותו נוסח כמו בשרת');
  for (const k of Object.keys(ADV_FOCI).filter((x) => x !== 'capacity')) assert.equal(advMissing(k, emptyAdv(k)), '', k + ': אין שדה חובה');
  assert.equal(advMissing('nope', {}), '');
  const home = readFileSync(new URL('../app/components/home/HomeA5.js', import.meta.url), 'utf8');
  assert.ok(/const missing = advMissing\(adv\.focus, adv\);\s*if \(missing\) \{ showToast\('חסר שדה חובה', missing\); return; \}/.test(home), 'נבדק לפני הקריאה לשרת');
  assert.ok(home.indexOf('const missing = advMissing') < home.indexOf('buildAdvRequest(adv.focus'));
});
t('תפוסה: מגבלת צמדי דגם/מידה בשרת מוחזרת כ-400 עם הודעה שהטופס מציג', () => {
  assert.ok(/CAPACITY_PAIRS_MAX = \d+/.test(ADVB_ROUTE));
  assert.ok(/pairs\.length > CAPACITY_PAIRS_MAX\) return \{ error: '[^']+', status: 400 \}/.test(ADVB_CAP));
  const home = readFileSync(new URL('../app/components/home/HomeA5.js', import.meta.url), 'utf8');
  assert.ok(/e\.status === 403 \|\| e\.status === 400/.test(home) && home.includes("e.status === 403 ? '' : e.message"), '400 = טוסט עם הודעת השרת, הטופס נשאר פתוח');
});
t('תפוסה: שורת הסיכום — דגם, מידה ותאריכים עבריים (כמו advApply בעיצוב)', () => {
  const a = { ...emptyAdv('capacity'), model: 'שמלת תחרה', size: '36', from: '2026-10-06', to: '2026-10-08' };
  assert.deepEqual(advSummaryParts(a, 'capacity'), ['דגם שמלת תחרה', 'מידה 36', 'תאריכים ' + hebText('2026-10-06') + ' עד ' + hebText('2026-10-08')]);
  assert.deepEqual(advSummaryParts({ ...emptyAdv('capacity'), model: '549' }, 'capacity'), ['דגם 549']);
  assert.deepEqual(advSummaryParts(emptyAdv('capacity'), 'capacity'), []);
  assert.ok(!/\d{4}-\d{2}/.test(advSummaryParts(a, 'capacity').join(' ')), 'בלי תאריך לועזי');
});
t('תפוסה: נרמול התשובה — capstats (במלאי / בתפוסה / רזרבה), שורות ועמודות של השרת', () => {
  const d = normalizeAdvResponse({
    cols: ['שם', 'תאריך אירוע', 'כמות', 'טלפון'],
    rows: [['רחל כהן', 'ט״ו תשרי', '2', '052-4418210'], ['', 'כ״ב תשרי', '1', '']],
    links: ['/orders/48133', 'https://evil.com'], al: [], namesRev: ['כהן רחל', ''], capstats: { stock: 4, busy: 3, res: 1 }, truncated: false, gaps: [],
  });
  assert.deepEqual(d.capstats, { stock: 4, busy: 3, res: 1 });
  assert.deepEqual(d.cols, ['שם', 'תאריך אירוע', 'כמות', 'טלפון']);
  assert.deepEqual(d.links, ['/orders/48133', '']);
  assert.equal(normalizeAdvResponse({ rows: [] }).capstats, null, 'תחום אחר — אין סיכום');
  assert.deepEqual(normalizeAdvResponse({ rows: [], capstats: { stock: 0, busy: 0, res: 0 } }).capstats, { stock: 0, busy: 0, res: 0 }, 'אין תפוסה — אפסים');
  assert.deepEqual(normalizeCapstats({ stock: '5', busy: -2, res: 'x' }), { stock: 5, busy: 0, res: 0 });
  assert.equal(normalizeCapstats('x'), null);
  assert.deepEqual(CAP_TILES.map((x) => x.label), ['במלאי', 'בתפוסה', 'רזרבה']);
  assert.deepEqual(CAP_TILES.map((x) => x.cls), ['cs-stock', 'cs-busy', 'cs-res']);
  assert.deepEqual(CAP_TILES.map((x) => x.key), ['stock', 'busy', 'res']);
  assert.ok(/capstats: \{ stock: 0, busy: 0, res: 0 \}/.test(ADVB_CAP) && /stats\.stock \+= d\.inStock; stats\.busy \+= d\.occupiedCount; stats\.res \+= d\.reserve/.test(ADVB_CAP), 'אותם שמות שדות כמו בשרת');
});
t('תפוסה: הטופס (בלוק cap) — דגם, מידה עם הצעות, "תאריך אירוע" + "עד תאריך" כטווח; כפתור החיפוש נעול בזמן טעינה', () => {
  const adv = readFileSync(new URL('../app/components/home/HomeAdvanced.js', import.meta.url), 'utf8');
  const cap = adv.slice(adv.indexOf("case 'cap':"), adv.indexOf("case 'estat':"));
  assert.ok(cap.includes('title="פרטי תפוסה"') && cap.includes('icon="box"'));
  assert.ok(cap.includes("fld(['model', 'דגם', 'dress', 'בחר דגם...'])") && cap.includes("fld(['size', 'מידה', 'sliders', 'מידה...'])"));
  assert.ok(cap.includes("dt('from', 'תאריך אירוע', ['from', 'to'])") && cap.includes("dt('to', 'עד תאריך', ['from', 'to'])"));
  assert.ok(/const OPT_KEYS = \[[^\]]*'model'[^\]]*'size'/.test(adv), 'דגם ומידה עם הצעות מהשרת');
  assert.ok(/className="btn primary lg"[^>]*disabled=\{loading\}/.test(adv) && adv.includes('<span className="mspin" aria-hidden="true" />'));
  const res = readFileSync(new URL('../app/components/home/HomeAdvResults.js', import.meta.url), 'utf8');
  assert.ok(res.includes("focus === 'capacity'") && res.includes('className="capstats"') && res.includes('aria-label="סיכום תפוסה"'));
  assert.ok(res.includes("...(hasStatus ? [chip ? chip[0] : ''] : [])"), 'בטבלה: מספר התאים בשורה = מספר הכותרות (בלי עמודה שלישית ריקה)');
});
t('חיפוש מתקדם שנכשל: "לנסות שוב" מריץ אותו שוב (לא את החיפוש הכללי האחרון)', () => {
  const home = readFileSync(new URL('../app/components/home/HomeA5.js', import.meta.url), 'utf8');
  assert.ok(home.includes('advFailed.current = true;') && home.includes('if (advRes || advFailed.current) { applyAdv(false); return; }'));
  assert.ok(/lastQuery\.current = \{ text: query, ai \};\s*advFailed\.current = false;/.test(home), 'חיפוש כללי מאפס');
});

console.log('תאריכים עבריים');
t('hebText: 1.10.2026 = כ׳ תשרי תשפ״ז', () => {
  // ר"ה תשפ"ז = 12.9.2026 (א' תשרי), לכן 1.10.2026 = כ' תשרי (19 ימים אחרי)
  assert.equal(hebText('2026-09-12'), 'א׳ תשרי תשפ״ז');
  assert.equal(hebText('2026-10-01'), 'כ׳ תשרי תשפ״ז');
  assert.equal(hebText(''), '');
  assert.equal(hebText('לא תאריך'), '');
});
t('שנה באותיות', () => {
  assert.equal(hebrewYearLetters(5787), 'תשפ״ז');
  assert.equal(hebrewYearLetters(5775), 'תשע״ה');
  assert.equal(hebrewYearLetters(5776), 'תשע״ו');
});
t('חודש עברי: התחלה, רשת, הזזה קדימה ואחורה', () => {
  const first = hebMonthStart(dateOf('2026-10-01'));
  assert.equal(isoOf(first), '2026-09-12');
  const g = hebMonthGrid(first);
  assert.equal(g.title, 'תשרי תשפ״ז');
  assert.equal(g.days.length, 30);
  assert.equal(g.days[0].iso, '2026-09-12');
  assert.equal(g.blanks, first.getDay());
  assert.ok(g.days[0].holiday, 'ר"ה = חג');
  assert.ok(g.days.some((d) => d.shabbat));
  const next = hebMonthShift(first, 1);
  assert.equal(hebMonthGrid(next).title, 'חשוון תשפ״ז');
  assert.equal(isoOf(hebMonthShift(next, -1)), isoOf(first));
});

console.log('מדיניות פרטיות');
t('הנוסח: כל הסעיפים, שדות המילוי מזוהים ומסומנים', () => {
  assert.ok(PRIVACY_SECTIONS.length >= 9);
  assert.ok(PRIVACY_SECTIONS.every((s) => s.h && (s.p || s.ul)));
  assert.equal(PRIVACY_PLACEHOLDER_COUNT, 6, 'מי אנחנו, שרתים, פניות, זמן מענה, עוגיות, תאריך');
  assert.deepEqual(splitPlaceholders('א [[ב]] ג'), [{ text: 'א ', ph: false }, { text: '[ב]', ph: true }, { text: ' ג', ph: false }]);
  assert.deepEqual(splitPlaceholders(''), []);
  const all = JSON.stringify(PRIVACY_SECTIONS);
  assert.ok(!all.includes('טקסט זמני'), 'לא הנוסח הזמני הישן');
  assert.ok(all.includes('נדרים פלוס') && all.includes('בינה מלאכותית'));
});

console.log('אייקונים (sprite מוטמע)');
const HOME_DIR = new URL('../app/components/home/', import.meta.url);
const homeSource = (name) => readFileSync(new URL(name, HOME_DIR), 'utf8');
const SPRITE_IDS = new Set(SPRITE_SYMBOLS.map(([id]) => id));
// literals של תנאים (kind === 'ret') אינם שמות אייקונים
const literals = (expr) => [...String(expr).replace(/[=!]==?\s*(?:'[^']*'|"[^"]*")/g, '').matchAll(/'([a-z][a-z0-9-]*)'|"([a-z][a-z0-9-]*)"/g)].map((m) => m[1] || m[2]);
// כל שמות האייקונים שמופיעים כמחרוזת בקוד של דף הבית: <Ic id="x"/{...}>, icon="x"/{...}/: 'x', LINK_ICON
function iconNamesInSource() {
  const names = new Map(); // name -> file
  const add = (n, f) => { if (!names.has(n)) names.set(n, f); };
  for (const f of readdirSync(HOME_DIR).filter((x) => x.endsWith('.js') && x !== 'LegacyHome.js')) {
    const src = homeSource(f);
    for (const m of src.matchAll(/<Ic\s+id=(?:"([^"]+)"|\{([^}]*)\})/g)) (m[1] ? [m[1]] : literals(m[2])).forEach((n) => add(n, f));
    for (const m of src.matchAll(/\bicon=(?:"([^"]+)"|\{([^}]*)\})/g)) (m[1] ? [m[1]] : literals(m[2])).forEach((n) => add(n, f));
    for (const m of src.matchAll(/\bicon:\s*'([a-z][a-z0-9-]*)'/g)) add(m[1], f);
    const li = src.match(/const LINK_ICON = \{([^}]*)\}/);
    if (li) literals(li[1].replace(/[a-z]+:/g, '')).forEach((n) => add(n, f));
  }
  return names;
}
// אייקונים שמגיעים מטבלאות הנתונים (הרשימות הן [ערך, תווית, אייקון, ...]; ADV_TAG = [תווית, אייקון])
function iconNamesInData() {
  const names = new Set();
  for (const v of Object.values(advConfig)) {
    if (Array.isArray(v)) for (const row of v) if (Array.isArray(row) && typeof row[2] === 'string' && row.length >= 3) names.add(row[2]);
  }
  for (const spec of Object.values(advConfig.F)) names.add(spec[2]);
  for (const [, icon] of Object.values(advConfig.ADV_TAG)) names.add(icon);
  for (const f of Object.values(advConfig.ADV_FOCI)) {
    names.add(f.icon);
    for (const b of f.blocks) if (b.icon) names.add(b.icon);
  }
  for (const list of Object.values(advConfig.advFlagsFor(true))) for (const row of list) names.add(row[2]);
  for (const [, icon] of Object.values(ORDER_STATUS_STYLE)) names.add(icon);
  names.add(orderStatus('').icon);
  for (const u of ['/orders/1', '/customers/1', '/dashboard/dresses/1', '/employees/1', '/x']) names.add(aiRowKind({ _actionUrl: u })[1]);
  for (const r of unifiedRows({ customers: [{ id: 1 }], orders: [{ id: 1, uuid: 'u' }], rentals: [{ orderId: 1, b: 'b' }] })) names.add(r.icon);
  for (const r of recentRows([{ type: 'customer', id: '1', name: 'א', timestamp: 1 }, { type: 'order', id: '2', name: 'ב', timestamp: 2 }, { type: 'dress', id: '3', name: 'ג', timestamp: 3 }, { type: 'rental', id: '4', name: 'ד', timestamp: 4 }])) names.add(r.icon);
  return names;
}
t('כל אייקון בדף הבית החדש קיים ב-sprite המוטמע (71 סמלים, gmi-)', () => {
  assert.equal(SPRITE_ID_PREFIX, 'gmi-');
  const src = iconNamesInSource();
  const data = iconNamesInData();
  // הסריקה לא יכולה "להצליח" בשקט כשהיא לא מוצאת כלום
  assert.ok(src.size >= 20, `found only ${src.size} icon names in source`);
  assert.ok(data.size >= 20, `found only ${data.size} icon names in data tables`);
  for (const n of ['search', 'sparkle', 'sliders', 'x', 'send', 'alert', 'refresh', 'info', 'chev', 'rows', 'table', 'plus', 'minus', 'check', 'copy', 'user', 'file', 'dress']) assert.ok(src.has(n) || data.has(n), `scan missed ${n}`);
  for (const [n, f] of src) assert.ok(SPRITE_IDS.has(n), `icon "${n}" used in ${f} is missing from spriteSymbols.js`);
  for (const n of data) assert.ok(SPRITE_IDS.has(n), `icon "${n}" from the home data tables is missing from spriteSymbols.js`);
});
t('דף הבית לא מפנה יותר לקובץ sprite חיצוני (מסנני תוכן מחליפים אותו בריבוע לבן)', () => {
  for (const f of readdirSync(HOME_DIR).filter((x) => x.endsWith('.js'))) {
    assert.ok(!homeSource(f).includes('sprite.svg#'), `${f} still references an external sprite.svg#...`);
  }
  assert.ok(homeSource('HomeParts.js').includes('`#${SPRITE_ID_PREFIX}${id}`'), 'Ic must reference the inline #gmi-<name> symbol');
});
t('ה-sprite מוטמע פעם אחת: HomeA5 מרנדר HomeSprite, ו-HomeSprite מוותר כש-MenuA5Shell כבר מספק אותו', () => {
  assert.equal((homeSource('HomeA5.js').match(/<HomeSprite \/>/g) || []).length, 1);
  const parts = homeSource('HomeParts.js');
  assert.match(parts, /export function HomeSprite\(\) \{\s*return useA5Shell\(\) \? null : <MenuSprite \/>;\s*\}/);
  // MenuSprite מרונדר במקום אחד בלבד במעטפת, ובתוך ה-A5ShellProvider שמספק את ההקשר ש-HomeSprite קורא
  const shell = readFileSync(new URL('../app/components/menu/MenuA5Shell.js', import.meta.url), 'utf8');
  assert.equal((shell.match(/<MenuSprite \/>/g) || []).length, 1);
  assert.ok(shell.indexOf('<A5ShellProvider') < shell.indexOf('<MenuSprite />'));
});


console.log('קישורי תפריט "בית" (scope / adv / recent) — 2.10.2026');
t('parseHomeParams: רשימה סגורה — רק scope מוכר, adv=1 בדיוק, recent=changes בדיוק', () => {
  assert.deepEqual(parseHomeParams('?scope=customers'), { scope: 'customers', adv: false, recent: null, q: null, any: true });
  assert.deepEqual(parseHomeParams('scope=orders'), { scope: 'orders', adv: false, recent: null, q: null, any: true });
  assert.deepEqual(parseHomeParams('?adv=1'), { scope: null, adv: true, recent: null, q: null, any: true });
  assert.deepEqual(parseHomeParams('?recent=changes'), { scope: null, adv: false, recent: 'changes', q: null, any: true });
  assert.deepEqual(Object.keys(HOME_SCOPES), ['customers', 'orders', 'rentals', 'returns', 'alterations']);
  assert.deepEqual([...HOME_RECENT_VALUES], ['changes']);
  assert.equal(parseHomeParams('').any, false); assert.equal(parseHomeParams(undefined).any, false); assert.equal(parseHomeParams(null).any, false);
});
t('parseHomeParams: ערכים לא מוכרים נזרקים (בלי prototype, XSS, redirect, רישיות)', () => {
  for (const bad of ['?scope=evil', '?scope=__proto__', '?scope=constructor', '?scope=toString', '?scope=Customers', '?scope=customers%20', '?scope=', '?scope=<script>alert(1)</script>',
    '?scope=https://evil.example', '?scope=//evil.example', '?scope=customers,orders', '?adv=true', '?adv=0', '?adv=', '?adv=11', '?recent=1', '?recent=', '?recent=all', '?recent=Changes']) {
    const r = parseHomeParams(bad);
    assert.equal(r.any, false, bad); assert.equal(r.scope, null, bad); assert.equal(r.adv, false, bad); assert.equal(r.recent, null, bad);
  }
  assert.equal(parseHomeParams('?scope=customers&scope=evil').scope, 'customers', 'הערך הראשון');
  assert.equal(parseHomeParams('?scope[]=customers').scope, null);
});
t('parseHomeParams: מקבל גם URLSearchParams; קלט ענק נחתך; q נחתך ל-200 ורווחים בלבד = null', () => {
  assert.equal(parseHomeParams(new URLSearchParams('scope=rentals')).scope, 'rentals');
  assert.equal(parseHomeParams('?q=%20%20').q, null);
  assert.equal(parseHomeParams('?q=' + 'א'.repeat(500)).q.length, 200);
  const big = '?x=' + 'a'.repeat(100000) + '&scope=orders';
  assert.equal(parseHomeParams(big).scope, null, 'מעבר לתקרת האורך — לא נקרא');
});
t('parseHomeParams: הוראה אחת — adv עדיף על recent על scope (כתובת, כותרת והדגשת תפריט תואמות)', () => {
  assert.deepEqual(parseHomeParams('?scope=orders&adv=1'), { scope: null, adv: true, recent: null, q: null, any: true });
  assert.deepEqual(parseHomeParams('?scope=orders&recent=changes'), { scope: null, adv: false, recent: 'changes', q: null, any: true });
  assert.deepEqual(parseHomeParams('?recent=changes&adv=1'), { scope: null, adv: true, recent: null, q: null, any: true });
  assert.equal(parseHomeParams('?scope=orders&q=%D7%9B').q, 'כ'); assert.equal(parseHomeParams('?scope=orders&q=%D7%9B').scope, 'orders');
  assert.equal(homeDirectiveKey(parseHomeParams('?scope=orders')), 'scope:orders');
  assert.equal(homeDirectiveKey(parseHomeParams('?adv=1')), 'adv');
  assert.equal(homeDirectiveKey(parseHomeParams('?recent=changes')), 'recent:changes');
  assert.equal(homeDirectiveKey(parseHomeParams('?q=x')), '');
});
t('homeScopeTitle: "<קטגוריה> - מה תרצי לחפש?" לכל קטגוריה, מהטבלה בלבד; לא מוכר = null', () => {
  assert.equal(SCOPE_TITLE_REST, 'מה תרצי לחפש?');
  assert.deepEqual(['customers', 'orders', 'rentals', 'returns', 'alterations'].map((k) => homeScopeTitle(k).text),
    ['לקוחות - מה תרצי לחפש?', 'הזמנות - מה תרצי לחפש?', 'השכרות - מה תרצי לחפש?', 'החזרות - מה תרצי לחפש?', 'תיקונים - מה תרצי לחפש?']);
  for (const bad of ['evil', '__proto__', 'constructor', 'toString', '<b>x</b>', '', null, undefined, 5, {}, ['customers']]) assert.equal(homeScopeTitle(bad), null, String(bad));
});
t('אין השתקפות של טקסט גולמי מהכתובת: התוויות בטבלה סגורה, ו-HomeA5 לא משתמש ב-dangerouslySetInnerHTML ולא מציג את הפרמטר', () => {
  for (const def of Object.values(HOME_SCOPES)) { assert.ok(Object.isFrozen(def)); assert.match(def.label, /^[א-ת]+$/); assert.match(def.only, /^ב[א-ת]+$/); }
  assert.ok(Object.isFrozen(HOME_SCOPES));
  const src = homeSource('HomeA5.js');
  assert.ok(!src.includes('dangerouslySetInnerHTML'));
  assert.ok(!/params\.get\('scope'\)|searchParams\.get\('scope'\)/.test(src), 'scope נקרא רק דרך parseHomeParams (רשימה סגורה)');
  assert.ok(!/router\.(push|replace)\(\s*(dir|params|scope)/.test(src), 'אין ניווט לפי ערך מהכתובת');
});
t('applyScope: חיפוש כללי מסונן לקטגוריה (לקוחות / הזמנות / השכרות); החזרות/תיקונים וללא קטגוריה — כמות שהוא; לא משנה את הקלט', () => {
  const res = normalizeSearch({ customers: [{ id: 'c1', firstName: 'רחל', lastName: 'כהן' }], orders: [{ id: 'u1', orderId: 5, firstName: 'רחל', lastName: 'כהן' }], rentals: [{ orderId: 5, barcode: '12', catalogName: 'שמלה' }] });
  const c = applyScope(res, 'customers'); assert.equal(c.customers.length, 1); assert.equal(c.orders.length, 0); assert.equal(c.rentals.length, 0);
  const o = applyScope(res, 'orders'); assert.equal(o.customers.length, 0); assert.equal(o.orders.length, 1); assert.equal(o.rentals.length, 0);
  const r = applyScope(res, 'rentals'); assert.equal(r.rentals.length, 1); assert.equal(r.customers.length + r.orders.length, 0);
  assert.equal(applyScope(res, 'returns'), res); assert.equal(applyScope(res, 'alterations'), res);
  assert.equal(applyScope(res, null), res); assert.equal(applyScope(res, 'evil'), res); assert.equal(applyScope(null, 'customers'), null);
  assert.equal(res.customers.length, 1); assert.equal(res.orders.length, 1); assert.equal(res.rentals.length, 1);
  assert.equal(resultsCount(applyScope(res, 'customers')), 1);
  assert.equal(resultsCount(applyScope({ customers: [], orders: res.orders, rentals: [] }, 'customers')), 0, 'יש רק הזמנות → בקטגוריית לקוחות "אין תוצאות"');
});
t('scopedAdvFields (החזרות / תיקונים): שם לקוח / טלפון (7 ספרות ומעלה) / קוד הזמנה; ריק = null', () => {
  assert.deepEqual(scopedAdvFields('כהן רחל'), { name: 'כהן רחל' });
  assert.deepEqual(scopedAdvFields('052-1234567'), { cinfo: '0521234567' });
  assert.deepEqual(scopedAdvFields('52103'), { oid: '52103' });
  assert.equal(scopedAdvFields('  '), null); assert.equal(scopedAdvFields(undefined), null);
  assert.equal(HOME_SCOPES.returns.via, 'adv'); assert.equal(HOME_SCOPES.returns.focus, 'returns'); assert.equal(HOME_SCOPES.alterations.focus, 'alterations');
  assert.ok(ADV_FOCI.returns && ADV_FOCI.alterations, 'תחומי החיפוש המתקדם קיימים');
  // הבקשה לשרת נבנית כמו בחיפוש מתקדם רגיל (אותו נתיב, אותה הרשאה)
  const form = { ...emptyAdv('returns'), ...scopedAdvFields('כהן') };
  assert.match(buildAdvRequest('returns', form, { length: 0, key: () => null, getItem: () => null }), /^\/api\/a5\/adv\?focus=returns&adv=/);
  assert.match(buildAdvRequest('alterations', { ...emptyAdv('alterations'), ...scopedAdvFields('כהן') }, null), /^\/api\/a5\/adv-b\?focus=alterations&name=/);
  assert.deepEqual(advSummaryParts(form, 'returns'), ['שם לקוח כהן']);
});
t('אייקוני הקטגוריות קיימים ב-sprite המוטמע', () => {
  for (const def of Object.values(HOME_SCOPES)) assert.ok(SPRITE_IDS.has(def.icon), def.icon);
});
t('התפריט והדף מסכימים: כל href של scope בתפריט הוא קטגוריה חוקית ב-parseHomeParams, ו-adv/recent גם הם', () => {
  const keys = ['page:refunds', 'page:dresses_catalog', 'page:board', 'page:orders', 'page:orders_new', 'page:rentals', 'page:customers', 'page:deliveries', 'page:alterations', 'page:messages', 'page:schedule'];
  const tree = buildMenuTree({ user: { id: 'e0', firstName: 'ש', lastName: 'כ', roleId: 0 }, permissions: Object.fromEntries(keys.map((k) => [k, true])), settings: [] });
  const items = tree.tabs.find((x) => x.id === 'home').items.filter((x) => x.kind === 'link' && x.href.includes('?'));
  assert.equal(items.length, 7);
  for (const it of items) {
    const p = parseHomeParams(it.href.slice(it.href.indexOf('?')));
    assert.ok(p.any, it.href);
    if (it.id === 'home-adv') assert.equal(p.adv, true); else if (it.id === 'recent-all') assert.equal(p.recent, 'changes');
    else { assert.ok(p.scope, it.href); assert.equal(it.label, HOME_SCOPES[p.scope].label, 'תווית הפריט = תווית הקטגוריה'); }
  }
});

console.log("קידומות חיפוש מהיר ('@') — lib/quickPrefix.js");
t("detectQuickPrefix: רק '@' כתו ראשון; '#' ו-'$' טרם נבנו; באמצע הטקסט לא", () => {
  assert.deepEqual(Object.keys(QUICK_PREFIXES), ['@']);
  assert.equal(detectQuickPrefix('@').prefix, '@'); assert.equal(detectQuickPrefix('@').term, '');
  assert.equal(detectQuickPrefix('@ כהן ').term, 'כהן');
  for (const no of ['', ' @', 'כהן@', 'a@b.co', '#', '$', '!', '#x', '$x', null, undefined, 5, '__proto__', 'constructor']) assert.equal(detectQuickPrefix(no), null, String(no));
});
t('filterPrefixRows / splitMatch: סינון לפי כותרת / סוג / טקסט משנה, בלי לשנות את הקלט', () => {
  const rows = [{ key: 'a', kind: 'לקוח', title: 'רחל כהן', sub: 'ירושלים' }, { key: 'b', kind: 'הזמנה', title: 'דנה לוי', sub: '' }];
  assert.equal(filterPrefixRows(rows, '').length, 2); assert.notEqual(filterPrefixRows(rows, ''), rows);
  assert.deepEqual(filterPrefixRows(rows, 'כהן').map((r) => r.key), ['a']);
  assert.deepEqual(filterPrefixRows(rows, 'הזמנה').map((r) => r.key), ['b']);
  assert.deepEqual(filterPrefixRows(rows, 'ירוש').map((r) => r.key), ['a']);
  assert.deepEqual(filterPrefixRows(rows, 'zzz'), []); assert.deepEqual(filterPrefixRows(null, 'x'), []);
  assert.deepEqual(splitMatch('רחל כהן', 'כהן'), ['רחל ', 'כהן', '']); assert.deepEqual(splitMatch('רחל', 'x'), ['רחל', '', '']); assert.deepEqual(splitMatch(null, 'x'), ['', '', '']);
});
t("רשימת '@' = אותם נתונים כמו כרטיס 'האחרונים' הישן (recentRows של agy_history), שורות עם kind; כשיתווספו סוגים — אותו רכיב", () => {
  const rows = recentRows([{ type: 'customer', id: 'c1', name: 'רחל כהן', subtext: 'ירושלים' }, { type: 'order', id: 5, name: 'הזמנה 5' }]);
  assert.deepEqual(rows.map((r) => r.kind), ['לקוח', 'הזמנה']);
  assert.equal(filterPrefixRows(rows, 'ירושלים').length, 1);
  const comp = readFileSync(new URL('../app/components/search/QuickPrefix.js', import.meta.url), 'utf8');
  assert.ok(comp.includes('getHistory') && comp.includes('recentRows'), 'מקור הנתונים: ההיסטוריה המקומית');
  assert.ok(/advlist/.test(comp) && /advo/.test(comp), 'רשימת הפלטה הנגללת (advlist/advo)');
  assert.ok(!/fetch\(/.test(comp), 'בלי רישום/קריאת חיפושים בשרת (לא נבנה עדיין)');
  const home = homeSource('HomeA5.js');
  assert.ok(home.includes('useQuickPrefix') && home.includes('<QuickPrefixList'), 'HomeA5 משתמש ברכיב המשותף');
  assert.match(home, /setQ\('@'\)/, "'שינויים אחרונים' (?recent=changes) ממלא '@' — אותה תוצאה בדיוק");
});

console.log('שורת החיפוש: בלי כפתור "אחרונים"');
t('אין כפתור/אייקון "אחרונים" באף שלב של שורת החיפוש (פתיחה, אחרי חיפוש, חכם, מתקדם) ואין קוד מת שלו', () => {
  const a5 = homeSource('HomeA5.js');
  // כפתורי מצב החיפוש: רק "לחיפוש חכם / לחיפוש רגיל" ו"לחיפוש מתקדם"; השורה מרונדרת אחת ומשותפת לכל השלבים (modeButtons)
  // (+ כפתור הסינון לקטגוריה "רק ב..." של קישורי התפריט — מוצג רק כשיש סינון פעיל; אינו כפתור "אחרונים")
  assert.equal((a5.match(/className="cmode-b/g) || []).length, 3, 'cmode-b buttons: smart/plain + advanced + scope chip only');
  assert.ok(!/aria-label="אחרונים"|data-tip="אחרונים"/.test(a5), 'recent button label found');
  assert.ok(!/cmode-i|recentOpen|setRecentOpen|HomeRecents|getHistory|agy_history|recentRows/.test(a5), 'HomeA5.js still has recent-searches code');
  assert.ok(!/cmode-i/.test(homeSource('home.css')), 'home.css still styles the recent button');
  assert.ok(!readdirSync(HOME_DIR).includes('HomeRecents.js'), 'HomeRecents.js should be gone');
  // אף אחד מקבצי הדף לא מרנדר אייקון היסטוריה בשורת החיפוש
  for (const f of readdirSync(HOME_DIR).filter((x) => x.endsWith('.js') && x !== 'LegacyHome.js')) {
    assert.ok(!/<Ic\s+id="(sn-history|clock|history)"/.test(homeSource(f)), `${f} renders a history icon`);
  }
});
t('נתוני "אחרונים" (recentRows ו-agy_history ב-lib/historyManager) נשארים לשימוש התפריט העליון', () => {
  assert.equal(typeof recentRows, 'function');
  const hm = readFileSync(new URL('../lib/historyManager.js', import.meta.url), 'utf8');
  assert.ok(/export const getHistory/.test(hm));
});


console.log('תיקוני סקירה (2.10.2026)');
t('recentRows: סוג שמור כמו "constructor" / "__proto__" / "toString" לא זורק ונזרק', () => {
  const rows = recentRows([{ type: 'constructor', id: '1' }, { type: '__proto__', id: '2' }, { type: 'toString', id: '3' }, { type: 5, id: '4' }, { type: 'customer', id: 'c1', name: 'רחל' }]);
  assert.deepEqual(rows.map((r) => r.key), ['customer:c1']);
});
t('homeNavTarget: רק "/" הוא דף הבית; query בלי #hash; הוראה חוזרת מנותחת כמו בכתובת', () => {
  assert.deepEqual(homeNavTarget('/?scope=orders'), { isHome: true, query: 'scope=orders' });
  assert.deepEqual(homeNavTarget('/'), { isHome: true, query: '' });
  assert.deepEqual(homeNavTarget('/?adv=1#x'), { isHome: true, query: 'adv=1' });
  for (const no of ['/orders', '/orders?x=1', '/rentals#returned', '', null, undefined, 5]) assert.equal(homeNavTarget(no).isHome, no === '' || no === null || no === undefined || no === 5 ? true : false, String(no));
  assert.equal(parseHomeParams(homeNavTarget('/?scope=customers').query).scope, 'customers');
  assert.equal(HOME_NAV_EVENT, 'gm-home-nav');
});
t('לחיצה חוזרת על פריט בית: המעטפת משדרת HOME_NAV_EVENT לקישורי "/" ודף הבית מאזין ומחיל מחדש את ההוראה', () => {
  const shell = readFileSync(new URL('../app/components/menu/MenuA5Shell.js', import.meta.url), 'utf8');
  assert.ok(/homeNavTarget\(href\)\.isHome\) window\.dispatchEvent\(new CustomEvent\(HOME_NAV_EVENT/.test(shell));
  const home = homeSource('HomeA5.js');
  assert.ok(home.includes('addEventListener(HOME_NAV_EVENT') && home.includes('removeEventListener(HOME_NAV_EVENT'));
  assert.match(home, /if \(dir\.any\) \{ applyDirective\(dir, null\); return; \}/);
});
t('removeScope: מנקה גם תוצאות advRes (החזרות/תיקונים) ומריץ מחדש בחיפוש הכללי', () => {
  const home = homeSource('HomeA5.js');
  const body = home.slice(home.indexOf('const removeScope = () => {'), home.indexOf("// '@' בתחילת השורה"));
  assert.ok(/if \(advRes\) \{[\s\S]*setAdvRes\(null\)[\s\S]*runSearch\(text\)/.test(body), 'advRes נוקה והחיפוש הכללי רץ');
  assert.ok(/view === 'error'/.test(body));
});
t('useNavHistory: שינוי query בלבד (/?scope=a → /?scope=b) מפעיל ביקור חדש', () => {
  const h = readFileSync(new URL('../app/components/menu/useNavHistory.js', import.meta.url), 'utf8');
  assert.ok(/\[pathname, queryString, tree, commit\]/.test(h));
  assert.ok(/useNavHistory\(tree, queryString\)/.test(readFileSync(new URL('../app/components/menu/MenuA5Shell.js', import.meta.url), 'utf8')));
});
t('app/layout.js מעביר homeA5 מהדגל ui_variant_home (דגלי shell ו-home עצמאיים)', () => {
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.ok(layout.includes("homeA5: uiVariants.home === 'a5'"));
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
