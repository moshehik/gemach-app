import { NextResponse } from 'next/server';
import { gateEmailAdmin } from '@/lib/emailCenterAuth';
import { saveFixedFields, resetAllFixedFields } from '@/lib/emailConfig';

export const dynamic = 'force-dynamic';

// PUT    /api/admin/email-center/fixed  { values: { gmachName: 'טקסט' | null (= איפוס השדה), ... } }
// DELETE /api/admin/email-center/fixed  - איפוס כל השדות הקבועים לברירת המחדל (הגדרות האתר לא נוגעות)
export async function PUT(request) {
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  try {
    const r = await saveFixedFields(body && body.values, { employeeId: gate.employee?.id || null });
    return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (e) {
    console.error('email-center fixed save failed', e);
    return NextResponse.json({ error: 'שגיאה בשמירה' }, { status: 500 });
  }
}

export async function DELETE() {
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  try {
    await resetAllFixedFields();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('email-center fixed reset failed', e);
    return NextResponse.json({ error: 'שגיאה באיפוס' }, { status: 500 });
  }
}
