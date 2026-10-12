// בדיקות טהורות ל-lib/modelDisplay.js - שם תצוגה של דגם (נושא 11 "ניהול דגמים": בנווה יעקב אין שמות, רק מספרים).
// הרצה (מהשורש): node scripts/test_model_display.mjs   (בלי DB ובלי שרת; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  MODEL_FALLBACK, modelCode, isPlaceholderModelName, modelNamesEnabled, modelDisplayName, modelHasRealName,
  modelCodeSuffix, modelLabelWithCode, replacePlaceholderModelNames, autoModelName,
} from '../lib/modelDisplay.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

console.log('isPlaceholderModelName');
t('ריק / רווחים / null / מקפים = מילוי', () => {
  for (const v of ['', '   ', null, undefined, '-', '—', ' – ', '__']) assert.equal(isPlaceholderModelName(v), true, JSON.stringify(v));
});
t('"ללא שם" בכל הצורות = מילוי', () => {
  for (const v of ['ללא שם', 'ללא שם - 1243', 'ללא שם 3', ' ללא שם - 12', 'ללא_שם', 'אין שם', 'אין שם - 5', 'No Name', 'unnamed', 'לא ידוע']) assert.equal(isPlaceholderModelName(v), true, v);
});
t('שם אמיתי / מספר / "דגם 567" אינם מילוי (גם מילים שמתחילות באותן אותיות)', () => {
  for (const v of ['316', 'דגם 567', 'שחור כסוף', 'ללא שמלה', 'ללא שרוולים', 'אין שמלה']) assert.equal(isPlaceholderModelName(v), false, v);
});

console.log('modelDisplayName - גמ"ח עם שמות (ברירת מחדל)');
t('שם תיאורי אמיתי נשאר כמו שהוא', () => {
  assert.equal(modelDisplayName({ name: 'שחור כסוף', barcodePrefix: 500 }), 'שחור כסוף');
  assert.equal(modelDisplayName({ name: '  ורוד חלק קצר ', barcodePrefix: 124 }), 'ורוד חלק קצר');
});
t('"ללא שם - N" -> מספר הדגם (barcodePrefix), לא ה-N של אקסס', () => {
  assert.equal(modelDisplayName({ name: 'ללא שם - 1243', barcodePrefix: 815 }), '815');
  assert.equal(modelDisplayName({ name: 'ללא שם', barcodePrefix: '477' }), '477');
  assert.equal(modelDisplayName({ name: null, barcodePrefix: 559 }), '559');
  assert.equal(modelDisplayName({ name: '', code: 12 }), '12');
});
t('שם = מספר: נשאר המספר; "דגם 567" נשאר (בגמ"ח עם שמות לא נוגעים)', () => {
  assert.equal(modelDisplayName({ name: '316', barcodePrefix: 316 }), '316');
  assert.equal(modelDisplayName({ name: 'דגם 567', barcodePrefix: 567 }), 'דגם 567');
});
t('בלי שם ובלי מספר: fallback "—" (לעולם לא "ללא שם")', () => {
  assert.equal(modelDisplayName({ name: 'ללא שם - 1164', barcodePrefix: null }), MODEL_FALLBACK);
  assert.equal(modelDisplayName({}), MODEL_FALLBACK);
  assert.equal(modelDisplayName(null), MODEL_FALLBACK);
  assert.equal(modelDisplayName({ name: null }, { fallback: 'דגם' }), 'דגם');
  assert.equal(modelDisplayName({ name: null }, { fallback: '' }), '');
  assert.ok(!/ללא שם|אין שם/.test(modelDisplayName({ name: 'ללא שם - 1' })));
});
t('מחרוזת במקום אובייקט (שם בלבד)', () => {
  assert.equal(modelDisplayName('שחור'), 'שחור');
  assert.equal(modelDisplayName('ללא שם - 3'), MODEL_FALLBACK);
});

console.log('modelDisplayName - גמ"ח בלי שמות (useModelNames=false, נווה): מספר בלבד');
t('תמיד המספר, גם אם יושב שם תיאורי שיורי', () => {
  const o = { useModelNames: false };
  assert.equal(modelDisplayName({ name: 'שחור כסוף', barcodePrefix: 500 }, o), '500');
  assert.equal(modelDisplayName({ name: 'דגם 567', barcodePrefix: 567 }, o), '567');
  assert.equal(modelDisplayName({ name: 'ללא שם - 1243', barcodePrefix: 815 }, o), '815');
  assert.equal(modelDisplayName({ name: '559', barcodePrefix: 559 }, o), '559');
  assert.equal(modelDisplayName({ name: null, barcodePrefix: 561 }, o), '561');
});
t('בלי מספר: מה שיש (בלי קידומת "דגם "), מילוי -> fallback', () => {
  const o = { useModelNames: false };
  assert.equal(modelDisplayName({ name: 'דגם 77' }, o), '77');
  assert.equal(modelDisplayName({ name: 'ללא שם - 9' }, o), MODEL_FALLBACK);
  assert.equal(modelDisplayName({}, o), MODEL_FALLBACK);
});

console.log('modelNamesEnabled');
t('ברירת מחדל = כן; רק "false" מכבה', () => {
  assert.equal(modelNamesEnabled(undefined), true);
  assert.equal(modelNamesEnabled({}), true);
  assert.equal(modelNamesEnabled({ useModelNames: 'true' }), true);
  assert.equal(modelNamesEnabled({ useModelNames: 'false' }), false);
  assert.equal(modelNamesEnabled({ useModelNames: 'FALSE ' }), false);
  assert.equal(modelNamesEnabled({ useModelNames: false }), false);
  assert.equal(modelNamesEnabled([{ key: 'x', value: '1' }, { key: 'useModelNames', value: 'false' }]), false);
  assert.equal(modelNamesEnabled([{ key: 'x', value: '1' }]), true);
});

console.log('modelHasRealName / modelCodeSuffix / modelLabelWithCode');
t('שם אמיתי: מציג קוד בנפרד; שם=קוד / מילוי: הקוד פעם אחת', () => {
  const real = { name: 'שחור כסוף', barcodePrefix: 500 };
  assert.equal(modelHasRealName(real), true);
  assert.equal(modelCodeSuffix(real), '500');
  assert.equal(modelLabelWithCode(real), 'שחור כסוף (קוד: 500)');
  for (const m of [{ name: '316', barcodePrefix: 316 }, { name: 'דגם 316', barcodePrefix: 316 }, { name: 'ללא שם - 4', barcodePrefix: 316 }, { name: null, barcodePrefix: 316 }]) {
    assert.equal(modelHasRealName(m), false, JSON.stringify(m));
    assert.equal(modelCodeSuffix(m), '', JSON.stringify(m));
  }
  assert.equal(modelLabelWithCode({ name: 'ללא שם - 1243', barcodePrefix: 815 }), '815');
});
t('useModelNames=false: אף פעם לא "שם אמיתי"; התווית = המספר', () => {
  const o = { useModelNames: false };
  assert.equal(modelHasRealName({ name: 'שחור כסוף', barcodePrefix: 500 }, o), false);
  assert.equal(modelCodeSuffix({ name: 'שחור כסוף', barcodePrefix: 500 }, o), '');
  assert.equal(modelLabelWithCode({ name: 'שחור כסוף', barcodePrefix: 500 }, o), '500');
});

console.log('replacePlaceholderModelNames');
t('טקסט חופשי (תיאורי חיוב): "ללא שם - N" -> מה ש-resolve מחזיר, אחרת "דגם"', () => {
  const map = { 'ללא שם - 1243': '815' };
  const r = (k) => map[k];
  assert.equal(replacePlaceholderModelNames('חיוב מקורי: ללא שם - 1243 (פריט #ab-12)', r), 'חיוב מקורי: 815 (פריט #ab-12)');
  assert.equal(replacePlaceholderModelNames('ללא שם - 1243 מידה 36, ללא שם - 9 מידה 38', r), '815 מידה 36, דגם מידה 38');
  assert.equal(replacePlaceholderModelNames('שחור כסוף מידה 36', r), 'שחור כסוף מידה 36');
  assert.equal(replacePlaceholderModelNames('ללא שמלה מידה 36', r), 'ללא שמלה מידה 36');
  assert.equal(replacePlaceholderModelNames(null, r), '');
  assert.equal(replacePlaceholderModelNames('ללא שם', () => { throw new Error('x'); }), 'דגם');
});

console.log('modelCode / autoModelName');
t('קוד כמחרוזת; שם אוטומטי = המספר עצמו (כמו דגמי נווה שיובאו)', () => {
  assert.equal(modelCode({ barcodePrefix: 559 }), '559');
  assert.equal(modelCode({ barcodePrefix: null, code: 7 }), '7');
  assert.equal(modelCode({}), '');
  assert.equal(modelCode(null), '');
  assert.equal(autoModelName(567), '567');
  assert.equal(autoModelName(' 567 '), '567');
  assert.equal(autoModelName(''), null);
  assert.equal(autoModelName(null), null);
});

console.log(`\n${passed} passed`);
