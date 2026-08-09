import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';
import { createImageVariants, storeBuffers, hasBlobToken } from '../../../lib/dressImageStorage';

// העלאת תמונת שמלה. מאז 2026-08:
// - התמונה מוקטנת ונדחסת עם sharp לשתי גרסאות: ווב (עד 1600px, נשמרת
//   ב-imageUrl) ו-thumbnail (עד 300px, אותו שם עם "-thumb") — במקום לשמור
//   קובץ מצלמה של 5MB+ שהוצג בתאי טבלה של 44px.
// - כשקיים BLOB_READ_WRITE_TOKEN הקבצים נשמרים ב-Vercel Blob (בפרודקשן
//   מערכת הקבצים אפמרלית — כתיבה ל-public/uploads נעלמת בין דיפלויים);
//   בפיתוח מקומי ללא טוקן נשמרים ב-public/uploads כמו קודם.
// תמונות ישנות עם כתובות /uploads/... או /images/dresses/... ממשיכות לעבוד —
// שום דבר בצד הקריאה לא השתנה, רק נוספה גזירת thumb עם נפילה חזרה למקור.

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 });
    }

    // בסביבת Vercel ללא טוקן Blob אין יעד כתיבה עמיד — עדיף שגיאה ברורה
    // מאשר קובץ שייעלם בדיפלוי הבא.
    if (!hasBlobToken() && process.env.VERCEL) {
      return NextResponse.json(
        { error: 'אחסון תמונות אינו מוגדר בשרת: יש ליצור Blob Store בלוח הבקרה של Vercel ולהגדיר את משתנה הסביבה BLOB_READ_WRITE_TOKEN.' },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // שם ייחודי — אותה מוסכמה היסטורית (חותמת זמן + אקראי + שם מנוקה)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
    const baseName = uniqueSuffix + '-' + cleanName.replace(/\.[^.]*$/, '');

    const variants = await createImageVariants(buffer);

    let files;
    let webName;
    let thumbName = null;
    if (variants) {
      webName = `${baseName}${variants.ext}`;
      thumbName = `${baseName}-thumb${variants.ext}`;
      files = [
        { name: webName, buffer: variants.web, contentType: variants.contentType },
        { name: thumbName, buffer: variants.thumb, contentType: variants.contentType },
      ];
    } else {
      // פורמט ש-sharp לא פענח — שומרים את הקובץ המקורי כמו שהוא (התנהגות היסטורית)
      webName = uniqueSuffix + '-' + cleanName;
      files = [{ name: webName, buffer, contentType: file.type || 'application/octet-stream' }];
    }

    const urls = await storeBuffers(files);

    return NextResponse.json({
      success: true,
      imageUrl: urls[webName],
      thumbnailUrl: thumbName ? urls[thumbName] : null,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הקובץ' }, { status: 500 });
  }
}
