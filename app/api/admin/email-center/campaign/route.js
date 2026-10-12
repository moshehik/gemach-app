import { NextResponse } from 'next/server';
import { gateEmailAdmin, requestOrigin } from '@/lib/emailCenterAuth';
import { createCampaign, listCampaigns } from '@/lib/emailCampaign';
import { getIsraelDayRange } from '@/lib/hebrewDate';
import { getMailerQuota, isDryRun } from '@/lib/mailer';
import { allow } from '@/lib/simpleRateLimit';

export const dynamic = 'force-dynamic';

// GET  -> { campaigns:[סיכום], quota:{remaining|null}, dryRun }
// POST { input, filters, mode:'now'|'schedule', scheduleDate:'YYYY-MM-DD', scheduleTime:'HH:MM' } -> { id, total, status }
//   'now'      יוצר דיוור במצב sending; הלקוח ממשיך לקרוא ל-POST /campaign/<id> {action:'send'} עד שנגמר (חתיכות קטנות - מגבלת זמן של פונקציה).
//   'schedule' יוצר דיוור מתוזמן. התאריך והשעה הם שעון ישראל; ה-cron הקיים ישלח בהרצה הקרובה אחרי המועד.
// רשימת הנמענים נבנית בשרת מהפילטר ומוגבלת למאשרי דיוור. דורש עובד מחובר (הנהלה ראשית / מתכנת).
export async function GET() {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  try {
    const [campaigns, quota] = await Promise.all([listCampaigns(25), getMailerQuota()]);
    return NextResponse.json({ campaigns, quota: { remaining: quota.remaining }, dryRun: isDryRun() });
  } catch (e) {
    console.error('email-center campaigns list failed', e);
    return NextResponse.json({ error: 'שגיאה בטעינת הדיוורים' }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  if (!allow(`ec-campaign:${gate.employee.id}`, 6, 60 * 60 * 1000)) return NextResponse.json({ error: 'יותר מדי דיוורים בשעה האחרונה' }, { status: 429 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  const mode = body && body.mode === 'schedule' ? 'schedule' : 'now';
  let scheduledAt = null;
  if (mode === 'schedule') {
    const date = String(body.scheduleDate || '');
    const time = String(body.scheduleTime || '');
    const tm = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !tm) return NextResponse.json({ error: 'יש לבחור תאריך ושעה לשליחה' }, { status: 400 });
    scheduledAt = new Date(getIsraelDayRange(date).start.getTime() + (Number(tm[1]) * 60 + Number(tm[2])) * 60 * 1000);
  }
  try {
    const r = await createCampaign({
      input: body && body.input, filters: (body && body.filters) || {}, origin: requestOrigin(request),
      employeeId: gate.employee.id, mode, scheduledAt,
    });
    return r.ok ? NextResponse.json({ success: true, id: r.id, total: r.total, status: r.status, scheduler: r.scheduler || null }) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (e) {
    console.error('email-center campaign create failed', e);
    return NextResponse.json({ error: e.message && /AUTH_SECRET/.test(e.message) ? e.message : 'שגיאה ביצירת הדיוור' }, { status: 500 });
  }
}
