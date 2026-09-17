// עזר כתובת ל-thumbnail של תמונת שמלה (צד לקוח).
//
// מאז הסרת Vercel Blob (2026-09-18) התמונות נשמרות ב-DB כ-Attachment עצמאיים
// (ר' lib/dressImageStorage.js) - אין יותר מוסכמת שם קובץ לגזור ממנה thumb
// מתוך imageUrl, ולכן DressModel.thumbnailUrl נשמר כשדה נפרד ומפורש.
//
// לתמונות ישנות (שהועלו לפני 2026-09-18, לפני שנוסף thumbnailUrl) אין thumb -
// לכן כל שימוש בכתובת שמחזירה getDressThumbUrl חייב לצרף onError שנופל חזרה
// לתמונה המקורית (ראה dashboard/dresses/page.js).

/**
 * מחזיר את כתובת ה-thumbnail של דגם שמלה, או null אם אין לו אחד (תמונה ישנה,
 * או שאין לדגם תמונה בכלל - השימוש בכתובת החוזרת תמיד עם fallback ל-imageUrl).
 */
export function getDressThumbUrl(dressModel) {
  return dressModel?.thumbnailUrl || null;
}
