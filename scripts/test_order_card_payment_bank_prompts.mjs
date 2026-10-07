// בדיקות סטטיות לשינוי "חלון תשלום בסיום הוספת פריטים + מחיקת פריט שומרת ופותחת פרטי בנק" בכרטיס ההזמנה הישן
// (דיווחים 96bcbf45, b45fd22e, 5cf81871, נווה יעקב, 2026-10-06).
// הרצה: node scripts/test_order_card_payment_bank_prompts.mjs   (בלי DB, בלי רשת, קוד יציאה 1 אם משהו נכשל)
// מה נבדק: (1) שתי ההגדרות רשומות + seed; (2) כבוי = אפס שינוי (ברירת מחדל false, המסלול הישן נשמר מילה במילה);
// (3) אין לוגיקת כסף חדשה: אין fetch/כתיבה בקוד החדש - הכול דרך handleSave ו-ModernPaymentsManager הקיימים.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8').replace(/\r\n/g, '\n');
let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.log('  FAIL -', name, '\n        ', e.message.split('\n')[0]); }
}
const page = read('app/orders/[id]/LegacyOrderPage.js');
const mim = read('components/orders/modern/ModernItemsManager.js');
const meta = read('lib/settingsMetadata.js');
const sim = read('lib/settingsSimLayout.js');
const KEYS = ['order_card_defer_payment_prompt', 'order_card_save_after_item_delete'];
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, `חסר: ${a.slice(0, 50)}`); const j = s.indexOf(b, i + a.length); assert.ok(j > i, `חסר: ${b.slice(0, 50)}`); return s.slice(i, j); };

console.log('הגדרות');
await t('שני המפתחות: שם + הסבר בעברית עם "כבוי (ברירת מחדל)", בוליאני, SimLayout, seed עם host-check', () => {
  for (const k of KEYS) {
    assert.ok(new RegExp(`${k}: '[^']*[א-ת][^']*'`).test(meta.slice(meta.indexOf('SETTINGS_HEBREW_NAMES'), meta.indexOf('SETTINGS_HEBREW_NOTES'))), `${k} שם`);
    assert.ok(new RegExp(`${k}: '[^']*כבוי \\(ברירת מחדל\\)`).test(meta.slice(meta.indexOf('SETTINGS_HEBREW_NOTES'))), `${k} הסבר`);
    assert.ok(new RegExp(`SETTINGS_BOOLEAN_KEYS[\\s\\S]*'${k}'`).test(meta), `${k} בוליאני`);
    assert.ok(sim.includes(`'${k}'`) && new RegExp(`${k}: \\{ icon:`).test(sim), `${k} sim`);
    const seed = read(`scripts/seed_${k}_setting.js`);
    assert.ok(seed.includes("require('./lib/seed-bool-setting')") && seed.includes(`key: '${k}'`) && seed.includes('trueForOrg: 2'), `${k} seed`);
  }
  assert.ok(read('scripts/lib/seed-bool-setting.js').includes('hostOf(url)') && read('scripts/lib/seed-bool-setting.js').includes('SAFETY ABORT'), 'העזר המשותף בודק host ולא כותב בלי --write');
});

console.log('כרטיס ההזמנה הישן - כבוי = כמו תמיד');
await t('ברירות מחדל false + קריאה מ-/api/settings', () => {
  assert.ok(/const \[deferPaymentPrompt, setDeferPaymentPrompt\] = useState\(false\);/.test(page));
  assert.ok(/const \[saveAfterItemDelete, setSaveAfterItemDelete\] = useState\(false\);/.test(page));
  assert.ok(/s\.key === 'order_card_defer_payment_prompt'/.test(page) && /s\.key === 'order_card_save_after_item_delete'/.test(page));
});
await t('handleOrderUpdate: כבוי = אותם שני שינויים מילה במילה (טאב תשלומים + חלונית השלמת תשלום); דולק = רק דגל', () => {
  const blk = between(page, 'if (freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01) {\n        if (deferPaymentPrompt) {', 'const handleTabChange');
  assert.ok(/if \(deferPaymentPrompt\) \{[^}]*setDeferredDebtPrompt\(true\);\s*\} else \{\s*setActiveTab\('payments'\);\s*setPaymentContinueAmount\(freshDebtNow\);\s*\}/.test(blk));
  assert.ok(/if \(enableEditSummaryConfirm\) \{\s*const freshRequired/.test(page), 'עדיין רק כש-enable_order_edit_summary_confirm (נווה יעקב)');
});
await t('מעבר לשונית: חלונית רק כשיש חיוב ממתין ויוצאים מהפריטים; מעבר לתשלומים בעצמה לא פותח כלום', () => {
  const fn = between(page, 'const handleTabChange = (tab) => {', 'const openDeferredPayment');
  assert.ok(/if \(deferredDebtPrompt && tab !== 'items'\)/.test(fn));
  assert.ok(/if \(tab !== 'payments' && debtNow > 0\) setPaymentContinueAmount\(debtNow\);/.test(fn));
  assert.ok(/setActiveTab\(tab\);\s*\};/.test(fn));
  assert.ok(/onTabChange=\{handleTabChange\}/.test(page) && !/onTabChange=\{setActiveTab\}/.test(page));
});
await t('יציאה מההזמנה: חלונית תשלום פעם אחת ונשארים; בלי דגל - הקוד הישן', () => {
  const head = between(page, 'const handleExit = async (destinationHref) => {', 'const fallbackExitHref');
  assert.ok(/if \(deferredDebtPrompt\) \{\s*setDeferredDebtPrompt\(false\);/.test(head), 'הדגל מאופס לפני - יציאה שנייה עוברת');
  assert.ok(/if \(debtOnExit > 0\) \{\s*setActiveTab\('payments'\);\s*setPaymentContinueAmount\(debtOnExit\);\s*return;/.test(head));
});
await t('הודעת החיוב בטאב הפריטים: רק עם הדגל והחוב; כפתורים "לתשלום עכשיו" ו"הוספת פריט נוסף" (addItem מ-ModernItemsManager)', () => {
  assert.ok(/\{deferredDebtPrompt && \(Math\.round\(\(totalRequired - totalPaid\) \* 100\) \/ 100\) > 0 && \(/.test(page));
  assert.ok(page.includes('onClick={openDeferredPayment}>לתשלום עכשיו</button>') && page.includes('itemsManagerRef.current?.addItem()'));
  assert.ok(/addItem: \(\) => handleAddItem\(\)/.test(mim));
});
await t('מחיקת פריט: onItemDeleted רק למחיקה (לא שחזור) של פריט שכבר נשמר (יש id), אחרי אישור המחיקה; מועבר לכרטיס רק כשההגדרה דולקת', () => {
  const del = between(mim, 'const toggleDeleted = async (index) => {', 'const handleAddItem');
  assert.ok(/const confirmed = await window\.customConfirm\(/.test(del) && /if \(!confirmed\) return;\s*handleItemChange\(index, 'isDeleted', !isCurrentlyDeleted\);/.test(del), 'חלון "בטוח למחוק" נשאר');
  assert.ok(/if \(!isCurrentlyDeleted && item\.id && onItemDeleted\) onItemDeleted\(item\);/.test(del));
  assert.ok(/onItemDeleted=\{saveAfterItemDelete \? \(\) => setAutoSaveAfterDelete\(true\) : undefined\}/.test(page));
});
await t('שמירה אוטומטית אחרי מחיקה = handleSave הרגיל פעם אחת (אחרי רינדור שכולל את הפריט המחוק); חלון הבנק נפתח מהמסלול הקיים', () => {
  const eff = between(page, "useEffect(() => {\n    if (!autoSaveAfterDelete) return;", '}, [autoSaveAfterDelete]);');
  assert.ok(/setAutoSaveAfterDelete\(false\);\s*if \(handleSaveRef\.current\) handleSaveRef\.current\(null, \{ promptPrint: false \}\);/.test(eff));
  assert.ok(/handleSaveRef\.current = handleSave;/.test(page));
  assert.ok(/newAutoRefundNeedsBank[\s\S]{0,400}openPendingAutoRefundBankModal\(\)/.test(page), 'הפתיחה הקיימת של חלון פרטי הבנק אחרי שמירה (דיווח c22b7de5) נשארה');
});
await t('אין לוגיקת כסף חדשה: בקוד שנוסף אין fetch/PUT/POST/verify-pin - הכול דרך handleSave ו-ModernPaymentsManager הקיימים', () => {
  const added = [
    between(page, 'const handleTabChange = (tab) => {', 'const fallbackExitHref').split('const handleExit')[0],
    between(page, "useEffect(() => {\n    if (!autoSaveAfterDelete) return;", '}, [autoSaveAfterDelete]);'),
    between(page, '{deferredDebtPrompt && (Math.round', '<ModernItemsManager'),
  ].join('\n');
  assert.ok(!/fetch\(|method:|verify-pin|customAuthPrompt|\/api\//.test(added), 'אין בקשות/אישורים בקוד החדש');
});

console.log(`\n${passed} passed${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
