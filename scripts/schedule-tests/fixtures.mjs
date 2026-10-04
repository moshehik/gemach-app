// נתוני דמה ללו״ז: "היום" = חמישי 2026-10-01 (09:00 שעון ישראל). שישי 2.10 ערב שמיני עצרת, שבת 3.10 חג.
// כל התאריכים נכתבים כ-instant UTC, בשתי צורות האחסון הקיימות ב-DB (חצות ישראלית = 21:00Z, וחצות UTC).
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

export const NOW = d('2026-10-01T06:00:00Z'); // 09:00 שעון ישראל, חמישי
export const DAY = '2026-10-01';

export const ORDERS = [
  // --- שלב 1: הזמנות שנרשמו ביום ---
  order(1001, { orderDate: d('2026-10-01T05:00:00Z'), eventDate: d('2026-10-14T21:00:00Z'), customer: cust('מרים', 'אברהם') }),
  order(1002, { orderDate: d('2026-09-30T21:30:00Z'), eventDate: d('2026-10-19T21:00:00Z'), customer: cust('רבקה', 'ברק') }), // 00:30 IL Oct 1
  order(1003, { orderDate: d('2026-10-01T21:30:00Z'), eventDate: d('2026-10-20T21:00:00Z'), customer: cust('חנה', 'גל') }),   // 00:30 IL Oct 2 - NOT Oct 1
  order(1004, { orderDate: d('2026-10-01T05:00:00Z'), status: 'טיוטה', eventDate: d('2026-10-05T21:00:00Z'), customer: cust('טיוטה', 'טיוטה') }),
  // --- שלב 4 הכנה (-3 ימי עסקים): אירוע שלישי 6.10 -> הכנה חמישי 1.10 ---
  order(1005, { eventDate: d('2026-10-05T21:00:00Z'), branch: 'נווה יעקב', customer: cust('לאה', 'דוד'), items: [item({ dressItem: { location: 'מדף 3', inRepair: false, sizeText: '40', dress: { name: 'ורד', barcodePrefix: 123 } } })] }),
  order(1006, { eventDate: d('2026-10-06T00:00:00Z'), branch: 'גב״ש', customer: cust('אסתר', 'הלוי'), items: [item({ barcodePrefix: 555, dressItem: null }), item({ barcodePrefix: 555 })] }),
  // --- שלב 6 איסוף (-2): אירוע שני 5.10 -> איסוף חמישי 1.10 ---
  order(1007, { eventDate: d('2026-10-04T21:00:00Z'), pickupBranch: 'גב״ש', customer: cust('יעל', 'ויס'), items: [item({ isTaken: true }), item({ isTaken: false, takenDate: null })] }),
  order(1008, { eventDate: d('2026-10-04T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', customer: cust('ציפי', 'זק') }),
  // --- שלב 5 משלוח הלוך: אירוע שישי 2.10, delivery_days_before=1 -> יוצא חמישי 1.10; בלי רחוב ---
  order(1009, { eventDate: d('2026-10-01T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש', customer: cust('דבורה', 'חן', { street: '', houseNum: null }), items: [item(), item()], obligations: [{ description: 'משלוח הלוך', isDeleted: false }] }),
  // --- שלב 9 משלוח חזור: אירוע רביעי 30.9, delivery_days_after=1 -> איסוף חמישי 1.10 ---
  order(1010, { eventDate: d('2026-09-29T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך-חזור', customer: cust('נעמי', 'טל', { city: 'בית שמש' }), items: [item({ isTaken: true })], obligations: [{ description: 'משלוח חזור', isDeleted: false }] }),
  // --- שלב 7 אירוע + שלב 2 תיקונים (offset 0): אירוע חמישי 1.10 ---
  order(1011, { eventDate: d('2026-09-30T21:00:00Z'), eventDateHebrew: 'כ תשרי', customer: cust('שושנה', 'יוסף'), items: [item({ neckAlteration: 2, alterationDone: false }), item({ lengthAlteration: '3', alterationDone: true })] }),
  order(1012, { eventDate: d('2026-09-27T21:00:00Z'), fromDate: d('2026-09-27T21:00:00Z'), toDate: d('2026-10-01T21:00:00Z'), isAbroad: true, customer: cust('גילה', 'כץ') }), // חו"ל 28.9-2.10 משתרע על 1.10
  // --- שלב 8 החזרה ידנית: אירוע רביעי 30.9 + יום עסקים (שישי/שבת בלבד) -> חמישי 1.10 ---
  order(1013, { eventDate: d('2026-09-29T21:00:00Z'), customer: cust('תמר', 'לב', { city: 'ירושלים', street: 'יפו', houseNum: 10 }), items: [item({ isTaken: true })] }),
  order(1014, { eventDate: d('2026-09-28T21:00:00Z'), fromDate: d('2026-09-28T21:00:00Z'), toDate: d('2026-10-01T00:00:00Z'), isAbroad: true, customer: cust('מלכה', 'מור'), items: [item({ isTaken: true, isReturned: true, returnedOk: false })] }),
  order(1015, { eventDate: d('2026-09-29T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך', customer: cust('פנינה', 'נוי'), items: [item({ isTaken: true })] }), // משלוח הלוך בלבד -> חוזרת ידנית
  // --- שלב 2: ערך legacy 'null' באורך = אין תיקון ---
  order(1016, { eventDate: d('2026-09-30T21:00:00Z'), customer: cust('רות', 'סגל'), items: [item({ lengthAlteration: 'null' })] }),
  // --- איחורים (נבדקים עם יום 24.9) ---
  order(1017, { eventDate: d('2026-09-22T21:00:00Z'), customer: cust('אביגיל', 'עמר'), items: [item({ isTaken: true })] }),            // החזרה 24.9, 7 ימים -> באיחור
  order(1018, { eventDate: d('2026-09-27T21:00:00Z'), customer: cust('ברכה', 'פז'), items: [item()] }),                                // איסוף 24.9 (26-27.9 שבת/חג), לא נלקח -> באיחור
  // --- מסוננים ---
  order(1019, { isDeleted: true, orderDate: d('2026-10-01T05:00:00Z'), eventDate: d('2026-09-30T21:00:00Z'), customer: cust('מחוקה', 'מחוקה') }),
  order(1020, { eventDate: d('2026-09-30T21:00:00Z'), customer: cust('בלי', 'פריטים'), items: [item({ isDeleted: true })] }), // כל הפריטים מחוקים
  // --- A4: משלוח חזור שכבר הוחזר (תקין) - אירוע 30.9 -> איסוף שליח 1.10, returnCondition 'ok' ---
  order(1022, { eventDate: d('2026-09-29T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך-חזור', customer: cust('הוחזר', 'תקין', { city: 'בית שמש' }), items: [item({ isTaken: true, isReturned: true, returnedOk: true }), item({ isTaken: true, returnDate: d('2026-10-01T08:00:00Z'), returnedOk: true })] }),
  // --- A7: הזמנה שעוד לא שולמה (נרשמה 29.9) כן מופיעה בשלב 1 ---
  order(1021, { orderDate: d('2026-09-29T07:00:00Z'), eventDate: d('2026-10-20T21:00:00Z'), status: 'חדש', isPaid: false, totalAmount: 500, customer: cust('לא', 'שולם') }),
  // --- סקירת WP1 ממצא 1: טיוטת משלוח (עגלה שנשמרה אוטומטית) - אירוע 2.10 -> היתה מופיעה כמשלוח הלוך ב-1.10 ---
  order(9001, { orderDate: d('2026-09-25T07:00:00Z'), status: 'טיוטה', eventDate: d('2026-10-01T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך', customer: cust('טיוטת', 'משלוח', { street: '', houseNum: null }), items: [item()] }),
  // --- סקירה 2.10 חוסם 2: הזמנת חו"ל שה-fromDate שלה (ג' 13.10) רחוק מה-eventDate (ג' 27.10): הכנה ה' 8.10, איסוף א' 11.10,
  //     תיקון ביום ההתחלה 13.10 - ה-WHERE חייב לסנן גם לפי fromDate ---
  order(1023, { eventDate: d('2026-10-27T00:00:00Z'), fromDate: d('2026-10-13T00:00:00Z'), toDate: d('2026-10-29T00:00:00Z'), isAbroad: true, customer: cust('חו״ל', 'רחוקה'), items: [item({ neckAlteration: 1 })] }),
  // --- החלטת הבעלים 2.10.2026: החזרה נוחתת תמיד על יום עובד (שלב 8) ---
  order(2002, { eventDate: d('2026-10-14T00:00:00Z'), fromDate: d('2026-10-14T00:00:00Z'), toDate: d('2026-10-16T00:00:00Z'), isAbroad: true, customer: cust('שישי', 'מפורש'), items: [item({ isTaken: true })] }),   // toDate שישי 16.10 -> ראשון 18.10
  order(2003, { eventDate: d('2026-10-15T00:00:00Z'), returnDate: d('2026-10-17T00:00:00Z'), customer: cust('שבת', 'מפורשת'), items: [item({ isTaken: true })] }),                                            // returnDate שבת 17.10 -> ראשון 18.10
  order(2004, { eventDate: d('2026-09-17T00:00:00Z'), toDate: d('2026-09-20T00:00:00Z'), customer: cust('ערב', 'כיפור'), items: [item({ isTaken: true })] }),                                                  // toDate ערב יו"כ (א' 20.9) -> ג' 22.9
  order(2005, { eventDate: d('2026-10-12T00:00:00Z'), toDate: d('2026-10-13T00:00:00Z'), customer: cust('יום', 'בעלים'), items: [item({ isTaken: true })] }),                                                  // toDate ג' 13.10; אם הבעלים סוגר את 13.10 -> ד' 14.10
  order(2006, { eventDate: d('2026-10-16T00:00:00Z'), customer: cust('אירוע', 'בשישי'), items: [item({ isTaken: true })] }),                                                                                   // אירוע שישי 16.10, בלי תאריך מפורש: offset 0 -> ראשון 18.10
];

export const SHIFTS = [
  { id: 's1', employeeId: 'e1', entryTime: d('2026-10-01T05:00:00Z'), exitTime: null, isDeleted: false, hourlyWageSnapshot: 45, totalCalculated: 0, employee: { firstName: 'רחלי', lastName: 'לוי', fullName: 'רחלי לוי', hourlyWage: 45 } },
  { id: 's2', employeeId: 'e2', entryTime: d('2026-09-30T20:00:00Z'), exitTime: null, isDeleted: false, hourlyWageSnapshot: 45, employee: { firstName: 'פייגי', lastName: 'ברוך', fullName: null } }, // 23:00 IL אתמול, עדיין פתוחה
  { id: 's3', employeeId: 'e3', entryTime: d('2026-09-30T10:00:00Z'), exitTime: d('2026-09-30T14:00:00Z'), isDeleted: false, employee: { firstName: 'אתמול', lastName: 'סגורה', fullName: null } },
  { id: 's4', employeeId: 'e4', entryTime: d('2026-10-01T07:00:00Z'), exitTime: null, isDeleted: true, employee: { firstName: 'מחוקה', lastName: 'מחוקה', fullName: null } },
  { id: 's5', employeeId: 'e5', entryTime: d('2026-10-01T09:00:00Z'), exitTime: d('2026-10-01T12:00:00Z'), isDeleted: false, employee: { firstName: 'שרה', lastName: 'גולד', fullName: 'שרה גולד' } },
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
