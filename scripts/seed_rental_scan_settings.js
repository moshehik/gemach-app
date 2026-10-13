// rental_auto_confirm_on_scan + rental_confirm_print_prompt_off (דיווח 14c58422, נווה יעקב, 11.10.2026): בחלון ההשכרה ברקוד תקין מאשר את הפריט מיד,
// ובלי השאלה "להדפיס את פרטי ההשכרה?". org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = כמו קודם. dry-run כברירת מחדל; כתיבה רק עם --write
// ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_rental_scan_settings.js --org=2          (dry-run)
//   node scripts/seed_rental_scan_settings.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const SETTINGS = [
  {
    key: 'rental_auto_confirm_on_scan',
    name: 'חלון השכרה - ברקוד תקין מאשר את ההשכרה מיד',
    category: 'הזמנות',
    notes: 'כשמופעל, בחלון ההשכרה (העברת ברקוד לפריט בהזמנה) ברקוד תקין מאשר את ההשכרה של הפריט מיד, בלי ללחוץ "אשר השכרה" נפרד; ברקוד לא תקין / פריט תפוס / צורך באישור מנהל - ההודעות והחסימות כמו היום והפריט לא מאושר. כשכל הפריטים הושכרו החלון נסגר. הזמנה שיש בה ברקוד שנרשם בהכנה מהלו"ז לא מאשרת אוטומטית. כבוי (ברירת מחדל): כמו קודם - ברקוד ואז "אשר".',
    trueForOrg: 2,
  },
  {
    key: 'rental_confirm_print_prompt_off',
    name: 'חלון השכרה - בלי השאלה "להדפיס את פרטי ההשכרה?" אחרי האישור',
    category: 'הזמנות',
    notes: 'כשמופעל, אחרי אישור ההשכרה בחלון ההשכרה לא נשאלים "להדפיס את פרטי ההשכרה?" והחלון נסגר מיד. כבוי (ברירת מחדל): השאלה מוצגת כמו קודם.',
    trueForOrg: 2,
  },
];

(async () => {
  for (const def of SETTINGS) await seedBoolSetting(def);
})().catch((e) => { console.error(e); process.exitCode = 1; });
