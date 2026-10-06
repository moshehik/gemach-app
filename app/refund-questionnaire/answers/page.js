import Link from 'next/link';
import { requireHeadManagement, loadResultsPayload } from '@/lib/policyQuestionnaire/access';
import { PolicyQuestionnaireDbError } from '@/lib/policyQuestionnaire/store';
import AnswersClient from './AnswersClient';

export const metadata = { title: 'תשובות שאלון ביטולים וזיכויים' };
export const dynamic = 'force-dynamic';

// דף התוצאות של שאלון המדיניות: כל התשובות של הגמ"ח הזה, ספירה לכל שאלה, העתקה והדפסה.
// נטען ישירות בשרת (אותו loadResultsPayload של GET /api/policy-questionnaire/answers), הרשאה: הנהלה ראשית (0) ומתכנת (2).
export default async function RefundQuestionnaireAnswersPage() {
  const who = await requireHeadManagement({ page: true });
  if (!who.ok) {
    return (
      <div className="rq-root" dir="rtl">
        <div className="rq-card rq-intro">
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{who.status === 401 ? 'צריך להתחבר' : 'אין הרשאה'}</h1>
          <p style={{ margin: '0 0 14px' }}>{who.status === 401 ? 'כדי לראות את התשובות יש להיכנס לאתר, ואז לפתוח שוב את הקישור.' : 'דף התשובות מיועד להנהלה ראשית בלבד.'}</p>
          <Link href="/" className="btn btn-primary">לדף הבית</Link>
        </div>
      </div>
    );
  }
  let payload;
  try {
    payload = await loadResultsPayload(who.employee);
  } catch (e) {
    const msg = e instanceof PolicyQuestionnaireDbError ? e.userMessage : 'אירעה שגיאה בטעינת התשובות. נסו לרענן את הדף.';
    if (!(e instanceof PolicyQuestionnaireDbError)) console.error('policy-questionnaire answers page error:', e);
    return (
      <div className="rq-root" dir="rtl">
        <div className="callout callout-danger" role="alert">{msg}</div>
      </div>
    );
  }
  return <AnswersClient questionnaire={payload.questionnaire} responses={payload.responses} />;
}
