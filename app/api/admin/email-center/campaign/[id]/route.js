import { NextResponse } from 'next/server';
import { gateEmailAdmin } from '@/lib/emailCenterAuth';
import { loadCampaign, summarize, sendCampaignChunk, cancelCampaign } from '@/lib/emailCampaign';
import { allow } from '@/lib/simpleRateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET            -> סיכום ההתקדמות
// POST {action:'send'}   -> שולח חתיכה (עד 5 נמענים), מחזיר { sent, failed, skipped, remaining, done, quota }; הלקוח חוזר עד done
// POST {action:'cancel'} -> מבטל את מה שטרם נשלח
export async function GET(_request, { params }) {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  const { id } = await params;
  const doc = await loadCampaign(id);
  if (!doc) return NextResponse.json({ error: 'דיוור לא נמצא' }, { status: 404 });
  return NextResponse.json({ campaign: { ...summarize(doc), failures: (doc.progress?.failed || []).slice(0, 20).map((f) => f.error) } });
}

export async function POST(request, { params }) {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  try {
    if (body && body.action === 'cancel') {
      const r = await cancelCampaign(id);
      return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.error }, { status: 400 });
    }
    if (!body || body.action !== 'send') return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 });
    if (!allow(`ec-send:${gate.employee.id}`, 200, 60 * 1000)) return NextResponse.json({ error: 'יותר מדי בקשות שליחה' }, { status: 429 });
    const r = await sendCampaignChunk(id, { limit: 5, deadlineMs: Date.now() + 45000 });
    return NextResponse.json(r, { status: r.ok === false && !r.sent ? 400 : 200 });
  } catch (e) {
    console.error('email-center campaign action failed', e);
    return NextResponse.json({ error: 'שגיאה בשליחה' }, { status: 500 });
  }
}
