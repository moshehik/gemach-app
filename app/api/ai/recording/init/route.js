import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { checkAiAccess } from '@/lib/permissions';
import { getCachedSetting } from '@/lib/settingsCache';
import { isDriveBridgeConfigured, startResumableUpload } from '@/lib/driveBridgeServer';

// פותח העלאה ישירה של הקלטת מסך (וידאו) לדרייב — ר' lib/uploadScreenRecording.js.
// הדפדפן מקבל session URI ל-PUT אחד לקובץ הזה בלבד; הוא לא עובר דרך Vercel ולא דרך Neon.
const MAX_BYTES = 200 * 1024 * 1024;

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  // הסרטה מתוך דיווח שגיאה לא דורשת הרשאת AI (מי שמדווח אינו בהכרח משתמש AI); הסרטה מעוזר ה-AI דורשת.
  const forErrorReport = body.purpose === 'error-report';
  if (!forErrorReport && !(await checkAiAccess())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const setting = await getCachedSetting('ai_screen_recording_enabled');
    if (!setting || setting.value !== 'true') {
      return NextResponse.json({ error: 'הסרטת מסך אינה מופעלת במערכת' }, { status: 403 });
    }
    if (!isDriveBridgeConfigured()) {
      // הלקוח ממשיך בלי וידאו (רק רשימת הפעולות) — ר' uploadScreenRecording
      return NextResponse.json({ error: 'אחסון הוידאו בדרייב אינו מוגדר בשרת', code: 'DRIVE_NOT_CONFIGURED' }, { status: 503 });
    }
    // הלקוח פותח את ההעלאה כבר בתחילת ההקלטה (כדי להסתיר את זמן ההמתנה לגשר), כשהגודל עוד לא ידוע
    const size = Number(body.size) || 0;
    if (size < 0 || size > MAX_BYTES) return NextResponse.json({ error: 'גודל הקלטה לא חוקי' }, { status: 400 });

    const name = `rec-${Date.now()}-${Math.round(Math.random() * 1e9)}.webm`;
    const origin = new URL(request.url).origin;
    const { sessionUri } = await startResumableUpload({ name, mimeType: 'video/webm', size, origin });
    return NextResponse.json({ sessionUri, name });
  } catch (error) {
    console.error('Error starting recording upload:', error);
    return NextResponse.json({ error: 'שגיאה בפתיחת העלאת ההקלטה' }, { status: 500 });
  }
}
