// hok_enabled (דיווח 84959e6d, נווה יעקב): "להסתיר את האופציה של בקשת הוראת קבע - שלא תהיה כלל". אין צורך במתג חדש: המתג הקיים
// hok_enabled ("הפעל הוראת קבע (הו״ק)", קטגוריית "הוראת קבע") כבר מסתיר את כרטיס "פרטי הוראת קבע (3)" בשני אשפי ההזמנה החדשה (הישן והחדש)
// ומונע שמירת hokDetails; בנווה יעקב הוא כרגע 'true'. הסקריפט מכבה אותו רק בנווה יעקב (org2); בגמח הראשי ערך קיים לעולם לא נדרס.
// הגביות האוטומטיות שתלויות בו (hok_auto_charge_enabled, auto_charge_damaged_return) כבויות בנווה יעקב ממילא (נבדק 7.10.2026, קריאה בלבד).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_hok_enabled_off_neve_setting.js --org=2          (dry-run)
//   node scripts/seed_hok_enabled_off_neve_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const HOK_ENABLED_OFF_NEVE = {
  key: 'hok_enabled',
  name: 'הפעל הוראת קבע (הו״ק)',
  category: 'הוראת קבע',
  notes: 'כאשר מופעל, בכל הזמנה ניתן להזין פרטי הוראת קבע (בנק, סניף, חשבון, אישור גביה). כבוי = הכרטיס "פרטי הוראת קבע" מוסתר בהזמנה חדשה.',
  targets: {
    1: { value: 'false', overwrite: false }, // הגמח הראשי: נוצר false אם חסר; ערך קיים לא נדרס
    2: { value: 'false', overwrite: true }, // נווה יעקב: מכבה (היום 'true')
  },
};

seedBoolSetting(HOK_ENABLED_OFF_NEVE).catch((e) => { console.error(e); process.exitCode = 1; });
