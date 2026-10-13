import { NextResponse } from 'next/server';
import { gateEmailAdmin, requestOrigin } from '@/lib/emailCenterAuth';
import { buildDraftCfg } from '@/lib/emailConfig';
import { EMAIL_REGISTRY } from '@/lib/emailRegistry';
import { buildSampleEmail } from '@/lib/emailSamples';

export const dynamic = 'force-dynamic';

// POST /api/admin/email-center/preview { id, draft?:{subject,texts,fixed}, daysBefore? } -> { subject, html }
// תצוגה מקדימה חיה של טיוטה עם נתוני דמה. לא שולחת כלום, לא שומרת כלום, ולא נוגעת בהזמנות/לקוחות אמיתיים.
export async function POST(request) {
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  const id = body && body.id;
  if (!id || !Object.prototype.hasOwnProperty.call(EMAIL_REGISTRY, id)) return NextResponse.json({ error: 'מייל לא מוכר' }, { status: 404 });
  try {
    const draft = await buildDraftCfg(id, (body && body.draft) || {}, { origin: requestOrigin(request) });
    if (!draft.ok) return NextResponse.json({ error: draft.error, key: draft.key || null }, { status: 400 });
    const days = Number(body && body.daysBefore);
    const sample = buildSampleEmail(id, { cfg: draft.cfg, withDelivery: !!(body && body.withDelivery), ...(Number.isInteger(days) && days >= 0 && days <= 30 ? { daysBefore: days } : {}) });
    return NextResponse.json({ subject: sample.subject.replace(/^\[דוגמה\] /, ''), html: sample.html });
  } catch (e) {
    console.error('email-center preview failed', e);
    return NextResponse.json({ error: 'שגיאה בהפקת התצוגה' }, { status: 500 });
  }
}
