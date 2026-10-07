// בדיקות סטטיות לשינוי "כפתור שמירה בפס תחתון + פחות חלונות אישור" בכרטיס ההזמנה הישן (דיווחים 7681043a, c43a2b84, נווה יעקב, 2026-10-06).
// הרצה: node scripts/test_order_card_save_flow.mjs   (בלי DB, בלי רשת, קוד יציאה 1 אם משהו נכשל)
// מה נבדק: (1) שתי ההגדרות רשומות (שם+הסבר בעברית, מפתח בוליאני, קבוצה ב-SimLayout, סקריפט seed עם host-check);
// (2) כבוי = אין שינוי: ברירת המחדל false וכל מסלול חדש מגודר בהגדרה; (3) אף אישור אבטחה/כסף לא הוסר.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8').replace(/\r\n/g, '\n');
let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.log('  FAIL -', name, '\n        ', e.message.split('\n')[0]); }
}

const card = read('components/orders/modern/ModernOrderCard.js');
const page = read('app/orders/[id]/LegacyOrderPage.js');
const meta = read('lib/settingsMetadata.js');
const sim = read('lib/settingsSimLayout.js');
const KEYS = ['order_card_save_in_footer', 'order_edit_fewer_confirmations'];

console.log('הגדרות');
await t('שני המפתחות: שם + הסבר בעברית, מפתח בוליאני, ב-SimLayout (קבוצה + אייקון), סקריפט seed', () => {
  for (const k of KEYS) {
    assert.ok(new RegExp(`${k}: '[^']*[א-ת][^']*'`).test(meta.slice(meta.indexOf('SETTINGS_HEBREW_NAMES'), meta.indexOf('SETTINGS_HEBREW_NOTES'))), `${k} שם`);
    assert.ok(new RegExp(`${k}: '[^']*כבוי \\(ברירת מחדל\\)`).test(meta.slice(meta.indexOf('SETTINGS_HEBREW_NOTES'))), `${k} הסבר`);
    assert.ok(new RegExp(`SETTINGS_BOOLEAN_KEYS[\\s\\S]*'${k}'`).test(meta), `${k} בוליאני`);
    assert.ok(sim.includes(`'${k}'`) && new RegExp(`${k}: \\{ icon:`).test(sim), `${k} sim`);
    const seed = read(`scripts/seed_${k}_setting.js`);
    assert.ok(seed.includes("require('./lib/seed-bool-setting')") && seed.includes(`key: '${k}'`) && seed.includes('trueForOrg: 2'), `${k} seed`);
    assert.ok(!/--write/.test(seed.split('\n').filter((l) => !l.startsWith('//')).join('\n')), `${k}: הסקריפט לא כותב בלי --write (הלוגיקה בעזר המשותף)`);
  }
});
console.log('כרטיס ההזמנה הישן');
await t('כבוי = כמו תמיד: שתי ההגדרות נקראות עם ברירת מחדל false', () => {
  assert.ok(/const \[saveInFooter, setSaveInFooter\] = useState\(false\);/.test(page));
  assert.ok(/const \[fewerConfirmations, setFewerConfirmations\] = useState\(false\);/.test(page));
  assert.ok(/s\.key === 'order_card_save_in_footer'/.test(page) && /s\.key === 'order_edit_fewer_confirmations'/.test(page));
  assert.ok(/saveInFooter = false/.test(card), 'ModernOrderCard: ברירת מחדל false');
});
await t('כפתור שמירה: בראש הדף כשכבוי, בפס תחתון כשדולק - אותו כפתור בדיוק (שמירה אחת, בלי כפילות)', () => {
  assert.equal((card.match(/\{!saveInFooter && saveButton\}/g) || []).length, 1);
  assert.equal((card.match(/\{saveInFooter && \(/g) || []).length, 1);
  assert.equal((card.match(/onClick=\{\(\) => onSave\(\)\}/g) || []).length, 1, 'onSave נקרא מכפתור אחד בלבד (קבוע saveButton)');
  const footer = card.slice(card.indexOf('{saveInFooter && ('), card.indexOf('מודל אישור שחרור נעילה', card.indexOf('{saveInFooter && (') + 10));
  assert.ok(/borderTop: '1px solid var\(--border\)'/.test(footer) && /<span style=\{\{ flex: 1 \}\} \/>\s*\{saveButton\}/.test(footer), 'אותו מבנה כמו פוטר NewOrderShell: ספייסר + כפתור ראשי בקצה');
  assert.ok(read('components/orders/new/NewOrderShell.js').includes("marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border)'"), 'הפוטר של האשף לא השתנה');
  assert.equal(read('components/orders/modern/ModernOrderCard.js').includes('{saveInFooter && saveButton}'), false);
});
await t('הכפתור "חזור" ושאר הפעולות העליונות לא זזו', () => {
  assert.ok(/title="שמירה וחזרה לרשימת ההזמנות" onClick=\{\(\) => onExit\(\)\}/.test(card));
  assert.ok(/title=\{hasUnsavedChanges \? 'ביטול שינויים שלא נשמרו'/.test(card));
});
await t('פחות חלונות: מגודר ב-fewerConfirmations + enableEditSummaryConfirm; הדפסה ממוזגת לחלון הסיכום; שמירה בלי שינויים = שאלת הדפסה בלבד', () => {
  assert.ok(/confirmSaveSummaryIfNeeded\(currentOrder, \{ offerPrint: fewerConfirmations && promptPrint \}\)/.test(page));
  assert.ok(/if \(!enableEditSummaryConfirm \|\| !currentOrder\?\.orderId\) return \{ proceed: true \};/.test(page), 'בלי חלון סיכום - אין שינוי');
  assert.ok(/\.\.\.\(offerPrint \? \{ printAfter: summaryPrintAfterRef\.current \} : \{\}\)/.test(page));
  assert.ok(/summaryConfirmResult\.printAfter !== undefined\s*\?\s*summaryConfirmResult\.printAfter/.test(page));
  assert.ok(/'השינויים נשמרו בהצלחה! להדפיס את ההזמנה המעודכנת\?'/.test(page), 'השאלה הרגילה נשארה כשהחלון הממוזג לא הוצג');
  const noop = page.slice(page.indexOf('order_edit_fewer_confirmations (דיווח c43a2b84): לחיצה מפורשת'), page.indexOf('// VALIDATE REPAIRS'));
  assert.ok(/fewerConfirmations && promptPrint && !overrideOrder && !hasUnsavedChanges && !pendingDebtBlockRef\.current && !items\.some\(it => !it\.id && it\._localId\)/.test(noop));
  assert.ok(!/fetch\(|putOrder|verify-pin|customAuthPrompt/.test(noop), 'מסלול ללא שינויים: אפס כתיבות ואפס אישורי אבטחה');
  assert.ok(/window\.open\(`\/print\/order\?orderId=\$\{currentOrder\.orderId\}&type=order`, '_blank', 'noopener'\)/.test(noop));
});
await t('אישורי אבטחה/כסף נשארו: ת"ז, קוד מאשר לחוב, מחיקת פריט, התנגשות 409, חלון הסיכום', () => {
  for (const s of ["await requestZeout()", "requiredLevel: DEBT_APPROVAL_LEVEL", "'feature:item_change_approval'", "overwriteConflict: true", "const confirmSaveSummaryIfNeeded"]) assert.ok(page.includes(s), s);
  assert.equal((page.match(/await confirmSaveSummaryIfNeeded\(/g) || []).length, 2, 'handleSave + handleExit (בלי להוסיף או להסיר קריאות)');
  assert.ok(/confirmSaveSummaryIfNeeded\(order\);/.test(page), 'handleExit ללא offerPrint = כמו קודם');
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
