// אחסון ועיבוד תמונות שמלה (צד שרת בלבד — אל תייבאו מקומפוננטות לקוח).
//
// שני תפקידים:
// 1. createImageVariants — הקטנה ודחיסה עם sharp: גרסת ווב (עד 1600px) שנשמרת
//    ב-DressModel.imageUrl, וגרסת thumbnail (עד 300px) בשם זהה עם סיומת
//    "-thumb" (המוסכמה שצד הלקוח גוזר ממנה — ראה app/lib/dressImageUrl.js).
// 2. storeBuffers — כתיבה ל-Vercel Blob כשקיים BLOB_READ_WRITE_TOKEN
//    (בפרודקשן על Vercel מערכת הקבצים אפמרלית — קבצים שנכתבים אליה נעלמים
//    בין הרצות/דיפלויים), או ל-public/uploads בפיתוח מקומי ללא טוקן.
//
// ההעלאה המקורית אינה נשמרת — גרסת הווב (איכות 82, עד 1600px) היא המקור
// החדש. זה חוסך אחסון (תמונות מצלמה של 5MB+ יורדות לכ-200-400KB) בלי הבדל
// נראה לעין בגדלים שבהם המערכת מציגה תמונות.

import path from 'path';
import { promises as fs } from 'fs';

export const WEB_MAX_PX = 1600;
export const WEB_JPEG_QUALITY = 82;
export const THUMB_MAX_PX = 300;
export const THUMB_JPEG_QUALITY = 78;

export function hasBlobToken() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * מייצר מהתמונה שהועלתה שתי גרסאות JPEG מוקטנות.
 * מחזיר null אם sharp לא הצליח לפענח את הקובץ (פורמט לא נתמך / קובץ פגום) —
 * ואז הקורא שומר את הקובץ המקורי כמו שהוא (ההתנהגות ההיסטורית).
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
 * שומר רשימת קבצים ומחזיר מפה name -> כתובת ציבורית.
 * files: [{ name, buffer, contentType }]
 */
export async function storeBuffers(files) {
  if (hasBlobToken()) {
    const { put } = await import('@vercel/blob');
    const urls = {};
    for (const f of files) {
      // addRandomSuffix:false — השם כבר ייחודי (חותמת זמן + מספר אקראי),
      // וחשוב שכתובת ה-thumb תהיה גזירה דטרמיניסטית מכתובת הווב.
      const blob = await put(`uploads/${f.name}`, f.buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: f.contentType,
      });
      urls[f.name] = blob.url;
    }
    return urls;
  }

  // פיתוח מקומי ללא טוקן — ההתנהגות ההיסטורית: public/uploads
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const urls = {};
  for (const f of files) {
    await fs.writeFile(path.join(uploadDir, f.name), f.buffer);
    urls[f.name] = `/uploads/${f.name}`;
  }
  return urls;
}
