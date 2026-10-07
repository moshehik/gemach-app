// בדיקות "הערות הלקוח בהדפסת הכנה" (דיווח b61a7ca5, נווה יעקב): lib/customerNotesForPrint.js + מבנה סטטי של app/print/order/page.js וההגדרה.
// הרצה (מהשורש): node scripts/test_print_prep_customer_notes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manualCustomerNotes, AUTO_CUSTOMER_NOTE_RE } from '../lib/customerNotesForPrint.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0; let failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; process.exitCode = 1; console.error('  FAIL -', name, '\n        ', e.stack || e.message); }
}

await t('manualCustomerNotes: טקסט ידני נשמר, שורות ריקות מוסרות, רווחים נחתכים', () => {
  assert.equal(manualCustomerNotes('  לא לשלוח משלוח  \n\n  מעדיפה צבע בהיר'), 'לא לשלוח משלוח\nמעדיפה צבע בהיר');
});
await t('manualCustomerNotes: שורות "אוטומטי: שמלה ..." לא מודפסות', () => {
  const n = 'לקוחה חשובה\n[12.3.2026] אוטומטי: שמלה 44012 (הזמנה 53300) הוחזרה עם כתם\nעוד הערה';
  assert.equal(manualCustomerNotes(n), 'לקוחה חשובה\nעוד הערה');
  assert.ok(AUTO_CUSTOMER_NOTE_RE.test('[1.1.2026] אוטומטי: שמלה 1 (הזמנה 2) x'));
});
await t('manualCustomerNotes: ריק/null/לא-מחרוזת/רק אוטומטי -> ""', () => {
  for (const v of [null, undefined, '', '   \n ', 5, {}]) assert.equal(manualCustomerNotes(v), '');
  assert.equal(manualCustomerNotes('[1.1.2026] אוטומטי: שמלה 1 (הזמנה 2) x'), '');
});
await t('manualCustomerNotes: CRLF', () => {
  assert.equal(manualCustomerNotes('א\r\nב'), 'א\nב');
});

const page = read('app/print/order/page.js');
await t('הדף: ההגדרה כבויה כברירת מחדל, נקראת מ-/api/settings, והתיבה רק בהדפסה מרוכזת (isBatch)', () => {
  assert.ok(/const \[prepCustomerNotesSetting, setPrepCustomerNotesSetting\] = useState\(false\);/.test(page));
  assert.ok(page.includes("settingsData.find(s => s.key === 'print_prep_customer_notes')"));
  assert.ok(page.includes("prepNotesSetting.value === 'true') setPrepCustomerNotesSetting(true)"));
  assert.ok(page.includes('prepCustomerNotesSetting && isBatch ? manualCustomerNotes(ord?.customer?.notes) : \'\''));
  assert.ok(page.includes('{prepCustomerNotes && ('));
});
await t('הדף: התיבה גדולה (>=20px), מודגשת, לא נשברת בין עמודים', () => {
  const css = page.match(/\.customer-notes-big \{([^}]*)\}/)[1];
  assert.ok(/font-size: (2\d|3\d)px/.test(css), css);
  assert.ok(/font-weight: 700/.test(css) && /break-inside: avoid/.test(css) && /white-space: pre-wrap/.test(css));
});
await t('ההגדרה: שם+הסבר בעברית, בוליאנית, בקבוצת הדפסה וב-SimLayout, seed org2=true', () => {
  const meta = read('lib/settingsMetadata.js');
  assert.ok(/print_prep_customer_notes: 'הדפסת הכנה - הערות הלקוח בגדול'/.test(meta));
  assert.ok(/print_prep_customer_notes: 'כשמופעל[^']*כבוי = ההדפסה כמו קודם/.test(meta));
  assert.ok(/SETTINGS_BOOLEAN_KEYS[\s\S]*'print_prep_customer_notes'/.test(meta));
  assert.ok(read('lib/settingsSimLayout.js').includes("'print_prep_customer_notes'"));
  const seed = read('scripts/seed_print_prep_customer_notes_setting.js');
  assert.ok(/key: 'print_prep_customer_notes'/.test(seed) && /trueForOrg: 2/.test(seed) && /seedBoolSetting\(/.test(seed));
});

console.log(`\n${passed} passed, ${failed} failed`);
