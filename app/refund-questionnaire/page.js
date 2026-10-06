import { getSessionEmployee } from '@/lib/auth';
import RefundQuestionnaireClient from './RefundQuestionnaireClient';

export const metadata = { title: 'שאלון ביטולים וזיכויים' };
export const dynamic = 'force-dynamic';

// שאלון המדיניות להנהלות (ביטולים, החלפות והחזרים). כל גמ"ח רואה רק את השאלות שלו (lib/policyQuestionnaire).
// נדרשת התחברות כדי שהתשובות יישמרו על שם העונה; בלי התחברות מציגים הסבר במקום טופס שלא יישמר.
export default async function RefundQuestionnairePage() {
  const me = await getSessionEmployee();
  if (!me) {
    return (
      <div className="rq-root" dir="rtl">
        <div className="rq-card rq-intro">
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>צריך להתחבר כדי למלא את השאלון</h1>
          <p style={{ margin: '0 0 14px' }}>התשובות נשמרות על שם מי שעונה, ולכן יש להיכנס לאתר עם שם משתמש וסיסמה, ואז לפתוח שוב את הקישור של השאלון.</p>
          <a href="/" className="btn btn-primary">לדף הכניסה</a>
        </div>
      </div>
    );
  }
  return <RefundQuestionnaireClient />;
}
