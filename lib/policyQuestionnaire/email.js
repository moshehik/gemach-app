// lib/policyQuestionnaire/email.js - בניית המייל "שאלון מדיניות הוגש" (טהור: בלי DB, בלי שליחה).
// הנושא מגיע מהקטלוג (emailSubject), ה-HTML מ-renderPolicyQuestionnaireEmailHtml (lib/emailTemplates.js, כיוון RTL מוטמע),
// והגרסה הטקסטואלית (body) היא אותו טקסט בדיוק (renderSubmissionText ב-logic.js) שנשמר כתגובה בשרשור. השליחה עצמה ב-notify.js.
// ייבוא יחסי עם סיומת .js בכוונה - כדי שאפשר להריץ את הקובץ הזה גם ב-node רגיל (scripts/test_policy_questionnaire.mjs).

import { renderPolicyQuestionnaireEmailHtml } from '../emailTemplates.js';
import { emailSubject } from '../emailCatalog.js';
import { summarize, computeProgress, renderSubmissionText, THREAD_TITLE, formatIsraelDateTime, resultsUrl as buildResultsUrl, answerUrl as buildAnswerUrl } from './logic.js';

/**
 * @param {{qn:object, response:{respondentName:string,respondentRole:string,answers:object,submittedAt:string|null}, updated:boolean, origin:string}} p
 * @returns {{subject:string, body:string, html:string, resultsUrl:string, answerUrl:string}}
 */
export function buildQuestionnaireEmail({ qn, response, updated = false, origin }) {
  const answers = response.answers || {};
  const resultsUrl = buildResultsUrl(origin);
  const answerUrl = buildAnswerUrl(origin);
  const progress = computeProgress(qn, answers);
  const subject = emailSubject('policyQuestionnaireSubmitted', { gmachName: qn.gmachName, respondentName: response.respondentName, updated });
  const plain = renderSubmissionText(qn, answers, {
    gmachName: qn.gmachName,
    respondentName: response.respondentName,
    respondentRole: response.respondentRole,
    submittedAt: response.submittedAt,
    updated,
  });
  const body = `${plain}\n\nקישור מלא לכל התשובות באתר: ${resultsUrl}\nקישור לשאלון עצמו: ${answerUrl}\nהתשובות נשמרו גם בשרשור "${THREAD_TITLE}" בחלון דיווחי התקלות.`;
  const html = renderPolicyQuestionnaireEmailHtml({
    gmachName: `גמ"ח ${qn.gmachName}`,
    questionnaireGmachName: qn.gmachName,
    respondentName: response.respondentName,
    respondentRole: response.respondentRole,
    submittedAtText: formatIsraelDateTime(response.submittedAt),
    updated,
    answeredCount: progress.answered,
    totalCount: progress.total,
    sections: summarize(qn, answers),
    resultsUrl,
    answerUrl,
  });
  return { subject, body, html, resultsUrl, answerUrl };
}
