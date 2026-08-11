// טיוטות מקומיות של שינויים שלא נשמרו בכרטיס הזמנה.
//
// כרטיס ההזמנה מחזיק את כל העריכות ב-state עד לחיצה על "שמור" — סגירת דפדפן/טאב
// באמצע העלימה עד היום את השינויים בלי שום זכר. המודול הזה שומר את מצב העריכה
// המלא ב-localStorage (פר-הזמנה) כל עוד יש שינויים שלא נשמרו, ומוחק אותו ברגע
// שנשמרו/בוטלו. רשימת ההזמנות משתמשת ב-listOrderDrafts כדי לצבוע שורות עם
// טיוטה ממתינה, וכרטיס ההזמנה מציע בפתיחה לשחזר או למחוק אותה.
//
// localStorage הוא פר-דפדפן/עמדה — מספיק לתרחיש האמיתי (העובדת חוזרת לאותה עמדה),
// בלי סכימת שרת ובלי סנכרון.

const KEY_PREFIX = 'gemachOrderDraft:';
// טיוטה בת חודש כנראה כבר לא רלוונטית — נמחקת בשקט בקריאה הבאה
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const isExpired = (draft) => !draft?.savedAt || (Date.now() - draft.savedAt) > MAX_AGE_MS;

export function saveOrderDraft(orderId, draft) {
  if (!orderId) return;
  try {
    localStorage.setItem(KEY_PREFIX + orderId, JSON.stringify(draft));
  } catch (e) {
    // localStorage מלא/חסום — הטיוטה היא רשת ביטחון, לא מפילים בגללה את הכרטיס
    console.warn('Failed to save order draft', e);
  }
}

export function loadOrderDraft(orderId) {
  if (!orderId) return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + orderId);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (isExpired(draft) || !draft.state) {
      localStorage.removeItem(KEY_PREFIX + orderId);
      return null;
    }
    return draft;
  } catch (e) {
    return null;
  }
}

export function clearOrderDraft(orderId) {
  if (!orderId) return;
  try {
    localStorage.removeItem(KEY_PREFIX + orderId);
  } catch (e) {}
}

// מפה { orderId: { savedAt, summary } } של כל הטיוטות הממתינות — לרשימת ההזמנות.
// לא מחזירים את ה-state המלא (כבד ולא נחוץ שם); טיוטות שפגו נמחקות אגב הסריקה.
export function listOrderDrafts() {
  const drafts = {};
  try {
    const expired = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      try {
        const draft = JSON.parse(localStorage.getItem(key));
        if (isExpired(draft)) {
          expired.push(key);
          continue;
        }
        drafts[key.slice(KEY_PREFIX.length)] = { savedAt: draft.savedAt, summary: draft.summary || [] };
      } catch (e) {
        expired.push(key);
      }
    }
    expired.forEach((key) => localStorage.removeItem(key));
  } catch (e) {}
  return drafts;
}
