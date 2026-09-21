import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { openRecordingStream } from '@/lib/driveBridgeServer';

// השמעת הסרטת מסך מהדרייב בתוך דף דיווחי השגיאות (ר' AttachmentThumb ב-ErrorReportButton.js).
// הקובץ פרטי בדרייב; השרת מזרים אותו למשתמש מחובר בלבד, ורק אם הוא הקלטה של האתר הזה
// (אימות ב-openRecordingStream). הזרם עובר הלאה כמו שהוא, בלי לטעון את הקובץ לזיכרון.
export const dynamic = 'force-dynamic';
// בהשמעה ראשונה (cold start) הפנייה לגשר של Apps Script יכולה לקחת יותר מ-10 שניות
export const maxDuration = 60;

export async function GET(request, { params }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const { status, headers, body } = await openRecordingStream(id, request.headers.get('range'));
    return new Response(body, { status, headers });
  } catch (error) {
    console.error('Error streaming recording:', error);
    return NextResponse.json({ error: 'ההסרטה אינה זמינה' }, { status: 404 });
  }
}
