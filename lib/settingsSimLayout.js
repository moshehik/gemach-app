// lib/settingsSimLayout.js — המבנה של מסכי ההגדרות בעיצוב "סימולציה" (תצוגות-עיצוב/הגדרות-סימולציה.html, נבחר ע"י הבעלים 4.10.2026).
//
// טהור (בלי React / Next / prisma): נקרא מהרכיב (app/components/settings-sim/SettingsSimPage.js) ומהבדיקה
// (scripts/test_settings_sim.mjs). כל שם/הערה/סוג שדה/ולידציה מגיעים ממקורות האמת הקיימים — lib/settingsMetadata.js,
// app/lib/settingsValidation.js, app/lib/secretSettingKeys.js — כאן רק *איפה* כל הגדרה מוצגת ובאיזה פקד.
//
// המקור של המיפוי: אינדקס הסקירה שבתוך קובץ העיצוב (RV.items): P### = הגדרה קיימת במיקום מוצע (tab/section/key),
// M### = שורה בעיצוב עם מקבילה קיימת (key). שורות שקיימות רק בעיצוב (S###) לא נבנו — ר' scratch/settings-build/PLAN.md.
//
// כללי כיסוי (אסור שהגדרה שמוצגת היום תיעלם):
//   * מפתח ממופה → הלשונית/הסעיף שלו (גם אם הקטגוריה ב-DB שונה), כל עוד המסך (sys/site) של הקטגוריה זהה.
//   * מפתח לא ממופה עם קטגוריה → הלשונית לפי CATEGORY_TAB, בסעיף "הגדרות נוספות" בסוף הלשונית.
//   * קטגוריה לא מוכרת → לשונית "הגדרות נוספות" (more / site_more) בסוף הסרגל.
//   * שורה בלי קטגוריה ובלי מיפוי — לא מוצגת (כמו היום: SettingsClient מסנן לפי s.category === activeTab).
//   * NEDARIM_MOSAD לא מוצג (כמו היום) — מסונכרן תמיד עם nedarim_plus_terminal.
//   * קטגוריות המתכנת (SETTINGS_DEVELOPER_CATEGORIES) רק במסך site, ושאר הקטגוריות רק במסך sys (filterCategoriesForMode).

import {
  SETTINGS_SELECT_OPTIONS,
  SETTINGS_DEVELOPER_CATEGORIES,
  INVERTED_DISPLAY_KEYS,
  classifySettingField,
  getSettingDisplayName,
  getSettingNotes,
} from './settingsMetadata.js';
import { NUMBER_FIELD_LIMITS, validateNumericSetting, validateSelectSetting } from '../app/lib/settingsValidation.js';
import { SECRET_SETTING_KEYS, SECRET_MASK, SECRET_CLEAR_MARKER } from '../app/lib/secretSettingKeys.js';

/* ------------------------------------------------------------------ לשוניות */

// icon = האייקון בסרגל הצד (st-sic), top = האייקון בלשונית העליונה (נייד, data-ico) — כמו בעיצוב.
export const SYS_TABS = Object.freeze([
  { id: 'cfg', label: 'תצורה', icon: 'sliders', top: 'sliders' },
  { id: 'brand', label: 'מיתוג', icon: 'sparkle', top: 'sparkle' },
  { id: 'pay', label: 'תשלומים', icon: 'card', top: 'card' },
  { id: 'bc', label: 'ברקודים', icon: 'scan', top: 'scan' },
  { id: 'msg', label: 'הודעות', icon: 'bell', top: 'bell' },
  { id: 'auto', label: 'אוטומציה', icon: 'clock', top: 'clock' },
  { id: 'sync', label: 'סנכרון', icon: 'refresh', top: 'refresh' },
  { id: 'ord', label: 'הזמנות', icon: 'bag', top: 'bag' },
  { id: 'dlv', label: 'משלוחים', icon: 'truck', top: 'truck' },
  { id: 'inv', label: 'מלאי ויומן', icon: 'box', top: 'box' },
  { id: 'prn', label: 'הדפסה', icon: 'print', top: 'print' },
  { id: 'disp', label: 'תצוגה וממשק', icon: 'eye', top: 'eye' },
  { id: 'unused', label: 'לא בשימוש', icon: 'info', top: 'info', dim: true },
  { id: 'more', label: 'הגדרות נוספות', icon: 'list', top: 'list' },
]);

export const SITE_TABS = Object.freeze([
  { id: 'db', label: 'מסד נתונים', icon: 'table', top: 'table' },
  { id: 'sys', label: 'מערכת', icon: 'gear', top: 'gear' },
  { id: 'mail', label: 'מיילים', icon: 'mail', top: 'mail' },
  { id: 'site_more', label: 'הגדרות נוספות', icon: 'list', top: 'list' },
]);

// קבוצות הכיתובים של "שינוי שמות" — אותן 6 קבוצות ואותם מפתחות כמו app/admin/labels (LegacyLabelsPage.js).
export const NAMES_TABS = Object.freeze([
  { id: 'customers', label: 'לקוחות', icon: 'users', top: 'users', keys: ['customer_firstName', 'customer_lastName', 'customer_phone1', 'customer_phone2', 'customer_city', 'customer_street', 'customer_houseNum', 'customer_email', 'customer_notes'] },
  { id: 'orders', label: 'הזמנות', icon: 'bag', top: 'bag', keys: ['order_id', 'order_customerName', 'order_date', 'order_eventDate', 'order_returnDate', 'order_totalAmount', 'order_paid', 'order_status'] },
  { id: 'dresses', label: 'דגמים ופריטים', icon: 'dress', top: 'dress', keys: ['dress_name', 'dress_barcodePrefix', 'dress_category', 'dress_price', 'dress_notes', 'dress_itemsCount', 'item_size', 'item_barcode', 'item_location', 'item_status'] },
  { id: 'rentals', label: 'השכרות', icon: 'truck', top: 'truck', keys: ['rental_customer', 'rental_barcode', 'rental_taken', 'rental_returned', 'rental_returnedOk', 'rental_notes'] },
  { id: 'customer_availability', label: 'זמינות לקוח', icon: 'table', top: 'table', keys: ['ca_title', 'ca_sizes_title', 'ca_total_models', 'ca_total_sizes', 'ca_items'] },
  { id: 'tabs', label: 'כותרות טאבים', icon: 'list', top: 'list', keys: ['tab_customers', 'tab_orders', 'tab_rentals', 'tab_dresses', 'tab_customer_availability'] },
]);

// ברירות המחדל של הכיתובים — העתק מדויק של DEFAULT_LABELS ב-app/admin/labels (LegacyLabelsPage.js); הבדיקה משווה ביניהם.
export const DEFAULT_LABELS = Object.freeze({
  customer_firstName: 'שם פרטי', customer_lastName: 'שם משפחה', customer_phone1: 'טלפון 1', customer_phone2: 'טלפון 2',
  customer_city: 'עיר', customer_street: 'רחוב', customer_houseNum: 'בית', customer_email: 'דוא"ל', customer_notes: 'הערות',
  order_id: 'מספר הזמנה', order_customerName: 'שם לקוח', order_date: 'תאריך הזמנה', order_eventDate: 'תאריך אירוע',
  order_returnDate: 'תאריך החזרה', order_totalAmount: 'סה"כ', order_paid: 'שולם', order_status: 'סטטוס',
  dress_name: 'שם דגם', dress_barcodePrefix: 'קידומת ברקוד', dress_category: 'קטגורית מחיר', dress_price: 'מחיר',
  dress_notes: 'הערות דגם', dress_itemsCount: 'מלאי', item_size: 'מידה', item_barcode: 'ברקוד', item_location: 'מיקום', item_status: 'סטטוס פריט',
  rental_customer: 'לקוח', rental_barcode: 'ברקוד פריט', rental_taken: 'נלקח', rental_returned: 'הוחזר', rental_returnedOk: 'חזר תקין', rental_notes: 'הערות מיוחדות',
  ca_title: 'ניהול מלאי', ca_sizes_title: 'זמינות מידות', ca_total_models: 'סה״כ דגמים', ca_total_sizes: 'סה״כ מידות', ca_items: 'פריטים',
  tab_customers: 'לקוחות', tab_orders: 'הזמנות', tab_rentals: 'השכרות והחזרות', tab_dresses: 'ניהול קטלוג', tab_customer_availability: 'זמינות לקוח',
});

/* ------------------------------------------------------------------ סעיפים ומפתחות */

// כל סעיף: { view, tab, id, title, icon, keys, special? }. special = בלוק שאינו שורת SystemSetting (לוגו, קישור הרשאות, db-mode, Neon).
// הסדר כאן = הסדר בעיצוב.
export const SECTIONS = Object.freeze([
  // ---- sys / תצורה
  { view: 'sys', tab: 'cfg', id: 'org', title: 'פרטי הגמ״ח', icon: 'home', keys: ['gmach_name', 'gmach_phone', 'main_email', 'gmach_address'] },
  { view: 'sys', tab: 'cfg', id: 'rent', title: 'כללי השכרה', icon: 'cal', keys: ['BUFFER_DAYS', 'enable_rental_extension', 'hide_gregorian_calendar', 'hide_custom_spacing'] },
  { view: 'sys', tab: 'cfg', id: 'system', title: 'כללי מערכת', icon: 'gear', keys: ['require_login', 'item_locations'] },
  { view: 'sys', tab: 'cfg', id: 'branches', title: 'סניפים', icon: 'pin', keys: ['branches_enabled', 'branch_list', 'track_branch_on_order'] },
  // ---- sys / מיתוג
  { view: 'sys', tab: 'brand', id: 'identity', title: 'זהות המערכת', icon: 'sparkle', keys: ['gmach_subtitle', 'home_welcome_title'] },
  { view: 'sys', tab: 'brand', id: 'files', title: 'קבצי מיתוג', icon: 'file', keys: [], special: 'logo' },
  // ---- sys / תשלומים
  { view: 'sys', tab: 'pay', id: 'methods', title: 'אמצעי תשלום פעילים', icon: 'wallet', keys: ['ALLOWED_PAYMENT_METHODS', 'PAYMENT_APPROVAL_LEVEL', 'allow_additional_payment_on_order', 'consolidate_manual_payment_credit_ui'] },
  { view: 'sys', tab: 'pay', id: 'refunds', title: 'מדיניות זיכויים וביטולים', icon: 'undo', keys: ['instant_undo_minutes', 'CANCELLATION_CREDIT_MINUTES', 'REFUND_PERCENTAGE', 'REFUND_DAYS_FROM_ORDER', 'NO_REFUND_DAYS_BEFORE_EVENT', 'REFUND_REPAIRS', 'refund_tiers_at_deletion_time', 'ENABLE_SET_DISCOUNTS'] },
  { view: 'sys', tab: 'pay', id: 'pricing', title: 'תמחור', icon: 'tag', keys: ['premium_pricing_enabled', 'premium_categories'] },
  { view: 'sys', tab: 'pay', id: 'swap', title: 'החלפת מידה', icon: 'swap', keys: ['same_model_swap_no_fee', 'swap_min_days_before_event', 'swap_same_category_only', 'swap_pairing_window_minutes', 'size_edit_until_days_before_event', 'gap_size_price_rule'] },
  { view: 'sys', tab: 'pay', id: 'nedarim', title: 'סליקת אשראי – נדרים פלוס', icon: 'card', keys: ['nedarim_plus_enabled', 'nedarim_plus_terminal', 'nedarim_plus_token', 'nedarim_rinat_lev_url'] },
  { view: 'sys', tab: 'pay', id: 'hok', title: 'הוראת קבע (הו״ק)', icon: 'bank', keys: ['hok_enabled', 'hok_auto_charge_enabled', 'hok_auto_charge_hour', 'hok_charge_amount', 'auto_charge_damaged_return'] },
  // ---- sys / ברקודים
  { view: 'sys', tab: 'bc', id: 'scan', title: 'סריקה', icon: 'scan', keys: ['barcodePrefixLength'] },
  { view: 'sys', tab: 'bc', id: 'manual', title: 'ברקוד ידני ולא תקין', icon: 'pencil', keys: ['manual_barcode_double_entry', 'barcode_invalid_list', 'manual_barcode_daily_report'] },
  // ---- sys / הודעות
  { view: 'sys', tab: 'msg', id: 'mails', title: 'מיילים אוטומטיים ללקוחות', icon: 'mail', keys: ['auto_email_on_order_create', 'pickup_reminder_enabled', 'pickup_reminder_hour', 'late_return_email_enabled', 'late_return_email_text', 'late_return_threshold_days', 'bulk_email_by_event_date'] },
  { view: 'sys', tab: 'msg', id: 'daily', title: 'דוח יומי למנהל', icon: 'send', keys: ['daily_manager_report_hour', 'daily_manager_report_enabled', 'daily_manager_report_email'] },
  { view: 'sys', tab: 'msg', id: 'mailing', title: 'רשימת תפוצה', icon: 'users', keys: ['mailing_list_auto_sync', 'mailing_list_provider'] },
  { view: 'sys', tab: 'msg', id: 'internal', title: 'הודעות פנימיות', icon: 'msg', keys: ['shift_handover_notes', 'management_messages', 'notify_on_new_message_at_login', 'laundress_return_check_on_exit'] },
  { view: 'sys', tab: 'msg', id: 'digest', title: 'עדכון ענפי תיקון (גמח ראשי בלבד)', icon: 'send', keys: ['agent_digest_email_enabled', 'agent_digest_email_hours'] },
  // ---- sys / אוטומציה (קטגוריית "גיבויים" — היום לשונית משלה כשהשורות קיימות; מנוהלות גם ב-/admin/backups)
  { view: 'sys', tab: 'auto', id: 'backup', title: 'גיבוי אוטומטי', icon: 'shield', keys: ['backup_enabled', 'backup_interval_hours', 'backup_drive_folder_id', 'backup_owner_email'] },
  // ---- sys / סנכרון
  { view: 'sys', tab: 'sync', id: 'yemot', title: 'ימות המשיח', icon: 'phone', keys: ['yemot_enabled', 'yemot_api_url', 'yemot_api_token', 'yemot_queue_view_enabled', 'yemot_import_customer_enabled'] },
  // ---- sys / הזמנות
  { view: 'sys', tab: 'ord', id: 'mandatory', title: 'שדות חובה בלקוח', icon: 'userck', keys: ['require_customer_email', 'require_full_address', 'require_marketing_consent', 'hide_marketing_consent_field', 'require_customer_id_number', 'mandatory_fields', 'mandatory_field_groups', 'strict_mandatory_fields'] },
  { view: 'sys', tab: 'ord', id: 'verify', title: 'אימות והרשאות בהזמנה', icon: 'shield', keys: ['require_id_for_edit_cancel', 'require_manager_code_for_item_changes', 'allow_edit_partially_rented', 'unpaid_action_approval_once_per_visit', 'customer_id_once_per_order_visit', 'order_card_refresh_on_return'] },
  { view: 'sys', tab: 'ord', id: 'limits', title: 'מגבלות', icon: 'lock', keys: ['max_items_per_order', 'enforce_strict_max_items'] },
  { view: 'sys', tab: 'ord', id: 'screen', title: 'מסך ההזמנה', icon: 'bag', keys: ['draft_orders_show_as_deleted', 'enable_local_order_drafts', 'enable_order_edit_summary_confirm', 'auto_print_on_order_create', 'phone_order_marker_enabled', 'enable_alterations', 'hide_order_payment_note', 'allow_abroad_long_stay_orders', 'order_new_redirect_screen', 'order_edit_redirect_screen'] },
  // ---- sys / משלוחים
  { view: 'sys', tab: 'dlv', id: 'dlv_main', title: 'משלוחים – הפעלה ומחירים', icon: 'truck', keys: ['enable_deliveries', 'delivery_price', 'delivery_price_by_city', 'delivery_show_in_order', 'delivery_allow_address_override', 'delivery_charge_customer_city_fallback'] },
  { view: 'sys', tab: 'dlv', id: 'dlv_time', title: 'משלוחים – תזמון', icon: 'cal', keys: ['delivery_days_before', 'delivery_days_after', 'delivery_skip_weekends', 'delivery_one_day_before_option', 'deliveries_select_by_event_date', 'delivery_table_range_enabled'] },
  { view: 'sys', tab: 'dlv', id: 'courier', title: 'משלוחן', icon: 'user', keys: ['courier_name', 'courier_email'] },
  // ---- sys / מלאי ויומן
  { view: 'sys', tab: 'inv', id: 'stock', title: 'מלאי', icon: 'box', keys: ['inventory_include_warehouse', 'allow_renting_reserve_items', 'inventory_hold_minutes'] },
  { view: 'sys', tab: 'inv', id: 'gaps', title: 'רווחים בין השכרות', icon: 'cal', keys: ['inventory_buffer_days', 'inventory_skip_weekends'] },
  { view: 'sys', tab: 'inv', id: 'control', title: 'בקרה בהשכרה ובהחזרה', icon: 'scan', keys: ['enforce_rental_barcode_match', 'require_approval_for_early_return'] },
  // ---- sys / הדפסה
  { view: 'sys', tab: 'prn', id: 'docs', title: 'מסמכי השכרה מודפסים', icon: 'print', keys: ['print_rental_box1', 'print_rental_box2', 'print_rental_footer', 'standard_return_hour', 'standard_pickup_hours', 'rental_belt_notice'] },
  { view: 'sys', tab: 'prn', id: 'batch', title: 'הדפסת אצווה ומיון', icon: 'list', keys: ['enable_batch_print_prep', 'print_sort_deliveries_first', 'print_mark_missing_dresses', 'print_order_clean_layout'] },
  // ---- sys / תצוגה וממשק
  { view: 'sys', tab: 'disp', id: 'general', title: 'תצוגה כללית', icon: 'eye', keys: ['hide_dress_images', 'useModelNames', 'useFileNamesForImages', 'hide_internal_messaging', 'show_not_taken_orders', 'hide_taken_orders_from_orders_list', 'cancellation_extra_columns', 'rentals_sort_recent_first', 'show_employee_profile_image', 'enable_unreturned_orders_popup', 'overdue_popup_threshold_days', 'overdue_popup_after_hour'] },
  { view: 'sys', tab: 'disp', id: 'kiosk', title: 'עמדת לקוח (קיוסק)', icon: 'users', keys: ['kiosk_customer_self_service', 'kiosk_allow_self_order'] },
  { view: 'sys', tab: 'disp', id: 'errors', title: 'דיווחי שגיאות', icon: 'alert', keys: ['hide_error_reporting', 'error_report_handled_at_bottom', 'error_report_human_button_enabled'] },
  { view: 'sys', tab: 'disp', id: 'ai', title: 'בינה מלאכותית', icon: 'searchspark', keys: ['hide_ai_features', 'enable_ai_specific_employees', 'ai_screen_recording_enabled'] },
  // החלטת הבעלים P008: "כשורת הגדרות בטאב תצוגה - ובמקום שורה יופיע לחצן עם איקון קישור חיצוני"
  { view: 'sys', tab: 'disp', id: 'perm', title: 'הרשאות', icon: 'shield', keys: [], special: 'permissions' },
  // ---- sys / לא בשימוש (לשונית ארכיון מעומעמת)
  { view: 'sys', tab: 'unused', id: 'dead', title: 'מפתחות שאינם נקראים בקוד', icon: 'info', keys: ['has_variations', 'has_underskirts', 'dress_size_min', 'dress_size_max', 'dress_size_even_only', 'items_name_singular', 'items_name_plural', 'barcode_length', 'allow_date_change', 'allow_free_exchange', 'cancel_order_permission', 'reserve_permission', 'max_order_days_ahead', 'refund_per_item', 'REFUND_DAYS', 'registration_fee', 'calendar_filtering', 'restrict_dress_catalog_to_head_management', 'restrict_refunds_to_head_management', 'restrict_board_to_managers', 'allow_shift_lead_reserve_rental', 'allow_alterations', 'split_dress_enabled'] },
  // ---- site / מסד נתונים
  { view: 'site', tab: 'db', id: 'env', title: 'סביבה וחיבורים', icon: 'shield', keys: [], special: 'dbmode' },
  { view: 'site', tab: 'db', id: 'neon', title: 'צריכת מסד הנתונים (Neon)', icon: 'table', keys: ['neon_api_key'], special: 'neon' },
  // ---- site / מערכת
  { view: 'site', tab: 'sys', id: 'agent', title: 'סוכן תיקון אוטומטי', icon: 'sparkle', keys: ['agent_fix_loop_enabled', 'agent_fix_loop_last_activity'] },
  // ---- site / מיילים
  { view: 'site', tab: 'mail', id: 'links', title: 'קישורי שליחה וניתוב', icon: 'send', keys: ['email_link_a', 'email_link_b', 'email_routing_strategy', 'email_drive_folder_id'] },
]);

// קטגוריית DB → לשונית, למפתחות שאינם ממופים במפורש (הסעיף "הגדרות נוספות" של הלשונית).
export const CATEGORY_TAB = Object.freeze({
  'כללי': 'cfg', 'סניפים': 'cfg',
  'כותרות': 'brand',
  'תשלומים': 'pay', 'הוראת קבע': 'pay', 'מחירון': 'pay',
  'ברקודים': 'bc',
  'הודעות': 'msg', 'אוטומציה': 'msg',
  'גיבויים': 'auto',
  'סנכרון': 'sync',
  'הזמנות': 'ord',
  'משלוחים': 'dlv',
  'מלאי': 'inv', 'יומן': 'inv',
  'הדפסה': 'prn',
  'תצוגה': 'disp', 'בינה מלאכותית': 'disp',
  'לא בשימוש': 'unused',
  // קטגוריות המתכנת (site)
  'מסד נתונים': 'db', 'מערכת': 'sys', 'מיילים': 'mail',
});

export const EXTRA_SECTION_TITLE = 'הגדרות נוספות';

// מפתחות שמוסתרים גם היום (SettingsClient.js: activeSettings מסנן NEDARIM_MOSAD — זוג מסונכרן של nedarim_plus_terminal).
// web_backup_mode = דגל המעבר החי בין מסד הייצור למסד הבדיקות (app/lib/prisma.js) — נשלט רק דרך "סביבת עבודה" (db-mode עם אישור), לא כמתג רגיל.
export const HIDDEN_KEYS = Object.freeze(['NEDARIM_MOSAD', 'web_backup_mode']);

// זוגות שנשמרים יחד (SettingsClient.js handleChange + app/api/settings/route.js).
export const SYNCED_PAIRS = Object.freeze([
  ['BUFFER_DAYS', 'inventory_buffer_days'],
  ['NEDARIM_MOSAD', 'nedarim_plus_terminal'],
]);

/* ------------------------------------------------------------------ פרטי שורה */

// תוויות/אייקונים/פקדים לפי העיצוב. label = שם השורה בעיצוב כששונה מהשם האמיתי (M### במעמד "map" — אותה משמעות);
// polarity:'raw' = המתג מציג את הערך הגולמי גם למפתח hide_* (שורת "תאריכים עבריים בלבד" = hide_gregorian_calendar ישירות).
export const KEY_UI = Object.freeze({
  gmach_name: { label: 'שם הגמ״ח', icon: 'home' },
  gmach_phone: { label: 'טלפון ראשי', icon: 'phone', ltr: true, inputType: 'tel' },
  main_email: { label: 'מייל ראשי', icon: 'mail', ltr: true, inputType: 'email' },
  gmach_address: { icon: 'pin' },
  BUFFER_DAYS: { icon: 'cal' },
  enable_rental_extension: { icon: 'cal' },
  hide_gregorian_calendar: { label: 'תאריכים עבריים בלבד', icon: 'cal', polarity: 'raw' },
  hide_custom_spacing: { icon: 'cal' },
  require_login: { icon: 'lock' },
  item_locations: { icon: 'box', ctl: 'textarea', rows: 3, wide: true },
  branches_enabled: { icon: 'pin' },
  branch_list: { icon: 'pin' },
  track_branch_on_order: { icon: 'pin' },
  // נקרא ב-app/layout.js (סרגל המותג), lib/menu/buildMenuTree.js, lib/loginFlow.js ו-/api/a5/boot — לכן לא ב"לא בשימוש"
  gmach_subtitle: { icon: 'note' },
  home_welcome_title: { label: 'כותרת דף הבית', icon: 'note', ctl: 'textarea', rows: 2, wide: true },
  ALLOWED_PAYMENT_METHODS: { label: 'אמצעים שמוצגים בהזמנה', icon: 'wallet', ctl: 'methods' },
  PAYMENT_APPROVAL_LEVEL: { icon: 'shield', ctl: 'opts', wide: true },
  allow_additional_payment_on_order: { icon: 'wallet' },
  consolidate_manual_payment_credit_ui: { icon: 'wallet' },
  instant_undo_minutes: { label: 'חלון ביטול מיידי · דקות', icon: 'clock' },
  CANCELLATION_CREDIT_MINUTES: { label: 'תוקף זיכוי לניצול · דקות', icon: 'clock' },
  REFUND_PERCENTAGE: { icon: 'cash' },
  REFUND_DAYS_FROM_ORDER: { icon: 'cal' },
  NO_REFUND_DAYS_BEFORE_EVENT: { icon: 'cal' },
  REFUND_REPAIRS: { icon: 'scissors' },
  refund_tiers_at_deletion_time: { icon: 'clock' },
  ENABLE_SET_DISCOUNTS: { icon: 'gift' },
  premium_pricing_enabled: { label: 'תמחור פרימיום', icon: 'tag' },
  premium_categories: { icon: 'tag' },
  same_model_swap_no_fee: { icon: 'swap' },
  swap_min_days_before_event: { icon: 'cal' },
  swap_same_category_only: { icon: 'tag' },
  swap_pairing_window_minutes: { icon: 'clock' },
  size_edit_until_days_before_event: { icon: 'cal' },
  gap_size_price_rule: { icon: 'tag', ctl: 'seg' },
  nedarim_plus_enabled: { icon: 'card' },
  nedarim_plus_terminal: { icon: 'card' },
  nedarim_plus_token: { icon: 'lock' },
  nedarim_rinat_lev_url: { icon: 'ext', ltr: true, ctl: 'text' },
  hok_enabled: { icon: 'card' },
  hok_auto_charge_enabled: { icon: 'clock' },
  hok_auto_charge_hour: { icon: 'clock', ctl: 'time' },
  hok_charge_amount: { icon: 'cash' },
  auto_charge_damaged_return: { icon: 'alert' },
  barcodePrefixLength: { label: 'אורך מספר הדגם', icon: 'scan' },
  manual_barcode_double_entry: { icon: 'pencil' },
  barcode_invalid_list: { icon: 'alert' },
  manual_barcode_daily_report: { icon: 'send' },
  auto_email_on_order_create: { label: 'אישור הזמנה (מייל)', icon: 'check' },
  pickup_reminder_enabled: { label: 'תזכורת לפני האיסוף (מייל)', icon: 'bell' },
  pickup_reminder_hour: { icon: 'clock', ctl: 'time' },
  late_return_email_enabled: { icon: 'mail' },
  late_return_email_text: { icon: 'msg', ctl: 'textarea', rows: 3, wide: true },
  late_return_threshold_days: { icon: 'alert' },
  bulk_email_by_event_date: { icon: 'send' },
  daily_manager_report_hour: { icon: 'clock', ctl: 'time' },
  daily_manager_report_enabled: { icon: 'msg' },
  daily_manager_report_email: { icon: 'mail', ltr: true },
  mailing_list_auto_sync: { icon: 'mail' },
  mailing_list_provider: { icon: 'mail' },
  shift_handover_notes: { icon: 'msg' },
  management_messages: { icon: 'msg' },
  notify_on_new_message_at_login: { icon: 'bell' },
  laundress_return_check_on_exit: { icon: 'users' },
  agent_digest_email_enabled: { icon: 'send' },
  agent_digest_email_hours: { icon: 'clock', ltr: true },
  backup_enabled: { icon: 'shield' },
  backup_interval_hours: { icon: 'clock' },
  backup_drive_folder_id: { icon: 'file' },
  backup_owner_email: { icon: 'mail', ltr: true },
  yemot_enabled: { icon: 'refresh' },
  yemot_api_url: { icon: 'ext', ltr: true, ctl: 'text' },
  yemot_api_token: { icon: 'lock' },
  yemot_queue_view_enabled: { icon: 'list' },
  yemot_import_customer_enabled: { icon: 'users' },
  require_customer_email: { icon: 'mail' },
  require_full_address: { icon: 'pin' },
  require_marketing_consent: { icon: 'check' },
  hide_marketing_consent_field: { icon: 'eye' },
  hide_order_payment_note: { icon: 'eye' },
  unpaid_action_approval_once_per_visit: { icon: 'shield' },
  customer_id_once_per_order_visit: { icon: 'shield' },
  order_card_refresh_on_return: { icon: 'refresh' },
  allow_abroad_long_stay_orders: { icon: 'cal' },
  require_customer_id_number: { icon: 'userck' },
  mandatory_fields: { icon: 'check', wide: true },
  mandatory_field_groups: { icon: 'check', wide: true },
  strict_mandatory_fields: { icon: 'lock' },
  require_id_for_edit_cancel: { icon: 'userck' },
  require_manager_code_for_item_changes: { icon: 'shield' },
  allow_edit_partially_rented: { icon: 'pencil' },
  max_items_per_order: { icon: 'bag' },
  enforce_strict_max_items: { icon: 'lock' },
  draft_orders_show_as_deleted: { icon: 'trash' },
  enable_local_order_drafts: { icon: 'note' },
  enable_order_edit_summary_confirm: { icon: 'list' },
  auto_print_on_order_create: { icon: 'print' },
  phone_order_marker_enabled: { icon: 'phone' },
  enable_alterations: { icon: 'scissors' },
  order_new_redirect_screen: { icon: 'arrr', ctl: 'pills', wide: true },
  order_edit_redirect_screen: { icon: 'arrr', ctl: 'pills', wide: true },
  enable_deliveries: { icon: 'truck' },
  delivery_price: { icon: 'cash' },
  delivery_price_by_city: { icon: 'cash', ltr: true },
  delivery_charge_customer_city_fallback: { icon: 'pin' },
  delivery_show_in_order: { icon: 'eye' },
  delivery_allow_address_override: { icon: 'pin' },
  delivery_days_before: { icon: 'cal' },
  delivery_days_after: { icon: 'cal' },
  delivery_skip_weekends: { icon: 'cal' },
  delivery_one_day_before_option: { icon: 'cal' },
  deliveries_select_by_event_date: { icon: 'cal' },
  delivery_table_range_enabled: { icon: 'table' },
  courier_name: { icon: 'user' },
  courier_email: { icon: 'mail', ltr: true },
  inventory_include_warehouse: { icon: 'box' },
  allow_renting_reserve_items: { icon: 'box' },
  inventory_hold_minutes: { label: 'החזקת פריט בהזמנה (דקות)', icon: 'clock' },
  inventory_buffer_days: { icon: 'cal' },
  inventory_skip_weekends: { icon: 'cal' },
  enforce_rental_barcode_match: { icon: 'scan' },
  require_approval_for_early_return: { icon: 'undo' },
  print_rental_box1: { icon: 'print', ctl: 'textarea', rows: 3, wide: true },
  print_rental_box2: { icon: 'print', ctl: 'textarea', rows: 3, wide: true },
  print_rental_footer: { icon: 'print', ctl: 'textarea', rows: 3, wide: true },
  standard_return_hour: { icon: 'clock', ctl: 'time' },
  standard_pickup_hours: { label: 'שעות איסוף סטנדרטיות', icon: 'clock', ltr: true },
  rental_belt_notice: { icon: 'note' },
  enable_batch_print_prep: { icon: 'print' },
  print_sort_deliveries_first: { icon: 'truck' },
  print_mark_missing_dresses: { icon: 'alert' },
  print_order_clean_layout: { icon: 'print' },
  hide_dress_images: { icon: 'eye' },
  useModelNames: { icon: 'dress' },
  useFileNamesForImages: { icon: 'file' },
  hide_internal_messaging: { icon: 'msg' },
  show_not_taken_orders: { icon: 'list' },
  hide_taken_orders_from_orders_list: { icon: 'list' },
  cancellation_extra_columns: { icon: 'table' },
  rentals_sort_recent_first: { icon: 'rows' },
  show_employee_profile_image: { icon: 'user' },
  enable_unreturned_orders_popup: { icon: 'bell' },
  overdue_popup_threshold_days: { icon: 'alert' },
  overdue_popup_after_hour: { icon: 'clock' },
  kiosk_customer_self_service: { icon: 'users' },
  kiosk_allow_self_order: { icon: 'cart' },
  hide_error_reporting: { icon: 'alert' },
  error_report_handled_at_bottom: { icon: 'list' },
  error_report_human_button_enabled: { icon: 'user' },
  hide_ai_features: { icon: 'searchspark' },
  enable_ai_specific_employees: { icon: 'searchspark' },
  ai_screen_recording_enabled: { icon: 'eye' },
  cancel_order_permission: { wide: true },
  reserve_permission: { wide: true },
  neon_api_key: { label: 'מפתח API של Neon', icon: 'lock' },
  agent_fix_loop_enabled: { icon: 'sparkle' },
  agent_fix_loop_last_activity: { icon: 'clock' },
  email_link_a: { icon: 'send', ltr: true, ctl: 'text' },
  email_link_b: { icon: 'send', ltr: true, ctl: 'text' },
  email_routing_strategy: { icon: 'send', ctl: 'opts', wide: true },
  email_drive_folder_id: { icon: 'file', ltr: true },
});

// מפתחות שמקבלים את בוחר השעה של העיצוב (ערך HH:MM כמו היום).
export const TIME_KEYS = Object.freeze(['hok_auto_charge_hour', 'pickup_reminder_hour', 'daily_manager_report_hour', 'standard_return_hour']);

/* ------------------------------------------------------------------ מיפוי */

const KEY_TO_SECTION = (() => {
  const m = new Map();
  for (const s of SECTIONS) for (const k of s.keys) m.set(k, s);
  return m;
})();

/** הסעיף הממופה של מפתח, או null. */
export function sectionOfKey(key) {
  return KEY_TO_SECTION.get(key) || null;
}

/** איזה מסך מציג קטגוריה: site לקטגוריות המתכנת, sys לכל השאר (כמו filterCategoriesForMode). */
export function viewOfCategory(category) {
  return SETTINGS_DEVELOPER_CATEGORIES.includes(category) ? 'site' : 'sys';
}

/**
 * היכן שורת DB מוצגת: { view, tab, sectionId } או null (לא מוצגת — כמו היום).
 * @param {{key:string, category?:string|null}} row
 */
export function placeRow(row) {
  if (!row || !row.key || HIDDEN_KEYS.includes(row.key)) return null;
  const sec = sectionOfKey(row.key);
  // המסך (sys / site) נקבע תמיד לפי הקטגוריה ב-DB, כמו היום — כדי שהגדרה שהנהלה ראשית רואה היום לא תעבור למסך המתכנת
  // (או להפך) רק בגלל המיפוי. מיפוי שסותר את מסך הקטגוריה נופל לסעיף "הגדרות נוספות" של הלשונית לפי הקטגוריה.
  if (sec && (!row.category || sec.view === viewOfCategory(row.category))) return { view: sec.view, tab: sec.tab, sectionId: sec.id };
  if (!row.category) return null;
  const view = viewOfCategory(row.category);
  const mapped = CATEGORY_TAB[row.category];
  const tabs = view === 'site' ? SITE_TABS : SYS_TABS;
  const tab = mapped && tabs.some((t) => t.id === mapped) ? mapped : (view === 'site' ? 'site_more' : 'more');
  return { view, tab, sectionId: `extra_${tab}` };
}

/* ------------------------------------------------------------------ טקסטים */

/** שורת המשנה מתחת לשם (החלטה J1 א'): המשפט הראשון, ונחתך לפני סוגריים או " - " — כמו בעיצוב. ההערה המלאה בטולטיפ. */
export function subline(note) {
  if (!note) return '';
  let s = String(note).trim();
  const dot = s.search(/\.(\s|$)/);
  if (dot >= 0) s = s.slice(0, dot + 1);
  const cut = [s.indexOf('('), s.indexOf(' - ')].filter((i) => i > 0);
  if (cut.length) s = s.slice(0, Math.min(...cut)).trim().replace(/[,:;]$/, '');
  return s;
}

/* ------------------------------------------------------------------ סוג הפקד */

/**
 * הפקד של שורה (מה-classifySettingField של הישן + הפקד של העיצוב):
 * toggle | number | time | text | textarea | secret | timestamp | select-opts | select-seg | select-pills | mandatory | groups | dept | methods
 */
export function controlOf(key, rawType, value) {
  const ui = KEY_UI[key] || {};
  const field = classifySettingField(key, rawType, value);
  if (field === 'boolean') return 'toggle';
  if (field === 'mandatoryFields') return 'mandatory';
  if (field === 'fieldGroups') return 'groups';
  if (field === 'select') {
    if (ui.ctl === 'seg') return 'select-seg';
    if (ui.ctl === 'pills') return 'select-pills';
    return 'select-opts';
  }
  if (field === 'department') return 'dept';
  if (field === 'secret') return 'secret';
  if (field === 'timestamp') return 'timestamp';
  if (field === 'number') return 'number';
  if (ui.ctl === 'methods') return 'methods';
  if (TIME_KEYS.includes(key)) return 'time';
  // כתובות URL ארוכות: שדה שורה אחת כמו בעיצוב (הישן הפך כל ערך מעל 40 תווים ל-textarea; הערך עצמו זהה)
  if (ui.ctl === 'text') return 'text';
  if (field === 'multiline' || ui.ctl === 'textarea') return 'textarea';
  return 'text';
}

/** אפשרויות select — אותן אפשרויות של הישן (SETTINGS_SELECT_OPTIONS). */
export function selectOptions(key) {
  return SETTINGS_SELECT_OPTIONS[key] || [];
}

/** הערך שמוצג ב-select כשאין ערך (כמו הישן: PAYMENT_APPROVAL_LEVEL → 'כולם', gap_size_price_rule → 'none', אחרת האפשרות הראשונה). */
export function selectShownValue(key, raw) {
  if (raw) return raw;
  if (key === 'PAYMENT_APPROVAL_LEVEL') return 'כולם';
  if (key === 'gap_size_price_rule') return 'none';
  const o = selectOptions(key);
  return o.length ? o[0].value : '';
}

/* ------------------------------------------------------------------ מתגים */

/** האם המתג מוצג "פעיל" — בדיוק כמו uiValue של הישן (hide_* הפוך), חוץ מ-polarity:'raw'. */
export function toggleShownOn(key, raw) {
  const inverted = INVERTED_DISPLAY_KEYS.includes(key) && (KEY_UI[key] || {}).polarity !== 'raw';
  const ui = inverted ? (raw === 'true' ? 'false' : 'true') : raw;
  return ui === 'true';
}

/** הערך הגולמי שנכתב בלחיצה — אותה נוסחה של handleToggle בישן. */
export function toggleNextRaw(key, raw) {
  const inverted = INVERTED_DISPLAY_KEYS.includes(key) && (KEY_UI[key] || {}).polarity !== 'raw';
  if (inverted) {
    const ui = raw === 'true' ? 'false' : 'true';
    return ui === 'true' ? 'true' : 'false';
  }
  return raw === 'true' ? 'false' : 'true';
}

/* ------------------------------------------------------------------ שדות חובה (mandatory_fields) */

// העתק של CUSTOMER_FIELDS / ENFORCEABLE_FIELD_KEYS ב-SettingsClient.js (הבדיקה משווה).
export const CUSTOMER_FIELDS = Object.freeze([
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
  { key: 'bankAccount', name: 'חשבון בנק', alias: 'חשבון' },
]);
export const ENFORCEABLE_FIELD_KEYS = Object.freeze(['firstName', 'lastName', 'phone1', 'email', 'city', 'street', 'houseNum']);
// סדר הלחצנים בעיצוב: שם פרטי, שם משפחה, טלפון ראשי, אימייל, עיר, רחוב, מספר בית — כמו filter של הישן על CUSTOMER_FIELDS.
export const ENFORCEABLE_FIELDS = Object.freeze(CUSTOMER_FIELDS.filter((f) => ENFORCEABLE_FIELD_KEYS.includes(f.key)));

function splitItems(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function matchesField(item, field) {
  return item.toLowerCase() === field.key.toLowerCase() || item === field.name || item === field.alias;
}

export function mandatoryIsSelected(value, field) {
  return splitItems(value).some((i) => matchesField(i, field));
}

/** אותו toggleField של CustomerFieldsCheckboxPicker: הסרה = כל הצורות (key/name/alias), הוספה = alias בסוף; join(', '). */
export function mandatoryToggle(value, field) {
  const items = splitItems(value);
  const next = items.some((i) => matchesField(i, field))
    ? items.filter((i) => !matchesField(i, field))
    : [...items, field.alias || field.name];
  return next.join(', ');
}

/** ערכים ברשימה שאינם אחד מ-7 השדות (נשמרים כמו שהם; מוצגים כשורת מידע). */
export function mandatoryUnknown(value) {
  return splitItems(value).filter((i) => !ENFORCEABLE_FIELDS.some((f) => matchesField(i, f)));
}

/* ------------------------------------------------------------------ קבוצות "אחד מספיק" (mandatory_field_groups) */

export function parseGroups(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((g) => Array.isArray(g)) : [];
  } catch {
    return [];
  }
}
/** אותו commit של FieldGroupsEditor: קבוצות ריקות נמחקות. */
export function serializeGroups(groups) {
  return JSON.stringify(groups.filter((g) => g.length > 0));
}
export function fieldName(key) {
  const f = CUSTOMER_FIELDS.find((x) => x.key === key);
  return f ? f.name : key;
}

/* ------------------------------------------------------------------ מחלקות (cancel_order_permission / reserve_permission) */

export function deptToggle(value, name) {
  const list = splitItems(value);
  const next = list.includes(name) ? list.filter((d) => d !== name) : [...list, name];
  return next.join(', ');
}
export function deptSelected(value) {
  return splitItems(value);
}

/* ------------------------------------------------------------------ אמצעי תשלום (ALLOWED_PAYMENT_METHODS) */

// ברירת המחדל של הקוד כשאין שורה (app/orders/new/page.js computePaymentMethodOptions) — מוצעות כלחצנים.
export const DEFAULT_PAYMENT_METHODS = Object.freeze(['אשראי (דרך נדרים פלוס)', 'מזומן', 'יציאה באישור מנהל']);

/** הלחצנים: הערכים השמורים (בסדר שלהם), ואחריהם ערכי ברירת המחדל שאינם ברשימה, ואחריהם ערכים שנוספו עכשיו. */
export function methodChoices(savedValue, currentValue) {
  const out = [];
  const add = (x) => { if (x && !out.includes(x)) out.push(x); };
  splitItems(savedValue).forEach(add);
  DEFAULT_PAYMENT_METHODS.forEach(add);
  splitItems(currentValue).forEach(add);
  return out;
}
/** הערך החדש אחרי הדלקה/כיבוי: סדר הבחירות, מופרד בפסיק (הקורא מפצל לפי ',' ומנקה רווחים). */
export function methodsToggle(choices, currentValue, method) {
  const on = new Set(splitItems(currentValue));
  if (on.has(method)) on.delete(method); else on.add(method);
  const next = choices.filter((c) => on.has(c)).join(',');
  // חייב להישאר לפחות אמצעי תשלום אחד: ערך ריק נשמר כ-'' והצרכנים (הזמנה חדשה, דוחות) חוזרים לברירות מחדל שונות זה מזה
  return next === '' && on.size === 0 ? String(currentValue || '') : next;
}
/** האם כיבוי האמצעי הזה ישאיר רשימה ריקה (ואז methodsToggle לא משנה כלום). */
export function methodsWouldEmpty(currentValue, method) {
  const list = splitItems(currentValue);
  return list.length > 0 && list.every((m) => m === method);
}
export function methodsAdd(choices, currentValue, method) {
  const m = String(method || '').trim().replace(/,/g, ' ');
  if (!m) return currentValue || '';
  const on = splitItems(currentValue);
  if (on.includes(m)) return currentValue;
  const all = choices.includes(m) ? choices : [...choices, m];
  return all.filter((c) => on.includes(c) || c === m).join(',');
}
export function methodsSelected(currentValue) {
  return splitItems(currentValue);
}

/* ------------------------------------------------------------------ שינויים ושמירה */

/** הוספת שינוי — כמו handleChange בישן, כולל הזוגות המסונכרנים. מחזיר אובייקט חדש. */
export function applyChange(modified, key, value) {
  const next = { ...modified, [key]: value };
  for (const [a, b] of SYNCED_PAIRS) {
    if (key === a) next[b] = value;
    if (key === b) next[a] = value;
  }
  return next;
}

/** ביטול שינוי של מפתח אחד (וזוגו). */
export function revertChange(modified, key) {
  const next = { ...modified };
  delete next[key];
  for (const [a, b] of SYNCED_PAIRS) {
    if (key === a) delete next[b];
    if (key === b) delete next[a];
  }
  return next;
}

/** מנקה שינויים שחזרו לערך המקורי (שורה "שונה" נעלמת כשמחזירים ידנית) — הזוגות נשמרים יחד. */
export function pruneUnchanged(modified, originals) {
  const next = { ...modified };
  for (const k of Object.keys(next)) {
    const orig = originals[k] === undefined || originals[k] === null ? '' : String(originals[k]);
    // סוד ריק = "לא נגעו" (שדה שרק הפוקוס שלו עבר לא מוחק אישור). מחיקה אמיתית רק דרך SECRET_CLEAR_MARKER ("נקה ערך").
    if (SECRET_SETTING_KEYS.includes(k) && String(next[k]) === '') { delete next[k]; continue; }
    if (String(next[k]) === orig) {
      const pair = SYNCED_PAIRS.find((p) => p.includes(k));
      if (pair) {
        const other = pair[0] === k ? pair[1] : pair[0];
        const origOther = originals[other] === undefined || originals[other] === null ? '' : String(originals[other]);
        if (next[other] !== undefined && String(next[other]) !== origOther) continue;
      }
      delete next[k];
    }
  }
  return next;
}

/** גוף ה-POST — בדיוק כמו הישן: [{ key, value }] של כל השינויים (סוד שלא נגעו בו לא נשלח בכלל). */
export function buildPayload(modified) {
  return Object.entries(modified)
    .filter(([key, value]) => !(SECRET_SETTING_KEYS.includes(key) && (value === '' || value === SECRET_MASK)))
    .map(([key, value]) => ({ key, value }));
}

/** שגיאת ולידציה (מספר / select) — אותן פונקציות של הישן ושל השרת; null = תקין. */
export function validationError(key, value) {
  return validateNumericSetting(key, value) || validateSelectSetting(key, value);
}
/** השגיאה הראשונה שחוסמת שמירה, כמו handleSave בישן (רק מספרים) + הכפתור הנעול (מספרים + select). */
export function firstValidationError(modified) {
  for (const [k, v] of Object.entries(modified)) {
    const e = validationError(k, v);
    if (e) return { key: k, error: e };
  }
  return null;
}

export function numberLimit(key) {
  return NUMBER_FIELD_LIMITS[key] || null;
}
/** ניקוי הקלדה במספר — כמו הישן: ספרות בלבד (ונקודה כשמותר עשרוני). */
export function cleanNumberInput(key, text) {
  const lim = NUMBER_FIELD_LIMITS[key];
  return String(text || '').replace(lim && lim.allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
}
/**
 * +/- של הסטפר: צעד 1 (0.1 לעשרוני), בגבולות. ריק נחשב 0 ב-"+".
 * בשדות שבהם ריק הוא מצב משמעותי (allowEmpty: instant_undo_minutes — ריק = כמו זיכוי דמי ביטול, 0 = בלי ביטול מיידי;
 * swap_min_days_before_event — ריק = בלי הגבלה) לחיצה על "-" על שדה ריק משאירה אותו ריק, ולא הופכת ל-0.
 */
export function stepNumber(key, text, dir) {
  const lim = NUMBER_FIELD_LIMITS[key];
  const step = lim && lim.allowDecimal ? 0.1 : 1;
  let v = parseFloat(text);
  if (Number.isNaN(v)) {
    if (dir < 0 && lim && lim.allowEmpty) return '';
    v = 0;
  }
  let nv = Math.round((v + dir * step) * 10) / 10;
  const min = lim ? lim.min : 0;
  if (nv < min) nv = min;
  if (lim && nv > lim.max) nv = lim.max;
  return String(nv);
}
export function numberPlaceholder(key) {
  const lim = NUMBER_FIELD_LIMITS[key];
  if (!lim) return 'הזן מספר בלבד...';
  return `מספר בין ${lim.min} ל-${lim.max}${lim.emptyHint ? ` (${lim.emptyHint})` : ''}...`;
}

/* ------------------------------------------------------------------ שעה (בוחר השעה של העיצוב) */

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const p2 = (n) => (n < 10 ? '0' : '') + n;
export function normTime(v) {
  const m = TIME_RE.exec(String(v || '').trim());
  return m ? `${p2(+m[1])}:${m[2]}` : null;
}
/** השלמת הקלדה חופשית כמו commit() בעיצוב: "9" → 09:00, "930" → 09:30, "1745" → 17:45; לא תקין → null. */
export function commitTime(text) {
  const n = normTime(text);
  if (n) return n;
  const d = String(text || '').replace(/\D/g, '');
  if (d.length === 1 || d.length === 2) return normTime(`${d}:00`);
  if (d.length === 3) return normTime(`${d[0]}:${d.slice(1)}`);
  if (d.length === 4) return normTime(`${d.slice(0, 2)}:${d.slice(2)}`);
  return null;
}

/* ------------------------------------------------------------------ בניית המודל */

/**
 * בונה את המודל של מסך (sys / site) משורות GET /api/settings:
 * { tabs: [{ ...tab, sections: [{ id, title, icon, special?, rows: [row] }], count }] }
 * row = { key, label, note, sub, icon, ctl, wide, ltr, rows, inputType, category, value (המקורי), dbType, secret }
 * לשונית בלי שורות ובלי בלוק מיוחד מושמטת (כמו קטגוריה שאין לה שורות היום).
 */
export function buildViewModel(view, settings) {
  const tabsDef = view === 'site' ? SITE_TABS : SYS_TABS;
  const byTab = new Map(tabsDef.map((t) => [t.id, new Map()]));
  const ensureSection = (tab, sec) => {
    const m = byTab.get(tab);
    if (!m.has(sec.id)) m.set(sec.id, { id: sec.id, title: sec.title, icon: sec.icon, special: sec.special || null, rows: [], order: sec.order });
    return m.get(sec.id);
  };
  // סעיפי העיצוב לפי הסדר (גם ריקים — בלוקים מיוחדים נשארים, שורות ריקות מסוננות בסוף)
  SECTIONS.forEach((s, i) => { if (s.view === view) ensureSection(s.tab, { ...s, order: i }); });
  const rows = Array.isArray(settings) ? settings : [];
  for (const r of rows) {
    const place = placeRow(r);
    if (!place || place.view !== view) continue;
    let sec;
    if (place.sectionId.startsWith('extra_')) {
      sec = ensureSection(place.tab, { id: place.sectionId, title: EXTRA_SECTION_TITLE, icon: 'list', order: 9999 });
    } else {
      sec = byTab.get(place.tab).get(place.sectionId);
    }
    sec.rows.push(makeRow(r));
  }
  const out = [];
  for (const t of tabsDef) {
    const secs = [...byTab.get(t.id).values()]
      .map((s) => {
        if (s.order !== 9999) {
          const def = SECTIONS[s.order];
          s.rows.sort((a, b) => def.keys.indexOf(a.key) - def.keys.indexOf(b.key));
        }
        return s;
      })
      .filter((s) => s.rows.length > 0 || s.special)
      .sort((a, b) => a.order - b.order);
    const hasRows = secs.some((s) => s.rows.length > 0);
    const hasSpecial = secs.some((s) => s.special);
    if (!hasRows && !hasSpecial) continue;
    // הבלוק "קבצי מיתוג" / "הרשאות" לבדו לא מחייב לשונית — אבל לוגו והרשאות קיימים תמיד בישן (לשונית "תצוגה"), ולכן נשארים.
    out.push({ ...t, sections: secs.map(({ order, ...s }) => s), count: secs.reduce((n, s) => n + s.rows.length, 0) });
  }
  return { view, tabs: out };
}

export function makeRow(r) {
  const ui = KEY_UI[r.key] || {};
  const note = getSettingNotes(r.key, r.notes);
  const label = ui.label || getSettingDisplayName(r.key, r.name);
  const ctl = controlOf(r.key, r.type, r.value);
  const secret = SECRET_SETTING_KEYS.includes(r.key);
  return {
    key: r.key,
    label,
    note,
    sub: secret ? 'הערך נשמר מוצפן ולא מוצג שוב לאחר השמירה.' : subline(note),
    icon: ui.icon || (r.category === 'לא בשימוש' ? 'info' : 'gear'),
    ctl,
    wide: !!ui.wide || ctl === 'textarea' || ctl === 'select-opts' || ctl === 'select-pills' || ctl === 'mandatory' || ctl === 'groups' || ctl === 'dept',
    ltr: !!ui.ltr,
    rows: ui.rows || 3,
    inputType: ui.inputType || 'text',
    category: r.category || null,
    value: r.value === null || r.value === undefined ? '' : String(r.value),
    secret,
  };
}

/** נוסח קצר לערך (פאנל השינויים / חלון "שינויים שלא נשמרו"): מתג → פעיל/כבוי, select → התווית, סוד → מוסתר, ריק → "ריק". */
export function shownValue(row, raw) {
  if (!row) return String(raw ?? '');
  if (row.ctl === 'toggle') return toggleShownOn(row.key, raw) ? 'פעיל' : 'כבוי';
  if (row.secret) return raw === SECRET_MASK ? 'מוגדר' : raw === SECRET_CLEAR_MARKER ? 'יימחק' : raw ? 'ערך חדש' : 'ריק';
  if (row.ctl.startsWith('select')) {
    const v = selectShownValue(row.key, raw);
    const o = selectOptions(row.key).find((x) => x.value === v);
    return o ? o.label : v || 'ריק';
  }
  if (row.ctl === 'groups') {
    const g = parseGroups(raw);
    return g.length ? g.map((x) => x.map(fieldName).join(' / ')).join(' · ') : 'ללא';
  }
  const s = String(raw ?? '');
  return s === '' ? 'ריק' : s;
}

/** קיצור לפאנל (כמו cutTxt בעיצוב: עד 26 תווים). */
export function cutTxt(t) {
  const s = String(t);
  return s.length > 26 ? `${s.slice(0, 25)}…` : s;
}

/* ------------------------------------------------------------------ חיפוש */

export function normSearch(s) {
  return String(s || '').toLowerCase().replace(/[״"׳'`]/g, '').replace(/\s+/g, ' ').trim();
}
/** שורה מתאימה לחיפוש: שם, הערה, מפתח, וכותרת הסעיף (כמו data-find בעיצוב). */
export function rowMatches(row, sectionTitle, q) {
  const n = normSearch(q);
  if (!n) return true;
  const hay = normSearch(`${row.label} ${row.note} ${row.key} ${sectionTitle || ''}`);
  return hay.includes(n);
}

/** מקבל ?tab=<קטגוריה>&highlight=<key> של הקישורים הישנים (SettingQuickPanel / AI) ומחזיר את הלשונית במסך החדש. */
export function tabForDeepLink(model, tabParam, highlightKey) {
  if (!model || !model.tabs.length) return null;
  if (highlightKey) {
    const t = model.tabs.find((tb) => tb.sections.some((s) => s.rows.some((r) => r.key === highlightKey)));
    if (t) return t.id;
  }
  if (tabParam) {
    if (model.tabs.some((t) => t.id === tabParam)) return tabParam;
    const mapped = CATEGORY_TAB[tabParam];
    if (mapped && model.tabs.some((t) => t.id === mapped)) return mapped;
  }
  return null;
}
