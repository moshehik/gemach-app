import { NOT_ENABLED_FORM_MESSAGE, NOT_ENABLED_TABLE_MESSAGE, NOT_ENABLED_OWNER_HINT } from '@/lib/policyQuestionnaire/logic';

// מצבי "עדיין לא הופעל" של שאלון המדיניות: הטבלה PolicyQuestionnaireResponse נוצרת ידנית בלבד (scripts/apply_policy_questionnaire_table.js,
// באישור הבעלים), ועד אז הדפים מציגים הודעה ידידותית במקום שגיאה. רכיבים טהורים (בלי 'use client'), נקראים מהדף של השרת ומהקליינט.

/** דף המילוי: מה שרואה ההנהלה כשהשאלון עוד לא הופעל. */
export function NotEnabledForm() {
  return (
    <div className="rq-root" dir="rtl">
      <div className="rq-card rq-intro" role="status">
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>השאלון עדיין לא הופעל</h1>
        <p style={{ margin: 0 }}>{NOT_ENABLED_FORM_MESSAGE}</p>
      </div>
    </div>
  );
}

/** דף התשובות: "הטבלה עדיין לא נוצרה"; שורת ההוראות להפעלה רק לבעלים (מתכנת, isOwner). */
export function NotEnabledResults({ isOwner }) {
  return (
    <div className="rq-root" dir="rtl">
      <div className="rq-card rq-intro" role="status">
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>{NOT_ENABLED_TABLE_MESSAGE}</h1>
        <p style={{ margin: '0 0 8px' }}>{NOT_ENABLED_FORM_MESSAGE}</p>
        {isOwner
          ? <p style={{ margin: 0 }} dir="rtl">{NOT_ENABLED_OWNER_HINT}</p>
          : <p style={{ margin: 0 }}>כשהשאלון יופעל, התשובות יופיעו כאן.</p>}
      </div>
    </div>
  );
}
