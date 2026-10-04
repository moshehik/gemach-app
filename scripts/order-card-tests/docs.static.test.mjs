// W7 (מסמכים): בדיקות סטטיות - חיווט ה-slots, האיסורים של הכרטיס החדש בקבצי W7, והסתרת סוגי הצרופות שאינם קיימים (AMB-11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PROJ = process.env.PROJ;
const OC = path.join(PROJ, 'app/components/order-card');
const read = (f) => fs.readFileSync(path.join(OC, f), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const PARTS = ['parts/OcPrintMenu.js', 'parts/OcMailSheet.js', 'parts/OcMissingEmail.js', 'parts/OcExports.js', 'parts/ocDocsActions.js', 'parts/ocDocsLogic.js'];

test('slots.js: Exports / PrintMenu / QuickMailButton מחוברים לקבצי W7', () => {
  const s = read('slots.js');
  assert.match(s, /import OcExports from '\.\/parts\/OcExports'/);
  assert.match(s, /import OcPrintMenu from '\.\/parts\/OcPrintMenu'/);
  assert.match(s, /import OcQuickMailButton from '\.\/parts\/OcMailSheet'/);
  assert.match(s, /Exports: OcExports,/);
  assert.match(s, /PrintMenu: OcPrintMenu,/);
  assert.match(s, /QuickMailButton: OcQuickMailButton,/);
});

test('הכרטיס לא רושם ORDER_PRINTED (הדפים עצמם רושמים - חוזה W0 §1.5, AMB-20); רק הורדת PDF / ייצוא Excel נרשמים מהכרטיס', () => {
  const all = PARTS.map((f) => strip(read(f))).join('\n');
  assert.ok(!/ORDER_PRINTED/.test(all));
  assert.ok(!/logEvent\(\s*'(?!ORDER_PDF_DOWNLOADED|ORDER_XLSX_EXPORTED)/.test(all));
  assert.match(strip(read('parts/ocDocsActions.js')), /oc\.logEvent\('ORDER_PDF_DOWNLOADED'/);
  assert.match(strip(read('parts/ocDocsActions.js')), /oc\.logEvent\('ORDER_XLSX_EXPORTED'/);
});

test('לחצן המייל המהיר בודק את order_quick_mail_enabled בעצמו (A8)', () => {
  const s = strip(read('parts/OcMailSheet.js'));
  assert.match(s, /if \(!oc\.settings \|\| !oc\.settings\.orderQuickMailEnabled\) return null;/);
});

test('AMB-11 (החלטת הבעלים: לבנות את כולם): כל ששת סוגי הצרופות קיימים ומטופלים - קבלה ותמונות דגמים נבנים מקומית ל-PDF, לא ZIP', () => {
  const logic = strip(read('parts/ocDocsLogic.js'));
  for (const name of ['פרטי ההזמנה', 'תקנון חתום', 'דף תשלומים', 'דף משלוח', 'חשבונית/קבלה', 'תמונות דגמים']) assert.ok(logic.includes(`name: '${name}'`), name);
  assert.ok(!/HIDDEN_MAIL_FILES/.test(logic));
  assert.ok(!/ZIP/.test(strip(read('parts/OcMailSheet.js'))));
  const actions = strip(read('parts/ocDocsActions.js'));
  assert.match(actions, /kind === 'receipt'/);
  assert.match(actions, /kind === 'model-photos'/);
  // התמונות מוטמעות כ-data URI (/api/pdf חוסם רשת) ומוקטנות
  const imgs = strip(read('parts/ocDocsImages.js'));
  assert.match(imgs, /toDataURL\('image\/jpeg'/);
  assert.match(imgs, /createImageBitmap/);
});

test('אישור מנהל במייל דרך oc.approve (feature:customer_email_approval) - לא חלון ישן ולא PIN בקוד', () => {
  const s = strip(read('parts/ocDocsActions.js'));
  assert.match(s, /oc\.approve\('feature:customer_email_approval'/);
  assert.ok(!/customAuthPrompt|verifyPin|verify-pin/.test(s));
});

test('שער התקנון: נפתח לפני התפריט כשלא נחתם ושומר דרך oc.toggleSignature({confirmed:true}) (R7)', () => {
  const s = strip(read('parts/OcPrintMenu.js'));
  assert.match(s, /needsRegulationsGate\(oc\.order\)/);
  assert.match(s, /oc\.toggleSignature\(\{ confirmed: true \}\)/);
  assert.match(s, /okText: 'כן, חתם'/);
});

test('חלון המייל: dismissable:false + סגירה עם אישור "לזרוק את המייל?" בשכבה 2; אין כתובת בלוג/localStorage', () => {
  const s = strip(read('parts/OcMailSheet.js'));
  assert.match(s, /dismissable: false/);
  assert.match(s, /layer: 2/);
  assert.ok(!/localStorage|sessionStorage|console\.(log|info)/.test(s + strip(read('parts/OcMissingEmail.js'))));
});

test('דף הכנה / דף משלוח נפתחים כלשונית חדשה לכתובת הלו״ז עם orderId (printTargetUrl)', () => {
  const s = strip(read('parts/OcPrintMenu.js'));
  assert.match(s, /window\.open\(url, '_blank'\)/);
  assert.match(s, /printTargetUrl\(item, orderId\)/);
});
