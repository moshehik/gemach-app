// בדיקות סטטיות של לשונית התשלומים (W4): ההסרות של הבעלים לא חוזרות, הלחצן המאוחד קיים, חיוב ידני רק אחרי אישור מנהל,
// "חישוב מחדש" רק להנהלה ראשית, הנוסחים שאושרו, והחלונות על ui בלבד. (האיסורים הכלליים של הכרטיס - static.test.mjs של W1.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
const OC = path.join(PROJ, 'app/components/order-card');
const read = (rel) => fs.readFileSync(path.join(OC, rel), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const FILES = ['tabs/OcPaymentsTab.js', 'hooks/usePaymentActions.js', 'dialogs/OcPayDialog.js', 'dialogs/OcCreditDialog.js', 'dialogs/OcBankDialog.js', 'dialogs/OcRefundDialogs.js', 'dialogs/OcManualMoneyDialog.js', 'dialogs/OcPaymentDetails.js'];
const SRC = Object.fromEntries(FILES.map(f => [f, strip(read(f))]));
const ALL = Object.values(SRC).join('\n');
const TAB = SRC['tabs/OcPaymentsTab.js'];
const HOOK = SRC['hooks/usePaymentActions.js'];

test('הלשונית רשומה ב-tabs/index.js (W4 החליף את השורה שלו)', () => {
  const idx = read('tabs/index.js');
  assert.ok(/import OcPaymentsTab from '\.\/OcPaymentsTab';/.test(idx));
  assert.ok(/payments: OcPaymentsTab,/.test(idx));
  assert.ok(!/makeTabPlaceholder\('payments'\)/.test(idx));
});

test('הסרות: R34 (חיוב משלוח ידני), R35 ("הוסף חיוב"/"מחק"/"פרטי חיוב" בכרטיס החיובים), A14/AMB-15 (לוחית/אריח זיכוי, "ביטול זיכוי")', () => {
  assert.ok(!/הוסף חיוב משלוח|addDeliveryObligation|delivery_price/.test(ALL), 'R34');
  assert.ok(!/פרטי חיוב|selectedObligationDetails/.test(ALL), 'R35: פרטי חיוב');
  assert.ok(!/הוסף חיוב|הוספת חיוב/.test(TAB), 'R35: אין "הוסף חיוב" בלשונית - רק בחלון המאוחד');
  const charges = TAB.slice(TAB.indexOf('data-oc-pay="charges"'), TAB.indexOf('data-oc-pay="payments"'));
  assert.ok(!/trash|deleteManualCharge/.test(charges), 'R35: אין מחיקה בכרטיס החיובים');
  assert.ok(!/creditile|CreditWindowTile|זיכוי ביטול זמין לניצול|ביטול זיכוי|credit-undo/.test(ALL), 'A14/AMB-15');
  assert.ok(!/זיכוי לניצול על פריט חלופי/.test(ALL), 'A14: אין בחירת "זיכוי לניצול" (כלל מנוע, לא פעולה)');
});

test('R22: לחצן אחד "חיוב / זיכוי ידני" בתוך "אפשרויות מנהל", ובו חיוב / תשלום נוסף / בקשת זיכוי - בלי כפתורים נפרדים בלשונית', () => {
  assert.equal((TAB.match(/חיוב \/ זיכוי ידני/g) || []).length, 1);
  const mgr = TAB.slice(TAB.indexOf('<details className="coll"'), TAB.indexOf('</details>'));
  assert.ok(mgr.includes('אפשרויות מנהל') && mgr.includes('חיוב / זיכוי ידני') && mgr.includes('onClick={pay.openManual}'));
  assert.ok(!/בקשת זיכוי ללקוח|תשלום נוסף|רישום תשלום/.test(TAB), 'הפעולות עצמן רק בתוך החלון המאוחד');
  const dlg = SRC['dialogs/OcManualMoneyDialog.js'];
  for (const t of ['חיוב / זיכוי ידני', 'הוספת חיוב', 'רישום תשלום נוסף (למשל מזומן)', 'בקשת זיכוי ללקוח']) assert.ok(dlg.includes(t), t);
  assert.ok(/allowPayment \? <DlgBtn icon="cash"/.test(dlg), 'תשלום נוסף רק כש-allow_additional_payment_on_order');
});

test('R35/AMB-16: חיוב ידני (הוספה ומחיקה) רק אחרי אישור feature:manual_charge_add, ורק דרך edit.setObligations (נשמר ב-PUT עם cardVariant)', () => {
  const fn = HOOK.slice(HOOK.indexOf('const openAddCharge = useCallback'), HOOK.indexOf('const openManual = useCallback'));
  const iApprove = fn.indexOf('approve(MANUAL_CHARGE_KEY');
  assert.ok(iApprove > 0);
  assert.ok(fn.indexOf('if (!a) return null;') > iApprove);
  assert.ok(fn.indexOf('openDialog(D.AddCharge') > fn.indexOf('if (!a) return null;'));
  assert.ok(fn.indexOf('actions.addManualCharge(') > iApprove && fn.indexOf('actions.deleteManualCharge(') > iApprove);
  // אין קריאה אחרת להוספת/מחיקת חיוב ידני בשום קובץ של W4
  const outside = ALL.replace(fn, '');
  assert.ok(!/actions\.addManualCharge\(|actions\.deleteManualCharge\(/.test(outside));
  assert.equal(HOOK.match(/MANUAL_CHARGE_KEY = '([^']+)'/)[1], 'feature:manual_charge_add');
  // אין שינוי של חיוב אוטומטי מלבד isDeleted - הפעולות נוגעות רק בשורות isManual חדשות או ב-isDeleted (כלל W1 #5)
  assert.ok(/isNew: true, description, amount: parseFloat\(amount\), isManual: true/.test(HOOK));
});

test('R33: "חישוב מחדש" מוצג רק כש-canRecalc (roleId 0/2 מ-/api/me) ומאושר בחלון', () => {
  assert.ok(/\{pay\.canRecalc \? \(/.test(TAB));
  assert.ok(/canRecalc: canRecalcRole\(roleId\)/.test(HOOK));
  assert.ok(/fetchSharedJson\('\/api\/me'/.test(HOOK));
  const fn = HOOK.slice(HOOK.indexOf('const runRecalc = useCallback'), HOOK.indexOf('const payNow = useCallback'));
  assert.ok(fn.indexOf('ui.confirm(') < fn.indexOf('actions.recalc()'));
});

test('A18/R46: "השאר חוב (באישור מנהל)" רק בחלון התשלום, רק כשנפתח מחוב חדש בשמירה/יציאה, דרך oc.approveDebt עם הסכום', () => {
  assert.ok(!/השאר חוב/.test(TAB), 'אין לחצן כזה בגוף הדף');
  const pay = SRC['dialogs/OcPayDialog.js'];
  assert.ok(/const allowLeaveDebt = source === 'save' \|\| source === 'exit';/.test(pay));
  assert.ok(/\{allowLeaveDebt \? <DlgBtn icon="lock" act="pay-later"/.test(pay));
  assert.ok(/approveDebt\(\{ amount: start \}\)/.test(pay));
  // R14 נוסח: "השינויים נשמרו! נוצר חיוב חדש" + "יש להשלים את הגבייה." + "אטפל בזה בטאב תשלומים"
  for (const t of ['השינויים נשמרו! נוצר חיוב חדש', 'יש להשלים את הגבייה.', 'אטפל בזה בטאב תשלומים']) assert.ok(pay.includes(t), t);
  // אחרי תשלום / אישור - יציאה שנחסמה ממשיכה (R49 יציאה טורית)
  assert.ok(/if \(\(r\.paid \|\| r\.leftDebt\) && ctx\.source === 'exit'\) await continueExit\(ctx\.href\);/.test(HOOK));
  // מאזינים לשני אירועי הבקר
  assert.ok(/subscribe\('debtCreated'/.test(HOOK) && /subscribe\('autoRefundNeedsBank'/.test(HOOK));
});

test('R36: טופס נדרים - שם לקוח, מספר כרטיס, תוקף, תשלומים 1-36, הערות, העברה מהירה, מעקף מתכנת; שער התקנון (R7) לפני אשראי', () => {
  const pay = SRC['dialogs/OcPayDialog.js'];
  for (const t of ['שם לקוח', 'מספר כרטיס אשראי', 'תוקף (MM/YY)', 'תשלומים (1-36)', 'העברה מהירה', 'מעקף מתכנת', 'חתימה על תקנון', 'כן, חתם']) assert.ok(pay.includes(t), t);
  assert.ok(/min=\{1\} max=\{36\}/.test(pay));
  assert.ok(/if \(isCredit && !\(await regsGate\(\)\)\) return;/.test(pay), 'שער התקנון גם בשליחה');
  assert.ok(!/cardNumber[^\n]*console\.|console\.[a-z]+\([^)]*card/i.test(ALL), 'מספר כרטיס לא נרשם ללוג');
});

test('A12/A13/R37/R38/R39: הנוסחים והמבנה מהעיצוב', () => {
  for (const t of ['מצב תשלום', 'נשאר לתשלום', 'זיכוי זמין', 'שולם ', 'מתוך ', 'className="pbar"', 'ממתין לשמירה', 'חיובים', 'מתעדכן אוטומטית', 'תשלומים שהתקבלו', 'הוסף תשלום', 'זיכויים ממתינים', 'אשר ביצוע', 'הזנת פרטי בנק', 'עריכת פרטי בנק', 'ניתן לזכות', 'על פריט חדש עוד', 'פרטים נוספים', 'מחק תשלום']) assert.ok(TAB.includes(t), t);
  assert.ok(SRC['dialogs/OcPaymentDetails.js'].includes('פרטי תשלום מלאים'));
  assert.ok(SRC['dialogs/OcBankDialog.js'].includes('IBAN / מספר חשבון'), 'A15');
  assert.ok(SRC['dialogs/OcCreditDialog.js'].includes('אישור ביצוע זיכוי'));
});

test('סכומים: parseFloat + money2/fmtMoney בתוך <bdi dir="ltr">, בלי שרשור "₪" + מספר גולמי', () => {
  assert.ok(!/['"`]₪['"`]\s*\+|\+\s*['"`]₪/.test(ALL), 'שרשור ₪');
  assert.ok(!/₪\$\{(?!fmtMoney)/.test(ALL.replace(/`[^`]*₪\$\{fmtMoney[^`]*`/g, '')), 'תבנית ₪${…} בלי fmtMoney');
  assert.ok(/export const money2 = \(n\) => Math\.round\(\(parseFloat\(n\) \|\| 0\) \* 100\) \/ 100;/.test(HOOK));
});

test('בלי window.*/alert/confirm, בלי title=, בלי localStorage, בלי AuditLog/events ידניים לכתיבות הכסף', () => {
  assert.ok(!/\bwindow\.(customConfirm|customAuthPrompt|customPrompt|alert|confirm|prompt)\b/.test(ALL));
  assert.ok(!/<[a-z][a-z0-9]*\b[^>]*\stitle=/.test(ALL));
  assert.ok(!/localStorage|sessionStorage/.test(ALL));
  assert.ok(!/logEvent\(|\/api\/orders\/events|auditLog/i.test(ALL), 'תשלומים/זיכויים הם כתיבות מודל - נרשמים אוטומטית');
});
