// הגדרות ארבעת מפתחות ה-SystemSetting של סבב נווה יעקב 2026-10-05 (מקור יחיד לסקריפטי ה-seed הבודדים
// ולסקריפט העוטף scripts/seed_neve_2026_10_05_all_settings.js). פורמט: ראו scripts/lib/seed-bool-setting.js.
// כלל הגמחים (CLAUDE.md "Settings & the two orgs"): אותם מפתחות בשני ה-DB, ערך שונה רק לפי בקשה.
'use strict';

const HIDE_ORDER_PAYMENT_NOTE = {
  key: 'hide_order_payment_note',
  name: 'הסתר "הערה לתשלום" בהזמנה חדשה',
  category: 'הזמנות',
  notes: 'כשמופעל, שדה "הערה לתשלום" לא מוצג במסך התשלום של הזמנה חדשה. כבוי = מוצג כרגיל.',
  trueForOrg: 2, // דיווח 51f2cc56: org2 = true, org1 נוצר false אם חסר
};

const PRINT_ORDER_CLEAN_LAYOUT = {
  key: 'print_order_clean_layout',
  name: 'הדפסת הזמנה - פריסה נקייה ללקוח',
  category: 'הדפסה',
  notes: 'כשמופעל, הדפסת הזמנה בודדת נקייה יותר (בלי "לכבוד:"/"טלפון:"/כתובת לקוח, הערות פעם אחת, בלי טבלת תשלומים). כבוי = הפלט כמו קודם.',
  trueForOrg: 2, // דיווח 27f278c7: org2 = true, org1 נוצר false אם חסר
};

const ALLOW_ABROAD_LONG_STAY_ORDERS = {
  key: 'allow_abroad_long_stay_orders',
  name: 'אפשר הזמנות חו"ל ותפוסה ארוכה',
  category: 'הזמנות',
  notes: 'כשמופעל, אפשר ליצור הזמנות לחו"ל / בתפוסה ארוכה כרגיל. כבוי = ההזמנות האלה חסומות. ברירת המחדל בגמח הראשי: מופעל (התנהגות קיימת); בנווה יעקב: כבוי.',
  targets: {
    1: { value: 'true', overwrite: false }, // נוצר true אם חסר; ערך קיים לא נדרס
    2: { value: 'false', overwrite: true }, // נקבע/מתעדכן ל-false
  },
};

const UNPAID_ACTION_APPROVAL_ONCE_PER_VISIT = {
  key: 'unpaid_action_approval_once_per_visit',
  name: 'אישור פעולה בלי תשלום מלא - פעם אחת לביקור',
  category: 'הזמנות',
  notes: 'כשמופעל, אישור מנהל לפעולה בלי תשלום מלא מתבקש פעם אחת לביקור של הלקוחה ולא בכל פעולה בנפרד. כבוי = אישור לכל פעולה כמו קודם.',
  trueForOrg: 2, // org2 = true, org1 נוצר false אם חסר
};

// סדר ההצגה בסקריפט העוטף
const ALL_DEFS = [
  HIDE_ORDER_PAYMENT_NOTE,
  PRINT_ORDER_CLEAN_LAYOUT,
  ALLOW_ABROAD_LONG_STAY_ORDERS,
  UNPAID_ACTION_APPROVAL_ONCE_PER_VISIT,
];

module.exports = {
  HIDE_ORDER_PAYMENT_NOTE,
  PRINT_ORDER_CLEAN_LAYOUT,
  ALLOW_ABROAD_LONG_STAY_ORDERS,
  UNPAID_ACTION_APPROVAL_ONCE_PER_VISIT,
  ALL_DEFS,
};
