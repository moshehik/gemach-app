// lib/policyQuestionnaire/store.js - שמירת התשובות וקריאתן (שרת בלבד).
//
// אין טבלה משלו ואין שום DDL: התשובות נשמרות בשרשור דיווח-תקלה אחד לכל גמ"ח (ErrorReport + ErrorReportReply הרגילים), החלטת הבעלים 2026-10-06.
//   * שרשור: ErrorReport שמזוהה לפי queryParams = threadMarker(QUESTIONNAIRE_KEY) (וכותרת קבועה THREAD_TITLE, כמו "יומן הסוכן" ב-scripts/agent-log-report.js).
//     נוצר בשליחה הראשונה בגמ"ח (find-or-create), על שם העובדת ששלחה ראשונה; url '/refund-questionnaire'; status OPEN.
//   * שליחה = תגובה אחת (ErrorReportReply) עם employeeId של השולחת, isProgrammer=false, ובטקסט פשוט וקריא (renderSubmissionText ב-logic.js).
//     שליחה חוזרת = תגובה חדשה שמסומנת "עדכון"; תגובות ישנות אף פעם לא נערכות.
//   * אותם שדות ואותה התנהגות כמו app/api/error-report/reply/route.js (isReadByProgrammer=false, updatedAt) - אבל בלי המסלול הזה ובלי הדיווח הרגיל:
//     אין מייל "דיווח תקלה חדש", אין repository_dispatch לבוט התיקונים, אין צרופות. המייל היחיד הוא של השאלון עצמו (notify.js).
//   * needsHuman=true בכוונה: בוט התיקונים (/fix-reports, כל 5 דקות) דולג לגמרי על שרשור כזה ו-scripts/error-report-reply.js מסרב לכתוב בו -
//     אחרת הבוט היה עונה "ראיתי את הדיווח, בודק ומטפל" בשרשור הזה. הדגל מתאפס כשמתכנת עונה בחלון, ולכן נקבע מחדש בכל שליחה.
//
// כתיבות דרך הלקוח המשותף (@/app/lib/prisma) בלבד - התוסף שלו רושם ל-AuditLog בעצמו, אין כאן שורות AuditLog ידניות.
// אין $transaction וקריאות כבדות: רק שליפות קצרות, וכל כתיבה היא פעולה בודדת.
//
// עמידות: קריאה שנכשלת בגלל התעוררות של Neon (P1001/P2024/timeout) מנוסה פעם נוספת אחרי 1.5 שניות. כתיבות לא מנוסות שוב אוטומטית (כדי לא ליצור
// תגובה כפולה); השליפה הראשונה של find-or-create כבר "מעירה" את המסד. שגיאה סופית נזרקת כ-PolicyQuestionnaireDbError עם .kind ('transient' | 'other')
// ו-.userMessage בעברית.

import prisma from '@/app/lib/prisma';
import {
  THREAD_TITLE, THREAD_URL, SUBMISSION_HEADER, threadMarker, buildThreadIntro, renderSubmissionText, formatIsraelDateTime, classifyDbError,
} from '@/lib/policyQuestionnaire/logic';

export class PolicyQuestionnaireDbError extends Error {
  constructor(kind, cause) {
    super(`policy questionnaire DB error (${kind})`);
    this.name = 'PolicyQuestionnaireDbError';
    this.kind = kind;
    this.cause = cause;
    this.userMessage = kind === 'transient'
      ? 'אין כרגע חיבור למסד הנתונים (ייתכן שהוא רק מתעורר). נסו שוב בעוד רגע - התשובות שכבר נשלחו לא אבדו.'
      : 'אירעה שגיאה בשמירה או בטעינה של השאלון. נסו שוב בעוד רגע, ואם זה חוזר - פנו למתכנת.';
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** קריאה: תקלת חיבור (התעוררות Neon) מנוסה פעם נוספת אחרי 1.5 שניות. שגיאה סופית = PolicyQuestionnaireDbError. */
async function readDb(fn) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const kind = classifyDbError(e);
      console.warn(`policyQuestionnaire store: ${kind} (attempt ${attempt + 1}):`, e?.message || e);
      if (kind === 'transient') { await sleep(1500); continue; }
      break;
    }
  }
  throw new PolicyQuestionnaireDbError(classifyDbError(lastErr), lastErr);
}

/** כתיבה: בלי ניסיון חוזר; שגיאה נעטפת ב-PolicyQuestionnaireDbError. */
async function writeDb(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error('policyQuestionnaire store write failed:', e?.message || e);
    throw new PolicyQuestionnaireDbError(classifyDbError(e), e);
  }
}

const REPLY_SELECT = {
  id: true,
  employeeId: true,
  text: true,
  createdAt: true,
  employee: { select: { firstName: true, lastName: true, fullName: true } },
};

function employeeLabel(emp) {
  if (!emp) return '';
  const full = (emp.fullName || '').trim();
  return full || [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
}

function mapReply(r) {
  return {
    id: r.id,
    employeeId: r.employeeId || null,
    employeeName: employeeLabel(r.employee),
    createdAt: new Date(r.createdAt).toISOString(),
    text: r.text,
  };
}

/** השרשור של הסבב בגמ"ח הזה (הוותיק ביותר אם בטעות נוצרו כמה), או null. */
async function findThread(questionnaireKey) {
  return prisma.errorReport.findFirst({
    where: { queryParams: threadMarker(questionnaireKey) },
    orderBy: { createdAt: 'asc' },
    select: { id: true, employeeId: true, status: true },
  });
}

/**
 * find-or-create של השרשור. יוצר רק כשאין (על שם העובדת ששולחת ראשונה); שליחה שנייה משתמשת באותו שרשור.
 * שתי שליחות ראשונות באותה שנייה עלולות ליצור שני שרשורים - אחרי היצירה קוראים שוב ובוחרים את הוותיק, כך שכל התשובות נוחתות באותו מקום.
 */
export async function ensureThread({ qn, questionnaireKey, employeeId }) {
  const existing = await readDb(() => findThread(questionnaireKey));
  if (existing) return existing;
  const now = new Date();
  await writeDb(() => prisma.errorReport.create({
    data: {
      employeeId,
      time: formatIsraelDateTime(now),
      url: THREAD_URL,
      title: THREAD_TITLE,
      queryParams: threadMarker(questionnaireKey),
      userText: buildThreadIntro(qn),
      status: 'OPEN',
      isReadByUser: true,
      isReadByProgrammer: false,
      needsHuman: true,
    },
  }));
  const created = await readDb(() => findThread(questionnaireKey));
  if (!created) throw new PolicyQuestionnaireDbError('other', new Error('thread missing right after create'));
  return created;
}

/** השליחה האחרונה של עובדת (תגובה בשרשור), או null. count = כמה שליחות יש לה בסך הכול. */
export async function getLastSubmission(questionnaireKey, employeeId) {
  return readDb(async () => {
    const thread = await findThread(questionnaireKey);
    if (!thread) return null;
    const where = { errorReportId: thread.id, employeeId, text: { startsWith: SUBMISSION_HEADER } };
    const [row, count] = await Promise.all([
      prisma.errorReportReply.findFirst({ where, orderBy: { createdAt: 'desc' }, select: REPLY_SELECT }),
      prisma.errorReportReply.count({ where }),
    ]);
    return row ? { ...mapReply(row), count } : null;
  });
}

/** כל התגובות-תשובות בשרשור (מהישנה לחדשה), לדף התוצאות. { threadId, replies } ; threadId=null כשעוד לא נשלחה אף תשובה. */
export async function listSubmissions(questionnaireKey) {
  return readDb(async () => {
    const thread = await findThread(questionnaireKey);
    if (!thread) return { threadId: null, replies: [] };
    const rows = await prisma.errorReportReply.findMany({
      where: { errorReportId: thread.id, text: { startsWith: SUBMISSION_HEADER } },
      orderBy: { createdAt: 'asc' },
      select: REPLY_SELECT,
    });
    return { threadId: thread.id, replies: rows.map(mapReply) };
  });
}

/**
 * שליחה סופית: תגובה חדשה בשרשור (יוצר אותו אם חסר) ועדכון השרשור כמו המסלול הרגיל של תגובה (נקרא ע"י המתכנת, פתוח, ללא "טופל").
 * שליחה חוזרת של אותה עובדת מסומנת "עדכון". עדכון הדגלים של השרשור שנכשל לא מבטל שליחה שכבר נשמרה (התשובות בטוחות).
 * @param {{qn:object, questionnaireKey:string, employeeId:string, respondent:{name:string, role:string}, answers:object}} p
 * @returns {Promise<{threadId:string, replyId:string, text:string, updated:boolean, submittedAt:string}>}
 */
export async function submitAnswers({ qn, questionnaireKey, employeeId, respondent, answers }) {
  const thread = await ensureThread({ qn, questionnaireKey, employeeId });
  const prior = await readDb(() => prisma.errorReportReply.count({
    where: { errorReportId: thread.id, employeeId, text: { startsWith: SUBMISSION_HEADER } },
  }));
  const updated = prior > 0;
  const now = new Date();
  const text = renderSubmissionText(qn, answers, {
    gmachName: qn.gmachName, respondentName: respondent.name, respondentRole: respondent.role, submittedAt: now, updated,
  });
  const reply = await writeDb(() => prisma.errorReportReply.create({
    data: { errorReportId: thread.id, employeeId, isProgrammer: false, text, isQuestion: false },
    select: { id: true },
  }));
  try {
    await prisma.errorReport.update({
      where: { id: thread.id },
      data: { isReadByUser: true, isReadByProgrammer: false, isHandled: false, needsHuman: true, status: 'OPEN', updatedAt: now },
    });
  } catch (e) {
    console.error('policyQuestionnaire: reply saved but could not refresh the thread flags:', e?.message || e);
  }
  return { threadId: thread.id, replyId: reply.id, text, updated, submittedAt: now.toISOString() };
}
