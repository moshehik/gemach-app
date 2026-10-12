import { NextResponse } from 'next/server';
import { gateEmailAdmin } from '@/lib/emailCenterAuth';
import { saveEmailTemplate, resetEmailTemplate } from '@/lib/emailConfig';
import { EMAIL_REGISTRY } from '@/lib/emailRegistry';
import { allow } from '@/lib/simpleRateLimit';

export const dynamic = 'force-dynamic';

// PUT    /api/admin/email-center/template/<emailId>  { subject?, texts?:{key:text|null}, enabled?, schedule?:{eventBefore|returnAfter|orderAfter} }
// DELETE /api/admin/email-center/template/<emailId>  - איפוס לברירת מחדל
// מזהה המייל מאומת מול הרישום (לא נכתב מפתח שרירותי ל-SystemSetting).
export async function PUT(request, { params }) {
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  const { id } = await params;
  if (!Object.prototype.hasOwnProperty.call(EMAIL_REGISTRY, id)) return NextResponse.json({ error: 'מייל לא מוכר' }, { status: 404 });
  if (!allow(`ec-save:${gate.employee?.id || 'anon'}`, 60, 60 * 1000)) return NextResponse.json({ error: 'יותר מדי שמירות - נסו שוב בעוד דקה' }, { status: 429 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  const patch = {};
  for (const k of ['subject', 'texts', 'enabled', 'schedule']) if (body && body[k] !== undefined) patch[k] = body[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'אין מה לשמור' }, { status: 400 });
  try {
    const r = await saveEmailTemplate(id, patch, { employeeId: gate.employee?.id || null });
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (e) {
    console.error('email-center save failed', e);
    return NextResponse.json({ error: 'שגיאה בשמירה' }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  const { id } = await params;
  if (!Object.prototype.hasOwnProperty.call(EMAIL_REGISTRY, id)) return NextResponse.json({ error: 'מייל לא מוכר' }, { status: 404 });
  try {
    const r = await resetEmailTemplate(id);
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (e) {
    console.error('email-center reset failed', e);
    return NextResponse.json({ error: 'שגיאה באיפוס' }, { status: 500 });
  }
}
