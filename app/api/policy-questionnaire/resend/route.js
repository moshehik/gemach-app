import { NextResponse } from 'next/server';
import { requireHeadManagement, currentQuestionnaire, QUESTIONNAIRE_KEY } from '@/lib/policyQuestionnaire/access';
import { getLastSubmission, PolicyQuestionnaireDbError } from '@/lib/policyQuestionnaire/store';
import { sendQuestionnaireEmail, originFromRequest } from '@/lib/policyQuestionnaire/notify';
import { parseSubmissionText } from '@/lib/policyQuestionnaire/logic';

export const dynamic = 'force-dynamic';

// ניסיון חוזר לשלוח את המייל לבעלים על השליחה האחרונה של העובדת המחוברת (כשהשליחה הקודמת נכשלה במייל). לא כותב שום דבר בשרשור ולא משנה תשובות.
// הדף מציג את הכפתור רק מיד אחרי שליחה שהמייל שלה נכשל, כך שאין שליחה כפולה בשימוש רגיל.
export async function POST(request) {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  const qn = currentQuestionnaire();
  try {
    const last = await getLastSubmission(QUESTIONNAIRE_KEY, who.employee.id);
    const parsed = last ? parseSubmissionText(qn, last.text) : null;
    if (!last || !parsed) {
      return NextResponse.json({ error: 'עוד לא נשלחו תשובות לשליחה במייל.' }, { status: 400 });
    }
    const mail = await sendQuestionnaireEmail({
      qn,
      response: {
        employeeId: who.employee.id,
        respondentName: parsed.respondentName || who.employee.name,
        respondentRole: parsed.respondentRole || who.employee.roleLabel,
        answers: parsed.answers,
        submittedAt: last.createdAt,
      },
      origin: originFromRequest(request, qn.orgKey),
      updated: last.count > 1,
    });
    return NextResponse.json({ success: true, emailSent: mail.emailSent, emailError: mail.emailSent ? null : mail.emailError });
  } catch (e) {
    if (e instanceof PolicyQuestionnaireDbError) return NextResponse.json({ error: e.userMessage }, { status: 503 });
    console.error('policy-questionnaire resend error:', e);
    return NextResponse.json({ error: 'אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.' }, { status: 500 });
  }
}
