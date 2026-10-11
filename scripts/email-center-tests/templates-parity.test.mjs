// שוויון פלט: כל תבניות המיילים (lib/emailTemplates.js) בלי עקיפות = בייט-בבייט אותו HTML כמו הגרסה הישנה
// (scripts/email-center-tests/emailTemplates.original.mjs = העתק קפוא של התבניות לפני מרכז המיילים).
// + בדיקות ל-cfg: עקיפת שורה משנה רק את השורה, שדות קבועים משנים כותרת/כותפת, ו-escape של משתנים.
// הרצה: node scripts/email-center-tests/templates-parity.test.mjs   (בלי DB, בלי רשת)
import assert from 'node:assert/strict';
import * as OLD from './emailTemplates.original.mjs';
import * as NEW from '../../lib/emailTemplates.js';

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message.slice(0, 600)); process.exitCode = 1; } };

const G = { gmachName: 'גמ"ח שמלות', gmachAddress: 'רחוב הדוגמה 1, ירושלים', gmachPhone: '02-1234567' };
const orders = [{ orderId: 1, customerName: 'רחל', eventDate: 'כז אלול', itemsCount: 2 }];

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
  ],
  renderOrderConfirmationEmailHtml: [
    { customerName: 'רחל כהן', orderId: 12345, eventDate: 'כז אלול', pickupLine: 'ביום ג', returnLine: 'יום ה', items: [{ name: 'מיכל', size: '38' }, { name: 'נועה', size: '' }], totalCharge: 450, totalPaid: 200, balance: 250, ...G },
    { customerName: '', orderId: 1, items: [], totalCharge: 100, totalPaid: 100, balance: 0, gmachName: 'נווה' },
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

console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
