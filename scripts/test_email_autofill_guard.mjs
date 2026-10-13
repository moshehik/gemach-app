// בדיקות סטטיות (בלי DB/שרת/דפדפן) לדיווח הישן "אני לא רוצה שיקפיץ לי אפשרויות של כתובות אימייל קודמות שנרשמו קודם".
// הדפדפן (כרום בעיקר) מצרף היסטוריית הקלדות לשדה לפי ה-name שלו (ובלי name - לפי ה-id הקבוע) ומתעלם ברובו מ-autocomplete="off";
// הפתרון המוכח באתר: name אקראי לכל טעינה + autocomplete="new-password" + סימוני מנהלי הסיסמאות (lib/autofillGuard.js, הוק useNoFill).
// הבדיקה סורקת את כל שדות המייל בקוד (app/ + components/) ונכשלת אם שדה מייל בטופס לקוח / שליחת מייל איבד את ההגנה - כך שרגרסיה נתפסת.
// הרצה (מהשורש): node scripts/test_email_autofill_guard.mjs   - יוצא בקוד 1 אם משהו נכשל.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// ---------- סורק JSX מינימלי: מחזיר את הטקסט של כל תג <input|Inp|NoSuggest ... > ----------
function tagsOf(src, names = ['input', 'Inp', 'NoSuggest']) {
  const out = [];
  const re = new RegExp(`<(${names.join('|')})(?=[\\s/>])`, 'g');
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length; let depth = 0; let q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push({ name: m[1], text: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (rel === 'app/api') continue; walk(rel, acc); } else if (e.name.endsWith('.js')) acc.push(rel);
  }
  return acc;
}
const isEmailTag = (s) => /id="adv-search-email"|type=(?:"email"|\{?'email'\}?)|type:\s*'email'|inputMode=(?:"email"|\{?'email'\}?)|inputMode:\s*'email'|data-f="email"/.test(s);
const guarded = (s) => /\{\.\.\.nf\('/.test(s);

// שדות מייל שפטורים בכוונה (עם סיבה) - כל פטור חייב להיות מתועד כאן ולהיסגר בהחלטה של הבעלים
const EXEMPT = {
  // (ריק) עמדת הלקוח הישנה (app/customer-interface/LegacyKioskPage.js) הייתה פטורה כשהייתה בבעלות סוכן אחר; באינטגרציה 12.10.2026 טופס הרישום שלה נושא useNoFill כמו שאר הטפסים.
};

console.log('1. כל שדה מייל בקוד נושא את ההגנה (name אקראי + new-password)');
await t('כל input/Inp/NoSuggest מסוג מייל ב-app/ וב-components/ משתמש ב-{...nf(...)} (פטורים מתועדים ב-EXEMPT)', () => {
  const files = [...walk('app'), ...walk('components')];
  let total = 0; const bad = [];
  for (const f of files) {
    const src = read(f);
    for (const tag of tagsOf(src)) {
      if (!isEmailTag(tag.text)) continue;
      if (EXEMPT[f]) { continue; }
      total++;
      // NoSuggest מפעיל את useNoFill בעצמו (נבדק בנפרד) - התג שלו כשר
      if (tag.name === 'NoSuggest') continue;
      if (!guarded(tag.text)) bad.push(`${f}:${tag.line}  ${tag.text.slice(0, 110).replace(/\s+/g, ' ')}`);
    }
  }
  assert.ok(total >= 12, `נמצאו רק ${total} שדות מייל - הסורק כנראה שבור`);
  assert.deepEqual(bad, [], `שדות מייל בלי הגנה מפני היסטוריית הדפדפן:\n   ${bad.join('\n   ')}`);
});
await t('כל הפטורים עדיין מכילים שדה מייל (אחרת - למחוק את הפטור)', () => {
  for (const f of Object.keys(EXEMPT)) {
    assert.ok(tagsOf(read(f)).some((x) => isEmailTag(x.text)), `${f}: אין בו שדה מייל`);
  }
});
await t('הרכיבים המשותפים: CcInput (כרטיס לקוח + לקוח חדש) ו-NoSuggest (אשף הזמנה חדשה) מפעילים useNoFill ואין בהם name קבוע', () => {
  const cc = read('app/components/customer-card/CcFields.js');
  assert.match(cc, /useNoFill\(\)/);
  assert.match(cc, /\{\.\.\.nf\(field \|\| id\)\}/);
  assert.ok(!/-nofill|autoComplete="nope"/.test(cc), 'CcInput חזר לשם קבוע / ערך autocomplete לא מוכר');
  const ns = read('app/components/new-order/NoSuggest.js');
  assert.match(ns, /useNoFill\(\)/);
  assert.match(ns, /\{\.\.\.nf\(id\)\}/);
  assert.ok(!/autoComplete="off"/.test(ns), 'NoSuggest חזר ל-autocomplete=off (כרום מתעלם ממנו)');
  // השדה משתמש בו: CcEmailInput עובר דרך CcInput; האשף מעביר את המייל דרך NoSuggest
  assert.match(cc, /export function CcEmailInput[\s\S]*<CcInput/);
  assert.match(read('app/components/new-order/StepCustomer.js'), /<NoSuggest id="noNcEmail"/);
});

console.log('2. טפסי לקוח: אין name קבוע של שדה מוכר (שם / טלפון / מייל / כתובת / ת"ז) בשדות הקלט');
const CUSTOMER_FORMS = [
  'app/components/new-order/StepCustomer.js',
  'app/components/customer-card/NewCustomerA5.js',
  'app/components/customer-card/tabs/CcDetailsTab.js',
  'app/components/customer-card/CcFields.js',
  'app/components/order-card/parts/OcCustomerSwap.js',
  'components/orders/modern/ModernGeneralDetails.js',
  'app/orders/new/LegacyNewOrderPage.js',
  'app/customers/[id]/LegacyCustomerPage.js',
  'components/customers/modern/ModernCustomerDetailsTab.js',
  // טפסי עובד / פרופיל (אותו דפוס - החלטת הבעלים 12.10.2026); חייבים להישאר ארבעתם אחרונים (slice(-4) למטה)
  'app/components/employee-card/EmployeeCardA5.js',
  'app/components/profile/ProfilePage.js',
  'app/employees/[id]/LegacyEmployeeCardPage.js',
  'app/profile/LegacyProfilePage.js',
];
await t('בטפסי הלקוח אף input לא נושא name קבוע (name="email", name="phone1"...) ואף שדה פרטי-לקוח לא נשאר בלי ההגנה', () => {
  const FIELD = /(?:^|\s)name=(?:"|\{`?)(?:email|firstName|lastName|phone1|phone2|city|street|houseNum|zeout|fullName|paymentMethod|password|[A-Za-z]+-nofill)/;
  const bad = [];
  for (const f of CUSTOMER_FORMS) {
    for (const tag of tagsOf(read(f))) {
      if (FIELD.test(tag.text)) bad.push(`${f}:${tag.line}  ${tag.text.slice(0, 100).replace(/\s+/g, ' ')}`);
    }
  }
  assert.deepEqual(bad, [], `name קבוע בטופס לקוח:\n   ${bad.join('\n   ')}`);
});
await t('בטפסי הלקוח הוספת הוק useNoFill מיובאת וקיימת בכל קובץ שיש בו שדה מייל/טלפון/שם ישיר (לא דרך CcInput)', () => {
  for (const f of CUSTOMER_FORMS.filter((x) => !/NewCustomerA5|CcDetailsTab/.test(x))) {
    assert.match(read(f), /useNoFill/, `${f}: חסר useNoFill`);
  }
  // NewCustomerA5 + CcDetailsTab בנויים כולם על CcInput/CcEmailInput - אין להם input גולמי
  for (const f of ['app/components/customer-card/NewCustomerA5.js', 'app/components/customer-card/tabs/CcDetailsTab.js']) {
    assert.equal(tagsOf(read(f), ['input']).filter((x) => !/type="checkbox"/.test(x.text)).length, 0, `${f}: input גולמי בטופס שנבנה על CcInput`);
  }
});
await t('מטפלים שקראו e.target.name קוראים עכשיו fieldOf(e.target) (name אקראי לא שובר שמירה)', () => {
  assert.match(read('app/customers/[id]/LegacyCustomerPage.js'), /const name = fieldOf\(e\.target\);/);
  const se = read('components/SendEmailModal.js');
  assert.match(se, /\[fieldOf\(e\.target\)\]: e\.target\.value/);
  assert.ok(!se.includes('[e.target.name]'));
});

await t('מטפלי הטפסים של עובד / פרופיל קוראים fieldOf(e.target) ולא e.target.name', () => {
  for (const f of CUSTOMER_FORMS.slice(-4)) {
    const src = read(f);
    assert.match(src, /const name = fieldOf\(e\.target\);/, f);
    assert.ok(!/const \{ name, value, type, checked \} = e\.target/.test(src), f);
  }
});

console.log('3. שדות חיפוש / סריקה / סינון: אין name קבוע ("<id>-nofill") בשום input טקסט');
await t('בכל app/ ו-components/ אין input עם name מסוג "...-nofill" חוץ משדות סיסמה / קוד אישור (type="password") ובוחרי תאריך לקריאה בלבד', () => {
  const bad = [];
  for (const f of [...walk('app'), ...walk('components')]) {
    for (const tag of tagsOf(read(f), ['input', 'Inp'])) {
      if (/-nofill/.test(tag.text) && !/type="password"|readOnly/.test(tag.text)) bad.push(`${f}:${tag.line}  ${tag.text.slice(0, 100).replace(/\s+/g, ' ')}`);
    }
  }
  assert.deepEqual(bad, [], `name קבוע בשדה חיפוש:\n   ${bad.join('\n   ')}`);
});

console.log('4. ההוק עצמו: בטוח להידרציה, ובלי name בשרת');
await t('lib/autofillGuard.js: name נוצר רק ב-useEffect (לא ב-render) ומאפייני new-password + מנהלי סיסמאות', () => {
  const g = read('lib/autofillGuard.js');
  assert.match(g, /useEffect\(\(\) => \{\s*setSalt\(Math\.random\(\)\.toString\(36\)\.slice\(2, 10\)\);\s*\}, \[\]\);/);
  assert.match(g, /autoComplete: 'new-password'/);
  assert.match(g, /'data-lpignore': 'true'/);
  assert.match(g, /'data-1p-ignore': true/);
  assert.ok(!/useRef/.test(g), 'אסור לקרוא/לכתוב ref בזמן render (react-hooks/refs)');
});
await t('רינדור שרת: אין name (ההידרציה זהה), יש new-password ו-data-field; fieldOf מעדיף data-field על name', async () => {
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const G = await import(pathToFileURL(path.join(ROOT, 'lib/autofillGuard.js')).href);
  function F() { const nf = G.useNoFill(); return React.createElement('input', { id: 'x', type: 'email', ...nf('email') }); }
  const html = renderToString(React.createElement(F));
  assert.ok(!/ name=/.test(html), html);
  assert.match(html, /autoComplete="new-password"|autocomplete="new-password"/i);
  assert.match(html, /data-field="email"/);
  assert.equal(G.fieldOf({ dataset: { field: 'email' }, name: 'no-autofill-email-abc' }), 'email');
  assert.equal(G.fieldOf({ name: 'email' }), 'email');
  assert.equal(G.fieldOf(null), '');
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
