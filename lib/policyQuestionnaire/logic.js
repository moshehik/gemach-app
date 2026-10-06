// lib/policyQuestionnaire/logic.js - הלוגיקה הטהורה של שאלון המדיניות (ביטולים וזיכויים) להנהלות.
//
// אין כאן DB, רשת, React או גישה לסביבה: הכול פונקציות טהורות שנבדקות ב-scripts/test_policy_questionnaire.mjs
// (תקינות, מיזוג, תצוגה מותנית, טקסט להעתקה, סיכום ספירות, קישורים). הגישה למסד נמצאת ב-store.js, והמייל ב-notify.js.
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

/**
 * מיזוג שמירה אוטומטית: שאלה שמופיעה ב-incoming מחליפה את הקיימת (null/ריק = מחיקה); שאלה שלא מופיעה נשארת.
 * אידמפוטנטי: מיזוג אותו incoming פעמיים נותן אותו תוצאה.
 */
export function mergeAnswers(qn, existing, incoming) {
  const base = sanitizeAnswers(qn, existing);
  if (!incoming || typeof incoming !== 'object') return base;
  const out = { ...base };
  for (const q of flattenQuestions(qn)) {
    if (!Object.prototype.hasOwnProperty.call(incoming, q.id)) continue;
    const a = normalizeAnswer(incoming[q.id], q);
    if (a) out[q.id] = a; else delete out[q.id];
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

/**
 * טקסט פשוט של תשובות משיבה אחת (להעתקה ולמייל). meta: {gmachName, respondentName, respondentRole, status, submittedAt, updated}
 */
export function buildPlainText(qn, answers, meta = {}) {
  const lines = [];
  const who = [meta.respondentName, meta.respondentRole].filter(Boolean).join(', ');
  lines.push(`שאלון מדיניות ביטולים וזיכויים - ${meta.gmachName || qn.gmachName}${meta.updated ? ' (עודכן)' : ''}`);
  if (who) lines.push(`נענה על ידי: ${who}`);
  if (meta.status) lines.push(`מצב: ${meta.status === 'submitted' ? 'נשלח' : 'טיוטה (עוד לא נשלח)'}`);
  const when = formatIsraelDateTime(meta.submittedAt);
  if (when) lines.push(`תאריך שליחה: ${when}`);
  const prog = computeProgress(qn, answers);
  lines.push(`נענו ${prog.answered} מתוך ${prog.total} שאלות`);
  for (const sec of summarize(qn, answers)) {
    if (!sec.items.length) continue;
    lines.push('');
    lines.push(`== ${sec.title} ==`);
    for (const it of sec.items) {
      lines.push(`${it.text}`);
      lines.push(`  תשובה: ${it.answerText}`);
      if (it.comment) lines.push(`  הערה: ${it.comment}`);
    }
  }
  return lines.join('\n');
}

/** טקסט להעתקה של כל המשיבות (דף התוצאות, "העתק הכל"). responses: [{respondentName, respondentRole, status, submittedAt, answers}] */
export function buildAllPlainText(qn, responses) {
  const list = Array.isArray(responses) ? responses : [];
  if (!list.length) return `שאלון מדיניות ביטולים וזיכויים - ${qn.gmachName}\nעדיין אין תשובות.`;
  return list
    .map((r) => buildPlainText(qn, r.answers || {}, {
      gmachName: qn.gmachName, respondentName: r.respondentName, respondentRole: r.respondentRole, status: r.status, submittedAt: r.submittedAt,
    }))
    .join('\n\n------------------------------\n\n');
}

// ---------------------------------------------------------------------------
// מייל וקישורים
// ---------------------------------------------------------------------------

/** מייל "עודכן" = כבר נשלח מייל קודם על אותה משיבה (emailedAt קיים) ולא על הגרסה הנוכחית. */
export function isUpdateEmail({ emailedAt, submittedAt } = {}) {
  if (!emailedAt) return false;
  if (!submittedAt) return true;
  return new Date(emailedAt).getTime() <= new Date(submittedAt).getTime();
}

/** האם צריך (עוד) לשלוח מייל על הגרסה הנוכחית של התשובות שנשלחו. */
export function needsEmail(row) {
  if (!row || row.status !== 'submitted') return false;
  if (!row.emailedAt) return true;
  return new Date(row.emailedAt).getTime() < new Date(row.submittedAt).getTime();
}

/** יש שינויים אחרי השליחה האחרונה (עריכה אחרי "עדכון התשובות" שעוד לא נשלחה שוב). */
export function hasPendingChanges(row) {
  if (!row || row.status !== 'submitted' || !row.submittedAt || !row.updatedAt) return false;
  return new Date(row.updatedAt).getTime() > new Date(row.submittedAt).getTime();
}

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
// שגיאות מסד נתונים
// ---------------------------------------------------------------------------

/** 'missing_table' (הטבלה עוד לא נוצרה) | 'transient' (התעוררות Neon / רשת - כדאי לנסות שוב) | 'other'. */
export function classifyDbError(e) {
  if (!e) return 'other';
  const code = e.code || e.meta?.code || '';
  const msg = String(e.message || e.meta?.message || '');
  if (code === 'P2021' || code === '42P01' || /relation .*PolicyQuestionnaireResponse.* does not exist|does not exist.*PolicyQuestionnaireResponse|42P01/i.test(msg)) return 'missing_table';
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(code)) return 'transient';
  if (/Can't reach database|Timed out|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|terminating connection|Connection (?:terminated|closed)|Server has closed the connection|too many connections|Connection pool/i.test(msg)) return 'transient';
  return 'other';
}

// ---------------------------------------------------------------------------
// מצב שורה (לדפדפן)
// ---------------------------------------------------------------------------

/** תיאור מצב של שורה שמורה לדפדפן: תאריכים, האם יש שינויים שלא נשלחו, והאם המייל עוד לא יצא. */
export function describeResponse(row) {
  if (!row) return null;
  return {
    status: row.status,
    submittedAt: row.submittedAt || null,
    updatedAt: row.updatedAt || null,
    emailedAt: row.emailedAt || null,
    emailError: row.emailError || null,
    pendingChanges: hasPendingChanges(row),
    needsEmail: needsEmail(row),
  };
}
