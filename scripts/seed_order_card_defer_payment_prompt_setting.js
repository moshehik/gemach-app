// order_card_defer_payment_prompt (דיווחים b45fd22e + 96bcbf45, נווה יעקב, 2026-10-06): הוספת כמה פריטים ברצף, וחלון התשלום נפתח בסיום (מעבר לשונית / יציאה). ממתין לאישור הבעלים לפני הרצה.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = ההתנהגות הקיימת (ערך קיים של org1 לעולם לא משתנה).
// dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_order_card_defer_payment_prompt_setting.js --org=2          (dry-run)
//   node scripts/seed_order_card_defer_payment_prompt_setting.js --org=2 --write
//   node scripts/seed_order_card_defer_payment_prompt_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ORDER_CARD_DEFER_PAYMENT_PROMPT = {
  key: 'order_card_defer_payment_prompt',
  name: 'כרטיס הזמנה - חלון תשלום רק בסיום הוספת הפריטים',
  category: 'הזמנות',
  notes: 'כשמופעל, בכרטיס הזמנה קיימת (כשחלון סיכום ההזמנה פעיל) אחרי הוספת פריט שיוצר חיוב חדש לא עוברים מיד לטאב תשלומים ולא קופצת חלונית "השלמת תשלום": נשארים בטאב הפריטים, אפשר להוסיף עוד פריט וגם עוד, ומוצגת הודעה עם הסכום וכפתורי "לתשלום עכשיו" ו"הוספת פריט נוסף". חלון התשלום נפתח אוטומטית כשעוברים ללשונית אחרת או כשיוצאים מההזמנה. כבוי (ברירת מחדל): חלון התשלום קופץ מיד אחרי כל פריט, כמו קודם.',
  trueForOrg: 2, // org2 = true, השני נוצר false אם חסר
};

seedBoolSetting(ORDER_CARD_DEFER_PAYMENT_PROMPT).catch((e) => { console.error(e); process.exitCode = 1; });
