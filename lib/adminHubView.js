// lib/adminHubView.js — עזרים טהורים לרכיב "מסך ניהול ראשי" (צד לקוח): תצוגות, מפתח האחסון, חיפוש וקיבוץ.
// אין כאן שום נתון על כלים, שערים או תפקידים: הרכיב מקבל מהשרת (app/admin/page.js) רק את הכלים המותרים והקטגוריות שלהם,
// והפונקציות כאן עובדות על מה שהועבר להן. הקטלוג עצמו (צד שרת בלבד): lib/adminHubCatalog.js.

export const VIEWS = Object.freeze(['rows', 'table', 'tiles']);
export const DEFAULT_VIEW = 'tiles';
export const VIEW_LABELS = Object.freeze({ rows: 'שורות', table: 'טבלה', tiles: 'קוביות' });
export const VIEW_ICONS = Object.freeze({ rows: 'rows', table: 'table', tiles: 'box' });

/** מפתח localStorage לבחירת התצוגה — לכל משתמש בנפרד (מזהה העובד, או 'guest' כשאין התחברות). */
export function viewStorageKey(userId) {
  const id = typeof userId === 'string' && userId ? userId : (typeof userId === 'number' ? String(userId) : 'guest');
  return `gm_admin_hub_view:${id}`;
}
export function normalizeView(v) {
  return VIEWS.includes(v) ? v : DEFAULT_VIEW;
}

/** נרמול לחיפוש: רישיות, רווחים, וגרשיים עבריים מול מירכאות/גרש רגילים (הו״ק = הו"ק, ת׳ = ת'). */
export function normSearch(s) {
  return String(s || '')
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’‚`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** האם כלי תואם לחיפוש: כותרת + תיאור, או שם הקטגוריה שלו (כמו בעיצוב). */
export function toolMatches(tool, query, category) {
  const q = normSearch(query);
  if (!q) return true;
  return normSearch(`${tool.title} ${tool.desc}`).includes(q) || (category ? normSearch(category.title).includes(q) : false);
}

/**
 * הקבוצות לתצוגה: [{ category, tools }] לפי סדר הקטגוריות, רק כאלה שנשאר בהן כלי אחרי הסינון.
 * @param {Array} tools הכלים המותרים (מהשרת)
 * @param {Array} categories הקטגוריות (מהשרת), לפי הסדר
 * @param {string} query טקסט החיפוש
 */
export function groupTools(tools, categories, query) {
  const list = Array.isArray(tools) ? tools : [];
  return (Array.isArray(categories) ? categories : [])
    .map((category) => ({ category, tools: list.filter((t) => t.cat === category.id && toolMatches(t, query, category)) }))
    .filter((g) => g.tools.length > 0);
}
