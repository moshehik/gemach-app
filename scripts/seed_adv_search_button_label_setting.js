// adv_search_button_label (דיווח 2f8bce90, נווה יעקב, 2026-10-06): במסך ההשכרות מופיעות המילים "חיפוש מתקדם" ליד האייקון,
// במקום אייקון בלבד. org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = אייקון בלבד, כמו היום
// (ערך קיים של org1 לעולם לא משתנה). dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_adv_search_button_label_setting.js --org=2 [--write]
//   node scripts/seed_adv_search_button_label_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ADV_SEARCH_BUTTON_LABEL = {
  key: 'adv_search_button_label',
  name: 'חיפוש מתקדם - כיתוב ליד האייקון',
  category: 'תצוגה',
  notes: 'כשמופעל, ליד אייקון "חיפוש מתקדם" במסך ההשכרות מופיעות גם המילים "חיפוש מתקדם" (במקום אייקון בלבד). כבוי = אייקון בלבד, כמו קודם.',
  trueForOrg: 2, // org2 = true, org1 נוצר false אם חסר
};

seedBoolSetting(ADV_SEARCH_BUTTON_LABEL).catch((e) => { console.error(e); process.exitCode = 1; });
