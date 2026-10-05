# הגדרות מערכת בעיצוב "סימולציה" — תוכנית בנייה (4.10.2026)

ענף: `feature/settings-sim-2026-10-04` (worktree `C:\Users\moshe\Desktop\wt-settings`, sparse, בסיס origin/main 5193696c).
העיצוב: `תצוגות-עיצוב\הגדרות-סימולציה.html` (שלושה מסכים: `sys` = הגדרות מערכת, `site` = הגדרות אתר, `names` = שינוי שמות; `hub` = מסך הניהול — כבר נבנה בנפרד, לא כאן).
תשובות הבעלים: `Downloads\החלטות-settings-sim.json` (10/358). שאר השאלות: `_qpanel\settings-sim.questions.js` → הנחות ב-`ASSUMPTIONS.md`.

## 0. מקור המיפוי
העיצוב נושא אינדקס סקירה מובנה (`var RV={items:[…]}` בתוך הקובץ, 342 פריטים):
* `P###` (kind p, 204) — הגדרה **קיימת היום** במיקום מוצע: `key` = המפתח האמיתי, `tab`/`section` = המקטע/הסעיף בעיצוב.
* `M###` (kind m, 28) — שורה בעיצוב שיש לה **מקבילה קיימת** (`key`), `status` = `map` (אותה משמעות) או `partial` (משמעות שונה).
* `S###` (kind o, 68) — **קיים רק בדגימה**, אין לו מקבילה באתר.
המיפוי בקוד: `lib/settingsSimLayout.js` (טהור, נבדק ב-`scripts/test_settings_sim.mjs`).

## 1. מקטע בעיצוב ← מפתחות אמיתיים

### מסך `sys` (/admin/settings — הנהלה ראשית + מתכנת)
| מקטע (לשונית) | סעיף | מפתחות |
|---|---|---|
| תצורה `cfg` | פרטי הגמ״ח | gmach_name (M001 "שם הגמ״ח"), gmach_phone (M003 "טלפון ראשי"), main_email (M004 "מייל ראשי"), gmach_address |
| | כללי השכרה | BUFFER_DAYS (M005, partial ← שם/פקד אמיתי), enable_rental_extension (M006, partial ← מתג אמיתי), hide_gregorian_calendar (M007 "תאריכים עבריים בלבד", map, קוטביות ישירה), hide_custom_spacing |
| | כללי מערכת | require_login, item_locations |
| | סניפים | branches_enabled, branch_list, track_branch_on_order |
| מיתוג `brand` | זהות המערכת | home_welcome_title (M009 "כותרת דף הבית") |
| | קבצי מיתוג | העלאת לוגו (POST /api/upload-logo, M010 — רק הלוגו קיים) |
| תשלומים `pay` | אמצעי תשלום פעילים | ALLOWED_PAYMENT_METHODS (M011 "אמצעים שמוצגים בהזמנה", גלולות), PAYMENT_APPROVAL_LEVEL (כרטיסי אפשרות), allow_additional_payment_on_order, consolidate_manual_payment_credit_ui |
| | מדיניות זיכויים וביטולים | instant_undo_minutes (M012), CANCELLATION_CREDIT_MINUTES (M013), REFUND_PERCENTAGE, REFUND_DAYS_FROM_ORDER, NO_REFUND_DAYS_BEFORE_EVENT, REFUND_REPAIRS, refund_tiers_at_deletion_time, ENABLE_SET_DISCOUNTS |
| | תמחור | premium_pricing_enabled (M014), premium_categories |
| | החלפת מידה | same_model_swap_no_fee, swap_min_days_before_event, swap_same_category_only, swap_pairing_window_minutes, size_edit_until_days_before_event, gap_size_price_rule (seg) |
| | סליקת אשראי – נדרים פלוס | nedarim_plus_enabled, nedarim_plus_terminal (מסונכרן עם NEDARIM_MOSAD), nedarim_plus_token (סוד), nedarim_rinat_lev_url |
| | הוראת קבע (הו״ק) | hok_enabled, hok_auto_charge_enabled, hok_auto_charge_hour (בוחר שעה), hok_charge_amount, auto_charge_damaged_return |
| ברקודים `bc` | סריקה | barcodePrefixLength (M015 "אורך מספר הדגם") |
| | ברקוד ידני ולא תקין | manual_barcode_double_entry, barcode_invalid_list, manual_barcode_daily_report |
| הודעות `msg` | מיילים אוטומטיים ללקוחות | auto_email_on_order_create (M017), pickup_reminder_enabled (M018), pickup_reminder_hour, late_return_email_enabled, late_return_email_text, late_return_threshold_days, bulk_email_by_event_date |
| | דוח יומי למנהל | daily_manager_report_hour (M020), daily_manager_report_enabled (M021), daily_manager_report_email |
| | רשימת תפוצה | mailing_list_auto_sync, mailing_list_provider |
| | הודעות פנימיות | shift_handover_notes, management_messages, notify_on_new_message_at_login, laundress_return_check_on_exit |
| | עדכון ענפי תיקון (גמח ראשי בלבד) | agent_digest_email_enabled, agent_digest_email_hours |
| אוטומציה `auto` | גיבוי אוטומטי | backup_enabled (M023), backup_interval_hours, backup_drive_folder_id, backup_owner_email (קטגוריה "גיבויים" — מוצגת היום כלשונית משלה) |
| סנכרון `sync` | ימות המשיח | yemot_enabled, yemot_api_url, yemot_api_token (סוד), yemot_queue_view_enabled, yemot_import_customer_enabled |
| הזמנות `ord` | שדות חובה בלקוח | require_customer_email, require_full_address, require_marketing_consent, hide_marketing_consent_field, require_customer_id_number, mandatory_fields (גלולות), mandatory_field_groups (עורך קבוצות), strict_mandatory_fields |
| | אימות והרשאות בהזמנה | require_id_for_edit_cancel, require_manager_code_for_item_changes, allow_edit_partially_rented |
| | מגבלות | max_items_per_order, enforce_strict_max_items |
| | מסך ההזמנה | draft_orders_show_as_deleted, enable_local_order_drafts, enable_order_edit_summary_confirm, auto_print_on_order_create, phone_order_marker_enabled, enable_alterations, order_new_redirect_screen, order_edit_redirect_screen (גלולות) |
| משלוחים `dlv` | הפעלה ומחירים / תזמון / משלוחן | enable_deliveries, delivery_price, delivery_price_by_city, delivery_show_in_order, delivery_allow_address_override / delivery_days_before, delivery_days_after, delivery_skip_weekends, delivery_one_day_before_option, deliveries_select_by_event_date, delivery_table_range_enabled / courier_name, courier_email |
| מלאי ויומן `inv` | מלאי | inventory_include_warehouse, allow_renting_reserve_items, inventory_hold_minutes |
| | רווחים בין השכרות | inventory_buffer_days (מסונכרן עם BUFFER_DAYS), inventory_skip_weekends |
| | בקרה בהשכרה ובהחזרה | enforce_rental_barcode_match, require_approval_for_early_return |
| הדפסה `prn` | מסמכי השכרה מודפסים | print_rental_box1/2, print_rental_footer, standard_return_hour, standard_pickup_hours, rental_belt_notice |
| | הדפסת אצווה ומיון | enable_batch_print_prep, print_sort_deliveries_first, print_mark_missing_dresses |
| תצוגה וממשק `disp` | תצוגה כללית | hide_dress_images, useModelNames, useFileNamesForImages, hide_internal_messaging, show_not_taken_orders, hide_taken_orders_from_orders_list, cancellation_extra_columns, rentals_sort_recent_first, show_employee_profile_image, enable_unreturned_orders_popup |
| | עמדת לקוח (קיוסק) | kiosk_customer_self_service, kiosk_allow_self_order |
| | דיווחי שגיאות | hide_error_reporting, error_report_handled_at_bottom, error_report_human_button_enabled |
| | בינה מלאכותית | hide_ai_features, enable_ai_specific_employees, ai_screen_recording_enabled |
| | הרשאות | שורת קישור "ניהול הרשאות (מחלקות ועובדים)" → /admin/permissions (לחצן עם אייקון קישור חיצוני — **החלטת הבעלים P008**) |
| לא בשימוש `unused` (מעומעם) | מפתחות שאינם נקראים בקוד | has_variations, has_underskirts, dress_size_min/max/even_only, items_name_singular/plural, barcode_length, allow_date_change, allow_free_exchange, cancel_order_permission + reserve_permission (בוחר מחלקות), max_order_days_ahead, refund_per_item, REFUND_DAYS, registration_fee, calendar_filtering, gmach_subtitle, restrict_*, allow_shift_lead_reserve_rental, allow_alterations, split_dress_enabled |

### מסך `site` (/admin/site-settings — מתכנת בלבד)
| מקטע | סעיף | מפתחות |
|---|---|---|
| מסד נתונים `db` | סביבה וחיבורים | "סביבת עבודה" = מצב האתר החי (GET/POST /api/admin/db-mode, M024) — לא חלק מהשמירה המרוכזת, מאושר בחלון |
| | צריכת מסד הנתונים (Neon) | 4 שורות קריאה בלבד מ-/api/admin/neon-usage (מחשוב / אחסון / תעבורה / עלות) + neon_api_key (סוד) |
| מערכת `sys` | סוכן תיקון אוטומטי | agent_fix_loop_enabled, agent_fix_loop_last_activity (קריאה בלבד, תאריך עברי) |
| מיילים `mail` | קישורי שליחה וניתוב | email_link_a, email_link_b, email_routing_strategy (כרטיסי אפשרות), email_drive_folder_id |
| כותרת | — | לחצן "יומן מיילים" → /admin/site-settings/email-logs (P182) |

### מסך `names` (/admin/labels — מתכנת בלבד)
6 קבוצות אמיתיות (P198-P203: לקוחות, הזמנות, דגמים ופריטים, השכרות, זמינות לקוח, כותרות טאבים) כלשוניות; טבלת שורות: ברירת מחדל | כיתוב | חזרה לברירת מחדל. "שחזר ברירת מחדל" לכל הכיתובים (P197). שמירה: POST /api/settings/labels עם האובייקט המלא, כמו היום.

### מפתחות שלא מופיעים בעיצוב (חייבים להישאר נגישים)
`non_working_days_extra` (יומן), `login_page_new` (תצוגה), `full_refund_days` (מספר, אם קיים ב-DB), וכל שורת DB שהמפתח שלה לא במיפוי (למשל `ui_labels_mapping` בקטגוריה `ui_label`, `ui_variant_*`).
כלל: מפתח לא ממופה → הלשונית לפי הקטגוריה שלו (טבלת `CATEGORY_TAB` — כללי→תצורה, תצוגה/בינה מלאכותית→תצוגה וממשק, אוטומציה/הודעות→הודעות, יומן/מלאי→מלאי ויומן, גיבויים→אוטומציה …), בסעיף **"הגדרות נוספות"** בסוף הלשונית; קטגוריה לא מוכרת → לשונית **"הגדרות נוספות"** בסוף הסרגל. כך שום שורה שמוצגת היום לא נעלמת. שורה בלי קטגוריה (שהיום לא מוצגת בכלל) — לא מוצגת גם כאן, אלא אם המפתח ממופה במפורש. `NEDARIM_MOSAD` מוסתר כמו היום (מסונכרן עם nedarim_plus_terminal). קטגוריות המתכנת (מסד נתונים / מערכת / מיילים) רק ב-`site`, כמו `filterCategoriesForMode` היום.

### שורות שקיימות רק בעיצוב (S, 52 הגדרות + פריטי מבנה) — לא נבנות
החלטה כללית `g:bulk_sample_only` (ברירת מחדל A = "לא להכניס לאתר"): שעות פתיחה/סגירה, ימי פעילות, משך השכרה, הזמנה עם משלוח כברירת מחדל, ברכת פתיחה, שאלת החיפוש, כיתוב סניף בתחתית, מראה החלונות/הנפשות/הברקה, תשלום חלקי, פיקדון, דמי ביטול/החלפה קבועים, ברירת מחדל בזיכוי, מע״מ, קידומת ברקוד/הוספה אוטומטית/צליל, מדבקות, מיילי זיכוי/ביטול, ימי הודעת בוקר, התראות במערכת (ת״ז/מלאי), כללים אוטומטיים (החזרה/ניקיון/ארכוב/נעילה), בדיקות מלאי, מקורות/יומן סנכרון, חיבורים/המתנה/שמירת גיבויים, מצב תחזוקה/לוג/כניסה מהירה/משך התחברות/אזור זמן, פעולות תחזוקה, שולח/חתימה/שליחה בפועל/BCC, באנרים מומצאים (מדיניות חלה על הזמנות חדשות, כיבוי גיבוי לילי), כרטיס "מחובר למסד", קבוצות כיתובים מדגימה (ניווט/כרטיס הזמנה/תשלום/כללי), תצוגה מקדימה של כיתוב.
**אין צורך ב-DDL** (אין שדה חדש) — כל אחד מאלה דורש פיצ'ר חדש ולא רק עמודה; מתועד ב-ASSUMPTIONS.md כשאלה לבעלים. `PENDING-DDL.md` ריק.

מבנה מהעיצוב שכן נבנה: חיפוש הגדרה עם ספירה (S001 — **הבעלים: להכניס**), פאנל "שינויים לשמירה" + ביטול (S002 — **הבעלים: להכניס**), אותם רכיבים גם ב-site/names (S045/S046/S063/S067 — הנחה: אותו רכיב), חלון "שינויים שלא נשמרו" (g:unsaved_dialog A), חלון אישור הנהלה בלי סשן (J6 A, C3 A).

## 2. הרשאות (בלי שינוי)
* צפייה: `/admin/*` — `app/admin/layout.js` (הנהלה ראשית 0 / מתכנת 2). `/admin/site-settings`, `/admin/labels` — layout נוסף, מתכנת בלבד.
* שמירה: `POST /api/settings` — `checkAuth('הנהלה ראשית')` או (401) אישור חד-פעמי employeeId+pin של הנהלה/מתכנת (חלון כהה משלנו במקום `window.customAuthPrompt`). `POST /api/settings/labels` — `checkAuth('מנהל')` כמו היום. `POST /api/admin/db-mode`, `/api/upload-logo` — כמו היום.
* "ישן / חדש": מסך `settings` (`ui_variant_settings`) — ברירת מחדל ישן לכולם, מתכנת (roleId 2) חדש. עקיפה אישית / הגדרת ארגון כמו שאר המסכים. **דגל תצוגה בלבד** — לא גבול הרשאות.

## 3. ארכיטקטורה
* `app/admin/settings/page.js`, `app/admin/site-settings/page.js`, `app/admin/labels/page.js` — נתיב דק (שרת): `getRequestUiVariant('settings')` → `Legacy*` (העתק מילולי של הדף הישן) או `SettingsSimSwitch` (לקוח, `dynamic(..., {ssr:false})`).
* `app/components/settings-sim/` — `SettingsSimPage.js` (מעטפת: כותרת, חיפוש, סרגל צד, פאנל שינויים, באנרים, חלונות), `SettingRow.js` (פקדים), `SettingsDialogs.js`, `settings-sim.css` (בהיקף `.gm-ds.gm-st`).
* `lib/settingsSimLayout.js` — מיפוי לשוניות/סעיפים/תוויות/פקדים, `buildSysModel(rows, mode)`, `mandatory*`/`groups*`/`methods*` טהורים, `diffPayload`.
* שורש: `className="gm-ds gm-st home-bg dlg-dark"`, sprite `HomeSprite` (`#gmi-…`), `data-tip` + `usePageTooltip`, חלונות `.scrim > #dlg` ב-portal לשורש הדף, טוסט/באנר `nb`, בלי alert/confirm.

## 4. תוכנית בדיקות
1. `scripts/test_settings_sim.mjs` (node בלבד):
   * **פריטי כיסוי**: כל מפתח במטא-דאטה (SETTINGS_ORDER ∪ HEBREW_NAMES ∪ BOOLEAN/NUMBER) + כל שורת DB מדומה בכל קטגוריה → מקבל לשונית במסך הנכון (`sys`/`site`) או מוסתר רק אם הישן מסתיר (NEDARIM_MOSAD, בלי קטגוריה).
   * אין מפתח שמופיע פעמיים; כל מפתח במיפוי קיים במטא-דאטה או ברשימת "ידועים בלי שם" (inventory_hold_minutes, standard_pickup_hours, backup_*).
   * **מטען שמירה זהה**: `buildPayload(modified)` = `Object.entries(modified).map(([key,value])=>({key,value}))` של הישן, כולל זוגות מסונכרנים (BUFFER_DAYS↔inventory_buffer_days, NEDARIM_MOSAD↔nedarim_plus_terminal), מתגים הפוכים (hide_*) כותבים את אותו ערך גולמי, סוד שלא נגעו בו לא נשלח.
   * לוגיקת שדות חובה (בחירה/ביטול לפי key/name/alias, שמירת ערכים לא מוכרים), קבוצות (JSON), אמצעי תשלום, מחלקות, ולידציה (validateNumericSetting/validateSelectSetting).
   * חיפוש (התאמה לפי שם/הערה/מפתח, ספירה לכל לשונית).
2. `node scripts/test_home_css_guard.mjs` (+ סעיף חדש ל-settings-sim.css: היקף `.gm-ds.gm-st`, אין `.gm-home` בשורש, אין title=, אין alert/confirm), `test_ui_variant.mjs`, `test_menu_logic.mjs`.
3. בדיקה חזותית: `scripts/settings-sim-audit/` (כמו admin-hub-audit: esbuild של הרכיב האמיתי עם fetch מדומה, Chrome ללא מסך) מול צילומי העיצוב ב-1440 ו-390.
