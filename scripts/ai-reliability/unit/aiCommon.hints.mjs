import { pathToFileURL } from 'node:url';
const m = await import(pathToFileURL(process.env.PROJ + '/lib/ai/aiCommon.js').href);
let pass = 0, fail = 0;
const ok = (name, cond, info) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(info))); };
const now = new Date('2026-09-20T09:00:00Z'); // 9 Tishrei 5787

let h = m.buildUserDateHints('תציג לי את כל ההזמנות של כו תשרי', now);
ok('hint: כו תשרי = 2026-10-07', h.includes('2026-10-07') && h.includes("HEBREW_DATE(26, 'TISHREI', 5787)"), h);
h = m.buildUserDateHints("הצג לי את ההזמנות שתאריך האירוע בג' תשרי", now);
ok("hint: ג' תשרי = 2026-09-14", h.includes('2026-09-14'), h);
h = m.buildUserDateHints('היום לא כד אלול אלא ד תשרי', now);
ok('hint: כד אלול -> nearest (2026-09-07 area, year 5786)', h.includes("'ELUL', 5786"), h);
h = m.buildUserDateHints('הזמנות לי"א בתשרי תשפ"ז', now);
ok('hint: explicit year', h.includes('2026-09-22'), h);
ok('hint: none when no hebrew date', m.buildUserDateHints('כמה לקוחות יש לפי עיר?', now) === '');
ok('hint: word "אב" inside sentence not a date', m.buildUserDateHints('יש אב אחד', now) === '' , m.buildUserDateHints('יש אב אחד', now));

ok('data: many rows', m.resultsHaveData([[{ a: 1 }, { a: 2 }]]));
ok('data: count 0 -> none', !m.resultsHaveData([[{ count: '0' }]]));
ok('data: count 22 -> data', m.resultsHaveData([[{ count: '22' }]]));
ok('data: empty -> none', !m.resultsHaveData([[]]));
ok('none: לא נמצאו', m.answerSaysNone('לא נמצאו הזמנות שבוצעו בתאריך 15/09/2026.'));
ok('none: אין הזמנות', m.answerSaysNone('כרגע אין הזמנות למחר.'));
ok('none: normal answer', !m.answerSaysNone('נמצאו 25 הזמנות. הרשימה בטבלה.'));

const long = 'נמצאו 2172 הזמנות. הרשימה המלאה: - הזמנה 1, שם א - הזמנה 2, שם ב - הזמנה 3, שם ג - הזמנה 4, שם ד';
ok('trim inline list', m.trimEnumeration(long).startsWith('נמצאו 2172 הזמנות') && !m.trimEnumeration(long).includes('הזמנה 2'), m.trimEnumeration(long));
ok('trim keeps short', m.trimEnumeration('נמצאו 3 הזמנות.') === 'נמצאו 3 הזמנות.');

const cat = [{ key: 'inventory_buffer_days', name: 'ימי מרווח ביטחון בין השכרות', category: 'יומן' }];
const t = m.validateSettingTags('ההגדרה INVENTORY_BUFFER נמצאת ב: הגדרות מערכת ← הזמנות\n[OPEN_SETTING:INVENTORY_BUFFER]\n[OPEN_SETTING:inventory_buffer_days]', cat);
ok('setting: raw key -> hebrew name', t.includes('ימי מרווח ביטחון בין השכרות') && !t.includes('INVENTORY_BUFFER'), t);
ok('setting: location fixed', t.includes('הגדרות מערכת ← יומן'), t);
ok('setting: tag valid + deduped', (t.match(/\[OPEN_SETTING:inventory_buffer_days\]/g) || []).length === 1, t);
const t2 = m.validateSettingTags('[OPEN_SETTING:inventory_buffer_days]', cat);
ok('setting: exact tag untouched', t2 === '[OPEN_SETTING:inventory_buffer_days]', t2);
const N = m.normalizeAiSql;
ok('sql: quoted alias date', N(`WHERE "O"."eventDate" >= '2026-08-14'`) === `WHERE ("O"."eventDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::date >= '2026-08-14'`, N(`WHERE "O"."eventDate" >= '2026-08-14'`));
ok('sql: quoted Order alias date', N(`"Order"."orderDate"::date = '2026-09-15'`) === `("Order"."orderDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::date = '2026-09-15'`, N(`"Order"."orderDate"::date = '2026-09-15'`));
ok('sql: quoted alias status', N(`"O"."status" NOT IN ('a')`) === `COALESCE("O"."status", '') NOT IN ('a')`, N(`"O"."status" NOT IN ('a')`));
ok('sql: quoted alias status <>', N(`"Order"."status" <> 'x'`) === `COALESCE("Order"."status", '') <> 'x'`, N(`"Order"."status" <> 'x'`));
ok('sql: already COALESCE untouched', N(`COALESCE("Order"."status", '') NOT IN ('a')`) === `COALESCE("Order"."status", '') NOT IN ('a')`, N(`COALESCE("Order"."status", '') NOT IN ('a')`));
ok('sql: idempotent quoted', N(N(`"O"."eventDate" = '2026-09-22'`)) === N(`"O"."eventDate" = '2026-09-22'`));
const gl = 'נמצאו 25 הזמנות. פירוט ההזמנות מוצג בטבלה. מספר הזמנה | תאריך 1 | א 2 | ב 3 | ג 4 | ד 5 | ה 6 | ו 7 | ז';
ok('trim: pipe table in one line', !m.trimEnumeration(gl).includes('|') && m.trimEnumeration(gl).includes('נמצאו 25 הזמנות'), m.trimEnumeration(gl));
ok('trim: no duplicate suffix', (m.trimEnumeration('נמצאו 5 הזמנות. הרשימה המלאה מוצגת בטבלה. - א 1 - ב 2 - ג 3 - ד 4').match(/בטבלה/g) || []).length === 1, m.trimEnumeration('נמצאו 5 הזמנות. הרשימה המלאה מוצגת בטבלה. - א 1 - ב 2 - ג 3 - ד 4'));
let h2 = m.buildUserDateHints('בחודש אלול תשפ"ו כמה הזמנות?', now);
ok('hint: month-only with year', h2.includes("HEBREW_MONTH_START('ELUL', 5786)") && h2.includes('2026-08-14') && h2.includes('2026-09-11'), h2);
h2 = m.buildUserDateHints('כמה הזמנות באלול?', now);
ok('hint: month-only nearest (Elul 5786)', h2.includes("'ELUL', 5786"), h2);
h2 = m.buildUserDateHints('כמה הזמנות לחודשית תשרי - חשון - כסלו ?', now);
ok('hint: three months', h2.includes("'TISHREI'") && h2.includes("'CHESHVAN'") && h2.includes("'KISLEV'"), h2);
ok('hint: אב standalone word not a month', m.buildUserDateHints('יש אב אחד בבית', now) === '', m.buildUserDateHints('יש אב אחד בבית', now));
h2 = m.buildUserDateHints('הזמנות של כו תשרי', now);
ok('hint: day-date not duplicated as month', (h2.match(/HEBREW_MONTH/g) || []).length === 0, h2);
const hz = m.humanizeResultDates([{ 'תאריך': '2026-09-21T21:00:00.000Z', 'מספר': 5, 'טקסט': 'יא תשרי', d2: '2026-10-07', n: null }]);
ok('humanize: 21:00Z -> Israeli next day + hebrew', hz[0]['תאריך'] === 'י"א בתשרי תשפ"ז (22/09/2026)', hz);
ok('humanize: plain date', hz[0].d2 === 'כ"ו בתשרי תשפ"ז (07/10/2026)', hz);
ok('humanize: non-dates untouched', hz[0]['מספר'] === 5 && hz[0]['טקסט'] === 'יא תשרי' && hz[0].n === null, hz);
ok('humanize: winter 22:00Z', m.humanizeResultDates('2026-12-09T22:00:00.000Z') === "ל' בכסלו תשפ\"ז (10/12/2026)", m.humanizeResultDates('2026-12-09T22:00:00.000Z'));
const labels = 'נמצאו 25 הזמנות. להלן פירוט: מספר הזמנה: 1, תאריך א. מספר הזמנה: 2, תאריך ב. מספר הזמנה: 3, תאריך ג. מספר הזמנה: 4, תאריך ד.';
ok('trim: repeated row labels', !m.trimEnumeration(labels).includes('מספר הזמנה: 2') && m.trimEnumeration(labels).startsWith('נמצאו 25 הזמנות'), m.trimEnumeration(labels));
const dashTable = 'נמצאו 45 הזמנות. להלן פירוט:\n\nמספר הזמנה | תאריך | סכום | הערה\n1 | א | 50 | - | x\n2 | ב | 60 | - | y\n3 | ג | 70 | - | z\n4 | ד | 80 | - | w';
ok('trim: text table with "-" cells is cut before the table', !m.trimEnumeration(dashTable).includes('|') && m.trimEnumeration(dashTable).startsWith('נמצאו 45 הזמנות'), m.trimEnumeration(dashTable));
const loc = m.validateSettingTags('בהגדרות המערכת ← הזמנה וכן בהגדרות המערכת ← משהו\n[OPEN_SETTING:INVENTORY_BUFFER]', cat);
ok('setting: "הגדרות המערכת ←" (with ה) and multiple mentions fixed', !loc.includes('← הזמנה') && !loc.includes('← משהו') && (loc.match(/← יומן/g) || []).length === 2, loc);
const direct = await m.finalizeTagsAndText('ראו [OPEN_SETTING:INVENTORY_BUFFER] וגם [OPEN_LINK:/nope|x]', { isManager: true, loadSettingsCatalog: async () => cat, loadHowToCatalog: async () => [{ route: '/orders', title: 't' }] });
ok('finalize: manager direct answer gets validated tags', direct.includes('[OPEN_SETTING:inventory_buffer_days]') && !direct.includes('/nope'), direct);
const staff = await m.finalizeTagsAndText('ראו [OPEN_SETTING:inventory_buffer_days]', { isManager: false, loadSettingsCatalog: async () => cat, loadHowToCatalog: async () => [] });
ok('finalize: non-manager gets no settings panel tag', !staff.includes('OPEN_SETTING'), staff);

// ---- 5.10.2026: Hebrew months from the shared table (lib/searchNormalize.js HEBREW_MONTH_TABLE) + barcode / phone / size rules (S16-S20) ----
const HMT = (await import(pathToFileURL(process.env.PROJ + '/lib/searchNormalize.js').href)).HEBREW_MONTH_TABLE;
const hintFor = (txt) => m.buildUserDateHints(txt, now);
// 'now' = 9 Tishrei 5787 (a leap year: Adar I + Adar II exist in 5787)
let hm = hintFor('הזמנות של ד כסליו');
ok('month: כסלו and כסליו both -> KISLEV day hint', hm.includes("'KISLEV'") && hintFor('הזמנות של ד כסלו').includes("'KISLEV'"), hm);
hm = hintFor('הזמנות של ב מרחשון');
ok('month: מרחשון (new spelling) -> CHESHVAN', hm.includes("'CHESHVAN'"), hm);
ok('month: מרחשוון and חשון still work', hintFor('ז מרחשוון').includes("'CHESHVAN'") && hintFor('ז חשון').includes("'CHESHVAN'"));
hm = hintFor('כמה הזמנות בכסליו?');
ok('month-only: בכסליו -> KISLEV start/end macros', hm.includes("HEBREW_MONTH_START('KISLEV'"), hm);
hm = hintFor('י"ד באדר ב');
ok('month: אדר ב -> ADAR II day macro (leap year 5787)', hm.includes("HEBREW_DATE(14, 'ADAR II', 5787)"), hm);
hm = hintFor('י"ד באדר א');
ok('month: אדר א -> ADAR I', hm.includes("'ADAR I'"), hm);
hm = hintFor('ט"ו אדר');
ok('month: bare אדר with a day is recognised', /HEBREW_DATE\(15, 'ADAR/.test(hm), hm);
hm = hintFor('כמה הזמנות באדר ב?');
ok('month-only: באדר ב -> ADAR II month macros', hm.includes("HEBREW_MONTH_START('ADAR II'"), hm);
ok('month-only: bare אדר without a prefix is a name, not a month', hintFor('הזמנות של אדר כהן') === '', hintFor('הזמנות של אדר כהן'));
ok('month: מנחם אב -> AV with a day', hintFor('ט מנחם אב').includes("'AV'"), hintFor('ט מנחם אב'));
for (const row of HMT) for (const alias of row.aliases) {
  const text = /^(אב|איר|אדר)$/.test(alias) ? 'י ב' + alias : 'י ' + alias; // "אב"/"איר"/"אדר" are also ordinary words: with a day they count
  const out = hintFor(text);
  ok('table month "' + alias + '" resolves to a hint', out.includes('HEBREW_DATE(10,'), { text, out });
}
const rules = m.buildSharedSqlRules({ draftStatus: 'טיוטה', reservedStatus: 'שמור לחיוב' });
for (const id of ['S16', 'S17', 'S18', 'S19', 'S20']) ok('rules: ' + id + ' present', rules.includes('\n' + id + '. '), id);
ok('S16: barcode = model prefix + 2-digit size + 2-digit serial, with the worked example', /LAST 2 digits are the serial/.test(rules) && rules.includes('6323401 = model 632, size 34, serial 01') && rules.includes('"DressItem"."dressBarcode"') && rules.includes('"OrderItem"."barcode"'));
ok('S17: a 7-digit number is a barcode and is never called an order number', rules.includes('NEVER treat a 7-digit number as an order number') && rules.includes('NEVER write "מספר הזמנה"'));
ok('S17: 5-6 digits = order first, 1-4 digits = order, the word הזמנה forces an order, 9-10 digits from 0 = phone', /5-6 digits \("Order"\."orderId"\)/.test(rules) && rules.includes('order number FIRST') && rules.includes('1-4 digits is an order number') && rules.includes('before any number it is an order number') && rules.includes('9-10 digit number that starts with 0'));
ok('S18: phone compared by digits only, both phone columns, 972 form', rules.includes("regexp_replace(\"phone1\", '\\D', '', 'g')") && rules.includes("'0501234567', '972501234567'") && rules.includes('phone2'), rules.match(/S18\.[^\n]*/)[0].slice(0, 400));
ok('S19: every spelling of every month is listed with its macro name', HMT.every((row) => [...row.aliases, ...row.spellings].filter((a) => !/["'׳״]/.test(a)).every((a) => rules.includes(a))));
ok('S19: new spellings explicitly present (אדר א / אדר ב / כסליו / מרחשון / מנחם אב)', ['אדר א', 'אדר ב', 'כסליו', 'מרחשון', 'מנחם אב'].every((w) => rules.match(/S19\.[^\n]*/)[0].includes(w)));
ok('S19: month macros present (ADAR_I, ADAR_II, KISLEV, CHESHVAN)', ['ADAR_I', 'ADAR_II', 'KISLEV', 'CHESHVAN'].every((w) => rules.match(/S19\.[^\n]*/)[0].includes(w)));
ok('S20: size spelling - both spellings, never LIKE %2%', rules.includes("TRIM(\"sizeText\") IN ('2', '02')") && rules.includes('NEVER use "sizeText" LIKE'));
ok('rules: S1-S15 untouched (S1 and S15 still there)', rules.includes('S1. NULL-SAFE STATUS FILTER') && rules.includes('S15. COUNTING'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
