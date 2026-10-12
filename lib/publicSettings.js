// lib/publicSettings.js - אילו הגדרות מערכת (SystemSetting) מותר להחזיר מ-GET /api/settings למי שאינו מחובר.
//
// למה: ה-GET הזה היה ציבורי לגמרי (כל השורות, מלבד שלושה סודות ממוסכים) - כולל כתובות מייל, קודי מוסד סליקה, מזהי תיקיות דרייב,
// מדיניות החזרים ומחירים, דגלי הקשחה, רשימת עובדים של מצב גיבוי, הודעות הנהלה ועוד (2026-10-12, סוכן settings-exposure).
//
// הכלל: "מחובר" = checkAuth() (lib/auth.js) - עוגיית התחברות תקפה, או מצב פתוח (require_login כבוי: שם כל מבקר הוא צוות לפי הגדרת
// הארגון, וכל האתר פתוח ממילא). מחובר -> ההתנהגות הקודמת (כל ההגדרות, סודות ממוסכים). לא מחובר -> רק מה שברשימה הזו, ורק { key, value }.
// נכשל סגור: כל מפתח שלא ברשימה לא יוצא; שגיאה בבדיקת ההתחברות = לא מחובר (checkAuth עם failClosed).
//
// מה נכנס לרשימה (כל התנאים יחד):
//   1. מסך שנטען כשקיר ההתחברות של app/layout.js מורם (עמדת הלקוח הישנה /customer-interface, שעון נוכחות /punch-clock, ווידג'טים גלובליים
//      שנטענים גם שם) קורא את המפתח מ-/api/settings לפני שיש שם התחברות.
//   2. הערך הוא דגל תצוגה / התנהגות בלבד (true/false או שם גרסת עיצוב): בלי פרטי קשר, בלי מזהים, בלי כללים עסקיים (מחירים, מדיניות החזרים,
//      שדות חובה), בלי הגדרות אבטחה, בלי נתוני עובדים.
// מה לא צריך להיכנס: מסך הכניסה עצמו (LoginNew / LoginScreen) לא קורא כלום מ-/api/settings לפני ההתחברות - שם הגמ"ח, התמונה וגרסת הדף
// (login_page_new) מגיעים מהשרת בתוך app/layout.js. קריאת notify_on_new_message_at_login בהן נעשית רק אחרי שה-/api/login הצליח (העוגייה כבר קיימת).
// דפי /landing (קובץ סטטי), /privacy, /terms ו-/station לא קוראים את ה-API הזה בכלל (שרת: loadPublicKioskConfig / loadConsentContext).
//
// להוסיף מפתח לרשימה? רק אם מסך ציבורי באמת חייב אותו לפני התחברות, והערך לא יכול לחשוף כלום. הוסיפו שורה עם הנימוק; בדיקת
// scripts/settings-exposure-tests תכשל אם המפתח נראה רגיש (SENSITIVE_SETTING_KEY_PATTERN) או אם מסך ציבורי קורא מפתח שלא נמצא כאן.
// עמדת הלקוח הציבורית החדשה (/station, /api/public-kiosk/*) לא תלויה ברשימה הזו - יש לה allow-list משלה (lib/publicKiosk/config.js).

export const PUBLIC_SETTING_KEYS = Object.freeze([
  // --- שעון נוכחות (/punch-clock; PunchClockNew.js, PunchClockLegacy.js): נקרא לפני רישום יציאה
  'laundress_return_check_on_exit',
  // --- ווידג'טים גלובליים שנטענים בכל דף, גם בעמדת הלקוח (AIFloatingWidget.js, LegacyErrorReportButton.js, ErrorReportWindow.js)
  'ai_screen_recording_enabled',
  'error_report_handled_at_bottom',
  'error_report_human_button_enabled',
  // --- עמדת הלקוח הישנה (/customer-interface; page.js): דגלי תצוגה בלבד
  'hide_dress_images',
  'hide_ai_features',
  'enable_ai_specific_employees',
  'kiosk_model_search',
  'kiosk_size_qty_contrast',
  'kiosk_sticky_date_bar',
  // --- עמדת הלקוח החדשה (KioskSwitch.js / KioskA5.js; סקירת אבטחה 12.10.2026): דגלי תצוגה בלבד. בלי ui_variant_kiosk מחשב עמדה ללא התחברות היה מקבל תמיד את העיצוב החדש
  //     גם כשהארגון בחר 'legacy', ובלי kiosk_splash_screen לא היה מכבד את כיבוי מסך הפתיחה. gmach_name / kiosk_customer_self_service לא נכנסו (שם ארגון וכלל רישום - נשארים לעוגייה)
  'ui_variant_kiosk',
  'kiosk_splash_screen',
]);
// לא נכנסו בכוונה (העמדה הישנה קוראת אותם, אבל כל קריאת הנתונים שלה - /api/dresses, /api/orders, /api/customers - כבר דורשת עוגיית עובד):
//   (ui_variant_kiosk ו-kiosk_splash_screen נכנסו לרשימה ב-12.10.2026 - ר' למעלה.)
//   kiosk_customer_self_service, kiosk_allow_self_order (דגלי נקודת כניסה לנתוני לקוחות), mandatory_fields / require_customer_email /
//   require_full_address / require_marketing_consent / hide_marketing_consent_field (כללי חובה עסקיים).

const PUBLIC_SET = new Set(PUBLIC_SETTING_KEYS);

// רשת ביטחון שנייה (לא במקום הרשימה): גם מפתח שנוסף בטעות לרשימה לא יוצא אם שמו נראה כמו סוד / פרט קשר / מזהה / כתובת / כסף / גיבוי.
export const SENSITIVE_SETTING_KEY_PATTERN =
  /token|secret|passw|pwd|(^|_)pins?($|_)|api[_-]?key|credential|e?mail|phone|address|folder|url|link|terminal|mosad|account|iban|bank|courier|backup|price|refund|permission|approval|restrict|hok|nedarim|yemot|neon|require_login|note|message/i;

export function isPublicSettingKey(key) {
  return typeof key === 'string' && PUBLIC_SET.has(key) && !SENSITIVE_SETTING_KEY_PATTERN.test(key);
}

/** שורות הגדרה -> מה שמותר לבלתי-מחובר: רק מפתחות מהרשימה, ורק { key, value } (בלי id / name / notes / category / legacyId). */
export function toPublicSettings(rows) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r && isPublicSettingKey(r.key)) out.push({ key: r.key, value: r.value });
  }
  return out;
}
