// delivery_charge_customer_city_fallback (דיווחים 06467870, 3a4d36df, נווה יעקב): הזמנת משלוח בלי עיר מפורשת
// תחויב לפי עיר הלקוח אם היא בטבלת delivery_price_by_city.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = ההתנהגות הקיימת (בלי עיר בהזמנה אין חיוב משלוח).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_delivery_charge_customer_city_fallback_setting.js --org=2          (dry-run)
//   node scripts/seed_delivery_charge_customer_city_fallback_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const DELIVERY_CHARGE_CUSTOMER_CITY_FALLBACK = {
  key: 'delivery_charge_customer_city_fallback',
  name: 'חיוב משלוח לפי עיר הלקוח כשאין עיר בהזמנה',
  category: 'משלוחים',
  notes: 'כשמופעל, הזמנת משלוח בלי עיר משלוח מפורשת תחויב לפי עיר הלקוח, אם היא מופיעה בטבלת delivery_price_by_city. כבוי = בלי עיר בהזמנה אין חיוב משלוח, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(DELIVERY_CHARGE_CUSTOMER_CITY_FALLBACK).catch((e) => { console.error(e); process.exitCode = 1; });
