// order_edit_fewer_confirmations (דיווח c43a2b84, נווה יעקב, 2026-10-06): שמירת הזמנה בכרטיס קיים - שאלת ההדפסה בתוך חלון הסיכום, ושמירה בלי שינויים לא פותחת שוב את כל החלונות.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = ההתנהגות הקיימת (ערך קיים של org1 לעולם לא משתנה).
// dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_order_edit_fewer_confirmations_setting.js --org=2          (dry-run)
//   node scripts/seed_order_edit_fewer_confirmations_setting.js --org=2 --write
//   node scripts/seed_order_edit_fewer_confirmations_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ORDER_EDIT_FEWER_CONFIRMATIONS = {
  key: 'order_edit_fewer_confirmations',
  name: 'שמירת הזמנה - פחות חלונות אישור',
  category: 'הזמנות',
  notes: 'כשמופעל: (1) שאלת "להדפיס את ההזמנה?" אחרי שמירה מתמזגת לתוך חלון "סיכום ההזמנה לפני שמירה" תיבת סימון, במקום חלון אישור נוסף (רק כשחלון הסיכום פעיל); (2) לחיצה על "שמור שינויים" כשאין שום שינוי שלא נשמר (למשל אחרי הוספת פריט שכבר נשמר בלחיצה על "אישור" בשורה) לא פותחת שוב סיכום, ת"ז ושמירה - רק שאלת הדפסה אחת. תעודת זהות, קוד מאשר, אישור חוב/ללא תשלום, מחיקת פריט והתנגשות נתונים לא משתנים. כבוי (ברירת מחדל): כל החלונות כמו קודם.',
  trueForOrg: 2, // org2 = true, השני נוצר false אם חסר
};

seedBoolSetting(ORDER_EDIT_FEWER_CONFIRMATIONS).catch((e) => { console.error(e); process.exitCode = 1; });
