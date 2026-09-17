// אחסון ועיבוד תמונות שמלה (צד שרת בלבד — אל תייבאו מקומפוננטות לקוח).
//
// שני תפקידים:
// 1. createImageVariants — הקטנה ודחיסה עם sharp: גרסת ווב (עד 1600px) שנשמרת
//    ב-DressModel.imageUrl, וגרסת thumbnail (עד 300px) שנשמרת בנפרד
//    ב-DressModel.thumbnailUrl (ר' app/lib/dressImageUrl.js).
// 2. storeBuffers — כתיבה ל-Attachment (טבלת Postgres גנרית, ר' prisma/schema.prisma) -
//    מחליף את Vercel Blob (הוסר כליל 2026-09-18, ר' ההערה על מודל Attachment בסכימה).
//    כל קובץ הופך לשורת Attachment עצמאית והכתובת שמוחזרת היא נתיב ההגשה
//    /api/attachment/<id> (ר' app/api/attachment/[id]/route.js).
//
// ההעלאה המקורית אינה נשמרת — גרסת הווב (איכות 82, עד 1600px) היא המקור
// החדש. זה חוסך אחסון (תמונות מצלמה של 5MB+ יורדות לכ-200-400KB) בלי הבדל
// נראה לעין בגדלים שבהם המערכת מציגה תמונות.

import prisma from '@/app/lib/prisma';

export const WEB_MAX_PX = 1600;
export const WEB_JPEG_QUALITY = 82;
export const THUMB_MAX_PX = 300;
export const THUMB_JPEG_QUALITY = 78;

/**
 * מייצר מהתמונה שהועלתה שתי גרסאות JPEG מוקטנות.
 * מחזיר null אם sharp לא הצליח לפענח את הקובץ (פורמט לא נתמך / קובץ פגום, כולל
 * וידאו כמו הקלטת מסך) — ואז הקורא שומר את הקובץ המקורי כמו שהוא (ההתנהגות ההיסטורית).
 */
export async function createImageVariants(buffer) {
  try {
    const sharp = (await import('sharp')).default;
    // rotate() בלי פרמטרים מיישם את אוריינטציית ה-EXIF (תמונות מצלמה/נייד)
    const base = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await base.metadata();
    if (!meta || !meta.format) return null;

    const web = await base.clone()
      .resize(WEB_MAX_PX, WEB_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: WEB_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const thumb = await base.clone()
      .resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMB_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    return { web, thumb, contentType: 'image/jpeg', ext: '.jpg' };
  } catch (e) {
    console.error('sharp processing failed, falling back to original upload:', e);
    return null;
  }
}

/**
 * שומר רשימת קבצים ומחזיר מפה name -> נתיב הגשה (/api/attachment/<id>).
 * files: [{ name, buffer, contentType }]
 */
export async function storeBuffers(files) {
  const urls = {};
  for (const f of files) {
    const attachment = await prisma.attachment.create({
      data: { data: f.buffer, contentType: f.contentType },
      select: { id: true },
    });
    urls[f.name] = `/api/attachment/${attachment.id}`;
  }
  return urls;
}
