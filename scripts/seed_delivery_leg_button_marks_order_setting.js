// delivery_leg_button_marks_order (דיווחים a6e5fb70, e2c072b7, נווה יעקב): בכרטיס ההזמנה הישן, הכפתורים "הוסף חיוב משלוח הלוך/חזור"
// מסמנים גם את ההזמנה כמשלוח (כיוון + עיר/כתובת דרך שאלת V/X) במקום להוסיף רק שורת חיוב.
// org2 (נווה יעקב) = true (רק אחרי אישור הבעלים); org1 (הראשי) נוצר עם false = ההתנהגות הקיימת (המשלוחים בו כבויים ממילא).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_delivery_leg_button_marks_order_setting.js --org=2          (dry-run)
//   node scripts/seed_delivery_leg_button_marks_order_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const DELIVERY_LEG_BUTTON_MARKS_ORDER = {
  key: 'delivery_leg_button_marks_order',
  name: 'כפתורי "הוסף חיוב משלוח" מסמנים גם את ההזמנה כמשלוח',
  category: 'משלוחים',
  notes: 'כשמופעל, לחיצה על "הוסף חיוב משלוח הלוך/חזור" בלשונית התשלומים של כרטיס ההזמנה (הכרטיס הישן) מסמנת את ההזמנה גם כהזמנת משלוח, והיא מופיעה ברשימת המשלוחים; נשאלת שאלה אחת: לכתובת הרגילה של הלקוחה או לכתובת אחרת. כבוי = הכפתורים רק מוסיפים שורת חיוב, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(DELIVERY_LEG_BUTTON_MARKS_ORDER).catch((e) => { console.error(e); process.exitCode = 1; });
