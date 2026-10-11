// lib/enterNavigation.js - מעבר בין שדות ב-Enter בטפסי רישום / עריכת לקוח (בקשת הבעלים 12.10.2026: "נח מאוד לעבור באנטר בין הפרטים -
// זה נעצר בדו-מצבי של 'מאשר קבלת דיוורים'"). מקור יחיד לכל הטפסים: טופס לקוח חדש בהזמנה, כרטיס לקוח, לקוח חדש, הטפסים הישנים - וגם
// טופס הרישום בעמדת הלקוח (app/customer-interface - הסוכן שאחראי עליו מייבא את useEnterNavigation / handleEnterKey מכאן).
//
// כללים:
//  - Enter בשדה טקסט / מייל / טלפון / מספר / select -> השדה הבא הנראה לעין בטופס (לפי סדר ה-DOM). Shift+Enter -> אחורה.
//  - מתג / תיבת סימון / בחירת כן-לא (radio, role=radio): Enter רק מקדם לשדה הבא ולעולם לא משנה את הבחירה. רווח משנה (ברירת מחדל של הדפדפן);
//    חצים בתוך קבוצת כן-לא בוחרים. קבוצת radio נחשבת עצירה אחת (לא כל כפתור לחוד).
//  - בשדה האחרון: onSubmit (כמו "שמור לקוח והמשך" / "שמירה") אם הוגדר; אחרת הדפדפן ממשיך כרגיל (שליחת form טבעית).
//  - textarea: Enter רגיל = שורה חדשה; Ctrl/Cmd+Enter מקדם / שולח.
//  - כפתורים וקישורים: Enter שלהם נשאר לחיצה (לא נוגעים).
//  - קלט בזמן הקלדה במקלדת IME (isComposing) ואירוע שכבר טופל (defaultPrevented - למשל בחירת הצעה מרשימה) לא נחשבים.
//  - שדה מושבת / לקריאה בלבד / מוסתר / [data-enter-skip] / tabindex שלילי לא נכללים. [data-enter-stop] מוסיף עצירה לרכיב מותאם.
//
// הקובץ בלי React ובלי '@/' - נטען ב-node רגיל (הבדיקות מזריקות DOM מדומה) ובדפדפן.

export const ENTER_STOP_SELECTOR = 'input, select, textarea, [role="radio"], [data-enter-stop]';
const NON_STOP_INPUT_TYPES = new Set(['hidden', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color']);
const TEXTLIKE_INPUT_TYPES = new Set(['text', 'search', 'tel', 'url', 'email', 'password', 'number', '']);

const isRadioLike = (el) => (el.tagName === 'INPUT' && el.type === 'radio') || el.getAttribute?.('role') === 'radio';

function isVisible(el) {
  if (!el || el.hidden) return false;
  if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.hasAttribute && (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert'))) return false;
    node = node.parentElement;
  }
  const view = el.ownerDocument && el.ownerDocument.defaultView;
  if (view && view.getComputedStyle) {
    const cs = view.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
  }
  return true;
}

function isStop(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.hasAttribute('data-enter-skip')) return false;
  const explicit = el.hasAttribute('data-enter-stop');
  const tag = el.tagName;
  if (!explicit) {
    if (tag === 'INPUT') {
      if (NON_STOP_INPUT_TYPES.has(el.type)) return false;
      if (el.readOnly && el.type !== 'checkbox' && el.type !== 'radio') return false;
    } else if (tag === 'TEXTAREA') {
      if (el.readOnly) return false;
    } else if (tag !== 'SELECT' && !isRadioLike(el)) {
      return false;
    }
    if (el.disabled) return false;
    // radio נבחרות ב-roving tabindex; שאר העצירות חייבות להיות ניתנות לפוקוס מהמקלדת
    if (!isRadioLike(el) && typeof el.tabIndex === 'number' && el.tabIndex < 0) return false;
  } else if (el.disabled) return false;
  return isVisible(el);
}

/** מפתח קבוצה לרדיו (שם הקלט, או האלמנט role=radiogroup); אחרת null. */
function radioGroupKey(el, container) {
  if (!isRadioLike(el)) return null;
  if (el.tagName === 'INPUT') return el.name ? `n:${el.name}` : null;
  const g = el.closest('[role="radiogroup"]');
  return g && container.contains(g) ? g : null;
}

/**
 * רשימת העצירות בסדר ה-DOM. כל קבוצת רדיו מיוצגת בעצירה אחת (הנבחר, אחרת הראשון).
 * מחזיר מערך של {el, group} - group = null לעצירה רגילה, אחרת מפתח הקבוצה (כדי לדעת איזו עצירה מכילה את היעד).
 */
export function collectEnterStops(container) {
  const all = Array.from(container.querySelectorAll(ENTER_STOP_SELECTOR));
  const stops = [];
  const seenGroups = new Map();
  for (const el of all) {
    if (!isStop(el)) continue;
    const key = radioGroupKey(el, container);
    if (key === null) { stops.push({ el, group: null }); continue; }
    const checked = el.tagName === 'INPUT' ? el.checked : el.getAttribute('aria-checked') === 'true';
    const prev = seenGroups.get(key);
    if (!prev) { const entry = { el, group: key, checked }; seenGroups.set(key, entry); stops.push(entry); }
    else if (checked && !prev.checked) { prev.el = el; prev.checked = true; }
  }
  return stops;
}

/** מציאת העצירה שמכילה את היעד (היעד עצמו, או חבר בקבוצת רדיו שנציגה אחר). */
export function indexOfStop(stops, target, container) {
  let i = stops.findIndex((s) => s.el === target);
  if (i >= 0) return i;
  const key = radioGroupKey(target, container);
  if (key !== null) i = stops.findIndex((s) => s.group === key);
  return i;
}

function focusStop(el) {
  el.focus();
  if (el.tagName === 'INPUT' && TEXTLIKE_INPUT_TYPES.has(el.type) && typeof el.select === 'function') {
    try { el.select(); } catch { /* שדה בלי בחירה (למשל type=email בחלק מהדפדפנים) */ }
  }
}

/**
 * מטפל באירוע keydown. event: אירוע DOM או React; container: האלמנט שמכיל את הטופס; onSubmit: נקרא בשדה האחרון (אופציונלי).
 * מחזיר true כשהאירוע טופל (preventDefault נקרא).
 */
export function handleEnterKey(event, { container, onSubmit } = {}) {
  if (!event || event.key !== 'Enter') return false;
  if (event.isComposing || event.keyCode === 229 || event.defaultPrevented || event.altKey) return false;
  const target = event.target;
  const root = container || event.currentTarget;
  if (!target || target.nodeType !== 1 || !root || !root.contains(target)) return false;

  const tag = target.tagName;
  const radio = isRadioLike(target);
  // כפתור / קישור / summary: ה-Enter שלהם הוא הפעלה (אלא אם זה כפתור רדיו מותאם role=radio)
  if (!radio && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return false;
  if (tag === 'TEXTAREA' && !(event.ctrlKey || event.metaKey)) return false;
  if (!radio && !target.matches(ENTER_STOP_SELECTOR)) return false;

  const stops = collectEnterStops(root);
  const at = indexOfStop(stops, target, root);
  if (at < 0) return false;
  const dir = event.shiftKey ? -1 : 1;
  const next = stops[at + dir];
  if (next) {
    event.preventDefault();
    focusStop(next.el);
    return true;
  }
  if (dir > 0 && typeof onSubmit === 'function') {
    event.preventDefault();
    onSubmit();
    return true;
  }
  // מתג / תיבת סימון / בחירת כן-לא בסוף הטופס בלי onSubmit: Enter לא משנה בחירה ולא שולח בטעות
  if (radio || (tag === 'INPUT' && target.type === 'checkbox')) { event.preventDefault(); return true; }
  return false;
}
