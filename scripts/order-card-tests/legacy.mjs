// "אורקל" של הכרטיס הישן: מחלץ מתוך app/orders/[id]/LegacyOrderPage.js (הקוד החי, לא העתק ידני) את הליטרלים של גופי
// הבקשות - ה-PUT של handleSave ושל handleExit, גוף preview-pricing (האפקט החי + confirmSaveSummaryIfNeeded) וגוף
// validate-inventory - ומחזיר פונקציות שמעריכות אותם על state נתון. אם מישהו ישנה את הישן, הבדיקות יראו את השינוי.
import fs from 'node:fs';
import path from 'node:path';

export const LEGACY_PATH = path.join(process.env.PROJ, 'app/orders/[id]/LegacyOrderPage.js');
export const LEGACY_SRC = fs.readFileSync(LEGACY_PATH, 'utf8');

// מחזיר את הטקסט של האובייקט שמתחיל ב-"{" הראשון אחרי index (ספירת סוגריים, מתעלם ממחרוזות פשוטות)
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

const allIndexes = (src, needle) => { const out = []; let i = -1; while ((i = src.indexOf(needle, i + 1)) !== -1) out.push(i); return out; };

const putCalls = allIndexes(LEGACY_SRC, 'const res = await putOrder(');
if (putCalls.length !== 2) throw new Error(`expected 2 putOrder calls in legacy, found ${putCalls.length}`);
export const LEGACY_SAVE_LITERAL = objectLiteralAt(LEGACY_SRC, putCalls[0]);
export const LEGACY_EXIT_LITERAL = objectLiteralAt(LEGACY_SRC, putCalls[1]);

const previewCalls = allIndexes(LEGACY_SRC, '/preview-pricing`');
if (previewCalls.length !== 2) throw new Error(`expected 2 preview-pricing calls, found ${previewCalls.length}`);
const bodyLiteralAfter = (i) => objectLiteralAt(LEGACY_SRC, LEGACY_SRC.indexOf('body: JSON.stringify(', i));
export const LEGACY_PREVIEW_LIVE_LITERAL = bodyLiteralAfter(previewCalls[0]);
export const LEGACY_PREVIEW_SUMMARY_LITERAL = bodyLiteralAfter(previewCalls[1]);
const validateCall = LEGACY_SRC.indexOf("fetch('/api/orders/validate-inventory'");
if (validateCall < 0) throw new Error('validate-inventory call not found');
export const LEGACY_VALIDATE_LITERAL = bodyLiteralAfter(validateCall);

// eslint-disable-next-line no-new-func
const fn = (params, literal) => new Function(...params, `return (${literal});`);

const saveFn = fn(['currentOrder', 'items', 'obligations', 'payments', 'managerAuthForItemChange', 'orderDateApproval', 'debtApprovedBy'], LEGACY_SAVE_LITERAL);
const exitFn = fn(['order', 'items', 'obligations', 'payments', 'exitDebtApprovedBy'], LEGACY_EXIT_LITERAL);
const previewLiveFn = fn(['items', 'order'], LEGACY_PREVIEW_LIVE_LITERAL);
const previewSummaryFn = fn(['items', 'currentOrder'], LEGACY_PREVIEW_SUMMARY_LITERAL);
const validateFn = fn(['activeItems', 'currentOrder'], LEGACY_VALIDATE_LITERAL);

export const legacySaveBody = (o, s, { managerAuth = null, orderDateApproval = null, debtApprovedBy = null } = {}) =>
  saveFn(o, s.items, s.obligations, s.payments, managerAuth, orderDateApproval, debtApprovedBy);
export const legacyExitBody = (o, s, { debtApprovedBy = null } = {}) => exitFn(o, s.items, s.obligations, s.payments, debtApprovedBy);
export const legacyPreviewLiveBody = (items, order) => previewLiveFn(items, order);
export const legacyPreviewSummaryBody = (items, order) => previewSummaryFn(items, order);
export const legacyValidateBody = (activeItems, order) => validateFn(activeItems, order);

// קוד מקור של פונקציות שלמות מהישן (לבדיקות endpoint ממוקדות)
export function legacyFunctionSource(name) {
  const i = LEGACY_SRC.indexOf(`const ${name} = async`);
  if (i < 0) throw new Error(`legacy function ${name} not found`);
  return objectLiteralAt(LEGACY_SRC, LEGACY_SRC.indexOf('=>', i));
}
