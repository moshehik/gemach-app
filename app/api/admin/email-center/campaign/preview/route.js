import { NextResponse } from 'next/server';
import { gateEmailAdmin, requestOrigin } from '@/lib/emailCenterAuth';
import { previewCampaign } from '@/lib/emailCampaign';

export const dynamic = 'force-dynamic';

// POST { input:{subject, bodyText, heading, imageUrl, imageAlt, buttonLabel, buttonUrl, attachments} } -> { subject, html }
// תצוגה מקדימה של הדיוור עם לקוחה לדוגמה ("רחל כהן"). לא שולחת ולא שומרת. כולל כותפת ההסרה (עם קישור דוגמה).
export async function POST(request) {
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  try {
    const r = await previewCampaign({ input: body && body.input, origin: requestOrigin(request) });
    return r.ok ? NextResponse.json({ subject: r.subject, html: r.html }) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (e) {
    console.error('email-center campaign preview failed', e);
    return NextResponse.json({ error: 'שגיאה בהפקת התצוגה' }, { status: 500 });
  }
}
