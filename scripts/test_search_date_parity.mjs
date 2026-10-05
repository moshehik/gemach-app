// בדיקת התאמה בין שלוש צורות ההתאמה של תאריך עברי שמור (Order.eventDateHebrew): החיפוש הראשי (hebrewDateSqlRegex ב-lib/homeSearchPlan.js),
// הרשימות (hebrewDateSqlParts ב-lib/searchNormalize.js, בשימוש lib/listSearch.js) והמגדיר (hebrewDateMatchesStored). כולן חייבות להחזיר אותה תשובה
// לאותו טקסט שמור ולאותו קלט, כדי שאותו תאריך יחזיר אותן הזמנות בדף הבית ובמסך ההזמנות.
//   node scripts/test_search_date_parity.mjs     (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { parseHebrewDate, hebrewDateMatchesStored, hebrewDateSqlParts } from '../lib/searchNormalize.js';
import { hebrewDateSqlRegex } from '../lib/homeSearchPlan.js';
import { getHebrewDateString } from '../lib/hebrewDate.js';

let pass = 0; let fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok   - ' + name); } catch (e) { fail++; console.log('  FAIL - ' + name + '\n         ' + e.message); } };

const stripQuotes = (s) => String(s).replace(/["״׳']/g, '');
const byRegex = (stored, parsed) => new RegExp(hebrewDateSqlRegex(parsed)).test(stripQuotes(stored));
const byParts = (stored, parsed) => {
  const p = hebrewDateSqlParts(parsed); const s = String(stored);
  return p.equals.includes(s) || p.startsWith.some((x) => s.startsWith(x)) || p.contains.some((x) => s.includes(x)) || p.endsWith.some((x) => s.endsWith(x));
};

// טקסטים שמורים כמו שהאתר כותב + צורות שמורות שמצאנו בנתונים (בלי גרשיים / עם שנה בכתיב אחר / בלי שנה)
const stored = new Set();
for (let i = 0; i < 800; i += 2) {
  const s = getHebrewDateString(new Date(Date.UTC(2026, 0, 1 + i, 12)));
  stored.add(s); stored.add(stripQuotes(s)); stored.add(s.split(' ').slice(0, -1).join(' '));
}
stored.add('ב חשוון'); stored.add('כב חשוון'); stored.add('יב חשוון תשפז'); stored.add('ב חשוון תשפ"ז'); stored.add('');

const queries = ['כז תשרי', 'כ"ז תשרי', 'ב חשוון', 'ב\' חשוון', 'ט"ו בשבט', 'טו שבט', 'ניסן', 'חשוון', 'י"א תשרי תשפ"ז', 'יא תשרי תשפז', 'א אדר', 'ל כסלו', 'כב חשוון', 'אלול'];

for (const q of queries) {
  t(`"${q}": regex = hebrewDateMatchesStored = SQL parts על ${stored.size} טקסטים שמורים`, () => {
    const parsed = parseHebrewDate(q);
    assert.ok(parsed, 'לא נפרש');
    const diffs = [];
    for (const s of stored) {
      const m = hebrewDateMatchesStored(s, parsed);
      if (byRegex(s, parsed) !== m) diffs.push(`regex!=matcher: [${s}]`);
      // SQL parts מדויקות רק לטקסט בלי גרשיים אצל היום / החודש (כמו שהאתר שומר): נבדק על הטקסט כמות שהוא וגם בלי גרשיים
      if (!s.includes('"') && byParts(s, parsed) !== m) diffs.push(`parts!=matcher: [${s}]`);
    }
    assert.deepEqual(diffs.slice(0, 5), []);
  });
}
console.log(`\n${pass} passed${fail ? ', FAILURES' : ''}`);
process.exit(fail ? 1 : 0);
