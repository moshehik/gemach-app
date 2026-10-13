// new_order_phone_flag_in_customer_step (דיווח 8ff97ace, נווה יעקב, 12.10.2026): בהזמנה חדשה מוסר השלב "איך מזמינים?" וה"הזמנה טלפונית"
// עוברת למתג לא-חובה בשלב הלקוח, מתחת ל"חתם על התקנון". org2 (נווה יעקב) = true רק אחרי שהבעלים אישר את הסקיצה; org1 (הראשי) נוצר עם false = כמו קודם.
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_new_order_phone_flag_in_customer_step_setting.js --org=2          (dry-run)
//   node scripts/seed_new_order_phone_flag_in_customer_step_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const NEW_ORDER_PHONE_FLAG_IN_CUSTOMER_STEP = {
  key: 'new_order_phone_flag_in_customer_step',
  name: 'הזמנה חדשה - "הזמנה טלפונית" בשלב הלקוח, בלי שלב "איך מזמינים?"',
  category: 'הזמנות',
  notes: 'כשמופעל, בהזמנה חדשה מוסר השלב "איך מזמינים?" (אופן ההזמנה) וה"הזמנה טלפונית" נבחרת במתג לא-חובה בשלב הלקוח, מתחת ל"חתם על התקנון" - בלי סימון ממשיכים אוטומטית לשלב הבא. אם נרשם סניף ביצוע / איסוף, הם נשארים שם כשדות רשות. כבוי (ברירת מחדל): השלב "אופן ההזמנה" כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(NEW_ORDER_PHONE_FLAG_IN_CUSTOMER_STEP).catch((e) => { console.error(e); process.exitCode = 1; });
