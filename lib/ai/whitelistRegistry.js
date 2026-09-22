// lib/ai/whitelistRegistry.js — the INVERSE of lib/ai/restrictionsRegistry.js: instead of a
// denylist ("don't reveal X"), a per-feature ALLOWLIST of exactly which tables/columns/topics are
// safe to expose, plus a reusable prompt template for a future "reverse AI" mode that can answer
// ONLY from the allowlist and must refuse anything else outright.
//
// STATUS: this is a preparation/design catalog, saved via the same SystemSetting mechanism as
// lib/ai/restrictionsConfig.js (`whitelistMode`/`whitelist` fields, editable on
// /admin/ai-restrictions). It is NOT wired into the 7 existing routes' runtime behavior tonight —
// none of them currently branch on `whitelistMode`. Wiring a real "reverse AI" mode (a route that
// actually enforces allowlist-only answers, e.g. by filtering SQL columns/tables to the allowlist
// before execution, not just prompting the model to self-restrict) is future work; this file is
// the groundwork so that decision doesn't start from a blank page.
//
// Grounded in the real schema (prisma/schema.prisma) and the same 7 features as
// restrictionsRegistry.js — written 2026-09-22.

export const AI_WHITELISTS = {
  main_chat: {
    candidateFields: [
      { id: 'customer_basic', table: 'Customer', columns: ['firstName', 'lastName', 'phone1', 'phone2', 'city', 'street'], label: 'פרטי קשר בסיסיים של לקוח', riskNote: 'לא כולל אימייל/הערות פנימיות.' },
      { id: 'order_operational', table: 'Order', columns: ['orderId', 'eventDate', 'eventDateHebrew', 'returnDate', 'fromDate', 'toDate', 'isDelivery', 'deliveryCity'], label: 'נתוני הזמנה תפעוליים (בלי כסף)', riskNote: 'ללא totalAmount/totalPaid/paymentMethod/paymentDate.' },
      { id: 'order_financial', table: 'Order', columns: ['totalAmount', 'totalPaid', 'paymentMethod', 'paymentDate', 'isPaid'], label: 'נתוני הזמנה פיננסיים', riskNote: 'רגיש — לא להוסיף לרשימה לבנה של עובד לא-מנהל.' },
      { id: 'dress_inventory', table: 'DressItem', columns: ['dressName', 'barcodePrefix', 'sizeText', 'location', 'notInUse', 'inRepair'], label: 'מלאי שמלות (ללא מחיר)', riskNote: 'location יכול לרמז על "מחסן"/"רזרבה" — יש הגבלה נפרדת על כך.' },
      { id: 'employee_wage', table: 'Employee', columns: ['hourlyWage', 'password', 'pinHash'], label: 'שכר/סודות עובד', riskNote: 'אסור בהחלט — לעולם לא ברשימה לבנה.' },
    ],
    defaultWhitelist: ['customer_basic', 'order_operational', 'dress_inventory'],
  },
  recording: {
    candidateFields: [
      { id: 'action_steps_text', table: '(רשימת פעולות, לא DB)', columns: [], label: 'רשימת פעולות מוקלטת (טקסט, שדות רגישים כבר הוסתרו בדפדפן)', riskNote: 'הווידאו עצמו אינו מסונן — לא בטוח לרשימה לבנה כפי שהוא.' },
    ],
    defaultWhitelist: ['action_steps_text'],
  },
  statistics: {
    candidateFields: [
      { id: 'order_counts', table: 'Order/OrderItem', columns: ['COUNT(*)', 'GROUP BY'], label: 'ספירות/צבירות מצטברות בלבד (לא שורות גולמיות)', riskNote: 'מתאים למצב "reverse AI" שמותר לו להחזיר רק אגרגציות.' },
    ],
    defaultWhitelist: [],
  },
  smart_search: {
    candidateFields: [
      { id: 'orders_nonfinancial', table: 'Order', columns: ['orderId', 'eventDate', 'status', 'notes'], label: 'חיפוש הזמנות ללא עמודות כסף', riskNote: 'תואם למגבלת financial_columns_orders ב-restrictionsRegistry.js.' },
    ],
    defaultWhitelist: ['orders_nonfinancial'],
  },
  admin_sql_generator: {
    candidateFields: [
      { id: 'no_whitelist_by_design', table: '-', columns: [], label: 'לא מתאים למצב רשימה לבנה', riskNote: 'תכונה זו מיועדת מטבעה לכתיבת SQL גמיש (כולל UPDATE/DELETE) עבור הנהלה ראשית בלבד — הגבלה לרשימה לבנה סותרת את מטרתה.' },
    ],
    defaultWhitelist: [],
  },
  audit_chat: {
    candidateFields: [
      { id: 'filter_fields_only', table: '(מבנה JSON קבוע, לא DB)', columns: ['action', 'entityType', 'startDate', 'endDate', 'search'], label: 'שדות הפילטר המובנים בלבד', riskNote: 'כבר מוגבל מטבעו — Gemini לעולם לא רואה שורת יומן אמיתית.' },
    ],
    defaultWhitelist: ['filter_fields_only'],
  },
  report: {
    candidateFields: [
      { id: 'caller_supplied_data_only', table: '(מגיע מה-caller, לא DB)', columns: [], label: 'רק הנתונים שכבר נשלחו ע"י הקורא', riskNote: 'תכונה זו ממילא לא ניגשת ל-DB בעצמה — הרשימה הלבנה הרלוונטית היחידה היא "אל תמציא נתונים" (no_data_fabrication ב-restrictionsRegistry.js).' },
    ],
    defaultWhitelist: ['caller_supplied_data_only'],
  },
};

// A reusable system-prompt scaffold for a future "reverse AI" (allowlist-only assistant). Not
// invoked by any route today — kept here so building that mode later starts from a real draft.
export function buildWhitelistOnlySystemPrompt(featureKey, selectedFieldIds) {
  const catalog = AI_WHITELISTS[featureKey];
  if (!catalog) return '';
  const fields = catalog.candidateFields.filter((f) => selectedFieldIds.includes(f.id));
  if (fields.length === 0) {
    return 'STRICT ALLOWLIST MODE: no data fields have been approved for this feature. Refuse every question and explain that this assistant currently has no approved data to answer from.';
  }
  const fieldLines = fields
    .map((f) => `- ${f.label}${f.table !== '-' ? ` (${f.table}${f.columns.length ? `: ${f.columns.join(', ')}` : ''})` : ''}`)
    .join('\n');
  return `STRICT ALLOWLIST MODE: you may answer ONLY using the following approved data — nothing else, even if you believe you know the answer from elsewhere in the conversation or the schema:
${fieldLines}

If the user's question requires any data NOT in this list, you MUST refuse and say plainly (in Hebrew) that this assistant is not permitted to answer that, without guessing or partially answering. Never reveal the existence of tables/columns outside this list.`;
}
