// kiosk_public_link_enabled / kiosk_public_show_inventory / kiosk_public_show_registration (עמדת לקוח בקישור כללי /station, 2026-10-12).
// החלטת הבעלים: בגמ"ח נווה יעקב (org2) ברירת המחדל "כן", בגמ"ח הראשי (org1) "לא". בקוד, שורה חסרה = כבוי (lib/publicKiosk/config.js).
//   org2: נוצר עם 'true' אם חסר; org1: נוצר עם 'false' אם חסר. ערך קיים של אף גמ"ח לעולם לא נדרס (overwrite:false) - מדווח בלבד.
// מבנה: scripts/lib/seed-bool-setting.js - בדיקת host (ה-DB שנבחר חייב להיות שונה מה-DB של הגמ"ח השני; נבדק לפני כל כתיבה).
// dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה. לעולם אל תריצו בלי --org מפורש:
//   node scripts/seed_kiosk_public_settings.js --org=2 [--write]
//   node scripts/seed_kiosk_public_settings.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const TARGETS = { 1: { value: 'false', overwrite: false }, 2: { value: 'true', overwrite: false } };

const DEFS = [
  {
    key: 'kiosk_public_link_enabled',
    name: 'עמדת לקוח פתוחה בקישור כללי',
    category: 'תצוגה',
    notes: 'כשמופעל, כל אחד יכול להיכנס לעמדת הלקוח מהבית דרך כתובת כללית (/station) בלי להתחבר, ולעיין בקטלוג הדגמים. כבוי = הכתובת מציגה "העמדה אינה זמינה".',
    targets: TARGETS,
  },
  {
    key: 'kiosk_public_show_inventory',
    name: 'קישור כללי - להציג מלאי וזמינות',
    category: 'תצוגה',
    notes: 'בקישור הכללי: כשמופעל, מי שבוחרת תאריך אירוע רואה אילו מידות פנויות בו. כבוי = הקטלוג בלי שום מידע על מלאי וזמינות. פועל רק כשהקישור הכללי פתוח.',
    targets: TARGETS,
  },
  {
    key: 'kiosk_public_show_registration',
    name: 'קישור כללי - להציג טופס רישום פרטים אישיים',
    category: 'תצוגה',
    notes: 'בקישור הכללי: כשמופעל, מוצג טופס רישום פרטים אישיים. הפרטים נשמרים כלקוחה חדשה "נרשמה בעמדה - לאמת פרטים". כבוי = בלי טופס. פועל רק כשהקישור הכללי פתוח.',
    targets: TARGETS,
  },
];

(async () => {
  for (const def of DEFS) await seedBoolSetting(def);
})().catch((e) => { console.error(e); process.exitCode = 1; });
