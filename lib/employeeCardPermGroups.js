// lib/employeeCardPermGroups.js - חלוקת "הרשאות ספציפיות" בכרטיס העובד החדש ל-7 קטגוריות מתקפלות (EC-09).
// הבעלים (4.10.2026): "בלי הכיתוב מקופל ובלי הסוגרים ומחולק לפי קטגוריות (6-7 קבוצות)". היום הפאנל מציג 2 קבוצות (עמודים 11 / פיצ'רים 23);
// כאן אותם 34 פריטים בדיוק, ממוינים ל-7 קטגוריות לפי הנושא. מפתחות שאינם ברשימה (פריט חדש בקטלוג) נופלים לקטגוריה "אחר" - אף פריט
// לא נעלם. ESM טהור (נבדק ב-scripts/test_employee_card_a5.mjs מול PERMISSION_CATALOG האמיתי).

export const PERM_CATEGORIES = [
  { id: 'sales', title: 'מכירות והזמנות', icon: 'bag', keys: ['page:orders', 'page:orders_new', 'page:customers', 'page:rentals', 'page:deliveries'] },
  { id: 'ops', title: 'ניהול ותפעול', icon: 'sliders', keys: ['page:refunds', 'page:dresses_catalog', 'page:board', 'page:alterations', 'page:schedule', 'page:messages', 'feature:schedule_mark_all_done'] },
  { id: 'money', title: 'אישורי תשלום וחוב', icon: 'wallet', keys: ['feature:debt_approval', 'feature:payment_exit_approval', 'feature:unpaid_action_items_tab', 'feature:unpaid_action_rentals_tab', 'feature:manual_payment_credit_add'] },
  { id: 'rental', title: 'אישורי השכרה והחזרה', icon: 'dress', keys: ['feature:reserve_rental_approval', 'feature:warehouse_rental_approval', 'feature:barcode_mismatch_override', 'feature:early_return_approval'] },
  { id: 'order', title: 'אישורי הזמנה ופריטים', icon: 'file', keys: ['feature:item_change_approval', 'feature:item_edit_reopen', 'feature:locked_order_edit', 'feature:special_spacing_approval', 'feature:past_date_order_approval', 'feature:missing_contact_approval', 'feature:order_date_edit_approval'] },
  { id: 'mail', title: 'מייל וייצוא', icon: 'mail', keys: ['feature:customer_email_approval', 'feature:export_over_limit_approval', 'feature:export_max_rows'] },
  { id: 'ai', title: 'בינה מלאכותית ודיווחים', icon: 'info', keys: ['feature:ai', 'feature:ai_financial_data', 'feature:error_reports'] },
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
