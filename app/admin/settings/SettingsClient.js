'use client';

import React, { useState, useEffect, useRef } from 'react';
import FullEmailListModal from '@/components/FullEmailListModal';
import NeonUsageCard from './NeonUsageCard';
import WebBackupModeToggle from './WebBackupModeToggle';
import { cacheNamespace, invalidateSettings } from '@/app/lib/pageCache';
import { NUMBER_FIELD_LIMITS, validateNumericSetting } from '@/app/lib/settingsValidation';
import { SECRET_SETTING_KEYS, SECRET_MASK, SECRET_SETTING_LINKS } from '@/app/lib/secretSettingKeys';

const CATEGORY_ICONS = {
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

const HEBREW_NAMES = {
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
  main_email: 'כתובת אימייל ראשית',
  // --- 38 בקשות: תוספות ---
  hide_custom_spacing: 'הסתר ציפוף ימים מיוחד',
  nedarim_rinat_lev_url: 'קישור נדרים פלוס - רינת לב',
  hok_enabled: 'הפעל הוראת קבע (הו״ק)',
  hok_auto_charge_enabled: 'גביה אוטומטית למאחרים',
  hok_auto_charge_hour: 'שעת גביה אוטומטית',
  hok_charge_amount: 'סכום גביה נוספת למאחר (לשמלה)',
  strict_mandatory_fields: 'אכיפה קשיחה ללא אישור מנהל',
  require_customer_email: 'חייב מייל לקוח',
  require_full_address: 'חייב כתובת מלאה',
  require_marketing_consent: 'חייב אישור דיוור',
  require_customer_id_number: 'חייב ת"ז ביצירת לקוח',
  auto_email_on_order_create: 'מייל אוטומטי בעת יצירת הזמנה',
  pickup_reminder_enabled: 'תזכורת מייל יום לפני איסוף',
  pickup_reminder_hour: 'שעת תזכורת איסוף',
  daily_manager_report_enabled: 'דוח יומי למנהל',
  daily_manager_report_email: 'מייל מנהל לדוח יומי',
  daily_manager_report_hour: 'שעת דוח יומי',
  late_return_email_enabled: 'מייל אוטומטי למאחרים',
  late_return_email_text: 'נוסח מייל איחור',
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
  delivery_price_by_city: 'מחיר משלוח לפי עיר (JSON)',
  delivery_allow_address_override: 'אפשר כתובת משלוח שונה',
  delivery_show_in_order: 'הצג משלוח בהזמנה',
  rentals_sort_recent_first: 'השכרות - האחרונים למעלה',
  enforce_strict_max_items: 'אכיפה קשיחה מקסימום ללא חריגה',
  delivery_table_range_enabled: 'טבלת משלוחים לטווח',
  delivery_one_day_before_option: 'אפשר משלוח יום לפני',
  print_sort_deliveries_first: 'הדפסה - מיון משלוחים בנפרד',
  print_mark_missing_dresses: 'הדפסה - סמן שמלה חסרה',
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
  cancellation_extra_columns: 'עמודות ביטול נוספות',
  enable_rental_extension: 'הפעל יום השכרה נוסף',

  mandatory_fields: 'שדות חובה במילוי פרטי הזמנה',
  draft_orders_show_as_deleted: 'הצג הזמנות טיוטה כמחוקות',
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
  enable_ai_specific_employees: 'תצוגת AI לעובדים מורשים בלבד',
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
  CANCELLATION_CREDIT_MINUTES: 'דקות לניצול זיכוי דמי ביטול על פריט חלופי',
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
  show_employee_profile_image: 'הצגת תמונת פרופיל בכרטיס עובד',
  error_report_handled_at_bottom: 'פניות מטופלות בתחתית הרשימה',
  standard_return_hour: 'שעת החזרה סטנדרטית בדוח השכרה',
  rental_belt_notice: 'שורת הערת חגורות בדוח השכרה'
};

const HEBREW_NOTES = {
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
  inventory_include_warehouse: 'הצג וספור במלאי גם פריטים הנמצאים במחסן או ברזרבה.',
  allow_renting_reserve_items: 'כשמופעל, פריטים שמסומנים "רזרבה" נחשבים זמינים להשכרה כמו כל פריט אחר - הן בחישובי הזמינות, הן בבחירת פריט להזמנה, והן בסריקת ברקוד (לא נדרש עוד אישור מנהל לכל השכרה). ברירת המחדל כבויה (התנהגות קיימת - פריטי רזרבה חסומים). נפרד בכוונה מ"ספירת מלאי מחסן" - רזרבה ומחסן הם שני מצבים שונים.',
  main_email: 'כתובת האימייל הראשית של הגמ"ח ליצירת קשר והודעות.',

  mandatory_fields: 'סמן בתיבת הבחירה (צ\'קבוקס) את השדות מתוך פרטי לקוח שיהיו חובה בעת מילוי הזמנה.',
  draft_orders_show_as_deleted: 'כשמופעל, הזמנות טיוטה שנשמרו אוטומטית בזמן מילוי הזמנה חדשה ולא הושלמו מוצגות בסטטוס ובסינון "מחוק" יחד עם שאר ההזמנות המחוקות, במקום להופיע בטאב "טיוטות" נפרד ברשימת ההזמנות.',
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
  enable_ai_specific_employees: 'אם מופעל, גישה ל-AI תינתן רק לעובדים שצוינו במפורש.',
  hide_dress_images: 'מסתיר תמונות דגמים במסכי הניהול ובכרטיסי הדגמים.',
  hide_gregorian_calendar: 'הסתרת תאריכים לועזיים והתמקדות בלוח העברי.',
  hide_internal_messaging: 'הסתרה או הפעלה של פעמון ההתראות והודעות בין עובדים.',
  hide_error_reporting: 'הסתרה או הפעלה של אפשרות דיווח שגיאות מהמערכת (כפתור גלגל הצלה).',

  restrict_dress_catalog_to_head_management: 'כשמופעל, קטלוג הדגמים נגיש לצפייה רק להנהלה ראשית/מתכנת. יצירה/עריכה/מחיקה של דגם מוגבלות להנהלה ראשית תמיד, גם כשההגדרה כבויה.',
  restrict_refunds_to_head_management: 'כשמופעל, עמוד זיכויים וחובות נגיש רק להנהלה ראשית/מתכנת ולא למנהל סניף רגיל.',
  show_employee_profile_image: 'הצגת אזור העלאת/תצוגת תמונת פרופיל בכרטיס העובד (הפרופיל האישי וכרטיס העובד המנהלי). כבוי = האזור מוסתר לגמרי.',
  error_report_handled_at_bottom: 'פניות שסומנו "טופל" ברשימת הפניות הפתוחות יורדות לתחתית הרשימה, כדי שפניות חדשות יבלטו למעלה.',
  standard_return_hour: 'שעת ההחזרה המוצגת בשורת "פרטי החזרה" בדוח ההשכרה המודפס (פורמט HH:MM).',
  rental_belt_notice: 'שורה נוספת שתופיע מתחת ל"פרטי החזרה" בדוח ההשכרה המודפס (למשל הערה על החזרת חגורות). ריק = לא מוצגת.',

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
  CANCELLATION_CREDIT_MINUTES: 'מספר הדקות לאחר ביטול פריט שבהן דמי הביטול ניתנים לניצול כזיכוי על פריט אחר שנוסף לאותה הזמנה. אם ההזמנה עדיין נערכת ונשמרת רק אחרי שהזמן הזה חלף, הזיכוי עדיין תקף - כי הזמן נספר החל משמירת הביטול בפועל.',
  ALLOWED_PAYMENT_METHODS: 'רשימת אמצעי תשלום מורשים (מופרדים בפסיק, למשל: מזומן,אשראי,העברה).',
  PAYMENT_APPROVAL_LEVEL: 'קובע איזו הרשאה נדרשת (הזנת קוד עובד וסיסמה) לפני סיום הזמנה עם "יציאה באישור מנהל" - כולל המקרה שסכום התשלום נשאר 0 (יציאה בלי גביית תשלום כלל) - וכן לפני כל תשלום שאינו אשראי שאינו מכסה את מלוא סכום ההזמנה. "כולם" = ללא הגבלה (ברירת המחדל, ההתנהגות הקודמת). "עובד" = כל עובד פעיל מזהה את עצמו בסיסמה. "מנהל" = מנהל סניף או מתכנת בלבד (roleId 1/2). "מנהל סניף ומעלה" = מנהל סניף, הנהלה ראשית או מתכנת (roleId 0/1/2).',

  calendar_filtering: 'סינון תצוגת יומן לפי חודשים ומועדים עבריים.',
  inventory_skip_weekends: 'האם לדלג על ימי שישי-שבת בחישוב ימי מרווח ביטחון.',
  inventory_buffer_days: 'מספר ימים לפני ואחרי אירוע שבהם השמלה חסומה במלאי.',

  print_rental_box1: 'טקסט הערות שיופיע בתיבה העליונה בכרטיס השכרה מודפס.',
  print_rental_box2: 'טקסט הערות שיופיע בתיבה האמצעית בכרטיס השכרה מודפס.',
  print_rental_footer: 'טקסט תקנון וחתימה בתחתית כרטיס השכרה מודפס.',
  home_welcome_title: 'הכותרת הראשית שמופיעה בראש דף הבית של המערכת.',
  hide_custom_spacing: 'כאשר מופעל, אפשרות ציפוף ימים מיוחד מוסתרת בכל התהליך (יצירה/עריכה/תפוסה). ברירת מחדל מופעל ללקוח זה.',
  enable_rental_extension: 'מאפשר להוסיף להזמנת חו"ל/חול יום השכרה נוסף (לפני הלקיחה או אחרי ההחזרה), בתוספת 50% מסך ההזמנה המחושבת אוטומטית.',
  nedarim_rinat_lev_url: 'URL סליקה ייעודי עבור רינת לב (בריק - משתמש בקוד מוסד הכללי).',
  hok_enabled: 'מאפשר הזנת פרטי הוראת קבע בכל הזמנה.',
  hok_auto_charge_enabled: 'אם הלקוח לא החזיר עד שעת היעד - חיוב אוטומטי (מחיר השכרה נוסף לכל שמלה).',
  hok_auto_charge_hour: 'שעת היעד ביום ההחזרה (לדוגמה 19:00).',
  hok_charge_amount: 'סכום קבוע לגביה (ריק = מחיר השכרה מקורי).',
  strict_mandatory_fields: 'חוסם דילוג גם באישור מנהל - חובה למלא שדות.',
  require_customer_email: 'חובה להזין מייל תקין לכל לקוח/הזמנה.',
  require_full_address: 'חובה עיר+רחוב+מספר בית.',
  require_marketing_consent: 'חובה לסמן "מאשר/ת קבלת דיוורים".',
  require_customer_id_number: 'חובה להזין תעודת זהות בעת יצירת לקוח חדש (טופס "לקוח חדש" ב-app/customers, וגם הוספת לקוח מהירה בתוך הזמנה). לא משפיע על עריכת לקוח קיים.',
  auto_email_on_order_create: 'מייל עם פרטי הזמנה + איסוף/החזרה נשלח אוטומטית ביצירה.',
  pickup_reminder_enabled: 'תזכורת אוטומטית יום לפני איסוף עם שעה וכתובת.',
  pickup_reminder_hour: 'שעת שליחת תזכורת האיסוף.',
  daily_manager_report_enabled: 'שולח כל יום מייל למנהל עם רשימת הזמנות.',
  daily_manager_report_email: 'לאן לשלוח את הדוח היומי (ריק = main_email).',
  daily_manager_report_hour: 'שעת שליחת הדוח היומי.',
  late_return_email_enabled: 'שולח מייל אוטומטי למאחרים.',
  late_return_email_text: 'נוסח ההודעה למאחרים.',
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
  require_manager_code_for_item_changes: 'כשמופעל, ביטול או הוספה של פריט (שמלה) בהזמנה קיימת דורשים גם אימות קוד/סיסמת מנהל אמיתי (בנוסף לאימות ת״ז - לא במקומו). כבוי = ההתנהגות הקודמת: אימות ת״ז בלבד, ללא הרשאת מנהל.',
  delivery_price_by_city: 'JSON מחירים לפי עיר. דוגמה {"ירושלים":60}.',
  delivery_allow_address_override: 'מאפשר כתובת משלוח שונה מכתובת מגורים.',
  delivery_show_in_order: 'מציג תג משלוח הלוך/חזור בהזמנה.',
  rentals_sort_recent_first: 'ממיין השכרות מהאחרונים ביותר (אתמול למעלה).',
  enforce_strict_max_items: 'לא מאפשר חריגה מ-max_items_per_order גם באישור מנהל.',
  delivery_table_range_enabled: 'טבלת משלוחים לטווח שבוע/חודש + עבר.',
  delivery_one_day_before_option: 'משלוח יוצא יום לפני האירוע (במקום יומיים).',
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
  cancellation_extra_columns: 'עמודות ביטול ילדות/נשים בדוח.',
};

const CUSTOMER_FIELDS = [
  { key: 'firstName', name: 'שם פרטי', alias: 'שם_פרטי' },
  { key: 'lastName', name: 'שם משפחה', alias: 'שם_משפחה' },
  { key: 'phone1', name: 'טלפון ראשי (נייד)', alias: 'טלפון_1' },
  { key: 'phone2', name: 'טלפון נוסף', alias: 'טלפון_2' },
  { key: 'city', name: 'עיר', alias: 'עיר' },
  { key: 'street', name: 'רחוב', alias: 'רחוב' },
  { key: 'houseNum', name: 'מספר בית', alias: 'מספר_בית' },
  { key: 'email', name: 'אימייל', alias: 'אימייל' },
  { key: 'notes', name: 'הערות לקוח', alias: 'הערות' },
  { key: 'officeNotes', name: 'נתוני משרד', alias: 'נתוני_משרד' },
  { key: 'bankName', name: 'שם בנק (לזיכוי)', alias: 'שם_בנק' },
  { key: 'bankBranch', name: 'סניף בנק', alias: 'סניף' },
  { key: 'bankAccount', name: 'חשבון בנק', alias: 'חשבון' }
];

function CustomerFieldsCheckboxPicker({ value, onChange, elementName }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const rawItems = (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const isSelected = (field) => {
    return rawItems.some(item =>
      item.toLowerCase() === field.key.toLowerCase() ||
      item === field.name ||
      item === field.alias
    );
  };

  const toggleField = (field) => {
    const selected = isSelected(field);
    let nextList;
    if (selected) {
      nextList = rawItems.filter(item =>
        item.toLowerCase() !== field.key.toLowerCase() &&
        item !== field.name &&
        item !== field.alias
      );
    } else {
      nextList = [...rawItems, field.alias || field.name];
    }
    onChange(nextList.join(', '));
  };

  const selectAll = () => {
    const allAliases = CUSTOMER_FIELDS.map(f => f.alias || f.name);
    onChange(allAliases.join(', '));
  };

  const clearAll = () => {
    onChange('');
  };

  const count = CUSTOMER_FIELDS.filter(f => isSelected(f)).length;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', gap: '8px' }}>
      <input
        type="text"
        className="input"
        style={{ flex: 1 }}
        value={value || ''}
        data-element-name={elementName || 'שדה_SettingsClient_21'}
        onChange={(e) => onChange(e.target.value)}
        placeholder="בחר שדות חובה או הקלד ערך..."
      />

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="icon"><use href="#i-check" /></svg>
        שדות חובה ({count})
      </button>

      {isOpen && (
        <div className="card" style={{ position: 'absolute', top: '105%', insetInlineEnd: 0, insetInlineStart: 0, zIndex: 100, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              בחירת שדות חובה
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={selectAll}
                style={{ background: 'none', border: 'none', color: 'var(--primary-solid)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                בחר הכל
              </button>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <button
                type="button"
                onClick={clearAll}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                נקה הכל
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            {CUSTOMER_FIELDS.map(field => {
              const active = isSelected(field);

              return (
                <div
                  key={field.key}
                  onClick={() => toggleField(field)}
                  className="checkbox-row"
                  style={{
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    background: active ? 'var(--primary-tint)' : 'var(--surface-alt)',
                    border: active ? '1px solid var(--primary-tint-2)' : '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  <input type="checkbox" checked={active} readOnly />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '12.5px', color: active ? 'var(--primary-solid)' : 'var(--text)' }}>
                      {field.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {field.alias}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentDropdownPicker({ value, onChange, departments, elementName }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // מקור האמת היחיד הוא טבלת Department (דרך /api/departments) - בלי רשימת
  // ברירת מחדל קשיחה בקוד. אם הרשימה ריקה/לא נטענה מציגים על כך הודעה מפורשת.
  const deptList = departments || [];

  const selectedList = (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const toggleDept = (deptName) => {
    let nextList;
    if (selectedList.includes(deptName)) {
      nextList = selectedList.filter(d => d !== deptName);
    } else {
      nextList = [...selectedList, deptName];
    }
    onChange(nextList.join(', '));
  };

  const selectAll = () => {
    const allNames = deptList.map(d => d.name);
    onChange(allNames.join(', '));
  };

  const clearAll = () => {
    onChange('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', gap: '8px' }}>
      <input
        type="text"
        className="input"
        style={{ flex: 1 }}
        value={value || ''}
        data-element-name={elementName || 'שדה_SettingsClient_21'}
        onChange={(e) => onChange(e.target.value)}
        placeholder="בחר מחלקות או הקלד ערך..."
      />

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="icon"><use href="#i-shield" /></svg>
        מחלקות ({selectedList.length})
      </button>

      {isOpen && (
        <div className="card" style={{ position: 'absolute', top: '105%', insetInlineEnd: 0, insetInlineStart: 0, zIndex: 100, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              בחירת מחלקות מורשות
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={selectAll}
                style={{ background: 'none', border: 'none', color: 'var(--primary-solid)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                בחר הכל
              </button>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <button
                type="button"
                onClick={clearAll}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                נקה הכל
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {deptList.length === 0 && (
              <div style={{ padding: '10px', fontSize: '12.5px', color: 'var(--text-3)', textAlign: 'center' }}>
                רשימת המחלקות לא נטענה או שאין מחלקות במערכת.
                <br />
                ניתן לנהל מחלקות במסך <a href="/admin/departments" style={{ color: 'var(--primary-solid)', fontWeight: 700 }}>ניהול מחלקות</a>.
              </div>
            )}
            {deptList.map(dept => {
              const isActive = selectedList.includes(dept.name);

              return (
                <div
                  key={dept.roleId ?? dept.name}
                  onClick={() => toggleDept(dept.name)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    background: isActive ? 'var(--primary-tint)' : 'var(--surface-alt)',
                    border: isActive ? '1px solid var(--primary-tint-2)' : '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px', color: isActive ? 'var(--primary-solid)' : 'var(--text)' }}>
                    {dept.name}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--primary-solid)' : 'var(--text-3)' }}>
                      {isActive ? 'מורשה' : 'חסום'}
                    </span>
                    <div className={isActive ? 'switch on' : 'switch'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// מטמון SWR משותף — ראה app/lib/pageCache.js
const settingsCache = cacheNamespace('settings-page');
const deptsCache = cacheNamespace('departments');

export default function SettingsClient() {
  const [settings, setSettings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const [modified, setModified] = useState({});

  const fetchDepartments = async (isPrefetch = false) => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
        deptsCache.set('depts', data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchSettings = async (isPrefetch = false) => {
    try {
      if (!isPrefetch) setLoading(true);
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('שגיאה בטעינת ההגדרות');
      const data = await res.json();

      const cats = [...new Set(data.map(s => s.category).filter(Boolean))];
      if (!cats.includes('תצוגה')) {
        cats.unshift('תצוגה');
      }
      if (!cats.includes('מסד נתונים')) {
        cats.push('מסד נתונים');
      }

      settingsCache.set('settings', { settings: data, cats });

      setSettings(data);
      setCategories(cats);
      if (cats.length > 0 && !activeTab) {
        setActiveTab(cats[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // SWR Cache Hit for Settings
    if (settingsCache.has('settings')) {
      const data = settingsCache.get('settings');
      setSettings(data.settings);
      setCategories(data.cats);
      if (data.cats.length > 0 && !activeTab) setActiveTab(data.cats[0]);
      setLoading(false);
    }
    // SWR Cache Hit for Departments
    if (deptsCache.has('depts')) {
      setDepartments(deptsCache.get('depts'));
    }

    fetchSettings(settingsCache.has('settings'));
    fetchDepartments(deptsCache.has('depts'));
  }, []);

  const handleChange = (key, newValue) => {
    setModified(prev => {
      const next = { ...prev, [key]: newValue };
      if (key === 'BUFFER_DAYS') next['inventory_buffer_days'] = newValue;
      if (key === 'inventory_buffer_days') next['BUFFER_DAYS'] = newValue;
      if (key === 'NEDARIM_MOSAD') next['nedarim_plus_terminal'] = newValue;
      if (key === 'nedarim_plus_terminal') next['NEDARIM_MOSAD'] = newValue;
      return next;
    });
  };

  const handleSave = async () => {
    if (Object.keys(modified).length === 0) return;

    const invalidEntry = Object.entries(modified).find(([key, value]) => validateNumericSetting(key, value) !== null);
    if (invalidEntry) {
      setError(`${HEBREW_NAMES[invalidEntry[0]] || invalidEntry[0]}: ${validateNumericSetting(invalidEntry[0], invalidEntry[1])}`);
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    setError(null);

    const payload = Object.entries(modified).map(([key, value]) => ({ key, value }));

    try {
      let res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });

      // אין עובד מחובר (למשל כשמנסים להפעיל את "חובת התחברות למערכת" בעצמה,
      // כשאף אחד עדיין לא מחובר) — נדרש אישור מנהל נקודתי, כמו בפעולות רגישות
      // אחרות במערכת (למשל שמירת הזמנה עם יתרת חוב).
      if (res.status === 401) {
        const authResult = await window.customAuthPrompt('שמירת ההגדרות דורשת הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
        if (!authResult || !authResult.pin) {
          setSaving(false);
          setSaveMessage('השמירה בוטלה: נדרש אישור מנהל.');
          return;
        }
        res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload, employeeId: authResult.employeeId, pin: authResult.pin })
        });
      }

      if (!res.ok) throw new Error('שגיאה בשמירת ההגדרות');

      // ההגדרות השתנו — מפנים גם את מטמון הדף הזה וגם את מטמון /api/settings
      // המשותף (getSettingsCached), כדי שדפים אחרים יקבלו ערכים עדכניים מיד.
      settingsCache.clear();
      invalidateSettings();

      setSaveMessage('ההגדרות נשמרו בהצלחה במערכת.');
      setModified({});

      setSettings(prev => prev.map(s => {
        if (modified[s.key] !== undefined) {
          return { ...s, value: modified[s.key] };
        }
        return s;
      }));

      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאת הלוגו');

      setSaveMessage('הלוגו עודכן בהצלחה! מרענן תצוגה...');
      localStorage.setItem('logo_timestamp', data.timestamp);
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: data.timestamp }));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner lg" />
        טוען הגדרות...
      </div>
    );
  }

  // NEDARIM_MOSAD ו-nedarim_plus_terminal נשמרים בכוונה כשני מפתחות מסונכרנים תמיד
  // לאותו ערך (לתמיכה בקוד ישן שמחפש את השם הישן) - מציגים רק אחד מהם כדי שלא
  // ייראו כשני שדות כפולים באותו מסך.
  const activeSettings = settings.filter(s => s.category === activeTab && s.key !== 'NEDARIM_MOSAD');
  const hasChanges = Object.keys(modified).length > 0;
  const hasValidationErrors = Object.entries(modified).some(
    ([key, value]) => validateNumericSetting(key, value) !== null
  );

  const currentIcon = CATEGORY_ICONS[activeTab] || CATEGORY_ICONS['default'];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>הגדרות מערכת</h1>
          <div className="page-desc">ניהול תצורת הגמ״ח, התאמה אישית והעדפות</div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setIsEmailModalOpen(true)}>
            <svg className="icon"><use href="#i-mail" /></svg>
            רשימת מיילים מלאה
          </button>

          <button
            type="button"
            className={hasValidationErrors ? 'btn btn-danger-ghost' : 'btn btn-primary'}
            onClick={handleSave}
            disabled={saving || !hasChanges || hasValidationErrors}
            title={hasValidationErrors ? 'יש לתקן ערכים לא תקינים לפני השמירה' : undefined}
          >
            {saving ? (
              <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
            ) : (
              <svg className="icon"><use href="#i-check" /></svg>
            )}
            {saving ? 'שומר...' : hasValidationErrors ? 'יש לתקן שגיאות' : hasChanges ? 'שמור שינויים' : 'אין שינויים'}
          </button>
        </div>
      </div>

      {(error || saveMessage) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {error && (
            <div className="callout callout-danger">
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              {error}
            </div>
          )}
          {saveMessage && (
            <div className="callout callout-success">
              <svg className="icon"><use href="#i-check" /></svg>
              {saveMessage}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* Category sidebar */}
        <div className="card card-pad" style={{ width: '250px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: '16px' }}>
          {categories.map((cat) => {
            const iconName = CATEGORY_ICONS[cat] || CATEGORY_ICONS['default'];
            const isActive = activeTab === cat;

            return (
              <button
                key={cat}
                type="button"
                className={isActive ? 'tab settings-cat active' : 'tab settings-cat'}
                style={{
                  marginInlineEnd: 0, width: '100%', textAlign: 'start',
                  appearance: 'none', WebkitAppearance: 'none', background: isActive ? undefined : 'none', font: 'inherit', borderTop: 'none'
                }}
                onClick={() => setActiveTab(cat)}
              >
                <svg className="icon"><use href={`#${iconName}`} /></svg>
                {cat}
              </button>
            );
          })}
        </div>

        {/* Content pane */}
        <div className="card card-pad" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', marginBottom: '4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
              <svg className="icon" style={{ width: '20px', height: '20px' }}><use href={`#${currentIcon}`} /></svg>
            </div>
            <div>
              <h2 style={{ fontSize: '17px', margin: 0 }}>{activeTab}</h2>
              <p className="hint" style={{ color: 'var(--text-3)', margin: '2px 0 0', fontSize: '12.5px' }}>ערוך את הגדרות המערכת בקטגוריה זו</p>
            </div>
          </div>

          {activeTab === 'מסד נתונים' && (
            <>
              <WebBackupModeToggle />
              <NeonUsageCard />
            </>
          )}

          {activeTab === 'תצוגה' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '14.5px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg className="icon" style={{ width: '16px', height: '16px', color: 'var(--text-3)' }}><use href="#i-image" /></svg>
                  לוגו ראשי של הגמ״ח
                </h3>
                <p className="hint" style={{ color: 'var(--text-3)', margin: 0, maxWidth: '450px', fontSize: '12.5px' }}>
                  העלה קובץ תמונה (PNG/JPG) שיופיע בראש עמודי המערכת וכן בהדפסות ומסמכים רשמיים.
                </p>
              </div>
              <div style={{ flex: '0 0 auto' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: uploadingLogo ? 'not-allowed' : 'pointer' }}>
                  {uploadingLogo ? (
                    <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                  ) : (
                    <svg className="icon"><use href="#i-upload" /></svg>
                  )}
                  {uploadingLogo ? 'מעלה...' : 'בחר תמונה'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          )}

          {activeSettings.map((setting) => {
            const rawValue = modified[setting.key] !== undefined ? modified[setting.key] : setting.value;
            const isBooleanKey = [
              'require_login', 'enable_alterations', 'allow_alterations', 'allow_free_exchange',
              'allow_date_change', 'has_variations', 'has_underskirts', 'useModelNames',
              'useFileNamesForImages', 'hide_ai_features', 'enable_ai_specific_employees',
              'hide_dress_images', 'hide_gregorian_calendar', 'hide_internal_messaging',
              'hide_error_reporting', 'refund_per_item', 'registration_fee', 'nedarim_plus_enabled', 'ENABLE_SET_DISCOUNTS',
              'REFUND_REPAIRS', 'inventory_include_warehouse', 'allow_renting_reserve_items', 'inventory_skip_weekends',
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
              'show_employee_profile_image', 'error_report_handled_at_bottom', 'auto_print_on_order_create',
              'allow_additional_payment_on_order'
            ].includes(setting.key);
            const isBoolean = setting.type === 'boolean' || setting.type === 'checkbox' || rawValue === 'true' || rawValue === 'false' || isBooleanKey;
            const isNumberKey = [
              'max_items_per_order', 'barcodePrefixLength', 'BUFFER_DAYS',
              'barcode_length', 'REFUND_PERCENTAGE', 'REFUND_DAYS',
              'NO_REFUND_DAYS_BEFORE_EVENT', 'REFUND_DAYS_FROM_ORDER',
              'full_refund_days', 'inventory_buffer_days', 'registration_fee',
              'CANCELLATION_CREDIT_MINUTES', 'hok_charge_amount', 'delivery_price'
            ].includes(setting.key);
            const isNumber = setting.type === 'number' || isNumberKey;
            const numberLimit = NUMBER_FIELD_LIMITS[setting.key];
            const numberError = (isNumber && !isBoolean) ? validateNumericSetting(setting.key, rawValue) : null;

            const isHideSetting = setting.key.startsWith('hide_');

            // Determine current state of toggle shown to user
            const uiValue = isHideSetting
              ? (rawValue === 'true' ? 'false' : 'true')
              : rawValue;

            // Determine display name in Hebrew
            let displayName = HEBREW_NAMES[setting.key] || setting.name;
            if (!displayName || displayName === setting.key || /^[a-zA-Z0-9_\-\s]+$/.test(displayName) || displayName.includes('enable_ai_specific')) {
              displayName = HEBREW_NAMES[setting.key] || setting.key;
            }
            if (setting.key === 'hide_ai_features') displayName = 'הפעל בינה מלאכותית (AI)';
            else if (setting.key === 'enable_ai_specific_employees' || setting.name === 'enable_ai_specific_employees') displayName = 'תצוגת AI לעובדים מורשים בלבד';
            else if (setting.key === 'hide_dress_images') displayName = 'הצג תמונות דגמים במערכת';
            else if (setting.key === 'hide_gregorian_calendar') displayName = 'אפשר תאריך לועזי ביומן';
            else if (setting.key === 'hide_internal_messaging') displayName = 'הפעל מערכת הודעות פנימית';
            else if (setting.key === 'hide_error_reporting') displayName = 'הפעל מערכת דיווחי שגיאות';

            let notes = HEBREW_NOTES[setting.key] || setting.notes || '';
            if (!notes || /^[a-zA-Z0-9_\-\s]+$/.test(notes)) {
              notes = HEBREW_NOTES[setting.key] || '';
            }

            const handleToggle = () => {
              if (isHideSetting) {
                const nextDbValue = uiValue === 'true' ? 'true' : 'false';
                handleChange(setting.key, nextDbValue);
              } else {
                const nextDbValue = uiValue === 'true' ? 'false' : 'true';
                handleChange(setting.key, nextDbValue);
              }
            };

            const isMandatoryFieldsSetting = setting.key === 'mandatory_fields';
            const isSelectSetting = setting.type === 'select' || setting.key === 'email_routing_strategy' || setting.key === 'PAYMENT_APPROVAL_LEVEL';
            const isSecretSetting = SECRET_SETTING_KEYS.includes(setting.key);

            const isDepartmentSetting =
              setting.key.toLowerCase().includes('permission') ||
              setting.key.toLowerCase().includes('department') ||
              setting.key === 'cancel_order_permission' ||
              setting.key === 'reserve_permission' ||
              setting.key === 'enable_ai_specific_employees';

            // Helper to check if it needs a larger multiline textbox
            const isMultiline = !isBoolean && !isNumber && !isDepartmentSetting && !isMandatoryFieldsSetting && !isSelectSetting && !isSecretSetting && (
              setting.key.toLowerCase().includes('print') ||
              setting.key.toLowerCase().includes('box') ||
              setting.key.toLowerCase().includes('footer') ||
              setting.key.toLowerCase().includes('locations') ||
              setting.key.toLowerCase().includes('text') ||
              String(rawValue || '').includes('\n') ||
              String(rawValue || '').length > 40
            );

            return (
              <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '14.5px', margin: '0 0 4px' }}>{displayName}</h3>
                  {notes && (
                    <p className="hint" style={{ color: 'var(--text-3)', margin: 0, maxWidth: '480px', fontSize: '12.5px', lineHeight: 1.4 }}>
                      {notes}
                    </p>
                  )}
                </div>

                <div style={{ width: '320px', flex: '0 0 auto', display: 'flex', justifyContent: isBoolean ? 'flex-end' : undefined }}>
                  {isBoolean ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="hint" style={{ color: 'var(--text-3)' }}>
                        {uiValue === 'true' ? 'פעיל' : 'כבוי'}
                      </span>
                      <button
                        type="button"
                        className={uiValue === 'true' ? 'switch on' : 'switch'}
                        onClick={handleToggle}
                      />
                    </div>
                  ) : isMandatoryFieldsSetting ? (
                    <CustomerFieldsCheckboxPicker
                      value={rawValue || ''}
                      elementName="שדה_SettingsClient_21"
                      onChange={(val) => handleChange(setting.key, val)}
                    />
                  ) : isSelectSetting && setting.key === 'PAYMENT_APPROVAL_LEVEL' ? (
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={rawValue || 'כולם'}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                    >
                      <option value="כולם">כולם (ללא הגבלה - ברירת מחדל)</option>
                      <option value="עובד">עובד (זיהוי עצמי בסיסמה)</option>
                      <option value="מנהל">מנהל סניף / מתכנת</option>
                      <option value="מנהל סניף ומעלה">מנהל סניף ומעלה (כולל הנהלה ראשית)</option>
                    </select>
                  ) : isSelectSetting ? (
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={rawValue || 'all_a'}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                    >
                      <option value="all_a">שלח הכל מקישור א&apos; (ראשי)</option>
                      <option value="all_b">שלח הכל מקישור ב&apos; (משני)</option>
                      <option value="bugs_b_rest_a">דיווחי שגיאות מב&apos;, השאר מא&apos;</option>
                    </select>
                  ) : isDepartmentSetting ? (
                    <DepartmentDropdownPicker
                      value={rawValue || ''}
                      departments={departments}
                      elementName="שדה_SettingsClient_21"
                      onChange={(val) => handleChange(setting.key, val)}
                    />
                  ) : isSecretSetting ? (
                    <div style={{ width: '100%' }}>
                      <input
                        type="password"
                        className="input"
                        style={{ width: '100%' }}
                        value={rawValue || ''}
                        autoComplete="off"
                        onFocus={(e) => {
                          // ערך ממוסך שלא נגעו בו — מנקים כדי שההקלדה תתחיל מאפס
                          // ולא תשרשר תווים על גבי הסימון "מוגדר".
                          if (rawValue === SECRET_MASK) handleChange(setting.key, '');
                        }}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        placeholder={rawValue === SECRET_MASK ? 'מוגדר — לחץ כדי להחליף' : 'הדבק ערך חדש...'}
                      />
                      <p className="hint" style={{ margin: '4px 0 0', color: 'var(--text-3)' }}>
                        {SECRET_SETTING_LINKS[setting.key]?.prefix}{' '}
                        {SECRET_SETTING_LINKS[setting.key] && (
                          <a href={SECRET_SETTING_LINKS[setting.key].url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-solid)' }}>
                            {SECRET_SETTING_LINKS[setting.key].label}
                          </a>
                        )}
                        {' '}הערך נשמר מוצפן ולא מוצג שוב לאחר השמירה.
                      </p>
                    </div>
                  ) : isMultiline ? (
                    <textarea
                      className="textarea"
                      style={{ width: '100%', minHeight: '110px' }}
                      value={rawValue || ''}
                      onChange={(e) => handleChange(setting.key, e.target.value)}
                      placeholder="הקלד ערך..."
                    />
                  ) : (
                    <div style={{ width: '100%' }}>
                      <input
                        type={isNumber ? 'number' : 'text'}
                        className="input"
                        style={{ width: '100%', borderColor: numberError ? 'var(--danger)' : undefined }}
                        value={rawValue || ''}
                        min={isNumber ? numberLimit?.min : undefined}
                        max={isNumber ? numberLimit?.max : undefined}
                        step={isNumber ? (numberLimit?.allowDecimal ? '0.1' : '1') : undefined}
                        onChange={(e) => {
                          if (isNumber) {
                            const pattern = numberLimit?.allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
                            const cleaned = e.target.value.replace(pattern, '');
                            handleChange(setting.key, cleaned);
                          } else {
                            handleChange(setting.key, e.target.value);
                          }
                        }}
                        placeholder={isNumber ? (numberLimit ? `מספר בין ${numberLimit.min} ל-${numberLimit.max}...` : 'הזן מספר בלבד...') : 'הקלד ערך...'}
                      />
                      {numberError && (
                        <p style={{ margin: '4px 0 0', color: 'var(--danger)', fontSize: '11.5px', fontWeight: 600 }}>{numberError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {activeSettings.length === 0 && activeTab !== 'תצוגה' && activeTab !== 'מסד נתונים' && (
            <div className="empty-state">
              <svg className="icon"><use href="#i-info" /></svg>
              <p>אין הגדרות בקטגוריה זו</p>
            </div>
          )}

        </div>

      </div>

      <FullEmailListModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </>
  );
}
