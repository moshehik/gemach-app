// hide_profile_email_alerts_option (דיווח 13888b96, הגמח הראשי): כשדלוק, התיבה/המתג "קבלת התראות למייל" לא מוצגים בעמוד "הפרופיל שלי"
// (הישן והחדש). ההעדפה השמורה של העובדות לא משתנה, והאפשרות נשארת בכרטיס העובד (למנהלים) ובמסך ההודעות.
// org1 (הגמח הראשי) = true; org2 (נווה יעקב) נוצר עם false אם חסר = ההתנהגות הקיימת (ערך קיים של org2 לעולם לא משתנה).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_hide_profile_email_alerts_option_setting.js --org=1          (dry-run)
//   node scripts/seed_hide_profile_email_alerts_option_setting.js --org=1 --write
//   node scripts/seed_hide_profile_email_alerts_option_setting.js --org=2          (יוצר false בלבד)
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const HIDE_PROFILE_EMAIL_ALERTS_OPTION = {
  key: 'hide_profile_email_alerts_option',
  name: 'הסתר "קבלת התראות למייל" בפרופיל האישי',
  category: 'תצוגה',
  notes: 'כשמופעל, התיבה "קבלת התראות למייל" לא מוצגת בעמוד "הפרופיל שלי". ההעדפה השמורה של כל עובדת לא משתנה, והאפשרות נשארת בכרטיס העובד (למנהלים) ובמסך ההודעות. כבוי = התיבה מוצגת, כמו קודם.',
  trueForOrg: 1,
};

seedBoolSetting(HIDE_PROFILE_EMAIL_ALERTS_OPTION).catch((e) => { console.error(e); process.exitCode = 1; });
