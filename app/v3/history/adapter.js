/**
 * adapter.js -- מתאם היסטוריה v3 (R23), גרסת ייצור של reports/history-adapter-skeleton.js.
 *
 * שכבת קריאה/תצוגה בלבד (R8): מקבלת שורות AuditLog גולמיות כפי ש-GET /api/audit מחזיר (אחרי
 * attachEmployeeNames) ומחזירה "רשומות פיד" למבנה hf-* של סקיצה B:
 *   {id, ts, cat, icon, text, sub, who, amt, kind, det:[[label,value]], ...}
 * אין כאן כתיבה ואין ייבוא של מודולי שרת/דפדפן -- קובץ טהור, רץ גם ב-node (ר' reports/history-adapter-selftest.mjs).
 * אין ולא תהיה כתיבת AuditLog ידנית: התוסף ב-app/lib/prisma.js כותב הכול.
 * מסמך: docs/redesign-v3/HISTORY-DESIGN.md
 */

/* ============================== BEGIN DICTIONARY ============================== */

/** קטגוריות פיד. שלוש הראשונות בסקיצה; השאר הרחבה. tone נקבע לפי הפעולה, לא לפי הקטגוריה. */
export const CATEGORIES = {
  items:  { label: 'פריטים',    icon: 'dress'    },
  pay:    { label: 'תשלומים',   icon: 'card'     },
  del:    { label: 'משלוח',     icon: 'truck'    },
  dates:  { label: 'תאריכים',   icon: 'cal'      },
  docs:   { label: 'מסמכים',    icon: 'file'     }, // מיילים/הדפסות/חתימות/הערות (תתי-סינון לפי icon, כמו HF_EXTRA)
  rental: { label: 'לקיחה והחזרה', icon: 'bag'   }, // חדש: מחזור החיים של הפריט
  info:   { label: 'פרטי הזמנה', icon: 'pencil'  }, // חדש: סניף, סטטוס, הערות
  cust:   { label: 'פרטי לקוחה', icon: 'user'    },
  dress:  { label: 'דגם ופריט מלאי', icon: 'dress' },
  emp:    { label: 'עובד ומשמרות', icon: 'clock' },
  sys:    { label: 'מערכת והגדרות', icon: 'lock'  },
};

/** שם ישות (AuditLog.entityType) -> תווית קצרה + קטגוריית ברירת מחדל + אייקון ברירת מחדל. */
export const ENTITIES = {
  Order:             { label: 'הזמנה',        cat: 'info',   icon: 'file'  },
  OrderItem:         { label: 'פריט',         cat: 'items',  icon: 'dress' },
  PaymentObligation: { label: 'חיוב',         cat: 'pay',    icon: 'cart'  },
  Payment:           { label: 'תשלום',        cat: 'pay',    icon: 'card'  },
  Refund:            { label: 'זיכוי',        cat: 'pay',    icon: 'undo'  },
  Customer:          { label: 'לקוחה',        cat: 'cust',   icon: 'user'  },
  DressModel:        { label: 'דגם',          cat: 'dress',  icon: 'dress' },
  DressItem:         { label: 'פריט מלאי',    cat: 'dress',  icon: 'dress' },
  Employee:          { label: 'עובד',         cat: 'emp',    icon: 'user'  },
  Shift:             { label: 'משמרת',        cat: 'emp',    icon: 'clock' },
  SystemSetting:     { label: 'הגדרה',        cat: 'sys',    icon: 'lock'  },
  PriceList:         { label: 'מחירון',       cat: 'sys',    icon: 'cash'  },
  PriceRule:         { label: 'כלל מחיר',     cat: 'sys',    icon: 'cash'  },
  Department:        { label: 'מחלקה',        cat: 'sys',    icon: 'lock'  },
  DepartmentPermission:       { label: 'הרשאת מחלקה', cat: 'sys', icon: 'lock' },
  EmployeePermissionOverride: { label: 'הרשאה אישית', cat: 'sys', icon: 'lock' },
  TrustedDevice:     { label: 'מכשיר מהימן',  cat: 'sys',    icon: 'lock'  },
  Notification:      { label: 'התראה',        cat: 'sys',    icon: 'info'  },
  NedarimHok:        { label: 'הוראת קבע',    cat: 'pay',    icon: 'bank'  },
  ErrorReport:       { label: 'דיווח שגיאה',  cat: 'sys',    icon: 'alert' },
  System:            { label: 'מערכת',        cat: 'sys',    icon: 'info'  }, // send-email ללא לקוח/עובד
};

/**
 * פעולה (AuditLog.action) -> ניסוח. tone: ok|bad|neutral (צבע תג).
 * verb: פועל קצר לשימוש בניסוח משפט כשאין תבנית ייעודית. cat/icon דורסים את ברירת המחדל של הישות.
 * kind: איך הפעולה משפיעה על צ'יפ הסכום (pay=תשלום, chg=חיוב, crd=זיכוי, null=אין).
 */
export const ACTIONS = {
  CREATE:              { badge: 'נוצר',        verb: 'נוצר',        tone: 'ok'      },
  UPDATE:              { badge: 'עודכן',       verb: 'עודכן',       tone: 'neutral' },
  DELETE:              { badge: 'נמחק',        verb: 'נמחק',        tone: 'bad'     },
  EMAIL_SENT:          { badge: 'מייל',        verb: 'נשלח מייל',   tone: 'neutral', cat: 'docs', icon: 'mail' },
  ADD_PAYMENT:         { badge: 'תשלום',       verb: 'נרשם תשלום',  tone: 'ok',      cat: 'pay',  icon: 'card', kind: 'pay' },
  UPDATE_PAYMENT:      { badge: 'תשלום',       verb: 'עודכן תשלום', tone: 'neutral', cat: 'pay',  icon: 'card' },
  DELETE_PAYMENT:      { badge: 'הוסר',        verb: 'נמחק תשלום',  tone: 'bad',     cat: 'pay',  icon: 'card' },
  REMOVE_PAYMENT:      { badge: 'הוסר',        verb: 'הוסר תשלום זיכוי', tone: 'bad', cat: 'pay', icon: 'undo' },
  REFUND:              { badge: 'זיכוי',       verb: 'נרשם זיכוי',  tone: 'neutral', cat: 'pay',  icon: 'undo', kind: 'crd' },
  EXECUTE:             { badge: 'זיכוי בוצע',  verb: 'בוצע זיכוי',  tone: 'ok',      cat: 'pay',  icon: 'bank' },
  AUTO_CREDIT_REFUND_CREATED: { badge: 'זיכוי אוטו׳', verb: 'נוצר זיכוי אוטומטי', tone: 'neutral', cat: 'pay', icon: 'undo', kind: 'crd' },
  AUTO_CREDIT_REFUND_UPDATED: { badge: 'זיכוי אוטו׳', verb: 'עודכן זיכוי אוטומטי', tone: 'neutral', cat: 'pay', icon: 'undo', kind: 'crd' },
  AUTO_CREDIT_REFUND_CLEARED: { badge: 'זיכוי אוטו׳', verb: 'זיכוי אוטומטי בוטל', tone: 'bad', cat: 'pay', icon: 'undo' },
  CONFIRM_RENTAL:      { badge: 'נלקח',        verb: 'סומן כנלקח',  tone: 'ok',      cat: 'rental', icon: 'bag' },
  RETURN_RENTAL:       { badge: 'הוחזר',       verb: 'הוחזר',       tone: 'ok',      cat: 'rental', icon: 'undo' },
  RETURN_CONDITION:    { badge: 'מצב בהחזרה',  verb: 'עודכן מצב בהחזרה', tone: 'neutral', cat: 'rental', icon: 'check' },
  CANCEL_RENTAL:       { badge: 'בוטלה לקיחה', verb: 'בוטלה לקיחה', tone: 'bad',     cat: 'rental', icon: 'x' },
  CANCEL_RETURN:       { badge: 'בוטלה החזרה', verb: 'בוטלה החזרה', tone: 'bad',     cat: 'rental', icon: 'x' },
  CANCEL_SCAN:         { badge: 'בוטלה סריקה', verb: 'בוטלה סריקה', tone: 'bad',     cat: 'rental', icon: 'x' },
  ADD_AUTO_NOTE:       { badge: 'הערה',        verb: 'נוספה הערה אוטומטית', tone: 'neutral', cat: 'docs', icon: 'file' },
  DEBT_APPROVED:       { badge: 'חוב אושר',    verb: 'אושרה יתרת חוב', tone: 'ok',   cat: 'pay', icon: 'check' },
  CANCEL_DEBT_APPROVAL:{ badge: 'אישור בוטל',  verb: 'בוטל אישור חוב', tone: 'bad',  cat: 'pay', icon: 'x' },
  CANCEL_ITEM:         { badge: 'הוסר',        verb: 'הוסר פריט',   tone: 'bad',     cat: 'items', icon: 'dress' },
  RESTORE_ITEM:        { badge: 'שוחזר',       verb: 'שוחזר פריט',  tone: 'ok',      cat: 'items', icon: 'dress' },
  CANCEL_OBLIGATION:   { badge: 'חיוב בוטל',   verb: 'בוטל חיוב',   tone: 'bad',     cat: 'pay',   icon: 'cart' },
  RESTORE_OBLIGATION:  { badge: 'חיוב שוחזר',  verb: 'שוחזר חיוב',  tone: 'ok',      cat: 'pay',   icon: 'cart' },
  CANCEL_PAYMENT:      { badge: 'תשלום בוטל',  verb: 'בוטל תשלום',  tone: 'bad',     cat: 'pay',   icon: 'card' },
  RESTORE_PAYMENT:     { badge: 'תשלום שוחזר', verb: 'שוחזר תשלום', tone: 'ok',      cat: 'pay',   icon: 'card' },
  CANCEL_ORDER:        { badge: 'בוטלה',       verb: 'ההזמנה בוטלה', tone: 'bad',    cat: 'info',  icon: 'x' },
  CANCEL_CHANGES:      { badge: 'בוטל',        verb: 'בוטלו שינויים שלא נשמרו', tone: 'bad', cat: 'info', icon: 'undo' },
  ALTERATION_DONE:     { badge: 'תיקון בוצע',  verb: 'התיקון בוצע', tone: 'ok',      cat: 'items', icon: 'scissors' },
  UI_ERROR_ALERT:      { badge: 'שגיאה',       verb: 'התראת שגיאה', tone: 'bad',     cat: 'sys',   icon: 'alert' },
};

/**
 * שם שדה (מפתח ב-changesJson) -> תווית קצרה. [label, cat?, icon?, fmt?, hidden?]
 * fmt: money|date|datetime|bool|text|long|phone|dir|status|enum:<name>
 * hidden=true: לא מוצג בפירוט (רעש/טכני/סוד). cat/icon מכריעים סיווג רשומה כשהשדה הוא היחיד שהשתנה.
 * מקור התרגומים הישנים: FIELD_TRANSLATIONS ב-components/HistoryViewer.js (לא הועתק - נוסח מחדש).
 */
export const FIELDS = {
  // --- הזמנה ---
  orderId: ['מס׳ הזמנה', 'info', 'file', 'text'],
  totalAmount: ['סה״כ הזמנה', 'pay', 'cash', 'money'],
  status: ['מצב תשלום', 'pay', 'card', 'status'],
  isPaid: ['שולם', 'pay', 'card', 'bool'],
  paymentDate: ['תאריך תשלום', 'pay', 'cal', 'date'],
  paymentMethod: ['אמצעי תשלום', 'pay', 'card', 'text'],
  eventDate: ['תאריך אירוע', 'dates', 'cal', 'date'],
  eventDateHebrew: ['תאריך אירוע (עברי)', 'dates', 'cal', 'text'],
  fromDate: ['תחילת השכרה', 'dates', 'cal', 'date'],
  toDate: ['סוף השכרה', 'dates', 'cal', 'date'],
  returnDate: ['החזרה עד', 'dates', 'cal', 'date'],
  orderDate: ['תאריך הזמנה', 'dates', 'cal', 'date'],
  customSpacing: ['ריווח ימים', 'dates', 'cal', 'text'],
  extraDay: ['יום נוסף', 'dates', 'cal', 'enum:extraDay'],
  isAbroad: ['אירוע בחו״ל', 'info', 'info', 'bool'],
  isWeekdayEvent: ['אירוע באמצע שבוע', 'info', 'info', 'bool'],
  isPhoneOrder: ['הזמנה טלפונית', 'info', 'info', 'bool'],
  branch: ['סניף', 'info', 'pencil', 'text'],
  pickupBranch: ['סניף איסוף', 'info', 'pencil', 'text'],
  notes: ['הערה', 'docs', 'file', 'long'],
  orderNotes: ['הערת הזמנה', 'docs', 'file', 'long'],
  internalNotes: ['הערה פנימית', 'docs', 'lock', 'long'],
  hasSignedRegulations: ['חתימה על התקנון', 'docs', 'sig', 'bool'],
  isDelivery: ['משלוח', 'del', 'truck', 'bool'],
  deliveryDirection: ['כיוון משלוח', 'del', 'truck', 'enum:deliveryDirection'],
  deliveryAddress: ['כתובת משלוח', 'del', 'truck', 'text'],
  deliveryCity: ['עיר משלוח', 'del', 'truck', 'text'],
  deliveryOneDayBefore: ['משלוח יום לפני', 'del', 'truck', 'bool'],
  hokDetails: ['הוראת קבע', 'pay', 'bank', 'text', true],
  isDeleted: ['בוטל', null, 'x', 'bool'],
  deletedAt: ['זמן ביטול', null, 'x', 'datetime', true],
  approvedDebtAmount: ['חוב שאושר', 'pay', 'check', 'money'],
  discarded: ['מה בוטל', 'info', 'undo', 'text'],
  note: ['הערה', 'docs', 'file', 'text'],
  // --- פריט הזמנה ---
  dressItemId: ['פריט מלאי', 'items', 'dress', 'text', true],
  dressModelId: ['דגם', 'items', 'dress', 'text', true],
  description: ['תיאור', 'items', 'dress', 'text'],
  sizeText: ['מידה', 'items', 'dress', 'text'],
  size: ['מידה', 'items', 'dress', 'text'],
  price: ['מחיר', 'items', 'cash', 'money'],
  basePrice: ['מחיר בסיס', 'items', 'cash', 'money'],
  finalPrice: ['מחיר סופי', 'items', 'cash', 'money'],
  quantity: ['כמות', 'items', 'dress', 'text'],
  repairs: ['תיקונים', 'items', 'scissors', 'text'],
  neckAlteration: ['תיקון צוואר', 'items', 'scissors', 'bool'],
  sleeveAlteration: ['תיקון שרוול', 'items', 'scissors', 'bool'],
  lengthAlteration: ['תיקון אורך', 'items', 'scissors', 'text'],
  alterationDetails: ['פירוט תיקון', 'items', 'scissors', 'long'],
  alterationDone: ['תיקון הושלם', 'items', 'scissors', 'bool'],
  barcode: ['ברקוד', 'rental', 'bag', 'text'],
  barcodePrefix: ['קידומת ברקוד', 'rental', 'bag', 'text', true],
  isTaken: ['נלקח', 'rental', 'bag', 'bool'],
  takenDate: ['תאריך לקיחה', 'rental', 'bag', 'datetime'],
  isReturned: ['הוחזר', 'rental', 'undo', 'bool'],
  returnedOk: ['הוחזר תקין', 'rental', 'check', 'bool'],
  isDamagedReturn: ['הוחזר פגום', 'rental', 'alert', 'bool'],
  barcodeInvalid: ['ברקוד לא תקין', 'rental', 'alert', 'bool'],
  barcodeInvalidHandled: ['ברקוד טופל', 'rental', 'check', 'bool'],
  manualBarcodeEntry: ['ברקוד הוקלד ידנית', 'rental', 'pencil', 'bool'],
  manualBarcodeConfirmed: ['ברקוד ידני אושר', 'rental', 'check', 'bool'],
  cartStatus: ['מצב עגלה', 'items', 'cart', 'enum:cartStatus', true],
  cartStatusDate: ['תאריך מצב עגלה', null, null, 'datetime', true],
  // --- חיוב / תשלום / זיכוי ---
  amount: ['סכום', 'pay', 'cash', 'money'],
  productId: ['מק״ט מחירון', 'pay', 'cart', 'text', true],
  isRefund: ['זיכוי', 'pay', 'undo', 'bool'],
  isManual: ['חיוב ידני', 'pay', 'pencil', 'bool'],
  orderItemId: ['פריט משויך', 'pay', 'dress', 'text', true],
  reason: ['סיבה', 'pay', 'file', 'text'],
  bankName: ['בנק', 'pay', 'bank', 'text'],
  bankBranch: ['סניף בנק', 'pay', 'bank', 'text'],
  bankAccount: ['חשבון', 'pay', 'bank', 'text'],
  bankAccountName: ['שם בעל החשבון', 'pay', 'bank', 'text'],
  paymentDetails: ['פרטי תשלום', 'pay', 'card', 'text'],
  isExecuted: ['הזיכוי בוצע', 'pay', 'bank', 'bool'],
  executionDate: ['תאריך ביצוע', 'pay', 'bank', 'datetime'],
  executedBy: ['מבצע הזיכוי', 'pay', 'bank', 'text', true],
  paymentId: ['תשלום משויך', 'pay', 'card', 'text', true],
  isAutoGenerated: ['נוצר אוטומטית', 'pay', 'undo', 'bool'],
  // --- מייל (EMAIL_SENT) ---
  to: ['נמען', 'docs', 'mail', 'text'],
  cc: ['העתק', 'docs', 'mail', 'text'],
  subject: ['נושא', 'docs', 'mail', 'text'],
  body: ['תוכן המייל', 'docs', 'mail', 'long'],
  type: ['סוג מסמך', 'docs', 'print', 'text'],
  sendMode: ['אופן שליחה', 'docs', 'mail', 'text', true],
  files: ['קבצים מצורפים', 'docs', 'file', 'files'],
  driveLinks: ['קישורי Drive', 'docs', 'file', 'text', true],
  // --- לקוחה ---
  firstName: ['שם פרטי', 'cust', 'user', 'text'],
  lastName: ['שם משפחה', 'cust', 'user', 'text'],
  fullName: ['שם מלא', 'cust', 'user', 'text'],
  phone1: ['טלפון', 'cust', 'user', 'phone'],
  phone2: ['טלפון נוסף', 'cust', 'user', 'phone'],
  email: ['מייל', 'cust', 'mail', 'text'],
  emailSuffix: ['סיומת מייל', 'cust', 'mail', 'text', true],
  city: ['עיר', 'cust', 'user', 'text'],
  street: ['רחוב', 'cust', 'user', 'text'],
  houseNum: ['מס׳ בית', 'cust', 'user', 'text'],
  officeNotes: ['הערת משרד', 'cust', 'file', 'long'],
  registrationDate: ['תאריך רישום', 'cust', 'cal', 'date'],
  isBlocked: ['חסימה', 'cust', 'lock', 'bool'],
  blockedReason: ['סיבת חסימה', 'cust', 'lock', 'text'],
  // --- דגם / פריט מלאי ---
  name: ['שם דגם', 'dress', 'dress', 'text'],
  priceCategory: ['קטגוריית מחיר', 'dress', 'cash', 'text'],
  inInspection: ['בבדיקה', 'dress', 'dress', 'bool'],
  imageUrl: ['תמונה', 'dress', 'dress', 'text', true],
  thumbnailUrl: ['תמונה ממוזערת', 'dress', 'dress', 'text', true],
  entryDateToRepo: ['כניסה למלאי', 'dress', 'cal', 'date'],
  exitDateFromRepo: ['יציאה מהמלאי', 'dress', 'cal', 'date'],
  inactiveReason: ['סיבת אי-פעילות', 'dress', 'info', 'text'],
  isSplit: ['שמלה דו-חלקית', 'dress', 'dress', 'bool'],
  isPremium: ['פרימיום', 'dress', 'dress', 'bool'],
  serialNumber: ['מס׳ סידורי', 'dress', 'dress', 'text'],
  dressBarcode: ['ברקוד פריט', 'dress', 'dress', 'text'],
  dressName: ['שם שמלה', 'dress', 'dress', 'text'],
  location: ['מיקום', 'dress', 'dress', 'text'],
  locationNum: ['מס׳ מיקום', 'dress', 'dress', 'text'],
  cartonNumber: ['מס׳ קרטון', 'dress', 'dress', 'text'],
  inRepair: ['בתיקון', 'dress', 'scissors', 'bool'],
  notInUse: ['לא בשימוש', 'dress', 'lock', 'bool'],
  notInUseSince: ['לא בשימוש מאז', 'dress', 'cal', 'date'],
  notInUseReason: ['סיבה', 'dress', 'info', 'text'],
  // --- עובד / משמרת ---
  roleId: ['מחלקה', 'emp', 'user', 'text'],
  isActive: ['פעיל', 'emp', 'user', 'bool'],
  hourlyWage: ['שכר לשעה', 'emp', 'cash', 'money'],
  travelExpenses: ['נסיעות', 'emp', 'cash', 'bool'],
  joinDate: ['תאריך הצטרפות', 'emp', 'cal', 'date'],
  password: ['סיסמה', 'emp', 'lock', 'secret'],
  pinHash: ['קוד קצר', 'emp', 'lock', 'secret'],
  mustResetPassword: ['חובת איפוס סיסמה', 'emp', 'lock', 'bool'],
  themeColor: ['העדפות עיצוב', 'emp', 'pencil', 'text', true],
  profileImage: ['תמונת פרופיל', 'emp', 'user', 'text', true],
  receiveEmailAlerts: ['התראות במייל', 'emp', 'mail', 'bool'],
  showAi: ['הרשאת AI', 'emp', 'lock', 'bool'],
  canReportErrors: ['דיווח שגיאות', 'emp', 'alert', 'bool'],
  date: ['תאריך', 'emp', 'cal', 'date'],
  hebrewDate: ['תאריך עברי', 'emp', 'cal', 'text', true],
  entryTime: ['כניסה', 'emp', 'clock', 'datetime'],
  exitTime: ['יציאה', 'emp', 'clock', 'datetime'],
  totalMinutes: ['דקות', 'emp', 'clock', 'text'],
  totalCalculated: ['לתשלום', 'emp', 'cash', 'money'],
  hourlyWageSnapshot: ['שכר בעת המשמרת', 'emp', 'cash', 'money', true],
  travelExpensesSnapshot: ['נסיעות בעת המשמרת', 'emp', 'cash', 'money', true],
  employeeId: ['עובד', null, 'user', 'text', true],
  // --- הגדרות ---
  key: ['מפתח הגדרה', 'sys', 'lock', 'text'],
  value: ['ערך', 'sys', 'lock', 'text'],
  category: ['קטגוריה', 'sys', 'lock', 'text'],
  // --- שדות שהופיעו במסך הישן (טווחים, דוחות שגיאה, מייל) ---
  fromSize: ['ממידה', 'info', 'pencil', 'text'],
  toSize: ['עד מידה', 'info', 'pencil', 'text'],
  minSize: ['מידה מינימלית', 'info', 'pencil', 'text'],
  maxSize: ['מידה מקסימלית', 'info', 'pencil', 'text'],
  startDate: ['תאריך התחלה', 'dates', 'cal', 'date'],
  endDate: ['תאריך סיום', 'dates', 'cal', 'date'],
  deposit: ['פיקדון', 'pay', 'cash', 'money'],
  refund: ['החזר', 'pay', 'undo', 'money'],
  pageUrl: ['כתובת דף', 'sys', 'info', 'text', true],
  errorMessage: ['הודעת שגיאה', 'sys', 'alert', 'long'],
  loadingError: ['שגיאת טעינה', 'sys', 'alert', 'long'],
  isGuest: ['אורחת', 'sys', 'user', 'bool'],
  fileName: ['שם קובץ', 'docs', 'file', 'text'],
  sentAt: ['נשלח בתאריך', 'docs', 'mail', 'datetime'],
  employeeName: ['שם עובד', null, 'user', 'text', true],
  timestamp: ['זמן', null, null, 'datetime', true],
  // --- שדות טכניים משותפים (לא מוצגים) ---
  id: ['מזהה', null, null, 'text', true],
  legacyId: ['מזהה ישן', null, null, 'text', true],
  customerId: ['לקוחה', null, null, 'text', true],
  createdAt: ['נוצר', null, null, 'datetime', true],
  updatedAt: ['עודכן', null, null, 'datetime', true],
};

/** ערכי enum שמוצגים כמילים. */
export const ENUMS = {
  extraDay: { before: 'יום לפני', after: 'יום אחרי' },
  deliveryDirection: { 'הלוך': 'הלוך', 'חזור': 'חזור', 'הלוך-חזור': 'הלוך-חזור' },
  cartStatus: { pending: 'ממתין', confirmed: 'מאושר' },
};

/* ================================ END DICTIONARY ============================== */

/* --------------------------- 1. פענוח וניקוי changesJson --------------------------- */

const TECH_SKIP = new Set(['id', 'legacyId', 'createdAt', 'updatedAt']);

/** שדות/פעולות/ישויות שנתקלנו בהם ואינם במילון -- לגילוי פערים (מוצג ב-console בפיתוח בלבד). */
export const missingLabels = new Set();
const noteMissing = (kind, name) => { if (name) missingLabels.add(`${kind}:${name}`); };

const isFT = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('from' in v || 'to' in v);
const empty = (v) => v === null || v === undefined || v === '';

/**
 * ארבעת/שבעת המבנים שנמצאים ב-changesJson היום, ומה הופך אותם למבנה אחיד:
 *   diff    : {field:{from,to}}            (auditAs עם changes; Customer/Shift/CANCEL_ORDER)
 *   values  : {field:newValue}             (UPDATE אוטומטי = args.data, בלי "לפני")  <- דורש replay
 *   snapshot: כל שורת ה-DB                 (CREATE אוטומטי / שורות nested-create ב-POST /api/orders)
 *   deleted : {deleted:true}
 *   legacy  : {from:{...},to:{...}}        (משמרות ישנות)
 *   note    : {note, orderId, ...}         (שורות שנכתבות ידנית בביטולים)
 *   empty   : {}
 * @returns {{shape:string, fields:Object<string,{from:any,to:any,hasFrom:boolean}>, extras:Object}}
 */
export function parseChanges(row) {
  let raw;
  try { raw = typeof row.changesJson === 'string' ? JSON.parse(row.changesJson) : row.changesJson; }
  catch { return { shape: 'unparsable', fields: {}, extras: {}, rawText: String(row.changesJson) }; }
  if (!raw || typeof raw !== 'object') return { shape: 'empty', fields: {}, extras: {} };
  const keys = Object.keys(raw);
  if (!keys.length) return { shape: 'empty', fields: {}, extras: {} };
  if (keys.length === 1 && raw.deleted === true) return { shape: 'deleted', fields: {}, extras: {} };

  // legacy snapshot: מפתחות רק from/to ואחד מהם אובייקט
  if (keys.every((k) => k === 'from' || k === 'to') && (typeof raw.to === 'object' || typeof raw.from === 'object')) {
    const f = raw.from || {}, t = raw.to || {};
    const fields = {};
    new Set([...Object.keys(f), ...Object.keys(t)]).forEach((k) => {
      fields[k] = { from: f[k], to: t[k], hasFrom: raw.from != null };
    });
    return { shape: 'legacy', fields, extras: {} };
  }

  const fields = {}, extras = {};
  let ftCount = 0;
  for (const k of keys) {
    if (isFT(raw[k])) { fields[k] = { from: raw[k].from, to: raw[k].to, hasFrom: true }; ftCount++; }
    else if (k === 'note' || k === 'orderId' || k === 'paymentId' || k === 'type') { extras[k] = raw[k]; if (k === 'type' || k === 'note') fields[k] = { from: undefined, to: raw[k], hasFrom: false }; }
    else fields[k] = { from: undefined, to: raw[k], hasFrom: false };
  }
  const shape = ftCount ? 'diff' : (row.action === 'CREATE' ? 'snapshot' : (row.entityType === 'Order' && row.action === 'EMAIL_SENT' ? 'email' : 'values'));
  return { shape, fields, extras };
}

/* ---------- 2. replay: משלים "לפני" לשורות שנשמרו בלי from (shape=values) ---------- */

/**
 * עובר על שורות אותה ישות בסדר כרונולוגי, מחזיק "מצב אחרון ידוע" לכל שדה (מתחיל מצילום ה-CREATE),
 * ומשלים from. שדה ש-to שלו זהה למצב הידוע נזרק (זה הרעש: PUT /api/orders/[id] שולח כמעט את כל
 * השדות בכל שמירה). כשאין מצב ידוע (רשומה מיובאת/ישנה) - hasFrom נשאר false והשדה מוצג כ"נקבע: X".
 * @param {Array} parsed  [{row, p}] כל השורות, כל הישויות
 * @returns {Map<rowId, parsedWithFrom>} ומפת state לפי `${entityType}:${entityId}` (לשימוש ניסוח: מחיר/תיאור של פריט שהוסר)
 */
export function replay(parsed) {
  const state = new Map();
  const out = new Map();
  const asc = [...parsed].sort((a, b) => new Date(a.row.createdAt) - new Date(b.row.createdAt));
  for (const { row, p } of asc) {
    const key = `${row.entityType}:${row.entityId}`;
    const st = state.get(key) || {};
    const fields = {};
    const inferredSame = []; // שדות שה"לפני" שלהם הוסק (לא נרשם) ושווה ל"אחרי" -- לא מוכח כאי-שינוי (B3)
    let recordedSame = 0;    // שדות שהשורה עצמה מוכיחה שאינם שונים (from===to מתועד) -- בטוח להשמיט
    const isUpdate = row.action === 'UPDATE';
    for (const [f, c] of Object.entries(p.fields)) {
      let { from, to, hasFrom } = c;
      let inferred = false;
      if (isUpdate) {
        // השלמת "לפני" והסקת רעש -- רק בעדכוני מצב של ישות (B2: אף פעם לא באירועים/CREATE)
        if (!hasFrom && f in st) { from = st[f]; hasFrom = true; inferred = true; }
        if (hasFrom && same(from, to)) {
          if (inferred) inferredSame.push(f); else recordedSame += 1;
          st[f] = to; continue;
        }
      } else if (hasFrom && row.action !== 'CREATE' && same(from, to) && p.shape === 'diff') {
        recordedSame += 1; continue;
      }
      if (!hasFrom && row.action === 'CREATE' && p.shape === 'snapshot' && (to === false || to === 0 || empty(to))) { st[f] = to; continue; } // ברירות מחדל ריקות ביצירה
      fields[f] = { from, to, hasFrom, inferred };
      if (isUpdate || row.action === 'CREATE' || hasFrom) st[f] = to; // אירועים בלי from לא משנים מצב
    }
    state.set(key, st);
    out.set(row.id, { ...p, fields, inferredSame, recordedSame });
  }
  return { byRow: out, state };
}

/** השוואה עמוקה (אובייקטים/מערכים) -- לא "[object Object]". */
function same(a, b) {
  const x = a ?? '', y = b ?? '';
  if (typeof x === 'object' || typeof y === 'object') { try { return JSON.stringify(x) === JSON.stringify(y); } catch { return false; } }
  return String(x) === String(y);
}

/* ------------------------------- 3. עיצוב ערכים ------------------------------- */

const TZ = 'Asia/Jerusalem';
export const money = (n) => '₪' + Math.abs(Math.round(Number(n) * 100) / 100).toLocaleString('he-IL');
const dmy = (d) => d.toLocaleDateString('he-IL', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' });
const hm = (d) => d.toLocaleTimeString('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** ערך -> מחרוזת תצוגה לפי fmt של השדה (מחליף formatValue של ChangesChips/HistoryViewer). */
export function fmtValue(field, v) {
  if (empty(v)) return '—';
  const def = FIELDS[field]; const fmt = def ? def[3] : 'text';
  if (fmt === 'secret') return '••••';
  if (fmt === 'bool') return (v === true || v === 1 || v === '1' || v === 'true') ? 'כן' : 'לא';
  if (fmt === 'money') return money(v);
  if (fmt === 'date' || fmt === 'datetime') {
    const d = new Date(v); if (isNaN(d)) return String(v);
    return fmt === 'date' ? dmy(d) : `${dmy(d)} ${hm(d)}`;
  }
  if (fmt && fmt.startsWith('enum:')) return (ENUMS[fmt.slice(5)] || {})[v] || String(v);
  if (fmt === 'files') return Array.isArray(v) ? v.map((x) => x.fileName).filter(Boolean).join(', ') || '—' : String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** מפתח יום לפי שעון ישראל (לא UTC!) - קבוצת .hday. ר' getIsraelDayRange ב-lib/hebrewDate.js. */
export const dayKey = (createdAt) => new Date(createdAt).toLocaleDateString('sv-SE', { timeZone: TZ }); // yyyy-mm-dd
/** ts בפורמט הסקיצה 'YYYY-MM-DDTHH:MM' בשעון ישראל (הסקיצה משווה מחרוזות). */
export const tsIso = (createdAt) => dayKey(createdAt) + 'T' + hm(new Date(createdAt));

/* --------------------------- 4. ניסוח + סיווג לרשומה --------------------------- */

/**
 * @param {object} row  שורת AuditLog + employeeName
 * @param {object} p    תוצאת parseChanges אחרי replay
 * @param {object} ctx  {itemsById, paymentsById, settingsById, orderId, hideEmployeeSecrets}
 *                      itemsById[id] = {model:'דגם 4512', size:'38', price}. נטען מנתוני הכרטיס שכבר קיימים;
 *                      נדרש כי שורות OrderItem לא נושאות שם דגם. חוסר -> "פריט" בלי פירוט.
 * @returns feed entry או null אם אין מה להציג (הרשומה נדחית, ר' parity)
 */
export function toFeedEntry(row, p, ctx = {}, stateLookup = () => ({})) {
  if (!ENTITIES[row.entityType]) noteMissing('entity', row.entityType);
  if (!ACTIONS[row.action]) noteMissing('action', row.action);
  const ent = ENTITIES[row.entityType] || { label: row.entityType, cat: 'sys', icon: 'info' };
  const act = ACTIONS[row.action] || null;
  const F = p.fields;
  const visible = Object.keys(F).filter((k) => !(FIELDS[k] && FIELDS[k][4]));
  // שדות "טכניים" (מוסתרים בשורה, לא בפירוט): שינוי אמיתי שלהם לעולם לא נזרק (B1). רק מזהים/חותמות זמן מושמטים.
  const tech = Object.keys(F).filter((k) => FIELDS[k] && FIELDS[k][4] && !TECH_SKIP.has(k));
  const st = stateLookup(row) || {};
  const item = row.entityType === 'OrderItem'
    ? ((ctx.itemsById || {})[row.entityId] || {})
    : {};
  const itemName = (item.model || st.description || 'פריט') + (item.size || st.sizeText ? ` · מידה ${item.size || st.sizeText}` : '');

  let cat = act?.cat || ent.cat, icon = act?.icon || ent.icon, text = '', sub = '', amt = null, kind = null;

  // --- כללים לפי (ישות, פעולה) ---
  const A = row.action, E = row.entityType;
  if (E === 'OrderItem' && A === 'CREATE') {
    text = `נוסף פריט: ${itemName}`; amt = num(F.finalPrice?.to ?? F.price?.to ?? st.finalPrice ?? st.price); kind = 'chg'; cat = 'items'; icon = 'dress';
  } else if (A === 'CANCEL_ITEM') {
    text = `הוסר פריט: ${itemName}`; cat = 'items'; icon = 'dress';
  } else if (A === 'RESTORE_ITEM') {
    text = `שוחזר פריט: ${itemName}`;
  } else if (E === 'OrderItem' && A === 'UPDATE' && (F.sizeText || F.size)) {
    text = `שונתה מידה: ${itemName}`; sub = `${fmtValue('sizeText', (F.sizeText || F.size).from)} ← ${fmtValue('sizeText', (F.sizeText || F.size).to)}`;
  } else if (E === 'OrderItem' && A === 'UPDATE' && (F.neckAlteration || F.sleeveAlteration || F.lengthAlteration || F.alterationDetails)) {
    text = 'עודכנה בקשת תיקון'; sub = itemName; cat = 'items'; icon = 'scissors';
  } else if (A === 'ALTERATION_DONE') {
    text = 'התיקון סומן כהושלם'; sub = itemName;
  } else if (A === 'CONFIRM_RENTAL') {
    text = `הפריט נלקח: ${itemName}`;
  } else if (A === 'CANCEL_SCAN' || A === 'CANCEL_RENTAL') {
    text = `בוטלה סריקה: ${itemName}`;
  } else if (A === 'CANCEL_RETURN') {
    text = `בוטלה החזרה: ${itemName}`;
  } else if (E === 'OrderItem' && A === 'UPDATE' && F.isReturned) {
    text = F.isReturned.to ? `הפריט הוחזר: ${itemName}` : `בוטלה החזרה: ${itemName}`; cat = 'rental'; icon = 'undo';
  } else if (E === 'Payment' && (A === 'CREATE' || A === 'ADD_PAYMENT')) {
    const m = F.paymentMethod?.to; const n = num(F.amount?.to);
    const neg = n < 0 || F.isRefund?.to === true;
    text = neg ? `זיכוי ${money(n)}` : `התקבל תשלום${m ? ' ב' + m : ''}`; amt = neg ? -Math.abs(n) : n; kind = neg ? 'crd' : 'pay';
    if (F.notes?.to) sub = String(F.notes.to);
  } else if (E === 'Order' && A === 'ADD_PAYMENT') {
    const n = num(F.amount?.to); text = `נרשם זיכוי ${money(n)}`; amt = -Math.abs(n); kind = 'crd';
  } else if (A === 'REMOVE_PAYMENT') {
    text = 'זיכוי הוסר מהתשלומים'; sub = F.note?.to || '';
  } else if (A === 'CANCEL_PAYMENT' || A === 'RESTORE_PAYMENT' || (E === 'Payment' && F.isDeleted)) {
    const restored = A === 'RESTORE_PAYMENT' || (F.isDeleted && F.isDeleted.to === false);
    const n = num(st.amount); text = restored ? 'תשלום שוחזר' : 'תשלום בוטל'; if (n) { amt = restored ? n : -n; kind = restored ? 'pay' : 'crd'; }
  } else if (E === 'PaymentObligation') {
    const n = num(F.amount?.to ?? st.amount); const d = F.description?.to || st.description || '';
    if (A === 'CANCEL_OBLIGATION' || F.isDeleted?.to === true || A === 'DELETE') { text = `בוטל חיוב${d ? ': ' + d : ''}`; amt = n ? -n : null; kind = 'crd'; }
    else if (A === 'RESTORE_OBLIGATION') { text = `שוחזר חיוב${d ? ': ' + d : ''}`; amt = n; kind = 'chg'; }
    else if (A === 'CREATE') { text = `נוסף חיוב${d ? ': ' + d : ''}`; amt = n; kind = 'chg'; }
    else { text = `עודכן חיוב${d ? ': ' + d : ''}`; amt = null; }
    cat = /משלוח/.test(d) ? 'del' : 'pay'; icon = cat === 'del' ? 'truck' : 'cart';
  } else if (E === 'Refund') {
    const n = num(F.amount?.to ?? st.amount);
    if (A === 'EXECUTE' || F.isExecuted?.to === true) text = `הזיכוי בוצע${n ? ' ' + money(n) : ''}`;
    else if (A === 'AUTO_CREDIT_REFUND_CLEARED') text = 'זיכוי אוטומטי בוטל';
    else if (A === 'UPDATE') text = `עודכן זיכוי${n ? ' ' + money(n) : ''}`;
    else text = `נוצר זיכוי ${n ? money(n) : ''}`.trim();
    if (n && A !== 'EXECUTE' && A !== 'UPDATE') { amt = -Math.abs(n); kind = 'crd'; }
    if (F.reason?.to) sub = F.reason.to;
  } else if (A === 'DEBT_APPROVED') {
    const n = num(F.approvedDebtAmount?.to); text = 'אושרה יתרת חוב'; amt = n || null; kind = 'chg';
  } else if (A === 'CANCEL_DEBT_APPROVAL') {
    text = 'אישור החוב בוטל';
  } else if (A === 'CANCEL_ORDER') {
    text = E === 'Order' ? 'ההזמנה בוטלה' : (E === 'OrderItem' ? `הפריט בוטל עם ההזמנה: ${itemName}` : 'חיוב בוטל עם ההזמנה');
    sub = E === 'Order' ? (p.extras.note || '') : '';
  } else if (A === 'CANCEL_CHANGES') {
    text = 'בוטלו שינויים שלא נשמרו'; sub = F.discarded?.to || '';
  } else if (A === 'EMAIL_SENT') {
    text = 'נשלח מייל' + (E === 'Order' ? ' ללקוחה' : ''); sub = F.to?.to || '';
  } else if (E === 'Order' && A === 'CREATE') {
    text = 'ההזמנה נוצרה'; sub = F.branch?.to || ''; cat = 'items'; icon = 'file';
  } else if (E === 'Order' && A === 'UPDATE') {
    // ניסוח לפי קבוצת הקטגוריות של השדות ששינו בפועל
    const groups = new Set(visible.map((k) => FIELDS[k]?.[1]).filter(Boolean));
    if (F.eventDate && groups.size === 1) { text = F.eventDate.hasFrom && !empty(F.eventDate.from) ? 'תאריך האירוע שונה' : 'נקבע תאריך האירוע'; sub = fmtValue('eventDate', F.eventDate.to); cat = 'dates'; icon = 'cal'; }
    else if (groups.size === 1 && groups.has('del')) { text = F.isDelivery?.to === false ? 'המשלוח הוסר' : (F.isDelivery?.to === true ? 'נוסף משלוח' : 'פרטי המשלוח עודכנו'); cat = 'del'; icon = 'truck'; }
    else if (groups.size === 1 && groups.has('docs')) { text = F.hasSignedRegulations ? 'נחתם התקנון' : 'הערה עודכנה'; cat = 'docs'; icon = F.hasSignedRegulations ? 'sig' : 'file'; }
    else if (groups.size === 1 && groups.has('dates')) { text = 'תאריכי ההשכרה עודכנו'; cat = 'dates'; icon = 'cal'; }
    else if (groups.size === 1 && groups.has('pay')) { text = 'פרטי התשלום עודכנו'; cat = 'pay'; icon = 'card'; }
    else { text = visible.length === 1 ? `${FIELDS[visible[0]]?.[0] || visible[0]} עודכן` : 'פרטי ההזמנה עודכנו'; cat = 'info'; icon = 'pencil'; }
    const tot = F.totalAmount; if (tot && tot.hasFrom) { amt = num(tot.to) - num(tot.from); kind = amt >= 0 ? 'chg' : 'crd'; }
  } else if (E === 'OrderItem' && A === 'UPDATE') {
    const labels = visible.map((k) => FIELDS[k]?.[0] || k);
    text = `עודכן פריט: ${itemName}`; sub = labels.slice(0, 3).join(', ');
    const pr = F.finalPrice || F.price;
    if (pr && pr.hasFrom && num(pr.to) !== num(pr.from)) { amt = num(pr.to) - num(pr.from); kind = amt >= 0 ? 'chg' : 'crd'; }
  } else if (E === 'Customer' || E === 'Employee' || E === 'DressModel' || E === 'DressItem' || E === 'Shift' || E === 'SystemSetting') {
    text = genericSentence(E, A, visible, F, ctx, row);
  } else {
    text = genericSentence(E, A, visible, F, ctx, row);
  }

  // UPDATE בלי שדות מוצגים: (1) אם ההשמטה מוכחת מהשורה עצמה (from===to מתועד / ריק) -- נדחית;
  // (2) אם רק הוסקה מהמצב הידוע (משוער, B3) -- נשארת כרשומת "ללא שינוי מזוהה"; (3) שדות טכניים בלבד -- מוצגת (B1).
  let noise = false, estimated = false;
  if (A === 'UPDATE' && visible.length === 0 && p.shape !== 'unparsable') {
    if (tech.length) {
      sub = 'נתונים טכניים: ' + tech.slice(0, 3).map((k) => FIELDS[k]?.[0] || k).join(', ');
    } else if ((p.inferredSame || []).length) {
      noise = true; estimated = true; text = 'נשמר בלי שינוי מזוהה (משוער)'; cat = ent.cat; icon = 'info'; amt = null; kind = null;
      sub = 'ערכים זהים לרשומה הקודמת: ' + p.inferredSame.slice(0, 3).map((k) => FIELDS[k]?.[0] || k).join(', ');
    } else if (ctx.showNoise) {
      noise = true; text = 'נשמר בלי שינוי מהותי'; sub = ''; cat = 'sys'; icon = 'info'; amt = null; kind = null;
    } else return null;
  }

  const who = row.employeeId ? (row.employeeName || 'עובד שנמחק') : 'מערכת';
  const det = buildDetails(row, p, visible);
  return {
    id: row.id, ts: tsIso(row.createdAt), rawTs: row.createdAt, cat, icon,
    badge: act?.badge || ent.label, tone: act?.tone || 'neutral', entLabel: ent.label,
    text, sub, who, amt: amt || undefined, kind: kind || undefined, det, tech: buildTech(p, tech), noise, estimated,
    entityType: E, entityId: row.entityId, action: A,
    redo: redoState(row, p, ctx),
    raw: row.changesJson, // לחיפוש (hay) ולכפתור "פירוט גולמי" למנהלים
  };
}

const num = (v) => (empty(v) || isNaN(Number(v)) ? 0 : Number(v));

function genericSentence(E, A, visible, F, ctx, row) {
  const ent = ENTITIES[E]?.label || E; const act = ACTIONS[A];
  if (A === 'CREATE') return `${ent} נוצר/ה`;
  if (A === 'DELETE') return `${ent} נמחק/ה`;
  if (E === 'Shift') return A === 'CREATE' ? 'נוספה משמרת' : (F.isDeleted?.to === true ? 'משמרת נמחקה' : 'משמרת עודכנה');
  if (E === 'SystemSetting') { const nm = (ctx.settingsById || {})[row.entityId]; return `הגדרה עודכנה${nm ? ': ' + nm : ''}`; }
  if (visible.length === 1) return `${FIELDS[visible[0]]?.[0] || visible[0]} ${E === 'Customer' ? 'עודכנה' : 'עודכן'}`;
  if (visible.length > 1 && visible.length <= 3) return 'עודכנו: ' + visible.map((k) => FIELDS[k]?.[0] || k).join(', ');
  return act?.verb || `${ent} עודכן/ה`;
}

function buildTech(p, tech) {
  return tech.map((k) => {
    const c = p.fields[k];
    return [(FIELDS[k]?.[0] || k) + (c.inferred ? ' (משוער)' : ''), c.hasFrom ? `${fmtValue(k, c.from)} ← ${fmtValue(k, c.to)}` : fmtValue(k, c.to)];
  });
}

/** פירוט מורחב: [[label, value]]; זוג "לפני"/"אחרי" יחיד כשיש שדה אחד עם from/to (כמו הסקיצה). */
function buildDetails(row, p, visible) {
  const det = [];
  const rows = visible.map((k) => {
    const c = p.fields[k]; if (!FIELDS[k]) noteMissing('field', k);
    const lbl = FIELDS[k]?.[0] || k; // שדה לא מוכר: מפתח גולמי (fallback, נרשם ב-missingLabels)
    const long = FIELDS[k]?.[3] === 'long';
    return { k, lbl: c.inferred ? `${lbl} (משוער)` : lbl, long, c };
  });
  if (rows.length === 1 && rows[0].c.hasFrom && !rows[0].c.inferred) {
    // הסקיצה מציגה "שינוי: לפני ← אחרי" כשיש זוג לפני/אחרי
    det.push(['לפני', fmtValue(rows[0].k, rows[0].c.from)], ['אחרי', fmtValue(rows[0].k, rows[0].c.to)]);
    return det;
  }
  for (const r of rows) {
    det.push([r.lbl, r.c.hasFrom ? `${fmtValue(r.k, r.c.from)} ← ${fmtValue(r.k, r.c.to)}` : fmtValue(r.k, r.c.to)]);
  }
  return det;
}

/**
 * זכאות ל"בטל/חזור" בפיד. היסטוריה היא קריאה-בלבד ואין ב-AuditLog מידע לשחזור,
 * לכן ברירת המחדל eligible=false. ה-redo שבסקיצה (.redo, מחסנית REDO) שייך לעגלת השינויים שלפני שמירה
 * ואיננו רשומה בפיד. החריגים היחידים: חלונות "ביטול מיידי" קיימים בצד השרת/הלקוח (ר' HISTORY-DESIGN §3.7),
 * ותלויים ב-ctx.liveUndo שמגיע ממצב הכרטיס, לא מהיומן.
 */
export function redoState(row, p, ctx = {}) {
  const u = ctx.liveUndo && ctx.liveUndo[`${row.entityType}:${row.entityId}`];
  if (u && u.untilTs && Date.now() < u.untilTs && ['EXECUTE', 'CREATE', 'AUTO_CREDIT_REFUND_CREATED'].includes(row.action)) {
    return { eligible: true, kind: u.kind, untilTs: u.untilTs };
  }
  return { eligible: false };
}

/* ------------------------------ 5. הצינור המלא ------------------------------ */

/**
 * @param {Array} rows   שורות AuditLog מאוחדות מכל הישויות (ר' loadOrderHistoryRows)
 * @param {object} ctx
 * @returns {{entries:Array, days:Array<{day:string,entries:Array}>, catCounts:Object}}
 */
export function buildFeed(rows, ctx = {}) {
  const parsed = rows.map((row) => ({ row, p: parseChanges(row) }));
  const { byRow, state } = replay(parsed);
  const lookup = (row) => state.get(`${row.entityType}:${row.entityId}`);
  const entries = [];
  // ביטול הזמנה כותב Order + N פריטים + M חיובים באותה שנייה (סיכון 12) -- מקבצים לרשומה אחת
  const cancelParents = rows.filter((r) => r.entityType === 'Order' && r.action === 'CANCEL_ORDER');
  const folded = new Map(); // rowId -> parent row id
  if (cancelParents.length) {
    for (const r of rows) {
      if (r.action !== 'CANCEL_ORDER' || r.entityType === 'Order') continue;
      const t = new Date(r.createdAt).getTime();
      // קיבוץ לפי הזמנה: ילד מקופל רק כשהוא מזוהה עם אותה הזמנה (orderId ב-changesJson), או כשהפיד כולו של הזמנה אחת
      const cOrder = byRow.get(r.id)?.extras?.orderId;
      const par = cancelParents.find((c) => {
        if (Math.abs(new Date(c.createdAt).getTime() - t) > 5000) return false;
        if (ctx.singleOrder) return true;
        const pOrder = byRow.get(c.id)?.extras?.orderId ?? (/^\d+$/.test(String(c.entityId)) ? c.entityId : null);
        return cOrder != null && pOrder != null && String(cOrder) === String(pOrder);
      });
      if (par) folded.set(r.id, par.id);
    }
  }
  const childCount = {};
  for (const [rid, pid] of folded) {
    const r = rows.find((x) => x.id === rid);
    const c = (childCount[pid] = childCount[pid] || { items: [], charges: 0, sum: 0 });
    if (r.entityType === 'OrderItem') {
      const it = (ctx.itemsById || {})[r.entityId] || {};
      c.items.push((it.model || 'פריט') + (it.size ? ` · מידה ${it.size}` : ''));
    } else { c.charges += 1; c.sum += num(lookup(r)?.amount); }
  }
  for (const row of rows) {
    if (folded.has(row.id)) continue;
    const p = byRow.get(row.id);
    const e = toFeedEntry(row, p, ctx, lookup);
    if (!e) continue;
    const ch = childCount[row.id];
    if (ch) {
      if (ch.items.length) { e.sub = e.sub ? `${e.sub} · ` : ''; e.sub += ch.items.length === 1 ? 'פריט אחד' : `${ch.items.length} פריטים`; e.det = [...(e.det || []), ['פריטים שבוטלו', ch.items.join(', ')]]; }
      if (ch.charges) e.det = [...(e.det || []), ['חיובים שבוטלו', ch.sum ? `${ch.charges} (${money(ch.sum)})` : String(ch.charges)]];
    }
    entries.push(e);
  }
  // מיון: חדש->ישן; שוויון לפי id יורד (כמו hfVisible בסקיצה)
  entries.sort((a, b) => (a.rawTs < b.rawTs ? 1 : a.rawTs > b.rawTs ? -1 : (b.id > a.id ? 1 : -1)));
  const days = []; const catCounts = {};
  for (const e of entries) {
    const d = dayKey(e.rawTs);
    if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, entries: [] });
    days[days.length - 1].entries.push(e);
    catCounts[e.cat] = (catCounts[e.cat] || 0) + 1;
  }
  return { entries, days, catCounts };
}

/** hay לחיפוש: כמו hfHay בסקיצה + הערכים הגולמיים (שימור ההתנהגות של חיפוש-בתוך-changesJson הישן). */
/** תאריך גרגוריאני d.m.yyyy מתוך ts (לחיפוש כמו greg בסקיצה). */
export const gregOf = (day) => { const [y, m, d] = day.split('-').map(Number); return `${d}.${m}.${y}`; };
export const searchHay = (e) => [e.text, e.sub, e.who, e.badge, e.entLabel, e.ts.slice(11), gregOf(e.ts.slice(0, 10)), ...(e.det || []).flat(), e.raw || ''].join(' ').toLowerCase();

/** itemsById מנתוני כרטיס ההזמנה (GET /api/orders/[id]): {model: תיאור סופי, size}. */
export function itemsIndexFromOrder(order) {
  const out = {};
  for (const it of (order?.items || [])) {
    if (it?.id) out[it.id] = { model: it.description || 'פריט', size: it.sizeText || it.size || '', price: it.finalPrice ?? it.price };
  }
  return out;
}

const defaultFetch = (u) => fetch(u).then((r) => (r.ok ? r.json() : { logs: [], status: r.status })).catch(() => ({ logs: [] }));

/**
 * טעינת שורות לכרטיס הזמנה בלי שינוי שרת: 5 קריאות מקבילות ל-/api/audit הקיים (limit=500).
 * המזהים מגיעים ממה שהכרטיס כבר טוען (order.items / payments / obligations / refunds, כולל מחוקים).
 */
export async function loadOrderHistoryRows(order, fetchJson = defaultFetch) {
  const q = (type, ids) => ids.length
    ? fetchJson(`/api/audit?entityType=${type}&entityIds=${ids.join(',')}&limit=500`)
    : Promise.resolve({ logs: [] });
  const ids = (a) => (a || []).map((x) => x.id).filter(Boolean);
  const [o, it, pay, ob, rf] = await Promise.all([
    fetchJson(`/api/audit?entityType=Order&entityId=${order.orderId ?? order.id}&limit=500`), // כבר מטפל ב-uuid + orderId
    q('OrderItem', ids(order.items)), q('Payment', ids(order.payments)),
    q('PaymentObligation', ids(order.obligations)), q('Refund', ids(order.refunds)),
  ]);
  return mergeRows([o, it, pay, ob, rf]);
}

/** דגם: DressModel לפי id + DressItem לפי entityIds (כמו ModernDressInfoTab). */
export async function loadDressHistoryRows(modelId, itemIds = [], fetchJson = defaultFetch) {
  const [m, it] = await Promise.all([
    fetchJson(`/api/audit?entityType=DressModel&entityId=${modelId}&limit=100`),
    itemIds.length ? fetchJson(`/api/audit?entityType=DressItem&entityIds=${itemIds.join(',')}&limit=200`) : Promise.resolve({ logs: [] }),
  ]);
  return mergeRows([m, it]);
}

/** איחוד תשובות /api/audit לפי id (בלי כפילויות). */
export function mergeRows(results) {
  const seen = new Set();
  const merged = results.flatMap((r) => r.logs || []).filter((l) => !seen.has(l.id) && seen.add(l.id));
  // חיתוך שקט (limit) -> totalAll גדול מהנטען; המסך המארח מציג "יש עוד" (הערת אימות: חיתוך ב-500)
  merged.totalAll = results.reduce((n, r) => n + (Number.isFinite(r.total) ? r.total : (r.logs || []).length), 0);
  return merged;
}
