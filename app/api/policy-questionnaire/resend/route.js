import { NextResponse } from 'next/server';
import { requireHeadManagement, currentQuestionnaire, QUESTIONNAIRE_KEY } from '@/lib/policyQuestionnaire/access';
import { getResponse, PolicyQuestionnaireDbError } from '@/lib/policyQuestionnaire/store';
import { sendQuestionnaireEmailAndRecord, originFromRequest } from '@/lib/policyQuestionnaire/notify';
import { describeResponse, isUpdateEmail, needsEmail, isNotEnabledError, notEnabledPayload } from '@/lib/policyQuestionnaire/logic';

export const dynamic = 'force-dynamic';

// ניסיון חוזר לשלוח את המייל לבעלים על התשובות ששלחה העובדת המחוברת (כשהשליחה הקודמת נכשלה). לא משנה תשובות.
export async function POST(request) {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  const qn = currentQuestionnaire();
  try {
    const row = await getResponse(QUESTIONNAIRE_KEY, who.employee.id);
    if (!row || row.status !== 'submitted') {
      return NextResponse.json({ error: 'עוד לא נשלחו תשובות לשליחה במייל.' }, { status: 400 });
    }
    if (!needsEmail(row)) {
      return NextResponse.json({ success: true, emailSent: true, alreadySent: true, response: describeResponse(row) });
    }
    const mail = await sendQuestionnaireEmailAndRecord({ qn, response: row, origin: originFromRequest(request, qn.orgKey), updated: isUpdateEmail(row) });
    return NextResponse.json({
      success: true,
      emailSent: mail.emailSent,
      emailError: mail.emailSent ? null : (mail.emailError || 'המייל לא נשלח'),
      response: describeResponse(mail.row),
    });
  } catch (e) {
    // הטבלה עוד לא נוצרה: אין מה לשלוח ושום דבר לא נכתב - תשובה נקייה במקום 500
    if (isNotEnabledError(e)) return NextResponse.json({ ...notEnabledPayload(), emailSent: false }, { status: 503 });
    if (e instanceof PolicyQuestionnaireDbError) return NextResponse.json({ error: e.userMessage }, { status: 503 });
    console.error('policy-questionnaire resend error:', e);
    return NextResponse.json({ error: 'אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.' }, { status: 500 });
  }
}
