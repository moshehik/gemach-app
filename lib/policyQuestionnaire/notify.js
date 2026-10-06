// lib/policyQuestionnaire/notify.js - שליחת המייל לבעלים אחרי שהנהלה סיימה לענות (שרת בלבד).
//
// זה המייל האוטומטי היחיד על תשובות השאלון: מסלול התגובה הרגיל בשרשור דיווחי התקלות (app/api/error-report/reply/route.js) לא שולח שום מייל על
// תגובה של מי שאינו מתכנת, והשרשור נכתב ישירות מ-store.js ולא דרך המסלול הרגיל - ולכן אין כפילות. ר' docs/refund-questionnaire.md, "המייל לבעלים".
//
// הנמענים: כל העובדים הפעילים בהרשאת מתכנת (roleId=2) שיש להם כתובת מייל - אותה שליפה כמו ב-app/api/error-report/route.js.
// השליחה דרך sendSystemEmail (lib/mailer.js, נרשם ב-EmailLog). כשל במייל לעולם לא מאבד תשובות (הן כבר בשרשור): ה-API מחזיר emailSent:false,
// והדף מציע "ניסיון חוזר" (POST /api/policy-questionnaire/resend, שולח שוב את השליחה האחרונה של המשיבה המחוברת).

import prisma from '@/app/lib/prisma';
import { sendSystemEmail } from '@/lib/mailer';
import { buildQuestionnaireEmail } from '@/lib/policyQuestionnaire/email';
import { resolveSiteOrigin } from '@/lib/policyQuestionnaire/logic';

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
 * שולח את המייל על התשובות. לא זורק (מחזיר { emailSent, emailError }).
 * @param {{qn:object, response:{employeeId:string, respondentName:string, respondentRole:string, answers:object, submittedAt:string}, origin:string, updated:boolean}} p
 */
export async function sendQuestionnaireEmail({ qn, response, origin, updated }) {
  let sent = 0;
  const failures = [];
  try {
    const recipients = await loadOwnerEmails();
    if (recipients.length === 0) {
      failures.push('לא נמצאה כתובת מייל של הבעלים (עובד פעיל בהרשאת מתכנת עם מייל בכרטיס)');
    } else {
      const { subject, body, html } = buildQuestionnaireEmail({ qn, response, updated: !!updated, origin });
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
  return { emailSent, emailError: emailSent ? null : (failures.join(' | ') || 'המייל לא נשלח') };
}
