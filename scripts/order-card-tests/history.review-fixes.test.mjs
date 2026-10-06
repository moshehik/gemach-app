// W6 — תיקוני הסקירה העצמאית ב-lib/history/orderHistory.js: D6 לא מסתיר את המצב הסופי של הפעלה-וכיבוי מהירים (בוצע / בוטל / בוצע
// בתוך 5 שניות על אותה רשומה), D10 אחד-לאחד (שורת audit אחת של EMAIL_FAILED מסבירה כשל EmailLog אחד בלבד), וקטגוריית שורות
// סימון הלו״ז היא קבוע אחד. פונקציות טהורות, 3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildOrderHistory, SCHEDULE_MARK_CAT, ORDER_HISTORY_CATEGORIES, filterByCategory, searchEntries } from '@/lib/history/orderHistory.js';
import { HISTORY_CATEGORIES, ROW_CATEGORY_LABEL, categoryCount, visibleEntries, filterCategories, exportRows } from '@/app/components/order-card/parts/ocHistoryModel.js';

const PROJ = process.env.PROJ;

const ORDER_UUID = '0b6e7f1c-2a3d-4e5f-8a9b-0c1d2e3f4a5b';
const ORDER_NO = 53375;
const ITEM = '33333333-3333-4333-8333-333333333333';
const MARK = '88888888-8888-4888-8888-888888888888';
const T0 = Date.UTC(2026, 8, 23, 7, 0, 0);
let seq = 0;
const row = (over, sec) => ({ id: `r${++seq}`, entityType: 'Order', entityId: ORDER_UUID, action: 'UPDATE', employeeId: 'e1', employeeName: 'רחל כהן', createdAt: new Date(T0 + sec * 1000), changesJson: '{}', ...over });
const feed = (rows, extra = {}) => buildOrderHistory({
  order: { orderId: ORDER_NO, id: ORDER_UUID },
  auditRows: rows,
  items: [{ id: ITEM, sizeText: '38', prefix: 4512, modelName: 'רוז', isDeleted: false }],
  payments: [], refunds: [], obligations: [], emailLogs: extra.emailLogs || [], printVisits: [], customers: [],
});
const texts = (r) => r.entries.map((e) => e.text); // newest first

const markChanges = (to) => JSON.stringify({ orderId: ORDER_NO, scheduleStage: 'הכנה', scheduleDay: '2026-10-05', done: { from: to ? null : true, to } });
const mark = (action, sec) => row({ entityType: 'ScheduleStageMark', entityId: MARK, action, changesJson: markChanges(action === 'SCHEDULE_STAGE_DONE') }, sec);

test('D6: סימון בוצע / בוטל / בוצע בתוך 5 שניות - שלוש שורות, והפיד מסתיים ב"בוצע" (המצב הסופי)', () => {
  const r = feed([mark('SCHEDULE_STAGE_DONE', 0), mark('SCHEDULE_STAGE_UNDONE', 1), mark('SCHEDULE_STAGE_DONE', 2)]);
  assert.deepEqual(texts(r), ["סומן 'בוצע' בלו״ז · הכנה", "בוטל סימון 'בוצע' בלו״ז · הכנה", "סומן 'בוצע' בלו״ז · הכנה"]);
  assert.equal(r.dedupedBy.D6 || 0, 0);
});

test('D6: עדיין מסיר כפילות אמיתית - אותה שורה פעמיים ברצף על אותה רשומה', () => {
  const r = feed([mark('SCHEDULE_STAGE_DONE', 0), mark('SCHEDULE_STAGE_DONE', 1)]);
  assert.equal(r.entries.length, 1);
  assert.equal(r.dedupedBy.D6, 1);
});

test('D6: השכרה / ביטול השכרה / השכרה, והחזרה / ביטול החזרה / החזרה - שלוש שורות כל אחת, הסוף = המצב הסופי', () => {
  const item = (action, changes, sec) => row({ entityType: 'OrderItem', entityId: ITEM, action, changesJson: JSON.stringify(changes) }, sec);
  const rent = (sec) => item('CONFIRM_RENTAL', { isTaken: { from: false, to: true }, takenDate: { from: null, to: '2026-10-05T07:00:00.000Z' } }, sec);
  const cancelRent = (sec) => item('CANCEL_RENTAL', { isTaken: { from: true, to: false } }, sec);
  const ret = (sec) => item('RETURN_RENTAL', { isReturned: { from: false, to: true }, returnedOk: { from: false, to: true } }, sec);
  const cancelRet = (sec) => item('CANCEL_RETURN', { isReturned: { from: true, to: false } }, sec);
  const a = texts(feed([rent(0), cancelRent(1), rent(2)]));
  assert.equal(a.length, 3, a.join(' | '));
  assert.equal(a[0], a[2], 'the newest line is the rental again, not the cancel');
  assert.match(a[1], /בוטלה ההשכרה/);
  const b = texts(feed([ret(10), cancelRet(11), ret(12)]));
  assert.equal(b.length, 3, b.join(' | '));
  assert.match(b[0], /^הוחזר/);
  assert.match(b[1], /בוטלה ההחזרה/);
  assert.equal(b[0], b[2]);
});

const failedRow = (sec) => row({ entityId: String(ORDER_NO), action: 'EMAIL_FAILED', changesJson: JSON.stringify({ type: 'order', subject: 'x', error: 'ETIMEDOUT' }) }, sec);
const logErr = (id, sec) => ({ id, to: 'a@b.c', subject: 's', status: 'error', errorMessage: 'ETIMEDOUT', sentAt: new Date(T0 + sec * 1000) });

test('D10: שורת EMAIL_FAILED אחת מסבירה כשל EmailLog אחד בלבד - כשל שני בחלון נשאר שורה', () => {
  const r = feed([failedRow(0)], { emailLogs: [logErr('m1', 1), logErr('m2', 30)] });
  assert.equal(r.dedupedBy.D10, 1);
  assert.equal(r.entries.filter((e) => e.text === 'שליחת המייל נכשלה').length, 2, 'one from the audit row + one from the unmatched EmailLog');
});

test('D10: אחד-לאחד - שתי שורות audit ושני כשלים בחלון = אין שורות כפולות; כשל בלי audit בכלל נשאר', () => {
  const r = feed([failedRow(0), failedRow(20)], { emailLogs: [logErr('m1', 1), logErr('m2', 21)] });
  assert.equal(r.dedupedBy.D10, 2);
  assert.equal(r.entries.filter((e) => e.text === 'שליחת המייל נכשלה').length, 2);
  const lone = feed([], { emailLogs: [logErr('m3', 5)] });
  assert.equal(lone.entries.filter((e) => e.text === 'שליחת המייל נכשלה').length, 1);
});

test("W6-MARK: קטגוריית שורות סימון הלו״ז = SCHEDULE_MARK_CAT = 'gen' (\"כללי\", קטגוריה חדשה) - לא מסמכים ולא פריטים", () => {
  assert.equal(SCHEDULE_MARK_CAT, 'gen');
  const r = feed([mark('SCHEDULE_STAGE_DONE', 0)]);
  assert.equal(r.entries[0].cat, SCHEDULE_MARK_CAT);
  assert.deepEqual(ORDER_HISTORY_CATEGORIES.find((c) => c[0] === 'gen').slice(0, 2), ['gen', 'כללי']);
  assert.equal(r.counts.categories.gen, 1, 'ספירת הקטגוריה החדשה');
  assert.equal(r.counts.categories.docs, 0, 'לא נספר ב"מסמכים"');
  assert.equal(r.counts.categories.items, 0);
  assert.deepEqual(filterByCategory(r.entries, ['gen']).map((e) => e.text), ["סומן 'בוצע' בלו״ז · הכנה"]);
  assert.deepEqual(filterByCategory(r.entries, ['docs']), []);
  // חיפוש: שם הקטגוריה "כללי" חלק מהטקסט הנחפש
  assert.equal(searchEntries(r.entries, 'כללי').length, 1);
});

test('W6-MARK: מודל הלשונית (סינון / ספירה / תווית שורה / ייצוא Excel-הדפסה) מכיר את "כללי"', () => {
  assert.deepEqual(HISTORY_CATEGORIES.find((c) => c[0] === 'gen').slice(0, 2), ['gen', 'כללי']);
  assert.deepEqual(HISTORY_CATEGORIES.map((c) => c[0]), ORDER_HISTORY_CATEGORIES.map((c) => c[0]), 'אותו סדר ואותן קטגוריות כמו בשרת');
  assert.equal(ROW_CATEGORY_LABEL.gen, 'כללי');
  const r = feed([mark('SCHEDULE_STAGE_DONE', 0), mark('SCHEDULE_STAGE_UNDONE', 60)]);
  assert.equal(categoryCount(r.entries, 'gen'), 2);
  assert.equal(categoryCount(r.entries, 'docs'), 0);
  assert.equal(visibleEntries(r.entries, { selected: ['gen'] }).length, 2);
  assert.equal(visibleEntries(r.entries, { selected: ['docs'] }).length, 0);
  assert.ok(filterCategories(r.entries).some((c) => c[0] === 'gen'), 'הלחצן בתפריט הסינון');
  assert.deepEqual(exportRows(r.entries).map((x) => x['קטגוריה']), ['כללי', 'כללי']);
});

test('W6-MARK: דף ההדפסה / הטבלה מושכים את שם הקטגוריה מאותו מודל ("כללי"), והשרת מקבל category=gen', () => {
  const printPage = fs.readFileSync(path.join(PROJ, 'app/print/order-history/page.js'), 'utf8');
  assert.ok(/HISTORY_CATEGORIES/.test(printPage) && /CAT_NAME/.test(printPage), 'CAT_NAME נבנה מ-HISTORY_CATEGORIES');
  const route = fs.readFileSync(path.join(PROJ, 'app/api/orders/[id]/history/route.js'), 'utf8');
  assert.ok(/ORDER_HISTORY_CATEGORIES\.map\(c => c\[0\]\)/.test(route), 'קטגוריות תקפות נגזרות מהמערך');
  assert.ok(ORDER_HISTORY_CATEGORIES.some((c) => c[0] === 'gen'));
});

// בעלים 2026-10-06: תפריט הסינון מציג רק קטגוריות עם ספירה > 0; בחירה של קטגוריה שהתרוקנה לא משאירה סינון נסתר
test('filterCategories: רק קטגוריות עם שורות; סל נוסף רק כשיש שורה; keep משאיר נבחרת שהחיפוש רוקן; effectiveSelection מתעלם מריקות', async () => {
  const M = await import('@/app/components/order-card/parts/ocHistoryModel.js');
  const e = (cat, text, icon) => ({ id: text, ts: '2026-10-01T10:00:00Z', cat, icon: icon || 'list', text });
  const entries = [e('items', 'נוסף פריט A'), e('items', 'נוסף פריט B'), e('pay', 'תשלום 100'), e('gen', 'הערה', 'list'), e('gen', 'חתימה', 'sig')];
  assert.deepEqual(M.filterCategories(entries).map((c) => c[0]), ['items', 'pay', 'gen', 'sig']);
  assert.deepEqual(M.filterCategories([]).map((c) => c[0]), [], 'הכל אפס - אין קטגוריות (מצב ריק)');
  assert.ok(M.filterCategories(entries).every((c) => M.categoryCount(entries, c[0]) > 0));
  // חיפוש מרוקן קטגוריות - הן נעלמות מהרשימה, אלא אם נבחרו (keep) והן קיימות בכלל
  assert.deepEqual(M.filterCategories(entries, { q: 'תשלום' }).map((c) => c[0]), ['pay']);
  assert.deepEqual(M.filterCategories(entries, { q: 'תשלום', keep: ['items'] }).map((c) => c[0]), ['items', 'pay']);
  assert.deepEqual(M.filterCategories(entries, { q: 'תשלום', keep: ['del'] }).map((c) => c[0]), ['pay'], 'keep של קטגוריה שאין בה שורות בכלל - לא מוצגת');
  // בחירה שהתרוקנה אחרי רענון: מתעלמים ממנה, וההיסטוריה לא נעלמת
  const eff = M.effectiveSelection(entries, ['del', 'pay', 'dates']);
  assert.deepEqual(eff, ['pay']);
  assert.equal(M.visibleEntries(entries, { selected: M.effectiveSelection(entries, ['del']) }).length, entries.length, 'בחירה ריקה אחרי ניפוי = הכל גלוי');
  assert.equal(M.visibleEntries(entries, { selected: ['del'] }).length, 0, 'בלי ניפוי הבחירה הנסתרת הייתה מסתירה הכל');
  // סמן הכל = רק הקטגוריות הגלויות
  const allKeys = M.filterCategories(entries).map((c) => c[0]);
  assert.ok(!allKeys.includes('del') && !allKeys.includes('dates') && !allKeys.includes('docs'));
});

test('OcHistoryFeed: תפריט הסינון - effectiveSelection לתג/כפתורים/סמן הכל; מצב ריק במקום תפריט ריק; ניפוי בחירה ישנה', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(path.join(process.env.PROJ, 'app/components/order-card/parts/OcHistoryFeed.js'), 'utf8');
  assert.match(src, /const effSel = useMemo\(\(\) => effectiveSelection\(all, sel\), \[all, sel\]\);/);
  assert.match(src, /filterCategories\(all, \{ q, keep: effSel \}\)/);
  assert.match(src, /visibleEntries\(all, \{ selected: effSel, q \}\)/);
  assert.match(src, /useEffect\(\(\) => \{ if \(effSel\.length !== sel\.length\) setSel\(effSel\); \}/);
  assert.match(src, /allKeys\.every\(\(k\) => effSel\.includes\(k\)\)/);
  assert.match(src, /\{effSel\.length \|\| ''\}/);
  assert.match(src, /\{!cats\.length \? <div className="empty" role="status">אין רישומים לסינון<\/div> : null\}/);
  assert.match(src, /\{cats\.length \? <div className="hf-all">/);
});
