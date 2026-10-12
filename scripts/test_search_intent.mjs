// בדיקות מנתח כוונת החיפוש של פאנל התפוסה / הפריט (lib/searchIntent.js) - טהור, בלי DB ובלי Next.
// הרצה: node scripts/test_search_intent.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { parseSearchIntent, digitsMeaning, wantsPanel } from '../lib/searchIntent.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const NOW = new Date('2026-10-12T09:00:00Z'); // 12.10.2026 (כ"ג תשרי תשפ"ז) - היום הקלנדרי בישראל
const P = (q) => parseSearchIntent(q, { now: NOW });
const brief = (q) => { const r = P(q); return { kind: r.kind, barcode: r.barcode, prefix: r.prefix, name: r.modelName, sizes: r.sizes, partial: r.partial, date: r.date && r.date.key }; };

console.log('ספרות בלבד');
t('7 ספרות = ברקוד פריט מלא; 8 ספרות (קידומת של 4) גם', () => {
  assert.deepEqual(brief('6323401'), { kind: 'item', barcode: '6323401', prefix: null, name: null, sizes: [], partial: false, date: null });
  assert.equal(P('63234010').kind, 'item');
  assert.equal(P('ברקוד 6323401').kind, 'item');
});
t('5-6 ספרות = ברקוד חלקי: קידומת + מידה (55104 -> דגם 551 מידה 04)', () => {
  assert.deepEqual(brief('55104'), { kind: 'model', barcode: null, prefix: 551, name: null, sizes: ['04'], partial: true, date: null });
  assert.deepEqual(brief('551040'), { kind: 'model', barcode: null, prefix: 5510, name: null, sizes: ['40'], partial: true, date: null });
  assert.deepEqual(brief('ברקוד 55104'), { kind: 'model', barcode: null, prefix: 551, name: null, sizes: ['04'], partial: true, date: null });
});
t('3-4 ספרות = קוד דגם בלבד (כל המידות); השרת מאמת שהקוד קיים', () => {
  assert.deepEqual(brief('551'), { kind: 'model', barcode: null, prefix: 551, name: null, sizes: [], partial: false, date: null });
  assert.equal(P('5510').prefix, 5510);
  assert.equal(P('551').ambiguous, true);
});
t('אין פאנל: 1-2 ספרות, אפס מוביל (טלפון), 9+ ספרות, אותיות/מקף בתוך המספר', () => {
  for (const q of ['5', '12', '0501234567', '050 1234567', '055', '123456789', '5-51', '', '  ']) assert.equal(P(q).kind, 'none', q);
  assert.equal(digitsMeaning('0551'), null);
  assert.equal(wantsPanel(P('שרה כהן')), false);
  assert.equal(wantsPanel(P('551')), true);
});
t('ספרות עבריות/ערביות מנורמלות; רווחים מיותרים נחתכים', () => {
  assert.equal(P('  551  ').prefix, 551);
  assert.equal(P('٥٥١').prefix, 551);
});

console.log('דגם + מידה');
t('מילות מפתח בכל סדר, ובלי מילת דגם', () => {
  for (const q of ['דגם 551 מידה 4', 'מידה 4 דגם 551', '551 מידה 4', '551 4']) {
    const r = brief(q);
    assert.equal(r.kind, 'model', q); assert.equal(r.prefix, 551, q); assert.deepEqual(r.sizes, ['4'], q); assert.equal(r.partial, false, q);
  }
  assert.deepEqual(P('551 04').sizes, ['04']);
  assert.deepEqual(P('דגם 551 מידה 4,6').sizes, ['4', '6']);
});
t('דגם לפי שם - רק עם מילת המפתח "דגם" (שם לבדו הוא חיפוש לקוח/פריט רגיל)', () => {
  assert.deepEqual(brief('דגם שחור קפלים'), { kind: 'model', barcode: null, prefix: null, name: 'שחור קפלים', sizes: [], partial: false, date: null });
  assert.deepEqual(P('דגם שחור קפלים מידה 38').sizes, ['38']);
  assert.equal(P('שחור קפלים').kind, 'none');
});
t('מידה לבדה / דגם 7 ספרות / סתירת מידה: אין פאנל', () => {
  assert.equal(P('מידה 4').kind, 'none');
  assert.equal(P('דגם 6323401').kind, 'none');
  assert.equal(P('דגם 55104 מידה 4').kind, 'none'); // המידה כבר בתוך הברקוד החלקי
  assert.equal(P('הזמנה 55104').kind, 'none');
  assert.equal(P('טלפון 0501234567').kind, 'none');
});
t('טקסט שנשאר שאינו תאריך מבטל את הפאנל', () => {
  assert.equal(P('דגם 551 שרה').kind, 'none');
  assert.equal(P('551 שרה').kind, 'none');
});

console.log('תאריך');
t('תאריך עברי בלי שנה = המופע הקרוב מהיום והלאה (כ חשוון -> 31.10.2026)', () => {
  assert.equal(P('55104 כ חשוון').date.key, '2026-10-31');
  assert.equal(P('551 מידה 4 כ חשוון').date.key, '2026-10-31');
  assert.equal(P('551 תאריך כ חשוון').date.key, '2026-10-31');
  assert.equal(P('551 04 כ חשוון').date.key, '2026-10-31');
});
t('תאריך עברי עם שנה מפורשת, גם בעבר', () => {
  assert.equal(P('551 42 כ חשוון תשפז').date.key, '2026-10-31');
  assert.equal(P('551 כ חשוון תשפה').date.key, '2024-11-21'); // עבר - מתקבל כפי שהוא (כ' חשוון תשפ"ה)
});
t('תאריך לועזי: 5/11, 20.10.2026', () => {
  assert.equal(P('55104 5/11').date.key, '2026-11-05');
  assert.equal(P('55104 20.10.2026').date.key, '2026-10-20');
  assert.equal(P('דגם 551 מידה 4 20.10.2026').date.key, '2026-10-20');
});
t('תאריך שלא קיים בחודש הזה ("ל אדר") = אין פאנל, לא "היום" בשקט', () => {
  assert.equal(P('551 ל אדר').kind, 'none');
  assert.equal(P('55104 31/2').kind, 'none');
});
t('בלי תאריך: dateKey = היום בישראל; ברקוד פריט עם תאריך = אין פאנל', () => {
  assert.equal(P('551').dateKey, '2026-10-12');
  assert.equal(P('551').date, null);
  assert.equal(P('6323401 כ חשוון').kind, 'none');
});
t('היום הקלנדרי בישראל, לא UTC: 23:30 UTC ב-12.10 כבר 13.10 בישראל', () => {
  assert.equal(parseSearchIntent('551', { now: new Date('2026-10-12T23:30:00Z') }).dateKey, '2026-10-13');
  assert.equal(parseSearchIntent('551', { now: new Date('2026-10-12T20:30:00Z') }).dateKey, '2026-10-12');
});

console.log('חתימה (מפתח מטמון/ביטול בקשה)');
t('אותה כוונה = אותה חתימה, מידות בסדר שונה זהות, כתיבי מידה שונים ("04"/"4") זהים', () => {
  assert.equal(P('דגם 551 מידה 4,6').signature, P('דגם 551 מידה 6,4').signature);
  assert.equal(P('551 04').signature, P('551 4').signature);
  assert.notEqual(P('551').signature, P('552').signature);
  assert.notEqual(P('551').signature, P('551 כ חשוון').signature);
  assert.equal(P('שרה').signature, '');
});

console.log(`\n${passed} passed`);
