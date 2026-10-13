import { NextResponse } from 'next/server';
import { gateEmailAdmin, requestOrigin } from '@/lib/emailCenterAuth';
import { sendTestToEmployee } from '@/lib/emailCampaign';
import { allow } from '@/lib/simpleRateLimit';

export const dynamic = 'force-dynamic';

// POST { input } - שולח מייל בדיקה *רק לכתובת שבכרטיס העובד המחובר* (אי אפשר להקליד כתובת אחרת). לא תלוי בהסכמת דיוור; נושא עם "[בדיקה]".
export async function POST(request) {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  if (!allow(`ec-test:${gate.employee.id}`, 10, 10 * 60 * 1000)) return NextResponse.json({ error: 'יותר מדי מיילי בדיקה - נסו שוב בעוד כמה דקות' }, { status: 429 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  try {
    const r = await sendTestToEmployee({ input: body && body.input, employeeId: gate.employee.id, origin: requestOrigin(request) });
    return r.ok ? NextResponse.json({ success: true, maskedTo: r.maskedTo }) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (e) {
    console.error('email-center test send failed', e);
    return NextResponse.json({ error: 'שגיאה בשליחת הבדיקה' }, { status: 500 });
  }
}
