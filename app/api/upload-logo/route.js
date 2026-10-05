import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { invalidateSettingsCache } from '@/lib/settingsCache';
import { compressLogoBuffer, toDataUrl, LogoError, LOGO_MAX_INPUT_BYTES } from '@/lib/logoCompress';

// העלאת לוגו: כל העלאה נדחסת בשרת (עד 512px בצד הארוך, שקיפות נשמרת, יעד ~100KB) - המקור שהועלה לעולם לא נשמר.
// ר' lib/logoCompress.js. התשובה כוללת לפני/אחרי (originalBytes/storedBytes) להצגה למנהל.
export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'לא נמצא קובץ' }, { status: 400 });
    }
    if (typeof file.size === 'number' && file.size > LOGO_MAX_INPUT_BYTES) {
      return NextResponse.json({ error: `הקובץ גדול מדי (${(file.size / 1048576).toFixed(1)}MB). אפשר להעלות עד ${LOGO_MAX_INPUT_BYTES / 1048576}MB` }, { status: 413 });
    }

    const original = Buffer.from(await file.arrayBuffer());

    let result;
    try {
      result = await compressLogoBuffer(original);
    } catch (err) {
      if (err instanceof LogoError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === 'too-large-input' ? 413 : 400 });
      }
      throw err;
    }
    const dataUrl = toDataUrl(result.buffer, result.mime);

    // Save to database instead of static public folder to avoid Next.js caching issues
    await prisma.systemSetting.upsert({
      where: { key: 'BRAND_LOGO' },
      update: { value: dataUrl },
      create: { key: 'BRAND_LOGO', value: dataUrl, name: 'לוגו מערכת' }
    });
    // הלוגו החדש מוצג מיד גם באינסטנס הזה (לא מחכים ל-TTL של מטמון ההגדרות)
    invalidateSettingsCache('BRAND_LOGO');

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      originalBytes: result.originalBytes,
      storedBytes: result.bytes,
      width: result.width,
      height: result.height,
      format: result.mime,
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הלוגו' }, { status: 500 });
  }
}
