// עזרי כתובות לתמונות שמלה (צד לקוח — בלי תלות ב-sharp או @vercel/blob).
//
// מסלול ההעלאה (app/api/upload/route.js) שומר מאז 2026-08 שתי גרסאות לכל
// תמונה: גרסת ווב (עד 1600px) שהכתובת שלה נשמרת ב-DressModel.imageUrl,
// וגרסת thumbnail (עד 300px) באותו שם עם הסיומת "-thumb" לפני סיומת הקובץ.
// ההסכם הזה תקף גם לקבצים מקומיים (/uploads/...) וגם ל-Vercel Blob.
//
// לתמונות ישנות (שהועלו לפני השינוי, או קבצי /images/dresses/<prefix>.jpg
// הסטטיים) אין קובץ thumb — לכן כל שימוש בכתובת שמחזירה getDressThumbUrl
// חייב לצרף onError שנופל חזרה לתמונה המקורית (ראה dashboard/dresses/page.js).

const IMG_EXT_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

// האם הכתובת שייכת למרחב שבו מסלול ההעלאה מייצר קבצי thumb
function isUploadedImageUrl(url) {
  if (url.startsWith('/uploads/')) return true;
  // כתובות Vercel Blob: https://<store>.public.blob.vercel-storage.com/...
  if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//i.test(url)) return true;
  return false;
}

/**
 * גוזר את כתובת ה-thumbnail מכתובת תמונה, לפי מוסכמת השמות של מסלול ההעלאה.
 * מחזיר null כשאין סיכוי לקובץ thumb (תמונה סטטית, כתובת חיצונית, או
 * כשהכתובת עצמה כבר thumb) — ואז יש להשתמש בכתובת המקורית כמו שהיא.
 */
export function getDressThumbUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (!isUploadedImageUrl(imageUrl)) return null;
  if (/-thumb\.[a-z]+$/i.test(imageUrl)) return null; // כבר thumb
  if (!IMG_EXT_RE.test(imageUrl)) return null;
  return imageUrl.replace(IMG_EXT_RE, (ext) => `-thumb${ext}`);
}
