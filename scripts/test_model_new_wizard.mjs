// בדיקה לאשף "דגם חדש" (A5, docs/a5-staff-models/model-new-notes.md): הלוגיקה הטהורה (app/components/dress-new/modelNewLogic.js) - אימות קוד הדגם לפי
// barcodePrefixLength, בניית ברקוד (קוד + מידה(2) + סידורי(2)), הצעת מספר סידורי, אימות שורת מלאי, ה-payloads (זהים לאשף הישן), הודעות שגיאה;
// ושמירות מבנה: האשף הישן לא שונה (blob זהה ל-main), הרשומה model_new, הנתיב הסטטי, אין alert / confirm / prompt באשף החדש.
// בלי DB / רשת / דפדפן. הרצה: node scripts/test_model_new_wizard.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../app/components/dress-new/modelNewLogic.js';
import { getScreenEntry, screenMatchesPath } from '../lib/uiVariantScreens.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

console.log('1. קוד הדגם');
await t('אורך הקוד לפי barcodePrefixLength (ברירת מחדל 3; ערך לא תקין -> 3)', () => {
  assert.equal(L.parseCodeLen('3'), 3); assert.equal(L.parseCodeLen('4'), 4); assert.equal(L.parseCodeLen(undefined), 3);
  assert.equal(L.parseCodeLen(''), 3); assert.equal(L.parseCodeLen('0'), 3); assert.equal(L.parseCodeLen('11'), 3); assert.equal(L.parseCodeLen('abc'), 3);
});
await t('codeError: ריק / אורך שגוי / תפוס / תקין (הודעות כמו העיצוב)', () => {
  assert.equal(L.codeError(''), 'חובה להזין קוד דגם');
  assert.equal(L.codeError('12'), 'קוד דגם בן 3 ספרות בדיוק');
  assert.equal(L.codeError('1234'), 'קוד דגם בן 3 ספרות בדיוק');
  assert.equal(L.codeError('12a'), 'קוד דגם בן 3 ספרות בדיוק');
  assert.equal(L.codeError('623'), '');
  assert.equal(L.codeError('623', { taken: true }), 'הקוד כבר קיים במאגר');
  assert.equal(L.codeError('12', { taken: true }), 'קוד דגם בן 3 ספרות בדיוק'); // פורמט לפני "תפוס"
  assert.equal(L.codeError('1234', { len: 4 }), '');
  assert.equal(L.codeError('123', { len: 4 }), 'קוד דגם בן 4 ספרות בדיוק');
});
await t('sanitizeCode: ספרות בלבד, חיתוך לקצה סביר', () => {
  assert.equal(L.sanitizeCode('6a2-3'), '623'); assert.equal(L.sanitizeCode('1234567890'), '123456'); assert.equal(L.sanitizeCode('12345678', 8), '12345678');
});

console.log('2. ברקוד ומספר סידורי');
await t('buildBarcode = קוד + מידה(2) + סידורי(2)', () => {
  assert.equal(L.buildBarcode('623', '38', 1), '6233801');
  assert.equal(L.buildBarcode('623', 8, 12), '6230812');
  assert.equal(L.buildBarcode(' 623 ', '0', 7), '6230007');
  assert.equal(L.buildBarcode('1234', '40', 2), '12344002');
});
await t('nextSerial: עולה לפי אותה מידה; מידה אחרת מתחילה מ-1', () => {
  const items = [{ size: '38', serial: 1 }, { size: '38', serial: 3 }, { size: '40', serial: 1 }];
  assert.equal(L.nextSerial(items, '38'), 4); assert.equal(L.nextSerial(items, '40'), 2); assert.equal(L.nextSerial(items, '42'), 1); assert.equal(L.nextSerial([], '38'), 1);
  assert.equal(L.nextSerial(items, ' 38 '), 4);
});
await t('barcodePreview: ללא מידה "קוד____", עם מידה ללא סידורי -> הבא', () => {
  assert.equal(L.barcodePreview('623', { size: '', serial: '' }, []), '623____');
  assert.equal(L.barcodePreview('', { size: '', serial: '' }, []), '###____');
  assert.equal(L.barcodePreview('623', { size: '38', serial: '' }, [{ size: '38', serial: 1 }]), '6233802');
  assert.equal(L.barcodePreview('623', { size: '38', serial: '5' }, []), '6233805');
});
await t('validateNewItem: אותן בדיקות והודעות כמו האשף הישן', () => {
  assert.deepEqual(L.validateNewItem({ size: '', serial: '' }, []), { error: 'חובה להזין מידה' });
  assert.equal(L.validateNewItem({ size: '100', serial: '' }, []).error, 'מידה חייבת להיות מספר שלם בין 0 ל-99');
  assert.equal(L.validateNewItem({ size: '-1', serial: '' }, []).error, 'מידה חייבת להיות מספר שלם בין 0 ל-99');
  assert.equal(L.validateNewItem({ size: '3.5', serial: '' }, []).error, 'מידה חייבת להיות מספר שלם בין 0 ל-99');
  assert.equal(L.validateNewItem({ size: '38', serial: '0' }, []).error, "מס' סידורי חייב להיות מספר שלם בין 1 ל-99");
  assert.equal(L.validateNewItem({ size: '38', serial: '100' }, []).error, "מס' סידורי חייב להיות מספר שלם בין 1 ל-99");
  assert.equal(L.validateNewItem({ size: '38', serial: '1' }, [{ size: '38', serial: 1 }]).error, "כבר נוסף פריט במידה 38 עם מס' סידורי 1");
  assert.deepEqual(L.validateNewItem({ size: '38', serial: '' }, [{ size: '38', serial: 1 }]), { size: 38, serial: 2 });
  assert.deepEqual(L.validateNewItem({ size: '0', serial: '1' }, []), { size: 0, serial: 1 });
});
await t('sizesOf / locCount', () => {
  const items = [{ size: '40', loc: 'חנות' }, { size: '38', loc: 'חנות' }, { size: '40', loc: 'מחסן' }];
  assert.deepEqual(L.sizesOf(items), ['38', '40']); assert.equal(L.locCount(items, 'חנות'), 2); assert.equal(L.locCount(items, 'רזרבה'), 0);
});

console.log('3. שלב 1, "יש שינוי", payloads');
await t('missingList: סדר ותוויות; ללא שמות דגמים לא נדרש שם', () => {
  assert.deepEqual(L.missingList({ codeErr: 'x', hasCode: false, nameOk: false, catOk: false }), ['קוד דגם', 'שם דגם', 'קטגוריית מחיר']);
  assert.deepEqual(L.missingList({ codeErr: 'x', hasCode: true, nameOk: true, catOk: false }), ['קוד דגם תקין', 'קטגוריית מחיר']);
  assert.deepEqual(L.missingList({ codeErr: '', hasCode: true, nameOk: false, catOk: true, useModelNames: false }), []);
});
await t('isDirty: ברירת מחדל נקייה; כל שינוי הופך ל"מלוכלך"', () => {
  const base = { code: '623', name: '', cat: '', entry: '2026-10-09', img: '', notes: '', inspect: false };
  const ctx = { todayKey: '2026-10-09', nextCode: '623' };
  assert.equal(L.isDirty(base, [], ctx), false);
  assert.equal(L.isDirty({ ...base, name: 'x' }, [], ctx), true); assert.equal(L.isDirty({ ...base, cat: 'A' }, [], ctx), true);
  assert.equal(L.isDirty({ ...base, notes: ' y ' }, [], ctx), true); assert.equal(L.isDirty({ ...base, inspect: true }, [], ctx), true);
  assert.equal(L.isDirty({ ...base, img: '/a.jpg' }, [], ctx), true); assert.equal(L.isDirty({ ...base, entry: '2026-10-01' }, [], ctx), true);
  assert.equal(L.isDirty({ ...base, code: '624' }, [], ctx), true); assert.equal(L.isDirty(base, [{ size: '38' }], ctx), true);
  assert.equal(L.isDirty({ ...base, name: '   ' }, [], ctx), false);
  assert.equal(L.isDirty({ ...base, code: '' }, [], ctx), false); // קוד שעדיין נטען / נמחק - לא שינוי
  assert.equal(L.isDirty({ ...base, code: '623' }, [], { ...ctx, nextCode: '' }), true); // אין קוד פנוי ידוע והוקלד קוד
});
await t('buildModelPayload: אותם שדות כמו האשף הישן (POST /api/dresses)', () => {
  const p = L.buildModelPayload({ code: ' 623 ', name: ' רומנטיקה ', cat: 'A', entry: '2026-10-09', img: '/u/a.jpg', thumb: '/u/t.jpg', notes: 'n', inspect: true });
  assert.deepEqual(Object.keys(p).sort(), ['barcodePrefix', 'entryDateToRepo', 'imageUrl', 'inInspection', 'name', 'notes', 'priceCategory', 'thumbnailUrl']);
  assert.equal(p.name, 'רומנטיקה'); assert.equal(p.barcodePrefix, '623'); assert.equal(p.priceCategory, 'A'); assert.equal(p.inInspection, true);
  assert.equal(p.imageUrl, '/u/a.jpg'); assert.equal(p.thumbnailUrl, '/u/t.jpg'); assert.match(p.entryDateToRepo, /^2026-10-09T/);
  const q = L.buildModelPayload({ code: '623', name: '', cat: 'A', entry: '2026-10-09' }, { useModelNames: false });
  assert.equal(q.name, 'דגם 623'); assert.equal(q.imageUrl, ''); assert.equal(q.inInspection, false);
});
await t('buildItemPayload: כמו האשף הישן (sizeText, serialNumber, dressBarcode, location, barcodePrefix, dressName, entryDateToRepo)', () => {
  const p = L.buildItemPayload({ size: '38', serial: 2, loc: 'מחסן' }, { barcodePrefix: 623, name: 'רומנטיקה' }, { code: '623', entry: '2026-10-09' }, ['חנות']);
  assert.deepEqual(p, { sizeText: '38', serialNumber: 2, dressBarcode: '6233802', location: 'מחסן', barcodePrefix: 623, dressName: 'רומנטיקה', entryDateToRepo: p.entryDateToRepo });
  assert.equal(L.buildItemPayload({ size: '38', serial: 2, loc: '' }, { barcodePrefix: 623, name: 'x' }, { code: '623', entry: '2026-10-09' }, ['חנות']).location, 'חנות');
});
await t('describeCreateError: כפילות / הרשאה / כללי', () => {
  assert.deepEqual(L.describeCreateError(400, { error: 'הקוד כבר בשימוש!' }), { msg: 'הקוד כבר בשימוש!', duplicate: true, nameDuplicate: false, forbidden: false, text: 'שגיאה: הקוד כבר בשימוש!' });
  // שם דגם שכבר קיים (400 + field:'name', 11.10.2026): מוצג ליד שדה השם, לא נחשב כקוד תפוס
  const nd = L.describeCreateError(400, { error: 'דגם בשם «ורד» כבר קיים (קוד 5)', field: 'name' });
  assert.equal(nd.nameDuplicate, true); assert.equal(nd.duplicate, false); assert.equal(nd.msg, 'דגם בשם «ורד» כבר קיים (קוד 5)');
  assert.equal(L.describeCreateError(403, { error: 'הרשאה זו שמורה להנהלה ראשית בלבד' }).forbidden, true);
  assert.equal(L.describeCreateError(500, null).msg, 'יצירת הדגם נכשלה');
});
await t('parseLocations / priceRangeLabel / recapOf / stepsOf', () => {
  assert.deepEqual(L.parseLocations(''), ['חנות', 'רזרבה', 'מחסן']); assert.deepEqual(L.parseLocations('חנות, מחסן ,'), ['חנות', 'מחסן']);
  const rows = [{ category: 'A', price: 90 }, { category: 'A', price: 120 }, { category: 'A', price: 500, endDate: '2000-01-01' }, { category: 'B', price: 150 }];
  assert.equal(L.priceRangeLabel(rows, 'A'), 'מחיר ₪90–₪120'); assert.equal(L.priceRangeLabel(rows, 'B'), 'מחיר ₪150'); assert.equal(L.priceRangeLabel(rows, 'Z'), null);
  assert.deepEqual(L.recapOf(1, { d: { code: '623', name: 'ר' }, items: [] }), { code: '623', name: 'ר' });
  assert.equal(L.recapOf(3, { d: {}, items: [] }), 'ללא פריטים'); assert.equal(L.recapOf(3, { d: {}, items: [1] }), 'פריט אחד'); assert.equal(L.recapOf(3, { d: {}, items: [1, 2] }), '2 פריטים');
  assert.equal(L.recapOf(2, { d: { img: 'x' }, items: [] }), 'עם תמונה'); assert.equal(L.stepsOf(false)[1].l, 'הערות והתראות'); assert.equal(L.stepsOf(true)[1].l, 'תמונה והערות');
  assert.equal(L.locIcon('חנות'), 'store'); assert.equal(L.locIcon('אחר'), 'pin');
});

console.log('4. מבנה: רישום, נתיב, האשף הישן, בלי חלונות דפדפן');
await t('הרשומה model_new: נתיב /dashboard/dresses/new, שתי גרסאות, ואינו נתפס כ-model_card', () => {
  const e = getScreenEntry('model_new');
  assert.ok(e && e.legacyExists && e.newExists && e.selfSwitch); assert.deepEqual([...e.routes], ['/dashboard/dresses/new']);
  assert.equal(screenMatchesPath('model_new', '/dashboard/dresses/new'), true);
  assert.equal(screenMatchesPath('model_card', '/dashboard/dresses/new'), false);
  assert.equal(screenMatchesPath('model_card', '/dashboard/dresses/abc'), true);
});
await t('נתיב סטטי + Switch + האשף הישן לא שונה ושווה ל-main (blob)', () => {
  assert.ok(existsSync(path.join(ROOT, 'app/dashboard/dresses/new/page.js')));
  assert.match(read('app/dashboard/dresses/new/page.js'), /ModelNewSwitch/);
  const sw = read('app/components/dress-new/ModelNewSwitch.js');
  assert.match(sw, /useUiVariant\('model_new'\)/); assert.match(sw, /LegacyNewDressPage/);
  try {
    const head = execFileSync('git', ['rev-parse', 'origin/main:components/dresses/modern/ModernNewDressWizard.js'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const cur = execFileSync('git', ['hash-object', 'components/dresses/modern/ModernNewDressWizard.js'], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(cur, head, 'ModernNewDressWizard.js שונה');
  } catch (e) { if (/שונה/.test(e.message)) throw e; console.log('        (דילוג על בדיקת blob: אין origin/main מקומי)'); }
});
await t('האשף החדש לא קורא ל-window.alert / confirm / prompt / customConfirm', () => {
  const dir = path.join(ROOT, 'app/components/dress-new');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'LegacyNewDressPage.js')) {
    const src = read(`app/components/dress-new/${f}`).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(src, /\b(alert|confirm|prompt|customConfirm|customAuthPrompt)\s*\(/, f);
  }
});

console.log(`\n${passed} בדיקות עברו`);
