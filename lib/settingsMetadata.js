// Single source of truth for SystemSetting display metadata (Hebrew names, help
// notes, tab/category grouping and ordering, and field-type classification).
//
// Historically this lived only inside app/admin/settings/SettingsClient.js. It was
// moved here (2026-09-15) so a second consumer - the AI settings-guide endpoint used
// by the Gemini-based admin assistant (app/api/settings/guide/route.js, called from
// app/api/ai/route.js) - reads the exact same names/descriptions/categories the real
// settings page renders, instead of a hand-typed copy that would drift out of sync
// over time (see the org1/org2 settings-drift incidents documented in CLAUDE.md -
// that is exactly the failure mode a second copy of this data would reintroduce).
// SettingsClient.js imports everything below instead of defining it locally.
import { SECRET_SETTING_KEYS, SECRET_MASK } from '@/app/lib/secretSettingKeys';

export const SETTINGS_CATEGORY_ICONS = {
  'מיילים': 'i-mail',
  'תצוגה': 'i-grid',
  'מסד נתונים': 'i-database',
  'הזמנות': 'i-bag',
  'מאגר': 'i-database',
  'כללי': 'i-settings',
  'כותרות': 'i-tag',
  'תשלומים': 'i-card',
  'יומן': 'i-calendar',
  'הדפסה': 'i-printer',
  'בינה מלאכותית': 'i-star',
  'לא בשימוש': 'i-info',
  'אוטומציה': 'i-clock',
  'הוראת קבע': 'i-card',
  'סנכרון': 'i-activity',
  'סניפים': 'i-pin',
  'מחירון': 'i-tag',
  'הודעות': 'i-mail',
  'ברקודים': 'i-tag',
  'משלוחים': 'i-box',
  'default': 'i-grid'
};

export const SETTINGS_HEBREW_NAMES = {
  email_link_a: 'קישור פריסה א\' (ראשי)',
  email_link_b: 'קישור פריסה ב\' (משני)',
  email_routing_strategy: 'אסטרטגיית ניתוב מיילים',
  email_drive_folder_id: 'תיקיית דרייב לשליחת קבצים',
  gmach_name: 'שם הגמ"ח / המערכת',
  gmach_subtitle: 'כותרת משנה לגמ"ח',
  gmach_address: 'כתובת הגמ"ח',
  gmach_phone: 'טלפון הגמ"ח',
  require_login: 'חובת התחברות למערכת',
  item_locations: 'מיקומי פריטים במלאי',
  barcodePrefixLength: 'אורך קידומת ברקוד',
  inventory_include_warehouse: 'ספירת מלאי מחסן',
  allow_renting_reserve_items: 'אפשר השכרת שמלות ברזרבה',
  allow_shift_lead_reserve_rental: 'אפשר לאחראית משמרת לאשר השכרת רזרבה',
  enforce_rental_barcode_match: 'חסום השכרה של ברקוד שלא תואם לשמלה שהוזמנה',
  require_approval_for_early_return: 'דרוש אישור מנהל להחזרה לפני מועד האירוע',
  main_email: 'כתובת אימייל ראשית',
  // --- 38 בקשות: תוספות ---
  hide_custom_spacing: 'אפשר ציפוף ימים מיוחד',
  nedarim_rinat_lev_url: 'קישור נדרים פלוס - רינת לב',
  hok_enabled: 'הפעל הוראת קבע (הו״ק)',
  hok_auto_charge_enabled: 'גביה אוטומטית למאחרים',
  hok_auto_charge_hour: 'שעת גביה אוטומטית',
  hok_charge_amount: 'סכום גביה נוספת למאחר (לשמלה)',
  strict_mandatory_fields: 'אכיפה קשיחה ללא אישור מנהל',
  require_customer_email: 'חייב מייל לקוח',
  require_full_address: 'חייב כתובת מלאה',
  require_marketing_consent: 'חייב אישור דיוור',
  hide_marketing_consent_field: 'הסתר שדה אישור דיוור',
  require_customer_id_number: 'חייב ת"ז ביצירת לקוח',
  auto_email_on_order_create: 'מייל אוטומטי בעת יצירת הזמנה',
  pickup_reminder_enabled: 'תזכורת מייל יום לפני איסוף',
  pickup_reminder_hour: 'שעת תזכורת איסוף',
  daily_manager_report_enabled: 'דוח יומי למנהל',
  daily_manager_report_email: 'מייל מנהל לדוח יומי',
  daily_manager_report_hour: 'שעת דוח יומי',
  late_return_email_enabled: 'מייל אוטומטי למאחרים',
  late_return_email_text: 'נוסח מייל איחור',
  late_return_threshold_days: 'ימי איחור להצעת "חזר לא תקין"',
  yemot_enabled: 'הפעל סנכרון ימות המשיח',
  yemot_api_url: 'URL ימות המשיח',
  yemot_api_token: 'טוקן ימות המשיח',
  yemot_queue_view_enabled: 'הצג תור מזמינים (ימות)',
  yemot_import_customer_enabled: 'ייבוא לקוח מימות',
  mailing_list_auto_sync: 'הוסף מיילים לרשימת תפוצה',
  mailing_list_provider: 'ספק רשימת תפוצה',
  phone_order_marker_enabled: 'סמן הזמנה טלפונית',
  track_branch_on_order: 'זהה סניף ביצוע',
  auto_print_on_order_create: 'הדפסה אוטומטית ביצירת הזמנה',
  require_id_for_edit_cancel: 'דרוש ת״ז לעריכה/ביטול',
  require_manager_code_for_item_changes: 'דרוש קוד מנהל לביטול/הוספת פריט',
  enable_deliveries: 'הצג משלוחים',
  delivery_days_before: 'ימי משלוח הלוך לפני האירוע',
  delivery_days_after: 'ימי משלוח חזור אחרי האירוע',
  delivery_price: 'מחיר משלוח אחיד (ברירת מחדל)',
  delivery_price_by_city: 'מחיר משלוח לפי עיר (JSON)',
  delivery_allow_address_override: 'אפשר כתובת משלוח שונה',
  delivery_show_in_order: 'הצג משלוח בהזמנה',
  courier_email: 'כתובת מייל למשלוחן',
  courier_name: 'שם המשלוחן',
  rentals_sort_recent_first: 'השכרות - האחרונים למעלה',
  enforce_strict_max_items: 'אכיפה קשיחה מקסימום ללא חריגה',
  delivery_table_range_enabled: 'טבלת משלוחים לטווח',
  delivery_one_day_before_option: 'אפשר משלוח יום לפני',
  deliveries_select_by_event_date: 'משלוחים - בחירת תאריך לפי תאריך האירוע',
  delivery_skip_weekends: 'משלוחים - ספירת ימים לפי ימי עסקים (לא כולל שישי-שבת)',
  print_sort_deliveries_first: 'הדפסה - מיון משלוחים בנפרד',
  print_mark_missing_dresses: 'הדפסה - סמן שמלה חסרה',
  enable_batch_print_prep: 'הפעל אשף הדפסת אצווה (הכנה לפי תאריך)',
  bulk_email_by_event_date: 'שליחת מייל לפי תאריך אירוע',
  auto_charge_damaged_return: 'גביה על החזרה פגומה',
  shift_handover_notes: 'הודעות בין משמרות',
  management_messages: 'הודעות להנהלה',
  barcode_invalid_list: 'רשימת ברקודים לא תקינים',
  allow_edit_partially_rented: 'אפשר עריכת מושכר חלקי',
  split_dress_enabled: 'דגם מפוצל ל-2 חלקים',
  notify_on_new_message_at_login: 'התראה על הודעה חדשה בכניסה',
  laundress_return_check_on_exit: 'בדיקת כובסת ביציאה',
  manual_barcode_double_entry: 'הקלדה ידנית כפולה + חתימה',
  manual_barcode_daily_report: 'דוח יומי ברקודים ידניים',
  kiosk_customer_self_service: 'עמדת לקוח - רישום עצמי',
  kiosk_allow_self_order: 'אפשר הזמנה עצמית באתר',
  branches_enabled: 'הפעל סניפים',
  branch_list: 'רשימת סניפים',
  premium_pricing_enabled: 'הפעל מחירון פרימיום',
  premium_categories: 'קטגוריות פרימיום',
  show_not_taken_orders: 'הצג לא-נלקחו (קטגוריה)',
  hide_taken_orders_from_orders_list: 'הסתר הזמנות שנלקחו מרשימת ההזמנות',
  cancellation_extra_columns: 'עמודות ביטול נוספות',
  enable_rental_extension: 'הפעל יום השכרה נוסף',

  mandatory_fields: 'שדות חובה במילוי פרטי הזמנה',
  draft_orders_show_as_deleted: 'הצג הזמנות טיוטה כמחוקות',
  enable_local_order_drafts: 'שמירת טיוטה מקומית לשינויים שלא נשמרו',
  enable_order_edit_summary_confirm: 'חלון סיכום וחוב לפני שמירת הזמנה קיימת',
  allow_alterations: 'מעקב ואפשרות תיקונים',
  enable_alterations: 'הפעל אפשרות תיקונים במערכת',
  max_items_per_order: 'כמות פריטים מקסימלית להזמנה',
  allow_free_exchange: 'אפשר החלפת דגם ללא עלות',
  cancel_order_permission: 'הרשאת ביטול הזמנה',
  reserve_permission: 'הרשאת אישור שמלות רזרבה',
  allow_date_change: 'אפשר שינוי טווח תאריכי השכרה',
  BUFFER_DAYS: 'ימי מרווח ביטחון בין השכרות',

  has_variations: 'ניהול וריאציות ודגמים משניים',
  has_underskirts: 'ניהול פריטי עזר ותחתיות',
  barcode_length: 'אורך תווים תקין לברקוד',
  useModelNames: 'הצגת שמות דגמים במערכת',
  useFileNamesForImages: 'טעינת תמונות לפי שם קובץ',

  hide_ai_features: 'הפעל בינה מלאכותית (AI)',
  enable_ai_specific_employees: 'הסתר את ה-AI ממסך הלקוחות (קיוסק)',
  ai_screen_recording_enabled: 'אפשר הסרטת מסך בעוזר ה-AI ובדיווחי שגיאות',
  hide_dress_images: 'הצג תמונות דגמים במערכת',
  hide_gregorian_calendar: 'אפשר תאריך לועזי ביומן',
  hide_internal_messaging: 'הפעל מערכת הודעות פנימית',
  hide_error_reporting: 'הפעל מערכת דיווחי שגיאות',

  items_name_plural: 'שם פריטים ברבים',
  items_name_singular: 'שם פריט ביחיד',

  refund_per_item: 'חישוב החזר לפי פריט בנפרד',
  registration_fee: 'גביית דמי רישום מראש',
  allow_additional_payment_on_order: 'אפשר תשלום נוסף בהזמנה קיימת',
  nedarim_plus_enabled: 'סליקת אשראי בנדרים פלוס',
  nedarim_plus_terminal: 'קוד מוסד נדרים פלוס',
  NEDARIM_MOSAD: 'קוד מוסד נדרים פלוס',
  ENABLE_SET_DISCOUNTS: 'הפעל מבצע סטים וזיכויים',
  REFUND_PERCENTAGE: 'אחוז החזר כספי בביטול',
  REFUND_DAYS: 'ימי זכאות להחזר ממועד האירוע',
  NO_REFUND_DAYS_BEFORE_EVENT: 'ימים ללא החזר לפני אירוע',
  REFUND_DAYS_FROM_ORDER: 'ימי החזר מיום ביצוע ההזמנה',
  REFUND_REPAIRS: 'החזר על עלויות תיקונים',
  CANCELLATION_CREDIT_MINUTES: 'דקות לזיכוי דמי ביטול על פריט חלופי',
  instant_undo_minutes: 'ביטול מיידי - כמה דקות',
  same_model_swap_no_fee: 'החלפת מידה באותו דגם - ללא דמי ביטול',
  swap_min_days_before_event: 'החלפת מידה חינם - עד כמה ימים לפני האירוע',
  swap_same_category_only: 'החלפת מידה חינם - רק באותה שורת מחיר',
  refund_tiers_at_deletion_time: 'מדרגות ההחזר לפי רגע הביטול',
  swap_pairing_window_minutes: 'החלפת מידה - הפרש זמן בין המחיקה להוספה (דקות)',
  size_edit_until_days_before_event: 'עריכת מידה בתוך הפריט - עד כמה ימים לפני האירוע',
  gap_size_price_rule: 'מידה שנמצאת בין שני טווחי מחיר',
  ALLOWED_PAYMENT_METHODS: 'אפשרויות תשלום מורשות',
  PAYMENT_APPROVAL_LEVEL: 'רמת אישור ליציאה מהזמנה בלי תשלום מלא',

  calendar_filtering: 'סינון ואירועים עבריים ביומן',
  inventory_skip_weekends: 'דלג על סוף שבוע בחישוב מלאי',
  inventory_buffer_days: 'ימי מרווח ביטחון בין השכרות',

  print_rental_box1: 'הערות השכרה - תיבה 1 (עליונה)',
  print_rental_box2: 'הערות השכרה - תיבה 2 (אמצעית)',
  print_rental_footer: 'הערות השכרה - טקסט תחתון ותקנון',
  home_welcome_title: 'כותרת ברוכים הבאים בדף הבית',

  // פרוטוקול תיקון דיווחי שגיאות (docs/fix-protocol-error-reports.md) - הגדרות עם שחזור
  restrict_dress_catalog_to_head_management: 'הגבלת קטלוג דגמים להנהלה ראשית',
  restrict_refunds_to_head_management: 'הגבלת זיכויים וחובות להנהלה ראשית',
  restrict_board_to_managers: 'הגבלת לוח חודשי למנהלים בלבד',
  show_employee_profile_image: 'הצגת תמונת פרופיל בכרטיס עובד',
  error_report_handled_at_bottom: 'פניות מטופלות בתחתית הרשימה',
  error_report_human_button_enabled: 'הצג כפתור "מענה אנושי" בדיווחי שגיאות',
  standard_return_hour: 'שעת החזרה סטנדרטית בדוח השכרה',
  rental_belt_notice: 'שורת הערת חגורות בדוח השכרה',

  // עדכון PR-ים ממתינים לאישור (docs/fix-protocol-error-reports.md, lib/agentDigest.js)
  agent_digest_email_enabled: 'מייל עדכון על ענפי תיקון ממתינים לאישור',
  agent_digest_email_hours: 'שעות שליחת עדכון ענפי תיקון',

  enable_unreturned_orders_popup: 'חלונית תזכורת הזמנות שלא הוחזרו'
};

export const SETTINGS_HEBREW_NOTES = {
  email_link_a: 'הקישור הראשי לשליחת מיילים מהמערכת (Script URL)',
  email_link_b: 'הקישור המשני (מומלץ עבור דיווחי שגיאות או גיבוי)',
  email_routing_strategy: 'קבע איזה קישור ישמש כברירת מחדל ואם להפריד שליחות.',
  email_drive_folder_id: 'מזהה תיקיית יעד בדרייב להעלאת קבצים (ID מה-URL). ריק = שורש הדרייב של חשבון ה-GAS. הקבצים משותפים עם הנמען בהרשאת הורדה מלאה.',
  gmach_name: 'שם המערכת שיופיע בראש העמוד, במסמכים ובחשבוניות.',
  gmach_subtitle: 'כותרת משנה המופיעה מתחת לשם הגמ"ח בדף הראשי ובתדפיסים.',
  gmach_address: 'כתובת הגמ"ח שתופיע בראש המסמכים והתדפיסים.',
  gmach_phone: 'מספר הטלפון של הגמ"ח שיופיע בראש המסמכים והתדפיסים.',
  require_login: 'משתמשים יצטרכו להזין קוד עובד וסיסמה בכניסה למערכת.',
  item_locations: 'רשימת מיקומים פיזיים בגמ"ח (לדוגמה: מדף א, קומה 2, מחסן אחורי) מופרדים בפסיקים.',
  barcodePrefixLength: 'מספר הספרות הראשונות בברקוד המגדירות את קידומת זיהוי סוג הפריט.',
  inventory_include_warehouse: 'הצג וספור במלאי גם פריטים הנמצאים במחסן. (זו הגדרה נפרדת מ"אפשר השכרת שמלות ברזרבה" למטה - לפריטי רזרבה יש הגדרה משלהם.)',
  allow_renting_reserve_items: 'כשמופעל, פריטים שמסומנים "רזרבה" נחשבים זמינים להשכרה כמו כל פריט אחר - הן בחישובי הזמינות, הן בבחירת פריט להזמנה, והן בסריקת ברקוד (לא נדרש עוד אישור מנהל לכל השכרה). ברירת המחדל כבויה (התנהגות קיימת - פריטי רזרבה חסומים). נפרד בכוונה מ"ספירת מלאי מחסן" - רזרבה ומחסן הם שני מצבים שונים.',
  allow_shift_lead_reserve_rental: 'לא בשימוש (2026-09-22): מי רשאי לאשר עקיפה של חסימת-רזרבה נקבע עכשיו במסך ההרשאות ("אישור השכרת שמלה מהרזרבה") בלבד. ההגדרה הזו כבר לא נקראת בשום קוד (האם רזרבה חסומה בכלל נקבע בנפרד ב-"אפשר השכרת שמלות ברזרבה" למעלה).',
  enforce_rental_barcode_match: 'כשמופעל, בעת השכרה (הזנת ברקוד ידנית בשורת הפריט, סריקה מהסיידבר, הקלדה ידנית של ברקוד שלא קיים במאגר ושמירת הזמנה) השרת בודק שהדגם והמידה של הברקוד תואמים לדגם ולמידה שהוזמנו בפריט. ברקוד של שמלה אחרת נדחה עם הודעה "הברקוד שנסרק (דגם X מידה Y) לא תואם לפריט שהוזמן (דגם A מידה B)", וניתן לעקוף רק באישור סיסמה של מנהל/מתכנת - ואז נשלחת התראה פנימית לכל המנהלים עם פרטי הברקוד והפריט, והעקיפה נרשמת בהיסטוריית הפריט. הפענוח: הספרות לפני ארבע האחרונות = דגם, שתי הספרות שלפני האחרונות = מידה. פריט שחסר בו דגם או מידה, וברקוד שאי אפשר לפענח, לא נחסמים. ברירת המחדל כבויה (התנהגות קיימת - כל ברקוד מתקבל בלי בדיקה). (מי רשאי לאשר עקיפה נקבע בהרשאה "אישור השכרה של ברקוד שלא תואם להזמנה" במסך ההרשאות; ברירת המחדל מנהל סניף.)',
  require_approval_for_early_return: 'כשמופעל, סימון פריט כ"הוחזר" (טאב הפריטים בכרטיס הזמנה, בר ההחזרה המהיר ב"השכרות והחזרות" וכרטיס ההזמנה שם) בהזמנה שתאריך האירוע שלה עדיין לא הגיע נחסם, וניתן לעקוף רק באישור סיסמה של מנהל - ואז נשלחת התראה פנימית לכל המנהלים, והעקיפה נרשמת בהיסטוריית הפריט. ברירת המחדל כבויה (התנהגות קיימת - אפשר לסמן החזרה בכל שלב). (מי רשאי לאשר עקיפה נקבע בהרשאה "אישור החזרה לפני מועד האירוע" במסך ההרשאות.)',
  main_email: 'כתובת האימייל הראשית של הגמ"ח ליצירת קשר והודעות.',

  mandatory_fields: 'סמן בתיבת הבחירה (צ\'קבוקס) את השדות מתוך פרטי לקוח שיהיו חובה בעת מילוי הזמנה.',
  draft_orders_show_as_deleted: 'כשמופעל, הזמנות טיוטה שנשמרו אוטומטית בזמן מילוי הזמנה חדשה ולא הושלמו מוצגות בסטטוס ובסינון "מחוק" יחד עם שאר ההזמנות המחוקות, במקום להופיע בטאב "טיוטות" נפרד ברשימת ההזמנות.',
  enable_local_order_drafts: 'כשמופעל (ברירת המחדל), כל עוד יש בכרטיס הזמנה קיימת שינויים שלא נשמרו, מצב העריכה נשמר אוטומטית כטיוטה בדפדפן (לא בשרת) - כדי שסגירת טאב/קריסה בטעות לא תאבד את העריכה, עם הצעת שחזור/מחיקה בפתיחה הבאה של הכרטיס ותג "לא נשמר" ברשימת ההזמנות. כבוי = אין שמירת טיוטה מקומית בכלל.',
  enable_order_edit_summary_confirm: 'כשמופעל, לחיצה על "שמור שינויים" (או יציאה מהכרטיס עם שינויים) בהזמנה קיימת מציגה קודם חלון סיכום: הפריטים/משלוח בהזמנה, הסכום הכולל המעודכן, מה כבר שולם ומה נותר לתשלום - כמו שקורה באשף הזמנה חדשה - ורק אחרי אישור העובד/ת בפועל נשמר. כבוי (ברירת המחדל) = ההתנהגות הקודמת: שמירה ישירה, בלי חלון סיכום מקדים (עדיין יש מעבר אוטומטי לטאב תשלומים אם השמירה יצרה חוב חדש).',
  allow_alterations: 'מעקב ואפשרות ניהול תיקונים והתאמות אישיות לשמלות.',
  enable_alterations: 'הצגת אפשרויות לניהול תיקונים בכרטיסי ההזמנה.',
  max_items_per_order: 'הגבלת הכמות המרבית של פריטים שניתן לשבץ בהזמנה אחת.',
  allow_free_exchange: 'אפשרות להחלפת דגם שמלה ללא גביית דמי טיפול נוספים.',
  cancel_order_permission: 'הגדרת הרשאות הנדרשות לצורך ביטול הזמנה במערכת (בחירת מחלקות מורשות).',
  reserve_permission: 'הגדרת הרשאות הנדרשות לאישור שמלות רזרבה (בחירת מחלקות מורשות).',
  allow_date_change: 'מאפשר למשתמש לשנות את טווח תאריכי ההשכרה של ההזמנה.',
  BUFFER_DAYS: 'מספר ימים לפני ואחרי תאריך אירוע שבהם השמלה נחשבת תפוסה במלאי.',

  has_variations: 'אפשרות לנהל פריטי משנה (כגון: ווסט, חליפה) תחת אותו דגם.',
  has_underskirts: 'אפשרות לשילוב פריטי עזר כגון תחתיות יחד עם השמלות.',
  barcode_length: 'מספר התווים התקני לברקוד במאגר השמלות.',
  useModelNames: 'הצגת שם הדגם לצד המזהה הקטלוגי בטפסים ובחיפושים.',
  useFileNamesForImages: 'טעינה אוטומטית של תמונות לפי שם הקובץ מהשרת.',

  hide_ai_features: 'הצגה או הסתרה של תכונות ה-AI, הצאט ושורת החיפוש החכמה.',
  enable_ai_specific_employees: 'משפיע רק על מסך הלקוחות (הקיוסק): אם מופעל, תיבת ה-AI לא מוצגת ללקוחות. הרשאות AI לעובדים נקבעות במסך ההרשאות.',
  ai_screen_recording_enabled: 'מציג כפתור "הסרטת מסך" בעוזר ה-AI ובדף דיווחי השגיאות (בטופס דיווח חדש ובתגובות): מוסרט המסך (עד 90 שניות, עולה לדרייב) ובמקביל נרשמת רשימת הפעולות (לחיצות, הקלדות, ניווט; סיסמאות/אשראי/ת"ז מוסתרים), והכול נשלח לניתוח (עלות/זמן עיבוד גבוהים יותר מצילום מסך רגיל, לכן כבוי כברירת מחדל). דורש שהגשר לדרייב מוגדר בשרת.',
  hide_dress_images: 'מסתיר תמונות דגמים במסכי הניהול ובכרטיסי הדגמים.',
  hide_gregorian_calendar: 'הסתרת תאריכים לועזיים והתמקדות בלוח העברי.',
  hide_internal_messaging: 'הסתרה או הפעלה של פעמון ההתראות והודעות בין עובדים.',
  hide_error_reporting: 'הסתרה או הפעלה של אפשרות דיווח שגיאות מהמערכת (כפתור גלגל הצלה).',

  restrict_dress_catalog_to_head_management: 'לא בשימוש (2026-09-22): מי נכנס לקטלוג הדגמים נקבע עכשיו במסך ההרשאות ("קטלוג שמלות") בלבד - שורות הרשאה לכל מחלקה. ההגדרה הזו כבר לא נקראת בשום קוד.',
  restrict_refunds_to_head_management: 'לא בשימוש (2026-09-22): מי נכנס לעמוד הזיכויים והחובות נקבע עכשיו במסך ההרשאות ("זיכויים") בלבד - שורות הרשאה לכל מחלקה. ההגדרה הזו כבר לא נקראת בשום קוד.',
  restrict_board_to_managers: 'לא בשימוש (2026-09-22): מי רואה ונכנס ל"לוח חודשי" נקבע עכשיו במסך ההרשאות ("לוח חודשי") בלבד - שורות הרשאה לכל מחלקה. ההגדרה הזו כבר לא נקראת בשום קוד.',
  show_employee_profile_image: 'הצגת אזור העלאת/תצוגת תמונת פרופיל בכרטיס העובד (הפרופיל האישי וכרטיס העובד המנהלי). כבוי = האזור מוסתר לגמרי.',
  error_report_handled_at_bottom: 'פניות שסומנו "טופל" ברשימת הפניות הפתוחות יורדות לתחתית הרשימה, כדי שפניות חדשות יבלטו למעלה.',
  error_report_human_button_enabled: 'כשמופעל, מוצג בשרשור דיווח שגיאה (אחרי תגובת הסוכן האוטומטי) כפתור "אוף! אני צריך מענה אנושי!" למדווח/ת. לחיצה עליו מדלגת על הסוכן האוטומטי בדיווח הזה ושולחת מייל לתמיכה לטיפול ידני. כבוי = הכפתור לא מוצג בכלל.',
  enable_batch_print_prep: 'מציג ברשימת ההזמנות ובלוח החודשי את אפשרות "פירוט הזמנות להכנה" באשף ההדפסה - הדפסת כל ההזמנות לטווח תאריכים במכה אחת, כולל דפי הפרדה בין קבוצות (למשל משלוח מול איסוף עצמי). כבוי = אפשרות ההדפסה הזו לא מוצגת באשף כלל (שאר אפשרויות ההדפסה הרגילות לא מושפעות).',
  standard_return_hour: 'שעת ההחזרה המוצגת בשורת "פרטי החזרה" בדוח ההשכרה המודפס (פורמט HH:MM).',
  rental_belt_notice: 'שורה נוספת שתופיע מתחת ל"פרטי החזרה" בדוח ההשכרה המודפס (למשל הערה על החזרת חגורות). ריק = לא מוצגת.',
  enable_unreturned_orders_popup: 'כשמופעל, כל עובד/ת מחובר/ת רואה בכניסה (וכל שעה אחר כך) חלונית חוסמת עם רשימת ההזמנות שעדיין לא הוחזרו ומועד ההחזרה שלהן עבר. כבוי = החלונית לא מופיעה כלל.',

  items_name_plural: 'הכיתוב שיופיע בכל הטבלאות (למשל: שמלות / חליפות / פריטים).',
  items_name_singular: 'הכיתוב ביחיד (למשל: שמלה / חליפה / פריט).',

  refund_per_item: 'חישוב החזר דמי ביטול בנפרד עבור כל פריט בהזמנה.',
  registration_fee: 'האם לגבות דמי רישום מראש בעת פתיחת הזמנה.',
  allow_additional_payment_on_order: 'הצגת כפתור "תשלום נוסף" בטאב תשלומים של הזמנה קיימת, לרישום תשלום (למשל מזומן) נוסף על ההיסטוריה הקיימת - לא כרוך בחיוב/חוב חדש.',
  nedarim_plus_enabled: 'הפעלת אפשרות סליקת אשראי דרך מערכת נדרים פלוס.',
  nedarim_plus_terminal: 'קוד המוסד המזהה במערכת נדרים פלוס עבור חיוב אשראי.',
  NEDARIM_MOSAD: 'קוד המוסד המזהה במערכת נדרים פלוס עבור חיוב אשראי.',
  ENABLE_SET_DISCOUNTS: 'מתן זיכוי/הנחה אוטומטית על פריטים נלווים בהזמנת סט.',
  REFUND_PERCENTAGE: 'אחוז החזר כספי מסך העסקה בעת ביטול הזמנה.',
  REFUND_DAYS: 'מספר ימים מרבי ממועד האירוע שבהם ניתן לבקש החזר.',
  NO_REFUND_DAYS_BEFORE_EVENT: 'מספר ימים לפני האירוע שמתחתיו לא יינתן החזר כספי.',
  REFUND_DAYS_FROM_ORDER: 'מספר ימים מביצוע ההזמנה שבהם זכאים להחזר מלא.',
  REFUND_REPAIRS: 'כולל עלויות תיקונים בחישוב ההחזר הכספי בביטול.',
  CANCELLATION_CREDIT_MINUTES: 'כמה דקות אחרי ביטול פריט אפשר להפוך את דמי הביטול לזיכוי על פריט חלופי שנוסף לאותה הזמנה. הזמן נספר מרגע שמירת הביטול בפועל. ההגדרה הזאת משפיעה רק על הזיכוי הזה - היא לא קובעת את "ביטול מיידי" ולא את "החלפת מידה". 0 = הזיכוי כבוי לגמרי ודמי הביטול נגבים כרגיל. ריק = 15 דקות.',
  instant_undo_minutes: 'פריט שנוסף להזמנה ובוטל תוך כמה דקות נחשב כאילו מעולם לא נוסף: בלי חיוב, בלי דמי ביטול ובלי קנס. 0 = "ביטול מיידי" כבוי. ריק = משתמשים באותו מספר דקות של "דקות לזיכוי דמי ביטול על פריט חלופי" (כך זה עבד עד היום).',
  same_model_swap_no_fee: 'המתג הראשי של החלפת מידה. כשהוא דולק, מחיקת פריט והוספת פריט מאותו דגם (מידה אחרת) באותה הזמנה נחשבת "החלפת מידה" ולא ביטול - בלי דמי ביטול, והלקוח/ה משלמ/ת רק הפרש מחיר אם יש. התנאים הנוספים (ימים לפני האירוע, אותה שורת מחיר, הפרש זמן) מצמצמים מתי זה חל. כשההחלפה לא עומדת בתנאים, חוזרים לביטול הרגיל לפי שלוש המדרגות. כבוי = כל ביטול מטופל כביטול רגיל.',
  swap_min_days_before_event: 'החלפת מידה חינם אפשרית רק אם נשארו עד האירוע לפחות כמה ימים (לפי לוח השנה, מיום ההחלפה עד יום האירוע). למשל 2 = אפשר להחליף עד יומיים לפני האירוע, כולל היום השני. אחרי זה ההחלפה נחשבת ביטול רגיל. 0 או ריק = בלי הגבלה, אפשר להחליף עד יום האירוע. פועל רק כשהמתג הראשי של החלפת מידה דולק.',
  refund_tiers_at_deletion_time: 'כשדולק, אחוז ההחזר (החזר מלא / אחוז / אין החזר) נקבע לפי המועד שבו הפריט בוטל בפועל, ולא לפי היום שבו ההזמנה מחושבת מחדש. כך ביטול שבוצע 20 יום לפני האירוע נשאר בהחזר המלא שהוגדר גם אם מאוחר יותר משלמים או שומרים את ההזמנה כשנשארו פחות מ-14 יום. כבוי = ההחזר נקבע לפי רגע החישוב, כמו תמיד.',
  swap_same_category_only: 'כשדולק, החלפה חינם רק כששתי המידות באותה שורת מחיר במחירון (למשל אישה באישה, ילדה בילדה). החלפה בין שורות מחיר שונות נחשבת ביטול רגיל, והפריט החדש מחויב במלוא מחירו. כבוי = אפשר להחליף בין כל מידות אותו הדגם. פועל רק כשהמתג הראשי של החלפת מידה דולק.',
  swap_pairing_window_minutes: 'קובע כמה זמן יכול לעבור בין מחיקת פריט להוספת פריט מאותו דגם כדי שהמערכת תראה בהם החלפה אחת. הפריט המחוק מזווג עם הפריט הקרוב ביותר בזמן, וכל פריט משמש לזוג אחד בלבד. כך ביטול אמיתי של פריט, כשבהזמנה יש פריט אחר מאותו דגם, לא נחשב בטעות להחלפה. פריטים ישנים שהועברו ממערכת קודמת לא מזווגים כשההגדרה פעילה. 0 או ריק = בלי הגבלת זמן (כל פריט פעיל מאותו דגם נחשב). פועל רק כשהמתג הראשי של החלפת מידה דולק.',
  size_edit_until_days_before_event: 'עד כמה ימים לפני האירוע מותר לשנות מידה ישירות בתוך הפריט גם אחרי 15 הדקות הראשונות. זה עובד רק כשהדגם נשאר אותו דגם, המידה החדשה באותה שורת מחיר, והפריט עוד לא נלקח. למשל 2 = אפשר לערוך עד יומיים לפני האירוע. 0 = אפשר לערוך עד יום האירוע. ריק = כבוי, ואחרי 15 הדקות הראשונות המידה ננעלת (צריך למחוק ולהוסיף פריט).',
  gap_size_price_rule: 'קובע איך מחשבים מחיר למידה שאין לה שורת מחיר משלה ונמצאת בין שני טווחים סמוכים (למשל מידות 21 עד 31, בין ילדה לאישה). "ללא חיוב (כמו היום)" = למידה כזאת אין מחיר. "לפי הזול משני הטווחים" = מחייבים לפי המחיר הזול מבין שני הטווחים הסמוכים. חל על חיוב פריט, על פריט שנמחק ועל החזר כספי. ריק = כמו "ללא חיוב".',
  ALLOWED_PAYMENT_METHODS: 'רשימת אמצעי תשלום מורשים (מופרדים בפסיק, למשל: מזומן,אשראי,העברה).',
  PAYMENT_APPROVAL_LEVEL: 'קובע איזו הרשאה נדרשת (הזנת קוד עובד וסיסמה) לפני סיום הזמנה עם "יציאה באישור מנהל" - כולל המקרה שסכום התשלום נשאר 0 (יציאה בלי גביית תשלום כלל) - וכן לפני כל תשלום שאינו אשראי שאינו מכסה את מלוא סכום ההזמנה. "כולם" = ללא הגבלה (ברירת המחדל, ההתנהגות הקודמת). "עובד" = כל עובד פעיל מזהה את עצמו בסיסמה. "מנהל" = מנהל סניף או מתכנת בלבד (roleId 1/2). "מנהל סניף ומעלה" = מנהל סניף, הנהלה ראשית או מתכנת (roleId 0/1/2). (במסך ההרשאות זה הפריט "אישור יציאה מהזמנה חדשה בלי תשלום מלא": ההגדרה קובעת אם החלונית מופיעה ואת ברירת המחדל של מי מאשר, ושורת הרשאה לפי מחלקה/עובד גוברת עליה.)',

  calendar_filtering: 'סינון תצוגת יומן לפי חודשים ומועדים עבריים.',
  inventory_skip_weekends: 'האם לדלג על ימי שישי-שבת בחישוב ימי מרווח ביטחון.',
  inventory_buffer_days: 'מספר ימים לפני ואחרי אירוע שבהם השמלה חסומה במלאי.',

  print_rental_box1: 'טקסט הערות שיופיע בתיבה העליונה בכרטיס השכרה מודפס.',
  print_rental_box2: 'טקסט הערות שיופיע בתיבה האמצעית בכרטיס השכרה מודפס.',
  print_rental_footer: 'טקסט תקנון וחתימה בתחתית כרטיס השכרה מודפס.',
  home_welcome_title: 'הכותרת הראשית שמופיעה בראש דף הבית של המערכת.',
  hide_custom_spacing: 'כשמופעל, ניתן לבחור ריווח ימים (ציפוף) מותאם בין השכרות בעת יצירה ועריכה של הזמנה, ומוצג גם בלוח התפוסה. כשכבוי, האפשרות מוסתרת לגמרי מכל התהליך - כולל בחישוב זמינות המלאי, שמתעלם מציפוף שהוגדר בעבר להזמנה.',
  enable_rental_extension: 'מאפשר להוסיף להזמנת חו"ל/חול יום השכרה נוסף (לפני הלקיחה או אחרי ההחזרה), בתוספת 50% מסך ההזמנה המחושבת אוטומטית.',
  nedarim_rinat_lev_url: 'URL סליקה ייעודי עבור רינת לב (בריק - משתמש בקוד מוסד הכללי).',
  hok_enabled: 'מאפשר הזנת פרטי הוראת קבע בכל הזמנה.',
  hok_auto_charge_enabled: 'אם הלקוח לא החזיר עד שעת היעד - חיוב אוטומטי (מחיר השכרה נוסף לכל שמלה).',
  hok_auto_charge_hour: 'שעת היעד ביום ההחזרה (לדוגמה 19:00).',
  hok_charge_amount: 'סכום קבוע לגביה (ריק = מחיר השכרה מקורי, 0 = ללא גביה כלל).',
  strict_mandatory_fields: 'חוסם דילוג גם באישור מנהל - חובה למלא שדות.',
  require_customer_email: 'חובה להזין מייל תקין לכל לקוח/הזמנה.',
  require_full_address: 'חובה עיר+רחוב+מספר בית.',
  require_marketing_consent: 'חובה לסמן "מאשר/ת קבלת דיוורים".',
  hide_marketing_consent_field: 'כשמופעל, תיבת "מאשר/ת קבלת דיוורים ועדכונים" לא מוצגת בכלל בטופסי לקוח (הזמנה חדשה, כרטיס לקוח, הרשמה עצמית בעמדת לקוח) ואין אכיפה שלה - גם אם require_marketing_consent דלוקה.',
  require_customer_id_number: 'חובה להזין תעודת זהות בעת יצירת לקוח חדש (טופס "לקוח חדש" ב-app/customers, וגם הוספת לקוח מהירה בתוך הזמנה). לא משפיע על עריכת לקוח קיים.',
  auto_email_on_order_create: 'מייל עם פרטי הזמנה + איסוף/החזרה נשלח אוטומטית ביצירה.',
  pickup_reminder_enabled: 'תזכורת אוטומטית יום לפני איסוף עם שעה וכתובת.',
  pickup_reminder_hour: 'שעת שליחת תזכורת האיסוף.',
  daily_manager_report_enabled: 'שולח כל יום מייל למנהל עם רשימת הזמנות.',
  daily_manager_report_email: 'לאן לשלוח את הדוח היומי (ריק = main_email).',
  daily_manager_report_hour: 'שעת שליחת הדוח היומי.',
  late_return_email_enabled: 'שולח מייל אוטומטי למאחרים.',
  late_return_email_text: 'נוסח ההודעה למאחרים.',
  late_return_threshold_days: 'מספר ימי איחור ממועד ההחזרה הצפוי שמעליו בר ההחזרה המהיר וכרטיס ההשכרה מציעים לסמן את הפריט כ"חזר לא תקין" במקום החזרה רגילה. משפיע גם על מייל האיחור האוטומטי (אם דלוק) ועל רשימת "הזמנות באיחור".',
  yemot_enabled: 'הפעלת חיבור לימות המשיח.',
  yemot_api_url: 'כתובת ה-Webhook/API של ימות המשיח.',
  yemot_api_token: 'טוקן סנכרון (נשמר מוצפן).',
  yemot_queue_view_enabled: 'הצגת תור מזמינים מימות.',
  yemot_import_customer_enabled: 'ייבוא פרטי לקוח מימות לכרטיס לקוח.',
  mailing_list_auto_sync: 'כל מייל חדש מתווסף לרשימת התפוצה.',
  mailing_list_provider: 'ספק דיוור (רב מסר/Smoove/Mailchimp - ריק=פנימי).',
  phone_order_marker_enabled: 'סימון הזמנה שהוזנה טלפונית + זיהוי סניף.',
  track_branch_on_order: 'שומר באיזה סניף בוצעה ההזמנה.',
  auto_print_on_order_create: 'כשמסיימים ליצור הזמנה חדשה (כפתור "סיום ויצירת ההזמנה"), פותח אוטומטית חלון הדפסת הזמנה. כבוי = ההתנהגות הקודמת (בלי הדפסה אוטומטית).',
  require_id_for_edit_cancel: 'עריכה/ביטול רק לאחר אימות תעודת זהות.',
  require_manager_code_for_item_changes: 'כשמופעל, ביטול או הוספה של פריט (שמלה) בהזמנה קיימת דורשים גם אימות קוד/סיסמת מנהל אמיתי (בנוסף לאימות ת״ז - לא במקומו). כבוי = ההתנהגות הקודמת: אימות ת״ז בלבד, ללא הרשאת מנהל. (מי נחשב מנהל מאשר נקבע בהרשאה "אישור ביטול או הוספת פריט בהזמנה קיימת" במסך ההרשאות; ברירת המחדל מנהל סניף.)',
  enable_deliveries: 'מפעיל את לשונית "משלוחים" בתפריט הניווט ואת אפשרות הוספת משלוח בכרטיס הזמנה (חדשה וקיימת). כבוי = כל פיצ׳ר המשלוחים מוסתר לגמרי.',
  delivery_days_before: 'כמה ימים לפני תאריך האירוע יוצא משלוח הלוך (ברירת מחדל: 1).',
  delivery_days_after: 'כמה ימים אחרי תאריך האירוע נאסף משלוח חזור (ברירת מחדל: 1).',
  delivery_price: 'מחיר משלוח אחיד - משמש כשאין מחיר ספציפי לעיר ב-delivery_price_by_city, או כשהטבלה ריקה.',
  delivery_price_by_city: 'JSON מחירים לפי עיר. דוגמה {"ירושלים":60}.',
  delivery_allow_address_override: 'מאפשר כתובת משלוח שונה מכתובת מגורים.',
  delivery_show_in_order: 'מציג תג משלוח הלוך/חזור בהזמנה.',
  courier_email: 'כתובת המייל שאליה נשלחים נתוני המשלוחים (§D) בלחיצה על "שליחה במייל" בכפתור "הדפסת משלוחים" בלשונית משלוחים.',
  courier_name: 'שם המשלוחן, לתצוגה בלבד (לא בשימוש עדיין בהדפסה/במייל).',
  rentals_sort_recent_first: 'ממיין השכרות מהאחרונים ביותר (אתמול למעלה).',
  enforce_strict_max_items: 'לא מאפשר חריגה מ-max_items_per_order גם באישור מנהל.',
  delivery_table_range_enabled: 'טבלת משלוחים לטווח שבוע/חודש + עבר.',
  delivery_one_day_before_option: 'משלוח יוצא יום לפני האירוע (במקום יומיים).',
  deliveries_select_by_event_date: 'כשמופעל, בלשונית "משלוחים" (מסך, תצוגת טווח, הדפסה למשלוחן, שליחה במייל למשלוחן והדפסת נתונים לשקית) התאריך שנבחר הוא תאריך האירוע: מוצגות ההזמנות-עם-משלוח שהאירוע שלהן ביום הזה, ולא לפי יום ההוצאה/החזרה. בכל שורה/כותרת ממשיכים לציין את יום היציאה (הלוך) ויום האיסוף (חזור) המחושבים לפי "ימי משלוח לפני/אחרי האירוע". כבוי (ברירת מחדל) = כמו היום: התאריך הוא יום ההוצאה/החזרה.',
  delivery_skip_weekends: 'כשמופעל, "ימי משלוח הלוך/חזור לפני/אחרי האירוע" נספרים בימי עסקים בלבד - יום שישי ושבת לא נספרים ולא נבחרים כיום הוצאה/איסוף. כבוי (ברירת מחדל) = ספירת ימים קלנדרית רגילה, כמו היום.',
  print_sort_deliveries_first: 'דפי הכנה ממוינים: משלוחים בנפרד ורגילות בנפרד.',
  print_mark_missing_dresses: 'מסמן שמלה חסרה ומציין "אמורה לחזור מחר ממשפחת...".',
  bulk_email_by_event_date: 'שליחת מייל לכל אירוע בתאריך/טווח + מעקב אישורים.',
  auto_charge_damaged_return: 'גביה אוטומטית בהו״ק על "הוחזרה שמלה פגומה".',
  shift_handover_notes: 'מקום להודעות בין משמרת למשמרת.',
  management_messages: 'מקום להודעות להנהלה.',
  barcode_invalid_list: 'ברקוד לא תקין → רשימה להנהלה + סימון "טופל".',
  allow_edit_partially_rented: 'עריכת הזמנה מושכרת חלקית (מידה/משלוח) עם ת״ז.',
  split_dress_enabled: 'דגם כסט 2 ברקודים (חולצה+חצאית).',
  notify_on_new_message_at_login: 'התראה בכניסה אם יש הודעה שלא טופלה.',
  laundress_return_check_on_exit: 'ביציאת כובסת - מקפיץ משפחות שלא החזירו.',
  manual_barcode_double_entry: 'הקלדה ידנית כפולה + חתימת "בידי עכשיו".',
  manual_barcode_daily_report: 'דוח יומי למנהלת על ברקודים ידניים.',
  kiosk_customer_self_service: 'לקוח יכול לרשום פרטים ולחפש דגם לבד (נעילת מסך).',
  kiosk_allow_self_order: 'לקוח יכול להזמין לבד באתר ללא הגעה.',
  branches_enabled: 'הפעלת סניפים (בוצעה בנוה יעקב / איסוף בבית שמש).',
  branch_list: 'רשימת סניפים מופרדת בפסיק.',
  premium_pricing_enabled: 'הפעלת קטגוריית מחיר פרימיום.',
  premium_categories: 'קטגוריות פרימיום (מופרד בפסיק).',
  show_not_taken_orders: 'הזמנות שלא נלקחו/חלקית → קטגוריה נפרדת.',
  hide_taken_orders_from_orders_list: 'כאשר מופעל, הזמנה שכל הפריטים בה כבר נלקחו (גם אם חלקם/כולם כבר הוחזרו) לא תופיע יותר בטאבי "בקרוב"/"הכל" ב-/orders - היא שייכת מעכשיו לטאבי ההשכרות/החזרות ב-/rentals. הזמנה "הושכר חלקי" (יש גם פריט שטרם נלקח) נשארת ב-/orders. ברירת מחדל כבוי - מציג הכל, כמו היום.',
  cancellation_extra_columns: 'עמודות ביטול ילדות/נשים בדוח.',
  agent_digest_email_enabled: 'שולח מייל עם רשימת ה-PR-ים (ענפי תיקון) שהסוכן האוטומטי פתח ועדיין לא מוזגו - משני הגמחים יחד, כי מדובר בריפו קוד משותף. פועל רק בשעות המוגדרות למטה, ולא בשבתות/חגים. הגדרה זו קיימת בכוונה רק בגמח הראשי - אין להפעיל את אותה הגדרה גם בנווה יעקב, זה ישלח מייל כפול.',
  agent_digest_email_hours: 'אילו מתוך 2 שעות השליחה הקבועות (17:00 ו-00:00) פעילות כרגע - רשימה מופרדת בפסיק, למשל "17:00,00:00" או רק "17:00". השעה בפועל עשויה לזוז עד חצי שעה בין קיץ לחורף (מגבלת cron קבוע). הוספת שעה שלישית דורשת שינוי קוד (cron חדש), לא רק כאן.',
};

// סדר תצוגה של הגדרות בתוך כל טאב, מקובץ לפי נושא (לא לפי סדר יצירה אקראי ב-DB).
// מפתח שלא מופיע ברשימה של הטאב שלו מוצג בסוף הטאב, לפי הסדר שהגיע מה-DB -
// כך שהוספת הגדרה חדשה בעתיד לא "נעלמת", היא רק לא מקובצת עד שמוסיפים אותה כאן.
export const SETTINGS_ORDER = {
  'אוטומציה': [
    'mailing_list_auto_sync', 'mailing_list_provider',
    'auto_email_on_order_create',
    'late_return_email_enabled', 'late_return_email_text', 'late_return_threshold_days',
    'pickup_reminder_enabled', 'pickup_reminder_hour',
    'daily_manager_report_enabled', 'daily_manager_report_hour', 'daily_manager_report_email',
    'bulk_email_by_event_date',
    'manual_barcode_daily_report',
    'agent_digest_email_enabled', 'agent_digest_email_hours',
  ],
  'בינה מלאכותית': ['hide_ai_features', 'enable_ai_specific_employees', 'ai_screen_recording_enabled'],
  'ברקודים': ['manual_barcode_double_entry', 'barcode_invalid_list'],
  'הדפסה': [
    'enable_batch_print_prep',
    'standard_return_hour', 'rental_belt_notice',
    'print_rental_box1', 'print_rental_box2', 'print_rental_footer',
    'print_sort_deliveries_first', 'print_mark_missing_dresses',
  ],
  'הודעות': ['shift_handover_notes', 'management_messages', 'notify_on_new_message_at_login', 'laundress_return_check_on_exit'],
  'הוראת קבע': ['hok_enabled', 'hok_auto_charge_enabled', 'hok_auto_charge_hour', 'hok_charge_amount', 'auto_charge_damaged_return'],
  'הזמנות': [
    'require_customer_email', 'require_full_address', 'require_marketing_consent', 'hide_marketing_consent_field', 'require_customer_id_number',
    'mandatory_fields', 'strict_mandatory_fields', 'require_id_for_edit_cancel',
    'max_items_per_order', 'enforce_strict_max_items', 'BUFFER_DAYS', 'hide_custom_spacing',
    'require_manager_code_for_item_changes', 'allow_edit_partially_rented',
    'draft_orders_show_as_deleted', 'enable_local_order_drafts', 'enable_order_edit_summary_confirm', 'auto_print_on_order_create', 'phone_order_marker_enabled',
    'enable_alterations', 'enable_rental_extension',
  ],
  'יומן': ['inventory_buffer_days', 'inventory_skip_weekends'],
  'כללי': [
    'gmach_name', 'gmach_address', 'gmach_phone', 'main_email',
    'require_login',
    'item_locations', 'barcodePrefixLength', 'inventory_include_warehouse', 'allow_renting_reserve_items',
  ],
  'לא בשימוש': [
    // קטלוג/דגמים
    'has_variations', 'has_underskirts', 'dress_size_min', 'dress_size_max', 'dress_size_even_only',
    'items_name_singular', 'items_name_plural', 'barcode_length',
    // הזמנות
    'allow_date_change', 'allow_free_exchange', 'cancel_order_permission', 'reserve_permission', 'max_order_days_ahead',
    // תשלומים/החזרים
    'refund_per_item', 'REFUND_DAYS', 'registration_fee',
    // שונות
    'calendar_filtering', 'gmach_subtitle',
    // 2026-09-22: "מי" עברה לקטלוג ההרשאות (/admin/permissions) - ר' lib/permissionsMetadata.js.
    // ההגדרות עצמן לא נקראות יותר בשום קוד; נשמרו לתיעוד היסטורי בלבד.
    'restrict_dress_catalog_to_head_management', 'restrict_refunds_to_head_management',
    'restrict_board_to_managers', 'allow_shift_lead_reserve_rental',
  ],
  'מחירון': ['premium_pricing_enabled', 'premium_categories'],
  'מיילים': ['email_link_a', 'email_link_b', 'email_routing_strategy'],
  'מלאי': ['enforce_rental_barcode_match', 'require_approval_for_early_return'],
  'מערכת': ['agent_fix_loop_enabled', 'agent_fix_loop_last_activity'],
  'משלוחים': [
    'enable_deliveries',
    'delivery_days_before', 'delivery_days_after', 'delivery_skip_weekends', 'delivery_price', 'delivery_price_by_city',
    'delivery_show_in_order', 'delivery_allow_address_override',
    'delivery_table_range_enabled', 'delivery_one_day_before_option', 'deliveries_select_by_event_date',
    'courier_name', 'courier_email',
  ],
  'סניפים': ['branches_enabled', 'branch_list', 'track_branch_on_order'],
  'סנכרון': ['yemot_enabled', 'yemot_api_url', 'yemot_api_token', 'yemot_queue_view_enabled', 'yemot_import_customer_enabled'],
  'תצוגה': [
    'show_not_taken_orders', 'hide_taken_orders_from_orders_list', 'cancellation_extra_columns', 'rentals_sort_recent_first',
    'hide_dress_images', 'useModelNames', 'useFileNamesForImages',
    'hide_gregorian_calendar', 'hide_internal_messaging',
    'hide_error_reporting', 'error_report_handled_at_bottom', 'error_report_human_button_enabled',
    'show_employee_profile_image',
    'kiosk_customer_self_service', 'kiosk_allow_self_order', 'enable_unreturned_orders_popup',
  ],
  'תשלומים': [
    'nedarim_plus_enabled', 'nedarim_plus_terminal', 'nedarim_plus_token', 'nedarim_rinat_lev_url',
    'ALLOWED_PAYMENT_METHODS', 'PAYMENT_APPROVAL_LEVEL', 'allow_additional_payment_on_order',
    'REFUND_PERCENTAGE', 'REFUND_DAYS_FROM_ORDER', 'NO_REFUND_DAYS_BEFORE_EVENT', 'REFUND_REPAIRS', 'CANCELLATION_CREDIT_MINUTES',
    'instant_undo_minutes', 'same_model_swap_no_fee', 'swap_min_days_before_event', 'swap_same_category_only', 'refund_tiers_at_deletion_time',
    'swap_pairing_window_minutes', 'size_edit_until_days_before_event', 'gap_size_price_rule', 'ENABLE_SET_DISCOUNTS',
  ],
};

// טאבים שמוצגים רק ב-/admin/site-settings (mode="developer"), לא ב-/admin/settings
// הרגיל - ר' filterCategoriesForMode ב-SettingsClient.js. משמש גם לבניית קישורי
// "פתח בעמוד ההגדרות המלא" (SettingQuickPanel.js) כדי שיצביעו לעמוד הנכון.
export const SETTINGS_DEVELOPER_CATEGORIES = ['מסד נתונים', 'מערכת', 'מיילים'];

// מפתחות המוצגים כמתג (toggle) גם כשאין type='boolean' מפורש בשורת ה-DB עצמה.
export const SETTINGS_BOOLEAN_KEYS = [
  'require_login', 'enable_alterations', 'allow_alterations', 'allow_free_exchange',
  'allow_date_change', 'has_variations', 'has_underskirts', 'useModelNames',
  'useFileNamesForImages', 'hide_ai_features', 'enable_ai_specific_employees',
  'hide_dress_images', 'hide_gregorian_calendar', 'hide_internal_messaging',
  'hide_error_reporting', 'refund_per_item', 'registration_fee', 'nedarim_plus_enabled', 'ENABLE_SET_DISCOUNTS',
  'REFUND_REPAIRS', 'inventory_include_warehouse', 'allow_renting_reserve_items', 'allow_shift_lead_reserve_rental', 'enforce_rental_barcode_match', 'require_approval_for_early_return', 'inventory_skip_weekends',
  'calendar_filtering',
  // 38 בקשות - בוליאנים חדשים
  'hide_custom_spacing', 'hok_enabled', 'hok_auto_charge_enabled', 'strict_mandatory_fields',
  'require_customer_email', 'require_full_address', 'require_marketing_consent', 'require_customer_id_number', 'auto_email_on_order_create',
  'pickup_reminder_enabled', 'daily_manager_report_enabled', 'late_return_email_enabled', 'yemot_enabled',
  'yemot_queue_view_enabled', 'yemot_import_customer_enabled', 'mailing_list_auto_sync', 'phone_order_marker_enabled',
  'track_branch_on_order', 'require_id_for_edit_cancel', 'require_manager_code_for_item_changes', 'delivery_allow_address_override', 'delivery_show_in_order',
  'rentals_sort_recent_first', 'enforce_strict_max_items', 'delivery_table_range_enabled', 'delivery_one_day_before_option',
  'print_sort_deliveries_first', 'print_mark_missing_dresses', 'bulk_email_by_event_date', 'auto_charge_damaged_return',
  'shift_handover_notes', 'management_messages', 'barcode_invalid_list', 'allow_edit_partially_rented',
  'split_dress_enabled', 'notify_on_new_message_at_login', 'laundress_return_check_on_exit', 'manual_barcode_double_entry',
  'manual_barcode_daily_report', 'kiosk_customer_self_service', 'kiosk_allow_self_order', 'branches_enabled',
  'premium_pricing_enabled', 'show_not_taken_orders', 'cancellation_extra_columns', 'enable_rental_extension',
  // פרוטוקול תיקון דיווחי שגיאות - הגדרות עם שחזור
  'restrict_dress_catalog_to_head_management', 'restrict_refunds_to_head_management',
  'show_employee_profile_image', 'error_report_handled_at_bottom', 'error_report_human_button_enabled', 'auto_print_on_order_create',
  'allow_additional_payment_on_order', 'hide_taken_orders_from_orders_list',
  'agent_digest_email_enabled', 'enable_local_order_drafts', 'enable_order_edit_summary_confirm',
  'enable_unreturned_orders_popup',
  'enable_batch_print_prep', 'same_model_swap_no_fee', 'swap_same_category_only', 'refund_tiers_at_deletion_time', 'ai_screen_recording_enabled',
  'deliveries_select_by_event_date', 'hide_marketing_consent_field', 'delivery_skip_weekends'
];

export const SETTINGS_NUMBER_KEYS = [
  'max_items_per_order', 'barcodePrefixLength', 'BUFFER_DAYS',
  'barcode_length', 'REFUND_PERCENTAGE', 'REFUND_DAYS',
  'NO_REFUND_DAYS_BEFORE_EVENT', 'REFUND_DAYS_FROM_ORDER',
  'full_refund_days', 'inventory_buffer_days', 'registration_fee',
  'CANCELLATION_CREDIT_MINUTES', 'hok_charge_amount', 'delivery_price', 'late_return_threshold_days',
  'instant_undo_minutes', 'swap_min_days_before_event', 'swap_pairing_window_minutes', 'size_edit_until_days_before_event'
];

// מפתחות שמוצגים כ-<select> עם רשימת אפשרויות קבועה (לא טקסט חופשי) - ר' ה-JSX
// המקביל ב-SettingsClient.js (isSelectSetting). משמש גם את SettingQuickPanel.js
// כדי לדעת אילו אפשרויות להציג בפאנל המהיר.
export const SETTINGS_SELECT_OPTIONS = {
  PAYMENT_APPROVAL_LEVEL: [
    { value: 'כולם', label: 'כולם (ללא הגבלה - ברירת מחדל)' },
    { value: 'עובד', label: 'עובד (זיהוי עצמי בסיסמה)' },
    { value: 'מנהל', label: 'מנהל סניף / מתכנת' },
    { value: 'מנהל סניף ומעלה', label: 'מנהל סניף ומעלה (כולל הנהלה ראשית)' },
  ],
  gap_size_price_rule: [
    { value: 'none', label: 'ללא חיוב (כמו היום)' },
    { value: 'cheaper', label: 'לפי הזול משני הטווחים' },
  ],
  email_routing_strategy: [
    { value: 'all_a', label: 'שלח הכל מקישור א\' (ראשי)' },
    { value: 'all_b', label: 'שלח הכל מקישור ב\' (משני)' },
    { value: 'bugs_b_rest_a', label: 'דיווחי שגיאות מב\', השאר מא\'' },
  ],
};

const MANDATORY_FIELDS_KEY = 'mandatory_fields';
const TIMESTAMP_KEYS = ['agent_fix_loop_last_activity'];

function isDepartmentKey(key) {
  return key.toLowerCase().includes('permission') ||
    key.toLowerCase().includes('department') ||
    key === 'cancel_order_permission' ||
    key === 'reserve_permission' ||
    key === 'enable_ai_specific_employees';
}

// מסווג הגדרה יחידה לסוג שדה, באותו סדר-עדיפויות בדיוק כמו שרשרת ה-ternary
// ב-SettingsClient.js (activeSettings.map). כל שינוי כאן צריך שינוי מקביל שם -
// שתי המקומות מכוונים במכוון לאותה תוצאה (אחד בונה JSX מלא לעמוד ההגדרות,
// השני בונה קטלוג JSON ל-AI ופאנל עריכה מהיר), ולא כדאי לאחד אותם ממש כי
// SettingsClient.js כולל גם רכיבי בחירה ייעודיים (CustomerFieldsCheckboxPicker
// וכד') שאין להם מקבילה בפאנל המהיר.
export function classifySettingField(key, rawType, rawValue) {
  const isBoolean = rawType === 'boolean' || rawType === 'checkbox' || rawValue === 'true' || rawValue === 'false' || SETTINGS_BOOLEAN_KEYS.includes(key);
  if (isBoolean) return 'boolean';
  if (key === MANDATORY_FIELDS_KEY) return 'mandatoryFields';
  const isSelect = rawType === 'select' || Object.prototype.hasOwnProperty.call(SETTINGS_SELECT_OPTIONS, key);
  if (isSelect) return 'select';
  if (isDepartmentKey(key)) return 'department';
  if (SECRET_SETTING_KEYS.includes(key)) return 'secret';
  if (TIMESTAMP_KEYS.includes(key)) return 'timestamp';
  const isNumber = rawType === 'number' || SETTINGS_NUMBER_KEYS.includes(key);
  if (isNumber) return 'number';
  const lower = key.toLowerCase();
  const isMultiline = lower.includes('print') || lower.includes('box') || lower.includes('footer') ||
    lower.includes('locations') || lower.includes('text') ||
    String(rawValue || '').includes('\n') || String(rawValue || '').length > 40;
  if (isMultiline) return 'multiline';
  return 'text';
}

// מפתחות "hide_*" שהכיתוב שלהם במסך הוא ניסוח חיובי הפוך מהשם הטכני (לדוג'
// hide_custom_spacing='true' [=מוסתר] מוצג עם הכיתוב "אפשר ציפוף ימים מיוחד" ולכן
// צריך להיראות "כבוי") - אלה היחידים שבאמת צריכים היפוך תצוגה. חשוב: לא כל מפתח
// hide_* שייך לרשימה הזו - hide_taken_orders_from_orders_list למשל מוצג עם כיתוב
// ישיר "הסתר הזמנות..." שכבר תואם לערך הגולמי, ואסור להפוך אותו (זו הייתה תקלה
// אמיתית - המתג הראה "פעיל" כשההגדרה בפועל הייתה כבויה). רשימה מפורשת, לא
// key.startsWith('hide_') גורף, כדי לא לתפוס בטעות מפתחות hide_* עתידיים/קיימים
// שאין להם את ההיפוך הזה.
export const INVERTED_DISPLAY_KEYS = [
  'hide_custom_spacing', 'hide_ai_features', 'hide_dress_images',
  'hide_gregorian_calendar', 'hide_internal_messaging', 'hide_error_reporting',
];

// הפונקציה סימטרית (NOT הוא ההופכי של עצמו) - אותה קריאה בדיוק ממירה גם raw→display
// (לקריאה, ב-buildSettingsGuide) וגם display→raw (לשמירה, ב-SettingQuickPanel.js).
export function toDisplayValue(key, value) {
  if (INVERTED_DISPLAY_KEYS.includes(key) && (value === 'true' || value === 'false')) {
    return value === 'true' ? 'false' : 'true';
  }
  return value;
}

export function getSettingDisplayName(key, dbName) {
  let displayName = SETTINGS_HEBREW_NAMES[key] || dbName;
  if (!displayName || displayName === key || /^[a-zA-Z0-9_\-\s]+$/.test(displayName)) {
    displayName = SETTINGS_HEBREW_NAMES[key] || key;
  }
  return displayName;
}

export function getSettingNotes(key, dbNotes) {
  let notes = SETTINGS_HEBREW_NOTES[key] || dbNotes || '';
  if (!notes || /^[a-zA-Z0-9_\-\s]+$/.test(notes)) {
    notes = SETTINGS_HEBREW_NOTES[key] || '';
  }
  return notes;
}

// עמוד ה-UI שבו הגדרה מסוימת מוצגת בפועל - /admin/settings (רגיל) או
// /admin/site-settings (מתכנת בלבד) - ר' SETTINGS_DEVELOPER_CATEGORIES למעלה.
export function getSettingsPagePath(category) {
  return SETTINGS_DEVELOPER_CATEGORIES.includes(category) ? '/admin/site-settings' : '/admin/settings';
}

// קטלוג ההגדרות המלא, בשביל שני צרכנים: פאנל העריכה המהיר (SettingQuickPanel.js,
// דרך app/api/settings/guide) והסוכן/עוזר ה-AI (app/api/ai/route.js, ACTION:
// SETTINGS_GUIDE). מקבל את שורות ה-DB הגולמיות (כמו שמגיעות מ-getAllCachedSettings)
// ומחזיר מערך מועשר - שם/הערה בעברית, קטגוריה, "מיקום" קריא, סוג שדה, ואפשרויות
// select כשרלוונטי. ערכי סודות (SECRET_SETTING_KEYS) תמיד ממוסכים - אותו כלל
// בדיוק כמו GET /api/settings (app/api/settings/route.js) - קטלוג ה-AI לעולם לא
// חושף טוקן/מפתח אמיתי, גם לא למנהל.
const CATALOG_EXCLUDED_KEYS = ['BRAND_LOGO', 'backup_requested_at', 'NEDARIM_MOSAD'];

export function buildSettingsGuide(rows) {
  return rows
    .filter(row => row.key && !CATALOG_EXCLUDED_KEYS.includes(row.key))
    .map(row => {
      const isSecret = SECRET_SETTING_KEYS.includes(row.key);
      const fieldType = classifySettingField(row.key, row.type, row.value);
      const name = getSettingDisplayName(row.key, row.name);
      const category = row.category || 'כללי';
      const entry = {
        key: row.key,
        name,
        category,
        location: `הגדרות מערכת ← ${category}`,
        pagePath: getSettingsPagePath(category),
        description: getSettingNotes(row.key, row.notes) || null,
        fieldType,
        currentValue: isSecret ? (row.value ? SECRET_MASK : '') : (toDisplayValue(row.key, row.value) ?? ''),
      };
      if (fieldType === 'select' && SETTINGS_SELECT_OPTIONS[row.key]) {
        entry.options = SETTINGS_SELECT_OPTIONS[row.key];
      }
      return entry;
    })
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category, 'he');
      const order = SETTINGS_ORDER[a.category] || [];
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    });
}
