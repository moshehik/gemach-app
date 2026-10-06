import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';
import './refund-questionnaire.css';

// שער לשאלון המדיניות (/refund-questionnaire ו-/refund-questionnaire/answers): הנהלה ראשית (0) ומתכנת (2) בלבד,
// כמו app/admin/layout.js. ה-API מאכוף את אותו שער בנפרד (lib/policyQuestionnaire/access.js) - השער כאן הוא רק לתצוגה.
export default async function RefundQuestionnaireLayout({ children }) {
  if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
    return <NoAccessMessage />;
  }
  return children;
}
