// כלל עריכת פריט בכרטיס הזמנה: עריכה מלאה (דגם/מידה/תיקונים, כולל השפעה על הסכומים)
// מותרת רק בתוך 15 דקות מהעדכון האחרון של הפריט. אחרי זה נשאר פתוח לעריכה רק פירוט התיקון.
export const ITEM_EDIT_WINDOW_MINUTES = 15;

export function isWithinItemEditWindow(item, nowMs = Date.now()) {
  if (!item) return false;
  // updatedAt, לא createdAt: אצל פריטים שהוגרו מ-Access, ל-createdAt של כל 77,834
  // השורות יש את אותו ערך קבוע (רגע הרצת המיגרציה) ולא את מועד ההוספה האמיתי, כך
  // שהוא נועל אותם מעריכה מלאה לצמיתות. updatedAt תמיד קיים (@updatedAt עם ברירת
  // מחדל), ומשקף נכון "מתי הפריט נגע לאחרונה" גם לפריטים ישנים (=רגע המיגרציה, כל
  // עוד לא נערכו מאז) וגם לפריטים חדשים.
  const referenceDate = item.updatedAt || item.createdAt;
  if (!referenceDate) return true;
  const referenceMs = new Date(referenceDate).getTime();
  if (Number.isNaN(referenceMs)) return true;
  return (nowMs - referenceMs) / 60000 <= ITEM_EDIT_WINDOW_MINUTES;
}
