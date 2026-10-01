// בדיקת יחידה ללוגיקה הטהורה של דף הבית החדש (app/components/home/homeLogic.js, homeAdvConfig.js,
// homeDates.js, privacyPolicyText.js). לא נוגעת ב-DB וברשת.
// הרצה: node scripts/test_home_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  buildGreeting, DEFAULT_TITLE, isLegacyDefaultTitle, LEGACY_DEFAULT_TITLE, normalizeTitleForCompare, normalizeSearch, resultsCount, orderStatus, unifiedRows, tableRecords,
  TABLE_COLUMNS, sortRecords, exportRecordsForRows, parseAiTags, safeInternalRoute, botMessageFromResponse,
  botErrorMessage, chatToHistory, chatCopyText, aiRowView, aiRowKind, aiRowHref, richSegments, rowsToCsv,
  threadToCsv, printRowsHtml, printThreadHtml, withoutActionKeys, recentRows, footerGroups, safeCell, isSensitiveKey, rowColumns,
} from '../app/components/home/homeLogic.js';
import {
  emptyAdv, visibleFoci, navPathSet, buildAdvRequest, unsavedOrderIds, advSummaryParts, advAiPrompt, normalizeAdvResponse,
  ADV_FOCI, ADV_KEYS,
} from '../app/components/home/homeAdvConfig.js';
import { hebText, hebMonthStart, hebMonthShift, hebMonthGrid, hebrewYearLetters, isoOf, dateOf } from '../app/components/home/homeDates.js';
import { PRIVACY_SECTIONS, splitPlaceholders, PRIVACY_PLACEHOLDER_COUNT } from '../app/components/home/privacyPolicyText.js';

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
t('טבלה: 7 עמודות ותאי כל סוג', () => {
  const rec = tableRecords(unifiedRows(normalizeSearch(RAW)));
  assert.equal(TABLE_COLUMNS.length, 7);
  assert.ok(rec.every((r) => r.cells.length === 7));
  assert.deepEqual(rec[0].cells, ['לקוח', 'רחל כהן', '052-4418210', 'ירושלים', '', '', '']);
  assert.deepEqual(rec[2].cells, ['הזמנה', 'רחל כהן', '', '', '#48131', 'י״ג תשרי', 'פעיל']);
  assert.deepEqual(rec[4].cells, ['פריט', 'שמלת ורד', '', '', '1024038', '', 'מידה 38']);
  assert.equal(rec[5].cells[6], '', 'אין מידה = ריק');
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
  assert.deepEqual(v.main, ['customers', 'orders', 'rentals', 'returns', 'alterations']);
  assert.deepEqual(v.extra, []);
  v = visibleFoci({ settings: { enable_deliveries: 'true', enable_alterations: 'false' }, isManager: true, isHead: true, navPaths: all });
  assert.deepEqual(v.main, ['customers', 'orders', 'rentals', 'returns', 'deliveries']);
  assert.deepEqual(v.extra, ['models', 'employees']);
  assert.ok(!('finance' in ADV_FOCI) && !('capacity' in ADV_FOCI) && !('stock' in ADV_FOCI) && !('settings' in ADV_FOCI), 'תחומים איטיים לא ב-V1');
});
t('תחומים לפי הרשאות התפריט (navPaths): עובדת בלי "הזמנות" לא רואה את התחום', () => {
  const nav = [{ items: [{ href: '/' }, { href: '/customers' }, { href: '/rentals#rented' }, { href: '/rentals#returned' }, { href: '/alterations' }] }];
  const paths = navPathSet(nav);
  assert.ok(paths.has('/rentals') && paths.has('/customers') && !paths.has('/orders'));
  let v = visibleFoci({ settings: {}, isManager: false, navPaths: paths });
  assert.deepEqual(v.main, ['customers', 'rentals', 'returns', 'alterations']);
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
  assert.deepEqual(normalizeAdvResponse(null), { cols: [], rows: [], links: [], al: [], namesRev: [], truncated: false, gaps: [] });
  assert.equal(normalizeAdvResponse({ truncated: 1, gaps: ['x'] }).truncated, true);
  assert.deepEqual(normalizeAdvResponse({ gaps: ['x'] }).gaps, ['x']);
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

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
