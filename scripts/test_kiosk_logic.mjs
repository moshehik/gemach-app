// בדיקות טהורות ללוגיקה של עמדת הלקוח החדשה (app/components/kiosk/kioskLogic.js): שמות דגם, סיכום מידות, לוח עברי, ולידציית "מילוי פרטים אישיים".
// הרצה (מהשורש): node scripts/test_kiosk_logic.mjs   (בלי DB ובלי שרת; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate } from '@hebcal/core';
import {
  escHtml, getModelDisplayName, modelHasRealName, modelInitials, tileColor, getModelSizeInfo, buildSizeChipData,
  getMonthsForYear, holidayLabel, parshaLabelForSaturday, buildMonthCells, formatHebrewDate, gershayim, getMissingRegFields, settingsFromRules,
} from '../app/components/kiosk/kioskLogic.js';
import { submitRegistration, REGISTRATION_ENDPOINT } from '../app/components/kiosk/kioskRegistrationApi.js';

let passed = 0;
const tasks = [];
const h = (title) => tasks.push([null, title]);
const t = (name, fn) => tasks.push([name, fn]);

h('שמות דגם');
t('"ללא שם" מוצג כמספר הדגם; שם רגיל נשאר', () => {
  assert.equal(getModelDisplayName({ name: 'ללא שם - 1245', barcodePrefix: 565 }), '565');
  assert.equal(getModelDisplayName({ name: 'אבן חרוזים', barcodePrefix: 440 }), 'אבן חרוזים');
});
t('שם שהוא בדיוק הקידומת אינו שם תיאורי', () => {
  assert.equal(modelHasRealName({ name: '316', barcodePrefix: 316 }), false);
  assert.equal(modelHasRealName({ name: 'ללא שם', barcodePrefix: 1 }), false);
  assert.equal(modelHasRealName({ name: 'אבן חרוזים', barcodePrefix: 440 }), true);
});
t('אותיות הדגם: שתי מילים = אות מכל אחת; מספר מלא עד 3 ספרות', () => {
  assert.equal(modelInitials({ name: 'ורוד חלק', barcodePrefix: 1 }), 'וח');
  assert.equal(modelInitials({ name: '3060', barcodePrefix: 3060 }), '306');
  assert.equal(modelInitials({ name: 'שחור', barcodePrefix: null }), 'שח');
});
t('צבע האריח יציב לאותו דגם ובתוך הרשימה', () => {
  const c = tileColor({ barcodePrefix: 440 });
  assert.equal(c, tileColor({ barcodePrefix: 440 }));
  assert.match(c, /^#[0-9a-f]{6}$/);
});
t('escHtml מנטרל HTML', () => assert.equal(escHtml('<b>"x"&\'</b>'), '&lt;b&gt;&quot;x&quot;&amp;&#39;&lt;/b&gt;'));

h('סיכום מידות');
const MODEL = { items: [
  { sizeText: '38', quantity: 1, count: 2 },
  { sizeText: '38', quantity: 0, count: 1 },
  { sizeText: '40', quantity: 0 },
  { sizeText: '42', quantity: 3, notInUse: true },
  { sizeText: '44', quantity: 1, isDeleted: true },
  { sizeText: '46', quantity: 1, isUnusable: true },
  { quantity: 1 },
] };
t('פריטים לא-בשימוש / מחוקים / לא-שמישים לא נספרים; count מקבץ; בלי מידה = "כללי"', () => {
  const info = getModelSizeInfo(MODEL);
  assert.deepEqual(info.sizesArray.map(([s]) => s).sort(), ['38', '40', 'כללי'].sort());
  const m = Object.fromEntries(info.sizesArray);
  assert.deepEqual(m['38'], { available: 2, total: 3 });
  assert.deepEqual(m['40'], { available: 0, total: 1 });
  assert.equal(info.totalAvailable, 3);
  assert.equal(info.totalUnits, 5);
});
t('מידות לחיפוש: ייחודיות, ממוינות מספרית, עם מספר הדגמים לכל מידה', () => {
  const data = buildSizeChipData([MODEL, { items: [{ sizeText: '38', quantity: 1 }, { sizeText: '9', quantity: 1 }] }]);
  assert.deepEqual(data, [['9', 1], ['38', 2], ['40', 1]]);
});

h('לוח עברי');
t('חודשי שנה מעוברת כוללים אדר א\' / אדר ב\'', () => {
  const leap = getMonthsForYear(5784).map((m) => m.label);
  assert.ok(leap.includes("אדר א'") && leap.includes("אדר ב'"));
  const plain = getMonthsForYear(5786).map((m) => m.label);
  assert.ok(plain.includes('אדר') && !plain.includes("אדר ב'"));
});
t('תאי חודש: ריקים לפני היום הראשון ואז כל ימי החודש', () => {
  const hd = new HDate(1, 8, 5787); // א' חשוון תשפ"ז
  const cells = buildMonthCells(8, 5787);
  const blanks = cells.findIndex((c) => c !== null);
  assert.equal(blanks, hd.greg().getDay());
  assert.equal(cells.filter(Boolean).length, HDate.daysInMonth(8, 5787));
});
t('חגים בישראל: ראש השנה, שמחת תורה, פסח; יום רגיל בלי שם', () => {
  assert.equal(holidayLabel(new HDate(1, 7, 5787)), 'ראש השנה');
  assert.equal(holidayLabel(new HDate(22, 7, 5787)), 'שמחת תורה');
  assert.equal(holidayLabel(new HDate(15, 1, 5787)), 'פסח');
  assert.equal(holidayLabel(new HDate(5, 8, 5787)), null);
});
t('פרשה רק בתא של שבת', () => {
  const sat = new HDate(new Date(2026, 9, 10, 12)); // 10.10.2026 = שבת בראשית
  assert.equal(sat.getDay(), 6);
  assert.equal(parshaLabelForSaturday(sat), 'בראשית');
  assert.equal(parshaLabelForSaturday(new HDate(new Date(2026, 9, 11, 12))), null);
});
t('כתיב התאריך העברי: גרשיים באותיות היום והשנה, בלי תאריך לועזי', () => {
  assert.equal(gershayim('יג'), 'י״ג');
  assert.equal(gershayim('ט'), 'ט׳');
  const s = formatHebrewDate(new Date(2026, 9, 25, 12)); // י"ד חשוון תשפ"ז
  assert.equal(s, 'י״ד חשוון תשפ״ז');
  assert.equal(formatHebrewDate('not a date'), '');
});

h('מילוי פרטים אישיים - ולידציה');
const FULL = { firstName: 'א', lastName: 'ב', zeout: '', phone1: '0501234567', email: '', city: '', street: '', houseNum: '', acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true };
t('טופס מלא בהגדרות ברירת מחדל: אין חסר', () => assert.deepEqual(getMissingRegFields(FULL, {}), []));
t('שם פרטי / משפחה / טלפון תמיד חובה', () => {
  assert.deepEqual(getMissingRegFields({ ...FULL, firstName: ' ', lastName: '', phone1: '' }, {}), ['firstName', 'lastName', 'phone1']);
});
t('בחירות מפורשות: null = חסר (כן וגם לא הן תשובות תקפות); אישור פרטיות חייב להיות מסומן', () => {
  assert.deepEqual(getMissingRegFields({ ...FULL, acceptedTerms: null, marketingConsent: null, acceptedPrivacy: false }, {}), ['acceptedTerms', 'marketingConsent', 'acceptedPrivacy']);
  assert.deepEqual(getMissingRegFields({ ...FULL, acceptedTerms: false, marketingConsent: true }, {}), []);
});
t('hide_marketing_consent_field: שאלת הדיוור לא נדרשת', () => {
  assert.deepEqual(getMissingRegFields({ ...FULL, marketingConsent: null }, { hide_marketing_consent_field: 'true' }), []);
});
t('require_marketing_consent: "לא" אינו מספיק', () => {
  assert.deepEqual(getMissingRegFields({ ...FULL, marketingConsent: false }, { require_marketing_consent: 'true' }), ['marketingConsent']);
  assert.deepEqual(getMissingRegFields({ ...FULL, marketingConsent: true }, { require_marketing_consent: 'true' }), []);
});
t('הגדרות חובה: מייל / כתובת מלאה / ת"ז / mandatory_fields חופשי', () => {
  assert.deepEqual(getMissingRegFields(FULL, { require_customer_email: 'true' }), ['email']);
  assert.deepEqual(getMissingRegFields(FULL, { require_full_address: 'true' }), ['city', 'street', 'houseNum']);
  assert.deepEqual(getMissingRegFields(FULL, { require_customer_id_number: 'true' }), ['zeout']);
  assert.deepEqual(getMissingRegFields(FULL, { mandatory_fields: 'עיר, מספר בית' }), ['city', 'houseNum']);
});

t('רמזי ה-API הציבורי הופכים להגדרות שהוולידציה מכירה', () => {
  const eff = settingsFromRules({ required: { email: true, address: true, idNumber: false }, oneOf: [], marketingMustBeYes: true });
  assert.deepEqual(getMissingRegFields({ ...FULL, marketingConsent: false }, eff), ['email', 'city', 'street', 'houseNum', 'marketingConsent']);
  assert.deepEqual(settingsFromRules(null), {});
});

h('submitRegistration (fetch מדומה)');
const withFetch = async (impl, fn) => { const real = globalThis.fetch; globalThis.fetch = impl; try { return await fn(); } finally { globalThis.fetch = real; } };
const reply = (status, json) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => json });
let sent = null;
t('גוף הבקשה: idNumber, channel לפי mode, honeypot, הסכמות מפורשות', async () => {
  await withFetch(async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ ok: true }) }; }, async () => {
    const r = await submitRegistration({ ...FULL, zeout: '123456789', acceptedTerms: false }, { mode: 'public' });
    assert.equal(r.ok, true);
  });
  assert.equal(sent.url, REGISTRATION_ENDPOINT);
  assert.equal(sent.body.channel, 'public');
  assert.equal(sent.body.idNumber, '123456789');
  assert.equal(sent.body.acceptedTerms, false);
  assert.equal(sent.body.marketingConsent, false);
  assert.equal(sent.body.website, '');
  await withFetch(async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ ok: true }) }; }, async () => {
    await submitRegistration({ ...FULL, acceptedTerms: null, marketingConsent: null });
  });
  assert.equal(sent.body.channel, 'kiosk');
  assert.equal(sent.body.acceptedTerms, null);
});
t('400: שגיאות ושדות מהשרת; 404 / 429 / רשת: הודעה ברורה', async () => {
  const bad = await withFetch(reply(400, { ok: false, code: 'validation', errors: ['שם פרטי חובה'], fields: { firstName: 'שם פרטי חובה' } }), () => submitRegistration(FULL));
  assert.equal(bad.ok, false); assert.deepEqual(bad.fields, { firstName: 'שם פרטי חובה' }); assert.match(bad.error, /שם פרטי חובה/);
  assert.equal((await withFetch(reply(404, { ok: false }), () => submitRegistration(FULL))).status, 404);
  assert.equal((await withFetch(reply(429, { ok: false }), () => submitRegistration(FULL))).status, 429);
  const net = await withFetch(async () => { throw new Error('x'); }, () => submitRegistration(FULL));
  assert.equal(net.ok, false); assert.equal(net.status, 0);
});

h('חיבור קבצים');
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const kiosk = read('../app/components/kiosk/KioskA5.js');
const reg = read('../app/components/kiosk/KioskRegistration.js');
const api = read('../app/components/kiosk/kioskRegistrationApi.js');
t('שליחת הרישום עוברת בפונקציה אחת (submitRegistration) ובה בלבד נקרא ה-endpoint', () => {
  assert.match(api, /export async function submitRegistration/);
  assert.match(api, /REGISTRATION_ENDPOINT/);
  assert.doesNotMatch(reg, /fetch\('\/api\/customers/);
  assert.doesNotMatch(kiosk, /fetch\('\/api\/customers/);
});
t('הטופס שולח את שדות ההסכמה בשמות המוסכמים', () => {
  for (const k of ['acceptedTerms', 'marketingConsent', 'acceptedPrivacy']) assert.match(api, new RegExp(k));
});
t('כל הגדרות העמדה הקיימות עדיין נקראות', () => {
  for (const k of ['kiosk_customer_self_service', 'kiosk_sticky_date_bar', 'kiosk_model_search', 'kiosk_size_qty_contrast', 'hide_dress_images', 'hide_ai_features', 'enable_ai_specific_employees']) assert.match(kiosk, new RegExp(k));
});
t('המסלול הציבורי: רק API ציבורי, בלי נעילה / AI / קוד עובד / התחברות', () => {
  const pub = read('../app/components/kiosk/KioskPublic.js').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join(' '); // בלי הערות
  const station = read('../app/station/page.js');
  assert.match(pub, /\/api\/public-kiosk\/models/);
  assert.match(pub, /mode="public"/);
  for (const forbidden of ['/api/dresses', '/api/settings', '/api/employees', '/api/login', '/api/ai', 'requestFullscreen', 'hide-global-nav']) assert.ok(!pub.includes(forbidden), forbidden);
  assert.match(station, /loadPublicKioskConfig/);
  assert.match(station, /KioskPublic/);
  assert.doesNotMatch(station, /cfg.storeSelfService/);
});
t('הנעילה: מחלקת הגוף, מסך מלא, שחרור באישור עובד ו-/api/login', () => {
  assert.match(kiosk, /hide-global-nav/);
  assert.match(kiosk, /requestFullscreen/);
  assert.match(kiosk, /fullscreenchange/);
  assert.match(kiosk, /\/api\/login/);
});

for (const [name, fn] of tasks) {
  if (name === null) { console.log(fn); continue; }
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, e.message); process.exitCode = 1; }
}
console.log(passed + ' passed' + (process.exitCode ? ' (with failures)' : ''));
