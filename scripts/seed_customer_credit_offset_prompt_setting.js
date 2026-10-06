// customer_credit_offset_prompt (דיווח 679a860b, נווה יעקב): אחרי שמירה/יצירה של הזמנה שנוצר בה חוב, ואם ללקוחה יש זיכוי פתוח מהזמנה אחרת -
// שאלה אחת "לקזז מהחוב?" (lib/creditOffset.js, /api/orders/[id]/credit-offset).
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = ההתנהגות הקיימת (בלי שאלה ובלי קיזוז).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_customer_credit_offset_prompt_setting.js --org=2          (dry-run)
//   node scripts/seed_customer_credit_offset_prompt_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const CUSTOMER_CREDIT_OFFSET_PROMPT = {
  key: 'customer_credit_offset_prompt',
  name: 'שאלת קיזוז זיכוי פתוח מחוב חדש',
  category: 'הזמנות',
  notes: 'כשמופעל, אחרי שמירה או יצירה של הזמנה שנוצר בה חוב, ואם ללקוחה יש זיכוי פתוח מהזמנה אחרת - תופיע שאלה "לקזז מהחוב?". באישור (עם קוד מאשר) נרשמים שני תשלומים באמצעי "קיזוז זיכוי". כבוי = אין שאלה ואין קיזוז, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(CUSTOMER_CREDIT_OFFSET_PROMPT).catch((e) => { console.error(e); process.exitCode = 1; });
