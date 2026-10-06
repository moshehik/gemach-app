// lib/policyQuestionnaire/notify.js - שליחת המייל לבעלים אחרי שהנהלה סיימה לענות (שרת בלבד).
//
// הנמענים: כל העובדים הפעילים בהרשאת מתכנת (roleId=2) שיש להם כתובת מייל - אותה שליפה כמו ב-app/api/error-report/route.js.
// השליחה דרך sendSystemEmail (lib/mailer.js, נרשם ב-EmailLog). כשל במייל לעולם לא מאבד תשובות: התוצאה נרשמת על השורה
// (emailedAt / emailError) וה-API מחזיר emailSent:false, כך שהדף מציע "ניסיון חוזר" (POST /api/policy-questionnaire/resend).

import prisma from '@/app/lib/prisma';
import { sendSystemEmail } from '@/lib/mailer';
import { buildQuestionnaireEmail } from '@/lib/policyQuestionnaire/email';
import { isUpdateEmail, resolveSiteOrigin } from '@/lib/policyQuestionnaire/logic';
import { recordEmailResult } from '@/lib/policyQuestionnaire/store';

/** כתובות המייל של הבעלים (מתכנתים פעילים עם מייל), בלי כפילויות. */
export async function loadOwnerEmails() {
  const rows = await prisma.employee.findMany({
    where: { roleId: 2, isActive: true, email: { not: null } },
    select: { email: true },
  });
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const e = String(r.email || '').trim();
    if (!e || !e.includes('@') || seen.has(e.toLowerCase())) continue;
    seen.add(e.toLowerCase());
    out.push(e);
  }
  return out;
}

/** origin לקישורים במייל, מכותרות הבקשה (ר' resolveSiteOrigin). */
export function originFromRequest(request, orgKey) {
  const h = (name) => request.headers.get(name) || '';
  return resolveSiteOrigin({
    forwardedHost: h('x-forwarded-host'),
    forwardedProto: h('x-forwarded-proto'),
    host: h('host'),
    envProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    orgKey,
  });
}

/**
 * שולח את המייל על התשובות ורושם את התוצאה בשורה. לא זורק (מחזיר { emailSent, emailError, row }).
 * @param {{qn:object, response:object, origin:string, updated?:boolean}} p  response = שורה מ-store (עם emailedAt/submittedAt)
 */
export async function sendQuestionnaireEmailAndRecord({ qn, response, origin, updated }) {
  const isUpdate = typeof updated === 'boolean' ? updated : isUpdateEmail(response);
  let sent = 0;
  const failures = [];
  try {
    const recipients = await loadOwnerEmails();
    if (recipients.length === 0) {
      failures.push('לא נמצאה כתובת מייל של הבעלים (עובד פעיל בהרשאת מתכנת עם מייל בכרטיס)');
    } else {
      const { subject, body, html } = buildQuestionnaireEmail({ qn, response, updated: isUpdate, origin });
      for (const to of recipients) {
        try {
          const r = await sendSystemEmail({ to, subject, body, html, employeeId: response.employeeId });
          if (r && r.success) sent += 1;
          else failures.push((r && r.message) || 'שליחה נכשלה');
        } catch (e) {
          failures.push(e?.message || 'שליחה נכשלה');
        }
      }
    }
  } catch (e) {
    console.error('policyQuestionnaire email failed:', e);
    failures.push(e?.message || 'שגיאה בהכנת המייל');
  }
  const emailSent = sent > 0;
  const emailError = failures.length ? failures.join(' | ') : null;
  let row = response;
  try {
    row = (await recordEmailResult(response.id, { sent: emailSent, error: emailError })) || response;
  } catch (e) {
    console.error('policyQuestionnaire: could not record email result:', e);
  }
  return { emailSent, emailError, row };
}
