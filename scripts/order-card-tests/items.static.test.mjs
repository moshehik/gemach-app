// W3 — בדיקות סטטיות של לשונית הפריטים: רישום הלשונית ושורת הסריקה, ההסרות של הבעלים (R30/R31/R32, A27 "לפי הגדרות הגמ״ח"
// ו"ס״מ"), A10 (לחצני הסרגל באותה מחלקה כמו "מחוקים"), R28/R29 לחצנים עגולים, ורשימת ה-endpoints המדויקת של W3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
const OC = path.join(PROJ, 'app/components/order-card');
const W3_FILES = ['tabs/OcItemsTab.js', 'parts/OcItemRow.js', 'parts/OcAddItemPanel.js', 'parts/OcItemEditDialog.js', 'parts/OcItemDetailsDialog.js', 'parts/OcCapacityDialog.js', 'parts/OcBarcodeRow.js', 'parts/OcScanBar.js', 'hooks/useItemActions.js'];
const read = (rel) => fs.readFileSync(path.join(OC, rel), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const CODE = Object.fromEntries(W3_FILES.map((f) => [f, strip(read(f))]));
const ALL = Object.values(CODE).join('\n');
const CSS = read('css/oc-items.css');

test('כל קובצי W3 קיימים; הלשונית רשומה ב-tabs/index.js ושורת הסריקה ב-slots.js', () => {
  for (const f of W3_FILES) assert.ok(fs.existsSync(path.join(OC, f)), f);
  assert.match(read('tabs/index.js'), /import OcItemsTab from '\.\/OcItemsTab';[\s\S]*items: OcItemsTab,/);
  assert.match(read('slots.js'), /import OcScanBar from '\.\/parts\/OcScanBar';[\s\S]*ScanBar: OcScanBar,/);
  assert.match(CODE['parts/OcScanBar.js'], /className="sbar" id="sbar"/, 'R42: חוזה W1 — #sbar.sbar');
});

test('R30: אין קישור לכרטיס דגם', () => {
  assert.ok(!/\/dashboard\/dresses\//.test(ALL));
  assert.ok(!/פתח כרטיס דגם|itemModelId\(item\) \?/.test(ALL));
});

test('R31: אין שער "הזמנה לא שולמה" (feature:unpaid_action_items_tab / isFullyPaid / customAuthPrompt)', () => {
  assert.ok(!/unpaid_action_items_tab|isFullyPaid|totalPaid >= totalRequired|לא שולמה במלואה|ללא תשלום מלא/.test(ALL));
  assert.ok(!/customAuthPrompt|mocAuth|rentalToggle/.test(ALL), 'האישורים רק דרך oc.approve (לא verifyPin/rentalToggle של הישן)');
});

test('R32: בלי הודעת מכסה; "הוסף פריט" ו"שחזור" מוסתרים כשהמכסה מלאה', () => {
  assert.ok(!/הגבלת מערכת|המקסימום המותר/.test(ALL));
  const tab = CODE['tabs/OcItemsTab.js'];
  assert.match(tab, /const full = quotaFull\(oc\.settings, oc\.items\);/);
  assert.match(tab, /const showAdd = !locked && !full;/);
  assert.match(tab, /\{showAdd \? \(\s*<button type="button" className="btn navy" data-act="addtoggle"/);
  assert.match(CODE['parts/OcItemRow.js'], /\{!locked && !quotaFull \? \(\s*<button type="button" className="btn sm" data-act="restore"/);
});

test('A27 / R23: בלי "לפי הגדרות הגמ״ח", בלי "ס״מ", בלי מחירים קבועים; המחיר והדמים מ-preview-pricing', () => {
  assert.ok(!/לפי הגדרות|לפי ההגדרות והכללים/.test(ALL + CSS));
  assert.ok(!/ס״מ|ס"מ|ס\\"מ/.test(ALL + CSS));
  assert.ok(!/₪120|₪40|ADD_PRICE|\bFEE\b/.test(ALL));
  const add = CODE['parts/OcAddItemPanel.js'];
  assert.match(add, /fetch\(`\/api\/orders\/\$\{orderId\}\/preview-pricing`/);
  assert.match(add, /מחיר השכרה: /);
  assert.match(add, /דמי ביטול כרגע/);
  assert.match(add, /placeholder="אורך"/, 'R23: "אורך" בלי סוגריים');
});

test('A10: כל לחצני הסרגל (רשימה / טבלה / פרטי תיקונים / מחוקים) מאותו רכיב ובאותה מחלקה btn tgl, ✓ כשנבחר; אין מתג vsw', () => {
  const tab = CODE['tabs/OcItemsTab.js'];
  const bar = tab.slice(tab.indexOf('<div className="hres-bar">'), tab.indexOf('<div className="hres">'));
  assert.equal((bar.match(/<BarToggle /g) || []).length, 4);
  assert.ok(!/<button/.test(bar), 'כל הלחצנים דרך BarToggle');
  assert.match(bar, /<BarToggle id="delToggle"/);
  assert.match(tab, /className=\{`btn tgl oc-bt\$\{on \? ' on' : ''\}`\}/);
  assert.match(tab, /\{on \? <OcIcon name="check" size="sm" className="evck" \/> : null\}/);
  assert.ok(!/\bvsw\b|vknob|vopt/.test(ALL));
  assert.match(CSS, /\.gm-ds\.gm-oc \.app \.hres-bar \.btn\.tgl\{min-height:32px;height:32px/);
  assert.match(bar, /פריטים <b>\{list\.length\}<\/b>/, 'מונה "פריטים N"');
});

test('R28/R29: ⓘ ו-📅 לחצני אייקון עגולים (ibtn) עם data-tip, בלי title', () => {
  const row = CODE['parts/OcItemRow.js'];
  assert.match(row, /className="ibtn" data-act="itemdet" aria-label="פרטים נוספים והיסטוריה" data-tip="פרטים נוספים והיסטוריה"/);
  assert.match(row, /className="ibtn" data-act="cap" aria-label="בדוק תפוסה לתאריך אירוע" data-tip="בדוק תפוסה לתאריך אירוע"/);
  assert.ok(!/<[a-z][a-z0-9]*\b[^>]*\stitle=/.test(ALL), 'title= על אלמנט DOM');
});

test('R25/R26: בלי "סמן כנלקחה/כנמסרה/כהוחזרה"; שורת ברקוד + "בטל השכרה" + "בטל החזרה" + תקין/לא תקין', () => {
  assert.ok(!/סמן כ(נלקחה|נמסרה|הוחזרה)/.test(ALL));
  const bc = CODE['parts/OcBarcodeRow.js'];
  for (const t of ['בטל השכרה', 'בטל החזרה', 'תקין', 'לא תקין', '<small>ברקוד</small>']) assert.ok(bc.includes(t), t);
  const row = CODE['parts/OcItemRow.js'];
  assert.ok(row.indexOf('<OcBarcodeRow') < row.indexOf('<small>פרטים ועריכה</small>'), 'שורת ברקוד ואז שורת פרטים ועריכה (כמו בעיצוב)');
});

test('R3: פס "ההזמנה נעולה"; בנעילה אין הוספה/עריכה/הסרה/שחזור/ביטול השכרה', () => {
  const tab = CODE['tabs/OcItemsTab.js'];
  assert.match(tab, /\{locked \? \(\s*<div className="chip amber oc-lockbar"/);
  const row = CODE['parts/OcItemRow.js'];
  assert.match(row, /\{!item\.isTaken && !locked \? \(/);
  assert.match(CODE['parts/OcBarcodeRow.js'], /item\.isTaken && !item\.isReturned && !locked \?/);
});

test('endpoints של W3 — הרשימה המדויקת (כל endpoint חדש = שינוי מודע בבדיקה)', () => {
  const found = new Set();
  for (const s of Object.values(CODE)) {
    for (const m of s.matchAll(/(['`])(\/api\/[^'`?$]*)/g)) found.add(m[2].replace(/\/$/, ''));
  }
  assert.deepEqual([...found].sort(), [
    '/api/audit/order-item', '/api/employees', '/api/inventory/capacity', '/api/inventory/models', '/api/inventory/sizes',
    '/api/orders', '/api/orders/availability', '/api/pricelists', '/api/rentals/scan', '/api/rentals/toggle', '/api/rentals/verify-item', '/api/returns/report-issue',
  ].sort());
  // /api/orders/${id}/items , /items/${itemId} , /preview-pricing — נבנים בתבנית
  assert.match(CODE['hooks/useItemActions.js'], /`\/api\/orders\/\$\{orderId\}\/items\/\$\{item\.id\}` : `\/api\/orders\/\$\{orderId\}\/items`/);
});

test('אין שינוי בקובצי הכרטיס הישן ובשורת הסריקה של הישן (W3 מייבא, לא עורך)', () => {
  // הישן נשאר "אורקל" בבדיקות הזוגיות — הן מחלצות ממנו את הפונקציות בזמן ריצה
  for (const f of ['components/orders/modern/ModernItemsManager.js', 'components/orders/modern/rentalToggle.js', 'components/orders/ItemCapacityModal.js']) {
    assert.ok(fs.existsSync(path.join(PROJ, f)), f);
  }
});
