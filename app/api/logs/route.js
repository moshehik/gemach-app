import { NextResponse } from 'next/server';
import { redactLogText } from '@/lib/redactSensitive';

export async function POST(req) {
  try {
    const body = await req.json();
    // היומן (Vercel logs) לא מקבל את הגוף הגולמי: הודעת ה-alert עלולה לכלול מספרי טלפון/ת"ז/שמות, וה-URL את ה-query string.
    // נשמרים רק action / הודעה חתוכה ומנוקה מרצפי ספרות / נתיב העמוד (בלי query ובלי hash) / חותמת זמן.
    const b = body && typeof body === 'object' ? body : {};
    let path = '';
    try { path = new URL(String(b.url || ''), 'http://x').pathname; } catch { path = ''; }
    console.log('[UI_LOG]', {
      action: redactLogText(b.action, 60),
      error: redactLogText(b.error, 300),
      path: redactLogText(path, 200),
      timestamp: typeof b.timestamp === 'string' ? b.timestamp.slice(0, 40) : null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging UI event:', error);
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
  }
}
