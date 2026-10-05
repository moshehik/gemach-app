// בדיקות סטטיות של לשוניות פרטים/משלוח (W2a): רישום הלשוניות, עריכה רק דרך oc.edit, אישור הציפוף, נקודות ההרחבה ל-W2b/W7,
// הסרות §B (R17/R22/A8 מחוץ לפרטים), בלי כיתובים שלא בעיצוב, טקסטים שהבעלים אישר (AMB-12), ומקורות העיצוב (מזהי ה-markup).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const OC = path.join(process.env.PROJ, 'app/components/order-card');
const read = (p) => fs.readFileSync(path.join(OC, p), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const DET = strip(read('tabs/OcDetailsTab.js'));
const DEL = strip(read('tabs/OcDeliveryTab.js'));
const CAL = strip(read('parts/OcHebrewCalendar.js'));
const SWP = strip(read('parts/OcCustomerSwap.js'));
const LOGIC = strip(read('parts/ocDetailsLogic.js'));
const ALL = [DET, DEL, CAL, SWP, LOGIC].join('\n');
const CSS = read('css/oc-details.css');

test('הלשוניות רשומות ב-tabs/index.js (שורה לכל אחת)', () => {
  const idx = read('tabs/index.js');
  assert.match(idx, /import OcDetailsTab from '\.\/OcDetailsTab';/);
  assert.match(idx, /import OcDeliveryTab from '\.\/OcDeliveryTab';/);
  assert.match(idx, /details: OcDetailsTab,/);
  assert.match(idx, /delivery: OcDeliveryTab,/);
});

test('כל עריכה דרך oc.edit.setOrder עם עדכון פונקציונלי (כמו handleChange של הישן) - בלי setField/setOrder ישיר', () => {
  assert.ok(!/oc\.edit\.setField\(/.test(DET + DEL), 'setField דורס את ההזמנה מה-closure (בישן: prev => ...)');
  for (const m of (DET + DEL).matchAll(/oc\.edit\.setOrder\(([^)]{0,12})/g)) assert.match(m[1], /^prev =>/, 'setOrder חייב לקבל פונקציה');
  assert.ok(!/fetch\(`\/api\/orders\/\$\{/.test(DET + DEL), 'הלשונית לא שולחת PUT בעצמה - השמירה של הבקר');
});

test('המטפלים בלשונית קוראים לפונקציות הפורט (שנבדקות בזוגיות מול הישן)', () => {
  for (const f of ['withDateUpdates({ eventDate: k })', 'rangeUpdates(prev, a, b)', 'eventTypeUpdates(prev, !isRangeEvent(prev))', 'extraDayUpdates(prev, v)', 'spacingDecision(', 'customerUpdates(picked)']) assert.ok(DET.includes(f), f);
  assert.ok(DET.includes("oc.approve('feature:special_spacing_approval'"), 'R18: אישור מנהל בהקטנת הציפוף (אותו מפתח כמו הישן)');
  assert.ok(DET.includes('oc.toggleSignature()'), 'חתימה דרך הבקר');
  assert.ok(SWP.includes('newCustomerBody(form, settings)') && SWP.includes("fetch('/api/customers', { method: 'POST'"), 'R19: POST /api/customers');
  assert.ok(SWP.includes('`/api/customers?search=${encodeURIComponent(debounced)}&limit=50`'), 'חיפוש לקוח = אותה קריאה כמו CustomerSelector');
  for (const u of ['set({ isDelivery: e.target.checked })', 'set({ deliveryDirection: v })', 'set({ deliveryCity: v })', 'set({ deliveryAddress: v })', 'set({ deliveryOneDayBefore: !order.deliveryOneDayBefore })']) assert.ok(DEL.includes(u), u);
});

test('תנאי תצוגה כמו בישן: משלוח רק עם enable_deliveries; בתוך "פרטים" רק בלי לשונית נפרדת; ציפוף מוסתר ב-hide_custom_spacing; יום נוסף לפי ההגדרה', () => {
  assert.ok(DEL.includes('if (!ds.enabled) return null;'));
  assert.ok(DET.includes('s.enableDeliveries && !s.deliverySeparateTab ? <OcDeliveryCards'));
  assert.ok(DET.includes('const hide = !!s.hideCustomSpacing;') && DET.includes('{!hide ? ('));
  assert.ok(DET.includes('const showXday = extraDayVisible(s);'));
  assert.ok(DEL.includes('{fs.showAddress ? (') && DEL.includes('{ds.oneDayBeforeOption ? ('));
});

test('נקודות הרחבה: SLOTS.DeliveryJoinPicker (W2b) בלשונית המשלוח, SLOTS.QuickMailButton (W7) בכרטיס הלקוח - אופציונליות', () => {
  assert.ok(DEL.includes('const JoinPicker = SLOTS.DeliveryJoinPicker;') && DEL.includes('{JoinPicker ? <JoinPicker oc={oc} ui={ui} /> : null}'));
  assert.ok(DET.includes('const QuickMail = SLOTS.QuickMailButton;') && DET.includes('{QuickMail && oc.settings.orderQuickMailEnabled ? <div className="oc-qm"><QuickMail oc={oc} ui={ui} /></div> : null}'));
});

test('הסרות §B: אין עריכת תאריך ביצוע (R17), אין "תשלום/זיכוי ידני" (R22 → תשלומים), אין מייל מהיר עצמאי (A8 → W7)', () => {
  assert.ok(!/orderDate/.test(DET + DEL), 'R17');
  assert.ok(!/order_date_edit_approval|customer_email_approval|manual_payment_credit|onOpenManualPaymentCredit/.test(ALL));
  assert.ok(!/mail-open|\/email`/.test(ALL), 'A8 שייך ל-W7');
});

test('אין כיתובים שלא בעיצוב / של שכבת הסקירה ("לפי הגדרות", "ערכי דוגמה", "הדגמה", "ברירת מחדל)")', () => {
  for (const bad of ['לפי הגדרות', 'ערכי דוגמה', 'הדגמה', '(ברירת מחדל)', 'קוד הדגמה', 'pv-', 'data-pvk']) assert.ok(!ALL.includes(bad), bad);
});

test('טקסטים: כותרות ההערות (R15 + AMB-12), שורת R18, הטולטיפים של העיצוב', () => {
  for (const t of ['הערות להזמנה (מוצג ללקוח ומודפס)', 'הערות פנימיות (לא מוצג ללקוח)', 'רגיל לפי המערכת: {def} ימים · הקטנה דורשת אישור מנהל',
    'מוצג ברשימה ומודפס פעם אחת', 'טווח תאריכים חופשי', 'להזמנה זו בלבד · דורש מנהל', 'תוספת 50% מסך ההזמנה', 'משלוח אחד בלבד להזמנה',
    'רק אם שונה מכתובת הלקוח', 'ברירת מחדל: יומיים לפני', 'טווח תאריכים (לקיחה והחזרה)', 'לאירוע חו״ל: טווח חופשי', 'פרטים מתקדמים', 'יוצא יום לפני האירוע', 'הזמנה עם משלוח']) {
    assert.ok(ALL.includes(t), t);
  }
});

test('markup של העיצוב: מזהים ומחלקות (card cust, kv/f/miss/missv, #termsBtn, #evType, .hc, #adv, #spacing, .dhero, .dfields, #delOn, #dirSeg, #delCityIn, #delAddr, #delOneBtn)', () => {
  for (const s of ['className="card cust"', 'className={`f${!has && missing ? \' miss\' : \'\'}`}', 'className="missv"', 'id="termsBtn"', 'id="evType"', 'id="adv"', 'id="spacing"', 'id="xday"']) assert.ok(DET.includes(s), s);
  for (const s of ['className={`dhero${on ? \'\' : \' off\'}`}', 'className={`card dfields${on ? \'\' : \' off\'}`}', 'id="delOn"', 'id="dirSeg"', 'id="delCityIn"', 'id="delAddr"', 'id="delOneBtn"', 'className="advlist"', 'className="inpx"']) assert.ok(DEL.includes(s), s);
  for (const s of ['className="hc-h"', 'className="hc-w"', 'className="hc-g"', 'className="hc-e"', "'hc-d'", "'sh'", "'today'", 'data-hnav="-1"', 'hc-n hc-nn']) assert.ok(CAL.includes(s), s);
  for (const s of ['id="ocCustSeg"', 'className="seg pill"', 'השלם ל- @gmail.com', 'שמור ובחר', 'לקוח קיים', 'לקוח חדש']) assert.ok(SWP.includes(s), s);
});

test('לוח עברי בלבד: אין תאריך לועזי, אין Intl/toLocale, אין HebrewDatePicker/HebrewDateRangePicker הישנים', () => {
  assert.ok(!/toLocaleDateString|toLocaleString|Intl\./.test(ALL));
  assert.ok(!/HebrewDatePicker|HebrewDateRangePicker|CustomerSelector/.test(ALL), 'רכיבי הישן לא נכנסים ל-.gm-ds');
  assert.ok(!/getHebrewDateString\(/.test(DET + DEL + CAL), 'בתצוגה - הפורמט של העיצוב (גרשיים); getHebrewDateString רק לערך השמור');
});

test('CSS: oc-details.css בלי !important (נשען על הפלטה), בלי צבע לבן קשיח; תוכן המשלוח בלי עטיפה (ילדים ישירים של הלוח, כמו בעיצוב)', () => {
  const body = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/!important/.test(body));
  assert.ok(!/#fff\b|#ffffff\b|\bwhite\b/i.test(body));
  assert.ok(/return \(\s*<>\s*<div className=\{`dhero/.test(DEL) && !/className="oc-del"/.test(DEL), 'OcDeliveryCards מחזיר fragment');
  assert.ok((DEL.match(/className="amsg oc-fmsg"/g) || []).length === 2, 'הודעות החובה = .amsg של הפלטה');
});
