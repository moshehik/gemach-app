// זוגיות לשונית הפרטים/המשלוח (W2a) מול הישן: לכל עריכה שמייצרת שדה ב-PUT (תאריך אירוע, סוג אירוע, טווח לקיחה/החזרה, יום נוסף,
// ציפוף, החלפת לקוח, לקוח חדש, משלוח) - אותה הזמנה כמו המטפל של ModernGeneralDetails.js (האורקל = קוד המקור החי, details-legacy.mjs),
// ואותו גוף PUT דרך buildPutPayload של הבקר מול handleSave של הישן (+extraDay +cardVariant). 3 אזורי זמן (run.mjs).
// הבדל מכוון יחיד: באזור זמן שלילי (America/New_York) הישן קורא 'YYYY-MM-DD' כחצות UTC וזז יום אחורה - החדש שומר על היום שנבחר.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { baseOrder, baseState } from './fixtures.mjs';
import { legacySaveBody } from './legacy.mjs';
import {
  legacyPickEventDate, legacyEventType, legacyPickRange, legacySetExtraDay, legacyShiftDateStr, legacyApplySpacing, legacySpacingAxis,
  legacyCustomer, legacyDelivery, MGD_TEXT, LEGACY_EDITING_INIT
} from './details-legacy.mjs';

const P = process.env.PROJ;
const D = await import(pathToFileURL(P + '/app/components/order-card/parts/ocDetailsLogic.js').href);
const L = await import(pathToFileURL(P + '/app/components/order-card/orderCardLogic.js').href);
const HD = await import(pathToFileURL(P + '/lib/hebrewDate.js').href);

const TZ = process.env.TZ || '';
const NEG_TZ = new Date(2026, 0, 1).getTimezoneOffset() > 0; // מערב ל-UTC
const apply = (order, u) => (u ? { ...order, ...u } : order);
const putOf = (order) => { const st = baseState(); const b = L.buildPutPayload(order, { items: st.items, obligations: st.obligations, payments: st.payments, mode: 'save' }); const c = { ...b }; delete c.extraDay; delete c.cardVariant; return { full: b, legacyShape: c }; };
const legacyPut = (order) => { const st = baseState(); return legacySaveBody(order, st); };
const israelHebrew = (key) => { const [y, m, d] = key.split('-').map(Number); return HD.getHebrewDateString(new Date(y, m - 1, d, 12)); };

// ---------- תאריך אירוע (לוח עברי, A9) ----------
const KEYS = ['2026-10-08', '2026-09-12', '2027-03-10', '2027-03-11', '2026-12-31', '2027-01-01', '2026-03-29', '2026-10-25'];
for (const key of KEYS) {
  test(`תאריך אירוע ${key}: אותה הזמנה ואותו PUT כמו changeDates של הישן (${TZ})`, () => {
    const o = baseOrder();
    const neu = apply(o, D.withDateUpdates({ eventDate: key }));
    const old = legacyPickEventDate(o, key);
    assert.equal(neu.eventDate, key);
    assert.equal(neu.eventDate, old.eventDate);
    assert.equal(neu.eventDateHebrew, israelHebrew(key), 'החדש: התאריך העברי של היום שנבחר');
    if (!NEG_TZ) {
      assert.deepEqual(neu, old);
      assert.deepEqual(putOf(neu).legacyShape, legacyPut(old));
    } else {
      assert.deepEqual({ ...neu, eventDateHebrew: null }, { ...old, eventDateHebrew: null });
    }
    assert.equal(putOf(neu).full.extraDay, null);
  });
}

// ---------- סוג אירוע (רגיל / חו"ל) ----------
const TYPE_STATES = [
  ['רגיל', baseOrder()],
  ['חו"ל', baseOrder({ isAbroad: true, eventDate: '2026-10-05T21:00:00.000Z', fromDate: '2026-10-05T21:00:00.000Z', toDate: '2026-10-12T21:00:00.000Z', returnDate: '2026-10-12T21:00:00.000Z' })],
  ['אמצע שבוע', baseOrder({ isWeekdayEvent: true, fromDate: '2026-10-05', toDate: '2026-10-06' })],
  ['חו"ל + יום נוסף', baseOrder({ isAbroad: true, fromDate: '2026-10-04T21:00:00.000Z', toDate: '2026-10-13T21:00:00.000Z', returnDate: '2026-10-13T21:00:00.000Z', extraDay: 'after' })],
];
for (const [name, o] of TYPE_STATES) {
  for (const toAbroad of [true, false]) {
    test(`סוג אירוע: ${name} → ${toAbroad ? 'חו"ל' : 'רגיל'} = הישן`, () => {
      const neu = apply(o, D.eventTypeUpdates(o, toAbroad));
      const legacyRaw = legacyEventType(o, toAbroad);
      // תיקון מכוון (סקירת W2a, סעיף 1): במעבר סוג אירוע extraDay מתאפס (הישן השאיר אותו - ולא שלח אותו ב-PUT)
      const old = legacyRaw === o ? o : { ...legacyRaw, extraDay: null };
      assert.deepEqual(neu, old);
      assert.deepEqual(putOf(neu).legacyShape, legacyPut(old));
    });
  }
}

// ---------- טווח לקיחה/החזרה (R16) ----------
const RANGE_CASES = [
  ['בלי טווח קודם (שעה = עכשיו)', baseOrder({ isAbroad: true, eventDate: null }), '2026-10-05', '2026-10-12'],
  ['טווח קודם בחצות ישראל', TYPE_STATES[1][1], '2026-11-01', '2026-11-09'],
  ['טווח קודם עם שעה', baseOrder({ isAbroad: true, fromDate: '2026-10-05T07:30:00.000Z', toDate: '2026-10-12T15:45:00.000Z' }), '2026-10-20', '2026-10-27'],
  ['רק returnDate קודם', baseOrder({ isWeekdayEvent: true, fromDate: '2026-10-05', toDate: null, returnDate: '2026-10-06T10:00:00.000Z' }), '2026-10-07', '2026-10-08'],
  ['יום אחד', TYPE_STATES[1][1], '2026-10-15', '2026-10-15'],
  ['מעבר שעון חורף', TYPE_STATES[1][1], '2026-10-23', '2026-10-27'],
];
for (const [name, o, a, b] of RANGE_CASES) {
  test(`טווח: ${name} = onChange של HebrewDateRangePicker בישן (${TZ})`, () => {
    let neu, old;
    for (let attempt = 0; attempt < 3; attempt++) { // "עכשיו" נקרא פעמיים - חוזרים אם דקה התחלפה באמצע
      const now = new Date();
      old = { ...legacyPickRange(o, a, b), extraDay: null }; // סקירת W2a סעיף 2: טווח חדש מאפס extraDay
      neu = apply(o, D.rangeUpdates(o, a, b, now));
      if (o.fromDate || JSON.stringify(neu) === JSON.stringify(old)) break;
    }
    const k = (v) => HD.getIsraelDateKey(v);
    if (!NEG_TZ) {
      assert.deepEqual(neu, old);
      assert.deepEqual(putOf(neu).legacyShape, legacyPut(old));
    }
    // החדש: היום המקומי של הלקיחה/החזרה = היום שנבחר, בכל אזור זמן; eventDate = הלקיחה; returnDate = toDate
    const local = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    assert.equal(local(neu.fromDate), a);
    assert.equal(local(neu.toDate), b);
    assert.equal(neu.returnDate, neu.toDate);
    assert.equal(neu.eventDate, neu.fromDate);
    assert.equal(neu.eventDateHebrew, HD.getHebrewDateString(neu.fromDate));
    if (TZ === 'Asia/Jerusalem') { assert.equal(k(neu.fromDate), a); assert.equal(k(neu.toDate), b); }
  });
}

// ---------- יום השכרה נוסף (A26 + G13) ----------
const XD_BASE = [
  baseOrder({ isAbroad: true, fromDate: '2026-10-05T21:00:00.000Z', toDate: '2026-10-12T21:00:00.000Z', returnDate: '2026-10-12T21:00:00.000Z' }),
  baseOrder({ isWeekdayEvent: true, fromDate: '2026-10-05', toDate: '2026-10-06', returnDate: null }),
  baseOrder({ isAbroad: true, fromDate: '2026-10-24T21:00:00.000Z', toDate: '2026-10-25T21:00:00.000Z', returnDate: '2026-10-25T21:00:00.000Z' }),
];
for (const [i, o0] of XD_BASE.entries()) {
  for (const from of [null, 'before', 'after']) {
    for (const to of [null, 'before', 'after']) {
      test(`יום נוסף #${i}: ${from || 'ללא'} → ${to || 'ללא'} = setExtraDay של הישן; extraDay נשלח ב-PUT`, () => {
        const o = { ...o0, extraDay: from };
        const u = D.extraDayUpdates(o, to);
        const neu = apply(o, u);
        const old = legacySetExtraDay(o, to);
        assert.deepEqual(neu, old);
        if (from === to) assert.equal(u, null, 'אין שינוי כשהערך זהה');
        const body = putOf(neu).full;
        assert.equal(body.extraDay, to);
        assert.deepEqual(putOf(neu).legacyShape, legacyPut(old));
      });
    }
  }
}
test('shiftDateStr = הישן (כולל ריק ומעבר שעון)', () => {
  for (const s of ['2026-10-24T21:00:00.000Z', '2026-03-26T22:00:00.000Z', '2026-10-05', null, '']) for (const d of [-1, 1]) assert.equal(D.shiftDateStr(s, d), legacyShiftDateStr(s, d));
});
test('יום נוסף מוצג רק עם enable_rental_extension ורק לאירוע עם טווח (AMB-13, כמו MGD:384)', () => {
  const on = { enableRentalExtension: true }, off = { enableRentalExtension: false };
  assert.equal(D.extraDayVisible(on, baseOrder()), false);
  assert.equal(D.extraDayVisible(on, baseOrder({ isAbroad: true })), true);
  assert.equal(D.extraDayVisible(on, baseOrder({ isWeekdayEvent: true })), true);
  assert.equal(D.extraDayVisible(off, baseOrder({ isAbroad: true })), false);
});

// ---------- ציפוף ימים (R18) ----------
for (const def of [0, 2, 3, 5]) {
  for (const current of [null, 0, 1, 2, 3, 5]) {
    for (const click of [null, 0, 1, 2, 3, 4, 6]) {
      test(`ציפוף: ברירת מחדל ${def}, נוכחי ${current ?? 'רגיל'} → ${click ?? 'רגיל'} = applyCustomSpacing של הישן`, async () => {
        const o = baseOrder({ customSpacing: current });
        const dec = D.spacingDecision(o, click, def);
        const yes = await legacyApplySpacing(o, click, def, true);
        assert.equal(dec.needsApproval, yes.pinCalls.length > 0, 'אישור מנהל באותם מקרים');
        if (yes.pinCalls.length) assert.equal(yes.pinCalls[0].level, 'feature:special_spacing_approval');
        const neu = apply(o, D.withDateUpdates({ customSpacing: dec.valueToStore }));
        assert.deepEqual(neu, yes.order);
        assert.deepEqual(putOf(neu).legacyShape, legacyPut(yes.order));
        if (dec.needsApproval) { const no = await legacyApplySpacing(o, click, def, false); assert.deepEqual(no.order, o, 'בלי אישור - בלי שינוי (גם בישן)'); }
      });
    }
  }
}
test('ציר הציפוף = ציר הישן בלי הערך של ברירת המחדל (שבישן שקול ל"רגיל")', () => {
  for (const def of [0, 1, 2, 3, 5]) for (const sel of [null, 0, 2, 7]) {
    const old = legacySpacingAxis(baseOrder({ customSpacing: sel }), def);
    assert.deepEqual(D.spacingAxis(def, old.selectedSpacing), old.axisDays.filter((d) => d !== def));
    assert.equal(D.hasCustomSpacing(baseOrder({ customSpacing: sel }), false), old.hasCustomSpacing);
    assert.equal(D.hasCustomSpacing(baseOrder({ customSpacing: sel }), true), legacySpacingAxis(baseOrder({ customSpacing: sel }), def, true).hasCustomSpacing);
  }
});
test('ברירת מחדל הציפוף = inventory_buffer_days (parseInt), אחרת 3 - כמו MGD:33/40-41', () => {
  const s = (v) => ({ get: (k, d) => (k === 'inventory_buffer_days' && v !== undefined ? v : d) });
  assert.equal(D.spacingDefaultOf(s(undefined)), 3);
  assert.equal(D.spacingDefaultOf(s('5')), 5);
  assert.equal(D.spacingDefaultOf(s('0')), 0);
  assert.equal(D.spacingDefaultOf(s('abc')), 3);
  assert.equal(D.spacingDefaultOf(s('2 ימים')), 2);
});

// ---------- לקוח (R19) ----------
const OTHER = { id: 'c9', firstName: 'רחל', lastName: 'לוי', phone1: '052-4331290', email: 'r@example.com', city: 'בני ברק', zeout: '123456782' };
test('החלפה ללקוח קיים = selectCustomer של הישן (customerId + customer), אותו PUT', async () => {
  const o = baseOrder();
  const neu = apply(o, D.customerUpdates(OTHER));
  const { order: old } = await legacyCustomer({ order: o, pick: OTHER });
  assert.deepEqual(neu, old);
  assert.deepEqual(putOf(neu).legacyShape, legacyPut(old));
  assert.equal(putOf(neu).full.customerId, 'c9');
});
const FORM = { firstName: 'שרה', lastName: 'כהן', phone1: '050-1112222', email: 'sara@gmail.com', city: 'ירושלים', street: 'יפו', houseNum: '12' };
test('לקוח חדש: אותה בדיקת חובה ואותו טקסט כמו הישן', async () => {
  for (const miss of ['firstName', 'lastName', 'phone1', 'email']) {
    const form = { ...FORM, [miss]: '' };
    const { alerts, calls } = await legacyCustomer({ order: baseOrder(), newCustomer: form, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
    assert.deepEqual(alerts, [MGD_TEXT.newCustomerAlert]);
    assert.equal(calls.length, 0);
    assert.equal(D.newCustomerError(form, {}), MGD_TEXT.newCustomerAlert);
  }
  assert.equal(D.newCustomerError(FORM, {}), null);
});
test('לקוח חדש: POST /api/customers עם אותו גוף בייט-בייט (בלי require_customer_id_number), והלקוח שנוצר נבחר', async () => {
  const saved = { id: 'c-new', ...FORM, houseNum: 12 };
  const { order: old, calls } = await legacyCustomer({ order: baseOrder(), newCustomer: FORM, fetchImpl: async () => ({ ok: true, json: async () => saved }) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/customers');
  assert.equal(calls[0].method, 'POST');
  assert.equal(JSON.stringify(D.newCustomerBody(FORM, {})), calls[0].body);
  assert.deepEqual(apply(baseOrder(), D.customerUpdates(saved)), old);
});
test('לקוח חדש עם require_customer_id_number: ת״ז חובה ונשלחת (השרת דוחה בלעדיה) - שאר הגוף זהה לישן', () => {
  const s = { requireCustomerIdNumber: true };
  assert.equal(D.newCustomerError(FORM, s), 'יש למלא תעודת זהות');
  const body = D.newCustomerBody({ ...FORM, zeout: ' 123456782 ' }, s);
  assert.equal(body.zeout, '123456782');
  const { zeout, ...rest } = body; // eslint-disable-line no-unused-vars
  assert.equal(JSON.stringify(rest), JSON.stringify(D.newCustomerBody(FORM, {})));
});
test('"השלם ל- @gmail.com" = הישן', () => {
  assert.equal(D.gmailCompletable(''), true); assert.equal(D.gmailCompletable('sara'), true); assert.equal(D.gmailCompletable('a@b'), false);
  assert.equal(D.gmailComplete('sara'), 'sara@gmail.com'); assert.equal(D.gmailComplete(''), '@gmail.com');
});

// ---------- משלוח (R21) ----------
const DS = [
  { enabled: true, allowAddressOverride: false, oneDayBeforeOption: false, priceByCity: { 'ירושלים': 40, 'בית שמש': 60 } },
  { enabled: true, allowAddressOverride: true, oneDayBeforeOption: true, priceByCity: {} },
  { enabled: true, allowAddressOverride: false, oneDayBeforeOption: true, priceByCity: { 'בני ברק': 50 } },
];
const DEL_ORDERS = [
  baseOrder({ isDelivery: true, deliveryCity: 'ירושלים' }),
  baseOrder({ isDelivery: true, deliveryCity: 'בית שמש', deliveryAddress: '' }),
  baseOrder({ isDelivery: true, deliveryCity: '', customer: { ...baseOrder().customer, city: 'אלעד' } }),
  baseOrder({ isDelivery: true, deliveryCity: 'מודיעין', customer: { ...baseOrder().customer, city: '' } }),
  baseOrder({ isDelivery: false, deliveryCity: null }),
];
for (const [i, ds] of DS.entries()) {
  for (const [j, o] of DEL_ORDERS.entries()) {
    test(`משלוח: הגדרות #${i} × הזמנה #${j} - אותן ערים, אותה חובה, אותן הודעות כמו הישן`, () => {
      const fallback = ['אלעד', 'ירושלים', 'רמות'];
      const old = legacyDelivery(o, ds, fallback);
      assert.deepEqual(D.deliveryCityOptions(ds.priceByCity, fallback, o.deliveryCity), old.selectOptions);
      const fs = D.deliveryFieldState(o, o.customer, ds);
      assert.equal(fs.cityRequired, old.deliveryCityRequired);
      assert.equal(fs.addressRequired, old.deliveryAddressRequired);
      assert.equal(fs.showAddress, !!old.showAddress);
      assert.equal(fs.cityMsg, old.deliveryCityRequired && !String(o.deliveryCity || '').trim() ? MGD_TEXT.cityMsg : '');
      assert.equal(fs.addressMsg, old.deliveryAddressRequired && !String(o.deliveryAddress || '').trim() ? MGD_TEXT.addressMsg : '');
    });
  }
}
test('משלוח: רצף עריכות (מתג, כיוון, עיר, כתובת, יום לפני) - אותו PUT כמו handleChange של הישן', () => {
  const o = baseOrder();
  const steps = [{ isDelivery: true }, { deliveryDirection: 'הלוך' }, { deliveryCity: 'ירושלים' }, { deliveryAddress: 'יפו 3' }, { deliveryOneDayBefore: true }];
  const neu = steps.reduce((acc, u) => ({ ...acc, ...u }), o);
  const old = steps.reduce((acc, u) => ({ ...acc, ...u }), o); // MGD: handleChange(updates) = onOrderChange(prev => ({...prev, ...updates}))
  assert.deepEqual(putOf(neu).legacyShape, legacyPut(old));
  const b = putOf(neu).full;
  assert.deepEqual([b.isDelivery, b.deliveryDirection, b.deliveryCity, b.deliveryAddress, b.deliveryOneDayBefore], [true, 'הלוך', 'ירושלים', 'יפו 3', true]);
});
test('עיר משלוח = רשימה סגורה: ערך מהרשימה נקלט, ריק = "בחר עיר…" של הישן, אחר חוזר לערך התקף', () => {
  const opts = ['ירושלים', 'בית שמש'];
  assert.equal(D.resolveCityInput('ירושלים', opts), 'ירושלים');
  assert.equal(D.resolveCityInput('  בית שמש ', opts), 'בית שמש');
  assert.equal(D.resolveCityInput('', opts), '');
  assert.equal(D.resolveCityInput('תל אביב', opts), null);
  assert.equal(D.resolveCityInput('ירוש', opts), null);
});

// ---------- מצב עריכת האירוע בפתיחה ----------
test('כרטיס האירוע נפתח בעריכה רק כשאין תאריך (MGD:22) - אותו ביטוי', () => {
  assert.equal(LEGACY_EDITING_INIT, '!order?.eventDate && !order?.fromDate');
  const src = fs.readFileSync(P + '/app/components/order-card/tabs/OcDetailsTab.js', 'utf8');
  assert.ok(src.includes('useState(() => !order.eventDate && !order.fromDate)'));
});
