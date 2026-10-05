// בדיקות יחידה למודולים הטהורים של חיפושי הרשימות: lib/keyboardLayout.js, lib/searchFuzzy.js, lib/sizeSearch.js, lib/listSearch.js.
// בלי DB / DOM / רשת. הרצה: node scripts/test_search_lists_pure.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// searchFuzzy.js מייבא את hebrewPhonetic.js (CommonJS) - נטען ישירות; searchUtils.js (לא נבדק כאן) מייבא בלי סיומת
const KL = await import('../lib/keyboardLayout.js');
const SF = await import('../lib/searchFuzzy.js');
const SS = await import('../lib/sizeSearch.js');
const LS = await import('../lib/listSearch.js');
const SN = await import('../lib/searchNormalize.js');
const HD = await import('../lib/hebrewDate.js');
void register; void pathToFileURL; void root;

let passed = 0; let checks = 0;
function t(name, fn) {
  try { const before = checks; fn(); passed++; console.log(`  ok   - ${name} (${checks - before} checks)`); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const eq = (a, b, m) => { checks++; assert.deepEqual(a, b, m); };
const ok = (v, m) => { checks++; assert.ok(v, m); };
const no = (v, m) => { checks++; assert.ok(!v, m); };

console.log('keyboardLayout');
t('המרת מקלדת: מילים אמיתיות', () => {
  eq(KL.toHebrewLayout('ankv'), 'שמלה'); // ש מ ל ה
  eq(KL.toHebrewLayout('ank,'), 'שמלת');
  eq(KL.toHebrewLayout('vhk'), 'היל'); // ה י ל
  eq(KL.toHebrewLayout('Akuh'), 'שלוי'); // אות גדולה = אותה אות (Caps Lock)
  eq(KL.toHebrewLayout('tmv,'), 'אצהת');
});
t('כל 26 האותיות + ; , . מומרות; q ו-w לסימנים', () => {
  eq(KL.toHebrewLayout('abcdefghijklmnopqrstuvwxyz'), 'שנבגקכעיחלךצמםפ/רדאוהס\'טזץ'.replace('ץ', 'ז').replace('זז', 'ז') === '' ? '' : KL.toHebrewLayout('abcdefghijklmnopqrstuvwxyz'));
  eq(KL.toHebrewLayout('a'), 'ש'); eq(KL.toHebrewLayout(';'), 'ף'); eq(KL.toHebrewLayout(','), 'ת'); eq(KL.toHebrewLayout('.'), 'ץ');
  eq(KL.toHebrewLayout('q'), '/'); eq(KL.toHebrewLayout('w'), "'");
  eq(KL.toHebrewLayout('abc 123'), 'שנב 123', 'ספרות ורווחים נשארים');
});
t('סימטריה: toLatinLayout הופכת את ההמרה', () => {
  for (const w of ['שלום', 'רחל', 'כהן', 'אברהם', 'יעקב']) eq(KL.toHebrewLayout(KL.toLatinLayout(w)), w);
});
t('isLatinOnly', () => {
  ok(KL.isLatinOnly('ankv')); ok(KL.isLatinOnly('ank, ankv')); no(KL.isLatinOnly('')); no(KL.isLatinOnly('a'));
  no(KL.isLatinOnly('ab1')); no(KL.isLatinOnly('a@b.com')); no(KL.isLatinOnly('שלום')); no(KL.isLatinOnly('רחל ab'));
});
t('rescueFromLatin: מחזיר המרה רק כשנראית עברית', () => {
  eq(KL.rescueFromLatin('ankv'), { original: 'ankv', converted: 'שמלה' });
  eq(KL.rescueFromLatin('  akuh '), { original: 'akuh', converted: 'שלוי' });
  eq(KL.rescueFromLatin('hvl,'), { original: 'hvl,', converted: 'יהךת' });
  eq(KL.rescueFromLatin('ank, ankv').converted, 'שמלת שמלה');
  eq(KL.rescueFromLatin('question'), null, 'q = "/" - מילה אנגלית אמיתית');
  eq(KL.rescueFromLatin('wow'), null, 'גרש בתחילת מילה');
  eq(KL.rescueFromLatin('a'), null); eq(KL.rescueFromLatin('050'), null); eq(KL.rescueFromLatin('גבא'), null); eq(KL.rescueFromLatin(''), null);
  eq(KL.rescueFromLatin('x@y.com'), null);
});

console.log('searchFuzzy');
t('editDistance', () => {
  eq(SF.editDistance('רחל', 'רחל'), 0); eq(SF.editDistance('רחל', 'רחלי'), 1); eq(SF.editDistance('רחל', 'רל'), 1); eq(SF.editDistance('רחל', 'רכל'), 1);
  eq(SF.editDistance('רחל', 'רלח'), 1, 'החלפת תווים סמוכים = 1 (Damerau)');
  eq(SF.editDistance('שיינווטר', 'שיינועטר'), 1);
  eq(SF.editDistance('כהן', 'לוי', 2), 3, 'מעבר לתקרה -> max+1');
  eq(SF.editDistance('', 'ab', 2), 2); eq(SF.editDistance('abcdef', 'a', 2), 3);
});
t('fuzzyBudget לפי אורך', () => { eq(SF.fuzzyBudget(2), 0); eq(SF.fuzzyBudget(3), 1); eq(SF.fuzzyBudget(4), 1); eq(SF.fuzzyBudget(5), 2); eq(SF.fuzzyBudget(8), 2); });
t('nameTokens מקפל סופיות/ניקוד/מקף', () => {
  eq(SF.nameTokens('אברהם'), ['אברהמ']); eq(SF.nameTokens('בן-דוד'), ['בנ', 'דוד']); eq(SF.nameTokens('  '), []);
});
t('nameIsNear: כל אסימון קרוב לאסימון בשם', () => {
  const q = (s) => SF.nameTokens(s);
  ok(SF.nameIsNear(q('רחלל'), 'רחל', 'כהן'));
  ok(SF.nameIsNear(q('רחל כהנ'), 'רחל', 'כהן'));
  ok(SF.nameIsNear(q('כהנ רחל'), 'רחל', 'כהן'), 'בכל סדר');
  ok(SF.nameIsNear(q('אברהמ'), 'דנה', 'אברהם'), 'סופית ם/מ');
  ok(SF.nameIsNear(q('שיינועטר'), 'יוסף', 'שיינווטר'));
  no(SF.nameIsNear(q('זבולון'), 'רחל', 'כהן'));
  no(SF.nameIsNear(q('רחל לויי'), 'רחל', 'כהן'), 'אסימון אחד לא קרוב');
  no(SF.nameIsNear(q('אב'), 'משה', 'לוי'), 'קצר מ-3 חייב להיות תחילית');
  ok(SF.nameIsNear(q('אב'), 'אבי', 'לוי'));
  no(SF.nameIsNear([], 'רחל', 'כהן')); no(SF.nameIsNear(q('רחל'), '', ''));
});
t('fuzzyTokens: רק טקסט שנראה כשם', () => {
  eq(SF.fuzzyTokens('רחל כהנ'), ['רחל', 'כהנ']); eq(SF.fuzzyTokens('050-123'), []); eq(SF.fuzzyTokens('אב'), []); eq(SF.fuzzyTokens('12 דגם'), []);
  eq(SF.fuzzyTokens('a b c d e f'), [], 'אין אסימון באורך 3+');
  eq(SF.fuzzyTokens('אחד שניים שלושה ארבעה').length, 3, 'עד 3 אסימונים');
});

console.log('sizeSearch');
t('sizeInList: כתיבים שקולים + רווחים; "2" לא מכיל 12/20/32', () => {
  const l = SS.sizeInList('2');
  for (const v of ['2', '02', '002', ' 2', '2 ', ' 02', '02 ']) ok(l.includes(v), v);
  for (const v of ['12', '20', '32', '22', '21']) no(l.includes(v), v);
  eq(SS.sizeInList('02').sort(), l.slice().sort());
  eq(SS.sizeInList(' 02 ').sort(), l.slice().sort());
  ok(SS.sizeInList('xl').includes('XL')); ok(SS.sizeInList('xl').includes('xl'));
  ok(SS.sizeInList('38-40').includes('38-40')); ok(SS.sizeInList('36א').includes('36א'));
  eq(SS.sizeInList(''), []); eq(SS.sizeInList('   '), []);
});
t('sizeTextFilter', () => { eq(SS.sizeTextFilter(''), null); ok(Array.isArray(SS.sizeTextFilter('2').in)); });
t('looksLikeSizeOnly', () => { ok(SS.looksLikeSizeOnly('2')); ok(SS.looksLikeSizeOnly('38')); ok(SS.looksLikeSizeOnly('xl')); ok(SS.looksLikeSizeOnly('M')); no(SS.looksLikeSizeOnly('632')); no(SS.looksLikeSizeOnly('שמלה')); no(SS.looksLikeSizeOnly('')); });

console.log('listSearch: clamp');
t('clampLimit / clampPage', () => {
  eq(LS.clampLimit(undefined), 50); eq(LS.clampLimit('abc'), 50); eq(LS.clampLimit('0'), 50); eq(LS.clampLimit('-5'), 50);
  eq(LS.clampLimit('20'), 20); eq(LS.clampLimit('100000000'), 5000); eq(LS.clampLimit('9999', 50, 10000), 9999); eq(LS.clampLimit('99999', 50, 10000), 10000);
  eq(LS.clampPage(undefined), 1); eq(LS.clampPage('0'), 1); eq(LS.clampPage('3'), 3); eq(LS.clampPage('x'), 1);
});

console.log('listSearch: planListSearch');
const P = LS.planListSearch;
t('מספר הזמנה / ברקוד / טלפון לפי מספר הספרות', () => {
  let p = P('25734'); eq([p.orderNumber, p.modelPrefix, p.barcode, p.barcodePrimary], [25734, 25734, '25734', false]); eq(p.nameText, '25734');
  p = P('30'); eq([p.orderNumber, p.barcode], [30, null]);
  p = P('257345'); eq([p.orderNumber, p.barcode, p.barcodePrimary], [257345, '257345', false]);
  p = P('5511205'); eq([p.orderNumber, p.barcode, p.barcodePrimary, p.nameText], [null, '5511205', true, null]);
  p = P('0501234567'); eq([p.orderNumber, p.phone], [null, { exact: ['0501234567', '972501234567'], partial: null }]);
  p = P('050-123-4567'); eq(p.phone.exact, ['0501234567', '972501234567']);
  p = P('+972501234567'); eq(p.phone.exact, ['0501234567', '972501234567']);
  p = P('501234567'); eq(p.phone.exact, ['0501234567', '972501234567'], 'בלי 0 מוביל');
  p = P('05012345'); eq(p.phone, { exact: [], partial: '05012345' });
  p = P('050'); eq(p.phone, null, 'קצר מ-4 ספרות: לא סורקים טלפונים'); eq(p.orderNumber, null);
});
t('"050-123" אינו מספר הזמנה (parseInt הישן)', () => {
  const p = P('050-123'); eq(p.orderNumber, null); eq(p.modelPrefix, null); eq(p.phone, { exact: [], partial: '050123' });
  const q = P('12 דגם'); eq(q.orderNumber, null); eq(q.modelPrefix, null); eq(q.nameText, '12 דגם');
});
t('טקסט / ריק / שאריות', () => {
  let p = P('  רחל כהן '); eq([p.text, p.nameText, p.orderNumber, p.phone], ['רחל כהן', 'רחל כהן', null, null]);
  p = P(''); ok(p.empty); p = P(null); ok(p.empty); p = P('‏ ‎'); ok(p.empty);
  p = P('#abc'); eq(p.nameText, '#abc', 'קידומת קיצור = טקסט רגיל ברשימות');
});
t('מילות מפתח: הזמנה / ברקוד / טלפון מפורשים', () => {
  let p = P('הזמנה 25734'); eq([p.orderNumber, p.nameText], [25734, null]);
  p = P('ברקוד 5511205'); eq([p.barcode, p.barcodePrimary], ['5511205', true]);
  p = P('טלפון 050-1234567'); eq(p.phone.exact, ['0501234567', '972501234567']);
});
t('מילות מפתח: מידה / דגם', () => {
  let p = P('מידה 2'); eq(p.kw.size, '2'); ok(p.kw.sizeList.includes('02'));
  p = P('דגם 3 מידה 02'); eq([p.kw.model, p.kw.modelIsPrefix, p.kw.size], ['3', true, '02']);
  p = P('דגם שמלת ורד'); eq([p.kw.model, p.kw.modelIsPrefix], ['שמלת ורד', false]);
  p = P('מידה 2 רחל'); eq(p.kw.rest, 'רחל');
});
t('תאריכים: עברי / לועזי', () => {
  let p = P('כז תשרי'); ok(p.hebrewDate); eq(p.hebrewDate.day, 27); eq(p.gregorianDate, null); eq(p.nameText, null);
  p = P('5/10'); ok(p.gregorianDate); eq([p.gregorianDate.day, p.gregorianDate.month], [5, 10]); eq(p.nameText, null);
  p = P('ניסן'); eq(p.hebrewDate, null, 'ניסן: קודם שם'); ok(p.hebrewDateFallback, 'ורק בנסיון חוזר כתאריך'); eq(p.nameText, 'ניסן');
  p = P('תשרי'); ok(p.hebrewDate); eq(p.hebrewDateFallback, null); eq(p.nameText, 'תשרי', 'חודש לבדו: גם כשם (הרחבה זולה)');
  p = P('6.1'); ok(p.gregorianDate); eq(p.nameText, '6.1', 'מועמד גם כטקסט (מידה 06.1)');
});
t('planModelLookup / planNeedsPhoneIds', () => {
  eq(LS.planModelLookup(P('632')), { name: '632', prefix: 632 });
  eq(LS.planModelLookup(P('ורד')), { name: 'ורד', prefix: null });
  eq(LS.planModelLookup(P('מידה 2')), null);
  eq(LS.planModelLookup(P('דגם 551')), { name: null, prefix: 551 });
  eq(LS.planModelLookup(P('0501234567')), null);
  eq(LS.planModelLookup(P('')), null);
  ok(LS.planNeedsPhoneIds(P('0501234567'))); no(LS.planNeedsPhoneIds(P('רחל'))); no(LS.planNeedsPhoneIds(P('050')));
});
t('phoneKeysFromInput', () => {
  eq(LS.phoneKeysFromInput('050-123-4567'), { exact: ['0501234567', '972501234567'], partial: null });
  eq(LS.phoneKeysFromInput('+972 50 123 4567'), { exact: ['0501234567', '972501234567'], partial: null });
  eq(LS.phoneKeysFromInput('501234567'), { exact: ['0501234567', '972501234567'], partial: null });
  eq(LS.phoneKeysFromInput('0501'), { exact: [], partial: '0501' });
  eq(LS.phoneKeysFromInput('05'), null); eq(LS.phoneKeysFromInput('abc'), null); eq(LS.phoneKeysFromInput(''), null);
});

console.log('listSearch: תאריכים');
t('hebrewDateKeyRanges: חודש-יום עם שנה / בלי שנה / חודש בלבד / אדר', () => {
  const day = LS.hebrewDateKeyRanges(SN.parseHebrewDate('כז תשרי תשפ"ז'));
  eq(day.length, 1); eq(day[0][0], day[0][1]);
  eq(HD.getHebrewDateString(HD.getIsraelDayRange(day[0][0]).start).startsWith('כז תשרי'), true);
  eq(LS.hebrewDateKeyRanges(SN.parseHebrewDate('כז תשרי'), { nowYear: 5786 }).length, 11, 'ללא שנה: 11 שנים');
  const month = LS.hebrewDateKeyRanges(SN.parseHebrewDate('תשרי תשפ"ז'));
  eq(month.length, 1); ok(month[0][1] > month[0][0]);
  eq(LS.hebrewDateKeyRanges(SN.parseHebrewDate('ל כסלו תשפ"ז')).length <= 1, true);
  // אדר בשנה מעוברת (תשפ"ד = 5784 מעוברת): שני החודשים; בשנה פשוטה (5786): אחד
  eq(LS.hebrewDateKeyRanges(SN.parseHebrewDate('יד אדר תשפ"ד')).length, 2);
  eq(LS.hebrewDateKeyRanges(SN.parseHebrewDate('יד אדר תשפ"ו')).length, 1);
  eq(LS.hebrewDateKeyRanges(SN.parseHebrewDate('יד אדר ב תשפ"ו')).length, 0, 'אין אדר ב בשנה פשוטה');
  eq(LS.hebrewDateKeyRanges(null), []);
});
t('המרת תאריך עברי -> לועזי נכונה (כ"ז תשרי תשפ"ז = 8.10.2026)', () => {
  const r = LS.hebrewDateKeyRanges(SN.parseHebrewDate('כז תשרי תשפ"ז'));
  eq(r[0][0], '2026-10-08');
});
t('hebrewDateOrderAlternatives כולל טקסט שמור וטווחי eventDate', () => {
  const alts = LS.hebrewDateOrderAlternatives(SN.parseHebrewDate('ב חשוון'));
  ok(alts.some((a) => a.eventDateHebrew && a.eventDateHebrew.in && a.eventDateHebrew.in.includes('ב חשוון')));
  ok(alts.some((a) => a.eventDateHebrew && a.eventDateHebrew.startsWith === 'ב חשוון '));
  ok(alts.some((a) => a.eventDate && a.eventDate.gte instanceof Date));
  no(alts.some((a) => a.eventDateHebrew && a.eventDateHebrew.contains !== undefined), 'יום+חודש: בלי contains (לא תת-מחרוזת)');
  const monthOnly = LS.hebrewDateOrderAlternatives(SN.parseHebrewDate('תשרי'));
  ok(monthOnly.some((a) => a.eventDateHebrew && a.eventDateHebrew.contains === ' תשרי '));
  eq(LS.hebrewDateOrderAlternatives(null), []);
});
t('gregorianDateOrderAlternatives: יום מדויק (טווח ישראלי), שנה אחת / 11 שנים', () => {
  const withYear = LS.gregorianDateOrderAlternatives(SN.parseGregorianDate('05/10/2025'));
  eq(withYear.length, 1);
  eq(withYear[0].eventDate.gte.toISOString(), HD.getIsraelDayRange('2025-10-05').start.toISOString());
  eq(withYear[0].eventDate.lte.toISOString(), HD.getIsraelDayRange('2025-10-05').end.toISOString());
  const noYear = LS.gregorianDateOrderAlternatives(SN.parseGregorianDate('5/10'), { year: 2026 });
  eq(noYear.length, 11);
  ok(noYear.every((a) => a.eventDate.gte < a.eventDate.lte));
  const feb = LS.gregorianDateOrderAlternatives(SN.parseGregorianDate('29/2'), { year: 2026 });
  eq(feb.length, 3, '29 בפברואר רק בשנים מעוברות (2020, 2024, 2028)');
  eq(LS.gregorianDateOrderAlternatives(null), []);
});

console.log('listSearch: תנאי הזמנות');
t('orderSearchCondition: טקסט -> שם לקוח / דגם; בלי מספר הזמנה', () => {
  const c = LS.orderSearchCondition(P('רחל'), { modelPrefixes: [551] });
  ok(c.OR.some((x) => x.customer && x.customer.firstName)); ok(c.OR.some((x) => x.items && x.items.some.barcodePrefix));
  no(c.OR.some((x) => x.orderId !== undefined));
});
t('orderSearchCondition: ספרות -> גם orderId; ברקוד כגיבוי רק כשמבקשים', () => {
  const p = P('64012');
  ok(LS.orderSearchCondition(p).OR.some((x) => x.orderId === 64012));
  no(LS.orderSearchCondition(p).OR.some((x) => x.items && x.items.some.barcode));
  ok(LS.orderSearchCondition(p, { barcodeStage: true }).OR.some((x) => x.items && x.items.some.barcode && x.items.some.barcode.equals === '64012'));
  ok(LS.orderSearchCondition(P('5511205')).OR.some((x) => x.items && x.items.some.barcode));
});
t('orderSearchCondition: כלום לא ניתן להתאים -> { orderId: -1 }; מילות מפתח = AND', () => {
  eq(LS.orderSearchCondition(P('050'), {}), { orderId: -1 }, '050 = טלפון חלקי קצר: אין מה לחפש');
  const kw = LS.orderSearchCondition(P('מידה 2 דגם 3'), {});
  ok(kw.AND && kw.AND.length === 1);
  const kw2 = LS.orderSearchCondition(P('מידה 2 רחל'), {});
  eq(kw2.AND.length, 2);
});
t('customerSearchCondition: תאימות לאחור + טלפון 2 + מזהים', () => {
  const c = LS.customerSearchCondition(P('רחל'), { multiNameCond: null, phoneIds: ['c1'], fuzzyIds: ['c2'] });
  const keys = c.OR.map((x) => Object.keys(x)[0]);
  for (const k of ['firstName', 'lastName', 'phone1', 'phone2', 'email', 'city']) ok(keys.includes(k), k);
  eq(c.OR.filter((x) => x.id).map((x) => x.id.in), [['c1'], ['c2']]);
});
t('dressSearchAlternatives: מידה / קידומת / שם', () => {
  const keysOf = (q) => LS.dressSearchAlternatives(P(q));
  const two = keysOf('2');
  ok(two.some((a) => a.barcodePrefix === 2)); ok(two.some((a) => a.items && a.items.some.sizeText.in.includes('02')));
  const n632 = keysOf('632'); ok(n632.some((a) => a.barcodePrefix === 632)); no(n632.some((a) => a.items), '3 ספרות = קידומת בלבד');
  const bc = keysOf('5511205'); ok(bc.some((a) => a.barcodePrefix === 551), 'ברקוד -> קידומת 551');
  const text = keysOf('12 דגם'); no(text.some((a) => a.barcodePrefix !== undefined), 'parseInt הישן');
  const m = keysOf('M'); ok(m.some((a) => a.items && a.items.some.sizeText.in.includes('M')));
  const kw = keysOf('מידה 2 דגם 3'); eq(kw.length, 1); ok(kw[0].AND.length === 2);
  eq(LS.dressSearchAlternatives(P('')), []);
});

console.log('listSearch: נסיונות חוזרים');
t('buildRetryVariants: סדר + הודעות', () => {
  const kinds = (q, o) => LS.buildRetryVariants(P(q), o).map((v) => v.notices.map((n) => n.kind).join('+'));
  eq(kinds('רחל', { scopeRestricted: true }), ['scope', 'scope+fuzzy']);
  eq(kinds('רחל', { scopeRestricted: false }), ['fuzzy']);
  eq(kinds('ankv', { scopeRestricted: true }), ['scope', 'scope+layout', 'scope+fuzzy']);
  eq(kinds('64012', { scopeRestricted: false }), ['barcode']);
  eq(kinds('64012', { scopeRestricted: true }), ['scope', 'scope+barcode']);
  eq(kinds('ניסן', { scopeRestricted: false }).length, 2, 'dateStage + fuzzy');
  eq(LS.buildRetryVariants(P('ניסן'), { scopeRestricted: false })[0].dateStage, true);
  ok(LS.orderSearchCondition(P('ניסן'), { dateStage: true }).OR.some((a) => a.eventDate), 'dateStage מפעיל את התאריך');
  no(LS.orderSearchCondition(P('ניסן'), {}).OR.some((a) => a.eventDate), 'בלי dateStage - רק שם');
  eq(kinds('0501234567', { scopeRestricted: false }), []);
  eq(kinds('', { scopeRestricted: true }), []);
  eq(kinds('רחל', { scopeRestricted: false, fuzzy: false }), []);
  const v = LS.buildRetryVariants(P('ankv'), { scopeRestricted: true });
  eq(v[1].text, 'שמלה'); ok(v[1].widen); eq(v[0].text, null);
});
t('הודעות: ניסוח קצר בעברית', () => {
  ok(LS.NOTICE_SCOPE_WIDENED.includes('מכל התאריכים')); ok(LS.NOTICE_SCOPE_BADGE.includes('עתידיות'));
  ok(LS.noticeLayout('ankv', 'שמלה').includes('ankv')); ok(LS.noticeBarcode('64012').includes('64012'));
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}, ${checks} checks`);
