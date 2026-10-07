// new_order_auto_finish_when_paid (דיווח 67c0d652, נווה יעקב): בשלב התשלום של הזמנה חדשה, רישום תשלום (מזומן/שיק/העברה) שמשלים בדיוק
// את הסכום המלא ממשיך אוטומטית לסיום ההזמנה (כמו חיוב אשראי מלא, שכבר עובד כך). תשלום שגבוה מהסכום לא מפעיל מעבר אוטומטי.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = צריך ללחוץ "סיום ויצירת ההזמנה". dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים.
//   node scripts/seed_new_order_auto_finish_when_paid_setting.js --org=2          (dry-run)
//   node scripts/seed_new_order_auto_finish_when_paid_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const NEW_ORDER_AUTO_FINISH_WHEN_PAID = {
  key: 'new_order_auto_finish_when_paid',
  name: 'הזמנה חדשה - מעבר אוטומטי כשהתשלום מלא',
  category: 'הזמנות',
  notes: 'כשמופעל, בשלב התשלום של הזמנה חדשה, ברגע שרישום תשלום (מזומן, שיק, העברה וכד\') משלים בדיוק את הסכום המלא - ההזמנה נשמרת ועוברים הלאה אוטומטית, בלי ללחוץ "סיום ויצירת ההזמנה" (חיוב באשראי בסכום מלא כבר עובד כך תמיד). תשלום שגבוה מהסכום לא מפעיל מעבר אוטומטי. כבוי (ברירת מחדל): צריך ללחוץ "סיום ויצירת ההזמנה".',
  trueForOrg: 2,
};

seedBoolSetting(NEW_ORDER_AUTO_FINISH_WHEN_PAID).catch((e) => { console.error(e); process.exitCode = 1; });
