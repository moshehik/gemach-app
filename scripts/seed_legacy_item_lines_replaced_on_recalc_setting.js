// legacy_item_lines_replaced_on_recalc (דיווחים 09648183, e76d4ec3, נווה יעקב): בהזמנה שנוצרה באקסס, שמירה לא מוסיפה
// חיוב השכרה שני לשמלה. החלטת הבעלים (7.10.2026): שמלה שלא השתנתה נשארת במחיר הישן שנגבה (100 נשאר 100, 150 נשאר 150),
// ורק אם הדגם או שורת המחיר השתנו השורה הישנה מוחלפת בחיוב לפי המחירון (ר' classifyLegacyItemLines ב-lib/pricingCalc.js).
// org2 (נווה יעקב) = true רק אחרי אישור הבעלים; org1 (הראשי) נוצר עם false = ההתנהגות הקיימת (השורה הישנה נשארת ונספרת).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_legacy_item_lines_replaced_on_recalc_setting.js --org=2          (dry-run)
//   node scripts/seed_legacy_item_lines_replaced_on_recalc_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const LEGACY_ITEM_LINES_REPLACED_ON_RECALC = {
  key: 'legacy_item_lines_replaced_on_recalc',
  name: 'הזמנה ישנה מהאקסס - שמירה לא מכפילה חיוב ושומרת את המחיר ששולם',
  category: 'תשלומים',
  notes: 'בהזמנה שנוצרה באקסס חיוב ההשכרה של כל שמלה שמור כשורה ישנה, ושמירה של ההזמנה הוסיפה על השמלה חיוב שני לפי המחירון הנוכחי. כשמתג זה דולק: שמלה שלא השתנתה (אותו דגם ואותה שורת מחיר - גם אם המידה הוחלפה בתוך אותה שורת מחיר) נשארת במחיר הישן שנגבה, ולא מתווסף עליה כלום. רק אם הדגם או שורת המחיר של השמלה השתנו, השורה הישנה מסומנת כמבוטלת (היא לא נמחקת וההיסטוריה שומרת את הסכום שלה) והשמלה מחויבת לפי המחירון הנוכחי. הנחות, זיכויים וחיובים ידניים ישנים נשארים. מסך ההזמנה מציג בדיוק את הסכום שיישמר. כבוי (ברירת מחדל): השורה הישנה נשארת ונספרת בנוסף לחיוב לפי המחירון, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(LEGACY_ITEM_LINES_REPLACED_ON_RECALC).catch((e) => { console.error(e); process.exitCode = 1; });
