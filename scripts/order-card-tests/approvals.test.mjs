// D7 / D8 (בעלים 2026-10-05): חלון האישור (OcApproval, כהה) בוחר מאשר מרשימה נגללת נפתחת של המורשים (לא כל השמות כשורות);
// מחיקת תשלום / ביצוע זיכוי = ההרשאות הקיימות (בלי הרשאות חדשות); יציאה בלי תשלום מלא = מנהל ומעלה כברירת מחדל (feature:payment_exit_approval).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const OC = path.join(PROJ, 'app/components/order-card');
const read = (rel) => fs.readFileSync(path.join(OC, rel), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const META = await import(pathToFileURL(path.join(PROJ, 'lib/permissionsMetadata.js')).href);
const LOGIC = await import(pathToFileURL(path.join(OC, 'orderCardLogic.js')).href);
const PAY = fs.readFileSync(path.join(OC, 'hooks/usePaymentActions.js'), 'utf8');

test('D7: בורר המאשר הוא combobox נפתח עם רשימה נגללת (.advlist) - לא כל המורשים כשורות/צ׳יפים על המסך', () => {
  const src = strip(read('OcApproval.js'));
  assert.match(src, /role="combobox"/);
  assert.match(src, /aria-haspopup="listbox"/);
  assert.match(src, /className="advlist"[^>]*role="listbox"|role="listbox"[^>]*className="advlist"/);
  assert.match(src, /role="option"/);
  assert.ok(!/oc-emps/.test(src), 'אין עוד רשימת שורות קבועה (oc-emps)');
  assert.ok(!/className=\{`opt\$\{/.test(src), 'אין כרטיסי .opt לכל עובד');
  // הרשימה לא מוצגת עד שנפתחת
  assert.match(src, /\{open \? \(\s*<ul className="advlist"/);
  // המקור: מסנן ההרשאות הקיים, אותו verify-pin
  assert.match(src, /filterApprovers\(all, level\.pickerLevel\)/);
  assert.match(src, /\/api\/auth\/verify-pin/);
  // מקלדת + Esc סוגר רק את הרשימה
  for (const k of ['ArrowDown', 'ArrowUp', 'Escape', 'Enter']) assert.ok(src.includes(`'${k}'`), k);
  assert.match(strip(read('OcUi.js')), /data-oc-esc'\) === 'own' && ae\.getAttribute\('aria-expanded'\) === 'true'\) return;/);
});

test('D7: גובה הרשימה נגלל (max-height מהפלטה), והבורר מעוצב ב-oc-base.css', () => {
  const pal = fs.readFileSync(path.join(PROJ, 'design-system/components.css'), 'utf8');
  assert.match(pal, /\.gm-ds \.advlist\{[^}]*max-height:\d+px;overflow-y:auto/);
  const css = read('css/oc-base.css');
  assert.match(css, /\.oc-appr-sel\{[^}]*min-height:52px/);
  assert.match(css, /\.oc-appr-pick\{position:relative\}/);
});

test('D7/D8: החלון כהה (dlg-dark על שורש הכרטיס, שכבה 2) - אותו OcApproval לכל האישורים', () => {
  assert.match(read('OrderCardA5.js'), /gm-ds gm-oc home-bg dlg-dark/);
  assert.match(read('OcApproval.js'), /OcApprovalDialog\.ocLayer = 2;/);
  assert.match(read('useOrderCardController.js'), /openDialog\(OcApprovalDialog, \{ kind, reason, orderId[^}]*\}, \{ layer: 2/);
});

test('D7: מחיקת תשלום וביצוע זיכוי = ההרשאה הקיימת feature:manual_payment_credit_add (בלי הרשאות חדשות בקטלוג)', () => {
  assert.equal(PAY.match(/export const PAYMENT_DELETE_APPROVAL_KEY = (\w+);/)[1], 'MANUAL_PAYMENT_CREDIT_KEY');
  assert.equal(PAY.match(/export const REFUND_EXECUTE_APPROVAL_KEY = (\w+);/)[1], 'MANUAL_PAYMENT_CREDIT_KEY');
  const item = META.getCatalogItem('feature:manual_payment_credit_add');
  assert.ok(item && item.approver === true, 'ההרשאה קיימת בקטלוג וגם פריט מאשר');
  assert.ok(!META.PERMISSION_CATALOG.some((i) => /payment_delete|refund_execute/.test(i.key)), 'לא נוצרו הרשאות חדשות לשתי הפעולות');
  // הרשימה בחלון = אותם מורשים של ההרשאה (approvals[key])
  const emps = [{ id: 'a', approvals: { 'feature:manual_payment_credit_add': true } }, { id: 'b', approvals: {} }, { id: 'c' }];
  assert.deepEqual(LOGIC.filterApprovers(emps, 'feature:manual_payment_credit_add').map((e) => e.id), ['a']);
});

test('D8: feature:payment_exit_approval - ברירת מחדל מנהל ומעלה (הנהלה ראשית 0, מנהל 1, מתכנת 2); שאר הדרגות סגורות; שאר פריטי המאשר נשארים סגורים', () => {
  const item = META.getCatalogItem('feature:payment_exit_approval');
  assert.ok(item && item.approver === true);
  for (const r of [0, 1, 2]) assert.equal(META.defaultValueForRoleId(item, r, {}), true, `role ${r}`);
  for (const r of [3, 4, 5, 6, 7, 8, 9, 10]) assert.equal(META.defaultValueForRoleId(item, r, {}), false, `role ${r}`);
  const other = META.getCatalogItem('feature:item_change_approval');
  for (const r of [1, 3]) assert.equal(META.defaultValueForRoleId(other, r, {}), false, 'פריטי מאשר אחרים עדיין סגורים כברירת מחדל');
});
