// legacy_item_lines_replaced_on_recalc (דיווחים 09648183, e76d4ec3, נווה יעקב): בהזמנה שנוצרה באקסס, שמירה לא מוסיפה
// חיוב השכרה שני לשמלה - השורה הישנה מוחלפת בחיוב לפי המחירון הנוכחי (ר' findReplaceableLegacyItemLines ב-lib/pricingCalc.js).
// org2 (נווה יעקב) = true רק אחרי אישור הבעלים; org1 (הראשי) נוצר עם false = ההתנהגות הקיימת (השורה הישנה נשארת ונספרת).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_legacy_item_lines_replaced_on_recalc_setting.js --org=2          (dry-run)
//   node scripts/seed_legacy_item_lines_replaced_on_recalc_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const LEGACY_ITEM_LINES_REPLACED_ON_RECALC = {
  key: 'legacy_item_lines_replaced_on_recalc',
  name: 'הזמנה ישנה מהאקסס - מחליפים את חיוב ההשכרה הישן בחיוב לפי המחירון',
  category: 'תשלומים',
  notes: 'כשמופעל, שמירת הזמנה שנוצרה באקסס מחליפה את שורת ההשכרה הישנה של כל שמלה בחיוב לפי המחירון הנוכחי, במקום להוסיף חיוב שני על אותה שמלה. כבוי = השורה הישנה נשארת ונספרת בנוסף, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(LEGACY_ITEM_LINES_REPLACED_ON_RECALC).catch((e) => { console.error(e); process.exitCode = 1; });
