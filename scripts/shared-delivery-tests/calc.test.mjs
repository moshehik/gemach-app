// משלוח משותף - החישוב הטהור (lib/sharedDeliveryCalc.js): נרמול כתובת, תכנון קבוצה, מחירים באגורות, סכום שמור.
// בלי DB ובלי שרת. הרצה: node --test scripts/shared-delivery-tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const C = await import(pathToFileURL(path.join(ROOT, 'lib', 'sharedDeliveryCalc.js')).href);

const key = (o) => C.buildAddressKey({ pricedCity: 'ירושלים', ...o });
const same = (a, b, msg) => assert.equal(key(a), key(b), msg);
const differ = (a, b, msg) => assert.notEqual(key(a), key(b), msg);

// ---------------------------------------------------------------------------------------------
// נרמול כתובת
// ---------------------------------------------------------------------------------------------
test('כתובת משלוח מפורשת מול רחוב+מספר בכרטיס לקוח (נתונים אמיתיים מנווה: 53597/53598)', () => {
  same({ deliveryAddress: 'תחכמוני 15', deliveryCity: 'ירושלים' }, { customerStreet: 'תחכמוני', customerHouseNum: '15', customerCity: 'ירושלים' });
});

test('העיר צמודה לסוף הכתובת + רווח בסוף שם העיר (53665/53668)', () => {
  same(
    { deliveryAddress: 'חיי יצחק 7 ביתר', deliveryCity: 'ביתר ', pricedCity: 'ביתר ' },
    { customerStreet: 'חיי יצחק', customerHouseNum: '7', customerCity: 'ביתר', pricedCity: 'ביתר' },
  );
});

test('רחוב / רח\' / שדרות בתחילת השם, גרשיים וסוגי מירכאות', () => {
  const base = { customerStreet: 'הנטקה', customerHouseNum: '52' };
  same({ deliveryAddress: 'רחוב הנטקה 52' }, base);
  same({ deliveryAddress: "רח' הנטקה 52" }, base);
  same({ deliveryAddress: 'רח׳ הנטקה 52' }, base);
  same({ deliveryAddress: 'הנטקה  52 ' }, base);
  same({ deliveryAddress: 'הנטקה, 52' }, base);
  same({ deliveryAddress: 'הנטקה 52.' }, base);
  same({ deliveryAddress: 'הנטקה מס\' 52' }, base);
  same({ deliveryAddress: 'נטקה 52' }, base, 'ה הידוע בתחילת השם אינה משנה');
});

test('דירה / קומה / כניסה / סלאש לא משנים (אותו בניין)', () => {
  const base = { customerStreet: 'הנטקה', customerHouseNum: '52' };
  same({ deliveryAddress: 'הנטקה 52/3' }, base);
  same({ deliveryAddress: 'הנטקה 52 / 3' }, base);
  same({ deliveryAddress: 'הנטקה 52 דירה 4' }, base);
  same({ deliveryAddress: 'הנטקה 52 קומה 2' }, base);
  same({ deliveryAddress: 'הנטקה 52 כניסה ב' }, base);
  same({ customerStreet: 'הנטקה', customerHouseNum: '52/3' }, base);
  same({ customerStreet: 'הנטקה', customerHouseNum: '52 דירה 9' }, base);
});

test('כתיב מלא/חסר, ר\' / רבי, ה הידוע, אותיות סופיות', () => {
  same({ deliveryAddress: 'יהושוע בן נון 5' }, { deliveryAddress: 'יהושע בן נון 5' });
  same({ deliveryAddress: 'החיד"א 7' }, { deliveryAddress: 'חידא 7' });
  same({ deliveryAddress: "ר' עקיבא 3" }, { deliveryAddress: 'רבי עקיבא 3' });
  same({ deliveryAddress: 'הרב קוק 8' }, { deliveryAddress: 'רב קוק 8' });
  same({ deliveryAddress: 'סנהדריה מורחבת 106' }, { customerStreet: 'סנהדריה מורחבת', customerHouseNum: '106' });
});

test('מספר בית אחר / אות כניסה אחרת / עיר אחרת / רחוב אחר => לא אותה כתובת', () => {
  const base = { customerStreet: 'הנטקה', customerHouseNum: '52' };
  differ({ deliveryAddress: 'הנטקה 53' }, base);
  differ({ deliveryAddress: 'הנטקה 5' }, base);
  differ({ deliveryAddress: 'הנטקה 52א' }, base);
  differ({ deliveryAddress: 'הנטקה 52א' }, { deliveryAddress: 'הנטקה 52ב' });
  same({ deliveryAddress: 'הנטקה 52 א' }, { deliveryAddress: 'הנטקה 52א' }, 'אות כניסה נפרדת = צמודה');
  differ({ deliveryAddress: 'הנטקה 52', pricedCity: 'בית שמש' }, base);
  differ({ deliveryAddress: 'סנהדריה 106' }, { customerStreet: 'סנהדריה מורחבת', customerHouseNum: '106' }, 'שם רחוב שונה (סנהדריה / סנהדריה מורחבת) - מחמירים, לא מקבצים');
  differ({ deliveryAddress: 'שבתאי הנגבי 67' }, { deliveryAddress: 'שבתאי הנגבי 76' });
});

test('אין עיר מחויבת / אין מספר בית / ריק => אין מפתח (לא מקבצים)', () => {
  assert.equal(C.buildAddressKey({ deliveryAddress: 'הנטקה 52', pricedCity: '' }), null);
  assert.equal(C.buildAddressKey({ deliveryAddress: 'הנטקה 52', pricedCity: null }), null);
  assert.equal(C.buildAddressKey({ deliveryAddress: 'הנטקה', pricedCity: 'ירושלים' }), null);
  assert.equal(C.buildAddressKey({ customerStreet: 'קדושת לוי', customerHouseNum: '', pricedCity: 'ירושלים' }), null);
  assert.equal(C.buildAddressKey({ customerStreet: '', customerHouseNum: '5', pricedCity: 'ירושלים' }), null);
  assert.equal(C.buildAddressKey({ deliveryAddress: '52', pricedCity: 'ירושלים' }), null);
  assert.equal(C.buildAddressKey({ deliveryAddress: 'ירושלים', pricedCity: 'ירושלים' }), null);
  assert.equal(C.buildAddressKey({ pricedCity: 'ירושלים' }), null);
});

test('כתובת מפורשת גוברת על כתובת הלקוח (גם כשהיא ריקה בחלקה)', () => {
  const k1 = key({ deliveryAddress: 'ארזי הבירה 32', customerStreet: 'ארזי הבירה', customerHouseNum: '51' });
  const k2 = key({ customerStreet: 'ארזי הבירה', customerHouseNum: '32' });
  assert.equal(k1, k2);
});

test('מספר בית שמופיע גם בשם הרחוב (בית וגן 4)', () => {
  same({ customerStreet: 'בית וגן', customerHouseNum: '4' }, { deliveryAddress: 'בית וגן 4' });
  differ({ customerStreet: 'בית וגן', customerHouseNum: '96' }, { customerStreet: 'בית וגן', customerHouseNum: '4' });
});

// ---------------------------------------------------------------------------------------------
// תכנון קבוצה
// ---------------------------------------------------------------------------------------------
const M = (orderId, orderDateMs, direction = 'הלוך-חזור', extra = {}) => ({ orderId, orderDateMs, direction, oneDayBefore: false, primaryFlag: false, ...extra });
const disc = (plan, id) => plan.perOrder.get(id).discountedLegs;

test('שתי הזמנות הלוך-חזור: הראשונה שנרשמה ראשית ומשלמת מלא, השנייה מוזלת בשני הצדדים', () => {
  const p = C.planSharedGroup([M(20, 2000), M(10, 1000)]);
  assert.equal(p.shared, true);
  assert.equal(p.primaryOrderId, 10);
  assert.deepEqual(disc(p, 10), []);
  assert.deepEqual(disc(p, 20), ['out', 'ret']);
});

test('הראשונה נקבעת לפי זמן רישום (orderDate) ולא לפי מספר הזמנה; שוויון זמן => מספר הזמנה', () => {
  const p = C.planSharedGroup([M(5, 3000), M(900, 1000), M(7, 2000)]);
  assert.equal(p.primaryOrderId, 900);
  const q = C.planSharedGroup([M(8, 1000), M(3, 1000)]);
  assert.equal(q.primaryOrderId, 3);
  const r = C.planSharedGroup([M(8, null), M(3, 500), M(9, undefined)]);
  assert.equal(r.primaryOrderId, 3, 'orderDate חסר נחשב אחרון');
});

test('שלוש הזמנות: ראשית מלא, שתיים מוזלות; החלפת ראשית ידנית', () => {
  const members = [M(1, 100), M(2, 200), M(3, 300)];
  const p = C.planSharedGroup(members);
  assert.deepEqual([disc(p, 1), disc(p, 2), disc(p, 3)], [[], ['out', 'ret'], ['out', 'ret']]);
  const q = C.planSharedGroup([M(1, 100), M(2, 200, 'הלוך-חזור', { primaryFlag: true }), M(3, 300)]);
  assert.equal(q.primaryOrderId, 2);
  assert.deepEqual([disc(q, 1), disc(q, 2), disc(q, 3)], [['out', 'ret'], [], ['out', 'ret']]);
  // החלפה פעמיים ברצף: ואז חזרה לברירת מחדל (בלי סימון)
  const r = C.planSharedGroup([M(1, 100), M(2, 200), M(3, 300, 'הלוך-חזור', { primaryFlag: true })]);
  assert.equal(r.primaryOrderId, 3);
  assert.deepEqual([disc(r, 1), disc(r, 2), disc(r, 3)], [['out', 'ret'], ['out', 'ret'], []]);
  const s = C.planSharedGroup(members);
  assert.equal(s.primaryOrderId, 1);
});

test('כמה הזמנות מסומנות כראשיות: הראשונה ברישום מבין המסומנות', () => {
  const p = C.planSharedGroup([M(1, 100), M(2, 200, 'הלוך-חזור', { primaryFlag: true }), M(3, 300, 'הלוך-חזור', { primaryFlag: true })]);
  assert.equal(p.primaryOrderId, 2);
  assert.deepEqual(disc(p, 3), ['out', 'ret']);
});

test('הזמנה בודדת: אין קבוצה ואין הנחה', () => {
  const p = C.planSharedGroup([M(1, 100)]);
  assert.equal(p.shared, false);
  assert.deepEqual(disc(p, 1), []);
  assert.equal(C.planSharedGroup([]).primaryOrderId, null);
  assert.equal(C.planSharedGroup(undefined).shared, false);
});

test('כיוונים מעורבים: הנחה רק בצד שיש בו עוד נוסע', () => {
  // A הלוך בלבד (ראשית), B הלוך-חזור, C חזור בלבד
  const p = C.planSharedGroup([M(1, 100, 'הלוך'), M(2, 200, 'הלוך-חזור'), M(3, 300, 'חזור')]);
  assert.equal(p.primaryOrderId, 1);
  assert.deepEqual(disc(p, 1), []);
  assert.deepEqual(disc(p, 2), ['out'], 'B: הלוך מוזל (A משלם), חזור מלא (B הראשון בחזור)');
  assert.deepEqual(disc(p, 3), ['ret'], 'C: חזור מוזל (B משלם)');
  // הראשית נוסעת רק בהלוך, אחרים בחזור בלבד: אין שיתוף בחזור? שני נוסעי חזור => הראשון מהם משלם
  const q = C.planSharedGroup([M(1, 100, 'הלוך'), M(2, 200, 'חזור'), M(3, 300, 'חזור')]);
  assert.deepEqual([disc(q, 1), disc(q, 2), disc(q, 3)], [[], [], ['ret']]);
  // הלוך מול חזור בלבד - שני צדדים שונים => אין שיתוף בכלל
  const r = C.planSharedGroup([M(1, 100, 'הלוך'), M(2, 200, 'חזור')]);
  assert.equal(r.shared, false);
  assert.deepEqual([disc(r, 1), disc(r, 2)], [[], []]);
});

test('"יוצא יום לפני" שונה => הלוך לא משותף (יום יציאה אחר); חזור כן', () => {
  const p = C.planSharedGroup([M(1, 100, 'הלוך-חזור'), M(2, 200, 'הלוך-חזור', { oneDayBefore: true })]);
  assert.deepEqual(disc(p, 2), ['ret']);
  const q = C.planSharedGroup([M(1, 100, 'הלוך', { oneDayBefore: true }), M(2, 200, 'הלוך', { oneDayBefore: true })]);
  assert.deepEqual(disc(q, 2), ['out']);
});

test('הראשית נוסעת בצד אחד בלבד: בצד האחר המשלם הוא הראשון ברישום מבין הנוסעים', () => {
  const p = C.planSharedGroup([M(1, 100, 'הלוך', { primaryFlag: true }), M(2, 200), M(3, 300)]);
  assert.equal(p.primaryOrderId, 1);
  assert.deepEqual([disc(p, 1), disc(p, 2), disc(p, 3)], [[], ['out'], ['out', 'ret']]);
  assert.deepEqual(p.perOrder.get(3).legPayers, { out: 1, ret: 2 });
});

test('כפילות orderId בקלט נבלעת', () => {
  const p = C.planSharedGroup([M(1, 100), M(1, 100), M(2, 200)]);
  assert.equal(p.perOrder.size, 2);
});

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

test('תכונות על 3000 קבוצות אקראיות: משלם יחיד לכל צד, אפס הנחה בצד של נוסע בודד, אי-תלות בסדר הקלט, יציבות', () => {
  const rand = rng(12345);
  const dirs = ['הלוך', 'חזור', 'הלוך-חזור', null];
  for (let iter = 0; iter < 3000; iter += 1) {
    const n = 1 + Math.floor(rand() * 6);
    const members = [];
    for (let i = 0; i < n; i += 1) {
      members.push({
        orderId: 1000 + Math.floor(rand() * 5000) + i * 10000,
        orderDateMs: rand() < 0.1 ? null : Math.floor(rand() * 20) * 1000,
        direction: dirs[Math.floor(rand() * dirs.length)],
        oneDayBefore: rand() < 0.25,
        primaryFlag: rand() < 0.2,
      });
    }
    const plan = C.planSharedGroup(members);
    // הראשית שייכת לקבוצה
    assert.ok(members.some((m) => m.orderId === plan.primaryOrderId));
    // לכל bucket
    const buckets = new Map();
    for (const m of members) for (const leg of C.legsOf(m.direction)) {
      const b = leg === 'out' ? (m.oneDayBefore ? 'out-1' : 'out') : 'ret';
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push({ id: m.orderId, leg });
    }
    for (const [, tr] of buckets) {
      const discounted = tr.filter((t) => plan.perOrder.get(t.id).discountedLegs.includes(t.leg));
      if (tr.length < 2) assert.equal(discounted.length, 0, 'נוסע בודד לא מוזל');
      else {
        assert.equal(discounted.length, tr.length - 1, 'בדיוק משלם אחד לכל צד משותף');
        const payer = tr.find((t) => !plan.perOrder.get(t.id).discountedLegs.includes(t.leg));
        if (tr.some((t) => t.id === plan.primaryOrderId)) assert.equal(payer.id, plan.primaryOrderId, 'הראשית משלמת מלא בצד שהיא נוסעת בו');
      }
    }
    for (const m of members) {
      const info = plan.perOrder.get(m.orderId);
      for (const leg of info.discountedLegs) assert.ok(C.legsOf(m.direction).includes(leg));
    }
    // אי-תלות בסדר הקלט
    const shuffled = [...members].sort(() => rand() - 0.5);
    const plan2 = C.planSharedGroup(shuffled);
    assert.equal(plan2.primaryOrderId, plan.primaryOrderId);
    for (const m of members) assert.deepEqual(plan2.perOrder.get(m.orderId).discountedLegs, plan.perOrder.get(m.orderId).discountedLegs);
    // יציבות (חישוב חוזר זהה)
    const plan3 = C.planSharedGroup(members);
    for (const m of members) assert.deepEqual(plan3.perOrder.get(m.orderId), plan.perOrder.get(m.orderId));
  }
});

test('groupCandidates: מקבץ לפי יום+כתובת, מתעלם מחברים בלי מפתח', () => {
  const g = C.groupCandidates([
    { orderId: 1, dayKey: '2026-11-24', addressKey: 'a' }, { orderId: 2, dayKey: '2026-11-24', addressKey: 'a' },
    { orderId: 3, dayKey: '2026-11-25', addressKey: 'a' }, { orderId: 4, dayKey: '2026-11-24', addressKey: null }, { orderId: 5, dayKey: null, addressKey: 'a' },
  ]);
  assert.equal(g.size, 2);
  assert.deepEqual(g.get('2026-11-24|a').map((m) => m.orderId), [1, 2]);
});

// ---------------------------------------------------------------------------------------------
// מחירים באגורות
// ---------------------------------------------------------------------------------------------
test('computeLegAmounts: מלא / מוזל / מעורב', () => {
  const a = C.computeLegAmounts({ direction: 'הלוך-חזור', regularPerLeg: 40, discountedPerLeg: 20, discountedLegs: ['out', 'ret'] });
  assert.deepEqual([a.amount, a.quantity, a.regularAmount], [40, 2, 80]);
  const b = C.computeLegAmounts({ direction: 'הלוך-חזור', regularPerLeg: 40, discountedPerLeg: 20, discountedLegs: ['out'] });
  assert.equal(b.amount, 60);
  assert.deepEqual(b.fullLegs, ['ret']);
  const c = C.computeLegAmounts({ direction: 'הלוך', regularPerLeg: 70, discountedPerLeg: 25, discountedLegs: ['out', 'ret'] });
  assert.equal(c.amount, 25, 'צד שלא קיים בכיוון ההזמנה לא נספר');
  assert.equal(c.quantity, 1);
  const d = C.computeLegAmounts({ direction: null, regularPerLeg: 40, discountedPerLeg: null, discountedLegs: ['out'] });
  assert.equal(d.amount, 80, 'בלי מחיר מוזל מוגדר - אין הנחה');
});

test('computeLegAmounts: מחיר מוזל לא עולה על הרגיל; 0 חוקי; אגורות ללא טעויות ציפה', () => {
  assert.equal(C.computeLegAmounts({ direction: 'הלוך-חזור', regularPerLeg: 40, discountedPerLeg: 55, discountedLegs: ['out', 'ret'] }).amount, 80);
  assert.equal(C.computeLegAmounts({ direction: 'הלוך-חזור', regularPerLeg: 40, discountedPerLeg: 0, discountedLegs: ['out', 'ret'] }).amount, 0);
  assert.equal(C.computeLegAmounts({ direction: 'הלוך-חזור', regularPerLeg: 19.99, discountedPerLeg: 0.1, discountedLegs: ['ret'] }).amount, 20.09);
  assert.equal(C.computeLegAmounts({ direction: 'הלוך-חזור', regularPerLeg: 33.33, discountedPerLeg: 11.11, discountedLegs: ['out', 'ret'] }).amount, 22.22);
  assert.equal(C.computeLegAmounts({ direction: 'הלוך-חזור', regularPerLeg: 0.1, discountedPerLeg: 0.2, discountedLegs: ['out', 'ret'] }).amount, 0.2);
});

test('resolveSharedDiscountPrice: גלובלי / לפי עיר עם נפילה לגלובלי / ערכים לא תקינים', () => {
  const byCity = '{"ירושלים":20,"בית שמש":"35","ביתר":0,"גבעת זאב":-5,"מודיעין עילית":"x"}';
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'global', globalPrice: '25', priceByCity: byCity, city: 'ירושלים' }), 25);
  assert.equal(C.resolveSharedDiscountPrice({ mode: undefined, globalPrice: '25', priceByCity: byCity, city: 'ירושלים' }), 25);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '25', priceByCity: byCity, city: 'ירושלים' }), 20);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '25', priceByCity: byCity, city: 'בית שמש' }), 35);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '25', priceByCity: byCity, city: 'ביתר' }), 0, '0 בטבלה = חינם');
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '25', priceByCity: byCity, city: 'גבעת זאב' }), 25, 'שלילי = לא מוגדר => גלובלי');
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '25', priceByCity: byCity, city: 'מודיעין עילית' }), 25);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '25', priceByCity: byCity, city: 'קרית ספר' }), 25, 'עיר חסרה => גלובלי');
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '', priceByCity: byCity, city: 'קרית ספר' }), null, 'אין גלובלי ואין עיר => אין הנחה');
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'global', globalPrice: '', priceByCity: byCity, city: 'ירושלים' }), null);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'global', globalPrice: 'abc', city: 'ירושלים' }), null);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: '10', priceByCity: '{bad json', city: 'ירושלים' }), 10);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'global', globalPrice: '0', city: 'ירושלים' }), 0);
  assert.equal(C.resolveSharedDiscountPrice({ mode: 'by_city', globalPrice: undefined, priceByCity: undefined, city: 'ירושלים' }), null);
});

test('parsePriceMap: JSON פגום / מערך / ריק', () => {
  assert.deepEqual(C.parsePriceMap('{bad'), {});
  assert.deepEqual(C.parsePriceMap('[1,2]'), {});
  assert.deepEqual(C.parsePriceMap(''), {});
  assert.deepEqual(C.parsePriceMap(' {" ירושלים ": 20} '), { 'ירושלים': 20 });
  assert.deepEqual(C.parsePriceMap(null), {});
});

test('תיאור: "משלוח" נשאר בתחילה, סיומת רק בהנחה בפועל', () => {
  const d = C.sharedDeliveryDescription('משלוח הלוך-חזור - ירושלים', true);
  assert.ok(d.startsWith('משלוח'));
  assert.ok(C.isSharedDeliveryDescription(d));
  assert.equal(C.sharedDeliveryDescription('משלוח הלוך-חזור - ירושלים', false), 'משלוח הלוך-חזור - ירושלים');
  assert.equal(C.isSharedDeliveryDescription('משלוח הלוך - בית שמש'), false);
});

test('computeStoredTotalAfterDeliveryChange: כולל / בלי (תיקון) / לא תואם / ריק', () => {
  // סך שמור כולל את המשלוח הישן (80) => יורד ב-40
  assert.deepEqual(C.computeStoredTotalAfterDeliveryChange({ storedTotal: 380, obligationsSumBefore: 380, deliveryOld: 80, deliveryNew: 40 }), { total: 340, mode: 'included', mismatch: false });
  // הבאג הידוע: הסך השמור בלי המשלוח (300) => מתוקן לסך כולל המשלוח החדש (340)
  assert.deepEqual(C.computeStoredTotalAfterDeliveryChange({ storedTotal: 300, obligationsSumBefore: 380, deliveryOld: 80, deliveryNew: 40 }), { total: 340, mode: 'excluded-normalised', mismatch: false });
  // עלייה (ראשי חדש): 40 -> 80
  assert.deepEqual(C.computeStoredTotalAfterDeliveryChange({ storedTotal: 340, obligationsSumBefore: 340, deliveryOld: 40, deliveryNew: 80 }), { total: 380, mode: 'included', mismatch: false });
  // לא תואם => הפרש בלבד + דגל
  assert.deepEqual(C.computeStoredTotalAfterDeliveryChange({ storedTotal: 500, obligationsSumBefore: 380, deliveryOld: 80, deliveryNew: 40 }), { total: 460, mode: 'delta', mismatch: true });
  // ריק / 0 / null => לא נוגעים
  for (const v of [null, undefined, 0]) assert.equal(C.computeStoredTotalAfterDeliveryChange({ storedTotal: v, obligationsSumBefore: 380, deliveryOld: 80, deliveryNew: 40 }).mode, 'untouched');
  // אגורות
  assert.equal(C.computeStoredTotalAfterDeliveryChange({ storedTotal: 100.1, obligationsSumBefore: 100.1, deliveryOld: 40.05, deliveryNew: 20.02 }).total, 80.07);
});
