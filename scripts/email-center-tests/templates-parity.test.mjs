// שוויון פלט: כל תבניות המיילים (lib/emailTemplates.js) בלי עקיפות = בייט-בבייט אותו HTML כמו הגרסה הישנה
// (scripts/email-center-tests/emailTemplates.original.mjs = העתק קפוא של התבניות לפני מרכז המיילים - בעץ האינטגרציה: אחרי order-docs-delivery ו-#276,
//  כלומר כולל בלוק המשלוח (buildDeliverySection), שורת התקנון, כתובת האיסוף וקישור המפות).
// + בדיקות ל-cfg: עקיפת שורה משנה רק את השורה, שדות קבועים משנים כותרת/כותפת, ו-escape של משתנים.
// הרצה: node scripts/email-center-tests/templates-parity.test.mjs   (בלי DB, בלי רשת)
import assert from 'node:assert/strict';
import './alias-register.mjs';
import * as OLD from './emailTemplates.original.mjs';
import * as NEW from '../../lib/emailTemplates.js';
const { buildDeliverySection } = await import('../../lib/orderDelivery.js');

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message.slice(0, 600)); process.exitCode = 1; } };

const G = { gmachName: 'גמ"ח שמלות', gmachAddress: 'רחוב הדוגמה 1, ירושלים', gmachPhone: '02-1234567' };
const orders = [{ orderId: 1, customerName: 'רחל', eventDate: 'כז אלול', itemsCount: 2 }];

// בלוקי משלוח אמיתיים (buildDeliverySection): הלוך-חזור (תצוגת כרטיס), הלוך-חזור בשורות פריט, הלוך בלבד, חזור בלבד, ובלי מחיר
const ON = { enable_deliveries: 'true' };
const dOrder = (over = {}) => ({
  isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', deliveryAddress: 'הרצל 5',
  eventDate: new Date('2026-11-18T00:00:00Z'), customer: {}, obligations: [{ amount: 120, description: 'משלוח הלוך-חזור - ירושלים' }], ...over,
});
const DELIVERY = {
  both: buildDeliverySection(dOrder(), { settings: ON }),
  bothRows: buildDeliverySection(dOrder(), { settings: { ...ON, delivery_as_item_row: 'true' } }),
  outOnly: buildDeliverySection(dOrder({ deliveryDirection: 'הלוך', obligations: [{ amount: 60, description: 'משלוח הלוך - ירושלים' }] }), { settings: ON }),
  backOnly: buildDeliverySection(dOrder({ deliveryDirection: 'חזור', obligations: [{ amount: 60, description: 'משלוח חזור - ירושלים' }] }), { settings: ON }),
  noPrice: buildDeliverySection(dOrder({ obligations: [] }), { settings: { ...ON, delivery_as_item_row: 'true' } }),
  noNotice: buildDeliverySection(dOrder(), { settings: { ...ON, delivery_notice_text: '', delivery_outbound_hours: '', delivery_return_hours: '' } }),
};
const MAPS = 'https://www.google.com/maps/search/?api=1&query=%D7%A6%D7%95%D7%A7%D7%A8%D7%9E%D7%9F%201';

const CASES = {
  renderPasswordResetEmailHtml: [
    { firstName: 'דנה', tempPassword: 'AB12-cd34', triggeredByManager: false, gmachName: G.gmachName, gmachPhone: G.gmachPhone },
    { firstName: 'דנה', tempPassword: 'AB12-cd34', triggeredByManager: true, gmachName: G.gmachName, gmachPhone: '' },
    { firstName: '', tempPassword: 'x', gmachName: 'נווה יעקב' },
  ],
  renderGenericEmailHtml: [
    { title: 'כותרת', bodyText: 'שורה 1\n\nשורה 2 <b>x</b>', ...G, subtitle: 'הודעה חשובה', icon: '📣', footnote: 'הערה', actionButton: { label: 'אישור', url: 'https://x.test/a?b=1&c=2' } },
    { title: 'כותרת', bodyText: 'טקסט', gmachName: 'נווה' },
  ],
  renderOrderCardEmailHtml: [
    { orderId: 5, printType: 'order', customerName: 'רחל כהן', eventDate: 'כז אלול', ...G },
    { orderId: 5, printType: 'rental', customerName: '', eventDate: '', ...G },
    { orderId: 5, printType: 'order', customerName: 'רחל כהן', eventDate: 'כז אלול', hasSignedRegulations: true, ...G },
    { orderId: 5, printType: 'order', customerName: 'רחל כהן', eventDate: 'כז אלול', hasSignedRegulations: true, ...G, delivery: DELIVERY.both },
    { orderId: 5, printType: 'order', customerName: 'רחל כהן', eventDate: 'כז אלול', ...G, delivery: DELIVERY.outOnly, pickupMapsUrl: MAPS },
    { orderId: 5, printType: 'rental', customerName: 'רחל כהן', eventDate: 'כז אלול', ...G, pickupMapsUrl: MAPS },
  ],
  renderOrderConfirmationEmailHtml: [
    { customerName: 'רחל כהן', orderId: 12345, eventDate: 'כז אלול', pickupLine: 'ביום ג', returnLine: 'יום ה', items: [{ name: 'מיכל', size: '38' }, { name: 'נועה', size: '' }], totalCharge: 450, totalPaid: 200, balance: 250, ...G },
    { customerName: '', orderId: 1, items: [], totalCharge: 100, totalPaid: 100, balance: 0, gmachName: 'נווה' },
    { customerName: 'רחל כהן', orderId: 12345, eventDate: 'כז אלול', pickupLine: 'ביום ג', returnLine: 'יום ה', items: [{ name: 'מיכל', size: '38' }], totalCharge: 450, totalPaid: 200, balance: 250, hasSignedRegulations: true, ...G, pickupMapsUrl: MAPS },
    ...Object.entries(DELIVERY).map(([, delivery]) => ({ customerName: 'רחל כהן', orderId: 12345, eventDate: 'כז אלול', pickupLine: 'ביום ג', returnLine: 'יום ה', items: [{ name: 'מיכל', size: '38' }], totalCharge: 570, totalPaid: 200, balance: 370, hasSignedRegulations: true, ...G, delivery, pickupMapsUrl: MAPS })),
    { customerName: 'רחל', orderId: 7, eventDate: 'ט', pickupLine: 'ביום ג', returnLine: 'יום ה', items: [], totalCharge: 120, totalPaid: 0, balance: 120, gmachName: 'נווה', gmachPhone: '02-1', delivery: DELIVERY.bothRows },
  ],
  renderPickupReminderEmailHtml: [
    { customerName: 'רחל כהן', orderId: 12345, eventDate: 'כז אלול', items: ['א', 'ב'], ...G },
    { customerName: '', orderId: 7, eventDate: 'ט', items: [], gmachName: 'נווה' },
  ],
  renderLateReturnEmailHtml: [
    { customerName: 'רחל', orderId: 12345, returnDate: 'כז אלול', message: 'לא החזרתם', ...G },
    { customerName: '', orderId: 2, returnDate: 'ג', message: 'x', gmachName: 'נווה' },
  ],
  renderRefundExecutedEmailHtml: [
    { customerName: 'רחל כהן', amount: 1250, orderId: 12345, bankName: 'הפועלים', bankBranch: '612', gmachName: G.gmachName },
    { customerName: '', amount: 5, orderId: null, gmachName: 'נווה', gmachPhone: '1' },
  ],
  renderDailyReportEmailHtml: [{ dateHebrew: 'כז אלול', orders, gmachName: G.gmachName }, { dateHebrew: 'x', orders: [], gmachName: 'נווה' }],
  renderManualBarcodesEmailHtml: [{ dateHebrew: 'כז אלול', items: [{ orderId: 1, barcode: '55', description: 'א' }], gmachName: G.gmachName }],
  renderInternalMessageEmailHtml: [{ title: 'תקלה', bodyText: 'שלום\nצוות', senderName: 'דנה', gmachName: G.gmachName }, { bodyText: 'x' }],
  renderErrorReportEmailHtml: [{ employeeName: 'דנה', time: 'עכשיו', title: 'ט', url: '/o/1', userText: 'בעיה', lastButtons: ['א', 'ב'], gmachName: G.gmachName }],
  renderHumanRequestedEmailHtml: [{ reporterName: 'דנה', pageTitle: 'ט', description: 'תיאור', replies: [{ authorLabel: 'בוט', text: 'ראיתי', isBot: true }], gmachName: G.gmachName }],
  renderAgentDigestEmailHtml: [{ prs: [{ number: 1, title: 'a', branch: 'b', created: 'c', excerpt: 'd', url: 'https://x.test' }], gmachName: G.gmachName }],
  renderCourierDeliveryEmailHtml: [{ groups: [{ title: 'קבוצה', rows: [{ customerName: 'א', address: 'ב', customerPhone: '1', customerPhone2: '' }] }], gmachName: G.gmachName }, { groups: [], gmachName: 'נווה' }],
  renderPolicyQuestionnaireEmailHtml: [{ gmachName: G.gmachName, questionnaireGmachName: 'נווה', respondentName: 'דנה', respondentRole: 'הנהלה', submittedAtText: 'עכשיו', updated: true, answeredCount: 1, totalCount: 2, sections: [{ title: 's', items: [{ text: 'q', answerText: 'a', comment: 'c', answered: true }] }], resultsUrl: 'https://x.test/r', answerUrl: 'https://x.test/a' }],
};

for (const [fn, cases] of Object.entries(CASES)) {
  cases.forEach((params, i) => {
    t(`${fn} #${i + 1}: בלי cfg זהה לגרסה הישנה`, () => {
      assert.equal(typeof NEW[fn], 'function', 'missing in new');
      assert.equal(NEW[fn](params), OLD[fn](params));
    });
  });
}

t('renderEmailGallery זהה', () => {
  const entries = [{ name: 'a', subject: 's', html: OLD.renderGenericEmailHtml({ title: 't', bodyText: 'b' }) }];
  assert.equal(NEW.renderEmailGallery(entries), OLD.renderEmailGallery(entries));
});

// ---- cfg ----
t('עקיפת שורה: משנה רק את השורה (pickupReminder.closing)', () => {
  const params = CASES.renderPickupReminderEmailHtml[0];
  const base = NEW.renderPickupReminderEmailHtml(params);
  const changed = NEW.renderPickupReminderEmailHtml({ ...params, cfg: { texts: { closing: 'נתראה בקרוב {{gmachName}}!' } } });
  assert.notEqual(base, changed);
  assert.ok(changed.includes('נתראה בקרוב גמ&quot;ח שמלות!'), 'escape + החלפת משתנה');
  assert.equal(changed.replace('נתראה בקרוב גמ&quot;ח שמלות!', 'נשמח לראותכם!'), base);
});

t('escape: ערך משתנה עם תגית אינו הופך ל-HTML', () => {
  const params = { ...CASES.renderPickupReminderEmailHtml[0], customerName: '<script>alert(1)</script>' };
  const html = NEW.renderPickupReminderEmailHtml(params);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  const html2 = NEW.renderPickupReminderEmailHtml({ ...params, customerName: 'x', cfg: { texts: { lead: '<img src=x onerror=1> {{customerName}}' } } });
  assert.ok(!html2.includes('<img'), 'טקסט שורה עם תגית מוצג כטקסט');
});

t('whenWord: ימים לפני האירוע משתקפים בכותרת ובכיתוב', () => {
  const p = CASES.renderPickupReminderEmailHtml[0];
  assert.ok(NEW.renderPickupReminderEmailHtml({ ...p, daysBefore: 7 }).includes('בעוד 7 ימים איסוף ההזמנה #12345'));
  assert.ok(NEW.renderPickupReminderEmailHtml({ ...p, daysBefore: 0 }).includes('היום איסוף ההזמנה'));
  assert.ok(NEW.renderPickupReminderEmailHtml({ ...p, daysBefore: 2 }).includes('האירוע שלך מחרתיים'));
});

t('שדות קבועים: שם/כתובת/טלפון/בס"ד/סיום/חתימה', () => {
  const p = CASES.renderPickupReminderEmailHtml[0];
  const html = NEW.renderPickupReminderEmailHtml({ ...p, cfg: { fixed: { gmachName: 'נווה יעקב', gmachAddress: 'כתובת חדשה 9', gmachPhone: '03-9999999', contactEmail: 'a@b.co', blessing: '', footerNote: 'תודה מ-{{gmachName}}', signature: 'בברכה, הצוות' } } });
  assert.ok(html.includes('נווה יעקב') && html.includes('כתובת חדשה 9') && html.includes('03-9999999') && html.includes('a@b.co'));
  assert.ok(!html.includes('בס&quot;ד') && !html.includes('בס"ד'), 'בס"ד הוסר');
  assert.ok(html.includes('תודה מ-נווה יעקב') && html.includes('בברכה, הצוות'));
  assert.ok(!html.includes('הודעה זו נשלחה אוטומטית'));
  assert.ok(!html.includes('רחוב הדוגמה 1'));
});

t('שדה קבוע ריק/חסר = משתמש בערך שנשלח בפרמטרים', () => {
  const p = CASES.renderPickupReminderEmailHtml[0];
  assert.equal(NEW.renderPickupReminderEmailHtml({ ...p, cfg: { fixed: { gmachName: '', gmachAddress: '' } } }), NEW.renderPickupReminderEmailHtml(p));
});

t('איפוס סיסמה: הסיסמה תמיד בתיבה גם אם ערכו את כל השורות', () => {
  const texts = { codeLabel: 'x', step1: 'a', step2: 'b', step3: 'c', title: 't', lead: 'l', warnTitle: 'w', warnText: 'w' };
  const html = NEW.renderPasswordResetEmailHtml({ firstName: 'דנה', tempPassword: 'SECRET-123', cfg: { texts } });
  assert.ok(html.includes('SECRET-123'));
});

t('שורה לא מוכרת בתבנית זורקת שגיאה (לא טקסט ריק בשקט)', async () => {
  const { makeTx } = await import('../../lib/emailRegistry.js');
  assert.throws(() => makeTx('pickupReminder', {})('nope'), /שורה לא מוכרת/);
  assert.throws(() => makeTx('nope', {})('x'), /מייל לא מוכר/);
});

// ---- משלוח באישור הזמנה: הבלוק של buildDeliverySection (order-docs-delivery) דרך הטקסטים של מרכז המיילים ----
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#39;|&quot;|&amp;/g, '').replace(/\s+/g, ' ');
t('אישור הזמנה: בלי delivery / delivery=null = בלי בלוק משלוח', () => {
  const p = CASES.renderOrderConfirmationEmailHtml[0];
  assert.equal(NEW.renderOrderConfirmationEmailHtml({ ...p, delivery: null }), NEW.renderOrderConfirmationEmailHtml(p));
  assert.ok(!NEW.renderOrderConfirmationEmailHtml(p).includes('משלוח'));
});

t('אישור הזמנה עם משלוח: פרטי המשלוח, "מתוכם" בסיכום התשלום ובלוק "שימו לב" עם השעות (ברירת מחדל מההגדרות)', () => {
  const p = { ...CASES.renderOrderConfirmationEmailHtml[0], delivery: DELIVERY.both, totalCharge: 570 };
  const txt = strip(NEW.renderOrderConfirmationEmailHtml(p));
  assert.match(txt, /הרצל 5, ירושלים/);
  assert.match(txt, /מתוכם משלוח הלוך\s*₪\s?60/);
  assert.ok(txt.includes('אין צורך לבוא לגמ') && txt.includes('משלוח הלוך: בשעות אחה') && txt.includes('משלוח חזור: 10:00–13:00'));
});

t('אישור הזמנה עם משלוח: עריכת "שימו לב" ושורות הכיוון ממרכז המיילים; מתוך ההגדרות כברירת מחדל', () => {
  const p = { ...CASES.renderOrderConfirmationEmailHtml[0], delivery: DELIVERY.bothRows };
  const base = NEW.renderOrderConfirmationEmailHtml(p);
  const edited = NEW.renderOrderConfirmationEmailHtml({ ...p, cfg: { texts: { deliveryNotice: 'המשלוחן יתקשר (הלוך {{deliveryOutHours}} / חזור {{deliveryReturnHours}})', lblDeliveryOut: 'שליחה אליך', lblDeliveryBack: 'איסוף ממך', lblDeliveryOf: 'מזה' } } });
  const txt = strip(edited);
  assert.ok(txt.includes('המשלוחן יתקשר (הלוך בשעות אחהצ–ערב / חזור 10:00–13:00)'), 'עריכת הכיתוב עם שעות מההגדרות');
  assert.ok(!txt.includes('אין צורך לבוא לגמ'), 'הכיתוב המקורי הוחלף כולו');
  assert.ok(txt.includes('שליחה אליך') && txt.includes('איסוף ממך') && txt.includes('מזה שליחה אליך'), 'שורות הכיוון (פריט + סיכום) ניתנות לעריכה');
  assert.notEqual(base, edited);
  // הבלוק לא משתנה לפי ה-cfg כשאין עקיפה
  assert.equal(NEW.renderOrderConfirmationEmailHtml({ ...p, cfg: { texts: {} } }), base);
});

t('אישור הזמנה: כיתוב "שימו לב" שהוסתר בהגדרות לא מופיע, אלא אם נכתבה לו עקיפה במרכז המיילים', () => {
  const p = { ...CASES.renderOrderConfirmationEmailHtml[0], delivery: DELIVERY.noNotice };
  assert.ok(!strip(NEW.renderOrderConfirmationEmailHtml(p)).includes('אין צורך לבוא'));
  assert.ok(strip(NEW.renderOrderConfirmationEmailHtml({ ...p, cfg: { texts: { deliveryNotice: 'הודעה מיוחדת' } } })).includes('הודעה מיוחדת'));
});

t('החלטה 27: הלוך-חזור = בלי קבלה/החזרה/כתובת איסוף (גם כשיש כתובת בשדות הקבועים של הגוף); הלוך בלבד = החזרה + כתובת + קישור מפות', () => {
  const p = { ...CASES.renderOrderConfirmationEmailHtml[0], pickupMapsUrl: MAPS };
  const both = strip(NEW.renderOrderConfirmationEmailHtml({ ...p, delivery: DELIVERY.both }));
  assert.ok(!both.includes('קבלת השמלות') && !both.includes('החזרת השמלות') && !both.includes('כתובת האיסוף') && !both.includes('פתיחה במפות'));
  assert.ok(both.includes('פרטי קשר'));
  const outOnly = NEW.renderOrderConfirmationEmailHtml({ ...p, delivery: DELIVERY.outOnly });
  assert.ok(strip(outOnly).includes('החזרת השמלות') && !strip(outOnly).includes('קבלת השמלות') && strip(outOnly).includes('כתובת האיסוף'));
  assert.ok(outOnly.includes(`href="${MAPS.replace(/&/g, '&amp;')}"`) && outOnly.includes('פתיחה במפות Google'));
  const edited = NEW.renderOrderConfirmationEmailHtml({ ...p, delivery: DELIVERY.outOnly, cfg: { texts: { mapsLabel: 'ניווט' } } });
  assert.ok(edited.includes('ניווט') && !edited.includes('פתיחה במפות Google'));
});

t('שורת התקנון: מופיעה רק כשחתמה; תווית וטקסט ניתנים לעריכה', () => {
  const p = CASES.renderOrderConfirmationEmailHtml[0];
  assert.ok(!NEW.renderOrderConfirmationEmailHtml(p).includes('חתם/ה על תקנון'));
  assert.ok(NEW.renderOrderConfirmationEmailHtml({ ...p, hasSignedRegulations: true }).includes('חתם/ה על תקנון ההשכרה ✓'));
  const e = NEW.renderOrderConfirmationEmailHtml({ ...p, hasSignedRegulations: true, cfg: { texts: { lblSigned: 'חתימה', signedText: 'אושר ✓' } } });
  assert.ok(e.includes('אושר ✓') && !e.includes('חתם/ה על תקנון'));
  const c = NEW.renderOrderCardEmailHtml({ orderId: 5, hasSignedRegulations: true, ...G, cfg: { texts: { signedText: 'חתמה' } } });
  assert.ok(c.includes('חתמה') && !c.includes('חתם/ה על תקנון'));
});

t('לוגו בכותרת: רק עם fixed.logoUrl http(s)', () => {
  const p = CASES.renderPickupReminderEmailHtml[0];
  const html = NEW.renderPickupReminderEmailHtml({ ...p, cfg: { fixed: { logoUrl: 'https://gemach.example/api/logo' } } });
  assert.ok(html.includes('<img src="https://gemach.example/api/logo"'));
  assert.ok(!NEW.renderPickupReminderEmailHtml({ ...p, cfg: { fixed: { logoUrl: 'javascript:alert(1)' } } }).includes('<img'));
  assert.equal(NEW.renderPickupReminderEmailHtml({ ...p, cfg: { fixed: {} } }), NEW.renderPickupReminderEmailHtml(p));
});

// ---- הדוח היומי (נבנה בעבר inline ב-cron/daily): אותו פלט, חוץ מ-escape של < > & בשמות ----
t('renderDailyManagerReport זהה ל-HTML הישן של ה-cron (נתונים רגילים)', () => {
  const dateLabel = 'כז אלול תשפ"ו';
  const openedLines = '#1 - רחל כהן - כז אלול - 2 פריטים\n#2 - שרה לוי - ל אלול - 1 פריטים';
  const reservedLines = '';
  const body = `דוח יומי - ${dateLabel}\n\nהזמנות חדשות שנפתחו אתמול: 2\n${openedLines || 'אין'}\n\nהזמנות עם אירוע היום: 0\n${reservedLines || 'אין'}`;
  const html = `<div dir="rtl" style="font-family:Arial"><h2>דוח יומי - ${dateLabel}</h2>` +
    `<p><strong>הזמנות חדשות שנפתחו אתמול:</strong> 2</p>` +
    `<pre style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap">${openedLines || 'אין'}</pre>` +
    `<p><strong>הזמנות עם אירוע היום:</strong> 0</p>` +
    `<pre style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap">${reservedLines || 'אין'}</pre></div>`;
  const out = NEW.renderDailyManagerReport({ dateLabel, openedCount: 2, eventTodayCount: 0, openedLines, reservedLines });
  assert.equal(out.body, body);
  assert.equal(out.html, html);
});

t('renderDailyManagerReport: שם לקוח עם תגית עובר escape; כותרות ניתנות לעריכה', () => {
  const out = NEW.renderDailyManagerReport({ dateLabel: 'x', openedCount: 1, eventTodayCount: 0, openedLines: '#1 - <script>alert(1)</script> & co', reservedLines: '', cfg: { texts: { heading: 'סיכום {{hebrewDate}}', none: 'ריק' } } });
  assert.ok(!out.html.includes('<script>'));
  assert.ok(out.html.includes('&lt;script&gt;') && out.html.includes('&amp; co'));
  assert.ok(out.html.includes('<h2>סיכום x</h2>') && out.html.includes('>ריק</pre>'));
});

console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
