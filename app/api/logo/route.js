import { NextResponse } from 'next/server';
import { getCachedSetting } from '@/lib/settingsCache';

// הלוגו נשמר כ-data URL ב-SystemSetting BRAND_LOGO (ר' app/api/upload-logo/route.js, שדוחס כל העלאה ל-~100KB).
// חיסכון ב-CPU: ETag מ-updatedAt+אורך (בקשה חוזרת => 304 בלי פענוח base64), ופענוח base64 נשמר בזיכרון האינסטנס.
// לוגו שמור ישן וגדול (מעל OVERSIZE_BYTES, עוד לפני ההמרה החד-פעמית scripts/compress_brand_logo.js) מוגש עם אותה מדיניות
// מטמון ארוכה + הכותרת x-logo-oversize, כדי שדפדפנים/CDN לא יבקשו אותו שוב ושוב.
const OVERSIZE_BYTES = 300 * 1024;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

let decoded = { tag: null, buffer: null, contentType: null }; // פענוח אחרון בלבד (לוגו אחד לגמח)

export async function GET(request) {
  try {
    const setting = await getCachedSetting('BRAND_LOGO');

    if (!setting || !setting.value) {
      // Return a 404 or a transparent 1x1 pixel image
      return new NextResponse('Not found', { status: 404 });
    }

    const value = setting.value;
    const stamp = setting.updatedAt ? new Date(setting.updatedAt).getTime() : 0;
    const etag = `"${stamp.toString(36)}-${value.length.toString(36)}"`;
    const oversize = value.length > OVERSIZE_BYTES * 1.34; // base64 גדול ב-~34% מהבינארי
    const baseHeaders = { 'Cache-Control': CACHE_CONTROL, ETag: etag };
    if (oversize) baseHeaders['x-logo-oversize'] = '1';

    if (request && request.headers && request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: baseHeaders });
    }

    if (decoded.tag !== etag) {
      // The value is a base64 data URL (e.g., "data:image/png;base64,iVBORw0KGgo...") - parse only the head, not the whole string
      const comma = value.indexOf(',');
      const base64Data = comma >= 0 ? value.slice(comma + 1) : value;
      const mimeMatch = value.slice(0, 120).match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)/);
      decoded = { tag: etag, buffer: Buffer.from(base64Data, 'base64'), contentType: mimeMatch ? mimeMatch[1] : 'image/png' };
    }

    return new NextResponse(decoded.buffer, {
      headers: { ...baseHeaders, 'Content-Type': decoded.contentType },
    });
  } catch (error) {
    console.error('Error serving logo:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
