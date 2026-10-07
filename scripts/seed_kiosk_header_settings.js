// kiosk_sticky_date_bar + kiosk_model_search (נווה יעקב, דיווחים ea8a2ed1/b2bda17b/998381ee/59ffb080 ו-7983b79d/b2cf3796/e6f564d6,
// 2026-10-06): בעמדת הלקוח - פס תאריך גדול שנשאר למעלה בגלילה, ושדה חיפוש דגם קטן בפינה.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = המסך הקיים (ערך קיים של org1 לעולם לא משתנה).
// dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_kiosk_header_settings.js --org=2 [--write]
//   node scripts/seed_kiosk_header_settings.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const DEFS = [
  {
    key: 'kiosk_sticky_date_bar',
    name: 'עמדת לקוח - התאריך שנבחר נשאר גלוי למעלה',
    category: 'תצוגה',
    notes: 'כשמופעל, בקטלוג של עמדת הלקוח מוצג פס עם התאריך העברי שנבחר, גדול וברור, שנשאר צמוד לראש המסך גם בגלילה למטה, עם כפתור "שינוי תאריך". כבוי = כמו קודם.',
    trueForOrg: 2,
  },
  {
    key: 'kiosk_model_search',
    name: 'עמדת לקוח - שדה חיפוש דגם בפינה',
    category: 'תצוגה',
    notes: 'כשמופעל, מופיע בעמדת הלקוח שדה חיפוש קטן לפי מספר דגם או שם, למעלה בצד שמאל (נשאר גלוי גם בגלילה כשפס התאריך דלוק). כבוי = כמו קודם.',
    trueForOrg: 2,
  },
];

(async () => {
  for (const def of DEFS) await seedBoolSetting(def);
})().catch((e) => { console.error(e); process.exitCode = 1; });
