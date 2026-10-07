// new_order_calendar_three_months (דיווח c9d3be3f, נווה יעקב): בחירת תאריך אירוע בהזמנה חדשה פותחת לוח של 3 חודשים (כמו עמדת הלקוח).
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = הלוח הקודם. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_new_order_calendar_three_months_setting.js --org=2          (dry-run)
//   node scripts/seed_new_order_calendar_three_months_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const NEW_ORDER_CALENDAR_THREE_MONTHS = {
  key: 'new_order_calendar_three_months',
  name: 'הזמנה חדשה - לוח 3 חודשים בבחירת תאריך אירוע',
  category: 'הזמנות',
  notes: 'כשמופעל, בחירת תאריך האירוע בהזמנה חדשה (האשף הישן) פותחת לוח של 3 חודשים רצופים (כמו במסך עמדת הלקוח), והבחירה בלחיצה על היום. כבוי (ברירת מחדל): לוח של חודש אחד, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(NEW_ORDER_CALENDAR_THREE_MONTHS).catch((e) => { console.error(e); process.exitCode = 1; });
