// lib/adminOnlySettings.js - הגדרות מערכת ש-GET /api/settings לא מחזיר לעובד מחובר רגיל (החלטת הבעלים, 2026-10-12).
//
// שלוש דרגות קוראים (settingsViewerTier, בפועל lib/auth.js getSettingsViewerTier):
//   guest  - לא מחובר: רק PUBLIC_SETTING_KEYS (lib/publicSettings.js)
//   staff  - עובד מחובר בלי תפקיד הנהלה ראשית / מתכנת (כולל מנהל סניף): כל ההגדרות פרט לאלה שכאן
//   admin  - הנהלה ראשית (roleId 0) / מתכנת (roleId 2): הכול, כמו תמיד (סודות ממוסכים)
//   open   - מצב פתוח (require_login כבוי) וקורא בלי זהות: הכול, כמו תמיד. אין שם דרך לדעת מי הוא, ומסכי ההגדרות עצמם פתוחים לו בלי התחברות
//            (אישור בקוד + PIN בשמירה) - הסתרה שם הייתה מציגה להם ערכים ריקים. סיכון R1 המתועד: חובה לשמור require_login=true.
//
// מה נכנס לכאן: מפתח שנבדק ונמצא ש**אף מסך של עובד רגיל לא קורא אותו** מ-/api/settings (הבדיקה: scripts/settings-exposure-tests - סורק את כל קוד
// הלקוח שמחוץ לעץ האדמין, ונכשל אם מפתח מהרשימה הזו מופיע בו) והוא מזהה / כתובת / סוד / הגדרת אבטחה / תשתית. מפתח שמסך של עובד רגיל קורא
// נשאר גלוי גם אם הוא "ניהולי" לכאורה: למשל management_messages ו-shift_handover_notes (דף ההודעות /messages), main_email (הדפסת הזמנה / תיקונים),
// courier_name (כרטיס הזמנה), nedarim_plus_enabled (תשלום בהזמנה), require_login (דף הבית).
// מפתח שלא ידוע לרשימה נשאר גלוי לעובד מחובר (לא מפילים ממשק); בנוסף ADMIN_ONLY_KEY_PATTERN תופס מפתח חדש ששמו נראה כמו סוד.
//
// להוסיף מפתח: לבדוק שאין מסך לא-אדמין שקורא אותו (חיפוש בשם המפתח ב-app/ ו-components/ מחוץ ל-app/admin), להוסיף שורה עם נימוק, להריץ את הבדיקה.

export const ADMIN_ONLY_SETTING_REASONS = Object.freeze({
  // --- סליקה / ספקים חיצוניים: מזהי מוסד, קישורים וטוקנים (נקראים רק בשרת: app/lib/nedarimSettings.js, app/api/nedarim*, lib/yemot*)
  nedarim_plus_terminal: 'קוד מוסד / טרמינל נדרים פלוס - מזהה סולק (נקרא בשרת בלבד)',
  NEDARIM_MOSAD: 'כפיל של nedarim_plus_terminal (נשמר בסנכרון)',
  nedarim_rinat_lev_url: 'קישור הסליקה של נדרים פלוס - רינת לב (מופיע רק בעמוד העזרה של האדמין)',
  nedarim_plus_token: 'סוד: טוקן נדרים פלוס. גם המסכה חושפת שהוא מוגדר',
  yemot_api_url: 'כתובת ה-API של ימות המשיח (תשתית, נקראת בשרת)',
  yemot_api_token: 'סוד: טוקן ימות המשיח',
  neon_api_key: 'סוד: מפתח API של Neon',
  // --- דרייב / גיבוי / מצב גיבוי: מזהי תיקיות, מיילים של בעלים, מי רשאי להפעיל גיבוי
  email_drive_folder_id: 'מזהה תיקיית דרייב לשליחת קבצים (נקרא ב-lib/mailer.js בלבד)',
  backup_drive_folder_id: 'מזהה תיקיית דרייב של הגיבויים',
  backup_owner_email: 'כתובת מייל של בעל הגיבוי',
  backup_enabled: 'הפעלת גיבוי אוטומטי (תשתית; קורא רק האדמין והמשימה המתוזמנת)',
  backup_interval_hours: 'תדירות גיבוי (תשתית)',
  device_backup_employee_ids: 'מזהי עובדים שמורשים להפעיל מצב גיבוי במחשב שלהם (נקרא ב-lib/deviceBackupAccess.js / db-view/access בלבד)',
  web_backup_mode: 'מצב גיבוי של האתר (נקרא ב-app/lib/prisma.js ובבאנר דרך ה-layout, לא דרך ה-API)',
  // --- ניתוב מיילים וכתובות מייל פנימיות (נקראים ב-lib/mailer.js / lib/emailCatalog.js בשרת)
  email_link_a: 'כתובת פריסת Apps Script א (שליחת מיילים)',
  email_link_b: 'כתובת פריסת Apps Script ב',
  email_routing_strategy: 'אסטרטגיית ניתוב מיילים (תשתית)',
  daily_manager_report_email: 'כתובת מייל פנימית לדוח היומי',
  courier_email: 'כתובת מייל של המשלוחן',
  // --- הגדרות אבטחה והרשאות: מצב ההקשחה של הארגון (נקראות בשרת / בשערי ה-layout, לא בקוד לקוח)
  approval_tokens_required: 'הקשחה: אישור חוב מחייב קוד מנהל חתום',
  approval_permissions_enforced: 'הקשחה: אכיפת הרשאות אישור בשרת',
  restrict_dress_catalog_to_head_management: 'הגבלת קטלוג הדגמים להנהלה ראשית (נאכף בשער הדף)',
  restrict_refunds_to_head_management: 'הגבלת זיכויים וחובות להנהלה ראשית (נאכף בשער הדף)',
  restrict_board_to_managers: 'הגבלת הלוח החודשי למנהלים (נאכף בשער הדף)',
  cancel_order_permission: 'הרשאת ביטול הזמנה (מסך ההגדרות בלבד)',
  reserve_permission: 'הרשאת אישור שמלות רזרבה (מסך ההגדרות בלבד)',
  // --- תשתית סוכן התיקונים (מתכנת)
  agent_fix_loop_enabled: 'מתג לולאת התיקונים האוטומטית (נקרא דרך /api/agent/fix-loop)',
  agent_fix_loop_last_activity: 'חותמת פעילות פנימית של לולאת התיקונים',
});

export const ADMIN_ONLY_SETTING_KEYS = Object.freeze(Object.keys(ADMIN_ONLY_SETTING_REASONS));
const ADMIN_ONLY_SET = new Set(ADMIN_ONLY_SETTING_KEYS);

// רשת ביטחון למפתח חדש שעדיין לא ברשימה: שם שנראה כמו סוד / טוקן / מפתח API / סיסמה מוסתר מעובד רגיל (אף מסך לא אמור לקרוא סוד).
export const ADMIN_ONLY_KEY_PATTERN = /token|secret|api[_-]?key|passw|credential/i;

// מרכז המיילים (lib/emailConfig.js, lib/emailCampaign.js): עריכות ניסוח (email_tpl:*), שדות קבועים (email_fixed_fields) ומסמכי / היסטוריית דיוורים (email_campaign*).
// נקראים בשרת בלבד (שליחת מיילים) ודרך ה-API של מרכז המיילים (/api/admin/email-center/*, הנהלה ראשית) - אף מסך של עובד רגיל לא קורא אותם מ-/api/settings (סקירת אבטחה 12.10.2026).
export const ADMIN_ONLY_KEY_PREFIXES = Object.freeze(['email_campaign', 'email_tpl:', 'email_fixed_fields']);

export function isAdminOnlySettingKey(key) {
  return typeof key === 'string' && (ADMIN_ONLY_SET.has(key) || ADMIN_ONLY_KEY_PATTERN.test(key) || ADMIN_ONLY_KEY_PREFIXES.some((p) => key.startsWith(p)));
}

/** שורות הגדרה -> מה שעובד מחובר רגיל רואה: הכול פרט למפתחות "ניהול בלבד". */
export function toStaffSettings(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => r && !isAdminOnlySettingKey(r.key));
}

/**
 * שורות הגדרה לפי דרגת הקורא, לנתיבים שמחזירים ערכים מלאים (מדריך ההגדרות /api/settings/guide, /api/a5/settings, עוזר ה-AI):
 * הנהלה ראשית / מתכנת / מצב פתוח - הכול; כל דרגה אחרת (מנהל סניף, אורח) - בלי מפתחות "ניהול בלבד". מנהל סניף אינו יכול לשמור הגדרות ממילא (POST /api/settings = הנהלה ראשית).
 */
export function settingsRowsForTier(rows, tier) {
  return tier === 'admin' || tier === 'open' ? rows : toStaffSettings(rows);
}

/**
 * הדרגה של הקורא (פונקציה טהורה - ההחלטה על המצב הנתון; lib/auth.js getSettingsViewerTier מאסף את הנתונים).
 *  signedIn: checkAuth() (עוגייה תקפה, או מצב פתוח); hasIdentity: יש עוגיית עובד מאומתת; isHeadManagement: roleId 0/2.
 */
export function settingsViewerTier({ signedIn, hasIdentity, isHeadManagement }) {
  if (!signedIn) return 'guest';
  if (!hasIdentity) return 'open';
  return isHeadManagement ? 'admin' : 'staff';
}
