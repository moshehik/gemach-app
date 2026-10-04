// נתוני דמה ללו״ז: "היום" = חמישי 2026-10-15 (09:00 שעון ישראל, ד' חשוון תשפ"ז). שישי 16.10 + שבת 17.10 סוף שבוע רגיל.
// כל התאריכים נכתבים כ-instant UTC, בשתי צורות האחסון הקיימות ב-DB (חצות ישראלית ו-חצות UTC). חצות ישראלית =
// 21:00Z עד 25.10.2026 (UTC+3) ו-22:00Z מ-26.10 (UTC+2, אחרי סוף שעון הקיץ).
//
// למה 15.10 ולא 1.10 (הגרסה הקודמת): "ימים לא עובדים" גרסה 2 (lib/businessDays.js, החלטות הבעלים NWD-Q02/Q04,
// 1.10.2026) סוגרת את חול המועד, ו-1.10.2026 הוא חול המועד סוכות - כל השלבים המתוכננים של "היום" היו ריקים.
// כל העולם הוזז קדימה בשבועיים בדיוק (אותו יום בשבוע לכל תאריך), כך שכל היחסים בין ההזמנות ל"היום" נשמרו:
// 1.10 -> 15.10, 24.9 ("יום עבר" של בדיקות האיחור) -> 8.10, 12-18.10 -> 26.10-1.11. בטווח החדש (6.10-12.11) אין
// חג, ערב חג או חול המועד - שישי/שבת הם הימים הסגורים היחידים, בדיוק כמו בעולם הקודם (שם החגים נפלו כולם
// על שישי/שבת או על חול המועד שהיה פתוח בגרסה 1). יוצאת דופן: 2004 נשארה ב-17-20.9 (ערב יום כיפור).
// בדיקות שצריכות חג אמיתי (ערב חג בשישי, חול המועד סגור) משתמשות בתאריכים של סוכות 2026 במפורש.
const d = (iso) => new Date(iso);
const cust = (first, last, extra = {}) => ({ firstName: first, lastName: last, phone1: '050-1111111', phone2: '', city: 'ירושלים', street: 'הרצל', houseNum: 5, ...extra });
const item = (over = {}) => ({
  id: 'it-' + Math.random().toString(36).slice(2, 8), description: 'שמלה', sizeText: '38', barcodePrefix: 123,
  isTaken: false, takenDate: null, isReturned: false, returnDate: null, returnedOk: false, isDeleted: false,
  neckAlteration: 0, lengthAlteration: null, sleeveAlteration: 0, alterationDetails: null, alterationDone: false,
  dressItem: null, ...over,
});
const order = (orderId, over = {}) => ({
  orderId, status: null, isDeleted: false, orderDate: d('2026-09-01T08:00:00Z'), eventDate: null, eventDateHebrew: null,
  fromDate: null, toDate: null, returnDate: null, isAbroad: false, extraDay: null, customSpacing: null,
  branch: null, pickupBranch: null, notes: '', internalNotes: 'פנימי', isDelivery: false, deliveryDirection: null,
  deliveryAddress: null, deliveryCity: null, deliveryOneDayBefore: false,
  customer: cust('שרה', 'כהן'), employee: { id: 'emp-1', firstName: 'רחלי', lastName: 'לוי', fullName: 'רחלי לוי', roleId: 1, isActive: true, hourlyWage: 50 },
  items: [item()], obligations: [], ...over,
});

export const NOW = d('2026-10-15T06:00:00Z'); // 09:00 שעון ישראל, חמישי
export const DAY = '2026-10-15';

export const ORDERS = [
  // --- שלב 1: הזמנות שנרשמו ביום ---
  order(1001, { orderDate: d('2026-10-15T05:00:00Z'), eventDate: d('2026-10-28T22:00:00Z'), customer: cust('מרים', 'אברהם') }), // אירוע חמישי 29.10 (חצות ישראלית בחורף = 22:00Z)
  order(1002, { orderDate: d('2026-10-14T21:30:00Z'), eventDate: d('2026-11-02T22:00:00Z'), customer: cust('רבקה', 'ברק') }), // 00:30 IL Oct 15
  order(1003, { orderDate: d('2026-10-15T21:30:00Z'), eventDate: d('2026-11-03T22:00:00Z'), customer: cust('חנה', 'גל') }),   // 00:30 IL Oct 16 - NOT Oct 15
  order(1004, { orderDate: d('2026-10-15T05:00:00Z'), status: 'טיוטה', eventDate: d('2026-10-19T21:00:00Z'), customer: cust('טיוטה', 'טיוטה') }),
  // --- שלב 4 הכנה (-3 ימי עסקים): אירוע שלישי 20.10 -> הכנה חמישי 15.10 ---
  order(1005, { eventDate: d('2026-10-19T21:00:00Z'), branch: 'נווה יעקב', customer: cust('לאה', 'דוד'), items: [item({ dressItem: { location: 'מדף 3', inRepair: false, sizeText: '40', dress: { name: 'ורד', barcodePrefix: 123 } } })] }),
  order(1006, { eventDate: d('2026-10-20T00:00:00Z'), branch: 'גב״ש', customer: cust('אסתר', 'הלוי'), items: [item({ barcodePrefix: 555, dressItem: null }), item({ barcodePrefix: 555 })] }),
  // --- שלב 6 איסוף (-2): אירוע שני 19.10 -> איסוף חמישי 15.10 ---
  order(1007, { eventDate: d('2026-10-18T21:00:00Z'), pickupBranch: 'גב״ש', customer: cust('יעל', 'ויס'), items: [item({ isTaken: true }), item({ isTaken: false, takenDate: null })] }),
  order(1008, { eventDate: d('2026-10-18T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', customer: cust('ציפי', 'זק') }),
  // --- שלב 5 משלוח הלוך: אירוע שישי 16.10, delivery_days_before=1 -> יוצא חמישי 15.10; בלי רחוב ---
  order(1009, { eventDate: d('2026-10-15T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש', customer: cust('דבורה', 'חן', { street: '', houseNum: null }), items: [item(), item()], obligations: [{ description: 'משלוח הלוך', isDeleted: false }] }),
  // --- שלב 9 משלוח חזור: אירוע רביעי 14.10, delivery_days_after=1 -> איסוף חמישי 15.10 ---
  order(1010, { eventDate: d('2026-10-13T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך-חזור', customer: cust('נעמי', 'טל', { city: 'בית שמש' }), items: [item({ isTaken: true })], obligations: [{ description: 'משלוח חזור', isDeleted: false }] }),
  // --- שלב 7 אירוע + שלב 2 תיקונים (offset 0): אירוע חמישי 15.10 ---
  order(1011, { eventDate: d('2026-10-14T21:00:00Z'), eventDateHebrew: 'ד חשון', customer: cust('שושנה', 'יוסף'), items: [item({ neckAlteration: 2, alterationDone: false }), item({ lengthAlteration: '3', alterationDone: true })] }),
  order(1012, { eventDate: d('2026-10-11T21:00:00Z'), fromDate: d('2026-10-11T21:00:00Z'), toDate: d('2026-10-15T21:00:00Z'), isAbroad: true, customer: cust('גילה', 'כץ') }), // חו"ל 12.10-16.10 משתרע על 15.10
  // --- שלב 8 החזרה ידנית: אירוע רביעי 14.10 + יום עסקים -> חמישי 15.10 ---
  order(1013, { eventDate: d('2026-10-13T21:00:00Z'), customer: cust('תמר', 'לב', { city: 'ירושלים', street: 'יפו', houseNum: 10 }), items: [item({ isTaken: true })] }),
  order(1014, { eventDate: d('2026-10-12T21:00:00Z'), fromDate: d('2026-10-12T21:00:00Z'), toDate: d('2026-10-15T00:00:00Z'), isAbroad: true, customer: cust('מלכה', 'מור'), items: [item({ isTaken: true, isReturned: true, returnedOk: false })] }),
  order(1015, { eventDate: d('2026-10-13T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך', customer: cust('פנינה', 'נוי'), items: [item({ isTaken: true })] }), // משלוח הלוך בלבד -> חוזרת ידנית
  // --- שלב 2: ערך legacy 'null' באורך = אין תיקון ---
  order(1016, { eventDate: d('2026-10-14T21:00:00Z'), customer: cust('רות', 'סגל'), items: [item({ lengthAlteration: 'null' })] }),
  // --- איחורים (נבדקים עם יום 8.10) ---
  order(1017, { eventDate: d('2026-10-06T21:00:00Z'), customer: cust('אביגיל', 'עמר'), items: [item({ isTaken: true })] }),            // החזרה 8.10, 7 ימים -> באיחור
  order(1018, { eventDate: d('2026-10-11T21:00:00Z'), customer: cust('ברכה', 'פז'), items: [item()] }),                                // איסוף 8.10 (9-10.10 שישי/שבת), לא נלקח -> באיחור
  // --- מסוננים ---
  order(1019, { isDeleted: true, orderDate: d('2026-10-15T05:00:00Z'), eventDate: d('2026-10-14T21:00:00Z'), customer: cust('מחוקה', 'מחוקה') }),
  order(1020, { eventDate: d('2026-10-14T21:00:00Z'), customer: cust('בלי', 'פריטים'), items: [item({ isDeleted: true })] }), // כל הפריטים מחוקים
  // --- A4: משלוח חזור שכבר הוחזר (תקין) - אירוע 14.10 -> איסוף שליח 15.10, returnCondition 'ok' ---
  order(1022, { eventDate: d('2026-10-13T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך-חזור', customer: cust('הוחזר', 'תקין', { city: 'בית שמש' }), items: [item({ isTaken: true, isReturned: true, returnedOk: true }), item({ isTaken: true, returnDate: d('2026-10-15T08:00:00Z'), returnedOk: true })] }),
  // --- A7: הזמנה שעוד לא שולמה (נרשמה 13.10) כן מופיעה בשלב 1 ---
  order(1021, { orderDate: d('2026-10-13T07:00:00Z'), eventDate: d('2026-11-03T22:00:00Z'), status: 'חדש', isPaid: false, totalAmount: 500, customer: cust('לא', 'שולם') }),
  // --- סקירת WP1 ממצא 1: טיוטת משלוח (עגלה שנשמרה אוטומטית) - אירוע 16.10 -> היתה מופיעה כמשלוח הלוך ב-15.10 ---
  order(9001, { orderDate: d('2026-10-09T07:00:00Z'), status: 'טיוטה', eventDate: d('2026-10-15T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך', customer: cust('טיוטת', 'משלוח', { street: '', houseNum: null }), items: [item()] }),
  // --- סקירה 2.10 חוסם 2: הזמנת חו"ל שה-fromDate שלה (ג' 27.10) רחוק מה-eventDate (ג' 10.11): הכנה ה' 22.10, איסוף א' 25.10
  //     (יום סוף שעון הקיץ), תיקון ביום ההתחלה 27.10 - ה-WHERE חייב לסנן גם לפי fromDate ---
  order(1023, { eventDate: d('2026-11-10T00:00:00Z'), fromDate: d('2026-10-27T00:00:00Z'), toDate: d('2026-11-12T00:00:00Z'), isAbroad: true, customer: cust('חו״ל', 'רחוקה'), items: [item({ neckAlteration: 1 })] }),
  // --- החלטת הבעלים 2.10.2026: החזרה נוחתת תמיד על יום עובד (שלב 8) ---
  order(2002, { eventDate: d('2026-10-28T00:00:00Z'), fromDate: d('2026-10-28T00:00:00Z'), toDate: d('2026-10-30T00:00:00Z'), isAbroad: true, customer: cust('שישי', 'מפורש'), items: [item({ isTaken: true })] }),   // toDate שישי 30.10 -> ראשון 1.11
  order(2003, { eventDate: d('2026-10-29T00:00:00Z'), returnDate: d('2026-10-31T00:00:00Z'), customer: cust('שבת', 'מפורשת'), items: [item({ isTaken: true })] }),                                            // returnDate שבת 31.10 -> ראשון 1.11
  order(2004, { eventDate: d('2026-09-17T00:00:00Z'), toDate: d('2026-09-20T00:00:00Z'), customer: cust('ערב', 'כיפור'), items: [item({ isTaken: true })] }),                                                  // toDate ערב יו"כ (א' 20.9) -> ג' 22.9 (לא הוזזה - קשורה ליום כיפור)
  order(2005, { eventDate: d('2026-10-26T00:00:00Z'), toDate: d('2026-10-27T00:00:00Z'), customer: cust('יום', 'בעלים'), items: [item({ isTaken: true })] }),                                                  // toDate ג' 27.10; אם הבעלים סוגר את 27.10 -> ד' 28.10
  order(2006, { eventDate: d('2026-10-30T00:00:00Z'), customer: cust('אירוע', 'בשישי'), items: [item({ isTaken: true })] }),                                                                                   // אירוע שישי 30.10, בלי תאריך מפורש: offset 0 -> ראשון 1.11
];

export const SHIFTS = [
  { id: 's1', employeeId: 'e1', entryTime: d('2026-10-15T05:00:00Z'), exitTime: null, isDeleted: false, hourlyWageSnapshot: 45, totalCalculated: 0, employee: { firstName: 'רחלי', lastName: 'לוי', fullName: 'רחלי לוי', hourlyWage: 45 } },
  { id: 's2', employeeId: 'e2', entryTime: d('2026-10-14T20:00:00Z'), exitTime: null, isDeleted: false, hourlyWageSnapshot: 45, employee: { firstName: 'פייגי', lastName: 'ברוך', fullName: null } }, // 23:00 IL אתמול, עדיין פתוחה
  { id: 's3', employeeId: 'e3', entryTime: d('2026-10-14T10:00:00Z'), exitTime: d('2026-10-14T14:00:00Z'), isDeleted: false, employee: { firstName: 'אתמול', lastName: 'סגורה', fullName: null } },
  { id: 's4', employeeId: 'e4', entryTime: d('2026-10-15T07:00:00Z'), exitTime: null, isDeleted: true, employee: { firstName: 'מחוקה', lastName: 'מחוקה', fullName: null } },
  { id: 's5', employeeId: 'e5', entryTime: d('2026-10-15T09:00:00Z'), exitTime: d('2026-10-15T12:00:00Z'), isDeleted: false, employee: { firstName: 'שרה', lastName: 'גולד', fullName: 'שרה גולד' } },
];

export const DRESS_MODELS = [{ barcodePrefix: 555, name: 'לילך' }, { barcodePrefix: 123, name: 'ורד' }];

// org2-style settings: deliveries on, "select by event date" on (the schedule must still work by dispatch day)
export const SETTINGS_ORG2 = [
  { key: 'enable_deliveries', value: 'true' },
  { key: 'delivery_days_before', value: '1' },
  { key: 'delivery_days_after', value: '1' },
  { key: 'deliveries_select_by_event_date', value: 'true' },
  { key: 'delivery_skip_weekends', value: 'false' },
  { key: 'branches_enabled', value: 'true' },
  { key: 'late_return_threshold_days', value: '7' },
  { key: 'require_login', value: 'true' },
];

export function installDb({ settings = SETTINGS_ORG2, extra = {} } = {}) {
  globalThis.__MOCK_DB = {
    order: ORDERS,
    shift: SHIFTS,
    dressModel: DRESS_MODELS,
    systemSetting: settings,
    employee: [
      { id: 'emp-worker', roleId: 5, isActive: true, firstName: 'עובדת', lastName: 'רגילה' },          // מחלקה 5: שורת הרשאה true
      { id: 'emp-worker-blocked', roleId: 6, isActive: true, firstName: 'עובדת', lastName: 'חסומה' },  // מחלקה 6: שורת הרשאה false
      { id: 'emp-no-row', roleId: 7, isActive: true, firstName: 'עובדת', lastName: 'בלי שורה' },        // מחלקה 7: אין שורה -> פתוח (GQ-04, ברירת המחדל של הקטלוג)
      { id: 'emp-head', roleId: 0, isActive: true, firstName: 'הנהלה', lastName: 'ראשית' },
      { id: 'emp-inactive', roleId: 5, isActive: false, firstName: 'לא', lastName: 'פעילה' },
    ],
    // page:schedule פתוח כברירת מחדל לכל עובד (החלטת הבעלים GQ-04, 2.10.2026); שורת false סוגרת
    departmentPermission: [
      { roleId: 5, key: 'page:schedule', value: 'true' },
      { roleId: 6, key: 'page:schedule', value: 'false' },
    ],
    employeePermissionOverride: [],
    ...extra,
  };
  globalThis.__MOCK_CALLS = [];
}
