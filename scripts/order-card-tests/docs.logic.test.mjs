// W7 (מסמכים): הלוגיקה הטהורה של תפריט ההדפסה, שער התקנון, קבצי המייל, ייצוא Excel ודף התשלומים - מול הכרטיס הישן (components/orders/OrderPrintMenu.js,
// קפוא) כשאפשר: ביטוי המייל, כתובת ההדפסה וצורת גוף בקשת המייל נשלפים מהמקור החי של הישן ומושווים. עברית בלבד בכל תאריך (ENG-11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const D = await L('app/components/order-card/parts/ocDocsLogic.js');
const legacy = fs.readFileSync(path.join(PROJ, 'components/orders/OrderPrintMenu.js'), 'utf8');

const ORDER = { orderId: 53375, hasSignedRegulations: true, isDelivery: false, deliveryDirection: null, customer: { id: 'c1', firstName: 'מרים', lastName: 'אברמוביץ', email: 'miriam@example.com', phone1: '050-7123456' } };

// ---------- כתובת מייל ----------
test('isValidEmail = הביטוי של handleEmailSubmit בישן (אותה החלטה על כל קלט)', () => {
  const m = legacy.match(/const emailRegex = (\/.*\/);/);
  assert.ok(m, 'הביטוי נמצא בישן');
  const re = eval(m[1]); // eslint-disable-line no-eval -- ביטוי רגולרי מילולי מקובץ קפוא של הריפו (לא קלט חיצוני)
  const samples = ['a@b.co', ' a@b.co ', 'a@b', 'a b@c.com', '@x.com', 'x@.com', 'miriam@example.com', '', '   ', 'abc', 'a@@b.com', 'שלום@דוגמה.קום', 'a@b.c', 'a.b+c@d-e.org'];
  for (const s of samples) assert.equal(D.isValidEmail(s), re.test(s.trim()), JSON.stringify(s));
  assert.equal(D.isValidEmail(null), false);
  assert.equal(D.isValidEmail(undefined), false);
});

test('hasUsableEmail / orderEmailOf / customerNameOf', () => {
  assert.equal(D.hasUsableEmail(ORDER), true);
  assert.equal(D.hasUsableEmail({ customer: { email: '  ' } }), false);
  assert.equal(D.hasUsableEmail({ customer: { email: 'no-at-sign' } }), false);
  assert.equal(D.hasUsableEmail({}), false);
  assert.equal(D.orderEmailOf({ customer: { email: ' a@b.co ' } }), 'a@b.co');
  assert.equal(D.customerNameOf(ORDER), 'מרים אברמוביץ');
  assert.equal(D.customerNameOf({}), 'הלקוח');
});

// ---------- תפריט ההדפסה (R6/A3/A4) ----------
test('כתובת ההדפסה של סיכום/השכרה זהה לישן (openPrint): /print/order?orderId=N&type=…', () => {
  assert.ok(legacy.includes('`/print/order?orderId=${order.orderId}&type=${type}`'));
  assert.equal(D.printOrderUrl(53375, 'order'), '/print/order?orderId=53375&type=order');
  assert.equal(D.printOrderUrl(53375, 'rental'), '/print/order?orderId=53375&type=rental');
  assert.equal(D.printOrderUrl(53375, 'whatever'), '/print/order?orderId=53375&type=order');
});

test('שורות התפריט: סדר ותוויות R6 (סיכום · השכרה · דף הכנה · דף משלוח · שליחה במייל · מייל השכרה); דף משלוח רק עם משלוח הלוך ו-enable_deliveries', () => {
  const settingsOn = { enableDeliveries: true };
  const noDel = D.printMenuItems({ order: ORDER, settings: settingsOn });
  assert.deepEqual(noDel.map((i) => i.key), ['order', 'rental', 'prep', 'mail-order', 'mail-rental']);
  assert.deepEqual(noDel.map((i) => i.label), ['הדפסת סיכום ללקוח', 'הדפסת דף השכרה', 'דף הכנה למחסן', 'שליחה במייל', 'מייל השכרה']);
  const withDel = D.printMenuItems({ order: { ...ORDER, isDelivery: true, deliveryDirection: 'הלוך-חזור' }, settings: settingsOn });
  assert.deepEqual(withDel.map((i) => i.key), ['order', 'rental', 'prep', 'delivery', 'mail-order', 'mail-rental']);
  assert.equal(withDel.find((i) => i.key === 'delivery').label, 'דף משלוח');
  // null direction על משלוח = הלוך-חזור (כלל הלו״ז) → יש הלוך
  assert.ok(D.printMenuItems({ order: { ...ORDER, isDelivery: true, deliveryDirection: null }, settings: settingsOn }).some((i) => i.key === 'delivery'));
  // משלוח חזור בלבד: אין תעודת הלוך
  assert.ok(!D.printMenuItems({ order: { ...ORDER, isDelivery: true, deliveryDirection: 'חזור' }, settings: settingsOn }).some((i) => i.key === 'delivery'));
  // משלוחים כבויים בהגדרות
  assert.ok(!D.printMenuItems({ order: { ...ORDER, isDelivery: true, deliveryDirection: 'הלוך' }, settings: { enableDeliveries: false } }).some((i) => i.key === 'delivery'));
  assert.ok(!D.printMenuItems({ order: { ...ORDER, isDelivery: true }, settings: undefined }).some((i) => i.key === 'delivery'));
});

test('הרשאות (access): בלי page:schedule נעלמים דף ההכנה והמשלוח; undefined = עוד לא ידוע = מוצג; השרת אוכף', () => {
  const o = { ...ORDER, isDelivery: true, deliveryDirection: 'הלוך' };
  const s = { enableDeliveries: true };
  const keys = (access) => D.printMenuItems({ order: o, settings: s, access }).map((i) => i.key);
  assert.deepEqual(keys({}), ['order', 'rental', 'prep', 'delivery', 'mail-order', 'mail-rental']);
  assert.deepEqual(keys({ prep: false, delivery: false }), ['order', 'rental', 'mail-order', 'mail-rental']);
  assert.deepEqual(keys({ prep: true, delivery: false }), ['order', 'rental', 'prep', 'mail-order', 'mail-rental']);
  assert.deepEqual(D.accessFromResponse(403, null), { prep: false, delivery: false });
  assert.deepEqual(D.accessFromResponse(401, null), { prep: false, delivery: false });
  assert.deepEqual(D.accessFromResponse(200, { allowed: ['PP-07', 'PP-01'], forbidden: ['PP-12'] }), { prep: true, delivery: false });
  assert.deepEqual(D.accessFromResponse(500, null), {});
  assert.deepEqual(D.accessFromResponse(200, {}), {});
});

test('printTargetUrl: דף הכנה = PP-07 גרסה ב׳ עם orderId, דף משלוח = PP-12 עם orderId; פריטי מייל אינם כתובת', () => {
  const items = Object.fromEntries(D.printMenuItems({ order: { ...ORDER, isDelivery: true }, settings: { enableDeliveries: true } }).map((i) => [i.key, i]));
  assert.equal(D.printTargetUrl(items.order, 53375), '/print/order?orderId=53375&type=order');
  assert.equal(D.printTargetUrl(items.rental, 53375), '/print/order?orderId=53375&type=rental');
  assert.equal(D.printTargetUrl(items.prep, 53375), '/schedule/print/PP-07?orderId=53375&version=PP-07%3Ab');
  assert.equal(D.printTargetUrl(items.delivery, 53375), '/schedule/print/PP-12?orderId=53375');
  assert.equal(D.printTargetUrl(items['mail-order'], 53375), null);
});

test('שער התקנון (R7): נדרש כשהלקוח לא חתם', () => {
  assert.equal(D.needsRegulationsGate({ hasSignedRegulations: false }), true);
  assert.equal(D.needsRegulationsGate({}), true);
  assert.equal(D.needsRegulationsGate(null), true);
  assert.equal(D.needsRegulationsGate({ hasSignedRegulations: true }), false);
});

// ---------- קבצי המייל (A8, AMB-11) ----------
test('קבצי המייל המהיר: ארבעה מסמכים קיימים; חשבונית/קבלה ו-ZIP תמונות מוסתרים (AMB-11); סוגי kind מתוך הרשימה של W0', async () => {
  const { EMAIL_ATTACHMENT_KINDS } = await L('lib/history/orderEvents.js');
  assert.deepEqual(D.MAIL_FILES.map((f) => f.id), ['ord', 'reg', 'pay', 'del']);
  assert.deepEqual([...D.HIDDEN_MAIL_FILES], ['inv', 'img']);
  for (const f of D.MAIL_FILES) assert.ok(EMAIL_ATTACHMENT_KINDS.includes(f.kind), f.kind);
  const names = D.MAIL_FILES.map((f) => f.name).join('|');
  assert.ok(!/חשבונית|קבלה|ZIP|תמונות/.test(names));
  assert.ok(D.MAIL_FILES.every((f) => f.ext === 'PDF'));
});

test('mailFilesFor: תקנון חתום רק כשנחתם, דף משלוח רק עם משלוח הלוך ו-enable_deliveries', () => {
  const byId = (o, s) => Object.fromEntries(D.mailFilesFor({ order: o, settings: s }).map((f) => [f.id, f.exists]));
  assert.deepEqual(byId({ ...ORDER, hasSignedRegulations: false }, { enableDeliveries: true }), { ord: true, reg: false, pay: true, del: false });
  assert.deepEqual(byId(ORDER, { enableDeliveries: true }), { ord: true, reg: true, pay: true, del: false });
  assert.deepEqual(byId({ ...ORDER, isDelivery: true, deliveryDirection: 'הלוך' }, { enableDeliveries: true }), { ord: true, reg: true, pay: true, del: true });
  assert.deepEqual(byId({ ...ORDER, isDelivery: true, deliveryDirection: 'הלוך' }, { enableDeliveries: false }), { ord: true, reg: true, pay: true, del: false });
  const miss = D.mailFilesFor({ order: { ...ORDER, hasSignedRegulations: false }, settings: {} });
  assert.equal(miss.find((f) => f.id === 'reg').miss, 'טרם נחתם');
  assert.equal(miss.find((f) => f.id === 'del').miss, 'ללא משלוח');
});

test('quickMailValid: כתובת תקינה + נושא + תוכן, בתוך המגבלות', () => {
  const ok = { to: 'a@b.co', subject: 'נושא', bodyText: 'תוכן' };
  assert.equal(D.quickMailValid(ok), true);
  assert.equal(D.quickMailValid({ ...ok, to: 'x' }), false);
  assert.equal(D.quickMailValid({ ...ok, subject: '  ' }), false);
  assert.equal(D.quickMailValid({ ...ok, bodyText: '' }), false);
  assert.equal(D.quickMailValid({ ...ok, bodyText: 'x'.repeat(D.MAX_QUICK_BODY + 1) }), false);
  assert.equal(D.defaultMailSubject(ORDER), 'הזמנה #53375');
});

test('יעד הקבצים (R8): אותן שלוש אפשרויות כמו הישן, ובדרייב/גם-וגם הערת הרשאת ההורדה', () => {
  assert.deepEqual(D.MAIL_DEST_OPTIONS.map((o) => o.v), ['email', 'drive', 'both']);
  assert.deepEqual(D.MAIL_DEST_OPTIONS.map((o) => o.label), ['צרופה למייל', 'דרייב + שיתוף', 'גם וגם']);
  for (const o of D.MAIL_DEST_OPTIONS) assert.ok(legacy.includes(`label: '${o.label}'`), o.label);
  assert.equal(D.driveModeNote('email'), '');
  assert.match(D.driveModeNote('drive'), /הרשאת הורדה מלאה/);
  assert.match(D.driveModeNote('both'), /דרייב/);
});

test('גוף בקשת המייל: מצב doc = אותם מפתחות כמו sendOrderEmail בישן (+kind בצרופות); מצב quick = quick:{subject,bodyText} בלי pdfBase64', () => {
  const att = [D.extraAttachmentOf({ name: 'a.pdf', base64: 'QQ==', mimeType: 'application/pdf', size: 12 }, 'both')];
  const doc = D.mailRequestBody({ mode: 'doc', email: 'a@b.co', type: 'rental', pdfBase64: 'UERG', attachments: att, sendMode: 'both', approval: { employeeId: 'e1', pin: '1234' } });
  assert.deepEqual(Object.keys(doc).sort(), ['email', 'emailApproverId', 'emailApproverPin', 'extraAttachments', 'pdfBase64', 'sendMode', 'type']);
  // הישן (מילולית): email, type, pdfBase64, extraAttachments, sendMode, emailApproverId, emailApproverPin
  for (const k of ['email', 'type', 'pdfBase64', 'extraAttachments', 'sendMode', 'emailApproverId', 'emailApproverPin']) assert.ok(legacy.includes(k), k);
  assert.equal(doc.type, 'rental');
  assert.deepEqual(doc.extraAttachments[0], { fileName: 'a.pdf', fileContent: 'QQ==', mimeType: 'application/pdf', sizeBytes: 12, dest: 'both', kind: 'file' });
  const noApproval = D.mailRequestBody({ mode: 'doc', email: 'a@b.co', pdfBase64: 'UERG' });
  assert.ok(!('emailApproverId' in noApproval) && !('emailApproverPin' in noApproval));
  assert.equal(noApproval.type, 'order');
  assert.equal(noApproval.sendMode, 'email');

  const q = D.mailRequestBody({ mode: 'quick', email: 'a@b.co', subject: '  נושא  ', bodyText: ' תוכן ', attachments: [], sendMode: 'weird' });
  assert.deepEqual(q.quick, { subject: 'נושא', bodyText: 'תוכן' });
  assert.ok(!('pdfBase64' in q));
  assert.equal(q.sendMode, 'email', 'ערך לא מוכר נופל ל-email');
});

test('צרופת מסמך מערכת: sizeBytes כמו בשרת (3/4 מאורך ה-base64), mimeType PDF, kind וה-dest שנבחר', () => {
  const a = D.docAttachmentOf({ kind: 'delivery', fileName: 'משלוח 5.pdf', base64: 'A'.repeat(400) }, 'drive');
  assert.deepEqual(a, { fileName: 'משלוח 5.pdf', fileContent: 'A'.repeat(400), mimeType: 'application/pdf', sizeBytes: 300, dest: 'drive', kind: 'delivery' });
  assert.equal(D.docAttachmentOf({ kind: 'order-pdf', fileName: 'x.pdf', base64: 'QQ==' }).dest, 'email');
  assert.equal(D.docFileName('order-pdf', 7, 'pdf'), 'הזמנה 7.pdf');
  assert.equal(D.docFileName('rental-pdf', 7, 'pdf'), 'השכרה 7.pdf');
  assert.equal(D.docFileName('delivery', 7, 'pdf'), 'משלוח 7.pdf');
  assert.equal(D.docFileName('payments', 7, 'pdf'), 'תשלומים 7.pdf');
  assert.equal(D.docFileName('xlsx', 7, 'xlsx'), 'הזמנה 7.xlsx');
});

test('טוסט אחרי שליחה: "נשלח ל-… · N קבצים" (כמו הדגימה) + הערת דרייב', () => {
  assert.deepEqual(D.mailSentToast('a@b.co', 0), { big: 'נשלח ל-a@b.co', small: 'ללא קבצים' });
  assert.deepEqual(D.mailSentToast('a@b.co', 1), { big: 'נשלח ל-a@b.co', small: 'קובץ אחד' });
  assert.deepEqual(D.mailSentToast('a@b.co', 3), { big: 'נשלח ל-a@b.co', small: '3 קבצים' });
  assert.equal(D.mailSentToast('a@b.co', 2, 2).small, '2 קבצים · 2 קבצים הועלו לדרייב');
});

// ---------- ייצוא Excel (A1) ----------
const ITEMS = [
  { id: 'i1', dressItem: { dress: { name: '4512' } }, sizeText: '38', finalPrice: 150, isDeleted: false, sleeveAlteration: 1 },
  { id: 'i2', description: 'שמלה כללית', sizeText: '40', price: 120, isDeleted: false, isTaken: true, lengthAlteration: '3' },
  { id: 'i3', dressItem: { dress: { name: '1893' } }, sizeText: '38', price: 100, isDeleted: true },
];
const OBL = [{ id: 'o1', amount: 150, description: 'השכרה 4512', isDeleted: false }, { id: 'o2', amount: '120', description: 'השכרה', isDeleted: false }, { id: 'o3', amount: 40, description: 'נמחק', isDeleted: true }];
const PAY = [{ id: 'p1', amount: 200, paymentMethod: 'מזומן', paymentDate: '2026-09-23T07:18:00.000Z', isDeleted: false, notes: '{"Confirmation":"X1"}' }, { id: 'p2', amount: 999, isDeleted: true }];

test('orderExportSheets: ארבעה גיליונות; מחוקים לא נכללים; סכומים נכונים; תאריכים בעברית בלבד (אין ISO / תאריך לועזי)', () => {
  const order = { ...ORDER, orderDate: '2026-09-23T07:12:00.000Z', eventDate: '2026-10-07T21:00:00.000Z', eventDateHebrew: 'כ״ו תשרי תשפ״ז', isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', notes: 'הערה' };
  const sheets = D.orderExportSheets({ order, items: ITEMS, obligations: OBL, payments: PAY });
  assert.deepEqual(sheets.map((s) => s.sheetName), ['הזמנה', 'פריטים', 'חיובים', 'תשלומים']);
  const sum = Object.fromEntries(sheets[0].rows.map((r) => [r['שדה'], r['ערך']]));
  assert.equal(sum['מספר הזמנה'], 53375);
  assert.equal(sum['לקוח'], 'מרים אברמוביץ');
  assert.equal(sum['תאריך אירוע'], 'כ״ו תשרי תשפ״ז');
  assert.equal(sum['סה״כ לחיוב'], 270);
  assert.equal(sum['סה״כ שולם'], 200);
  assert.equal(sum['יתרה'], 70);
  assert.equal(sum['משלוח'], 'כן · הלוך-חזור · ירושלים');
  assert.equal(sum['חתימה על תקנון'], 'כן');
  assert.equal(sheets[1].rows.length, 2, 'פריט מחוק לא נכלל');
  assert.deepEqual(sheets[1].rows.map((r) => r['דגם']), ['4512', 'שמלה כללית']);
  assert.equal(sheets[1].rows[0]['תיקונים'], 'שרוול');
  assert.equal(sheets[1].rows[1]['תיקונים'], 'אורך 3');
  assert.equal(sheets[1].rows[1]['נלקח'], 'כן');
  assert.equal(sheets[2].rows.length, 2);
  assert.equal(sheets[2].rows[1]['סכום'], 120, 'סכום כמחרוזת נספר כמספר');
  assert.equal(sheets[3].rows.length, 1);
  assert.equal(sheets[3].rows[0]['הערות'], '', 'JSON סליקה לא מיוצא');
  const flat = JSON.stringify(sheets);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(flat), 'אין תאריך ISO');
  assert.ok(!/\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(flat), 'אין תאריך לועזי');
  assert.match(sheets[3].rows[0]['תאריך'], /^[א-ת"״׳' ]+$/);
});

test('orderExportSheets: הזמנה ריקה / בלי לקוח לא קורסת; אירוע חו"ל מציג תקופה עברית', () => {
  const empty = D.orderExportSheets({ order: { orderId: 1 } });
  assert.deepEqual(empty.map((s) => s.rows.length), [13, 0, 0, 0]);
  const abroad = D.orderExportSheets({ order: { ...ORDER, isAbroad: true, fromDate: '2026-10-07T21:00:00.000Z', toDate: '2026-10-14T21:00:00.000Z' } });
  assert.ok(abroad[0].rows.some((r) => r['שדה'] === 'תקופת השכרה' && / – /.test(r['ערך'])));
});

// ---------- דף תשלומים (A8) ----------
test('paymentsPageHtml: עצמאי (צבעים קבועים, בלי משתני ערכת נושא), בורח מ-HTML, בלי JSON סליקה גולמי, תאריך עברי', () => {
  const html = D.paymentsPageHtml({
    order: { ...ORDER, customer: { firstName: '<b>x</b>', lastName: '&' } },
    obligations: OBL,
    payments: [{ amount: 200, paymentMethod: 'אשראי', paymentDate: '2026-09-23T07:18:00.000Z', notes: '{"Confirmation":"AB12","Tashloumim":"3","CardNumber":"4580123456789012"}' }, { amount: 5, isDeleted: true }],
    gmachName: 'גמ"ח <בדיקה>',
  });
  assert.ok(!/var\(--/.test(html), 'בלי משתני ערכת נושא (חלון עצמאי)');
  assert.ok(!html.includes('<b>x</b>') && html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(html.includes('גמ&quot;ח &lt;בדיקה&gt;'));
  assert.ok(html.includes('אישור: AB12'));
  assert.ok(!html.includes('4580123456789012') && !html.includes('CardNumber'), 'פרטי כרטיס לא מודפסים');
  assert.ok(html.includes('₪200'));
  assert.ok(html.includes('יתרה לתשלום:') && html.includes('₪70'));
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(html));
  assert.ok(!html.includes('₪5<'), 'תשלום מחוק לא נספר');
  const empty = D.paymentsPageHtml({ order: ORDER, obligations: [], payments: [] });
  assert.ok(empty.includes('לא התקבלו תשלומים'));
});

// ---------- מייל מהיר: ניקוי בשרת (lib/orderQuickMail.js) והמגבלות בלקוח זהות ----------
test('parseQuickMail: null בלי quick; נושא בשורה אחת (הזרקת כותרות), גוף עם ירידות שורה; חובה שניהם; מחרוזות בלבד; מגבלות', async () => {
  const Q = await L('lib/orderQuickMail.js');
  assert.equal(Q.parseQuickMail(undefined), null);
  assert.equal(Q.parseQuickMail(null), null);
  assert.deepEqual(Q.parseQuickMail({ subject: ' א\r\nBcc: x\u0000 ', bodyText: 'ש\r\nב\u0007' }), { ok: true, subject: 'א Bcc: x', bodyText: 'ש\nב' });
  for (const bad of [{ subject: '', bodyText: 'x' }, { subject: 'x', bodyText: ' ' }, { subject: 5, bodyText: 'x' }, { subject: 'x', bodyText: {} }, 'str', [], 7]) assert.equal(Q.parseQuickMail(bad).ok, false, JSON.stringify(bad));
  const long = Q.parseQuickMail({ subject: 'x'.repeat(500), bodyText: 'y'.repeat(9000) });
  assert.equal(long.subject.length, Q.QUICK_MAIL_MAX_SUBJECT);
  assert.equal(long.bodyText.length, Q.QUICK_MAIL_MAX_BODY);
  assert.equal(D.MAX_QUICK_SUBJECT, Q.QUICK_MAIL_MAX_SUBJECT);
  assert.equal(D.MAX_QUICK_BODY, Q.QUICK_MAIL_MAX_BODY);
});
