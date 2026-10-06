import { NextResponse } from 'next/server';
import { requireHeadManagement, loadResultsPayload } from '@/lib/policyQuestionnaire/access';
import { PolicyQuestionnaireDbError } from '@/lib/policyQuestionnaire/store';
import { isNotEnabledError, notEnabledPayload, NOT_ENABLED_TABLE_MESSAGE, NOT_ENABLED_OWNER_HINT } from '@/lib/policyQuestionnaire/logic';

export const dynamic = 'force-dynamic';

// כל התשובות של שאלון המדיניות בגמ"ח הזה - להנהלה ראשית (0) ולמתכנת (2) בלבד. "מקור" פנימי של כל שאלה רק למתכנת.
export async function GET() {
  const who = await requireHeadManagement();
  if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
  try {
    return NextResponse.json(await loadResultsPayload(who.employee));
  } catch (e) {
    // הטבלה עוד לא נוצרה: 200 עם { ok:false, code:'not_enabled' } (ולא 500); רק הבעלים (מתכנת) מקבל את שורת ההוראות להפעלה
    if (isNotEnabledError(e)) return NextResponse.json({ ...notEnabledPayload(), tableMessage: NOT_ENABLED_TABLE_MESSAGE, ownerHint: who.employee.roleId === 2 ? NOT_ENABLED_OWNER_HINT : null });
    if (e instanceof PolicyQuestionnaireDbError) return NextResponse.json({ error: e.userMessage }, { status: 503 });
    console.error('policy-questionnaire answers error:', e);
    return NextResponse.json({ error: 'אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.' }, { status: 500 });
  }
}
