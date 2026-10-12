// credit_bank_prompt_auto / credit_bank_details_required: הקפצת חלון פרטי הבנק כשנוצר זיכוי אוטומטי בלי פרטי בנק.
// ברירות המחדל בקוד = ההתנהגות הקיימת (הקפצה דולקת, חובה כבויה), כך שהרצת הסקריפט רק יוצרת את השורות כדי שיופיעו במסך ההגדרות
// ולא משנה שום התנהגות. ערך קיים לעולם לא נדרס. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים.
//   node scripts/seed_credit_bank_prompt_settings.js --org=1          (dry-run)
//   node scripts/seed_credit_bank_prompt_settings.js --org=2 --write
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const KEEP = { 1: { value: 'true', overwrite: false }, 2: { value: 'true', overwrite: false } };
const OFF = { 1: { value: 'false', overwrite: false }, 2: { value: 'false', overwrite: false } };

const DEFS = [
  {
    key: 'credit_bank_prompt_auto',
    name: 'הקפצת חלון פרטי בנק אוטומטית כשיש זיכוי',
    category: 'תשלומים',
    notes: 'כשמופעל: אחרי שמירה או יציאה מהזמנה שנוצר בה זיכוי אוטומטי בלי פרטי בנק, נפתח אוטומטית חלון "פרטי בנק". כבוי = החלון לא נפתח לבד.',
    targets: KEEP,
  },
  {
    key: 'credit_bank_details_required',
    name: 'חובה למלא פרטי בנק כשיש זיכוי',
    category: 'תשלומים',
    notes: 'כשמופעל: אי אפשר לסגור את חלון פרטי הבנק האוטומטי בלי לשמור, ואי אפשר לצאת מההזמנה עד שמילאו. כבוי = אופציונלי.',
    targets: OFF,
  },
];

(async () => { for (const d of DEFS) await seedBoolSetting(d); })().catch((e) => { console.error(e); process.exitCode = 1; });
