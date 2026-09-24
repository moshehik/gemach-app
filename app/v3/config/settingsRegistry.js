// app/v3/config/settingsRegistry.js — קטלוג ה-SystemSetting keys שרכיבי v3
// קוראים (CONSTITUTION §ט.2/§ט.3, LIBRARY-MAP §5). מקור אחד: רכיב לא קורא
// הגדרה בשם מחרוזת חופשי - רק דרך useOrgConfig() ומפתח רשום כאן (lint #12).
//
// **בנוי מהטבלה המתועדת ב-CONSTITUTION.md §ט.3** (ההבדלים הידועים בין הראשי
// לנווה יעקב) - לא מקריאת DB חי: לסביבה הזו (סוכן ענן, בלי סודות) אין גישה
// ל-DATABASE_URL/TEST_DATABASE_URL של אף ארגון (D-12/§ט.4 דורשים סוכן מקומי
// עם גישה, ויומן ACCESS-LOG.md - שניהם לא זמינים כאן). ערכי profiles/*.json
// הם transcription נאמן של הטבלה שכבר מחייבת בחוקה, לא ניחוש; מישהו עם גישה
// אמיתית צריך לאמת אותם מול ה-DB החי לפני שנשענים עליהם ל-100% (ראו
// docs/redesign-v3/AGENT-QUESTIONS.md).
//
// type: 'flag'(boolean) | 'num' | 'text' | 'list' | 'json'
// default: הערך כשהשורה חסרה מה-DB (= ההתנהגות הקיימת מבלי הגדרה, לפי הקוד)
// meaning: הסבר קצר לעריכה/גלריה. affects: אילו slot/ארכיטיפ מושפע.

export const SETTINGS_REGISTRY = {
  enable_deliveries: { type: 'flag', default: false, meaning: 'טאב/כרטיס משלוח קיים בהזמנה', affects: ['orderCard.deliveryTab', 'nav.deliveries'] },
  delivery_price: { type: 'num', default: 50, meaning: 'מחיר משלוח שטוח כשאין טבלת ערים', affects: ['orderCard.deliveryTab'] },
  delivery_price_by_city: { type: 'json', default: {}, meaning: 'טבלת מחיר משלוח לפי עיר', affects: ['orderCard.deliveryTab'] },
  deliveries_select_by_event_date: { type: 'flag', default: false, meaning: 'מסך משלוחים בוחר לפי תאריך אירוע ולא חלון יציאה/חזרה', affects: ['deliveries.page'] },
  enable_order_edit_summary_confirm: { type: 'flag', default: false, meaning: 'חלון סיכום לפני שמירת הזמנה', affects: ['orderCard.save'] },
  consolidate_manual_payment_credit_ui: { type: 'flag', default: false, meaning: 'כפתור "הוספת תשלום/זיכוי" מאוחד בפרטים כלליים במקום שני כפתורים בתשלומים', affects: ['orderCard.payments', 'orderCard.generalDetails'] },
  allow_additional_payment_on_order: { type: 'flag', default: false, meaning: 'מציג כפתור "תשלום נוסף" בכלל', affects: ['orderCard.payments'] },
  require_customer_id_number: { type: 'flag', default: false, meaning: 'שדה ת"ז חובה בכרטיס לקוחה/הזמנה', affects: ['customerCard.details', 'orderNew.customer'] },
  enforce_rental_barcode_match: { type: 'flag', default: false, meaning: 'חוסם השכרת ברקוד שלא תואם לדגם/מידה בלי אישור מנהל', affects: ['orderCard.itemsTab'] },
  enable_alterations: { type: 'flag', default: true, meaning: 'עמודת/תכונת תיקונים בהזמנה ובניווט', affects: ['orderCard.itemsTab', 'nav.alterations'] },
  max_items_per_order: { type: 'num', default: 20, meaning: 'מגבלת פריטים בהזמנה אחת', affects: ['orderCard.itemsTab', 'orderNew.items'] },
  hide_custom_spacing: { type: 'flag', default: false, meaning: 'מסתיר את יכולת העובד לדרוס את פער ימי החוצץ בהזמנה ספציפית', affects: ['orderCard.generalDetails'] },
  same_model_swap_no_fee: { type: 'flag', default: false, meaning: 'החלפת מידה באותו דגם ללא עמלה', affects: ['orderCard.itemsTab'] },
  swap_min_days_before_event: { type: 'num', default: 0, meaning: 'מספר ימים מינימלי לפני אירוע שבו החלפת מידה מותרת', affects: ['orderCard.itemsTab'] },
  swap_same_category_only: { type: 'flag', default: false, meaning: 'החלפת מידה מותרת רק בתוך אותה קטגוריית מחיר', affects: ['orderCard.itemsTab'] },
  swap_pairing_window_minutes: { type: 'num', default: 0, meaning: 'חלון זמן (דק׳) לצימוד פעולת הסרה+הוספה כ"החלפה" אחת', affects: ['orderCard.itemsTab'] },
  CANCELLATION_CREDIT_MINUTES: { type: 'num', default: 120, meaning: 'חלון זמן שבו דמי ביטול הופכים לזיכוי מלא', affects: ['orderCard.itemsTab', 'orderCard.payments'] },
  instant_undo_minutes: { type: 'num', default: 15, meaning: 'חלון "ביטול מיידי" לפעולה שכבר בוצעה בשרת (R2, §ז.6)', affects: ['orderCard.changeRail'] },
  gap_size_price_rule: { type: 'text', default: '', meaning: 'כלל תמחור לפער מידה חסרה במחירון (למשל "cheaper")', affects: ['pricelist'] },
  size_edit_until_days_before_event: { type: 'num', default: 0, meaning: 'עד כמה ימים לפני האירוע מותר לערוך מידה', affects: ['orderCard.itemsTab'] },
  refund_tiers_at_deletion_time: { type: 'flag', default: false, meaning: 'מדרגות ההחזר נקבעות לפי זמן המחיקה ולא זמן ההזמנה', affects: ['orderCard.payments'] },
  NO_REFUND_DAYS_BEFORE_EVENT: { type: 'num', default: 14, meaning: 'כמה ימים לפני האירוע ההחזר מתאפס', affects: ['orderCard.payments'] },
  premium_pricing_enabled: { type: 'flag', default: false, meaning: 'תיבת "פרימיום" בעריכת דגם שמלה', affects: ['dressCard.details'] },
  agent_digest_email_enabled: { type: 'flag', default: false, meaning: 'דיגסט PR דו-יומי לתוכנתן (אין UI - מפתח קיים רק לתיעוד המטריצה)', affects: [] },
  restrict_board_to_managers: { type: 'flag', default: false, meaning: 'לוח חודשי מוצג רק להנהלה/מנהלי סניף', affects: ['nav.board', 'page:board'] },
  restrict_refunds_to_head_management: { type: 'flag', default: false, meaning: 'זיכויים מוצגים רק להנהלה ראשית', affects: ['nav.refunds', 'page:refunds'] },
  hide_internal_messaging: { type: 'flag', default: false, meaning: 'מסתיר הודעות פנים-ארגוניות', affects: ['nav.messages'] },
  hide_ai_features: { type: 'flag', default: false, meaning: 'כיבוי גורף של תכונות AI (בנוסף להרשאה feature:ai)', affects: ['aiWidget'] },
  hide_dress_images: { type: 'flag', default: false, meaning: 'הסתרת תמונות שמלה ברשימות/כרטיסים', affects: ['dressCard', 'dressesList'] },
  hide_gregorian_calendar: { type: 'flag', default: false, meaning: 'הסתרת התאריך הלועזי לצד העברי', affects: ['orderCard.generalDetails'] },
  hide_marketing_consent_field: { type: 'flag', default: false, meaning: 'הסתרת שדה הסכמה לדיוור', affects: ['customerCard.details'] },
  // כרטיס לקוח (פיילוט) — כולם נאכפים בצד הלקוח רק ביצירת לקוח חדש (דיווח 48ff7055), כמו היום.
  require_customer_email: { type: 'flag', default: false, meaning: 'דוא"ל חובה ביצירת לקוח', affects: ['customerCard.new'] },
  require_full_address: { type: 'flag', default: false, meaning: 'עיר+רחוב+מספר בית חובה ביצירת לקוח', affects: ['customerCard.new'] },
  // text ולא json: הערך הגולמי עובר כמו שהוא ל-parseFieldGroups (lib/customerValidation.js) — שם נקבעים
  // ברירת המחדל [["phone2","email"]] ל-חסר/ריק/JSON שבור, ו-'[]' = ללא דרישה. לא משכפלים את הלוגיקה.
  mandatory_field_groups: { type: 'text', default: '', meaning: 'קבוצות "לפחות אחד מבין" ביצירת לקוח (JSON)', affects: ['customerCard.new'] },
  require_login: { type: 'flag', default: true, meaning: 'האם האתר דורש התחברות (כבוי רק בקיוסק)', affects: ['*'] },
};

/** getSettingDef(key) - זורק אם המפתח לא רשום (lint #12: אין קריאה למפתח לא-קטלוגי). */
export function getSettingDef(key) {
  const def = SETTINGS_REGISTRY[key];
  if (!def) throw new Error(`[v3 config] מפתח SystemSetting לא רשום ב-settingsRegistry.js: "${key}" — הוסיפו רשומה + שורה במטריצת org-variance (CONSTITUTION §ט.3) לפני שימוש.`);
  return def;
}
