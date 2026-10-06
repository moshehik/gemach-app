// לוגיקה טהורה של PageVariantToggle (app/components/variant/PageVariantToggle.js) - נבדקת ב-scripts/test_page_variant_switch.mjs.

// כיתובי האייקון לפי מסך. במעטפת הישנה האייקון בסרגל העליון ובדף הישן בפינה - שני אייקונים באותו מסך, ולכן הכיתוב של המעטפת
// ("תפריט") שונה משל הדף, ושל כל דף מנוסח לפי הדף עצמו (4.10.2026, ביקורת: שני אייקונים עם אותו aria-label/טולטיפ).
export const TOGGLE_LABELS_BY_SCREEN = Object.freeze({
  shell: Object.freeze({ toNew: 'מעבר לתפריט החדש', toOld: 'חזרה לתפריט הישן' }),
  home: Object.freeze({ toNew: 'מעבר לדף הבית החדש', toOld: 'חזרה לדף הבית הישן' }),
  error_report: Object.freeze({ toNew: 'מעבר לחלון הדיווח החדש', toOld: 'חזרה לחלון הדיווח הישן' }),
  settings: Object.freeze({ toNew: 'מעבר להגדרות החדשות', toOld: 'חזרה להגדרות הישנות' }),
  new_order: Object.freeze({ toNew: 'מעבר לאשף ההזמנה החדש', toOld: 'חזרה לאשף ההזמנה הישן' }),
});
export const DEFAULT_TOGGLE_LABELS = Object.freeze({ toNew: 'מעבר לדף החדש', toOld: 'חזרה לדף הישן' });
export const TOGGLE_FAILED_LABEL = 'המעבר נכשל. נסו שוב.';
export const UNSAVED_CONFIRM_MESSAGE = 'יש שינויים שלא נשמרו - לעבור בכל זאת?';
export const UNSAVED_CONFIRM_TITLE = 'שינויים לא נשמרו';

export function toggleLabelsFor(screen) {
  return TOGGLE_LABELS_BY_SCREEN[screen] || DEFAULT_TOGGLE_LABELS;
}

// בקרות שאינן "קלט משתמש שנשמר": חיפוש, כפתורים, מוסתרים, מושבתים.
const IGNORED_TYPES = new Set(['hidden', 'search', 'button', 'submit', 'reset', 'image', 'file']);

export function isEditableControl(el) {
  if (!el || !el.tagName) return false;
  const tag = String(el.tagName).toUpperCase();
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
  if (el.disabled || el.readOnly) return false;
  if (tag === 'INPUT' && IGNORED_TYPES.has(String(el.type || 'text').toLowerCase())) return false;
  if (typeof el.closest === 'function' && el.closest('.gm-pvt')) return false;
  return true;
}

// האם בקרה אחת שונה מערך ההתחלה (לבקרות לא-מבוקרות). בקרות מבוקרות של React מעדכנות גם את defaultValue, ולכן עבורן
// אין אות מהשוואה - הן נתפסות דרך אירוע input/change אמיתי של המשתמש (ראו userEdited ב-PageVariantToggle).
export function isControlChangedFromDefault(el) {
  if (!isEditableControl(el)) return false;
  const tag = String(el.tagName).toUpperCase();
  if (tag === 'SELECT') return Array.from(el.options || []).some((o) => o.selected !== o.defaultSelected);
  const type = String(el.type || 'text').toLowerCase();
  if (type === 'checkbox' || type === 'radio') return el.checked !== el.defaultChecked;
  return el.value !== el.defaultValue;
}

// האם בדף יש שינויים שלא נשמרו: הדף רשם window.__gmDirty (true, או פונקציה - ערך ההחזרה שלה הוא ההכרעה הסופית), או בקרה שונה מברירת המחדל,
// או שהמשתמש ערך בקרה (userEdited, נאסף ע"י מאזין input/change אמיתי).
export function isPageDirty({ win, doc, userEdited = false } = {}) {
  try {
    const flag = win ? win.__gmDirty : undefined;
    // פונקציה = הכרעה סופית של הדף (האשף החדש של הזמנה חדשה: false אחרי שמירה גם אם המשתמש הקליד); boolean true = מלוכלך, false = ממשיכים לבדיקות הכלליות (כמו תמיד)
    if (typeof flag === 'function') return flag() === true;
    if (flag === true) return true;
  } catch { /* דגל שזורק = לא מלוכלך */ }
  if (userEdited) return true;
  if (doc && typeof doc.querySelectorAll === 'function') {
    for (const el of Array.from(doc.querySelectorAll('input, textarea, select'))) {
      if (isControlChangedFromDefault(el)) return true;
    }
  }
  return false;
}
