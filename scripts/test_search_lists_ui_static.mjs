// בדיקות סטטיות (קריאת קוד, בלי דפדפן) לחלק ה-UI של שיפורי החיפוש ברשימות: אינדיקציית טווח + הודעות בעמוד ההזמנות, הודעות בלקוחות / דגמים / השכרות,
// מצב ריק עם רמזים, הפעלה במקלדת בשורות החיפוש העליון, קידוד כתובת בייצוא התיקונים, הודעת בוחר הלקוח.
// הרצה: node scripts/test_search_lists_ui_static.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// הערה: בדיקת דפדפן אמיתית (מראה, RTL, יישור) לא נכללת כאן - ר' הדוח.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } }
const has = (src, s, msg) => assert.ok(src.includes(s), msg || `חסר: ${s}`);
const lacks = (src, s, msg) => assert.ok(!src.includes(s), msg || `לא אמור להופיע: ${s}`);

const orders = read('app/orders/page.js');
const customers = read('app/customers/page.js');
const dresses = read('app/dashboard/dresses/page.js');
const rentals = read('app/rentals/page.js');
const notices = read('components/SearchNotices.js');
const topbar = read('app/components/TopbarSearch.js');
const alterations = read('app/alterations/page.js');
const selector = read('components/CustomerSelector.js');
const refunds = read('app/refunds/page.js');
const deliveries = read('app/deliveries/page.js');

t('SearchNotices: שלוש קומפוננטות, role=status, callout קיים', () => {
  has(notices, 'export function SearchNotices'); has(notices, 'export function ScopeNote'); has(notices, 'export function SearchEmptyHint');
  has(notices, 'role="status"'); has(notices, 'callout callout-info');
  lacks(notices, 'useState', 'תצוגתית בלבד');
});
t('הזמנות: אינדיקציית טווח "מוצגות הזמנות עתידיות בלבד" ליד החיפוש בלשונית "בקרוב", עם כפתור "כל התאריכים" שלא מנקה חיפוש', () => {
  has(orders, 'מוצגות הזמנות עתידיות בלבד');
  has(orders, "filterStatus === 'soon'");
  assert.match(orders, /actionLabel="הצג את כל התאריכים"\s+onAction=\{\(\) => \{ setFilterStatus\('all'\); setPage\(1\); \}\}/);
  // האינדיקציה מופיעה אחרי טופס החיפוש ולפני לשוניות הסטטוס
  assert.ok(orders.indexOf('<ScopeNote') > orders.indexOf('className="search-toolbar"'));
  assert.ok(orders.indexOf('<ScopeNote') < orders.indexOf('className="pill-tabs"'));
});
t('הזמנות: הודעות השרת מוצגות ומתעדכנות בשלושת מסלולי הטעינה (מטמון / שרת / מנוי)', () => {
  assert.equal((orders.match(/setSearchNotices\(/g) || []).length, 3, 'שלושה מסלולי טעינה');
  has(orders, '<SearchNotices notices={searchNotices} />');
  has(orders, '!isAiModeActive');
});
t('הזמנות: מצב ריק עם רמזים (שם / מספר / טלפון / ברקוד / תאריך עברי ולועזי)', () => {
  has(orders, 'לא נמצאו הזמנות עבור');
  has(orders, 'תאריך עברי (כז תשרי)'); has(orders, 'תאריך לועזי (5/10)'); has(orders, 'טלפון (בכל צורת כתיבה)');
  has(orders, 'orders.length === 0 && (');
});
t('לקוחות / דגמים / השכרות: הודעות השרת + (לקוחות) מצב ריק עם רמזים', () => {
  has(customers, '<SearchNotices notices={searchNotices} />'); has(customers, 'לא נמצאו לקוחות עבור'); has(customers, '+972');
  assert.equal((customers.match(/setSearchNotices\(/g) || []).length, 2);
  has(dresses, '<SearchNotices notices={searchNotices} />'); assert.equal((dresses.match(/setSearchNotices\(/g) || []).length, 2);
  has(rentals, '<SearchNotices notices={searchNotices} />'); assert.equal((rentals.match(/setSearchNotices\(/g) || []).length, 2);
});
t('חיפוש עליון: שורות התוצאה (role=button) מופעלות גם ב-Enter וברווח', () => {
  has(topbar, "e.key === 'Enter'"); has(topbar, "e.key === ' '"); has(topbar, 'onKeyDown');
  assert.ok(topbar.indexOf('onKeyDown') > topbar.indexOf('role="button"'));
});
t('תיקונים: כתובת הייצוא / ההדפסה מקודדת (encodeURIComponent) בשני המקומות', () => {
  assert.equal((alterations.match(/&search=\$\{encodeURIComponent\(search\)\}/g) || []).length, 2);
  lacks(alterations, '&search=${search}');
});
t('בוחר לקוח: הודעת שרת + רמז במצב ריק', () => {
  has(selector, 'setNotice('); has(selector, 'אפשר לחפש לפי שם (גם שם מלא), טלפון בכל צורה או עיר');
});

t('חובות (refunds): ברקוד של 7 ספרות כבר לא נשלח כטלפון; טלפון לפי classifyQuery', () => {
  has(refunds, "classifyQuery(term).kind === 'phone'");
  lacks(refunds, '/^\\d{7,}$/.test(term)', 'הכלל הישן: 7+ ספרות = טלפון');
});
t('משלוחים: טלפון בכל צורת כתיבה (phoneMatches) בנוסף ל-includes הישן', () => {
  has(deliveries, "import { phoneMatches } from '@/lib/searchNormalize'");
  has(deliveries, 'phoneMatches(r.customerPhone, term)');
  has(deliveries, "(r.customerPhone || '').includes(term)");
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
