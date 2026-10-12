// delivery_as_item_row (נושא 9 - דוחות, 12.10.2026): "המשלוח מוצג כשורת פריט בטבלת הפריטים" - כרטיס ההזמנה, הדפסה, PDF מצורף ומייל אישור.
// ברירת מחדל כבוי בשני הגמ"חים (= ההתנהגות הקודמת). הסקריפט רק יוצר את השורה (false) כדי שהמתג יופיע במסך ההגדרות; ערך קיים לעולם לא משתנה.
// הדלקה עצמה (נווה יעקב) היא החלטה של הבעלים וכתיבה ידנית/מהמסך. בגמ"ח הראשי אין משלוחים (enable_deliveries כבוי) והמתג ללא השפעה.
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_delivery_as_item_row_setting.js --org=2          (dry-run)
//   node scripts/seed_delivery_as_item_row_setting.js --org=2 --write
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const DELIVERY_AS_ITEM_ROW = {
  key: 'delivery_as_item_row',
  name: 'המשלוח מוצג כשורת פריט בטבלת הפריטים (כרטיס, הדפסה, מייל)',
  category: 'משלוחים',
  notes: 'כשמופעל (ורק יחד עם "הצג משלוחים"), בהזמנת משלוח המשלוח מוצג כשורה בטבלת הפריטים - בכרטיס ההזמנה, בהדפסה, בקובץ ה-PDF המצורף ובמייל אישור ההזמנה - עם עיר/כתובת, מועדים והמחיר. תצוגה בלבד: אינו פריט מלאי והסכום הכולל זהה. כבוי = כמו קודם.',
  trueForOrg: 0, // אף גמ"ח לא מקבל true מהסקריפט
};

seedBoolSetting(DELIVERY_AS_ITEM_ROW).catch((e) => { console.error(e); process.exitCode = 1; });
