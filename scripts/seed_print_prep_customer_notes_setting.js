// print_prep_customer_notes (דיווח b61a7ca5, נווה יעקב): בהדפסת הכנה ("פירוט הזמנות להכנה") להדפיס בגדול גם את הערות הלקוח
// (app/print/order/page.js, lib/customerNotesForPrint.js). org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = ההדפסה הקיימת.
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_print_prep_customer_notes_setting.js --org=2          (dry-run)
//   node scripts/seed_print_prep_customer_notes_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const PRINT_PREP_CUSTOMER_NOTES = {
  key: 'print_prep_customer_notes',
  name: 'הדפסת הכנה - הערות הלקוח בגדול',
  category: 'הדפסה',
  notes: 'כשמופעל, בהדפסת הכנה (פירוט הזמנות להכנה) מודפסות בגדול גם הערות הלקוח של כל הזמנה. כבוי = ההדפסה כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(PRINT_PREP_CUSTOMER_NOTES).catch((e) => { console.error(e); process.exitCode = 1; });
