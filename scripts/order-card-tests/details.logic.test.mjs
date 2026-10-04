// לוגיקה טהורה של לשוניות פרטים/משלוח (W2a): הלוח העברי הפנימי (A9) - חודש עברי שלם, היסט היום הראשון, ניווט בין חודשים ושנים,
// שנה מעוברת, כותרות עבריות בלבד - זהה בכל אזור זמן; ת״ז מוסתרת כששער האימות דולק; "חסר" לפי ההגדרות (AMB-10). 3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { HDate } from '@hebcal/core';

const P = process.env.PROJ;
const D = await import(pathToFileURL(P + '/app/components/order-card/parts/ocDetailsLogic.js').href);
const L = await import(pathToFileURL(P + '/app/components/order-card/orderCardLogic.js').href);
const HD = await import(pathToFileURL(P + '/lib/hebrewDate.js').href);

const LATIN = /[0-9]{1,2}[./][0-9]{1,2}|[A-Za-z]/;

test('כותרת יום: "יום חמישי כ״ז תשרי תשפ״ז" - עברית בלבד, אותו פלט בכל אזור זמן', () => {
  assert.equal(D.dayTitle('2026-10-08'), 'יום חמישי כ״ז תשרי תשפ״ז');
  assert.equal(D.dayTitle('2026-10-10'), 'שבת כ״ט תשרי תשפ״ז');
  assert.equal(D.dayTitle('2026-09-12'), 'שבת א׳ תשרי תשפ״ז');
  assert.equal(D.hebDateLabel('2027-03-10'), 'א׳ אדר ב\' תשפ״ז');
  assert.equal(D.hebDayLabel('2026-10-17'), 'ו׳');
  assert.equal(D.hebDayLabel('2026-09-26'), 'ט״ו');
  for (const k of ['2026-10-08', '2027-01-01', '2026-03-29']) assert.ok(!LATIN.test(D.dayTitle(k)), D.dayTitle(k));
  assert.equal(D.dayTitle(''), '');
});

test('חודש עברי: היום הראשון, מספר הימים (29/30) והיסט עמודת השבוע - מול hebcal', () => {
  for (const key of ['2026-10-08', '2026-11-15', '2027-02-20', '2027-03-20', '2027-04-01', '2027-09-30']) {
    const start = D.hebMonthStartKey(key);
    const [y, m, d] = key.split('-').map(Number);
    const hd = new HDate(new Date(y, m - 1, d, 12));
    const first = new HDate(1, hd.getMonth(), hd.getFullYear()).greg();
    assert.equal(start, `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}`);
    const { blanks, days } = D.calendarCells(start);
    assert.equal(days.length, HDate.daysInMonth(hd.getMonth(), hd.getFullYear()));
    assert.equal(blanks, first.getDay());
    assert.equal(days[0], start);
    assert.ok(days.includes(key));
    assert.equal(D.hebDayLabel(days[0]), 'א׳');
    for (let i = 1; i < days.length; i++) assert.equal(HD.addDaysToDateKey(days[i - 1], 1), days[i]);
  }
});

test('ניווט: תשרי ← אלול (מעבר שנה), אדר א׳ → אדר ב׳ → ניסן בשנה מעוברת, וחזרה', () => {
  const tishrei = D.hebMonthStartKey('2026-10-08'); // א׳ תשרי תשפ״ז
  assert.equal(D.monthTitle(tishrei), 'תשרי תשפ״ז');
  const elul = D.navMonth(tishrei, -1);
  assert.equal(D.monthTitle(elul), 'אלול תשפ״ו');
  assert.equal(D.navMonth(elul, 1), tishrei);
  let k = tishrei; const titles = [];
  for (let i = 0; i < 8; i++) { k = D.navMonth(k, 1); titles.push(D.monthTitle(k)); }
  assert.deepEqual(titles, ['חשוון תשפ״ז', 'כסלו תשפ״ז', 'טבת תשפ״ז', 'שבט תשפ״ז', 'אדר א\' תשפ״ז', 'אדר ב\' תשפ״ז', 'ניסן תשפ״ז', 'אייר תשפ״ז']);
  for (let i = 0; i < 8; i++) k = D.navMonth(k, -1);
  assert.equal(k, tishrei);
});

test('יום בשבוע ממפתח: לוח שנה טהור (שבת = 6), לא תלוי באזור הזמן', () => {
  assert.equal(D.weekdayOf('2026-10-10'), 6);
  assert.equal(D.weekdayOf('2026-10-11'), 0);
  assert.equal(D.weekdayOf('2026-03-27'), 5);
});

test('מפתח התאריך של ערך שמור = היום בישראל (חצות ישראל ב-UTC, תאריך בלבד, ריק)', () => {
  assert.equal(D.dateKeyOf('2026-10-07T21:00:00.000Z'), '2026-10-08');
  assert.equal(D.dateKeyOf('2026-10-08'), '2026-10-08');
  assert.equal(D.dateKeyOf(null), '');
  assert.equal(D.dateKeyOf('לא תאריך'), '');
});

test('W2A-ID: ת״ז מוצגת תמיד במלואה - גם כשאימות הת״ז לעריכה/ביטול (R13) דולק; אין מסיכה', () => {
  assert.equal(D.zeoutDisplay('312456789'), '312456789');
  assert.equal(D.zeoutDisplay('312456789', { requireIdForEdit: true }), '312456789');
  assert.equal(D.zeoutDisplay(' 312456789 ', { requireCustomerIdNumber: true, requireIdForEdit: true }), '312456789');
  assert.equal(D.zeoutDisplay(''), '');
  assert.equal(D.zeoutDisplay(null), '');
  assert.equal(D.MASK_ZEOUT_WHEN_ID_GATE, undefined, 'מסלול המסיכה הוסר');
});

test('"חסר" לת״ז לפי require_customer_id_number בלבד (AMB-10, הכרעת הבעלים) - אותה הכרעה כמו סמן הלשונית של הבקר', () => {
  const c = { phone1: '1', email: 'a@b', city: 'x', zeout: '' };
  for (const s of [{}, { requireCustomerIdNumber: true }, { requireIdForEdit: true }, { requireCustomerIdNumber: true, requireIdForEdit: true }]) {
    const tabSaysMissing = L.customerMissing(c, s).some((x) => x.key === 'zeout');
    assert.equal(D.zeoutRequired(s), tabSaysMissing, JSON.stringify(s));
    assert.equal(tabSaysMissing, !!s.requireCustomerIdNumber, 'רק require_customer_id_number: ' + JSON.stringify(s));
  }
  // מההגדרות האמיתיות: אימות לעריכה לבדו = לא בתוקף, ולכן גם לא "חסר"
  const only = (rows) => L.parseSettings(rows.map(([key, value]) => ({ key, value })));
  const idEdit = only([['require_id_for_edit_cancel', 'true']]);
  assert.equal(idEdit.requireIdForEdit, false, 'האימות בתוקף רק כש-require_customer_id_number דולקת');
  assert.equal(D.zeoutRequired(idEdit), false);
  const both = only([['require_id_for_edit_cancel', 'true'], ['require_customer_id_number', 'true']]);
  assert.equal(both.requireIdForEdit, true);
  assert.equal(D.zeoutRequired(both), true);
  assert.equal(only([['require_customer_id_number', 'true']]).requireIdForEdit, false);
  assert.equal(L.effectiveRequireIdForEdit(true, false), false);
  assert.equal(L.effectiveRequireIdForEdit(true, true), true);
});

test('כתובת הלקוח ושם - כמו MGD:162-164', () => {
  assert.equal(D.customerAddress({ street: 'עמוס', houseNum: 14, city: 'ירושלים' }), 'עמוס 14, ירושלים');
  assert.equal(D.customerAddress({ street: 'עמוס', city: '' }), 'עמוס');
  assert.equal(D.customerAddress({ city: 'ירושלים' }), 'ירושלים');
  assert.equal(D.customerAddress(null), '');
  assert.equal(D.customerName({ firstName: 'מרים', lastName: 'אברמוביץ' }), 'מרים אברמוביץ');
});

test('הגדרות המשלוח: === "true" בלבד, JSON לא תקין = בלי ערים (MGD:199-216)', () => {
  const s = (m) => ({ get: (k, d) => (k in m ? m[k] : d) });
  assert.deepEqual(D.deliverySettingsOf(s({})), { enabled: false, allowAddressOverride: false, oneDayBeforeOption: false, priceByCity: {} });
  const x = D.deliverySettingsOf(s({ enable_deliveries: 'true', delivery_allow_address_override: 'true', delivery_one_day_before_option: 'TRUE', delivery_price_by_city: '{"ירושלים":40}' }));
  assert.deepEqual(x, { enabled: true, allowAddressOverride: true, oneDayBeforeOption: false, priceByCity: { 'ירושלים': 40 } });
  assert.deepEqual(D.deliverySettingsOf(s({ enable_deliveries: 'true', delivery_price_by_city: '{bad' })).priceByCity, {});
  assert.deepEqual(D.deliverySettingsOf(s({ enable_deliveries: 'true', delivery_price_by_city: '[1,2]' })).priceByCity, {});
});

test('הצעות: סינון לפי תת-מחרוזת, ריק = הכל', () => {
  assert.deepEqual(D.filterSuggestions(['ירושלים', 'בית שמש', 'בני ברק'], 'ב'), ['בית שמש', 'בני ברק']);
  assert.deepEqual(D.filterSuggestions(['א', 'ב'], ''), ['א', 'ב']);
  assert.deepEqual(D.filterSuggestions(null, 'x'), []);
});
