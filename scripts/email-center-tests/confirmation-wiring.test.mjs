// חיווט מייל אישור ההזמנה (lib/orderConfirmationMail.js) אחרי מיזוג order-docs-delivery + email-center + #276 + model-numbers:
// בלוק המשלוח (buildDeliverySection דרך loadDeliverySection), כתובת האיסוף gmach_pickup_address וקישור Google Maps, כללי הביקור בגמ"ח (החלטה 27),
// שורת התקנון, שם הדגם (מספר במקום "ללא שם - N"), ושני אתרי הקריאה (POST /api/orders ו-cron/daily) - מול prisma / settingsCache / mailer מדומים.
// הרצה: node scripts/email-center-tests/confirmation-wiring.test.mjs   (בלי DB, בלי רשת)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import './alias-register.mjs';

register('data:text/javascript,' + encodeURIComponent(String.raw`
export async function resolve(spec, ctx, next) {
  if (spec === '@/app/lib/prisma') return { url: 'stub:prisma', shortCircuit: true, format: 'module' };
  if (spec === '@/lib/settingsCache') return { url: 'stub:settings', shortCircuit: true, format: 'module' };
  if (spec === '@/lib/mailer') return { url: 'stub:mailer', shortCircuit: true, format: 'module' };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url === 'stub:prisma') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__db.prisma;' };
  if (url === 'stub:settings') return { format: 'module', shortCircuit: true, source: 'export const getAllCachedSettings = async () => globalThis.__db.settings(); export const getCachedSetting = async (k) => globalThis.__db.settings().find((r) => r.key === k) || null; export const invalidateSettingsCache = () => {};' };
  if (url === 'stub:mailer') return { format: 'module', shortCircuit: true, source: 'export const sendSystemEmail = async (m) => { globalThis.__db.sent.push(m); return { success: true }; };' };
  return next(url, ctx);
}`), import.meta.url);

const SETTINGS = {
  gmach_name: 'נווה יעקב', gmach_address: 'צוקרמן 1 נווה יעקב - גבעת שאול 23. שימו לב: הערה', gmach_phone: '02-1112222',
  gmach_pickup_address: 'צוקרמן 1, נווה יעקב', enable_deliveries: 'true', useModelNames: 'false',
};
const state = { settings: { ...SETTINGS }, items: [] };
globalThis.__db = {
  sent: [],
  settings: () => Object.entries(state.settings).map(([key, value]) => ({ key, value })),
  prisma: { orderItem: { findMany: async () => state.items } },
};

const { sendOrderConfirmationEmail } = await import('../../lib/orderConfirmationMail.js');
const { loadDeliverySection } = await import('../../lib/orderDeliveryServer.js');
const { getEmailConfig } = await import('../../lib/emailConfig.js');

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', String(e.message).slice(0, 700)); process.exitCode = 1; } };
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const order = (over = {}) => ({
  orderId: 5001, customerId: 'c1', customer: { firstName: 'דנה', lastName: 'כהן', email: 'dana@example.test', city: 'ירושלים' },
  eventDate: new Date('2026-11-18T00:00:00Z'), eventDateHebrew: 'י"ח חשוון תשפ"ז', status: 'חדש', hasSignedRegulations: false,
  isDelivery: false, obligations: [{ amount: 300, description: 'שמלה', isDeleted: false }], payments: [{ amount: 100, isDeleted: false }], ...over,
});
const deliveryOrder = (dir) => order({
  isDelivery: true, deliveryDirection: dir, deliveryCity: 'ירושלים', deliveryAddress: 'הרצל 5',
  obligations: [{ amount: 300, description: 'שמלה', isDeleted: false }, { amount: dir === 'הלוך-חזור' ? 120 : 60, description: `משלוח ${dir} - ירושלים`, isDeleted: false }],
});
async function send(o, { settings = {}, delivery } = {}) {
  state.settings = { ...SETTINGS, ...settings };
  globalThis.__db.sent.length = 0;
  const emailCfg = await getEmailConfig('orderCreatedAuto');
  const d = delivery === undefined ? await loadDeliverySection(o, { settings: globalThis.__db.settings() }) : delivery;
  const r = await sendOrderConfirmationEmail(o, { emailCfg, wait: true, delivery: d });
  assert.equal(r.success, true);
  const m = globalThis.__db.sent[0];
  return { ...m, text: strip(m.html) };
}

await t('הזמנה רגילה: כתובת האיסוף = gmach_pickup_address (לא gmach_address), קישור מפות, קבלה/החזרה, בלי בלוק משלוח; גוף טקסט ו-HTML תואמים', async () => {
  state.items = [{ description: 'ללא שם - 1243', sizeText: '38', dressItem: { barcodePrefix: 522, dress: { name: 'ללא שם - 1243', barcodePrefix: 522 } } }];
  const m = await send(order());
  assert.ok(m.text.includes('קבלת השמלות') && m.text.includes('החזרת השמלות'));
  assert.ok(m.text.includes('כתובת האיסוף: צוקרמן 1, נווה יעקב'));
  assert.ok(!m.text.includes('גבעת שאול'), 'לא gmach_address');
  assert.ok(m.html.includes('href="https://www.google.com/maps/search/?api=1&amp;query=') && m.text.includes('פתיחה במפות Google'));
  assert.ok(!m.text.includes('משלוח') && !m.text.includes('חתם/ה'));
  assert.ok(m.body.includes('כתובת איסוף: צוקרמן 1, נווה יעקב') && m.body.includes('פתיחה במפות Google: https://www.google.com/maps/search/'));
  assert.ok(m.body.includes('פריטים: 522 (מידה: 38)'), 'שם דגם: המספר, לא "ללא שם - 1243" (patch 02)');
  assert.ok(m.text.includes('522') && !m.text.includes('ללא שם'));
});

await t('בלי gmach_pickup_address: נשארת gmach_address ובלי קישור מפות (אופט-אין, הגמ"ח הראשי)', async () => {
  const m = await send(order(), { settings: { gmach_pickup_address: '', gmach_pickup_maps_url: '', enable_deliveries: undefined } });
  assert.ok(m.text.includes('כתובת האיסוף: צוקרמן 1 נווה יעקב - גבעת שאול 23'));
  assert.ok(!m.html.includes('google.com/maps') && !m.body.includes('מפות'));
});

await t('חתימה על התקנון (#276): שורה ב-HTML וב-plain, רק כשחתמה', async () => {
  const yes = await send(order({ hasSignedRegulations: true }));
  assert.ok(yes.text.includes('חתם/ה על תקנון ההשכרה ✓') && yes.body.includes('חתם/ה על תקנון ההשכרה ✓'));
  const no = await send(order());
  assert.ok(!no.text.includes('חתם/ה על תקנון') && !no.body.includes('חתם/ה על תקנון'));
});

await t('משלוח הלוך-חזור (החלטה 27): בלי קבלה/החזרה/כתובת איסוף/מפות; יש פרטי משלוח, "מתוכם" ו"שימו לב"; ההזמנה עצמה והסכום זהים', async () => {
  const m = await send(deliveryOrder('הלוך-חזור'));
  assert.ok(!m.text.includes('קבלת השמלות') && !m.text.includes('החזרת השמלות') && !m.text.includes('כתובת האיסוף') && !m.html.includes('google.com/maps'));
  assert.ok(m.text.includes('הרצל 5, ירושלים') && m.text.includes('מתוכם משלוח הלוך ₪60') && m.text.includes('אין צורך לבוא לגמ"ח'));
  assert.ok(m.text.includes('פרטי קשר') && m.text.includes('טלפון: 02-1112222'));
  assert.ok(m.text.includes('₪420'), 'סה"כ לחיוב כולל את המשלוח');
  assert.ok(!m.body.includes('כתובת איסוף') && !m.body.includes('קבלת השמלות:') && m.body.includes('מתוכם משלוח הלוך: ₪60') && m.body.includes('אין צורך לבוא לגמ"ח'));
});

await t('משלוח הלוך בלבד: רק החזרה + כתובת + קישור מפות (המשלוחן מביא, הלקוחה מחזירה בגמ"ח); חזור בלבד: רק קבלה + כתובת', async () => {
  const out = await send(deliveryOrder('הלוך'));
  assert.ok(out.text.includes('החזרת השמלות') && !out.text.includes('קבלת השמלות') && out.text.includes('כתובת האיסוף: צוקרמן 1, נווה יעקב') && out.html.includes('google.com/maps'));
  const back = await send(deliveryOrder('חזור'));
  assert.ok(back.text.includes('קבלת השמלות') && !back.text.includes('החזרת השמלות') && back.text.includes('כתובת האיסוף'));
});

await t('delivery_as_item_row: שורות פריט לכל כיוון עם מחיר, גם בגוף הטקסט; "פריטים" לא נשבר בהזמנה בלי פריטים', async () => {
  state.items = [];
  const m = await send(deliveryOrder('הלוך-חזור'), { settings: { delivery_as_item_row: 'true' } });
  assert.equal(m.html.split('🚚').length - 1, 2);
  assert.ok(m.body.includes('פריטים: ללא פירוט, משלוח הלוך (הרצל 5, ירושלים') && m.body.includes('- ₪60'));
});

await t('עריכה במרכז המיילים (cfg.texts) מחליפה את הכיתובים במסלול המנוהל; בלי עריכה הכול כמו ההגדרות', async () => {
  const probe = await getEmailConfig('orderCreatedAuto');
  assert.equal(typeof probe, 'object');
  // עקיפה דרך ה-cfg שמועבר לפונקציה (אותו אובייקט ש-getEmailConfig בונה משורות השמורות במרכז המיילים)
  state.settings = { ...SETTINGS, delivery_as_item_row: 'true' };
  globalThis.__db.sent.length = 0;
  const o = deliveryOrder('הלוך-חזור');
  const d = await loadDeliverySection(o, { settings: globalThis.__db.settings() });
  await sendOrderConfirmationEmail(o, { emailCfg: { ...probe, customized: true, texts: { deliveryNotice: 'המשלוחן יצור קשר', lblDeliveryOut: 'משלוח אליך' } }, wait: true, delivery: d });
  const m = globalThis.__db.sent[0];
  const text = strip(m.html);
  assert.ok(text.includes('המשלוחן יצור קשר') && !text.includes('אין צורך לבוא') && text.includes('משלוח אליך') && text.includes('מתוכם משלוח אליך'));
});

await t('אתרי הקריאה: POST /api/orders ו-cron/daily מעבירים delivery מ-loadDeliverySection; cron: כללי תזכורות משלוח + כתובת איסוף', () => {
  const orders = fs.readFileSync(new URL('../../app/api/orders/route.js', import.meta.url), 'utf8');
  assert.match(orders, /const delivery = await loadDeliverySection\(updatedOrder\);[\s\S]{0,400}sendOrderConfirmationEmail\(updatedOrder, \{ emailCfg, delivery \}\)/);
  const cron = fs.readFileSync(new URL('../../app/api/cron/daily/route.js', import.meta.url), 'utf8');
  assert.match(cron, /sendOrderConfirmationEmail\(o, \{ emailCfg: cfg, wait: true, delivery: await loadDeliverySection\(o, \{ settings \}\) \}\)/);
  assert.ok(cron.includes('skipPickupReminderForDelivery(o, deliveriesEnabled)') && cron.includes('skipReturnReminderForDelivery(o, deliveriesEnabled)'));
  assert.ok(cron.includes('cfg.fixed.gmachAddress || pickupAddressFrom(get)') && cron.includes('gmachAddress: pickupAddressFrom(get)'), 'כתובת האיסוף בתזכורות');
  assert.ok(!orders.includes("const body = `שלום ${updatedOrder.customer.firstName"), 'הלוגיקה לא שוכפלה בנתיב ההזמנות');
});

console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
