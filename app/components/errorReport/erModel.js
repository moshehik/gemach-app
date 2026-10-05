// חלון "דיווח על שגיאות" (עיצוב B שאושר 4.10.2026) - לוגיקה טהורה, בלי React ובלי DOM.
// כל הכללים כאן הם הכללים של החלון הישן (ErrorReportButton.js עד 4.10.2026) - רק ההצגה השתנתה.
// נבדק ב-scripts/test_error_report_ui.mjs (node, בלי דפדפן). כל ה-imports עם סיומת .js כדי שירוצו גם ב-node.
import { appendStepsToReport, splitReportSteps, stepsCountLabel, REPORT_STEPS_HEADER } from '../../../lib/actionRecorderCore.js';

// כותרת קבועה לזיהוי שרשור "יומן הסוכן האוטומטי" (ר' scripts/agent-log-report.js - חייבת להישאר זהה בשני המקומות;
// אין שדה ייעודי בסכימה בכוונה כדי לא לדרוש migration).
export const AGENT_LOG_TITLE = '🤖 יומן הסוכן האוטומטי (נא לא למחוק)';

// הבלוק שהטופס מוסיף לטקסט כשסומנו אלמנטים בעמוד (נשמר כמו שהוא - הסוכן קורא אותו).
export const PICKED_HEADER = 'אלמנטים מסומנים:';
// חיפוש בפניות מוצג רק כשיש יותר מ-8 פניות (החלטת הסקיצה, סבב 3)
export const SEARCH_MIN_ROWS = 8;
// כותרת אוטומטית חלופית: המילים הראשונות של התיאור
export const FALLBACK_TITLE_WORDS = 5;

export { REPORT_STEPS_HEADER, stepsCountLabel };

const fullName = (e) => (e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '');

/** הטקסט של הדיווח בלי בלוק הצעדים ובלי בלוק האלמנטים המסומנים - לכותרת החלופית ולתקציר. */
export function plainBody(text) {
  let body = String(text || '');
  // כל בלוקי הצעדים (גם כפולים), מהסוף להתחלה
  for (;;) {
    const { body: b, steps } = splitReportSteps(body);
    if (!steps.length) break;
    body = b;
  }
  const at = body.indexOf(`[${PICKED_HEADER}`);
  if (at !== -1) body = body.slice(0, at);
  return body.replace(/\s+$/, '');
}

export function firstWords(text, n = FALLBACK_TITLE_WORDS) {
  const w = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  return w.slice(0, n).join(' ') + (w.length > n ? '…' : '');
}

export const isAgentLog = (r) => !!r && r.title === AGENT_LOG_TITLE;

/**
 * הכותרת שמוצגת לדיווח: יומן הסוכן - הכותרת הקבועה שלו; כותרת AI (aiTitle, כשהעמודה קיימת וההגדרה פעילה) -
 * עם סימון "נוצרה אוטומטית"; אחרת חמש המילים הראשונות של התיאור. ErrorReport.title הוא שם העמוד ולא כותרת הדיווח.
 */
export function displayTitle(r) {
  if (!r) return { text: '', ai: false };
  if (isAgentLog(r)) return { text: r.title, ai: false };
  const ai = typeof r.aiTitle === 'string' ? r.aiTitle.trim() : '';
  if (ai) return { text: ai, ai: true };
  return { text: firstWords(plainBody(r.userText)) || 'דיווח ללא תיאור', ai: false };
}

export const isUnread = (r, isProgrammer) => (isProgrammer ? !r.isReadByProgrammer : !r.isReadByUser);

// תגובת "תמיכה" מהסוכן האוטומטי (scripts/error-report-reply.js) לעולם לא מגדירה employeeId - רק תגובה שמתכנת
// מקליד בעצמו ב-UI כן. זה מה שמבחין בין השניים כדי להציג את כפתור "מענה אנושי" רק אחרי תגובת בוט.
export const isBotReply = (reply) => !!reply?.isProgrammer && !reply?.employeeId;

export const lastReply = (r) => {
  const reps = (r && r.replies) || [];
  return reps.length ? reps[reps.length - 1] : null;
};

// "ממתין לתשובה" - התגובה האחרונה בשרשור מסומנת isQuestion. נגזר מהתגובה האחרונה של כל דיווח בנפרד.
export const isAwaitingReply = (r) => !!lastReply(r)?.isQuestion;

/** "דורש תשומת לב" (קבוצה עליונה ברשימה): לא נקרא, או (אצל המדווח) שאלה פתוחה של המתכנת שמחכה לו. */
export function needsAttention(r, isProgrammer) {
  if (isUnread(r, isProgrammer)) return true;
  if (isProgrammer) return false;
  const l = lastReply(r);
  return !!(l && l.isQuestion && l.isProgrammer && !r.isHandled);
}

// אותו מונה כמו בחלון הישן: פניות פתוחות (לא בארכיון) שלא נקראו - הנקודה/המספר על אייקון הסרגל
export const unreadCount = (reports, isProgrammer) =>
  (reports || []).filter((r) => r.status !== 'ARCHIVED' && isUnread(r, isProgrammer)).length;

// המספר על "פניות שלי" בכרטיס: פניות פתוחות שדורשות תשומת לב
export const waitingCount = (reports, isProgrammer) =>
  (reports || []).filter((r) => r.status !== 'ARCHIVED' && needsAttention(r, isProgrammer)).length;

/**
 * סדר הרשימה: יומן הסוכן תמיד ראשון; אחריו "דורש תשומת לב"; מפריד; ושאר הפניות. כש-handledAtBottom
 * (ההגדרה error_report_handled_at_bottom, ברירת מחדל true) פניות "טופל" יורדות לסוף. מיון יציב.
 */
export function groupOpenReports(reports, { isProgrammer, handledAtBottom = true } = {}) {
  const open = (reports || []).filter((r) => r.status !== 'ARCHIVED');
  const pinned = open.filter(isAgentLog);
  const rest = open.filter((r) => !isAgentLog(r));
  const attention = rest.filter((r) => needsAttention(r, isProgrammer));
  let others = rest.filter((r) => !needsAttention(r, isProgrammer));
  if (handledAtBottom) others = [...others].sort((a, b) => (a.isHandled === b.isHandled ? 0 : a.isHandled ? 1 : -1));
  return { top: [...pinned, ...attention], others };
}

/**
 * מיזוג רשימה חדשה (עמוד ראשון רזה מהשרת, partial=true) עם מה שכבר בזיכרון: שרשור שנטען במלואו (partial=false) נשמר - טקסט מלא, כל
 * התגובות, צרופות - כל עוד מספר התגובות והתגובה האחרונה זהים לאלה ברשימה החדשה (כלומר לא נוספה תגובה); מעל זה מתעדכנים רק שדות הרשימה
 * (סטטוס, נקרא, טופל, זמן עדכון, כותרת AI). אחרת השורה החדשה נכנסת כ-partial והשרשור ייטען מחדש. רשימה בצורה ישנה (בלי partial) עוברת כמו שהיא.
 */
export function mergeReportLists(prev, incoming) {
  const byId = new Map((prev || []).map((r) => [r.id, r]));
  return (incoming || []).map((n) => {
    const p = byId.get(n.id);
    if (!n.partial || !p || p.partial) return n;
    const pReps = p.replies || [];
    const nLast = (n.replies || [])[(n.replies || []).length - 1];
    const same = typeof n.repliesCount === 'number'
      && pReps.length === n.repliesCount
      && (!nLast || (pReps.length > 0 && pReps[pReps.length - 1].id === nLast.id));
    if (!same) return n;
    return { ...p, ...n, userText: p.userText, replies: pReps, attachmentUrls: p.attachmentUrls, lastButtons: p.lastButtons, queryParams: p.queryParams, time: p.time, partial: false };
  });
}

// ארכיון: לפי createdAt קבוע (לא לפי updatedAt) - אחרת קריאת פנייה בארכיון מזיזה אותה לראש הרשימה.
export const archivedReports = (reports) =>
  (reports || []).filter((r) => r.status === 'ARCHIVED').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

/** חיפוש בפניות - בטקסט, בכותרת המוצגת, בשם העמוד, בכתובת, בשם המדווח ובתגובות (כמו בחלון הישן). */
export function filterBySearch(list, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((r) => {
    const inMain = (r.userText || '').toLowerCase().includes(q)
      || (r.title || '').toLowerCase().includes(q)
      || (r.url || '').toLowerCase().includes(q)
      || (r.aiTitle || '').toLowerCase().includes(q)
      || displayTitle(r).text.toLowerCase().includes(q)
      || fullName(r.employee).toLowerCase().includes(q);
    const inReplies = (r.replies || []).some((rep) => (rep.text || '').toLowerCase().includes(q));
    return inMain || inReplies;
  });
}

/** זמן יחסי בעברית לשורת הרשימה ("לפני 22 דקות", "אתמול", "לפני שבועיים"). */
export function relativeTime(date, now = Date.now()) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 2) return 'לפני דקה';
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`;
  const d = Math.round(m / 1440);
  if (d === 1) return 'אתמול';
  if (d < 14) return `לפני ${d} ימים`;
  const w = Math.round(d / 7);
  if (w === 2) return 'לפני שבועיים';
  if (d < 60) return `לפני ${w} שבועות`;
  const mo = Math.round(d / 30);
  return mo < 12 ? (mo === 2 ? 'לפני חודשיים' : `לפני ${mo} חודשים`) : (mo < 24 ? 'לפני שנה' : `לפני ${Math.round(mo / 12)} שנים`);
}

/**
 * מה מוצג בבועה. המדווח/ת לעולם לא רואה את שורות הצעדים שהוקלטו (החלטת הבעלים 4.10.2026: "מופיע פעמיים ולא רלוונטי");
 * המתכנת רואה אותן פעם אחת, מקופלות. בלוק כפול (אם נשמר פעמיים בעבר) מוצג פעם אחת - האחרון.
 */
export function bubbleContent(text, isProgrammer) {
  const s = String(text || '');
  const { body, steps } = splitReportSteps(s);
  let cleanBody = body;
  // בלוקים נוספים שנשארו בגוף (שמירה כפולה ישנה) - מוסרים מהתצוגה
  for (;;) {
    const inner = splitReportSteps(cleanBody);
    if (!inner.steps.length) break;
    cleanBody = inner.body;
  }
  return { body: cleanBody, steps: isProgrammer ? steps : [] };
}

/** מוסיף את בלוק הצעדים פעם אחת בלבד (אם הטקסט כבר מכיל בלוק - לא מוסיף שוב). */
export function appendStepsOnce(text, stepsText) {
  if (!stepsText) return text;
  if (String(text || '').includes(`[${REPORT_STEPS_HEADER}\n`)) return text;
  return appendStepsToReport(text, stepsText);
}

/** הטקסט שנשלח בדיווח חדש - בדיוק כמו בחלון הישן: תיאור + [אלמנטים מסומנים] + [צעדים], כל בלוק פעם אחת. */
export function buildReportText(userText, pickedElements, recordedSteps) {
  const picked = pickedElements || [];
  const fullText = picked.length > 0
    ? `${userText}\n\n[${PICKED_HEADER}\n${picked.map((el, i) => `${i + 1}. ${el.label}`).join('\n')}]`
    : userText;
  return appendStepsOnce(fullText, recordedSteps);
}

/**
 * גוף ה-POST /api/error-report - אותם שדות בדיוק כמו בחלון הישן:
 * { userText, url, title (=document.title), time, queryParams, lastButtons, attachments }.
 */
export function buildReportPayload({ userText, pickedElements, recordedSteps, attachments, href, search, docTitle, time, lastButtons }) {
  return {
    userText: buildReportText(userText, pickedElements, recordedSteps),
    url: href,
    title: docTitle,
    time,
    queryParams: search || 'אין',
    lastButtons: lastButtons || [],
    attachments: attachments || [],
  };
}

/** גוף ה-POST /api/error-report/reply - { reportId, text, isQuestion, attachments } כמו בחלון הישן. */
export function buildReplyPayload({ reportId, text, steps, isQuestion, attachments }) {
  return { reportId, text: appendStepsOnce(text, steps), isQuestion: !!isQuestion, attachments: attachments || [] };
}

/** שורת המצב השקטה מתחת לכותרת השרשור (רק כשרלוונטי). המדווח לא רואה "ממתין לתשובה". */
export function quietLine(r, isProgrammer) {
  if (!r) return '';
  if (r.needsHuman) return isProgrammer ? 'המדווח/ת ביקש/ה מענה אנושי ישיר' : 'הבקשה למענה אנושי נשלחה';
  const l = lastReply(r);
  if (isProgrammer && l && l.isQuestion && l.isProgrammer && !r.isHandled) return 'ממתין לתשובה מהמדווח/ת';
  if (r.isHandled) return 'טופל';
  return '';
}

/**
 * הכפתור "אוף! אני צריך מענה אנושי!" (בגוף השיחה, מתחת לתשובת הסוכן האחרונה): רק למדווח (לא למתכנת), רק כשההגדרה
 * error_report_human_button_enabled פעילה, רק אם עוד לא התבקש, ורק כשהתגובה האחרונה היא של הסוכן האוטומטי.
 */
export function showHumanButton(r, { isProgrammer, humanButtonEnabled }) {
  if (!r || isProgrammer || !humanButtonEnabled || r.needsHuman) return false;
  const l = lastReply(r);
  return !!l && isBotReply(l);
}

/** שם השולח בבועה (כמו בחלון הישן): "מתכנת מערכת" לתגובת מתכנת/סוכן, אחרת שם המדווח. */
export function senderName(reply, report) {
  if (reply && reply.isProgrammer) return 'מתכנת מערכת';
  const e = (reply && reply.employee) || (report && report.employee);
  return fullName(e) || 'משתמש';
}

/** האם הבועה "שלי" (מוצמדת לצד השני) - כמו בחלון הישן. */
export const isMine = (reply, isProgrammer) => (isProgrammer ? !!reply.isProgrammer : !reply.isProgrammer);

/** attachmentUrls (JSON של כתובות) -> רשימת צרופות עם סוג, שם ותווית. */
export function parseAttachments(json) {
  let urls = [];
  try { urls = json ? JSON.parse(json) : []; } catch { return []; }
  if (!Array.isArray(urls)) return [];
  return urls.filter((u) => typeof u === 'string' && u).map((url, i) => attachmentInfo(url, i));
}

const IMG_RE = /\.(png|jpe?g|gif|webp)(\?|$)/i;
export function attachmentInfo(url, i = 0) {
  if (url.startsWith('gdrive:')) {
    const id = url.slice(7);
    return { url, src: `/api/recordings/${id}`, kind: 'video', label: 'הסרטת מסך', name: `הסרטת-מסך-${i + 1}.webm`, icon: 'video' };
  }
  if (url.startsWith('data:')) {
    const isImg = /^data:image\//.test(url);
    return { url, src: url, kind: isImg ? 'image' : 'file', label: isImg ? 'צילום מסך' : 'קובץ', name: isImg ? `צילום-${i + 1}.png` : `קובץ-${i + 1}`, icon: isImg ? 'camera' : 'clip' };
  }
  let fileName = null;
  try { fileName = new URL(url, 'http://x').searchParams.get('n'); } catch { fileName = null; }
  if (/\.(webm|mp4)(\?|$)/i.test(url)) return { url, src: url, kind: 'video', label: 'הסרטת מסך', name: fileName || `הסרטה-${i + 1}.webm`, icon: 'video' };
  if (fileName) {
    const img = /\.(png|jpe?g|gif|webp)$/i.test(fileName);
    return { url, src: url, kind: img ? 'image' : 'file', label: fileName, name: fileName, icon: img ? 'camera' : 'clip' };
  }
  // צילום מסך / אלמנט שהועלה (lib/attachmentUpload.js) - בלי שם קובץ בכתובת
  return { url, src: url, kind: 'image', label: 'צילום מסך', name: `צילום-${i + 1}${IMG_RE.test(url) ? '' : '.png'}`, icon: 'camera' };
}

/** צרופה ממתינה בטופס (לפני שליחה): מחרוזת data URL / gdrive:<id>, או { name, size, dataUrl } מקובץ מהמחשב. */
export function pendingInfo(item, i = 0) {
  if (item && typeof item === 'object') {
    const img = /\.(png|jpe?g|gif|webp)$/i.test(item.name || '');
    return { url: item.dataUrl, src: item.dataUrl, kind: img ? 'image' : 'file', label: item.name, name: item.name, icon: img ? 'camera' : 'clip', isFile: true };
  }
  return attachmentInfo(String(item || ''), i);
}

/** "העתק פרטי מערכת" (מתכנת) - אותו טקסט כמו בחלון הישן. */
export function systemDetailsText(report, hebrewDate) {
  let buttons = 'אין מידע';
  if (report.lastButtons) {
    try {
      const arr = JSON.parse(report.lastButtons);
      buttons = Array.isArray(arr) ? arr.map((b, i) => `${i + 1}. ${b}`).join('\n') : report.lastButtons;
    } catch { buttons = report.lastButtons; }
  }
  return `
מאת: ${report.employee ? report.employee.firstName + ' ' + report.employee.lastName : 'לא ידוע'}
זמן: ${report.time || (hebrewDate(report.createdAt) + ' ' + new Date(report.createdAt).toLocaleTimeString('he-IL'))}
חלון/דף: ${report.title || 'לא צוין'}
כתובת URL: ${report.url || 'לא צוין'}
שאילתות/פרמטרים: ${report.queryParams || 'אין'}
תיאור התקלה:
${report.userText}

לחצנים אחרונים:
${buttons}
    `.trim();
}

/** קבצים מהמחשב: אותן בדיקות כמו בחלון הישן (סוג מותר, סה"כ עד 3MB). מחזיר { ok, error } לכל קובץ. */
export function validateFiles(files, currentItems, { isAllowed, maxBytes }) {
  let total = (currentItems || []).reduce((sum, a) => sum + (a && typeof a === 'object' ? a.size || 0 : 0), 0);
  return (files || []).map((f) => {
    if (!isAllowed(f.name)) return { file: f, ok: false, error: `"${f.name}" - סוג קובץ לא נתמך (מותר: וורד, אקסל, PDF, טקסט, תמונות)` };
    if (total + f.size > maxBytes) return { file: f, ok: false, error: `"${f.name}" גדול מדי - סה"כ הקבצים המצורפים מוגבל ל-3MB` };
    total += f.size;
    return { file: f, ok: true };
  });
}
