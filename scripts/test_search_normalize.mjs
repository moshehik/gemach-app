// בדיקת יחידה למודול הנרמול המשותף של החיפוש (lib/searchNormalize.js). לא נוגעת ב-DB, ב-DOM וברשת.
// הרצה: node scripts/test_search_normalize.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// הסקריפט מריץ את עצמו שלוש פעמים, בכל פעם באזור זמן אחר (UTC / Asia/Jerusalem / America/New_York) - כל התוצאות חייבות להיות זהות,
// כי המודול לא תלוי באזור הזמן של המכונה (israelDayKey קובע את היום הישראלי לפי Asia/Jerusalem תמיד).
// הערה: קובץ זה נכתב בלי רצפי \u (תווים בלתי נראים נבנים עם String.fromCharCode) כדי שלא יהפכו לתווים גולמיים בעריכה.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const TZS = { 'UTC': [0, 0], 'Asia/Jerusalem': [-120, -180], 'America/New_York': [300, 240] }; // היסט דקות: ינואר, יולי

if (!process.env.SEARCH_TZ_CHILD) {
  let failed = false;
  for (const tz of Object.keys(TZS)) {
    console.log(`\n=== TZ=${tz} ===`);
    try {
      execFileSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), ...process.argv.slice(2)], {
        env: { ...process.env, TZ: tz, SEARCH_TZ_CHILD: '1' }, stdio: 'inherit',
      });
    } catch { failed = true; }
  }
  console.log(failed ? '\nFAILED in at least one time zone' : '\nALL 3 TIME ZONES PASSED');
  process.exit(failed ? 1 : 0);
}

const S = await import('../lib/searchNormalize.js');
const {
  cleanQuery, foldHebrew, escapeLike, sizeKey, isNumericSizeKey, sizeMatches, sizeSpellings, sizeSqlMatcher, phoneKey, phoneEquivalentKeys,
  phoneMatches, parseBarcodeDigits, parseGregorianDate, israelDayKey, gregorianMatches, gregorianCandidateKeys, HEBREW_MONTH_TABLE,
  hebrewMonthFromName, parseHebrewDayToken, parseHebrewYearToken, parseHebrewDate, hebrewDateMatchesStored, hebrewDateSqlParts, KEYWORD_GUIDE,
  parseKeywords, classifyQuery, SHORTCUT_CHARS, matchHighlight,
} = S;
const { normalizeSizeKey } = await import('../lib/sizeSort.js');
const { splitMatch } = await import('../lib/quickPrefix.js');
const { HEBREW_DAYS, HEBREW_MONTHS, getHebrewDateString } = await import('../lib/hebrewDate.js');
const require = createRequire(import.meta.url);
const { parseBarcode } = require('../lib/rentalBarcodeMatch.js');

let passed = 0;
let checks = 0;
function t(name, fn) {
  try { const before = checks; fn(); passed++; console.log(`  ok   - ${name} (${checks - before} checks)`); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
// כל assert נספר
const eq = (a, b, msg) => { checks++; assert.deepEqual(a, b, msg); };
const ok = (v, msg) => { checks++; assert.ok(v, msg); };
const no = (v, msg) => { checks++; assert.ok(!v, msg); };
const C = (...codes) => String.fromCharCode(...codes);
const RLM = C(0x200f); const LRM = C(0x200e); const ZWSP = C(0x200b); const BOM = C(0xfeff); const NBSP = C(0x00a0);
const NIQ_SHIN = C(0x05e9, 0x05c1); // ש + נקודת שין
const GERSHAYIM = C(0x05f4); const GERESH = C(0x05f3);
const CURLY_RDQ = C(0x201d); const CURLY_LDQ = C(0x201c); const CURLY_RSQ = C(0x2019);

console.log(`TZ=${process.env.TZ} offsets: ${new Date(2026, 0, 15).getTimezoneOffset()}/${new Date(2026, 6, 15).getTimezoneOffset()}`);
t('הסקריפט באמת רץ באזור הזמן המבוקש', () => {
  const [jan, jul] = TZS[process.env.TZ];
  eq(new Date(2026, 0, 15).getTimezoneOffset(), jan); eq(new Date(2026, 6, 15).getTimezoneOffset(), jul);
});

// ------------------------------------------------------------------------------------------------------------------------
console.log('cleanQuery');
t('חיתוך וכיווץ רווחים', () => {
  eq(cleanQuery('  שלום   עולם '), 'שלום עולם');
  eq(cleanQuery('\t a \n b\r\n'), 'a b');
  eq(cleanQuery(''), ''); eq(cleanQuery('   '), '');
  eq(cleanQuery(null), ''); eq(cleanQuery(undefined), ''); eq(cleanQuery(25734), '25734');
});
t('סימוני RTL/LTR ותווים באפס רוחב מוסרים', () => {
  eq(cleanQuery(`${RLM}6323401${LRM}`), '6323401');
  eq(cleanQuery(`63${ZWSP}23${BOM}401`), '6323401');
  eq(cleanQuery(`${C(0x202a)}כז${C(0x202c)} ${C(0x2066)}תשרי${C(0x2069)}`), 'כז תשרי');
  eq(cleanQuery(`מידה${RLM} 2`), 'מידה 2');
  eq(cleanQuery(`a${C(0x00ad)}b`), 'ab');
});
t('רווח קשיח ורווחים מוזרים -> רגיל', () => {
  eq(cleanQuery(`כז${NBSP}תשרי`), 'כז תשרי');
  eq(cleanQuery(`a${C(0x2003)}${C(0x202f)}${C(0x3000)}b`), 'a b');
});
t('גרשיים וגרש מאוחדים לצורה אחת', () => {
  eq(cleanQuery(`כ${GERSHAYIM}ז`), 'כ"ז');
  eq(cleanQuery(`כ${CURLY_RDQ}ז`), 'כ"ז');
  eq(cleanQuery(`כ${CURLY_LDQ}ז`), 'כ"ז');
  eq(cleanQuery('כ"ז'), 'כ"ז');
  eq(cleanQuery("ט''ו"), 'ט"ו');
  eq(cleanQuery('ט""ו'), 'ט"ו');
  eq(cleanQuery(`ב${GERESH}`), "ב'");
  eq(cleanQuery(`ב${CURLY_RSQ}`), "ב'");
  eq(cleanQuery(`ב${C(0x2018)}`), "ב'");
});
t('מקפים שונים -> מקף רגיל', () => {
  eq(cleanQuery(`ב${C(0x05be)}חשוון`), 'ב-חשוון');
  eq(cleanQuery(`38${C(0x2013)}40`), '38-40');
  eq(cleanQuery(`38${C(0x2014)}40`), '38-40');
});
t('NFC וספרות לא-לטיניות', () => {
  eq(cleanQuery(C(0x65, 0x301)), C(0xe9));
  eq(cleanQuery(C(0x0662, 0x0665)), '25');
  eq(cleanQuery(C(0xff12, 0xff15)), '25');
  eq(cleanQuery(C(0x06f1, 0x06f2)), '12');
});
t('max חותך', () => { eq(cleanQuery('abcdef', { max: 3 }), 'abc'); eq(cleanQuery('ab  cd', { max: 3 }), 'ab'); eq(cleanQuery('abc', { max: 10 }), 'abc'); });
t('idempotent', () => {
  for (const s of ['  כ״ז   תשרי ', `${RLM}6323401`, 'ט\'\'ו בשבט', 'מידה 2']) eq(cleanQuery(cleanQuery(s)), cleanQuery(s));
});

console.log('foldHebrew / escapeLike');
t('אותיות סופיות', () => {
  eq(foldHebrew('ךםןףץ'), 'כמנפצ');
  eq(foldHebrew('אברהם'), foldHebrew('אברהמ'));
  eq(foldHebrew('אברהם'), 'אברהמ');
  eq(foldHebrew('מלך'), foldHebrew('מלכ'));
  eq(foldHebrew('חיים'), 'חיימ'); eq(foldHebrew('נון'), 'נונ'); eq(foldHebrew('סוף'), 'סופ'); eq(foldHebrew('רץ'), 'רצ');
});
t('ניקוד נמחק, לטינית קטנה, ללא עברית כמו שהוא', () => {
  eq(foldHebrew(`${NIQ_SHIN}לום`), 'שלומ');
  eq(foldHebrew(`${NIQ_SHIN}${C(0x05b8)}לוֹם`.replace(C(0x05d5, 0x05b9), C(0x05d5))), 'שלומ');
  eq(foldHebrew('ABC 123'), 'abc 123');
  eq(foldHebrew(`כ${GERSHAYIM}ז${RLM}`), 'כ"ז');
  eq(foldHebrew(null), '');
  eq(foldHebrew(foldHebrew('שלום')), foldHebrew('שלום'));
});
t('escapeLike', () => { eq(escapeLike('100%'), '100\\%'); eq(escapeLike('a_b\\c'), 'a\\_b\\\\c'); eq(escapeLike('abc'), 'abc'); eq(escapeLike(null), ''); });

// ------------------------------------------------------------------------------------------------------------------------
console.log('sizes');
t('sizeKey - טבלה', () => {
  const table = [['02', '2'], ['2', '2'], ['002', '2'], [' 2 ', '2'], ['0', '0'], ['00', '0'], ['12', '12'], ['012', '12'], ['06', '6'], ['6', '6'],
    ['1000', '1000'], ['xl', 'XL'], ['XL', 'XL'], ['Xl', 'XL'], ['m', 'M'], ['38 - 40', '38-40'], ['36 א', '36א'], ['36א', '36א'], ['', 'כללי'],
    [null, 'כללי'], [undefined, 'כללי'], ['06.1', '06.1'], ['כללי', 'כללי'], [`${RLM}2`, '2'], [`${NBSP}02${NBSP}`, '2'], [2, '2'], ['38-40', '38-40']];
  for (const [i, o] of table) eq(sizeKey(i), o, `sizeKey(${JSON.stringify(i)})`);
});
t('sizeKey מתיישב עם normalizeSizeKey בקלט פשוט', () => {
  for (const x of ['02', '2', '10', '36', '006', '38-40', '36א', '', ' 06', '06.1', 'כללי']) eq(sizeKey(x), normalizeSizeKey(x), x);
});
t('sizeMatches - מדויק, בלי תת-מחרוזת', () => {
  for (const [stored, q] of [['02', '2'], ['2', '02'], ['002', '2'], ['2', '2'], [' 2', '02'], ['XL', 'xl'], ['38-40', '38 - 40'], ['36א', '36 א']]) ok(sizeMatches(stored, q), `${stored} ~ ${q}`);
  for (const bad of ['12', '20', '21', '22', '32', '42', '52', '102', '200', '2a', '0', '']) no(sizeMatches(bad, '2'), `${bad} !~ 2`);
  no(sizeMatches('2', '12')); no(sizeMatches('M', 'L')); no(sizeMatches('XL', 'L')); no(sizeMatches('XXL', 'XL'));
  no(sizeMatches('', '')); no(sizeMatches('2', '')); no(sizeMatches('כללי', ''));
});
t('sizeSpellings', () => {
  eq(sizeSpellings('2'), ['2', '02', '002']); eq(sizeSpellings('02'), ['2', '02', '002']); eq(sizeSpellings('002'), ['2', '02', '002']);
  eq(sizeSpellings('12'), ['12', '012']); eq(sizeSpellings('123'), ['123']); eq(sizeSpellings('0'), ['0', '00', '000']);
  eq(sizeSpellings('xl'), ['XL', 'xl']); eq(sizeSpellings('M'), ['M', 'm']); eq(sizeSpellings('38-40'), ['38-40']); eq(sizeSpellings('36 א'), ['36א']);
  eq(sizeSpellings(''), []); eq(sizeSpellings(null), []);
});
t('sizeSqlMatcher - regex מתקמפל ב-JS ומתאים בדיוק', () => {
  const m2 = sizeSqlMatcher('2');
  eq(m2.spellings, ['2', '02', '002']); eq(m2.flags, ''); eq(m2.regex, '^\\s*0*2\\s*$');
  const re2 = new RegExp(m2.regex, m2.flags);
  for (const s of ['2', '02', '002', ' 2 ', '2 ', ' 02', '\t2']) ok(re2.test(s), `re2 ${JSON.stringify(s)}`);
  for (const s of ['12', '20', '22', '32', '102', '0', '', '2a', 'כללי', '2-4']) no(re2.test(s), `re2 !${JSON.stringify(s)}`);
  const m0 = sizeSqlMatcher('0'); eq(m0.regex, '^\\s*0+\\s*$');
  const re0 = new RegExp(m0.regex); ok(re0.test('0')); ok(re0.test('00')); no(re0.test('10')); no(re0.test('')); no(re0.test('01'));
  const mx = sizeSqlMatcher('xl'); eq(mx.flags, 'i');
  const rex = new RegExp(mx.regex, mx.flags); ok(rex.test('xl')); ok(rex.test(' XL ')); no(rex.test('XXL')); no(rex.test('L'));
  const mr = sizeSqlMatcher('38-40'); const rer = new RegExp(mr.regex, mr.flags);
  ok(rer.test('38-40')); ok(rer.test('38 - 40')); no(rer.test('38-4')); no(rer.test('138-40'));
  const mp = sizeSqlMatcher('06.1'); ok(new RegExp(mp.regex, mp.flags).test('06.1')); no(new RegExp(mp.regex, mp.flags).test('06x1')); // הנקודה מוברחת
  eq(sizeSqlMatcher(''), { spellings: [], regex: null, flags: '' });
});
t('דיוק מספרי מלא: 0..300 - אף מידה לא תואמת מידה אחרת (regex, IN ו-sizeMatches)', () => {
  for (let n = 0; n <= 300; n++) {
    const m = sizeSqlMatcher(String(n));
    const re = new RegExp(m.regex, m.flags);
    const own = [String(n), String(n).padStart(2, '0'), String(n).padStart(3, '0')];
    for (const s of own) { ok(re.test(s), `regex ${n} ~ ${s}`); ok(m.spellings.includes(s), `spellings ${n} has ${s}`); }
    for (const k of [n + 1, n + 10, n * 10 + 1, n === 0 ? 1 : 0, 12, 20, 32].filter((k) => k !== n)) {
      for (const s of [String(k), String(k).padStart(2, '0'), String(k).padStart(3, '0')]) {
        no(re.test(s), `regex ${n} !~ ${s}`); no(m.spellings.includes(s), `spellings ${n} !has ${s}`); no(sizeMatches(s, String(n)), `sizeMatches ${s} ${n}`);
      }
    }
  }
});
t('isNumericSizeKey', () => { ok(isNumericSizeKey('2')); ok(isNumericSizeKey('123')); no(isNumericSizeKey('1234')); no(isNumericSizeKey('XL')); no(isNumericSizeKey('06.1')); no(isNumericSizeKey('')); });

// ------------------------------------------------------------------------------------------------------------------------
console.log('phone');
t('phoneKey - טבלה', () => {
  const table = [['050-123-4567', '0501234567'], ['(050) 123 4567', '0501234567'], ['050.123.4567', '0501234567'], ['0501234567', '0501234567'],
    ['+972-50-123-4567', '0501234567'], ['+972501234567', '0501234567'], ['972501234567', '0501234567'], ['00972501234567', '0501234567'],
    ['+972 (0) 50 123 4567', '0501234567'], ['03-1234567', '031234567'], ['+97231234567', '031234567'], ['972', '972'], ['9725', '9725'],
    ['', ''], ['abc', ''], ['+972', ''], [null, ''], [`${RLM}050${LRM}-1234567`, '0501234567'], ['052 - 441 8210', '0524418210']];
  for (const [i, o] of table) eq(phoneKey(i), o, `phoneKey(${JSON.stringify(i)})`);
});
t('phoneEquivalentKeys', () => {
  eq(phoneEquivalentKeys('050-123-4567'), ['0501234567', '972501234567']);
  eq(phoneEquivalentKeys('+972501234567'), ['0501234567', '972501234567']);
  eq(phoneEquivalentKeys(''), []); eq(phoneEquivalentKeys('abc'), []);
});
t('phoneMatches', () => {
  ok(phoneMatches('050-1234567', '0501234567')); ok(phoneMatches('0501234567', '050-123-4567')); ok(phoneMatches('050-1234567', '+972501234567'));
  ok(phoneMatches('+972-50-1234567', '0501234567')); ok(phoneMatches('0501234567', '501234567')); ok(phoneMatches('03-1234567', '031234567'));
  ok(phoneMatches('050-1234567', '050-123')); ok(phoneMatches('050-1234567', '4567'));
  no(phoneMatches('050-1234567', '0509999999')); no(phoneMatches('050-1234567', '05')); no(phoneMatches('', '0501234567')); no(phoneMatches('0501234567', ''));
  no(phoneMatches('0501234567', '050123456')); // 9 ספרות = מספר שלם (מתחיל ב-0): שוויון, לא תת-מחרוזת
  ok(phoneMatches('0501234567', '05', { minPartial: 2 }));
});

// ------------------------------------------------------------------------------------------------------------------------
console.log('barcode');
t('parseBarcodeDigits - דוגמאות הבעלים', () => {
  eq(parseBarcodeDigits('6323401'), { digits: '6323401', prefix: '632', size: '34', serial: '01', sizeKey: '34', legacy: false });
  eq(parseBarcodeDigits('1750301'), { digits: '1750301', prefix: '175', size: '03', serial: '01', sizeKey: '3', legacy: false });
  eq(parseBarcodeDigits('41807'), { digits: '41807', prefix: '4', size: '18', serial: '07', sizeKey: '18', legacy: true });
  eq(parseBarcodeDigits(`${RLM}6323401${LRM}`).prefix, '632');
  eq(parseBarcodeDigits('1234'), null); eq(parseBarcodeDigits('12a4567'), null); eq(parseBarcodeDigits(''), null); eq(parseBarcodeDigits(null), null);
});
t('parseBarcodeDigits זהה ל-parseBarcode של lib/rentalBarcodeMatch.js', () => {
  for (const b of ['6323401', '1750301', '41807', '2573401', '12345', '123456', '99999999', '1234', 'abc', '', '12 34567', '00000']) {
    const mine = parseBarcodeDigits(b); const theirs = parseBarcode(b);
    eq(mine === null, theirs === null, b);
    if (mine) eq([mine.prefix, mine.size, mine.serial], [theirs.prefix, theirs.size, theirs.serial], b);
  }
});

// ------------------------------------------------------------------------------------------------------------------------
console.log('gregorian dates');
t('parseGregorianDate - תקינים', () => {
  const g = (q) => { const r = parseGregorianDate(q); return r && [r.day, r.month, r.year]; };
  eq(g('5/10'), [5, 10, null]); eq(g('5.10'), [5, 10, null]); eq(g('5-10'), [5, 10, null]); eq(g('05/10'), [5, 10, null]);
  eq(g('05/10/2026'), [5, 10, 2026]); eq(g('5.10.2026'), [5, 10, 2026]); eq(g('5-10-2026'), [5, 10, 2026]); eq(g('5/10/26'), [5, 10, 2026]);
  eq(g('2026-10-05'), [5, 10, 2026]); eq(g('2026/10/5'), [5, 10, 2026]); eq(g('31/12'), [31, 12, null]); eq(g('29/2'), [29, 2, null]);
  eq(g('29/2/2024'), [29, 2, 2024]); eq(g('1/1/99'), [1, 1, 2099]);
  eq(parseGregorianDate('05/10/2026').key, '2026-10-05'); eq(parseGregorianDate('5/10').key, null);
  eq(parseGregorianDate('5/10/26').twoDigitYear, true); eq(parseGregorianDate('5/10/2026').twoDigitYear, false);
  eq(g(`${RLM}5/10${LRM}`), [5, 10, null]);
});
t('parseGregorianDate - לא תקינים', () => {
  for (const bad of ['29/2/2025', '31/4', '0/5', '5/0', '5/13', '13/13/2026', '5/10.2026', '38-40', 'abc', '5/10/2026/1', '5', '2026', '5//10', '/5/10', '5/10/', '32/1', '1/1/1800', '5 / 10', '']) eq(parseGregorianDate(bad), null, bad);
});
t('ambiguous: נקודה/מקף בלי שנה', () => {
  eq(parseGregorianDate('5.10').ambiguous, true); eq(parseGregorianDate('5-10').ambiguous, true); eq(parseGregorianDate('5/10').ambiguous, false);
  eq(parseGregorianDate('5.10.2026').ambiguous, false); eq(parseGregorianDate('5-10-2026').ambiguous, false);
});
t('israelDayKey - לא תלוי באזור הזמן של המכונה', () => {
  eq(israelDayKey(new Date(Date.UTC(2026, 9, 4, 21, 0))), '2026-10-05'); // חצות ישראל בקיץ (UTC+3) = 21:00 UTC
  eq(israelDayKey(new Date(Date.UTC(2026, 9, 4, 20, 59))), '2026-10-04');
  eq(israelDayKey(new Date(Date.UTC(2026, 9, 5, 0, 0))), '2026-10-05'); // חצות UTC = 03:00 בישראל
  eq(israelDayKey(new Date(Date.UTC(2026, 0, 14, 22, 0))), '2026-01-15'); // חצות ישראל בחורף (UTC+2) = 22:00 UTC
  eq(israelDayKey(new Date(Date.UTC(2026, 0, 14, 21, 59))), '2026-01-14');
  eq(israelDayKey(new Date(Date.UTC(2026, 0, 15, 22, 0))), '2026-01-16');
  eq(israelDayKey('2026-10-05T21:00:00.000Z'), '2026-10-06'); eq(israelDayKey('2026-10-05'), '2026-10-05');
  eq(israelDayKey(Date.UTC(2026, 9, 4, 21, 0)), '2026-10-05');
  eq(israelDayKey('not a date'), null); eq(israelDayKey(new Date(NaN)), null);
  // מעבר שעון הקיץ בישראל (2026-03-27 חצות -> 03:00)
  eq(israelDayKey(new Date(Date.UTC(2026, 2, 26, 22, 0))), '2026-03-27');
});
t('gregorianMatches - מדויק, לא תת-מחרוזת', () => {
  const g = parseGregorianDate('5/10');
  ok(gregorianMatches('2026-10-05', g)); ok(gregorianMatches('2025-10-05', g)); ok(gregorianMatches(new Date(Date.UTC(2026, 9, 4, 21, 0)), g)); ok(gregorianMatches(new Date(Date.UTC(2026, 9, 5, 0, 0)), g));
  no(gregorianMatches('2026-10-15', g)); no(gregorianMatches('2026-10-25', g)); no(gregorianMatches('2026-11-05', g)); no(gregorianMatches('2026-05-10', g));
  no(gregorianMatches(new Date(Date.UTC(2026, 9, 5, 21, 0)), g)); // כבר ה-6 באוקטובר בישראל
  const gy = parseGregorianDate('05/10/2026');
  ok(gregorianMatches('2026-10-05', gy)); no(gregorianMatches('2025-10-05', gy));
  no(gregorianMatches('2026-10-05', null)); no(gregorianMatches('garbage', g));
});
t('gregorianCandidateKeys', () => {
  eq(gregorianCandidateKeys(parseGregorianDate('05/10/2026')), ['2026-10-05']);
  eq(gregorianCandidateKeys(parseGregorianDate('5/10'), { year: 2026 }), ['2025-10-05', '2026-10-05', '2027-10-05', '2028-10-05']);
  eq(gregorianCandidateKeys(parseGregorianDate('29/2'), { year: 2026 }), ['2028-02-29']);
  eq(gregorianCandidateKeys(null), []);
});

// ------------------------------------------------------------------------------------------------------------------------
console.log('hebrew date tokens');
t('parseHebrewDayToken', () => {
  const ok_ = [['כז', 27], ['כ"ז', 27], [`כ${GERSHAYIM}ז`, 27], ['ט"ו', 15], ['טו', 15], [`ט${GERSHAYIM}ז`, 16], ['טז', 16], ['ב', 2], ["ב'", 2], [`ב${GERESH}`, 2], ['א', 1], ['ל', 30],
    ['כ', 20], ['יא', 11], ['יה', 15], ['יו', 16], ['27', 27], ['1', 1], ['30', 30], ['05', 5], ['כח', 28], ['כט', 29], ['י', 10]];
  for (const [i, o] of ok_) eq(parseHebrewDayToken(i), o, i);
  for (const bad of ['אב', 'כל', 'דן', 'לא', 'מ', '31', '0', '00', 'ככ', 'שרה', '', 'תשרי', 'בן', 'גד', 'ז"כ', '100', 'x']) eq(parseHebrewDayToken(bad), null, `bad ${bad}`);
});
t('parseHebrewDayToken - כל HEBREW_DAYS של האתר', () => {
  for (let d = 1; d <= 30; d++) eq(parseHebrewDayToken(HEBREW_DAYS[d]), d, HEBREW_DAYS[d]);
});
t('parseHebrewYearToken', () => {
  eq(parseHebrewYearToken('תשפ"ז'), 5787); eq(parseHebrewYearToken('תשפז'), 5787); eq(parseHebrewYearToken(`תשפ${GERSHAYIM}ז`), 5787);
  eq(parseHebrewYearToken("ה'תשפ\"ז"), 5787); eq(parseHebrewYearToken('5787'), 5787); eq(parseHebrewYearToken('תשפ"ו'), 5786); eq(parseHebrewYearToken('תשפ'), 5780);
  for (const bad of ['תשרי', 'שלום', '1234', '2026', '5000', '', 'תש', 'תשפזז']) eq(parseHebrewYearToken(bad), null, bad);
});

console.log('hebrew month table');
t('HEBREW_MONTH_TABLE עקבי עם lib/hebrewDate.js ו-aliases', () => {
  eq(HEBREW_MONTH_TABLE.length, 14);
  // האיות הראשון של כל חודש = מה שהאתר כותב (HEBREW_MONTHS)
  eq(HEBREW_MONTH_TABLE.find((m) => m.name === 'Av').spellings[0], HEBREW_MONTHS[5]);
  eq(HEBREW_MONTH_TABLE.find((m) => m.name === 'Cheshvan').spellings[0], HEBREW_MONTHS[8]);
  eq(HEBREW_MONTH_TABLE.find((m) => m.name === 'Kislev').spellings[0], HEBREW_MONTHS[9]);
  eq(HEBREW_MONTH_TABLE.find((m) => m.name === 'Adar').spellings[0], HEBREW_MONTHS[12]);
  eq(HEBREW_MONTH_TABLE.find((m) => m.name === 'Adar II').spellings[0], HEBREW_MONTHS[13]);
  eq(HEBREW_MONTH_TABLE.find((m) => m.name === 'Adar I').spellings[0], "אדר א'");
  for (const m of HEBREW_MONTH_TABLE) if (!m.name.startsWith('Adar')) eq(m.spellings[0], HEBREW_MONTHS[m.number], m.name);
  for (const m of HEBREW_MONTH_TABLE) for (const a of m.aliases) eq(hebrewMonthFromName(a).name, m.name, a);
  eq(hebrewMonthFromName('Cheshvan').he, 'חשוון'); eq(hebrewMonthFromName(''), null); eq(hebrewMonthFromName('שלום'), null);
  eq(hebrewMonthFromName("אדר ב'").name, 'Adar II'); eq(hebrewMonthFromName('מנחם-אב').name, 'Av');
});

console.log('parseHebrewDate');
t('פירוק - טבלה', () => {
  // [קלט, יום, monthKey, שנה, monthOnly]
  const T = [
    ['כז תשרי', 27, 'Tishrei', null, false], ['כ"ז תשרי', 27, 'Tishrei', null, false], [`כ${GERSHAYIM}ז תשרי`, 27, 'Tishrei', null, false], [`כ${GERSHAYIM}ז בתשרי`, 27, 'Tishrei', null, false],
    ['כז ב תשרי', 27, 'Tishrei', null, false], ['כז ב-תשרי', 27, 'Tishrei', null, false], ['27 תשרי', 27, 'Tishrei', null, false], ['27 בתשרי', 27, 'Tishrei', null, false],
    ['טו בשבט', 15, 'Shvat', null, false], ['ט"ו בשבט', 15, 'Shvat', null, false], [`ט${GERSHAYIM}ו שבט`, 15, 'Shvat', null, false], ['טז תמוז', 16, 'Tamuz', null, false],
    ['ב חשוון', 2, 'Cheshvan', null, false], ['ב חשון', 2, 'Cheshvan', null, false], ['ב מרחשוון', 2, 'Cheshvan', null, false], ['ב מרחשון', 2, 'Cheshvan', null, false],
    ["ב' חשוון", 2, 'Cheshvan', null, false], ['ג חשוון', 3, 'Cheshvan', null, false], ['ל חשוון', 30, 'Cheshvan', null, false],
    ['כה כסלו', 25, 'Kislev', null, false], ['כה כסליו', 25, 'Kislev', null, false], ['כט טבת', 29, 'Tevet', null, false], ['ל שבט', 30, 'Shvat', null, false],
    ['כז סיון', 27, 'Sivan', null, false], ['כז סיוון', 27, 'Sivan', null, false], ['ו אייר', 6, 'Iyyar', null, false], ['ו איר', 6, 'Iyyar', null, false],
    ['י אב', 10, 'Av', null, false], ['י מנחם אב', 10, 'Av', null, false], ['יד באב', 14, 'Av', null, false], ['ט באב', 9, 'Av', null, false], ['כג אלול', 23, 'Elul', null, false],
    ['טו ניסן', 15, 'Nisan', null, false], ['כא אדר', 21, 'Adar', null, false], ['כא אדר א', 21, 'Adar I', null, false], ["כא אדר א'", 21, 'Adar I', null, false],
    ['כא אדר ראשון', 21, 'Adar I', null, false], ['יד אדר ב', 14, 'Adar II', null, false], ["יד אדר ב'", 14, 'Adar II', null, false], ['יד אדר שני', 14, 'Adar II', null, false],
    ['ל אדר א', 30, 'Adar I', null, false], ['ב אדר ב', 2, 'Adar II', null, false],
    ['כז תשרי תשפז', 27, 'Tishrei', 5787, false], ['כז תשרי תשפ"ז', 27, 'Tishrei', 5787, false], [`כ${GERSHAYIM}ז תשרי תשפ${GERSHAYIM}ז`, 27, 'Tishrei', 5787, false],
    ['כז תשרי 5787', 27, 'Tishrei', 5787, false], ['כז בתשרי תשפ"ו', 27, 'Tishrei', 5786, false],
    ['בחשוון', null, 'Cheshvan', null, true], ['ב-חשוון', null, 'Cheshvan', null, true], ['חודש חשוון', null, 'Cheshvan', null, true], ['חשוון', null, 'Cheshvan', null, true],
    ['חשוון תשפז', null, 'Cheshvan', 5787, true], ['באב', null, 'Av', null, true], ['באדר', null, 'Adar', null, true], ['תשרי', null, 'Tishrei', null, true], ['ניסן', null, 'Nisan', null, true],
    [`${RLM}כז${LRM} תשרי`, 27, 'Tishrei', null, false],
  ];
  for (const [q, d, mk, y, mo] of T) {
    const r = parseHebrewDate(q);
    ok(r, `parse ${q}`);
    eq([r.day, r.monthKey, r.year, r.monthOnly], [d, mk, y, mo], q);
  }
});
t('לא תאריך', () => {
  for (const bad of ['שרה כהן', 'כז', 'תשרי כז', 'כז תשרי משהו', 'כל אב', 'דן אב', 'אב', 'איר', '', 'ל טבת', 'ל אייר', 'ל אדר', 'לא תשרי', 'כז תשרי תשפז עוד', 'חשוון כסלו', 'מנחם', 'שלום תשרי', 'כב']) eq(parseHebrewDate(bad), null, `bad ${bad}`);
});
t('ambiguousB / bareMonthName', () => {
  eq(parseHebrewDate('ב חשוון').ambiguousB, true); eq(parseHebrewDate("ב' חשוון").ambiguousB, true); eq(parseHebrewDate('ג חשוון').ambiguousB, false);
  eq(parseHebrewDate('בחשוון').ambiguousB, false); eq(parseHebrewDate('כז ב תשרי').ambiguousB, false);
  eq(parseHebrewDate('ניסן').bareMonthName, true); eq(parseHebrewDate('חשוון').bareMonthName, true); eq(parseHebrewDate('בחשוון').bareMonthName, false);
  eq(parseHebrewDate('חשוון תשפז').bareMonthName, false); eq(parseHebrewDate('כז תשרי').bareMonthName, false);
});
t('spellingsToMatch - "ב חשוון" הוא יום 2 ולא "כב"', () => {
  const r = parseHebrewDate('ב חשוון');
  ok(r.spellingsToMatch.includes('ב חשוון')); ok(r.spellingsToMatch.includes("ב' חשוון")); ok(r.spellingsToMatch.includes('ב חשון')); ok(r.spellingsToMatch.includes('ב מרחשוון'));
  no(r.spellingsToMatch.some((s) => s.includes('כב')));
  eq(r.daySpellings, ['ב', "ב'"]); eq(r.monthSpellings, ['חשוון', 'חשון', 'מרחשוון', 'מרחשון']); eq(r.yearSpellings, []);
  const k = parseHebrewDate('כז תשרי תשפ"ז');
  eq(k.spellingsToMatch, ['כז תשרי תשפ"ז', 'כז תשרי תשפז', 'כ"ז תשרי תשפ"ז', 'כ"ז תשרי תשפז']); eq(k.yearSpellings, ['תשפ"ז', 'תשפז']);
  eq(parseHebrewDate('כז תשרי').spellingsToMatch, ['כז תשרי', 'כ"ז תשרי']);
  eq(parseHebrewDate('בחשוון').spellingsToMatch, ['חשוון', 'חשון', 'מרחשוון', 'מרחשון']);
  // אדר לבדו = כל משפחת האדרים; אדר ב' מפורש = רק אדר ב'
  eq(parseHebrewDate('יד אדר').monthSpellings, ['אדר', "אדר א'", 'אדר א', 'אדר ראשון', "אדר ב'", 'אדר ב', 'אדר שני']);
  eq(parseHebrewDate("יד אדר ב'").monthSpellings, ["אדר ב'", 'אדר ב', 'אדר שני']);
  eq(parseHebrewDate('י מנחם אב').monthSpellings, ['אב', 'מנחם אב']);
});
t('מספר חודש hebcal', () => {
  eq(parseHebrewDate('א ניסן').month, 1); eq(parseHebrewDate('א תשרי').month, 7); eq(parseHebrewDate('א אדר').month, 12); eq(parseHebrewDate('א אדר א').month, 12); eq(parseHebrewDate('א אדר ב').month, 13);
});

console.log('hebrew date matching');
t('hebrewDateMatchesStored - "ב חשוון" לא תואם "כב/יב"', () => {
  const p = parseHebrewDate('ב חשוון');
  for (const s of ['ב חשוון תשפ"ז', 'ב חשון תשפז', "ב' חשוון תשפ\"ז", 'ב חשוון', 'ב מרחשוון תשפ"ו', `ב חשוון תשפ${GERSHAYIM}ז`]) ok(hebrewDateMatchesStored(s, p), s);
  for (const s of ['כב חשוון תשפ"ז', 'יב חשוון', 'ב תשרי תשפ"ז', 'ג חשוון', 'ב כסלו', '', 'חשוון', 'שלום']) no(hebrewDateMatchesStored(s, p), s);
});
t('hebrewDateMatchesStored - כז תשרי', () => {
  const p = parseHebrewDate('כז תשרי');
  for (const s of ['כז תשרי תשפ"ז', 'כז תשרי תשפז', 'כ"ז תשרי תשפ"ז', 'כז תשרי', "כז תשרי תשפ\"ו", `כ${GERSHAYIM}ז תשרי תשפ${GERSHAYIM}ז`]) ok(hebrewDateMatchesStored(s, p), s);
  for (const s of ['ז תשרי תשפ"ז', 'יז תשרי', 'כז חשוון', 'כח תשרי', 'כז תשרי2']) no(hebrewDateMatchesStored(s, p), s);
  const py = parseHebrewDate('כז תשרי תשפ"ז');
  ok(hebrewDateMatchesStored('כז תשרי תשפ"ז', py)); ok(hebrewDateMatchesStored('כז תשרי תשפז', py)); no(hebrewDateMatchesStored('כז תשרי תשפ"ו', py)); no(hebrewDateMatchesStored('כז תשרי', py));
});
t('hebrewDateMatchesStored - חודש בלבד ואדר', () => {
  const pm = parseHebrewDate('בחשוון');
  ok(hebrewDateMatchesStored('כב חשוון תשפ"ז', pm)); ok(hebrewDateMatchesStored('א חשון תשפז', pm)); no(hebrewDateMatchesStored('כב תשרי תשפ"ז', pm)); no(hebrewDateMatchesStored('כב כסלו', pm));
  const pa = parseHebrewDate('באדר');
  for (const s of ["יד אדר ב' תשפ\"ו", 'יד אדר תשפ"ה', "יד אדר א' תשפ\"ה"]) ok(hebrewDateMatchesStored(s, pa), s);
  no(hebrewDateMatchesStored('יד אב תשפ"ה', pa));
  const pav = parseHebrewDate('באב'); ok(hebrewDateMatchesStored('יד אב', pav)); ok(hebrewDateMatchesStored('ט מנחם אב תשפ"ו', pav)); no(hebrewDateMatchesStored('כג אדר', pav));
  const p2 = parseHebrewDate("כב אדר ב'"); ok(hebrewDateMatchesStored("כב אדר ב' תשפ\"ו", p2)); no(hebrewDateMatchesStored('כב אדר תשפ"ה', p2)); no(hebrewDateMatchesStored("כב אדר א' תשפ\"ו", p2));
  no(hebrewDateMatchesStored('כז תשרי', null));
});
t('hebrewDateSqlParts', () => {
  const p = hebrewDateSqlParts(parseHebrewDate('ב חשוון'));
  eq(p.equals.includes('ב חשוון'), true); eq(p.startsWith.includes('ב חשוון '), true); eq(p.contains, []); eq(p.endsWith, []);
  eq(p.startsWith.some((s) => s.startsWith('כב')), false);
  const pm = hebrewDateSqlParts(parseHebrewDate('בחשוון'));
  eq(pm.contains, [' חשוון ', ' חשון ', ' מרחשוון ', ' מרחשון ']); eq(pm.endsWith, [' חשוון', ' חשון', ' מרחשוון', ' מרחשון']); eq(pm.equals, []);
  eq(hebrewDateSqlParts(null), { equals: [], startsWith: [], contains: [], endsWith: [] });
});
t('מחזור שלם מול מחולל התאריכים של האתר (getHebrewDateString): 900 ימים, כל אחד נמצא ורק הוא', () => {
  const days = [];
  for (let i = 0; i < 900; i++) days.push(new Date(Date.UTC(2025, 8, 1 + i, 12, 0, 0))); // צהריים UTC - אותו יום עברי בכל אזור
  const stored = days.map((d) => getHebrewDateString(d));
  const parts = stored.map((s) => { const a = s.split(' '); return { s, year: a[a.length - 1], dm: a.slice(0, -1).join(' ') }; });
  const uniq = new Set(parts.map((p) => p.dm)); // כל זוגות יום+חודש הקיימים
  eq(uniq.size >= 354, true);
  const sample = parts.filter((_, i) => i % 7 === 0); // 129 תאריכים לבדיקה מלאה מול הכל
  for (const p of sample) {
    const q1 = parseHebrewDate(p.dm); // "כז תשרי" / "יד אדר ב'"
    ok(q1, `parse dm ${p.dm}`);
    const q2 = parseHebrewDate(p.s); // כולל שנה
    ok(q2 && q2.year, `parse full ${p.s}`);
    ok(hebrewDateMatchesStored(p.s, q1), `self ${p.s}`); ok(hebrewDateMatchesStored(p.s, q2), `self-y ${p.s}`);
    for (const o of parts) {
      // 'אדר' בלי א/ב (שנה פשוטה) = כל משפחת האדרים (החלטה מתועדת); אדר א'/ב' מפורש = בדיוק הוא
      const fam = (x) => x.replace(/ אדר.*$/, ' אדר');
      const should = p.dm.endsWith(' אדר') ? fam(o.dm) === fam(p.dm) : o.dm === p.dm;
      if (hebrewDateMatchesStored(o.s, q1) !== should) assert.fail(`dm ${p.dm} vs ${o.s}: expected ${should}`);
      // עם שנה: אותו יום+חודש+שנה בלבד
      const should2 = o.s === p.s;
      if (hebrewDateMatchesStored(o.s, q2) !== should2) assert.fail(`full ${p.s} vs ${o.s}: expected ${should2}`);
    }
    checks += 2;
  }
});
t('התאמה ל-SQL parts: הטקסט השמור של האתר נתפס בדיוק ב-equals/startsWith', () => {
  for (let i = 0; i < 400; i += 3) {
    const s = getHebrewDateString(new Date(Date.UTC(2026, 0, 1 + i, 12)));
    const dm = s.split(' ').slice(0, -1).join(' ');
    const parts = hebrewDateSqlParts(parseHebrewDate(dm));
    ok(parts.equals.includes(dm) || parts.startsWith.some((x) => s.startsWith(x)), `${s} by ${dm}`);
    ok(parts.startsWith.some((x) => s.startsWith(x)), `${s} startsWith`);
  }
});

// ------------------------------------------------------------------------------------------------------------------------
console.log('parseKeywords');
t('דוגמאות הבעלים וצורות סמוכות', () => {
  const k = (q) => { const r = parseKeywords(q); return [r.size, r.model, r.rest]; };
  eq(k('מידה 2'), ['2', null, '']); eq(k('דגם 3'), [null, '3', '']);
  eq(k('מידה 2 דגם 3'), ['2', '3', '']); eq(k('דגם 3 מידה 2'), ['2', '3', '']); eq(k('מידה 02 דגם 3'), ['02', '3', '']);
  eq(k('מידה: 2'), ['2', null, '']); eq(k('מידה2'), ['2', null, '']); eq(k('מדה 2'), ['2', null, '']); eq(k('דגם3 מידה2'), ['2', '3', '']);
  eq(k('מידה XL'), ['XL', null, '']); eq(k('מידה xl'), ['xl', null, '']); eq(k('מידה 36א'), ['36א', null, '']); eq(k('מידה 38-40'), ['38-40', null, '']);
  eq(k('מידה 2 שרה'), ['2', null, 'שרה']); eq(k('שרה מידה 2'), ['2', null, 'שרה']); eq(k('שרה מידה 2 כהן'), ['2', null, 'שרה כהן']);
  eq(k('דגם שרה'), [null, 'שרה', '']); eq(k('דגם שרה כהן מידה 4'), ['4', 'שרה כהן', '']); eq(k('מידה 4 דגם שרה כהן'), ['4', 'שרה כהן', '']);
  eq(k(`מידה${RLM} 2 ${LRM}דגם 3`), ['2', '3', '']);
  eq(k('מידה 2 מידה 3'), ['2', null, 'מידה 3']);
});
t('פרטי sizeKey / sizeSpellings / modelIsPrefix', () => {
  const r = parseKeywords('מידה 02 דגם 3');
  eq(r.sizeKey, '2'); eq(r.sizeSpellings, ['2', '02', '002']); eq(r.modelIsPrefix, true); eq(r.any, true); eq(r.count, 2); eq(r.pending, null);
  eq(parseKeywords('דגם שרה').modelIsPrefix, false);
  const n = parseKeywords('שרה כהן'); eq([n.any, n.count, n.size, n.model, n.sizeKey, n.sizeSpellings], [false, 0, null, null, null, []]);
});
t('מילת מפתח בלי ערך תקין לא נבלעת', () => {
  eq(parseKeywords('מידה').rest, 'מידה'); eq(parseKeywords('מידה').pending, 'size'); eq(parseKeywords('מידה').any, false);
  eq(parseKeywords('מידה אבג').rest, 'מידה אבג'); eq(parseKeywords('מידה אבג').size, null);
  eq(parseKeywords('דגם 3 מידה').pending, 'size'); eq(parseKeywords('דגם 3 מידה').model, '3');
  eq(parseKeywords('דגם').pending, 'model'); eq(parseKeywords('ברקוד 123').barcode, null); eq(parseKeywords('ברקוד 123').rest, 'ברקוד 123');
  eq(parseKeywords('דגם מידה 2').model, null); eq(parseKeywords('דגם מידה 2').size, '2');
});
t('קיצורים לא בטוחים לא מוכרים', () => {
  eq(parseKeywords("מ' 2").any, false); eq(parseKeywords('מ 2').any, false); eq(parseKeywords('מידות 2').any, false); eq(parseKeywords('המידה 2').any, false); eq(parseKeywords('size 2').any, false);
});
t('ברקוד / הזמנה / טלפון כמילות מפתח', () => {
  eq(parseKeywords('ברקוד 6323401').barcode, '6323401'); eq(parseKeywords('הזמנה 25734').orderNumber, '25734');
  eq(parseKeywords('מספר הזמנה 25734').orderNumber, '25734'); eq(parseKeywords("מס' הזמנה 25734").orderNumber, '25734'); eq(parseKeywords('מס הזמנה 25734').orderNumber, '25734');
  eq(parseKeywords('טלפון 050-123-4567').phone, '050-123-4567'); eq(parseKeywords('טלפון 050 123 4567').phone, '050 123 4567'); eq(parseKeywords('נייד 0501234567').phone, '0501234567');
  eq(parseKeywords('טלפון 050-123-4567 שרה').rest, 'שרה'); eq(parseKeywords('טלפון').phone, null); eq(parseKeywords('טלפון שרה').phone, null);
  eq(parseKeywords('ברקוד 6323401 מידה 34').count, 2);
});

// ------------------------------------------------------------------------------------------------------------------------
console.log('classifyQuery');
t('טבלה: סוג ראשי ורשימת פרשנויות', () => {
  const T = [
    // ריק
    ['', 'empty', ['empty']], ['   ', 'empty', ['empty']], [null, 'empty', ['empty']], [`${RLM}${LRM}`, 'empty', ['empty']],
    // קידומות
    ['#', 'shortcut', ['shortcut']], ['$abc', 'shortcut', ['shortcut']], ['&', 'shortcut', ['shortcut']], ['%מידה', 'shortcut', ['shortcut']], ['@', 'shortcut', ['shortcut']], ['%', 'shortcut', ['shortcut']],
    // ספרות: עד 4 = הזמנה
    ['1', 'orderNumber', ['orderNumber']], ['25', 'orderNumber', ['orderNumber']], ['02', 'orderNumber', ['orderNumber']], ['257', 'orderNumber', ['orderNumber']], ['1234', 'orderNumber', ['orderNumber']],
    // 5-6 = הזמנה קודם, ברקוד שני
    ['25734', 'orderNumber', ['orderNumber', 'barcode']], ['41807', 'orderNumber', ['orderNumber', 'barcode']], ['123456', 'orderNumber', ['orderNumber', 'barcode']],
    // 7 = ברקוד; 8 = ברקוד
    ['6323401', 'barcode', ['barcode']], ['1750301', 'barcode', ['barcode']], ['2573401', 'barcode', ['barcode']], ['12345678', 'barcode', ['barcode']],
    [`${RLM}6323401${LRM}`, 'barcode', ['barcode']], ['9725012', 'barcode', ['barcode']],
    // טלפון
    ['0501234567', 'phone', ['phone']], ['050-123-4567', 'phone', ['phone']], ['(050) 123 4567', 'phone', ['phone']], ['031234567', 'phone', ['phone']], ['03-1234567', 'phone', ['phone']],
    ['+972501234567', 'phone', ['phone']], ['972501234567', 'phone', ['phone']], ['972 50 123 4567', 'phone', ['phone']], ['+972-50-123-4567', 'phone', ['phone']], ['0524418210', 'phone', ['phone']],
    ['050', 'phone', ['phone']], ['0501', 'phone', ['phone']], ['050123', 'phone', ['phone']], ['0501234', 'phone', ['phone']], ['050-123', 'phone', ['phone']],
    ['123456789', 'number', ['number']], ['12345678901234', 'number', ['number']], ['38-40', 'number', ['number']],
    // תאריך לועזי
    ['5/10', 'date', ['date']], ['05/10/2026', 'date', ['date']], ['5/10/26', 'date', ['date']], ['2026-10-05', 'date', ['date']], ['5.10.2026', 'date', ['date']],
    ['5.10', 'date', ['date', 'text']], ['5-10', 'date', ['date', 'text']], ['6.1', 'date', ['date', 'text']], ['31/4', 'text', ['text']],
    // תאריך עברי
    ['כז תשרי', 'date', ['date']], ['כ"ז תשרי', 'date', ['date']], [`כ${GERSHAYIM}ז תשרי תשפ${GERSHAYIM}ז`, 'date', ['date']], ['ב חשוון', 'date', ['date']], ['בחשוון', 'date', ['date']], ['ב-חשוון', 'date', ['date']],
    ['ט"ו בשבט', 'date', ['date']], ['יד אדר ב', 'date', ['date']], ['חשוון', 'date', ['date', 'text']], ['ניסן', 'text', ['text', 'date']], ['אב', 'text', ['text']], ['איר', 'text', ['text']],
    // מפורש
    ['ברקוד 6323401', 'barcode', ['barcode']], ['הזמנה 25734', 'orderNumber', ['orderNumber']], ['מספר הזמנה 25734', 'orderNumber', ['orderNumber']], ['טלפון 0501234567', 'phone', ['phone']],
    ['ברקוד 41807', 'barcode', ['barcode']],
    // מילות מפתח
    ['מידה 2', 'sizeKeyword', ['sizeKeyword']], ['דגם 3', 'modelKeyword', ['modelKeyword']], ['מידה 2 דגם 3', 'mixedKeyword', ['mixedKeyword']], ['דגם 3 מידה 2', 'mixedKeyword', ['mixedKeyword']],
    ['דגם 3 שרה', 'mixedKeyword', ['mixedKeyword']], ['מידה 02', 'sizeKeyword', ['sizeKeyword']], ['ברקוד 6323401 מידה 34', 'mixedKeyword', ['mixedKeyword']],
    // טקסט
    ['שרה כהן', 'text', ['text']], ['שרה', 'text', ['text']], ['a@b.com', 'text', ['text']], ['שרה 2', 'text', ['text']], ['מידה', 'text', ['text']], ['דגם', 'text', ['text']],
  ];
  for (const [q, kind, kinds] of T) {
    const r = classifyQuery(q);
    eq([r.kind, r.kinds], [kind, kinds], `classify(${JSON.stringify(q)})`);
    eq(r.ambiguous, kinds.length > 1, `ambiguous(${JSON.stringify(q)})`);
  }
});
t('פירוט לפי סוג', () => {
  const b = classifyQuery('6323401').barcode;
  eq([b.digits, b.prefix, b.size, b.serial, b.sizeKey, b.complete, b.legacy], ['6323401', '632', '34', '01', '34', true, false]);
  const o = classifyQuery('25734');
  eq(o.orderNumber, { value: 25734, leadingZero: false }); eq([o.barcode.prefix, o.barcode.size, o.barcode.serial, o.barcode.complete], ['2', '57', '34', false]);
  eq(classifyQuery('41807').barcode.legacy, true);
  eq(classifyQuery('02').orderNumber, { value: 2, leadingZero: true }); eq(classifyQuery('2').orderNumber.leadingZero, false);
  eq(classifyQuery('050-123-4567').phone, { key: '0501234567', partial: false }); eq(classifyQuery('050').phone, { key: '050', partial: true });
  eq(classifyQuery('+972501234567').phone.key, '0501234567');
  eq(classifyQuery('%מידה').shortcut, { prefix: '%', term: 'מידה' }); eq(classifyQuery('# ').shortcut, { prefix: '#', term: '' });
  const d = classifyQuery('כז תשרי').date; eq([d.calendar, d.day, d.monthKey], ['hebrew', 27, 'Tishrei']);
  const g = classifyQuery('5/10').date; eq([g.calendar, g.day, g.month, g.year], ['gregorian', 5, 10, null]);
  const k = classifyQuery('מידה 2 דגם 3').keywords; eq([k.size, k.model, k.sizeKey], ['2', '3', '2']);
  const ex = classifyQuery('ברקוד 6323401'); eq(ex.explicit, true); eq(ex.barcode.prefix, '632');
  eq(classifyQuery('הזמנה 25734').explicit, true); eq(classifyQuery('הזמנה 25734').orderNumber.value, 25734);
  eq(classifyQuery('  מידה   2  ').query, 'מידה 2');
});
t('הכללים שהבעלים קבע: 7 ספרות לעולם לא טלפון/הזמנה; 5-6 הזמנה ראשונה; <=4 הזמנה', () => {
  for (let n = 1; n <= 4; n++) for (const d of [String(10 ** (n - 1)), '9'.repeat(n)]) eq(classifyQuery(d).kinds, ['orderNumber'], d);
  for (const d of ['10000', '99999', '100000', '999999']) eq(classifyQuery(d).kinds, ['orderNumber', 'barcode'], d);
  for (const d of ['1000000', '9999999', '5511205', '6323401', '3050301']) eq(classifyQuery(d).kinds, ['barcode'], d);
  for (const d of ['0501234567', '0521234567', '031234567', '0771234567']) eq(classifyQuery(d).kind, 'phone', d);
});
t('אין חפיפה אקראית: כל הספרות עד 14 תווים מקבלות סיווג יציב ולא שגיאה', () => {
  for (let len = 1; len <= 14; len++) for (const first of ['0', '1', '5', '9']) {
    const q = first + '7'.repeat(len - 1);
    const r = classifyQuery(q);
    ok(r.kinds.length >= 1 && r.kinds[0] === r.kind, q);
  }
});

// ------------------------------------------------------------------------------------------------------------------------
console.log('KEYWORD_GUIDE');
t('מבנה ומקור אחד לאמת מול המנתח', () => {
  ok(Object.isFrozen(KEYWORD_GUIDE)); eq(new Set(KEYWORD_GUIDE.map((e) => e.id)).size, KEYWORD_GUIDE.length);
  eq(KEYWORD_GUIDE.map((e) => e.id), ['size', 'model', 'hebrewDate', 'gregorianDate', 'barcode', 'orderNumber', 'phone']);
  for (const e of KEYWORD_GUIDE) {
    ok(Object.isFrozen(e)); ok(typeof e.label === 'string' && /[א-ת]/.test(e.label), e.id); ok(e.example && e.hint && typeof e.insert === 'string', e.id);
    ok(e.keyword || e.free, e.id);
    if (e.keyword) {
      eq(e.insert, `${e.labels[0]} `, e.id);
      const text = e.example.startsWith(e.labels[0]) ? e.example : `${e.labels[0]} ${e.example}`;
      ok(parseKeywords(text).any, `parser knows guide keyword: ${text}`);
      for (const l of e.labels) ok(parseKeywords(`${l} ${e.id === 'size' ? '2' : e.id === 'model' ? '3' : e.id === 'barcode' ? '6323401' : e.id === 'orderNumber' ? '25734' : '0501234567'}`).any, `label ${l}`);
    } else eq(e.insert, '', e.id);
  }
});
t('דוגמאות המדריך מסווגות כמו שהן מבטיחות', () => {
  const ex = (id) => KEYWORD_GUIDE.find((e) => e.id === id).example;
  eq(classifyQuery(ex('size')).kind, 'sizeKeyword'); eq(classifyQuery(ex('model')).kind, 'modelKeyword');
  const h = classifyQuery(ex('hebrewDate')); eq([h.kind, h.date.calendar], ['date', 'hebrew']);
  const g = classifyQuery(ex('gregorianDate')); eq([g.kind, g.date.calendar], ['date', 'gregorian']);
  eq(classifyQuery(ex('barcode')).kind, 'barcode'); eq(classifyQuery(ex('orderNumber')).kinds[0], 'orderNumber'); eq(classifyQuery(ex('phone')).kind, 'phone');
  eq(classifyQuery(`ברקוד ${ex('barcode')}`).kind, 'barcode');
});
t('SHORTCUT_CHARS כולל את הקיימים ואת %', () => { eq([...SHORTCUT_CHARS].sort(), ['#', '$', '%', '&', '@']); });

// ------------------------------------------------------------------------------------------------------------------------
console.log('matchHighlight');
t('עוטף את splitMatch, סובל סופיות / גרשיים / רישיות', () => {
  eq(matchHighlight('אברהם כהן', 'אברהמ'), ['', 'אברהם', ' כהן']);
  eq(matchHighlight('Hello', 'ell'), ['H', 'ell', 'o']); eq(matchHighlight('Hello', 'HELLO'), ['', 'Hello', '']);
  eq(matchHighlight('abc', 'zz'), ['abc', '', '']); eq(matchHighlight('abc', ''), ['abc', '', '']); eq(matchHighlight(null, 'x'), ['', '', '']);
  eq(matchHighlight('כ"ז תשרי', `כ${GERSHAYIM}ז`), ['', 'כ"ז', ' תשרי']);
  eq(matchHighlight('הזמנה #25734', ` ${RLM}25734 `), ['הזמנה #', '25734', '']);
  for (const [txt, term] of [['Hello world', 'o w'], ['abc', 'b'], ['שלום', 'לו']]) eq(matchHighlight(txt, term), splitMatch(txt, term), `same as splitMatch ${txt}`);
  const [a, b, c] = matchHighlight('חיים כהן', 'חיימ'); eq(a + b + c, 'חיים כהן'); eq(b, 'חיים');
});

console.log(`\n${passed} test groups passed, ${checks} individual checks, TZ=${process.env.TZ}`);
if (process.exitCode) console.error('SOME TESTS FAILED');
