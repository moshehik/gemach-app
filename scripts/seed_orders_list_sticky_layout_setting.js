// orders_list_sticky_layout (דיווחים 9c389667 + 7681043a, נווה יעקב, 2026-10-06): רשימת ההזמנות - הכותרת, החיפוש, הלשוניות וכותרות הטבלה קבועים, ורק הרשימה גוללת; בלי גלילה הצידה.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = ההתנהגות הקיימת (ערך קיים של org1 לעולם לא משתנה).
// dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_orders_list_sticky_layout_setting.js --org=2          (dry-run)
//   node scripts/seed_orders_list_sticky_layout_setting.js --org=2 --write
//   node scripts/seed_orders_list_sticky_layout_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ORDERS_LIST_STICKY_LAYOUT = {
  key: 'orders_list_sticky_layout',
  name: 'רשימת הזמנות - כותרות קבועות וגלילה רק ברשימה',
  category: 'הזמנות',
  notes: 'כשמופעל, בעמוד רשימת ההזמנות הכותרת, שורת החיפוש, הלשוניות וכותרות העמודות נשארות במקומן, ורק רשימת ההזמנות גוללת (בתוך תיבה בגובה המסך). הרווחים בטבלה מצטמצמים והטקסט יורד שורה במקום לגלול הצידה. במסך צר הדף חוזר לגלול כרגיל. כבוי (ברירת מחדל): כל הדף גולל, כמו קודם.',
  trueForOrg: 2, // org2 = true, השני נוצר false אם חסר
};

seedBoolSetting(ORDERS_LIST_STICKY_LAYOUT).catch((e) => { console.error(e); process.exitCode = 1; });
