import { NextResponse } from 'next/server';
import { requireHeadManagement, loadResultsPayload } from '@/lib/policyQuestionnaire/access';
import { PolicyQuestionnaireDbError } from '@/lib/policyQuestionnaire/store';

export const dynamic = 'force-dynamic';

// כל התשובות של שאלון המדיניות בגמ"ח הזה (נקראות מהשרשור) - להנהלה ראשית (0) ולמתכנת (2) בלבד. "מקור" פנימי של כל שאלה רק למתכנת.
export async function GET() {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  try {
    return NextResponse.json(await loadResultsPayload(who.employee));
  } catch (e) {
    if (e instanceof PolicyQuestionnaireDbError) return NextResponse.json({ error: e.userMessage }, { status: 503 });
    console.error('policy-questionnaire answers error:', e);
    return NextResponse.json({ error: 'אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.' }, { status: 500 });
  }
}
