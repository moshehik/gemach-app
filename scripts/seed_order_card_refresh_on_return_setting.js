// order_card_refresh_on_return (נווה יעקב, דיווח f6da1794, 2026-10-05): כרטיס הזמנה פתוח בודק מול השרת כשחוזרים אליו
// (פוקוס / חזרת לשונית, לכל היותר פעם ב-15 שניות) ומתעדכן לבד כשההזמנה השתנתה ממקום אחר (למשל החזרת שמלה בלשונית אחרת).
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = ההתנהגות הקיימת (ערך קיים של org1 לעולם לא משתנה).
// dry-run כברירת מחדל - כתיבה רק עם --write.
//   node scripts/seed_order_card_refresh_on_return_setting.js --org=2 [--write]
//   node scripts/seed_order_card_refresh_on_return_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ORDER_CARD_REFRESH_ON_RETURN = {
  key: 'order_card_refresh_on_return',
  name: 'כרטיס הזמנה - רענון אוטומטי כשחוזרים לכרטיס',
  category: 'הזמנות',
  notes: 'כשמופעל, כרטיס הזמנה פתוח בודק מול השרת כשחוזרים אליו אם ההזמנה השתנתה ממקום אחר, ומתעדכן לבד (בלי לדרוס שינויים שלא נשמרו - אז מוצגת הודעה עם כפתור רענון). כבוי = הכרטיס לא בודק, כמו קודם.',
  trueForOrg: 2, // org2 = true, org1 נוצר false אם חסר
};

seedBoolSetting(ORDER_CARD_REFRESH_ON_RETURN).catch((e) => { console.error(e); process.exitCode = 1; });
