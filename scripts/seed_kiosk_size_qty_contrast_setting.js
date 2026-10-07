// kiosk_size_qty_contrast (דיווח 81b0b4b1, נווה יעקב, 2026-10-06): בעמדת הלקוח המידה והכמות הפנויה ממנה נראות שונות בחדות
// (גודל + צבע), כדי שלא יתבלבלו. org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = התצוגה הקיימת
// (ערך קיים של org1 לעולם לא משתנה). dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_kiosk_size_qty_contrast_setting.js --org=2 [--write]
//   node scripts/seed_kiosk_size_qty_contrast_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const KIOSK_SIZE_QTY_CONTRAST = {
  key: 'kiosk_size_qty_contrast',
  name: 'עמדת לקוח - הבדל חד בין מידה לכמות',
  category: 'תצוגה',
  notes: 'כשמופעל, בעמדת הלקוח המידה מוצגת בגופן גדול וכהה והכמות הפנויה ממנה בעיגול ירוק קטן, כדי שלא יתבלבלו ביניהן. כבוי = התצוגה הקודמת.',
  trueForOrg: 2, // org2 = true, org1 נוצר false אם חסר
};

seedBoolSetting(KIOSK_SIZE_QTY_CONTRAST).catch((e) => { console.error(e); process.exitCode = 1; });
