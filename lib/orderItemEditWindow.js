import { findPriceRowForSize, isSamePriceBand, normalizeGapRule } from './priceRows';
import { toIsraelCalendarDate } from './hebrewDate';

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

// ===== עריכת מידה בלבד אחרי חלון ה-15 דקות (הגדרה size_edit_until_days_before_event) =====
// כשההגדרה מספר N: גם אחרי שהחלון נסגר מותר לשנות מידה בתוך הפריט - כשהדגם לא משתנה, הפריט
// לא נלקח, התיקונים לא משתנים, המידה החדשה נמצאת באותה שורת מחיר כמו הישנה, ונשארו עד האירוע
// לפחות N ימי לוח (שעון ישראל). הכלל כאן טהור ומשמש גם את השרת (האכיפה הקובעת) וגם את הממשק.

// ערך ההגדרה -> מספר שלם >= 0, או null כשההגדרה חסרה/ריקה/לא תקינה (= כבוי, רק חלון ה-15 דקות).
export function parseSizeEditDays(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  return parseInt(str, 10);
}

// כמה ימי לוח (בשעון ישראל) נשארו עד האירוע. null כשאין תאריך אירוע תקין. שלילי = האירוע עבר.
export function daysUntilEventIsrael(eventDate, now = new Date()) {
  const ev = toIsraelCalendarDate(eventDate);
  const today = toIsraelCalendarDate(now);
  if (!ev || !today) return null;
  return Math.round((ev.getTime() - today.getTime()) / 86400000);
}

// קטגוריית המחיר של הפריט (של הדגם שלו). פריטי Access ישנים בלי DressItem מקושר - אין להם.
export function getItemPriceCategory(item) {
  const cat = item?.dressItem?.dress?.priceCategory;
  return cat ? String(cat) : null;
}

// שורת המחיר של מידה בקטגוריה - באותו סדר חיפוש כמו המנוע: קטגוריית הדגם, ואז הווריאנט
// "כלול ב...". קודם התאמה ישירה בשתיהן, ורק אחר כך כלל המידות שבין הטווחים (gapRule).
export function findItemPriceBand(priceList, category, sizeText, { eventDate = null, gapRule = 'none' } = {}) {
  if (!category) return { row: null, viaGap: false };
  const size = parseInt(sizeText || '0', 10);
  const cats = [category, category.replace('כלול ב', '').trim()].filter((c, i, arr) => c && arr.indexOf(c) === i);
  for (const cat of cats) {
    const res = findPriceRowForSize(priceList, cat, size, { eventDate, gapRule: 'none' });
    if (res.row) return res;
  }
  if (normalizeGapRule(gapRule) !== 'none') {
    for (const cat of cats) {
      const res = findPriceRowForSize(priceList, cat, size, { eventDate, gapRule });
      if (res.row) return res;
    }
  }
  return { row: null, viaGap: false };
}

// "פחות מ..." בעברית תקינה: פחות מיום אחד / פחות מיומיים / פחות מ-5 ימים
function lessThanDaysPhrase(n) {
  if (n === 1) return 'פחות מיום אחד';
  if (n === 2) return 'פחות מיומיים';
  return `פחות מ-${n} ימים`;
}

/**
 * האם מותר לשנות את מידת הפריט בתוך הפריט אחרי שחלון ה-15 דקות נסגר.
 * מחזיר { ok: true } או { ok: false, reason } כשההסבר בעברית פשוטה.
 * כשהתנאים "הכלליים" (הדגם לא השתנה, הפריט לא נלקח, התיקונים לא השתנו) לא מתקיימים -
 * זו באחריות הקורא; כאן נבדקים רק הכללים של המדיניות: הגדרה, תאריך, ימים וקטגוריית מחיר.
 * sizeEditDays: תוצאת parseSizeEditDays. oldSizeText: המידה השמורה כרגע בפריט.
 */
export function evaluateSizeOnlyEdit({ item, oldSizeText, newSizeText, eventDate, priceList, sizeEditDays, gapRule = 'none', now = new Date() }) {
  if (sizeEditDays === null || sizeEditDays === undefined) return { ok: false, reason: null };

  const category = getItemPriceCategory(item);
  if (!category) {
    return { ok: false, reason: 'לפריט הזה אין קטגוריית מחיר מזוהה, ולכן אי אפשר להחליף בו מידה ישירות.' };
  }

  const daysLeft = daysUntilEventIsrael(eventDate, now);
  if (daysLeft === null) {
    return { ok: false, reason: 'להזמנה אין תאריך אירוע, ולכן אי אפשר להחליף מידה ישירות בפריט.' };
  }
  if (daysLeft < 0) {
    return { ok: false, reason: 'תאריך האירוע כבר עבר, ולכן אי אפשר להחליף מידה ישירות בפריט.' };
  }
  if (daysLeft < sizeEditDays) {
    return { ok: false, reason: `נשארו ${lessThanDaysPhrase(sizeEditDays)} לאירוע, ולכן אי אפשר להחליף מידה ישירות בפריט.` };
  }

  const opts = { eventDate, gapRule };
  const oldBand = findItemPriceBand(priceList, category, oldSizeText, opts);
  const newBand = findItemPriceBand(priceList, category, newSizeText, opts);
  if (!oldBand.row) {
    return { ok: false, reason: 'המידה הנוכחית של הפריט לא משויכת לקטגוריית מחיר, ולכן אי אפשר להחליף אותה ישירות.' };
  }
  if (!newBand.row) {
    return { ok: false, reason: 'ההחלפה חינם רק לאותה קטגוריית מחיר. למידה שנבחרה אין קטגוריית מחיר.' };
  }
  if (!isSamePriceBand(oldBand, newBand)) {
    return { ok: false, reason: 'ההחלפה חינם רק לאותה קטגוריית מחיר. המידה שנבחרה שייכת לקטגוריית מחיר אחרת.' };
  }
  return { ok: true };
}
