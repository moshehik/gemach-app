import { NextResponse } from 'next/server';
import { requireHeadManagement, currentQuestionnaire, QUESTIONNAIRE_KEY } from '@/lib/policyQuestionnaire/access';
import { getLastSubmission, submitAnswers, PolicyQuestionnaireDbError } from '@/lib/policyQuestionnaire/store';
import { sendQuestionnaireEmail, originFromRequest } from '@/lib/policyQuestionnaire/notify';
import {
  publicQuestionnaire, sanitizeAnswers, pruneHidden, validateSubmission, normalizeRespondent, parseSubmissionText,
} from '@/lib/policyQuestionnaire/logic';

export const dynamic = 'force-dynamic';

// שאלון המדיניות (ביטולים וזיכויים) להנהלות - ר' docs/refund-questionnaire.md.
//   GET  - השאלון של הגמ"ח הזה + השליחה האחרונה של העובדת המחוברת (נקראת מהשרשור, ר' store.js), כדי שאפשר יהיה לעדכן אותה.
//   POST - שליחה סופית: בדיקת תקינות לכל שאלה גלויה, תגובה חדשה בשרשור דיווח-התקלה של השאלון ומייל אחד לבעלים. כשל במייל לא מאבד תשובות
//          (הן כבר בשרשור): מחזירים success עם emailSent:false, והדף מציע ניסיון חוזר ב-POST /api/policy-questionnaire/resend.
// אין שמירה אוטומטית בשרת: הטיוטה נשמרת רק בדפדפן (localStorage) עד השליחה.
// הזהות (employeeId) נלקחת תמיד מהעוגייה המאומתת בשרת, אף פעם לא מגוף הבקשה. אין שום טבלה חדשה ושום DDL.

const MAX_BODY_CHARS = 200000;

function dbFail(e) {
  if (e instanceof PolicyQuestionnaireDbError) {
    return NextResponse.json({ error: e.userMessage, code: e.kind === 'transient' ? 'db_unreachable' : 'db_error' }, { status: 503 });
  }
  console.error('policy-questionnaire route error:', e);
  return NextResponse.json({ error: 'אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.', code: 'error' }, { status: 500 });
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return { error: 'הבקשה גדולה מדי' };
  try {
    const body = JSON.parse(text || '{}');
    return body && typeof body === 'object' ? { body } : { error: 'בקשה לא תקינה' };
  } catch {
    return { error: 'בקשה לא תקינה' };
  }
}

export async function GET() {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  const qn = currentQuestionnaire();
  try {
    const last = await getLastSubmission(QUESTIONNAIRE_KEY, who.employee.id);
    const parsed = last ? parseSubmissionText(qn, last.text) : null;
    return NextResponse.json({
      questionnaire: publicQuestionnaire(qn),
      questionnaireKey: QUESTIONNAIRE_KEY,
      me: { id: who.employee.id }, // רק כדי לבנות מפתח לטיוטה בדפדפן; השרת לעולם לא סומך על מזהה שמגיע מהלקוח
      respondent: {
        name: (parsed && parsed.respondentName) || who.employee.name,
        role: (parsed && parsed.respondentRole) || who.employee.roleLabel,
      },
      answers: parsed ? parsed.answers : {},
      submission: last
        ? { submittedAt: last.createdAt, count: last.count, updated: !!(parsed && parsed.updated), partial: !!(parsed && parsed.unparsed.length) }
        : null,
    });
  } catch (e) {
    return dbFail(e);
  }
}

export async function POST(request) {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  const parsed = await readBody(request);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!parsed.body.answers || typeof parsed.body.answers !== 'object') {
    return NextResponse.json({ error: 'חסרות תשובות. נא לענות על כל השאלות לפני השליחה.' }, { status: 400 });
  }
  const qn = currentQuestionnaire();
  try {
    const answers = pruneHidden(qn, sanitizeAnswers(qn, parsed.body.answers));
    const given = normalizeRespondent({ name: parsed.body.name, role: parsed.body.role });
    const respondent = { name: given.name || who.employee.name, role: given.role || who.employee.roleLabel };
    const check = validateSubmission(qn, answers, respondent);
    if (!check.ok) {
      return NextResponse.json({
        error: check.nameMissing && check.errors.length === 0 ? 'נא למלא שם.' : 'חסרות תשובות. נא לענות על כל השאלות לפני השליחה.',
        errors: check.errors,
        nameMissing: check.nameMissing,
      }, { status: 400 });
    }
    const saved = await submitAnswers({ qn, questionnaireKey: QUESTIONNAIRE_KEY, employeeId: who.employee.id, respondent, answers });
    const mail = await sendQuestionnaireEmail({
      qn,
      response: { employeeId: who.employee.id, respondentName: respondent.name, respondentRole: respondent.role, answers, submittedAt: saved.submittedAt },
      origin: originFromRequest(request, qn.orgKey),
      updated: saved.updated,
    });
    return NextResponse.json({
      success: true,
      emailSent: mail.emailSent,
      emailError: mail.emailSent ? null : mail.emailError,
      answers,
      respondent,
      submittedAt: saved.submittedAt,
      updated: saved.updated,
    });
  } catch (e) {
    return dbFail(e);
  }
}
