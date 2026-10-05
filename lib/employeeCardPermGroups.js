// lib/employeeCardPermGroups.js - חלוקת "הרשאות ספציפיות" בכרטיס העובד החדש ל-10 קטגוריות מתקפלות (EC-09).
// הבעלים (4.10.2026, תשובה מעודכנת): "בלי הכיתוב מקופל ובלי הסוגרים, ומחולק ליותר קבוצות מתקפלות לפי קטגוריות" (8-10 קבוצות). היום הפאנל מציג 2 קבוצות (עמודים 11 / פיצ'רים 23);
// כאן אותם 36 פריטים בדיוק (34 + "השינויים שלי" של עובדת אחרת + ימי אי-פעילות), ממוינים ל-10 קטגוריות לפי הנושא. מפתחות שאינם ברשימה (פריט חדש בקטלוג) נופלים לקטגוריה "אחר" - אף פריט
// לא נעלם. ESM טהור (נבדק ב-scripts/test_employee_card_a5.mjs מול PERMISSION_CATALOG האמיתי).

export const PERM_CATEGORIES = [
  { id: 'orders', title: 'הזמנות ולקוחות', icon: 'bag', keys: ['page:orders', 'page:orders_new', 'page:customers', 'feature:view_others_recent_activity', 'feature:customer_delete_approval'] },
  { id: 'rentals', title: 'השכרות והחזרות', icon: 'dress', keys: ['page:rentals', 'page:deliveries', 'feature:reserve_rental_approval', 'feature:warehouse_rental_approval', 'feature:barcode_mismatch_override', 'feature:early_return_approval'] },
  { id: 'schedule', title: 'לוחות זמנים והודעות', icon: 'cal', keys: ['page:schedule', 'page:board', 'page:messages', 'feature:schedule_mark_all_done', 'feature:non_working_days_manage'] },
  { id: 'catalog', title: 'קטלוג ותיקונים', icon: 'scissors', keys: ['page:dresses_catalog', 'page:alterations'] },
  { id: 'money', title: 'תשלומים וזיכויים', icon: 'wallet', keys: ['page:refunds', 'feature:manual_payment_credit_add', 'feature:manual_charge_add'] },
  { id: 'unpaid', title: 'אישורים בלי תשלום מלא', icon: 'card', keys: ['feature:debt_approval', 'feature:payment_exit_approval', 'feature:unpaid_action_items_tab', 'feature:unpaid_action_rentals_tab'] },
  { id: 'edits', title: 'עריכת הזמנות ופריטים', icon: 'pencil', keys: ['feature:item_change_approval', 'feature:item_edit_reopen', 'feature:locked_order_edit', 'feature:order_date_edit_approval'] },
  { id: 'creation', title: 'שמירת הזמנה חדשה', icon: 'file', keys: ['feature:special_spacing_approval', 'feature:past_date_order_approval', 'feature:missing_contact_approval'] },
  { id: 'mail', title: 'מייל וייצוא', icon: 'mail', keys: ['feature:customer_email_approval', 'feature:export_over_limit_approval', 'feature:export_max_rows'] },
  { id: 'ai', title: 'בינה מלאכותית ותקלות', icon: 'info', keys: ['feature:ai', 'feature:ai_financial_data', 'feature:error_reports'] },
];
export const OTHER_CATEGORY = { id: 'other', title: 'אחר', icon: 'shield', keys: [] };

const CAT_OF = new Map();
PERM_CATEGORIES.forEach((c) => c.keys.forEach((k) => CAT_OF.set(k, c.id)));

export function categoryOfKey(key) {
  return CAT_OF.get(key) || OTHER_CATEGORY.id;
}

/**
 * מחלק רשימת פריטי קטלוג (כבר מסוננת לפי מה שמוצג) לקטגוריות, בסדר הקטגוריות ובסדר הפריטים של הקטלוג.
 * קטגוריה ריקה לא מוחזרת. פריט שאין לו קטגוריה -> "אחר" (בסוף).
 * @returns {Array<{id,title,icon,items:Array}>}
 */
export function groupPermissionItems(items) {
  const byCat = new Map();
  for (const it of items || []) {
    const id = categoryOfKey(it.key);
    if (!byCat.has(id)) byCat.set(id, []);
    byCat.get(id).push(it);
  }
  const out = [];
  for (const c of [...PERM_CATEGORIES, OTHER_CATEGORY]) {
    const list = byCat.get(c.id);
    if (list && list.length) {
      // סדר הפריטים בתוך הקטגוריה = הסדר שהוגדר כאן (ולא רק סדר הקטלוג); "אחר" - סדר הקטלוג
      const order = c.keys;
      const sorted = order.length ? [...list].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : list;
      out.push({ id: c.id, title: c.title, icon: c.icon, items: sorted });
    }
  }
  return out;
}
