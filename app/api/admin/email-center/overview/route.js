import { NextResponse } from 'next/server';
import { gateEmailAdmin } from '@/lib/emailCenterAuth';
import { loadAdminOverview } from '@/lib/emailConfig';
import { listEmailCatalog, EMAIL_CATEGORIES } from '@/lib/emailCatalog';
import { EXTRA_EMAILS, FIXED_FIELDS, SCHEDULE_MODE_LABELS } from '@/lib/emailRegistry';
import { CAMPAIGN_VARS } from '@/lib/emailCampaign';
import { isDryRun } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// GET /api/admin/email-center/overview - כל המיילים (מהקטלוג) + מה נערך + השדות הקבועים. אין כאן נמענים/כתובות לקוחות.
export async function GET() {
  const gate = await gateEmailAdmin();
  if (gate.error) return gate.error;
  try {
    const overview = await loadAdminOverview();
    const catalog = listEmailCatalog().map((e) => ({
      id: e.id, name: e.name, category: e.category, categoryLabel: e.categoryLabel, trigger: e.trigger, recipients: e.recipients,
      attachments: e.attachments, gate: e.gate, source: e.source, subjectExample: e.subjectExample,
    }));
    return NextResponse.json({
      dryRun: isDryRun(),
      categories: EMAIL_CATEGORIES,
      catalog,
      emails: overview.emails,
      fixed: overview.fixed,
      fixedFields: FIXED_FIELDS.map((f) => ({ key: f.key, label: f.label })),
      extra: EXTRA_EMAILS,
      scheduleLabels: SCHEDULE_MODE_LABELS,
      campaignVars: CAMPAIGN_VARS,
      cronSlotsNote: 'ריצות ה-cron של המערכת: ~08:30 (דוחות, תזכורות, אישורי הזמנה מתוזמנים), ~17:30 ו-~00:30 (עדכון ענפי תיקון) שעון ישראל - דיוורים מתוזמנים יוצאים בהרצה הקרובה אחרי המועד שנבחר.',
    });
  } catch (e) {
    console.error('email-center overview failed', e);
    return NextResponse.json({ error: 'שגיאה בטעינת מרכז המיילים' }, { status: 500 });
  }
}
