// delivery_different_address_button (דיווח 87c7a432, נווה יעקב): בהזמנת משלוח ללקוחה שעירה ברשימת ערי המשלוח לא מבקשים לבחור עיר שוב -
// מוצגת כתובת הלקוחה וכפתור "כתובת שונה למשלוח". פועל רק כש-delivery_charge_customer_city_fallback דולק גם הוא (בנווה יעקב דולק).
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = שדה "עיר משלוח" כמו קודם. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים.
//   node scripts/seed_delivery_different_address_button_setting.js --org=2          (dry-run)
//   node scripts/seed_delivery_different_address_button_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const DELIVERY_DIFFERENT_ADDRESS_BUTTON = {
  key: 'delivery_different_address_button',
  name: 'הזמנה חדשה - כפתור "כתובת שונה למשלוח" במקום בחירת עיר',
  category: 'משלוחים',
  notes: 'כשמופעל (ביחד עם "חיוב משלוח לפי עיר הלקוח כשאין עיר בהזמנה"), בהזמנת משלוח של לקוחה שעירה ברשימת ערי המשלוח לא מבקשים לבחור עיר משלוח שוב: מוצגת כתובת הלקוחה וכפתור "כתובת שונה למשלוח" שפותח בחירת עיר והקלדת כתובת. עיר שאינה ברשימת ערי המשלוח - עדיין חייבים לבחור עיר. כבוי (ברירת מחדל): שדה "עיר משלוח" תמיד מוצג, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(DELIVERY_DIFFERENT_ADDRESS_BUTTON).catch((e) => { console.error(e); process.exitCode = 1; });
