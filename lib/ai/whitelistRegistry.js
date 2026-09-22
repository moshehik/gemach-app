// lib/ai/whitelistRegistry.js — the INVERSE of lib/ai/restrictionsRegistry.js: instead of a
// denylist ("don't reveal X"), a per-feature ALLOWLIST of exactly which tables/columns/topics are
// safe to expose, plus a reusable prompt template for a future "reverse AI" mode that can answer
// ONLY from the allowlist and must refuse anything else outright.
//
// STATUS: this is a preparation/design catalog, saved via the same SystemSetting mechanism as
// lib/ai/restrictionsConfig.js (`whitelistMode`/`whitelist` fields, editable on
// /admin/ai-restrictions). It is NOT wired into the 7 existing routes' runtime behavior tonight —
// none of them currently branch on `whitelistMode`. Wiring a real "reverse AI" mode (a route that
// actually enforces allowlist-only answers, e.g. by filtering SQL columns/tables to the allowlist
// before execution, not just prompting the model to self-restrict) is future work; this file is
// the groundwork so that decision doesn't start from a blank page.
//
// Grounded in the real schema (prisma/schema.prisma), the real route code of all 7 features, and
// lib/ai/aiCommon.js (getFullSchemaContext / SCHEMA_MAP-equivalent per feature) — written / revised
// 2026-09-22. Every table/column name below was verified to exist in prisma/schema.prisma; nothing
// here is invented.
//
// ---------------------------------------------------------------------------------------------
// HOW TO ACTUALLY WIRE A WHITELIST-ONLY MODE INTO A ROUTE (documentation only — none of this is
// implemented yet):
//
// 1. The route must call getFeatureRestrictionConfig(featureKey) (lib/ai/restrictionsConfig.js)
//    and branch on `config.whitelistMode` — today every route ignores that field entirely; it is
//    only ever read/written by the admin page's own load/save round-trip.
// 2. When whitelistMode is true, call buildWhitelistOnlySystemPrompt(featureKey, config.whitelist)
//    INSTEAD OF the feature's normal restriction prompt (buildRestrictionPromptBlock(...), the
//    financial_data block, etc.) — not layered on top of it. The allowlist prompt is a complete
//    replacement contract ("answer ONLY from this list"), so mixing it with the existing denylist
//    instructions would just be confusing, contradictory prompt text.
// 3. CRITICAL, same lesson as financial_columns_orders in restrictionsRegistry.js (which needed a
//    real column-selection fix in smart-search/route.js's buildQuery(), not just prompt text,
//    because the model choosing not to *mention* a column doesn't stop the SQL executor from
//    *returning* it): the natural-language instruction alone is not a security boundary. Any route
//    whose Gemini call can still cause a raw SQL SELECT/aggregate to execute — main_chat and
//    statistics (both get the ENTIRE schema.prisma via getFullSchemaContext(), see below) and
//    smart_search (gets a fixed per-page SCHEMA_MAP and runs SELECT * regardless of what the model
//    wrote into the WHERE clause) — would ALSO need the SQL-generation step itself restricted to
//    the whitelisted tables/columns: build a reduced schema-context string from only the selected
//    candidateFields' table/columns (instead of the full schema, or smart-search's fixed
//    SCHEMA_MAP) before it ever reaches Gemini, AND validate the SQL Gemini actually returns
//    against that same reduced column set server-side before execution (stripSecretColumns-style
//    allow-listing, not just prompt guidance) — otherwise a mistaken or prompt-injected query could
//    still SELECT a non-whitelisted column, and the only thing standing between that data and the
//    user's screen would be the model's own compliance.
// 4. `recording` is a special case even inside whitelist mode: the action-macro text can be
//    filtered to an allowlist the normal way (it's just structured text), but the screen VIDEO
//    itself is not filterable at all short of not sending it to Gemini in the first place — see
//    the `video_raw_unfiltered` entry below, which documents this rather than pretending a video
//    stream can be column-restricted.
// 5. `admin_sql_generator` must never actually be offered whitelistMode in a future admin UI — see
//    its candidateFields entry and the dedicated early-return in buildWhitelistOnlySystemPrompt
//    below. It is structurally a write feature (UPDATE/DELETE/INSERT for head management); "only
//    answer from a safe-to-expose list" is a read/lookup concept that doesn't map onto it.
// ---------------------------------------------------------------------------------------------

export const AI_WHITELISTS = {
  // main_chat (app/api/ai/route.js) — free-form Q&A backed by Gemini-generated SQL against the
  // FULL schema.prisma (getFullSchemaContext(), lib/ai/aiCommon.js). Genuinely touches nearly the
  // whole database, so this catalog is intentionally broad rather than a token gesture.
  main_chat: {
    candidateFields: [
      { id: 'customer_basic', table: 'Customer', columns: ['firstName', 'lastName', 'phone1', 'phone2', 'city', 'street', 'houseNum'], label: 'פרטי קשר וכתובת בסיסיים של לקוח', riskNote: 'בטוח לכל עובד מחובר — לא כולל email/notes/officeNotes/zeout/פרטי בנק (ר\' customer_sensitive).' },
      { id: 'customer_status_flags', table: 'Customer', columns: ['isBlocked', 'blockedReason', 'marketingConsent'], label: 'דגלי סטטוס לקוח (חסימה, הסכמת דיוור)', riskNote: 'בטוח ואף שימושי תפעולית — למשל לבדוק "האם הלקוח חסום מהזמנות" לפני פתיחת הזמנה חדשה.' },
      { id: 'customer_sensitive', table: 'Customer', columns: ['email', 'notes', 'officeNotes', 'zeout', 'bankName', 'bankBranch', 'bankAccount', 'bankAccountName', 'hokBankName', 'hokBankBranch', 'hokBankAccount', 'hokConsent'], label: 'פרטי לקוח רגישים (ת"ז, פרטי בנק/הוראת קבע, הערות פנימיות)', riskNote: 'לעולם לא ברשימה לבנה — zeout (ת"ז) ועמודות הבנק הן סיכון גניבת זהות/הונאה; notes/officeNotes עלולים להכיל מידע כספי או אישי רגיש שעובד רשם על הלקוח. קיים כאן רק כדי לתעד במפורש למה הוא מוחרג.' },
      { id: 'order_operational', table: 'Order', columns: ['orderId', 'status', 'eventDate', 'eventDateHebrew', 'returnDate', 'orderDate', 'notes', 'isDelivery', 'deliveryCity', 'deliveryDirection', 'isAbroad', 'isWeekdayEvent', 'fromDate', 'toDate', 'isPhoneOrder', 'branch', 'pickupBranch', 'hasSignedRegulations', 'isDeleted'], label: 'נתוני הזמנה תפעוליים (בלי כסף)', riskNote: 'ללא totalAmount/paymentDate/paymentMethod/isPaid (ר\' order_financial) וללא internalNotes (ר\' order_internal_notes).' },
      { id: 'order_financial', table: 'Order', columns: ['totalAmount', 'paymentDate', 'paymentMethod', 'isPaid'], label: 'נתוני הזמנה פיננסיים', riskNote: 'רגיש — זהה במהות למגבלת financial_data (restrictionsRegistry.js); לא להוסיף לרשימה לבנה של עובד לא-מנהל.' },
      { id: 'order_internal_notes', table: 'Order', columns: ['internalNotes'], label: 'הערות פנימיות להזמנה (לצוות בלבד)', riskNote: 'לעולם לא מוצג ללקוח בהדפסה/מייל, אבל עלול לכלול פרטים כספיים/אישיים רגישים שעובד רשם — מומלץ מנהל בלבד גם במצב רשימה לבנה, לא ברירת מחדל.' },
      { id: 'dress_model_catalog', table: 'DressModel', columns: ['name', 'barcodePrefix', 'isSplit', 'isPremium', 'inInspection', 'inactiveReason', 'isDeleted'], label: 'קטלוג דגמי שמלה (בלי מחיר)', riskNote: 'בטוח — ללא priceCategory (ר\' dress_pricing).' },
      { id: 'dress_item_inventory', table: 'DressItem', columns: ['barcodePrefix', 'sizeText', 'serialNumber', 'dressBarcode', 'location', 'locationNum', 'cartonNumber', 'quantity', 'inRepair', 'notInUse', 'notInUseReason'], label: 'מלאי פיזי של יחידות שמלה (בלי מחיר)', riskNote: 'בטוח ברובו; location/locationNum יכולים לרמז על אזור "מחסן"/"רזרבה" סגור — סיכון נמוך, לא חוסם.' },
      { id: 'dress_pricing', table: 'DressModel/PriceList/PriceRule', columns: ['priceCategory', 'price', 'fromSize', 'toSize', 'category', 'minSize', 'maxSize', 'deposit', 'refund'], label: 'מחירון ומחירי שמלות', riskNote: 'פיננסי — לחסום לעובד לא-מנהל כמו order_financial, גם אם זה "רק" מחירון ולא סכום הזמנה ספציפי.' },
      { id: 'rental_lifecycle', table: 'OrderItem', columns: ['barcode', 'barcodePrefix', 'size', 'sizeText', 'isTaken', 'isReturned', 'returnedOk', 'takenDate', 'returnDate', 'neckAlteration', 'lengthAlteration', 'sleeveAlteration', 'alterationDetails', 'alterationDone', 'isDamagedReturn'], label: 'מחזור חיי השכרה של פריט (לקיחה/החזרה/תיקונים)', riskNote: 'בטוח — ללא price/basePrice/finalPrice (ר\' rental_financial).' },
      { id: 'rental_financial', table: 'OrderItem/PaymentObligation', columns: ['price', 'basePrice', 'finalPrice', 'amount'], label: 'מחירי פריט השכרה וחיובים', riskNote: 'פיננסי — לחסום לעובד לא-מנהל.' },
      { id: 'payment_records', table: 'Payment/Refund', columns: ['amount', 'paymentMethod', 'paymentDate', 'notes', 'reason', 'isRefund', 'isExecuted'], label: 'רשומות תשלום/זיכוי', riskNote: 'פיננסי — לחסום לעובד לא-מנהל. ללא פרטי בנק (ר\' refund_bank_details).' },
      { id: 'refund_bank_details', table: 'Refund', columns: ['bankName', 'bankBranch', 'bankAccount', 'bankAccountName', 'paymentDetails', 'email'], label: 'פרטי בנק/כרטיס לזיכוי', riskNote: 'לעולם לא ברשימה לבנה — paymentDetails כולל 4 ספרות אחרונות של כרטיס; זהה ברמת הסיכון ל-employee_wage_secrets.' },
      { id: 'employee_directory', table: 'Employee', columns: ['firstName', 'lastName', 'phone1', 'phone2', 'roleId', 'isActive', 'fullName'], label: 'ספרייה בסיסית של עובדים (מי לפנות)', riskNote: 'בטוח — ללא שכר/סיסמה/מייל (ר\' employee_wage_secrets).' },
      { id: 'employee_wage_secrets', table: 'Employee', columns: ['hourlyWage', 'password', 'pinHash', 'paymentMethod', 'travelExpenses', 'email'], label: 'שכר/סודות/מייל עובד', riskNote: 'אסור בהחלט — לעולם לא ברשימה לבנה. password/pinHash הם hash-ים אך עדיין אסור לחשוף אפילו את קיומם בתשובה.' },
      { id: 'shift_attendance', table: 'Shift', columns: ['entryTime', 'exitTime', 'totalMinutes', 'notes', 'hebrewDate'], label: 'נוכחות/שעון נוכחות (בלי שכר)', riskNote: 'מידע אישי על עובד ספציפי (מתי הגיע/יצא) — גם בלי עמודות השכר (hourlyWageSnapshot/totalCalculated מוחרגות כליל) מומלץ מנהל בלבד, לא ברירת מחדל.' },
      { id: 'notifications_internal', table: 'Notification', columns: ['title', 'content', 'category'], label: 'תוכן הודעות פנימיות בין עובדים', riskNote: 'לעולם לא ברירת מחדל — תוכן חופשי שעובדים כתבו זה לזה, יכול לכלול כל דבר (כולל דברים שנכתבו על לקוחות/עובדים אחרים).' },
      { id: 'audit_trail', table: 'AuditLog', columns: ['entityType', 'entityId', 'action', 'changesJson'], label: 'יומן ביקורת (היסטוריית שינויים גולמית)', riskNote: 'לעולם לא ברשימה לבנה — changesJson יכול להכיל את הערך הקודם/החדש של כל שדה בכל טבלה, כולל שדות שהוחרגו בכוונה מכל שאר הקטגוריות כאן; חשיפתו מבטלת את כל הרעיון של רשימה לבנה.' },
    ],
    defaultWhitelist: ['customer_basic', 'customer_status_flags', 'order_operational', 'dress_model_catalog', 'dress_item_inventory', 'rental_lifecycle'],
  },

  // recording (app/api/ai/route.js image/recording branch + app/api/ai/recording/init/route.js).
  recording: {
    candidateFields: [
      { id: 'action_steps_text', table: '(רשימת פעולות מוקלטת, לא DB)', columns: [], label: 'רשימת הפעולות המוקלטת (טקסט מובנה)', riskNote: 'שדות רגישים (סיסמה/כרטיס/ת"ז) כבר מוסתרים בדפדפן לפני שהרשימה נשמרת (isSensitiveField/sanitizeValue, lib/actionRecorderCore.js) — בטוח יחסית כטקסט, אך אינו מסונן לפי "רשימה לבנה" אמיתית של שדות DB (זו רשימת קליקים/הקלדות, לא שאילתה).' },
      { id: 'video_raw_unfiltered', table: '(קובץ וידאו ב-Drive, לא DB)', columns: [], label: 'הווידאו הגולמי של הסרטת המסך', riskNote: 'לעולם לא ברשימה לבנה — אין שום סינון על מה שמופיע בפועל על המסך; סיסמה/מספר כרטיס/ת"ז שנראו על המסך אינם מוסתרים בווידאו עצמו (ר\' restriction no_video_content_quoting ב-restrictionsRegistry.js, שרק מנחה את Gemini לא לצטט אותם, לא חוסם אותם מלהגיע אליו). שדה זה קיים כאן רק כדי לתעד במפורש שהווידאו מוחרג ולמה — אין דרך "לסנן עמודות" בזרם וידאו.' },
    ],
    defaultWhitelist: ['action_steps_text'],
  },

  // statistics (app/api/ai/statistics/route.js) — same FULL schema.prisma access as main_chat
  // (getFullSchemaContext()), but the route is aggregate-oriented (COUNT/GROUP BY/SUM), so this
  // catalog mirrors main_chat's breadth in AGGREGATE form rather than raw-row form.
  statistics: {
    candidateFields: [
      { id: 'order_counts', table: 'Order/OrderItem', columns: ['COUNT(*)', 'GROUP BY status/eventDate'], label: 'ספירות/צבירות כלליות על הזמנות (לא שורות גולמיות)', riskNote: 'בטוח — אגרגציה בלבד, אין שורת נתונים מזהה יחידה בתשובה.' },
      { id: 'order_operational_aggregates', table: 'Order', columns: ['status', 'branch', 'isDelivery', 'isAbroad', 'eventDate (לפי חודש/יום)'], label: 'צבירות תפעוליות על הזמנות (בלי כסף)', riskNote: 'בטוח.' },
      { id: 'order_financial_aggregates', table: 'Order', columns: ['SUM(totalAmount)', 'AVG(totalAmount)', 'COUNT by isPaid/paymentMethod'], label: 'צבירות כספיות (סה"כ הכנסות, ממוצע וכו\')', riskNote: 'פיננסי — זהה במהות ל-financial_data; לחסום לעובד לא-מנהל.' },
      { id: 'customer_aggregates', table: 'Customer', columns: ['COUNT by city', 'COUNT by isBlocked', 'COUNT by marketingConsent'], label: 'ספירות לקוחות לא-מזהות (לפי עיר/סטטוס)', riskNote: 'בטוח — אגרגציה בלבד, לא שם/טלפון של לקוח ספציפי.' },
      { id: 'dress_inventory_aggregates', table: 'DressItem/DressModel', columns: ['COUNT by inRepair', 'COUNT by notInUse', 'COUNT by דגם/מיקום'], label: 'צבירות מלאי שמלות (בלי מחיר)', riskNote: 'בטוח.' },
      { id: 'rental_lifecycle_aggregates', table: 'OrderItem', columns: ['COUNT by isTaken', 'COUNT by isReturned', 'COUNT by isDamagedReturn'], label: 'צבירות מחזור חיי השכרה (בלי מחיר)', riskNote: 'בטוח.' },
      { id: 'payment_method_breakdown', table: 'Payment', columns: ['SUM(amount) GROUP BY paymentMethod', 'COUNT GROUP BY paymentMethod'], label: 'פילוח תשלומים לפי אמצעי תשלום', riskNote: 'פיננסי-משיק — גם בלי "הסכום הכולל" בודד, פילוח כזה לאורך זמן חושף בפועל תמהיל הכנסות; לחסום כמו order_financial_aggregates.' },
      { id: 'employee_wage_aggregates', table: 'Employee/Shift', columns: ['SUM(hourlyWage)', 'SUM(totalCalculated)'], label: 'צבירות שכר/תשלומי עובדים (סה"כ שכר)', riskNote: 'אסור בהחלט — אגרגציית שכר היא עדיין סוד שכר, לא פחות רגיש מפירוט לעובד בודד.' },
      { id: 'shift_totals_nonwage', table: 'Shift', columns: ['SUM(totalMinutes) by עובד/תאריך', 'COUNT of shifts'], label: 'צבירות שעות עבודה (בלי שכר)', riskNote: 'גם בלי עמודות שכר, זו עדיין פרופילינג של שעות עבודה של עובד ספציפי — מומלץ מנהל בלבד, לא ברירת מחדל.' },
      { id: 'audit_activity_counts', table: 'AuditLog', columns: ['COUNT GROUP BY entityType', 'COUNT GROUP BY action', 'COUNT by תאריך'], label: 'ספירת פעילות במערכת (בלי תוכן השינוי)', riskNote: 'סיכון בינוני — לא חושף changesJson/מי ביצע, אבל יכול לרמז על "גל מחיקות" וכו\'; מוחרג מברירת המחדל לפי גישה שמרנית, לא מוגדר "אסור בהחלט".' },
    ],
    defaultWhitelist: ['order_counts', 'order_operational_aggregates', 'dress_inventory_aggregates', 'rental_lifecycle_aggregates'],
  },

  // smart_search (app/api/ai/smart-search/route.js) — Gemini writes ONLY a WHERE fragment; the
  // route always runs SELECT <cols> FROM <one table> (TABLE_MAP: customers→Customer,
  // orders→Order, dresses→DressItem, rentals→OrderItem), using its own fixed SCHEMA_MAP as the
  // model's context (NOT the full schema). ORDERS_SAFE_COLUMNS already exists in the route code
  // for the financial_columns_orders restriction — reused verbatim below.
  smart_search: {
    candidateFields: [
      { id: 'customers_basic', table: 'Customer', columns: ['firstName', 'lastName', 'phone1', 'phone2', 'city', 'street', 'houseNum'], label: 'חיפוש לקוחות — פרטי קשר בסיסיים', riskNote: 'בטוח.' },
      { id: 'customers_status_flags', table: 'Customer', columns: ['isBlocked', 'blockedReason', 'marketingConsent'], label: 'חיפוש לקוחות — דגלי סטטוס', riskNote: 'בטוח ושימושי (למשל "הראה לי לקוחות חסומים").' },
      { id: 'customers_sensitive', table: 'Customer', columns: ['email', 'notes', 'officeNotes', 'zeout', 'bankName', 'bankBranch', 'bankAccount', 'bankAccountName', 'hokBankName', 'hokBankBranch', 'hokBankAccount'], label: 'חיפוש לקוחות — שדות רגישים', riskNote: 'לעולם לא ברשימה לבנה. חשוב: ה-route הזה מריץ היום SELECT * מ-Customer בלי שום סינון עמודות קוד (בניגוד ל-Order, שיש לו financial_columns_orders) — כלומר עמודות אלה כן חוזרות בפועל היום לכל עובד עם הרשאת AI שמחפש לקוחות. מצב רשימה לבנה אמיתי חייב לממש סינון עמודות ברמת קוד גם ל-Customer, לא רק ל-Order (ר\' סעיף 3 בהערת הכותרת).' },
      { id: 'orders_operational', table: 'Order', columns: ['id', 'orderId', 'customerId', 'status', 'isDeleted', 'eventDate', 'eventDateHebrew', 'returnDate', 'orderDate', 'notes', 'isDelivery', 'deliveryCity', 'deliveryDirection', 'isAbroad', 'fromDate', 'toDate'], label: 'חיפוש הזמנות — עמודות תפעוליות', riskNote: 'בטוח — זו בדיוק רשימת ORDERS_SAFE_COLUMNS הקיימת כבר בקוד ה-route עבור restriction financial_columns_orders.' },
      { id: 'orders_financial', table: 'Order', columns: ['totalAmount', 'totalPaid', 'paymentDate', 'paymentMethod', 'isPaid'], label: 'חיפוש הזמנות — עמודות פיננסיות', riskNote: 'כבר מוגן ברמת קוד היום ע"י financial_columns_orders (restrictionsRegistry.js) כשמופעל עבור עובד לא-מנהל — במצב רשימה לבנה יש להשתמש באותה רשימה בדיוק.' },
      { id: 'dresses_inventory', table: 'DressItem', columns: ['dressModelId', 'dressName', 'barcodePrefix', 'sizeText', 'serialNumber', 'dressBarcode', 'location', 'locationNum', 'quantity', 'inRepair', 'notInUse'], label: 'חיפוש שמלות — מלאי (בלי מחיר)', riskNote: 'בטוח ברובו. הערה: כמו ב-Customer, ה-route מריץ SELECT * כך שגם notInUseReason/cartonNumber/isDeleted חוזרים בפועל היום בלי סינון — לא רגישים במיוחד, אך שווה לדעת שהם לא באמת מסוננים עד שייבנה סינון עמודות אמיתי.' },
      { id: 'rentals_operational', table: 'OrderItem', columns: ['barcode', 'barcodePrefix', 'sizeText', 'isTaken', 'isReturned', 'returnedOk'], label: 'חיפוש השכרות — מחזור חיים (בלי מחיר)', riskNote: 'בטוח.' },
      { id: 'rentals_financial', table: 'OrderItem', columns: ['price', 'finalPrice'], label: 'חיפוש השכרות — מחיר', riskNote: 'רגיש, ולא מוגן היום ברמת קוד בכלל: SCHEMA_MAP[\'rentals\'] בקוד ה-route אפילו מנחה את Gemini לכלול price/finalPrice בתנאי חיפוש, ואין שום מקבילה ל-financial_columns_orders בהקשר rentals. לפני שרשימה לבנה תהיה משמעותית כאן יש לתקן ברמת קוד (selectList מצומצם ל-OrderItem ב-buildQuery, כמו שכבר קיים ל-orders).' },
    ],
    defaultWhitelist: ['customers_basic', 'customers_status_flags', 'orders_operational', 'dresses_inventory', 'rentals_operational'],
  },

  // admin_sql_generator (app/api/admin/ai-sql-generate/route.js) — the one feature explicitly NOT
  // suited to whitelist mode (see the header comment above, point 5). Left as a single
  // documentation-only entry on purpose — do not force real fields into it.
  admin_sql_generator: {
    candidateFields: [
      { id: 'no_whitelist_by_design', table: '-', columns: [], label: 'לא מתאים למצב רשימה לבנה', riskNote: 'תכונה זו מיועדת מטבעה לכתיבת SQL גמיש (כולל UPDATE/DELETE/INSERT) עבור הנהלה ראשית בלבד — הגבלה לרשימה לבנה של "מה מותר לחשוף" סותרת את עצם המטרה (לשנות נתונים, לא רק לקרוא אותם). ר\' גם ה-early-return הייעודי עבור featureKey זה ב-buildWhitelistOnlySystemPrompt למטה.' },
    ],
    defaultWhitelist: [],
  },

  // audit_chat (app/api/audit/chat/route.js) — Gemini returns ONLY a fixed-shape JSON filter
  // object (action/entityType/startDate/endDate/search/message); it never sees or returns a real
  // audit-log row, so this is already the narrowest of all 7 features by construction.
  audit_chat: {
    candidateFields: [
      { id: 'filter_fields_only', table: '(מבנה JSON קבוע, לא DB)', columns: ['action', 'entityType', 'startDate', 'endDate', 'search'], label: 'שדות הפילטר המובנים בלבד', riskNote: 'כבר מוגבל מטבעו — Gemini לעולם לא רואה שורת יומן אמיתית ולא מחזיר changesJson; הוא רק בוחר בין ערכי enum קבועים (action/entityType) וגוזר תאריכים/טקסט חיפוש מהניסוח החופשי של המשתמש. entityType יכול לקבל את הערך "Employee" (מותר גם היום) בלי לחשוף שום נתון עובד אמיתי — הוא רק שם טבלה לסינון שאילתת ה-audit הרגילה (לא-AI) שרצה בהמשך.' },
    ],
    defaultWhitelist: ['filter_fields_only'],
  },

  // report (app/api/ai/report/route.js) — formats/summarizes a data array the CALLER already
  // fetched and sent in the request body; this route itself never queries the DB.
  report: {
    candidateFields: [
      { id: 'caller_supplied_data_only', table: '(מגיע מגוף הבקשה, לא DB)', columns: [], label: 'רק הנתונים שכבר נשלחו ע"י הקורא', riskNote: 'תכונה זו ממילא לא ניגשת ל-DB בעצמה, ולכן "רשימה לבנה של טבלאות/עמודות" לא ממש חלה עליה — כל מה שהיא רואה כבר עבר דרך שיקול הדעת של הדף שקרא לה (שכבר סינן מה לשלוח). הבקרה הרלוונטית האמיתית כאן היא no_data_fabrication (restrictionsRegistry.js) — איסור "להמציא" שורות/מספרים שלא היו בקלט — לא רשימה לבנה.' },
    ],
    defaultWhitelist: ['caller_supplied_data_only'],
  },
};

// A reusable system-prompt scaffold for a future "reverse AI" (allowlist-only assistant). Not
// invoked by any route today — kept here so building that mode later starts from a real draft.
export function buildWhitelistOnlySystemPrompt(featureKey, selectedFieldIds) {
  const catalog = AI_WHITELISTS[featureKey];
  if (!catalog) return '';

  // admin_sql_generator writes SQL (UPDATE/DELETE/INSERT), it doesn't just look data up — "answer
  // only from an approved read-only allowlist" is a lookup concept that doesn't map onto it. Even
  // if a future admin UI lets someone flip whitelistMode on for this feature (nothing in
  // restrictionsConfig.js's generic whitelistMode/whitelist fields prevents that today), the
  // resulting prompt must not silently pretend to restrict data access the way it does for the
  // other 6 features — that would be actively misleading for a feature whose entire point is
  // writing arbitrary UPDATE/DELETE/INSERT statements.
  if (featureKey === 'admin_sql_generator') {
    return 'ALLOWLIST MODE IS NOT APPLICABLE TO THIS FEATURE: this assistant generates SQL that can UPDATE/DELETE/INSERT data for head management, not just look data up — there is no fixed set of "safe to expose" columns, because changing data outside any fixed list is the entire point. Do not restrict yourself to any allowlist here. Continue following the normal SQL-generation rules and the existing soft-delete / WHERE-clause safety restrictions instead (see restrictionsRegistry.js) — those, not a whitelist, are the real safety mechanism for this feature.';
  }

  const fields = catalog.candidateFields.filter((f) => selectedFieldIds.includes(f.id));
  if (fields.length === 0) {
    return 'STRICT ALLOWLIST MODE: no data fields have been approved for this feature. Refuse every question and explain that this assistant currently has no approved data to answer from. Do not reveal, confirm, or hint at what tables/columns exist in the underlying system while explaining this.';
  }
  const fieldLines = fields
    .map((f) => `- ${f.label}${f.table !== '-' ? ` (${f.table}${f.columns.length ? `: ${f.columns.join(', ')}` : ''})` : ''}`)
    .join('\n');
  return `STRICT ALLOWLIST MODE: you may answer ONLY using the following approved data — nothing else, even if you believe you know the answer from elsewhere in the conversation or the schema:
${fieldLines}

If the user's question requires any data NOT in this list, you MUST refuse and say plainly (in Hebrew) that this assistant is not permitted to answer that, without guessing or partially answering. Never reveal, confirm, or deny the existence of tables/columns outside this list, even if asked directly whether you "have access to" something.`;
}
