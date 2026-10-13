// credit_bank_prompt_auto (ברירת מחדל דולק) + credit_bank_details_required (ברירת מחדל כבוי) - חלון פרטי הבנק האוטומטי בכרטיס החדש והישן.
// בדיקות מקור בלבד (כמו שאר static.test): ברירות המחדל = אפס שינוי, וכל מקום שמקפיץ את החלון מכבד את שתי ההגדרות.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
const read = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').replace(/\r\n/g, '\n');

test('הגדרות הכרטיס החדש: הקפצה notFalse (דולק כשחסר), חובה bool (כבוי כשחסר)', () => {
  const s = read('app/components/order-card/orderCardLogic.js');
  assert.ok(s.includes("creditBankPromptAuto: notFalse('credit_bank_prompt_auto', true)"));
  assert.ok(s.includes("creditBankRequired: bool('credit_bank_details_required', false)"));
});

test('הכרטיס החדש: שמירה ויציאה מכבדות את ההגדרות; חובה חוסם בכל יציאה, אופציונלי רק פעם אחת', () => {
  const f = read('app/components/order-card/orderCardFlows.js');
  assert.ok(f.includes("(st.settings.creditBankPromptAuto || st.settings.creditBankRequired) && needsAutoRefundBank(updatedOrder.refunds || [])"));
  assert.ok(f.includes('st.settings.creditBankRequired || (st.settings.creditBankPromptAuto && !env.flags.bankPromptedOnExit)'));
});

test('חלון הבנק האוטומטי בחובה: בלי "אמלא מאוחר יותר" ובלי סגירה ב-Esc/רקע', () => {
  const a = read('app/components/order-card/hooks/usePaymentActions.js');
  assert.ok(a.includes('dismissable: () => !forced'));
  const d = read('app/components/order-card/dialogs/OcBankDialog.js');
  assert.ok(d.includes('{forced ? null : <DlgBtn kind="ghost"'));
});

test('הכרטיס הישן: אותן שתי הגדרות, וחלון ה-MPM לא נסגר כשחובה', () => {
  const l = read('app/orders/[id]/LegacyOrderPage.js');
  assert.ok(l.includes("useState(true)") && l.includes("'credit_bank_prompt_auto'") && l.includes("'credit_bank_details_required'"));
  assert.ok(l.includes('newAutoRefundNeedsBank && (creditBankPromptAuto || creditBankRequired)'));
  assert.ok(l.includes('newAutoRefundNeedsBank && (creditBankRequired || (creditBankPromptAuto && !bankDetailsPromptedOnExitRef.current))'));
  const m = read('components/orders/modern/ModernPaymentsManager.js');
  assert.ok(m.includes('openAutoRefundBankModal(pending, bankRequired)'));
  assert.ok(m.includes('!isSavingAutoRefundBank && !autoRefundBankForced'));
});
