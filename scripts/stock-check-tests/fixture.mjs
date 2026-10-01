// נתוני דמה לבדיקות בדיקת המלאי. תאריך היעד: רביעי 14.10.2026 (ג' חשון תשפ"ז).
// חציצה 3 ימי עסקים (מדלגים שישי/שבת) סביב היעד: ראשון 11.10, שני 12.10, שלישי 13.10 |
// חמישי 15.10, ראשון 18.10, שני 19.10. שלישי 20.10 = +4, כבר לא חוסם.
const utc = (y, m, d, h = 0) => new Date(Date.UTC(y, m - 1, d, h));
const minutesAgo = (n) => new Date(Date.now() - n * 60 * 1000);

const order = (over = {}) => ({ orderId: 1, legacyId: 7, isDeleted: false, isAbroad: false, fromDate: null, toDate: null, eventDate: null, ...over });

export const TARGET = '2026-10-14';

export function buildDb() {
  const dressModel = [
    { id: 'mA', name: 'שמלת ערב ורד', barcodePrefix: 549, isDeleted: false },
    { id: 'mB', name: 'שמלת כלה אלמוג', barcodePrefix: 622, isDeleted: false },
    { id: 'mC', name: 'שמלת תחרה', barcodePrefix: 811, isDeleted: false },
    { id: 'mD', name: 'דגם מחוק', barcodePrefix: 999, isDeleted: true },
    { id: 'mE', name: 'שמלת ערב סגולה', barcodePrefix: 550, isDeleted: false },
    // כתיבי מידה כמו בנתונים האמיתיים (2.10.2026): אפס מוביל, "8" לצד "08", רווחים, עשרוני, אות עברית
    { id: 'mF', name: 'שמלת ילדה', barcodePrefix: 700, isDeleted: false },
  ];
  const item = (id, dressModelId, sizeText, over = {}) => ({
    id, dressModelId, sizeText, quantity: 1, location: null, inRepair: false, notInUse: false, isDeleted: false,
    barcodePrefix: dressModel.find((m) => m.id === dressModelId)?.barcodePrefix ?? null, ...over,
  });
  const dressItem = [
    item('a1', 'mA', '10'), item('a2', 'mA', '10'), item('a3', 'mA', '12'), item('a4', 'mA', '14'),
    item('a5', 'mA', '36'), item('a6', 'mA', '36'), item('a7', 'mA', null), // null = "כללי"
    item('a8', 'mA', '12', { location: 'מחסן ראשי' }), item('a9', 'mA', '12', { location: 'רזרבה' }),
    item('a10', 'mA', '12', { inRepair: true }), item('a11', 'mA', '40', { notInUse: true }), item('a12', 'mA', '38', { isDeleted: true }),
    item('b1', 'mB', '34'), item('b2', 'mB', '36'), item('b3', 'mB', '38'), item('b4', 'mB', '40'),
    item('c1', 'mC', '12', { quantity: 2 }), item('c2', 'mC', '38-40'),
    item('d1', 'mD', '12'),
    item('e1', 'mE', '12'), item('e2', 'mE', '36'), item('e3', 'mE', '40', { quantity: 2 }),
    item('f1', 'mF', '04'), item('f2', 'mF', '06'), item('f3', 'mF', '06'), item('f4', 'mF', '08'), item('f5', 'mF', '8'),
    item('f6', 'mF', '  2'), item('f7', 'mF', '06.1'), item('f8', 'mF', '36א'),
  ];
  const di = (id) => { const x = dressItem.find((i) => i.id === id); return { id: x.id, dressModelId: x.dressModelId, sizeText: x.sizeText }; };
  const booking = (id, itemId, over = {}) => ({
    id, dressItemId: itemId, dressItem: itemId ? di(itemId) : null, sizeText: itemId ? di(itemId).sizeText : null,
    barcodePrefix: itemId ? dressItem.find((i) => i.id === itemId).barcodePrefix : null, quantity: 1,
    isDeleted: false, isReturned: false, isTaken: false, barcode: null, cartStatus: 'confirmed', cartStatusDate: minutesAgo(600),
    order: order(), ...over,
  });
  const orderItem = [
    // A/12 ביום היעד, נשמר כמו בייבוא: 21:00 UTC של היום הקודם = חצות בישראל
    booking('o1', 'a3', { order: order({ orderId: 101, eventDate: new Date('2026-10-13T21:00:00.000Z') }) }),
    // A/10 ביום +1 (חמישי) - חוסם
    booking('o2', 'a1', { order: order({ orderId: 102, eventDate: utc(2026, 10, 15) }) }),
    // A/14 בשלישי 20.10 = +4 ימי עסקים - לא חוסם
    booking('o3', 'a4', { order: order({ orderId: 103, eventDate: utc(2026, 10, 20) }) }),
    // B/40 בראשון 18.10 = +2 ימי עסקים (חוסם), אבל +4 ימים קלנדריים (לא חוסם בלי דילוג סופ"ש)
    booking('o4', 'b4', { order: order({ orderId: 104, eventDate: utc(2026, 10, 18) }) }),
    // C/12 החזקת עגלה שפגה (pending לפני שעה, הזמנה מהאתר, לא נלקח, בלי ברקוד) - משתחררת
    booking('o5', 'c1', { cartStatus: 'pending', cartStatusDate: minutesAgo(60), order: order({ orderId: 105, legacyId: null, eventDate: utc(2026, 10, 14) }) }),
    // E/12 החזקת עגלה טרייה (לפני 5 דקות) - נספרת
    booking('o6', 'e1', { cartStatus: 'pending', cartStatusDate: minutesAgo(5), order: order({ orderId: 106, legacyId: null, eventDate: utc(2026, 10, 14) }) }),
    // B/34 בלי dressItem, רק לפי קידומת ברקוד, ביום -1 (שלישי) - חוסם
    booking('o7', null, { barcodePrefix: 622, sizeText: '34', order: order({ orderId: 107, eventDate: utc(2026, 10, 13) }) }),
    // B/36 בהזמנה מחוקה - לא נספרת
    booking('o8', 'b2', { order: order({ orderId: 108, isDeleted: true, eventDate: utc(2026, 10, 14) }) }),
    // A/36 בראשון 11.10 = -3 ימי עסקים (קצה החלון) - חוסם יחידה אחת משתיים
    booking('o9', 'a5', { order: order({ orderId: 109, eventDate: utc(2026, 10, 11) }) }),
    // E/36 החזקה שפגה אבל הפריט כבר נלקח פיזית - עדיין נספרת
    booking('o10', 'e2', { cartStatus: 'pending', cartStatusDate: minutesAgo(60), isTaken: true, order: order({ orderId: 110, legacyId: null, eventDate: utc(2026, 10, 14) }) }),
    // E/40 (2 יחידות) הזמנת חו"ל 12.10-14.10 - תופסת את 12.10 ו-13.10 (סוף הטווח לא כולל).
    // שימו לב: המנוע הקיים (occupancyFormula ב-lib/inventory.js) סופר הזמנה רב-יומית פעם לכל יום
    // שהיא חופפת בחלון החציצה - שמלה אחת ליומיים נספרת כשתיים (ר' הדוח). לא שונה כאן.
    booking('o11', 'e3', { order: order({ orderId: 111, isAbroad: true, fromDate: utc(2026, 10, 12), toDate: utc(2026, 10, 14), eventDate: utc(2026, 10, 12) }) }),
  ];
  const systemSetting = [
    { key: 'inventory_buffer_days', value: '3' },
    { key: 'inventory_skip_weekends', value: 'true' },
    { key: 'inventory_hold_minutes', value: '15' },
    { key: 'inventory_include_warehouse', value: 'false' },
    { key: 'allow_renting_reserve_items', value: 'false' },
    { key: 'branches_enabled', value: 'false' },
  ];
  return { dressModel, dressItem, orderItem, order: [], systemSetting };
}

// זמינות צפויה ביום היעד (חציצה 3, דילוג סופ"ש), לפי הנתונים למעלה:
//   A: 10→1, 12→0, 14→1, 36→1, כללי→1     B: 34→0, 36→1, 38→1, 40→0
//   C: 12→2, 38-40→1                        E: 12→0, 36→0, 40→0 (חו"ל, ר' למעלה)   D: דגם מחוק - לא קיים
//   F (בלי הזמנות): 04→1, 06→2, 08→1 + 8→1 (יחד מידה 8 = 2), "  2"→1 (מידה 2), 06.1→1, 36א→1
