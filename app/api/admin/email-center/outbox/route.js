import { NextResponse } from 'next/server';
import { gateEmailAdmin } from '@/lib/emailCenterAuth';
import { getDryRunOutbox, clearDryRunOutbox, isDryRun } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// סביבת בדיקות בלבד: כשהשרת רץ עם EMAIL_DRY_RUN=1 אף מייל לא יוצא לרשת - הוא נרשם בזיכרון. כאן אפשר לראות מה "היה נשלח".
// בפרודקשן (EMAIL_DRY_RUN לא מוגדר) מחזיר 404.
export async function GET() {
  if (!isDryRun()) return new NextResponse('Not found', { status: 404 });
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  return NextResponse.json({ dryRun: true, items: getDryRunOutbox().slice(-50).reverse() });
}

export async function DELETE() {
  if (!isDryRun()) return new NextResponse('Not found', { status: 404 });
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  clearDryRunOutbox();
  return NextResponse.json({ success: true });
}
