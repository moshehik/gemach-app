import { NextResponse } from 'next/server';
import { checkAuth } from '../../../lib/auth';
import { createImageVariants, storeBuffers } from '../../../lib/dressImageStorage';

// העלאת תמונת שמלה (וגם הקלטת מסך של עוזר ה-AI, ר' lib/uploadScreenRecording.js -
// אותו נתיב, sharp פשוט לא מפענח וידאו ונופל לשמירת הקובץ המקורי כמו שהוא). מאז 2026-08:
// - התמונה מוקטנת ונדחסת עם sharp לשתי גרסאות: ווב (עד 1600px, נשמרת
//   ב-imageUrl) ו-thumbnail (עד 300px, נשמרת בנפרד ב-thumbnailUrl) — במקום
//   לשמור קובץ מצלמה של 5MB+ שהוצג בתאי טבלה של 44px.
// - הקבצים נשמרים ב-DB (Attachment, ר' lib/dressImageStorage.js) - לא תלוי
//   בסביבה (Vercel/מקומי), אין אפמריות ואין טוקן להגדיר.

const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 });
    }

    // Size cap (Vercel already stops bodies over ~4.5MB; this protects local / self-hosted runs and the DB-stored Attachment table).
    if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי' }, { status: 413 });
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
      // The stored type is what /api/attachment/<id> serves back (public, same origin as the app), so a client-chosen
      // text/html or image/svg+xml must never be kept: only recordings / audio / pdf keep their type, anything else is opaque.
      const safeType = /^(video|audio)\/[a-z0-9.+-]+$/i.test(file.type || '') || file.type === 'application/pdf' ? file.type : 'application/octet-stream';
      files = [{ name: webName, buffer, contentType: safeType }];
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
