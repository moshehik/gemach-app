// "אורקל" של האשף הישן: מחלץ מתוך app/orders/new/LegacyNewOrderPage.js (הקוד החי, לא העתק ידני) את הקטעים שבונים את גופי
// הבקשות לשרת ואת כללי ההחלטה, ומחזיר פונקציות שמריצות אותם על קלט נתון. אם מישהו ישנה את הישן, בדיקות ההשוואה יראו את השינוי.
// אותו דפוס כמו scripts/order-card-tests/legacy.mjs (ענף feature/order-card-w1).
import fs from 'node:fs';
import path from 'node:path';
import { paymentApprovalLevelRequiresPrompt, describeItemAlterations, withDefaultAlterationDetails } from '../../lib/newOrderPayments.js';

export const LEGACY_PATH = path.join(process.env.PROJ, 'app/orders/new/LegacyNewOrderPage.js');
export const LEGACY_SRC = fs.readFileSync(LEGACY_PATH, 'utf8').replace(/\r\n/g, '\n');

// הטקסט של האובייקט שמתחיל ב-"{" הראשון אחרי index (ספירת סוגריים, מתעלם ממחרוזות והערות)
export function objectLiteralAt(src, index) {
  const start = src.indexOf('{', index);
  let depth = 0, inStr = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (ch === '\\') { i++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced literal');
}
function must(i, what) { if (i < 0) throw new Error(`legacy: ${what} not found`); return i; }
export const region = (from, to, fromIdx = 0) => {
  const a = must(LEGACY_SRC.indexOf(from, fromIdx), from);
  const b = must(LEGACY_SRC.indexOf(to, a + from.length), to);
  return LEGACY_SRC.slice(a, b);
};
const bodyLiteralAfter = (needle) => objectLiteralAt(LEGACY_SRC, must(LEGACY_SRC.indexOf('body: JSON.stringify(', must(LEGACY_SRC.indexOf(needle), needle)), 'body after ' + needle));
// eslint-disable-next-line no-new-func
const fn = (params, body) => new Function(...params, body);

// --- שמירה: itemsToSave + hokDetailsPayload + payload (executeSaveOrderForList) ---
export const SAVE_REGION = region('const itemsToSave = order.items.map', "const res = await fetch('/api/orders', {");
const saveFn = fn(['order', 'calculatedData', 'settings', 'newCustomer', 'totalAmount', 'finalPaymentsList', 'reservedOrderId', 'draftOrderIdRef', 'force'], SAVE_REGION + '\nreturn payload;');
export const legacySavePayload = (a) => saveFn(a.order, a.calculatedData, a.settings, a.newCustomer, a.totalAmount, a.finalPaymentsList, a.reservedOrderId, { current: a.draftOrderId }, a.force);

// --- גופי בקשות ---
const draftFn = fn(['draftOrderIdRef', 'order', 'totalAmount', 'activeItems'], `return (${bodyLiteralAfter("fetch('/api/orders/draft'")});`);
export const legacyDraftBody = (order, draftOrderId, totalAmount, activeItems) => draftFn({ current: draftOrderId }, order, totalAmount, activeItems);
const calcFn = fn(['order'], `return (${bodyLiteralAfter("fetch('/api/orders/calculate'")});`);
export const legacyCalculateBody = (order) => calcFn(order);
const validateFn = fn(['activeItems', 'proposedOrder', 'draftOrderIdRef'], `return (${bodyLiteralAfter("fetch('/api/orders/validate-inventory'")});`);
export const legacyValidateBody = (activeItems, proposed, draftOrderId) => validateFn(activeItems, proposed, { current: draftOrderId });
const nedarimFn = fn(['cust', 'fullAddress', 'creditCardData', 'paymentAmount', 'orderNumberForCharge', 'getCustomerFullName'], `return (${bodyLiteralAfter("fetch('/api/nedarim'")});`);
const fullAddressFn = fn(['cust'], region('const fullAddress =', '\n') + '\nreturn fullAddress;');
export const legacyNedarimBody = (cust, cc, amount, no, getCustomerFullName) => nedarimFn(cust, fullAddressFn(cust), cc, amount, no, getCustomerFullName);
export const LEGACY_RESERVE_BODY_SRC = bodyLiteralAfter("fetch('/api/orders/reserve'");

// --- הצעת שינוי תאריך (handleDateChangeWithValidation עד בדיקת המלאי) ---
const proposeFn = fn(['order', 'fieldOrUpdates', 'valueIfField', 'alert'], region('const isMulti = typeof fieldOrUpdates', 'const activeItems = order.items.filter') + '\nreturn { proposedOrder };');
export function legacyProposeDateChange(order, f, v) {
  let msg = null;
  const r = proposeFn(order, f, v, (m) => { msg = m; });
  return msg ? { error: msg } : r;
}

// --- פרמטרי preload: האפקט החי והרענון (עם _t) ---
const PRE = 'const queryParams = new URLSearchParams({';
const p1 = must(LEGACY_SRC.indexOf(PRE), 'preload 1');
const preload1 = fn(['order', 'draftOrderIdRef'], LEGACY_SRC.slice(p1, must(LEGACY_SRC.indexOf('fetch(`/api/inventory/preload', p1), 'preload fetch 1')) + '\nreturn queryParams.toString();');
const p2 = must(LEGACY_SRC.indexOf(PRE, p1 + 10), 'preload 2');
const preload2 = fn(['order', 'draftOrderIdRef', 'Date'], LEGACY_SRC.slice(p2, must(LEGACY_SRC.indexOf('fetch(`/api/inventory/preload', p2), 'preload fetch 2')) + '\nreturn queryParams.toString();');
export const legacyPreloadParams = (order, draftOrderId) => preload1(order, { current: draftOrderId });
export const legacyRefreshParams = (order, draftOrderId, t) => preload2(order, { current: draftOrderId }, class { getTime() { return t; } });

// --- הוספה לסל ---
const splitFn = fn(['newItem', 'availableSizes'], region('const unavailable = [];', 'if (validSizes.length === 0)') + '\nreturn { unavailable, validSizes };');
export const legacySplitSizes = (newItem, availableSizes) => splitFn(newItem, availableSizes);
// main שינה את הישן: הפריט נבנה מ-itemToAdd = withDefaultAlterationDetails(newItem, enable_alterations !== 'false') (פירוט ברירת מחדל מהסימונים, 97ea96be).
const addFn = fn(['newItem', 'itemToAdd', 'validSizes', 'prices'], region('const itemsToAdd = validSizes.map(', '\n\n    setOrder(prev') + '\nreturn itemsToAdd;');
export const legacyItemsToAdd = (newItem, validSizes, prices, settings = {}) => addFn(newItem, withDefaultAlterationDetails(newItem, settings.enable_alterations !== 'false'), validSizes, prices);
export const LEGACY_PRICING_URL_SRC = region('fetch(`/api/orders/pricing', '`)') + '`';

// --- תשלום: הרשימה הסופית + תנאי בקשת האישור ---
const LINE_PAMOUNT = region('const pAmount = parseFloat(payment.amount) || 0;', '\n');
const LINE_EXIT = region("const isManagerExitPayment = payment.method === 'יציאה באישור מנהל';", '\n');
const LINE_CREDIT = region("const isCreditCardPayment = payment.method.includes('אשראי')", '\n');
const finalFn = fn(['paymentsList', 'payment'], [LINE_PAMOUNT, LINE_EXIT, region('let finalPayments = [...paymentsList];', 'executeSaveOrderForList(finalPayments);'), 'return finalPayments;'].join('\n'));
export const legacyFinalPayments = (paymentsList, payment) => finalFn(paymentsList, payment);
const cond1 = region('if (isManagerExitPayment || (pAmount > 0 && !isCreditCardPayment))', ' {');
// main העביר את בדיקת הרמה ל-paymentApprovalLevelRequiresPrompt(settings) (lib/newOrderPayments.js) - מועבר כפרמטר לקוד החי.
const approvalFn = fn(['settings', 'payment', 'pAmount', 'paymentApprovalLevelRequiresPrompt'], [LINE_EXIT, LINE_CREDIT, `${cond1} { if (paymentApprovalLevelRequiresPrompt(settings)) { return true; } }`, 'return false;'].join('\n'));
export const legacyPaymentApprovalRequired = (settings, method, amount) => approvalFn(settings, { method }, amount, paymentApprovalLevelRequiresPrompt);

// --- הגדרות / שדות חובה / אמצעי תשלום ---
const pmoSrc = region('const computePaymentMethodOptions = (settingsObj) => {', '\n};\n') + '\n};';
export const legacyComputePaymentMethodOptions = fn([], pmoSrc + '\nreturn computePaymentMethodOptions;')();
const missingFn = fn(['settings'], [
  region('const CUSTOMER_FIELD_ALIASES = {', '\n  };\n') + '\n  };',
  region('const isFieldMandatoryFromPicker = (key) => {', '\n  };\n') + '\n  };',
  region('const getMissingMandatoryCustomerFields = (customerObj) => {', '\n  };\n') + '\n  };',
  'return getMissingMandatoryCustomerFields;'].join('\n'));
export const legacyMissingFields = (settings, customer) => missingFn(settings)(customer);
// main: describeAlterations בישן = describeItemAlterations מ-lib/newOrderPayments.js (ייבוא).
export const legacyDescribeAlterations = describeItemAlterations;

// --- נעילת שלבים (canNavigateToStep) ---
const navFn = fn(['order'], region('const canNavigateToStep = (targetStep) => {', '\n  };\n') + '\n  };\nreturn canNavigateToStep;');
export const legacyCanNavigate = (order, target) => navFn(order)(target);

// --- כל המחרוזות requiredLevel של חלונות האישור בישן ---
export const LEGACY_APPROVAL_LEVELS = [...new Set([...LEGACY_SRC.matchAll(/'(feature:[a-z_]+|הנהלה ראשית)'/g)].map(m => m[1]))].sort();
// --- כל נקודות הקצה שהישן קורא להן (fetch / fetchSharedJson) ---
export const LEGACY_ENDPOINTS = [...new Set([...LEGACY_SRC.matchAll(/fetch(?:SharedJson)?\(\s*[`'](\/api\/[a-z0-9/_-]+)/gi)].map(m => m[1]))].sort();
