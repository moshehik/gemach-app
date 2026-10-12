// בדיקות הדיוורים (lib/emailCampaign.js) מול prisma / settingsCache מדומים ושליחה במצב יבש (EMAIL_DRY_RUN=1) - אין DB, אין רשת, אף מייל לא יוצא.
// מכסה: טוקן הסרה (חתימה), הסכמת דיוור (כולל ביטול הסכמה באמצע), כותפת ההסרה בכל מייל, סינון נמענים, אימות קלט, אידמפוטנטיות (requestId),
// ביטול באמצע, מכסה, סניטיזציה של הגוף, והחבילה של מרכז המיילים (שמירה/איפוס של תצורה מול אחסון מדומה).
// הרצה: node scripts/email-center-tests/campaign.test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import './alias-register.mjs';

register('data:text/javascript,' + encodeURIComponent(String.raw`
export async function resolve(spec, ctx, next) {
  if (spec === '@/app/lib/prisma') return { url: 'stub:prisma', shortCircuit: true, format: 'module' };
  if (spec === '@/lib/settingsCache') return { url: 'stub:settings', shortCircuit: true, format: 'module' };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url === 'stub:prisma') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__db.prisma;' };
  if (url === 'stub:settings') return { format: 'module', shortCircuit: true, source: 'export const getAllCachedSettings = async () => globalThis.__db.settings(); export const getCachedSetting = async (k) => globalThis.__db.settings().find((r) => r.key === k) || null; export const invalidateSettingsCache = () => {};' };
  return next(url, ctx);
}`), import.meta.url);

process.env.EMAIL_DRY_RUN = '1';
process.env.AUTH_SECRET = 'test-secret-for-unit-tests-only';

// ---------- מסד מדומה ----------
const store = new Map(); // SystemSetting: key -> {key,value,name,type}
const customers = new Map();
const attachments = new Map();
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const addCustomer = (n, o) => { const id = U(n); return addCustomer0(id, o, n); };
const addCustomer0 = (id, o, n) => customers.set(id, { id, firstName: 'ש' + n, lastName: 'מ' + n, city: 'ירושלים', email: `c${n}@example.test`, marketingConsent: true, isDeleted: false, phone1: '050' + n, ...o });
globalThis.__db = {
  settings: () => [...store.values()],
  prisma: {
    systemSetting: {
      upsert: async ({ where, update, create }) => { const cur = store.get(where.key); const row = cur ? { ...cur, ...update } : { ...create }; store.set(where.key, row); return row; },
      findUnique: async ({ where }) => store.get(where.key) || null,
      findMany: async ({ where }) => [...store.values()].filter((r) => !where?.key?.startsWith || r.key.startsWith(where.key.startsWith)),
      deleteMany: async ({ where }) => { store.delete(where.key); return { count: 1 }; },
      updateMany: async ({ where, data }) => { const r = store.get(where.key); if (!r || (where.value !== undefined && r.value !== where.value)) return { count: 0 }; store.set(where.key, { ...r, ...data }); return { count: 1 }; },
      update: async ({ where, data }) => { const r = { ...store.get(where.key), ...data }; store.set(where.key, r); return r; },
    },
    customer: {
      findMany: async ({ where }) => {
        let rows = [...customers.values()];
        const w = where || {};
        if (w.isDeleted === false) rows = rows.filter((c) => !c.isDeleted);
        if (w.marketingConsent === true) rows = rows.filter((c) => c.marketingConsent);
        if (w.email && w.email.not === null) rows = rows.filter((c) => c.email != null);
        if (w.city && w.city.in) rows = rows.filter((c) => w.city.in.includes(c.city));
        if (w.id && w.id.in) rows = rows.filter((c) => w.id.in.includes(c.id));
        return rows;
      },
      findUnique: async ({ where }) => customers.get(where.id) || null,
      update: async ({ where, data }) => { Object.assign(customers.get(where.id), data); return customers.get(where.id); },
    },
    order: { findMany: async () => [] },
    attachment: { findUnique: async ({ where }) => attachments.get(where.id) || null },
    emailLog: { create: async () => ({}) },
    employee: { findUnique: async () => ({ email: 'me@example.test', firstName: 'דנה', lastName: 'לוי' }) },
  },
};

const C = await import('../../lib/emailCampaign.js');
const M = await import('../../lib/mailer.js');
const CFG = await import('../../lib/emailConfig.js');

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', String(e.stack || e.message).slice(0, 700)); process.exitCode = 1; } };

const INPUT = { subject: 'שלום {{firstName}}', bodyText: 'היי {{fullName}},\n**מבצע** חדש ב-[האתר](https://example.test/x)', heading: '', buttonLabel: '', buttonUrl: '', attachments: [] };
const ORIGIN = 'https://gemach.example.test';

// ---------- טוקן הסרה ----------
await t('טוקן הסרה: מחזיר את אותו מזהה; זיוף/שינוי/ריק נדחים', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const tok = C.makeUnsubscribeToken(id);
  assert.equal(C.verifyUnsubscribeToken(tok), id);
  const [a, b] = tok.split('.');
  assert.equal(C.verifyUnsubscribeToken(`${a}.${b.slice(0, -2)}AA`), null);
  const other = C.makeUnsubscribeToken('99999999-2222-3333-4444-555555555555');
  assert.equal(C.verifyUnsubscribeToken(`${a}.${other.split('.')[1]}`), null, 'חתימה של לקוח אחר');
  for (const bad of ['', 'x', 'a.b', null, undefined, '..', `${Buffer.from('../../etc').toString('base64url')}.${b}`]) assert.equal(C.verifyUnsubscribeToken(bad), null, String(bad));
});

await t('טוקן הסרה נכשל בלי AUTH_SECRET (אין שליחה בלי קישור הסרה)', () => {
  const s = process.env.AUTH_SECRET; delete process.env.AUTH_SECRET;
  try { assert.throws(() => C.makeUnsubscribeToken('x'), /AUTH_SECRET/); } finally { process.env.AUTH_SECRET = s; }
});

await t('maskEmail לא חושף את הכתובת', () => {
  const m = C.maskEmail('rachel.cohen@gmail.com');
  assert.ok(!m.includes('rachel') && !m.includes('gmail') && m.includes('@') && m.endsWith('.com'), m);
  assert.equal(C.maskEmail('nope'), '***');
});

// ---------- נמענים ----------
addCustomer(1, {});
addCustomer(2, { city: 'בני ברק' });
addCustomer(3, { marketingConsent: false });
addCustomer(4, { isDeleted: true });
addCustomer(5, { email: 'not-an-email' });
addCustomer(6, { email: 'C1@example.test' }); // כפילות כתובת של c1 (שונה באותיות)
addCustomer(7, { email: null });

await t('resolveRecipients(all): רק מאשרי דיוור, לא מחוקים, מייל תקין, בלי כפילות כתובת', async () => {
  const r = await C.resolveRecipients({ mode: 'all' });
  const ids = r.recipients.map((x) => x.id).sort();
  assert.deepEqual(ids, [U(1), U(2)]);
  for (const x of r.recipients) { assert.ok(!('email' in x)); assert.ok(x.maskedEmail.includes('***') || x.maskedEmail.includes('*')); }
});

await t('resolveRecipients: עיר / ידני - עדיין רק מאשרי דיוור (גם אם ביקשו ידנית מי שלא אישרה)', async () => {
  assert.deepEqual((await C.resolveRecipients({ mode: 'city', cities: ['בני ברק'] })).recipients.map((x) => x.id), [U(2)]);
  assert.deepEqual((await C.resolveRecipients({ mode: 'manual', customerIds: [U(3), U(4), U(1)] })).recipients.map((x) => x.id), [U(1)]);
  assert.deepEqual((await C.resolveRecipients({ mode: 'manual', customerIds: ['../etc', "c1' OR 1=1"] })).recipients, []);
  assert.equal((await C.resolveRecipients({ mode: 'bogus' })).error, 'סוג בחירה לא מוכר');
  assert.deepEqual((await C.resolveRecipients({ mode: 'city', cities: [] })).recipients, []);
});

// ---------- קלט ----------
await t('sanitizeCampaignInput: דחיית משתנה לא מוכר, תמונה/קישור/צרופה לא חוקיים', () => {
  assert.equal(C.sanitizeCampaignInput({ ...INPUT, subject: '' }).ok, false);
  assert.match(C.sanitizeCampaignInput({ ...INPUT, bodyText: 'שלום {{evil}}' }).error, /משתנה לא מוכר/);
  assert.match(C.sanitizeCampaignInput({ ...INPUT, imageUrl: 'https://evil.test/x.png' }).error, /תמונה/);
  assert.match(C.sanitizeCampaignInput({ ...INPUT, imageUrl: '/api/attachment/../../x' }).error, /תמונה/);
  assert.match(C.sanitizeCampaignInput({ ...INPUT, buttonLabel: 'ל', buttonUrl: 'javascript:alert(1)' }).error, /קישור הכפתור/);
  assert.match(C.sanitizeCampaignInput({ ...INPUT, buttonUrl: 'https://a.test' }).error, /כיתוב/);
  assert.match(C.sanitizeCampaignInput({ ...INPUT, attachments: [{ attachmentId: 'abcdef12-aaaa', fileName: 'evil.html', size: 10 }] }).error, /לא מותר/);
  assert.match(C.sanitizeCampaignInput({ ...INPUT, attachments: [{ attachmentId: 'abcdef12-aaaa', fileName: 'a.pdf', size: 7 * 1024 * 1024 }] }).error, /גדול/);
  const ok = C.sanitizeCampaignInput({ ...INPUT, imageUrl: '/api/attachment/abcdef12-aaaa-bbbb', buttonLabel: 'לחצו', buttonUrl: 'https://a.test/p?x=1', attachments: [{ attachmentId: 'abcdef12-aaaa', fileName: 'מחירון.pdf', size: 1000 }] });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.imageAttachmentId, 'abcdef12-aaaa-bbbb');
});

// ---------- יצירה ושליחה ----------
let campaignId;
await t('createCampaign: מגביל לנמענים מאושרים, מתזמן רק לעתיד, דורש origin תקין', async () => {
  assert.equal((await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: 'javascript:1', employeeId: 'e1' })).ok, false);
  const past = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1', mode: 'schedule', scheduledAt: new Date(Date.now() - 3600e3) });
  assert.equal(past.ok, false);
  const none = await C.createCampaign({ input: INPUT, filters: { mode: 'city', cities: ['עיר שלא קיימת'] }, origin: ORIGIN, employeeId: 'e1' });
  assert.match(none.error, /אין נמענים/);
  const r = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1' });
  assert.equal(r.ok, true); assert.equal(r.total, 2); campaignId = r.id;
});

await t('שליחה: כל מייל נושא קישור הסרה אישי + כותפת, נושא עם שם הנמענת, requestId קבוע; הסכמה שבוטלה באמצע = דילוג', async () => {
  M.clearDryRunOutbox();
  customers.get(U(2)).marketingConsent = false; // ביטלה הסכמה בין היצירה לשליחה
  const r = await C.sendCampaignChunk(campaignId, { limit: 5 });
  assert.equal(r.sent, 1); assert.equal(r.skipped, 1); assert.equal(r.done, true);
  const out = M.getDryRunOutbox();
  assert.equal(out.length, 1);
  assert.equal(out[0].to, 'c1@example.test');
  assert.equal(out[0].subject, 'שלום ש1');
  assert.ok(out[0].htmlBody.includes('/api/email/unsubscribe?t='), 'קישור הסרה ב-HTML');
  assert.ok(out[0].body.includes('/api/email/unsubscribe?t='), 'קישור הסרה בטקסט');
  assert.ok(out[0].htmlBody.includes('<strong>מבצע</strong>') && out[0].htmlBody.includes('href="https://example.test/x"'));
  assert.ok(out[0].htmlBody.includes('ש1 מ1'), 'החלפת משתנים');
  const tok = /unsubscribe\?t=([^"&\s]+)/.exec(out[0].htmlBody)[1];
  assert.equal(C.verifyUnsubscribeToken(tok), U(1));
  const doc = await C.loadCampaign(campaignId);
  assert.equal(doc.status, 'done');
});

await t('שליחה חוזרת לדיוור שהסתיים לא שולחת שוב', async () => {
  M.clearDryRunOutbox();
  const r = await C.sendCampaignChunk(campaignId, { limit: 5 });
  assert.equal(r.done, true); assert.equal(r.sent, 0);
  assert.equal(M.getDryRunOutbox().length, 0);
});

await t('ביטול באמצע + נעילה: דיוור שבוטל לא נשלח', async () => {
  customers.get(U(2)).marketingConsent = true;
  const r = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1' });
  await C.cancelCampaign(r.id);
  M.clearDryRunOutbox();
  const s = await C.sendCampaignChunk(r.id, { limit: 5 });
  assert.equal(s.ok, false);
  assert.equal(M.getDryRunOutbox().length, 0);
});

await t('דיוור מתוזמן לעתיד לא נשלח; processDueCampaigns שולח רק את מה שהגיע זמנו', async () => {
  const future = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1', mode: 'schedule', scheduledAt: new Date(Date.now() + 3 * 3600e3) });
  assert.equal(future.status, 'scheduled');
  M.clearDryRunOutbox();
  const res = await C.processDueCampaigns();
  assert.equal(res.sent, 0);
  assert.equal(M.getDryRunOutbox().length, 0);
  // מקדימים את המועד ל"עכשיו" ידנית במסמך
  const key = C.CAMPAIGN_KEY_PREFIX + future.id;
  const doc = JSON.parse(store.get(key).value); doc.scheduledAt = new Date(Date.now() - 1000).toISOString(); store.set(key, { ...store.get(key), value: JSON.stringify(doc) });
  const res2 = await C.processDueCampaigns();
  assert.equal(res2.sent, 2);
  assert.equal(M.getDryRunOutbox().length, 2);
});

await t('מייל בדיקה: רק לכתובת העובד, עם [בדיקה] וקישור דוגמה', async () => {
  M.clearDryRunOutbox();
  const r = await C.sendTestToEmployee({ input: INPUT, employeeId: 'e1', origin: ORIGIN });
  assert.equal(r.ok, true);
  const out = M.getDryRunOutbox();
  assert.equal(out.length, 1); assert.equal(out[0].to, 'me@example.test'); assert.ok(out[0].subject.startsWith('[בדיקה] '));
});

await t('תצוגה מקדימה: נתוני דוגמה ו-HTML בטוח', async () => {
  const r = await C.previewCampaign({ input: { ...INPUT, bodyText: '<script>alert(1)</script> **x**' }, origin: ORIGIN });
  assert.equal(r.ok, true);
  assert.ok(!r.html.includes('<script>')); assert.ok(r.html.includes('&lt;script&gt;'));
  assert.ok(r.html.includes('להסרה מרשימת הדיוור'));
});

// ---------- תצורת מרכז המיילים (שמירה / איפוס) ----------
await t('saveEmailTemplate: שמירה, איפוס שורה, שווה לברירת מחדל נמחק, משתנה לא מוכר נדחה, מייל נעול', async () => {
  assert.equal((await CFG.saveEmailTemplate('pickupReminder', { texts: { closing: 'נתראה!' } })).ok, true);
  let cfg = await CFG.getEmailConfig('pickupReminder');
  assert.equal(cfg.texts.closing, 'נתראה!'); assert.equal(cfg.customized, true);
  assert.equal((await CFG.saveEmailTemplate('pickupReminder', { texts: { closing: 'נשמח לראותכם!' } })).ok, true);
  cfg = await CFG.getEmailConfig('pickupReminder');
  assert.deepEqual(cfg.texts, {}); assert.equal(cfg.customized, false);
  assert.equal(store.has('email_tpl:pickupReminder'), false, 'אין שורה כשאין עקיפות');
  assert.match((await CFG.saveEmailTemplate('pickupReminder', { texts: { closing: 'שלום {{secret}}' } })).error, /משתנה לא מוכר/);
  assert.match((await CFG.saveEmailTemplate('pickupReminder', { texts: { nope: 'x' } })).error, /שורה לא מוכרת/);
  assert.match((await CFG.saveEmailTemplate('errorReportNew', { subject: 'x' })).error, /אינו ניתן לעריכה/);
  assert.match((await CFG.saveEmailTemplate('passwordResetSelf', { enabled: false })).error, /אי אפשר לכבות|לא ניתן|נשלח רק/);
  assert.match((await CFG.saveEmailTemplate('nope', { subject: 'x' })).error, /לא מוכר/);
});

await t('saveEmailTemplate: נושא, כיבוי (override ו-setting), תזמון', async () => {
  assert.equal((await CFG.saveEmailTemplate('refundExecuted', { subject: 'זיכוי בוצע' })).ok, true);
  const { emailSubject } = await import('../../lib/emailCatalog.js');
  assert.equal(emailSubject('refundExecuted', {}, await CFG.getEmailConfig('refundExecuted')), 'זיכוי בוצע');
  assert.equal(emailSubject('refundExecuted', {}), 'אישור ביצוע זיכוי - מערכת הגמ"ח', 'בלי cfg - כמו תמיד');
  assert.equal((await CFG.saveEmailTemplate('refundExecuted', { enabled: false })).ok, true);
  assert.equal((await CFG.getEmailConfig('refundExecuted')).enabled, false);
  assert.equal((await CFG.resetEmailTemplate('refundExecuted')).ok, true);
  assert.equal((await CFG.getEmailConfig('refundExecuted')).enabled, true);
  // הגדרה קיימת: pickup_reminder_enabled נכתבת עם שם וקטגוריה
  assert.equal((await CFG.saveEmailTemplate('pickupReminder', { enabled: true })).ok, true);
  assert.equal(store.get('pickup_reminder_enabled').value, 'true'); assert.equal(store.get('pickup_reminder_enabled').category, 'אוטומציה');
  // ימים לפני האירוע
  assert.equal((await CFG.saveEmailTemplate('pickupReminder', { schedule: { eventBefore: [7, 1] } })).ok, true);
  assert.deepEqual((await CFG.getEmailConfig('pickupReminder')).days, [7, 1]);
  assert.equal((await CFG.saveEmailTemplate('pickupReminder', { schedule: { eventBefore: [99] } })).ok, false);
  assert.equal((await CFG.saveEmailTemplate('pickupReminder', { schedule: { eventBefore: [1] } })).ok, true);
  assert.deepEqual((await CFG.getEmailConfig('pickupReminder')).days, [1]);
  // אחרי X ימים מיצירת ההזמנה / אחרי ההחזרה
  assert.equal((await CFG.saveEmailTemplate('orderCreatedAuto', { schedule: { orderAfter: 2 } })).ok, true);
  assert.equal((await CFG.getEmailConfig('orderCreatedAuto')).orderAfterDays, 2);
  assert.equal((await CFG.saveEmailTemplate('orderCreatedAuto', { schedule: { orderAfter: null } })).ok, true);
  assert.equal((await CFG.getEmailConfig('orderCreatedAuto')).orderAfterDays, null);
  assert.equal((await CFG.saveEmailTemplate('lateReturnReminder', { schedule: { returnAfter: 5 } })).ok, true);
  assert.equal(store.get('late_return_threshold_days').value, '5');
  assert.equal((await CFG.saveEmailTemplate('refundExecuted', { schedule: { orderAfter: 2 } })).ok, false, 'מייל שאינו מתוזמן');
});

await t('שדות קבועים: עקיפה, איפוס שדה, איפוס הכול; לא נוגע בהגדרות האתר', async () => {
  store.set('gmach_name', { key: 'gmach_name', value: 'נווה יעקב' });
  assert.equal((await CFG.saveFixedFields({ gmachName: 'גמ"ח חדש', blessing: '', signature: 'בברכה' })).ok, true);
  const cfg = await CFG.getEmailConfig('refundExecuted');
  assert.equal(cfg.fixed.gmachName, 'גמ"ח חדש'); assert.equal(cfg.fixed.blessing, ''); assert.equal(cfg.fixed.signature, 'בברכה');
  assert.equal(store.get('gmach_name').value, 'נווה יעקב', 'הגדרת האתר לא השתנתה');
  assert.equal(await CFG.getSenderNameOverride(), 'גמ"ח חדש');
  const view = (await CFG.loadAdminOverview()).fixed.find((f) => f.key === 'gmachName');
  assert.equal(view.overridden, true); assert.equal(view.defaultValue, 'נווה יעקב');
  assert.equal((await CFG.saveFixedFields({ gmachName: null })).ok, true);
  assert.equal((await CFG.getEmailConfig('refundExecuted')).fixed.gmachName, undefined);
  assert.match((await CFG.saveFixedFields({ contactEmail: 'not mail' })).error, /כתובת מייל/);
  assert.match((await CFG.saveFixedFields({ footerNote: 'x {{evil}}' })).error, /משתנה לא מוכר/);
  assert.match((await CFG.saveFixedFields({ nope: 'x' })).error, /שדה לא מוכר/);
  await CFG.resetAllFixedFields();
  assert.deepEqual((await CFG.getEmailConfig('refundExecuted')).fixed, {});
  assert.equal(await CFG.getSenderNameOverride(), null);
});

await t('getEmailConfig לא זורק כשהמסד נכשל (מייל איפוס סיסמה ממשיך)', async () => {
  const orig = globalThis.__db.settings;
  globalThis.__db.settings = () => { throw new Error('db down'); };
  try {
    const cfg = await CFG.getEmailConfig('passwordResetSelf');
    assert.equal(cfg.enabled, true); assert.deepEqual(cfg.texts, {});
  } finally { globalThis.__db.settings = orig; }
});

await t('buildDraftCfg: טיוטה מאומתת כמו שמירה', async () => {
  const ok = await CFG.buildDraftCfg('pickupReminder', { texts: { closing: 'היי {{customerName}}' } });
  assert.equal(ok.ok, true); assert.equal(ok.cfg.texts.closing, 'היי {{customerName}}');
  const bad = await CFG.buildDraftCfg('pickupReminder', { texts: { closing: '{{nope}}' } });
  assert.equal(bad.ok, false); assert.equal(bad.key, 'closing');
});

// ---------- מתזמן Apps Script (שעה מדויקת) ----------
await t('מתזמן: בלי env מדלגים (המסמך נשאר מתוזמן, exact=false)', async () => {
  delete process.env.EMAIL_SCHEDULER_URL; delete process.env.EMAIL_SCHEDULER_SECRET;
  assert.equal(C.schedulerConfigured(), false);
  const r = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1', mode: 'schedule', scheduledAt: new Date(Date.now() + 3600e3) });
  assert.equal(r.status, 'scheduled'); assert.equal(r.scheduler.exact, false);
  assert.equal((await C.listCampaigns()).find((c) => c.id === r.id).exact, false);
});

await t('מתזמן: עם env נרשם טריגר {schedule,id,runAt,site}; ביטול שולח cancel; כשל רישום לא מכשיל את התזמון', async () => {
  process.env.EMAIL_SCHEDULER_URL = 'https://script.google.com/macros/s/TEST/exec'; process.env.EMAIL_SCHEDULER_SECRET = 'sched-secret-test';
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { const body = JSON.parse(init.body); calls.push({ url, body }); return { status: 200, text: async () => JSON.stringify(body.action === 'schedule' ? { ok: true, triggerId: 'trig-1' } : { ok: true, cancelled: true }) }; };
  try {
    assert.equal(C.schedulerConfigured(), true);
    const at = new Date(Date.now() + 2 * 3600e3);
    const r = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1', mode: 'schedule', scheduledAt: at });
    assert.equal(r.scheduler.exact, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://script.google.com/macros/s/TEST/exec');
    assert.deepEqual({ ...calls[0].body, secret: undefined }, { secret: undefined, action: 'schedule', id: r.id, runAt: at.toISOString(), site: ORIGIN });
    assert.equal(calls[0].body.secret, 'sched-secret-test');
    assert.equal((await C.loadCampaign(r.id)).scheduler.triggerId, 'trig-1');
    await C.cancelCampaign(r.id);
    assert.equal(calls[1].body.action, 'cancel'); assert.equal(calls[1].body.id, r.id);
    // כשל רישום (תשובה לא תקינה) - התזמון נשמר, exact=false + שגיאה
    globalThis.fetch = async () => ({ status: 500, text: async () => '<html>error</html>' });
    const bad = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1', mode: 'schedule', scheduledAt: at });
    assert.equal(bad.status, 'scheduled'); assert.equal(bad.scheduler.exact, false); assert.match(bad.scheduler.error, /תשובה לא תקינה/);
    // רשת נפלה
    globalThis.fetch = async () => { throw new Error('network down'); };
    const down = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1', mode: 'schedule', scheduledAt: at });
    assert.equal(down.status, 'scheduled'); assert.equal(down.scheduler.exact, false);
  } finally { globalThis.fetch = realFetch; delete process.env.EMAIL_SCHEDULER_URL; delete process.env.EMAIL_SCHEDULER_SECRET; }
});

await t('claim אטומי: שתי ריצות במקביל על אותו דיוור - כל נמען מקבל פעם אחת', async () => {
  customers.get(U(2)).marketingConsent = true;
  const r = await C.createCampaign({ input: INPUT, filters: { mode: 'all' }, origin: ORIGIN, employeeId: 'e1' });
  M.clearDryRunOutbox();
  const [a, b] = await Promise.all([C.sendCampaignChunk(r.id, { limit: 5 }), C.sendCampaignChunk(r.id, { limit: 5 })]);
  const out = M.getDryRunOutbox();
  const to = out.map((x) => x.to).sort();
  assert.deepEqual(to, [...new Set(to)], 'כפילות נמען');
  assert.equal(a.sent + b.sent, 2);
  assert.ok(a.busy || b.busy, 'אחת הריצות חייבת להיות busy');
});

await t('שער הסוד של /api/cron/email-campaigns מקבל CRON_SECRET וגם EMAIL_SCHEDULER_SECRET (בדיקה סטטית)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../app/api/cron/email-campaigns/route.js', import.meta.url), 'utf8');
  assert.ok(src.includes('process.env.CRON_SECRET') && src.includes('process.env.EMAIL_SCHEDULER_SECRET') && src.includes('allowed.includes(secret)'));
  assert.ok(src.includes('more') );
});

// ---------- rate limit ----------
await t('simpleRateLimit', async () => {
  const { allow, resetRateLimits } = await import('../../lib/simpleRateLimit.js');
  resetRateLimits();
  assert.equal(allow('k', 2, 1000, 0), true); assert.equal(allow('k', 2, 1000, 1), true); assert.equal(allow('k', 2, 1000, 2), false);
  assert.equal(allow('k', 2, 1000, 1500), true, 'חלון חדש');
});

console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
