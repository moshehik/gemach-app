// כלל עריכת פריט בכרטיס הזמנה: עריכה מלאה (דגם/מידה/תיקונים, כולל השפעה על הסכומים)
// מותרת רק בתוך 15 דקות מהעדכון האחרון של הפריט. אחרי זה נשאר פתוח לעריכה רק פירוט התיקון.
export const ITEM_EDIT_WINDOW_MINUTES = 15;

export function isWithinItemEditWindow(item, nowMs = Date.now()) {
  if (!item) return false;
  const referenceDate = item.createdAt || item.updatedAt;
  if (!referenceDate) return true;
  const referenceMs = new Date(referenceDate).getTime();
  if (Number.isNaN(referenceMs)) return true;
  return (nowMs - referenceMs) / 60000 <= ITEM_EDIT_WINDOW_MINUTES;
}
