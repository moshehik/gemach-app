// order_card_save_after_item_delete (דיווח 5cf81871, נווה יעקב, 2026-10-06): מחיקת פריט שמורה מיד ופותחת את חלונית פרטי הבנק לזיכוי. ממתין לאישור הבעלים לפני הרצה.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = ההתנהגות הקיימת (ערך קיים של org1 לעולם לא משתנה).
// dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_order_card_save_after_item_delete_setting.js --org=2          (dry-run)
//   node scripts/seed_order_card_save_after_item_delete_setting.js --org=2 --write
//   node scripts/seed_order_card_save_after_item_delete_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ORDER_CARD_SAVE_AFTER_ITEM_DELETE = {
  key: 'order_card_save_after_item_delete',
  name: 'כרטיס הזמנה - מחיקת פריט שומרת מיד ופותחת פרטי בנק לזיכוי',
  category: 'הזמנות',
  notes: 'כשמופעל, אחרי שמאשרים מחיקה של פריט שכבר נשמר בהזמנה מופעלת מיד השמירה הרגילה של הכרטיס (עם כל האישורים שלה: סיכום, תעודת זהות, אישור מנהל כשנדרש), ואם נוצר זיכוי ללקוח בלי פרטי בנק נפתחת מיד חלונית פרטי הבנק לזיכוי - בלי ללחוץ על "שמור שינויים". כבוי (ברירת מחדל): המחיקה היא שינוי מקומי שנשמר רק ב"שמור שינויים", כמו קודם.',
  trueForOrg: 2, // org2 = true, השני נוצר false אם חסר
};

seedBoolSetting(ORDER_CARD_SAVE_AFTER_ITEM_DELETE).catch((e) => { console.error(e); process.exitCode = 1; });
