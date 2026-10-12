import { NextResponse } from 'next/server';
import { gateEmailAdmin } from '@/lib/emailCenterAuth';
import { resolveRecipients, listConsentCities, countConsentCustomers, searchConsentCustomers, MAX_RECIPIENTS_PER_CAMPAIGN } from '@/lib/emailCampaign';
import { allow } from '@/lib/simpleRateLimit';

export const dynamic = 'force-dynamic';

// GET  ?meta=1        -> { cities:[{city,count}], consentTotal }       (נתוני הבורר)
// GET  ?q=<שם/טלפון>   -> { results:[{id,name,city,maskedEmail}] }       (חיפוש לבחירה ידנית; רק מאשרות דיוור)
// POST { filters }    -> { recipients:[{id,name,city,maskedEmail}], total, truncated }
// בכל התשובות: כתובות מייל מסוכות בלבד. רק לקוחות עם marketingConsent=true. דורש עובד מחובר (הנהלה ראשית / מתכנת).
export async function GET(request) {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  if (!allow(`ec-rcpt:${gate.employee.id}`, 120, 60 * 1000)) return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 });
  const sp = new URL(request.url).searchParams;
  try {
    if (sp.get('meta')) {
      const [cities, consentTotal] = await Promise.all([listConsentCities(), countConsentCustomers()]);
      return NextResponse.json({ cities, consentTotal, max: MAX_RECIPIENTS_PER_CAMPAIGN });
    }
    return NextResponse.json({ results: await searchConsentCustomers(sp.get('q')) });
  } catch (e) {
    console.error('email-center recipients failed', e);
    return NextResponse.json({ error: 'שגיאה בטעינת הנמענים' }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await gateEmailAdmin({ needSession: true });
  if (gate.error) return gate.error;
  if (!allow(`ec-rcpt:${gate.employee.id}`, 120, 60 * 1000)) return NextResponse.json({ error: 'יותר מדי בקשות' }, { status: 429 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 }); }
  try {
    const r = await resolveRecipients((body && body.filters) || {});
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ recipients: r.recipients, total: r.total, truncated: r.truncated, max: MAX_RECIPIENTS_PER_CAMPAIGN });
  } catch (e) {
    console.error('email-center resolve recipients failed', e);
    return NextResponse.json({ error: 'שגיאה בבניית רשימת הנמענים' }, { status: 500 });
  }
}
