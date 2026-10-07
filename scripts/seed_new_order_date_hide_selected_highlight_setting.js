// new_order_date_hide_selected_highlight (דיווח f0c19c53, נווה יעקב): בלוח בחירת תאריך האירוע בהזמנה חדשה לא מודגש התאריך שנבחר קודם.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = הלוח הקודם (עם ההדגשה). dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_new_order_date_hide_selected_highlight_setting.js --org=2          (dry-run)
//   node scripts/seed_new_order_date_hide_selected_highlight_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const NEW_ORDER_DATE_HIDE_SELECTED_HIGHLIGHT = {
  key: 'new_order_date_hide_selected_highlight',
  name: 'הזמנה חדשה - בלי הדגשת התאריך הקודם בבחירת תאריך אירוע',
  category: 'הזמנות',
  notes: 'כשמופעל, בלוח בחירת תאריך האירוע בהזמנה חדשה לא מודגש התאריך שנבחר קודם (היום-בחודש שלו הודגש בכחול גם בחודשים אחרים), והבחירה רק בלחיצה על יום (בלי בורר "יום" ובלי כפתור "אישור"). כבוי (ברירת מחדל): כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(NEW_ORDER_DATE_HIDE_SELECTED_HIGHLIGHT).catch((e) => { console.error(e); process.exitCode = 1; });
