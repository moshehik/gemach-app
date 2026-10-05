// customer_id_once_per_order_visit (נווה יעקב, דיווח 72a80404, 2026-10-05): תעודת הזהות של הלקוח נשאלת פעם אחת
// לביקור בהזמנה (בעריכה הראשונה) ולא בכל שמירה. org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר =
// ההתנהגות הקיימת (ערך קיים של org1 לעולם לא משתנה). dry-run כברירת מחדל - כתיבה רק עם --write.
// ההגדרה חלה רק כש-require_id_for_edit_cancel (וגם require_customer_id_number) פעילות בגמח; הסקריפט לא נוגע בהן.
//   node scripts/seed_customer_id_once_per_order_visit_setting.js --org=2 [--write]
//   node scripts/seed_customer_id_once_per_order_visit_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const CUSTOMER_ID_ONCE_PER_ORDER_VISIT = {
  key: 'customer_id_once_per_order_visit',
  name: 'תעודת זהות של הלקוח - פעם אחת לביקור בהזמנה',
  category: 'הזמנות',
  notes: 'כשמופעל, תעודת הזהות של הלקוח נשאלת פעם אחת בלבד בכל ביקור בכרטיס ההזמנה (בעריכה הראשונה) ומשמשת לכל השמירות עד היציאה מההזמנה. השרת ממשיך לאמת אותה בכל שמירה, וביטול הזמנה שלמה עדיין שואל מחדש. כבוי = תעודת זהות בכל שמירה כמו קודם.',
  trueForOrg: 2, // org2 = true, org1 נוצר false אם חסר
};

seedBoolSetting(CUSTOMER_ID_ONCE_PER_ORDER_VISIT).catch((e) => { console.error(e); process.exitCode = 1; });
