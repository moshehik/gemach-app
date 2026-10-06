import { NextResponse } from 'next/server';
import { requireHeadManagement, currentQuestionnaire, QUESTIONNAIRE_KEY } from '@/lib/policyQuestionnaire/access';
import { getResponse, saveDraft, submitResponse, PolicyQuestionnaireDbError } from '@/lib/policyQuestionnaire/store';
import { sendQuestionnaireEmailAndRecord, originFromRequest } from '@/lib/policyQuestionnaire/notify';
import {
  publicQuestionnaire, sanitizeAnswers, mergeAnswers, pruneHidden, validateSubmission, normalizeRespondent, describeResponse,
  isNotEnabledError, notEnabledPayload,
} from '@/lib/policyQuestionnaire/logic';

export const dynamic = 'force-dynamic';

// שאלון המדיניות (ביטולים וזיכויים) להנהלות - ר' docs/refund-questionnaire.md.
//   GET  - השאלון של הגמ"ח הזה + התשובות השמורות של העובדת המחוברת.
//   PUT  - שמירה אוטומטית של טיוטה (נקראת מהדפדפן בהשהיה קצרה אחרי כל שינוי).
//   POST - שליחה סופית: בדיקת תקינות לכל שאלה גלויה, שמירה כ-submitted ושליחת מייל לבעלים. כשל במייל לא מאבד תשובות:
//          מחזירים success עם emailSent:false (והדף מציע ניסיון חוזר ב-POST /api/policy-questionnaire/resend).
// הזהות (employeeId) נלקחת תמיד מהעוגייה המאומתת בשרת, אף פעם לא מגוף הבקשה.
// הטבלה PolicyQuestionnaireResponse נוצרת ידנית בלבד (prisma/migrations-pending, scripts/apply_policy_questionnaire_table.js). כל עוד היא לא קיימת:
//   GET מחזיר 200 עם { ok:false, code:'not_enabled', error } (הדף מציג "השאלון עדיין לא הופעל"); PUT/POST מחזירים 503 עם אותו גוף ו-saved:false.
//   שום דבר לא נשמר, שום מייל לא נשלח ושום נתון לא מומצא; אין ניסיון ליצור את הטבלה.

const MAX_BODY_CHARS = 200000;

function dbFail(e, { read = false } = {}) {
  if (isNotEnabledError(e)) {
    return NextResponse.json(read ? notEnabledPayload() : { ...notEnabledPayload(), saved: false }, { status: read ? 200 : 503 });
  }
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
    const row = await getResponse(QUESTIONNAIRE_KEY, who.employee.id);
    return NextResponse.json({
      questionnaire: publicQuestionnaire(qn),
      respondent: {
        name: (row && row.respondentName) || who.employee.name,
        role: (row && row.respondentRole) || who.employee.roleLabel,
      },
      answers: row ? row.answers : {},
      response: describeResponse(row),
    });
  } catch (e) {
    return dbFail(e, { read: true });
  }
}

export async function PUT(request) {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  const parsed = await readBody(request);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const qn = currentQuestionnaire();
  try {
    const existing = await getResponse(QUESTIONNAIRE_KEY, who.employee.id);
    const answers = mergeAnswers(qn, existing ? existing.answers : {}, parsed.body.answers);
    const respondent = normalizeRespondent({ name: parsed.body.name, role: parsed.body.role });
    const row = await saveDraft({
      questionnaireKey: QUESTIONNAIRE_KEY,
      orgKey: qn.orgKey,
      employeeId: who.employee.id,
      name: respondent.name || (existing && existing.respondentName) || who.employee.name,
      role: respondent.role || (existing && existing.respondentRole) || who.employee.roleLabel,
      answers,
    });
    return NextResponse.json({ saved: true, response: describeResponse(row) });
  } catch (e) {
    return dbFail(e);
  }
}

export async function POST(request) {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  const parsed = await readBody(request);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const qn = currentQuestionnaire();
  try {
    const existing = await getResponse(QUESTIONNAIRE_KEY, who.employee.id);
    // בשליחה סופית הדפדפן שולח את כל התשובות והן הקובעות; בלי answers בבקשה - משתמשים במה ששמור.
    const base = parsed.body.answers && typeof parsed.body.answers === 'object'
      ? sanitizeAnswers(qn, parsed.body.answers)
      : (existing ? existing.answers : {});
    const answers = pruneHidden(qn, base);
    const given = normalizeRespondent({ name: parsed.body.name, role: parsed.body.role });
    const respondent = {
      name: given.name || (existing && existing.respondentName) || who.employee.name,
      role: given.role || (existing && existing.respondentRole) || who.employee.roleLabel,
    };
    const check = validateSubmission(qn, answers, respondent);
    if (!check.ok) {
      return NextResponse.json({
        error: check.nameMissing && check.errors.length === 0 ? 'נא למלא שם.' : 'חסרות תשובות. נא לענות על כל השאלות לפני השליחה.',
        errors: check.errors,
        nameMissing: check.nameMissing,
      }, { status: 400 });
    }
    const updated = !!(existing && existing.emailedAt);
    const row = await submitResponse({
      questionnaireKey: QUESTIONNAIRE_KEY,
      orgKey: qn.orgKey,
      employeeId: who.employee.id,
      name: respondent.name,
      role: respondent.role,
      answers,
    });
    const mail = await sendQuestionnaireEmailAndRecord({ qn, response: row, origin: originFromRequest(request, qn.orgKey), updated });
    return NextResponse.json({
      success: true,
      emailSent: mail.emailSent,
      emailError: mail.emailSent ? null : (mail.emailError || 'המייל לא נשלח'),
      answers: mail.row.answers,
      response: describeResponse(mail.row),
    });
  } catch (e) {
    return dbFail(e);
  }
}
