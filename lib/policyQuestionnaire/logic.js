// lib/policyQuestionnaire/logic.js - הלוגיקה הטהורה של שאלון המדיניות (ביטולים וזיכויים) להנהלות.
//
// אין כאן DB, רשת, React או גישה לסביבה: הכול פונקציות טהורות שנבדקות ב-scripts/test_policy_questionnaire.mjs
// (תקינות, תצוגה מותנית, הדפסת תשובות לטקסט של תגובה בשרשור ופענוח חזרה, קיבוץ לפי משיבה, ספירות, קישורים).
// הגישה למסד (שרשור דיווח-תקלה, בלי טבלה משלו) נמצאת ב-store.js, והמייל ב-notify.js.
//
// צורת תשובה לשאלה:  { choice, otherText, comment }
//   choice = אינדקס האפשרות (0,1,2... לפי options_he) | 'undecided' ("עדיין לא החלטנו") | 'other' ("אחר") | null (לא נענתה)
//   otherText = טקסט חופשי, נשמר רק כש-choice === 'other'
//   comment = הערה חופשית אופציונלית לכל שאלה
// מפת התשובות של משיבה: { [questionId]: תשובה }.

export const UNDECIDED = 'undecided';
export const OTHER = 'other';
export const UNDECIDED_LABEL = 'עדיין לא החלטנו / צריך לחשוב על זה';
export const OTHER_LABEL = 'אחר';
export const UNANSWERED_LABEL = 'לא נענתה';
export const MAX_TEXT = 2000;
export const MAX_NAME = 120;

/** כתובות האתרים הידועים - רק כמוצא אחרון לקישורים במייל, כשאין כותרת מארח ואין משתנה סביבה. */
export const KNOWN_SITE_ORIGINS = {
  org1: 'https://gemach-app-uyh4-beryl.vercel.app',
  org2: 'https://gmach-neve-yaakov.vercel.app',
};
export const ANSWER_PATH = '/refund-questionnaire';
export const RESULTS_PATH = '/refund-questionnaire/answers';

// ---------------------------------------------------------------------------
// מבנה השאלון
// ---------------------------------------------------------------------------

/** כל השאלות בשורה אחת (לפי הסדר), כל אחת עם sectionIndex ו-sectionTitle. */
export function flattenQuestions(qn) {
  const out = [];
  ((qn && qn.sections) || []).forEach((s, si) => {
    (s.questions || []).forEach((q) => out.push({ ...q, sectionIndex: si, sectionTitle: s.title_he || '' }));
  });
  return out;
}

export function findQuestion(qn, id) {
  return flattenQuestions(qn).find((q) => q.id === id) || null;
}

const REPORT_ID_RE = /(?:דיווח(?:ים)?\s+)?\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{8}\b(?:\s*\+\s*(?:דיווח\s+)?\b[0-9a-f]{8}\b)*/g;

/** מסיר אזכורי מזהי דיווח ("דיווח c00b42cf") מטקסט שמוצג להנהלות. הגנה בלבד - הנתונים עצמם כבר נקיים. */
export function stripReportIds(text) {
  return String(text ?? '')
    .replace(REPORT_ID_RE, '')
    .replace(/\(\s*[,;]\s*/g, '(')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** האפשרויות של שאלה כפי שמוצגות: האפשרויות שלה + "אחר" (אם מותר) + "עדיין לא החלטנו" תמיד אחרונה. */
export function optionsForQuestion(question) {
  const list = (question.options_he || []).map((label, i) => ({ value: i, label, kind: 'option' }));
  if (question.allowOther) list.push({ value: OTHER, label: OTHER_LABEL, kind: 'other' });
  list.push({ value: UNDECIDED, label: UNDECIDED_LABEL, kind: 'undecided' });
  return list;
}

/**
 * שאלה כפי שהיא נשלחת לדפדפן של המשיבה: אותם שמות שדות כמו בקובץ הנתונים (כך שכל הפונקציות כאן עובדות גם בצד הלקוח),
 * אבל בלי source ובלי מזהי דיווח. includeSource=true רק לבעלים.
 */
export function publicQuestion(question, { includeSource = false } = {}) {
  const out = {
    id: question.id,
    kind: question.kind || 'single',
    text_he: stripReportIds(question.text_he),
    example_he: stripReportIds(question.example_he),
    today_he: stripReportIds(question.today_he),
    sourceNote_he: stripReportIds(question.sourceNote_he),
    options_he: [...(question.options_he || [])],
    allowOther: !!question.allowOther,
  };
  if (question.showIf) out.showIf = { questionId: question.showIf.questionId, anyOf: [...question.showIf.anyOf] };
  if (includeSource) out.source = question.source || '';
  return out;
}

/** השאלון כפי שנשלח לדפדפן (ר' publicQuestion). includeSource=true רק לבעלים (דף התוצאות). */
export function publicQuestionnaire(qn, { includeSource = false } = {}) {
  return {
    orgKey: qn.orgKey,
    gmachName: qn.gmachName,
    intro_he: stripReportIds(qn.intro_he),
    sections: (qn.sections || []).map((s) => ({
      title_he: s.title_he,
      intro_he: stripReportIds(s.intro_he || ''),
      questions: (s.questions || []).map((q) => publicQuestion(q, { includeSource })),
    })),
  };
}

// ---------------------------------------------------------------------------
// תצוגה מותנית (showIf)
// ---------------------------------------------------------------------------

/**
 * האם שאלה מוצגת בהינתן התשובות הנוכחיות. showIf: { questionId, anyOf:[אינדקסי אפשרות] } - מוצגת רק כשהתשובה
 * לשאלה השולטת היא אחד האינדקסים (לא "לא החלטנו", לא "אחר", לא ריק). שאלה שהשולטת שלה מוסתרת - מוסתרת גם היא.
 */
export function isQuestionVisible(qn, question, answers, depth = 0) {
  if (!question.showIf) return true;
  if (depth > 5) return false;
  const ctrl = findQuestion(qn, question.showIf.questionId);
  if (!ctrl) return false;
  if (!isQuestionVisible(qn, ctrl, answers, depth + 1)) return false;
  const a = answers && answers[ctrl.id];
  return !!a && typeof a.choice === 'number' && question.showIf.anyOf.includes(a.choice);
}

export function visibleQuestions(qn, answers) {
  return flattenQuestions(qn).filter((q) => isQuestionVisible(qn, q, answers));
}

// ---------------------------------------------------------------------------
// ניקוי, מיזוג ותקינות
// ---------------------------------------------------------------------------

function cleanText(v, max = MAX_TEXT) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

export function normalizeRespondent(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { name: cleanText(r.name, MAX_NAME).replace(/\n/g, ' '), role: cleanText(r.role, MAX_NAME).replace(/\n/g, ' ') };
}

/**
 * מנקה תשובה בודדת מול השאלה: choice חוקי בלבד, otherText רק ל"אחר", הערה כטקסט קצר.
 * מחזיר null אם אין בתשובה שום תוכן (לא בחירה ולא הערה).
 */
export function normalizeAnswer(raw, question) {
  if (!raw || typeof raw !== 'object') return null;
  let choice = null;
  const c = raw.choice;
  if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < (question.options_he || []).length) choice = c;
  else if (c === UNDECIDED) choice = UNDECIDED;
  else if (c === OTHER && question.allowOther) choice = OTHER;
  const otherText = choice === OTHER ? cleanText(raw.otherText) : '';
  const comment = cleanText(raw.comment);
  if (choice === null && !comment) return null;
  return { choice, otherText, comment };
}

/** מנקה מפה שלמה: רק מזהי שאלות מוכרים, רק תשובות חוקיות. */
export function sanitizeAnswers(qn, raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const q of flattenQuestions(qn)) {
    if (!Object.prototype.hasOwnProperty.call(raw, q.id)) continue;
    const a = normalizeAnswer(raw[q.id], q);
    if (a) out[q.id] = a;
  }
  return out;
}

/** מסיר תשובות לשאלות שהתצוגה המותנית מסתירה כרגע (למשל n4.3 אחרי ששונתה התשובה ל-n4.2). */
export function pruneHidden(qn, answers) {
  const out = {};
  for (const q of visibleQuestions(qn, answers)) if (answers[q.id]) out[q.id] = answers[q.id];
  return out;
}

/** נענתה = נבחרה אפשרות, או "לא החלטנו" (נחשב תשובה), או "אחר" עם טקסט. */
export function isAnswered(answer) {
  if (!answer) return false;
  if (typeof answer.choice === 'number' || answer.choice === UNDECIDED) return true;
  if (answer.choice === OTHER) return !!(answer.otherText && answer.otherText.trim());
  return false;
}

/** { answered, total } על השאלות הגלויות בלבד. */
export function computeProgress(qn, answers) {
  const vis = visibleQuestions(qn, answers);
  return { answered: vis.filter((q) => isAnswered(answers[q.id])).length, total: vis.length };
}

/**
 * תקינות לשליחה סופית: שם המשיבה, ולכל שאלה גלויה בחירה (או "לא החלטנו", או "אחר" עם טקסט).
 * @returns {{ok:boolean, errors:Array<{questionId:string, code:'missing'|'other_text_missing'}>, nameMissing:boolean}}
 */
export function validateSubmission(qn, answers, respondent) {
  const errors = [];
  for (const q of visibleQuestions(qn, answers)) {
    const a = answers[q.id];
    if (!a || a.choice === null || a.choice === undefined) errors.push({ questionId: q.id, code: 'missing' });
    else if (a.choice === OTHER && !isAnswered(a)) errors.push({ questionId: q.id, code: 'other_text_missing' });
  }
  const nameMissing = !normalizeRespondent(respondent).name;
  return { ok: errors.length === 0 && !nameMissing, errors, nameMissing };
}

// ---------------------------------------------------------------------------
// תצוגת תשובות (סיכום, טקסט, ספירות)
// ---------------------------------------------------------------------------

/** הטקסט של התשובה לשאלה כפי שמוצג/נשלח: טקסט האפשרות, "אחר: ...", "עדיין לא החלטנו...", או "לא נענתה". */
export function answerLabel(question, answer) {
  if (!answer || answer.choice === null || answer.choice === undefined) return UNANSWERED_LABEL;
  if (typeof answer.choice === 'number') return (question.options_he || [])[answer.choice] ?? UNANSWERED_LABEL;
  if (answer.choice === UNDECIDED) return UNDECIDED_LABEL;
  if (answer.choice === OTHER) return answer.otherText ? `${OTHER_LABEL}: ${answer.otherText}` : `${OTHER_LABEL} (בלי פירוט)`;
  return UNANSWERED_LABEL;
}

/** סיכום לפי סעיפים: [{title, items:[{id,text,answerText,comment,answered}]}] - רק שאלות גלויות. */
export function summarize(qn, answers) {
  const vis = new Set(visibleQuestions(qn, answers).map((q) => q.id));
  return (qn.sections || []).map((s) => ({
    title: s.title_he,
    items: (s.questions || []).filter((q) => vis.has(q.id)).map((q) => {
      const a = answers[q.id] || null;
      return {
        id: q.id,
        text: stripReportIds(q.text_he),
        answerText: answerLabel(q, a),
        comment: a && a.comment ? a.comment : '',
        answered: isAnswered(a),
        source: q.source || '',
      };
    }),
  }));
}

/** ספירה לכל שאלה על פני תשובות: [{id, text, counts:[{label,count,kind}], unanswered, total}]. responses: [{answers}] */
export function tallyResponses(qn, responses) {
  const list = Array.isArray(responses) ? responses : [];
  return flattenQuestions(qn).map((q) => {
    const opts = optionsForQuestion(q);
    const counts = opts.map((o) => ({ value: o.value, label: o.label, kind: o.kind, count: 0 }));
    let unanswered = 0;
    let total = 0;
    for (const r of list) {
      const answers = (r && r.answers) || {};
      if (!isQuestionVisible(qn, q, answers)) continue;
      total += 1;
      const a = answers[q.id];
      if (!isAnswered(a)) { unanswered += 1; continue; }
      const slot = counts.find((c) => c.value === a.choice);
      if (slot) slot.count += 1;
    }
    return { id: q.id, text: stripReportIds(q.text_he), counts, unanswered, total };
  });
}

const DATE_FMT = { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };

/** תאריך ושעה בשעון ישראל (dd.mm.yyyy hh:mm). ריק אם אין תאריך תקין. */
export function formatIsraelDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', DATE_FMT).formatToParts(d).reduce((m, p) => { m[p.type] = p.value; return m; }, {});
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`;
}

// ---------------------------------------------------------------------------
// השרשור: התשובות נשמרות כתגובות בשרשור דיווח-תקלה אחד לכל גמ"ח (ErrorReport + ErrorReportReply), בלי טבלה משלהן.
// כל שליחה = תגובה אחת בטקסט פשוט וקריא (ללא JSON); כאן ההדפסה של הטקסט ופענוח חזרה ממנו מול מאגר השאלות.
// ---------------------------------------------------------------------------

/** הכותרת הקבועה של השרשור (ErrorReport.title) וגם השורה הראשונה של כל תגובת תשובות. אין שדה ייעודי בסכימה בכוונה. */
export const THREAD_TITLE = '📋 שאלון מדיניות ביטולים וזיכויים';
export const SUBMISSION_HEADER = THREAD_TITLE;
export const THREAD_URL = '/refund-questionnaire';
const THREAD_MARKER_PREFIX = 'policy-questionnaire:';
const UPDATE_LINE = 'עדכון - זו גרסה מעודכנת של תשובות שאותה משיבה שלחה קודם.';
const WHO_LABEL = 'נענה על ידי: ';
const ROLE_LABEL = 'תפקיד: ';
const SENT_LABEL = 'נשלח: ';
const ANSWER_LABEL = 'תשובה: ';
const COMMENT_LABEL = 'הערה: ';
const CONT = '   '; // שורה שממשיכה טקסט רב-שורתי של תשובה/הערה

/** הסימון היציב לזיהוי השרשור (ErrorReport.queryParams) - כולל את מפתח הסבב, כך שסבב שאלון חדש מקבל שרשור משלו. */
export function threadMarker(questionnaireKey) {
  return `${THREAD_MARKER_PREFIX}${questionnaireKey}`;
}

/** הטקסט הפותח של השרשור (ErrorReport.userText). מתחיל בכותרת כדי שרשימת הפניות תציג אותה. */
export function buildThreadIntro(qn) {
  return [
    `${THREAD_TITLE} - ${qn.gmachName}`,
    'כאן נשמרות התשובות של ההנהלה לשאלון הביטולים והזיכויים. כל שליחה של השאלון נוספת כאן כתגובה אחת, ושליחה חוזרת אחרי "עדכון התשובות" נוספת כתגובה חדשה שמסומנת "עדכון" (תגובות ישנות לא משתנות).',
    `אין צורך לענות בשרשור הזה. כל התשובות מרוכזות גם בדף ${RESULTS_PATH} באתר.`,
  ].join('\n');
}

function multiline(prefix, text) {
  const parts = String(text ?? '').split('\n');
  return [`${prefix}${parts[0]}`, ...parts.slice(1).map((l) => `${CONT}${l}`)];
}

/**
 * הטקסט של שליחה אחת: כותרת (גמ"ח, שם ותפקיד, תאריך, "עדכון" בשליחה חוזרת), ואז לכל שאלה גלויה
 * "<מזהה> <שאלה>" / "תשובה: ..." / "הערה: ..." (אופציונלי). משמש גם לתגובה בשרשור וגם לגוף המייל.
 * meta: {gmachName, respondentName, respondentRole, submittedAt, updated}
 */
export function renderSubmissionText(qn, answers, meta = {}) {
  const lines = [`${SUBMISSION_HEADER} - ${meta.gmachName || qn.gmachName}`];
  if (meta.updated) lines.push(UPDATE_LINE);
  lines.push(...multiline(WHO_LABEL, String(meta.respondentName || '')));
  if (meta.respondentRole) lines.push(`${ROLE_LABEL}${String(meta.respondentRole).replace(/\n/g, ' ')}`);
  const when = formatIsraelDateTime(meta.submittedAt);
  if (when) lines.push(`${SENT_LABEL}${when}`);
  const prog = computeProgress(qn, answers);
  lines.push(`נענו ${prog.answered} מתוך ${prog.total} שאלות`);
  for (const sec of summarize(qn, answers)) {
    if (!sec.items.length) continue;
    lines.push('');
    lines.push(`== ${sec.title} ==`);
    for (const it of sec.items) {
      lines.push('');
      lines.push(`${it.id} ${String(it.text).replace(/\s+/g, ' ')}`);
      lines.push(...multiline(ANSWER_LABEL, it.answerText));
      if (it.comment) lines.push(...multiline(COMMENT_LABEL, it.comment));
    }
  }
  return lines.join('\n');
}

/** האם טקסט של תגובה הוא שליחת תשובות של השאלון (ולא הערה חופשית שמישהו כתב בשרשור). */
export function isSubmissionText(text) {
  return typeof text === 'string' && text.startsWith(SUBMISSION_HEADER);
}

function answerFromLines(question, answerLines, commentLines) {
  const full = answerLines.join('\n');
  const comment = cleanText(commentLines ? commentLines.join('\n') : '');
  let choice = null;
  let otherText = '';
  const idx = (question.options_he || []).indexOf(full);
  if (idx >= 0) choice = idx;
  else if (full === UNDECIDED_LABEL) choice = UNDECIDED;
  else if (question.allowOther && full.startsWith(`${OTHER_LABEL}: `)) { choice = OTHER; otherText = cleanText(full.slice(OTHER_LABEL.length + 2)); }
  else if (full !== UNANSWERED_LABEL) return { unparsed: true };
  if (choice === null && !comment) return null;
  return { choice, otherText, comment };
}

/**
 * מפענח תגובת תשובות חזרה למבנה: { updated, respondentName, respondentRole, sentAtText, answers, unparsed:[מזהי שאלות שלא זוהו] }.
 * null אם הטקסט אינו שליחת תשובות. הפענוח נשען על מאגר השאלות (מזהים ונוסח האפשרויות); תשובה שלא זוהתה (למשל אחרי שינוי נוסח אפשרות)
 * לא נכנסת ל-answers ומופיעה ב-unparsed, והדף מציג אז את הטקסט המלא של התגובה.
 */
export function parseSubmissionText(qn, text) {
  if (!isSubmissionText(text)) return null;
  const known = new Map(flattenQuestions(qn).map((q) => [q.id, q]));
  const info = { updated: false, respondentName: '', respondentRole: '', sentAtText: '', answers: {}, unparsed: [] };
  const blocks = [];
  let cur = null;
  let mode = null; // 'who' | 'answer' | 'comment'
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').slice(1);
  const whoLines = [];
  for (const line of lines) {
    if (line.startsWith(CONT) && mode) {
      const body = line.slice(CONT.length);
      if (mode === 'who') whoLines.push(body);
      else if (mode === 'answer' && cur) cur.answer.push(body);
      else if (mode === 'comment' && cur) cur.comment.push(body);
      continue;
    }
    if (!cur && line.startsWith('עדכון')) { info.updated = true; mode = null; continue; }
    if (!cur && line.startsWith(WHO_LABEL)) { whoLines.push(line.slice(WHO_LABEL.length)); mode = 'who'; continue; }
    if (!cur && line.startsWith(ROLE_LABEL)) { info.respondentRole = line.slice(ROLE_LABEL.length).trim(); mode = null; continue; }
    if (!cur && line.startsWith(SENT_LABEL)) { info.sentAtText = line.slice(SENT_LABEL.length).trim(); mode = null; continue; }
    if (cur && line.startsWith(ANSWER_LABEL) && !cur.answer) { cur.answer = [line.slice(ANSWER_LABEL.length)]; mode = 'answer'; continue; }
    if (cur && line.startsWith(COMMENT_LABEL) && cur.answer && !cur.comment) { cur.comment = [line.slice(COMMENT_LABEL.length)]; mode = 'comment'; continue; }
    const m = /^(\S+) /.exec(line);
    if (m && known.has(m[1]) && !blocks.some((b) => b.id === m[1])) {
      cur = { id: m[1], answer: null, comment: null };
      blocks.push(cur);
      mode = null;
      continue;
    }
    mode = null;
  }
  info.respondentName = whoLines.join('\n').trim();
  for (const b of blocks) {
    if (!b.answer) continue;
    const a = answerFromLines(known.get(b.id), b.answer, b.comment);
    if (a && a.unparsed) info.unparsed.push(b.id);
    else if (a) info.answers[b.id] = a;
  }
  return info;
}

/** טקסט להעתקה של כמה שליחות: הטקסטים המלאים, מופרדים בקו. */
export function joinSubmissionTexts(texts) {
  const list = (Array.isArray(texts) ? texts : []).filter(Boolean);
  return list.join('\n\n------------------------------\n\n');
}

/**
 * מקבץ תגובות-תשובות לפי משיבה: השליחה האחרונה במלואה + "גרסאות קודמות" (מהחדשה לישנה).
 * replies: [{id, employeeId, employeeName, createdAt, text}] - רק תגובות שהן שליחה (isSubmissionText); אחרות מדולגות.
 * @returns {Array<{key, employeeId, name, role, count, latest, earlier}>} המשיבות מסודרות לפי הפעילות האחרונה (החדשה ראשונה);
 *   כל שליחה: {id, createdAt, text, updated, answers, unparsed, name, role}
 */
export function groupSubmissions(qn, replies) {
  const groups = new Map();
  const sorted = (Array.isArray(replies) ? replies : []).filter((r) => r && isSubmissionText(r.text))
    .slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const r of sorted) {
    const parsed = parseSubmissionText(qn, r.text) || {};
    const name = parsed.respondentName || r.employeeName || '';
    const key = r.employeeId || `name:${name}`;
    const sub = {
      id: r.id, createdAt: r.createdAt, text: r.text, updated: !!parsed.updated,
      answers: parsed.answers || {}, unparsed: parsed.unparsed || [], name, role: parsed.respondentRole || '',
    };
    if (!groups.has(key)) groups.set(key, { key, employeeId: r.employeeId || null, submissions: [] });
    groups.get(key).submissions.push(sub);
  }
  return [...groups.values()].map((g) => {
    const subs = g.submissions;
    const latest = subs[subs.length - 1];
    return { key: g.key, employeeId: g.employeeId, name: latest.name, role: latest.role, count: subs.length, latest, earlier: subs.slice(0, -1).reverse() };
  }).sort((a, b) => new Date(b.latest.createdAt) - new Date(a.latest.createdAt));
}

// ---------------------------------------------------------------------------
// קישורים וכתובות
// ---------------------------------------------------------------------------

const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

/**
 * כתובת האתר (origin) לקישורים במייל: כותרות הבקשה (x-forwarded-host / host), אחרת VERCEL_PROJECT_PRODUCTION_URL,
 * אחרת כתובת ידועה לפי הגמ"ח. הכותרת נבדקת (אותיות/ספרות/נקודה/מקף בלבד) כדי שלא תוזרק לקישור במייל.
 */
export function resolveSiteOrigin({ forwardedHost, forwardedProto, host, envProductionUrl, orgKey } = {}) {
  const firstOf = (v) => String(v || '').split(',')[0].trim();
  const h = firstOf(forwardedHost) || firstOf(host);
  if (h && HOST_RE.test(h)) {
    const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(h);
    const proto = firstOf(forwardedProto);
    return `${proto === 'http' || proto === 'https' ? proto : (local ? 'http' : 'https')}://${h}`;
  }
  const env = String(envProductionUrl || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (env && HOST_RE.test(env)) return `https://${env}`;
  return KNOWN_SITE_ORIGINS[orgKey] || KNOWN_SITE_ORIGINS.org1;
}

export function answerUrl(origin) { return `${origin}${ANSWER_PATH}`; }
export function resultsUrl(origin) { return `${origin}${RESULTS_PATH}`; }

// ---------------------------------------------------------------------------
// שגיאות מסד נתונים (רק להחלטה אם כדאי לנסות שוב)
// ---------------------------------------------------------------------------

/** 'transient' (התעוררות Neon / רשת - כדאי לנסות שוב פעם אחת) | 'other'. */
export function classifyDbError(e) {
  if (!e) return 'other';
  const codes = [e.code, e.meta && e.meta.code, e.cause && e.cause.code].filter(Boolean).map(String);
  const msg = String((e.message || '') + ' ' + ((e.meta && e.meta.message) || '') + ' ' + ((e.cause && e.cause.message) || ''));
  if (codes.some((c) => ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(c))) return 'transient';
  if (/Can't reach database|Timed out|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|terminating connection|Connection (?:terminated|closed)|Server has closed the connection|too many connections|Connection pool/i.test(msg)) return 'transient';
  return 'other';
}
