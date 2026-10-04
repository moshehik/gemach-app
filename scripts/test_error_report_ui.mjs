// בדיקת חוזה לחלון "דיווח על שגיאות" בעיצוב החדש (עיצוב B, 4.10.2026): הלוגיקה הטהורה (erModel.js), החוזה מול ה-API
// (כל הקריאות והשדות של החלון הישן נשמרו), הוראות הבעלים (בלי תפריט ⋯ - כפתורים עגולים כחולים של הפלטה עם טולטיפ; "אוף! אני צריך
// מענה אנושי!" בגוף השיחה; חמישה אייקונים; ריחוף בלבד; בלי טקסטי עזר; בלי סימון "שאלה פתוחה" אצל המדווח; שמות בזהב; שורות הצעדים
// לא מוצגות למדווח), כותרת ה-AI (כבויה עד DDL + הגדרה), האייקונים החדשים ב-sprite, והרכבה בשתי המעטפות.
// בלי DB, רשת ודפדפן. הרצה: node scripts/test_error_report_ui.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקה בדפדפן (computed style מול הסקיצה + זרימות אמיתיות עם API מדומה): scripts/error-report-audit (run.mjs, interact.mjs).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as M from '../app/components/errorReport/erModel.js';
import { SPRITE_SYMBOLS } from '../app/components/menu/spriteSymbols.js';
import { buildReportTitlePrompt, buildTitlePrompt, generateChatTitle } from '../lib/ai/chatTitle.js';
import * as AI from '../lib/errorReportAiTitle.js';
import { REPORT_STEPS_HEADER } from '../lib/actionRecorderCore.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const BTN = read('../app/components/ErrorReportButton.js');
const WIN = read('../app/components/errorReport/ErrorReportWindow.js');
const PARTS = read('../app/components/errorReport/erParts.js');
const CSS = read('../app/components/errorReport/errorReport.css');
const LCSS = read('../app/components/errorReport/launcher.css');
const ROUTE = read('../app/api/error-report/route.js');
const APPSHELL = read('../app/components/AppShell.js');
const A5 = read('../app/components/menu/MenuA5Shell.js');
const SCHEMA = read('../prisma/schema.prisma');
const UI = WIN + PARTS;

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const has = (src, re, msg) => assert.ok(re.test(src), msg);
const NOW = Date.parse('2026-10-04T12:00:00Z');
const ago = (m) => new Date(NOW - m * 60000).toISOString();
const STEPS = '1. [00:02] לחץ על שם פרטי (בדף הפרופיל שלי)\n2. [00:05] הקליד "שרה" ב-שם פרטי';
const withSteps = (t0) => `${t0}\n\n[${REPORT_STEPS_HEADER}\n${STEPS}]`;
const rep = (o = {}) => ({ id: 'p', isProgrammer: true, employeeId: null, text: 'x', isQuestion: false, ...o });
const R = (o = {}) => ({ id: 'r', status: 'OPEN', title: 'הפרופיל שלי', userText: 'הכפתור תקוע אחרי לחיצה על שמירה', isReadByUser: true, isReadByProgrammer: true, isHandled: false, needsHuman: false, createdAt: ago(10), updatedAt: ago(10), replies: [], ...o });

console.log('לוגיקה (erModel.js)');
await t('כותרת: aiTitle עם סימון אוטומטי; בלעדיו 5 המילים הראשונות (בלי בלוק הצעדים והאלמנטים); יומן הסוכן - הכותרת הקבועה', () => {
  assert.deepEqual(M.displayTitle(R({ aiTitle: 'כפתור שמירה תקוע' })), { text: 'כפתור שמירה תקוע', ai: true });
  assert.deepEqual(M.displayTitle(R({ userText: withSteps('לחצתי על שמירה והדף נשאר תקוע בלי הודעה') })), { text: 'לחצתי על שמירה והדף נשאר…', ai: false });
  assert.equal(M.displayTitle(R({ userText: 'קצר\n\n[אלמנטים מסומנים:\n1. button#x]' })).text, 'קצר');
  assert.deepEqual(M.displayTitle(R({ title: M.AGENT_LOG_TITLE, aiTitle: 'לא' })), { text: M.AGENT_LOG_TITLE, ai: false });
  assert.equal(M.AGENT_LOG_TITLE, '🤖 יומן הסוכן האוטומטי (נא לא למחוק)', 'חייב להיות זהה ל-scripts/agent-log-report.js');
  assert.ok(read('../scripts/agent-log-report.js').includes(M.AGENT_LOG_TITLE));
});
await t('לא נקרא / תשומת לב / מונים: כמו בחלון הישן (מתכנת: isReadByProgrammer, מדווח: isReadByUser; ארכיון לא נספר)', () => {
  const list = [R({ id: 'a', isReadByUser: false }), R({ id: 'b', isReadByProgrammer: false }), R({ id: 'c', isReadByUser: false, status: 'ARCHIVED' })];
  assert.equal(M.unreadCount(list, false), 1);
  assert.equal(M.unreadCount(list, true), 1);
  const q = R({ id: 'q', replies: [rep({ isQuestion: true, employeeId: 'p1' })] });
  assert.equal(M.needsAttention(q, false), true, 'שאלה פתוחה של המתכנת מחכה למדווח');
  assert.equal(M.needsAttention(q, true), false, 'אצל המתכנת שאלה פתוחה לא "דורשת תשומת לב"');
  assert.equal(M.needsAttention({ ...q, isHandled: true }, false), false);
  assert.equal(M.waitingCount([q, R({ id: 'u', isReadByUser: false })], false), 2);
});
await t('סדר הרשימה: יומן הסוכן ראשון, אחריו "דורש תשומת לב", מפריד, השאר; "טופל" לסוף רק כשההגדרה פעילה', () => {
  const list = [R({ id: 'h', isHandled: true }), R({ id: 'n' }), R({ id: 'u', isReadByUser: false }), R({ id: 'log', title: M.AGENT_LOG_TITLE }), R({ id: 'x', status: 'ARCHIVED' })];
  const g = M.groupOpenReports(list, { isProgrammer: false, handledAtBottom: true });
  assert.deepEqual(g.top.map((r) => r.id), ['log', 'u']);
  assert.deepEqual(g.others.map((r) => r.id), ['n', 'h']);
  assert.deepEqual(M.groupOpenReports(list, { isProgrammer: false, handledAtBottom: false }).others.map((r) => r.id), ['h', 'n']);
  assert.deepEqual(M.archivedReports([R({ id: 'a1', status: 'ARCHIVED', createdAt: ago(100) }), R({ id: 'a2', status: 'ARCHIVED', createdAt: ago(5) })]).map((r) => r.id), ['a2', 'a1']);
});
await t('חיפוש: טקסט, כותרת מוצגת, שם עמוד, כתובת, שם המדווח, תגובות', () => {
  const list = [R({ id: '1', userText: 'אחד', employee: { firstName: 'דינה', lastName: 'לוי' } }), R({ id: '2', userText: 'שתיים', url: '/orders/7', replies: [rep({ text: 'תוקן במלאי' })] }), R({ id: '3', userText: 'שלוש', aiTitle: 'תקלה בהדפסה' })];
  assert.deepEqual(M.filterBySearch(list, 'דינה').map((r) => r.id), ['1']);
  assert.deepEqual(M.filterBySearch(list, 'במלאי').map((r) => r.id), ['2']);
  assert.deepEqual(M.filterBySearch(list, 'orders').map((r) => r.id), ['2']);
  assert.deepEqual(M.filterBySearch(list, 'הדפסה').map((r) => r.id), ['3']);
  assert.equal(M.filterBySearch(list, '  ').length, 3);
  assert.equal(M.SEARCH_MIN_ROWS, 8, 'חיפוש מוצג רק מעל 8 פניות');
});
await t('זמן יחסי בעברית', () => {
  assert.equal(M.relativeTime(ago(1), NOW), 'לפני דקה');
  assert.equal(M.relativeTime(ago(22), NOW), 'לפני 22 דקות');
  assert.equal(M.relativeTime(ago(120), NOW), 'לפני שעתיים');
  assert.equal(M.relativeTime(ago(1500), NOW), 'אתמול');
  assert.equal(M.relativeTime(ago(20000), NOW), 'לפני שבועיים');
});
await t('צעדים שהוקלטו: המדווח לא רואה אותם; המתכנת רואה פעם אחת; בלוק כפול מוצג פעם אחת', () => {
  const text = withSteps('הכפתור תקוע');
  assert.deepEqual(M.bubbleContent(text, false), { body: 'הכפתור תקוע', steps: [] });
  const prog = M.bubbleContent(text, true);
  assert.equal(prog.body, 'הכפתור תקוע');
  assert.equal(prog.steps.length, 2);
  const doubled = `${withSteps('הכפתור תקוע')}\n\n[${REPORT_STEPS_HEADER}\n${STEPS}]`;
  assert.equal(M.bubbleContent(doubled, false).body, 'הכפתור תקוע', 'בלוק כפול לא דולף לגוף');
  assert.equal(M.bubbleContent(doubled, true).steps.length, 2);
  assert.ok(!M.bubbleContent(doubled, false).body.includes(REPORT_STEPS_HEADER));
});
await t('שמירה פעם אחת: appendStepsOnce לא מוסיף בלוק שני; הטקסט שנשלח = הפורמט של החלון הישן (הסוכן קורא אותו)', () => {
  const once = M.appendStepsOnce('תיאור', STEPS);
  assert.equal(once, `תיאור\n\n[${REPORT_STEPS_HEADER}\n${STEPS}]`);
  assert.equal(M.appendStepsOnce(once, STEPS), once);
  assert.equal(once.split(REPORT_STEPS_HEADER).length - 1, 1);
  const picked = [{ label: 'button#pfSave.btn — "שמירה"' }];
  assert.equal(M.buildReportText('נתקע', picked, ''), 'נתקע\n\n[אלמנטים מסומנים:\n1. button#pfSave.btn — "שמירה"]');
  const full = M.buildReportText('נתקע', picked, STEPS);
  assert.equal(full.split(REPORT_STEPS_HEADER).length - 1, 1);
  assert.ok(full.endsWith(`${STEPS}]`));
});
await t('payload של דיווח חדש: בדיוק השדות של החלון הישן', () => {
  const p = M.buildReportPayload({ userText: 'נתקע', pickedElements: [], recordedSteps: '', attachments: ['data:image/png;base64,AA', { name: 'a.pdf', size: 3, dataUrl: 'data:application/pdf;base64,AA' }], href: 'http://x/profile?a=1', search: '?a=1', docTitle: 'הפרופיל שלי', time: 'ד תשרי 12:00', lastButtons: ['שמירה'] });
  assert.deepEqual(Object.keys(p).sort(), ['attachments', 'lastButtons', 'queryParams', 'time', 'title', 'url', 'userText']);
  assert.equal(p.title, 'הפרופיל שלי');
  assert.equal(p.queryParams, '?a=1');
  assert.equal(M.buildReportPayload({ userText: 'x', search: '' }).queryParams, 'אין');
  assert.deepEqual(M.buildReportPayload({ userText: 'x' }).lastButtons, []);
  const r = M.buildReplyPayload({ reportId: 'r1', text: 'תודה', steps: '', isQuestion: false, attachments: [] });
  assert.deepEqual(Object.keys(r).sort(), ['attachments', 'isQuestion', 'reportId', 'text']);
});
await t('שורת המצב השקטה וכפתור "מענה אנושי": המדווח לא רואה "ממתין לתשובה"; הכפתור רק אחרי תגובת סוכן, לא למתכנת, לפי ההגדרה', () => {
  const q = R({ replies: [rep({ isQuestion: true, employeeId: 'p1' })] });
  assert.equal(M.quietLine(q, false), '');
  assert.equal(M.quietLine(q, true), 'ממתין לתשובה מהמדווח/ת');
  assert.equal(M.quietLine(R({ needsHuman: true }), false), 'הבקשה למענה אנושי נשלחה');
  assert.equal(M.quietLine(R({ needsHuman: true }), true), 'המדווח/ת ביקש/ה מענה אנושי ישיר');
  assert.equal(M.quietLine(R({ isHandled: true }), false), 'טופל');
  const bot = R({ replies: [rep({ employeeId: null })] });
  assert.equal(M.showHumanButton(bot, { isProgrammer: false, humanButtonEnabled: true }), true);
  assert.equal(M.showHumanButton(bot, { isProgrammer: true, humanButtonEnabled: true }), false);
  assert.equal(M.showHumanButton(bot, { isProgrammer: false, humanButtonEnabled: false }), false);
  assert.equal(M.showHumanButton({ ...bot, needsHuman: true }, { isProgrammer: false, humanButtonEnabled: true }), false);
  assert.equal(M.showHumanButton(R({ replies: [rep({ employeeId: 'p1' })] }), { isProgrammer: false, humanButtonEnabled: true }), false, 'תגובת מתכנת אנושי');
  assert.equal(M.isBotReply(rep({ employeeId: null })), true);
  assert.equal(M.senderName(rep(), R()), 'מתכנת מערכת');
});
await t('צרופות: תמונה / הסרטה בדרייב / קובץ (?n=) / וידאו; ממתינות; JSON שבור = אין צרופות', () => {
  const a = M.parseAttachments(JSON.stringify(['https://b/x.png', 'gdrive:ABC', 'https://b/f?n=' + encodeURIComponent('דוח.pdf'), 'https://b/v.webm']));
  assert.deepEqual(a.map((x) => x.kind), ['image', 'video', 'file', 'video']);
  assert.equal(a[1].src, '/api/recordings/ABC');
  assert.equal(a[2].label, 'דוח.pdf');
  assert.deepEqual(M.parseAttachments('{bad'), []);
  assert.equal(M.pendingInfo({ name: 'a.png', size: 1, dataUrl: 'data:image/png;base64,A' }).kind, 'image');
  assert.equal(M.pendingInfo('data:image/png;base64,A').kind, 'image');
});
await t('קבצים מהמחשב: סוג לא נתמך / יותר מ-3MB בסך הכל - אותן הודעות כמו קודם', () => {
  const isAllowed = (n) => /\.(pdf|png|docx)$/i.test(n);
  const res = M.validateFiles([{ name: 'a.exe', size: 1 }, { name: 'b.pdf', size: 2 * 1024 * 1024 }, { name: 'c.pdf', size: 2 * 1024 * 1024 }], [{ name: 'x', size: 512 * 1024 }], { isAllowed, maxBytes: 3 * 1024 * 1024 });
  assert.equal(res[0].error, '"a.exe" - סוג קובץ לא נתמך (מותר: וורד, אקסל, PDF, טקסט, תמונות)');
  assert.equal(res[1].ok, true);
  assert.equal(res[2].error, '"c.pdf" גדול מדי - סה"כ הקבצים המצורפים מוגבל ל-3MB');
});
await t('"העתק פרטי מערכת" - אותו טקסט כמו קודם', () => {
  const s = M.systemDetailsText(R({ employee: { firstName: 'שרה', lastName: 'כהן' }, time: 'ד תשרי 10:00', url: 'http://x', queryParams: 'אין', lastButtons: JSON.stringify(['שמירה', 'סגור']) }), () => 'ד תשרי');
  for (const part of ['מאת: שרה כהן', 'זמן: ד תשרי 10:00', 'חלון/דף: הפרופיל שלי', 'כתובת URL: http://x', 'שאילתות/פרמטרים: אין', 'תיאור התקלה:', '1. שמירה\n2. סגור']) assert.ok(s.includes(part), part);
});

console.log('חוזה ה-API (נשמר מהחלון הישן)');
await t('GET /api/error-report (מלא, בחלון) ו-?light=1 (בדיקה תקופתית, בכפתור) - 120 שנ\', רק כשסגור והטאב גלוי, 401 עוצר', () => {
  has(WIN, /fetch\('\/api\/error-report'\)/, 'GET מלא');
  has(BTN, /fetch\('\/api\/error-report\?light=1'\)/, 'GET light');
  has(BTN, /setInterval\(\(\) => fetchLight\(\), 120000\)/, 'כל 120 שנ\'');
  has(BTN, /visibilitychange/, 'עצירה בטאב מוסתר');
  has(BTN, /if \(mounted && !isOpen && !document\.hidden\) start\(\)/, 'רק כשהחלון סגור');
  has(BTN + WIN, /res\.status === 401/, '401');
  has(BTN + WIN, /seq !== fetchSeqRef\.current/, 'תשובה ישנה לא דורסת חדשה');
});
await t('POST /api/error-report עם כל השדות (url/title/time/queryParams/lastButtons/attachments) + הודעות', () => {
  has(WIN, /fetch\('\/api\/error-report', \{\s*method: 'POST'/, 'POST');
  has(WIN, /M\.buildReportPayload\(\{[\s\S]*?href: window\.location\.href,[\s\S]*?search: window\.location\.search,[\s\S]*?docTitle: document\.title,[\s\S]*?time: getHebrewDateString\(new Date\(\)\) \+ ' ' \+ new Date\(\)\.toLocaleTimeString\('he-IL'\),[\s\S]*?lastButtons: window\.__lastButtons \|\| \[\]/, 'כל שדות ה-payload');
  has(BTN, /window\.__lastButtons\.length > 5/, '5 הלחצנים האחרונים');
  for (const m of ['יצירת דיווח חדש מותרת למנהלים בלבד', 'יש להזין תיאור שגיאה', 'ההסרטה עדיין עולה — נא להמתין רגע', 'שולח דיווח למתכנת, אנא המתן...', 'הדיווח נשלח בהצלחה למתכנת! תודה.', 'שגיאה בשליחת דיווח', 'שגיאת תקשורת']) assert.ok(WIN.includes(m), m);
});
await t('PATCH: status (ארכיון/שחזור), isHandled, isReadByUser/isReadByProgrammer, needsHuman', () => {
  for (const f of ['status }', 'isHandled: newHandled', 'needsHuman: true', 'isReadByProgrammer: isProgrammer ? true : undefined', 'isReadByUser: !isProgrammer ? true : undefined']) assert.ok(WIN.includes(f), f);
  assert.equal((WIN.match(/method: 'PATCH'/g) || []).length >= 4, true);
  has(WIN, /archivedR \? 'OPEN' : 'ARCHIVED'/, 'ארכיון ושחזור');
});
await t('תגובה, סקיצה (אשר/דחה + הערה, iframe sandbox), סוכן אוטומטי ופריסות (מתכנת), הגדרות', () => {
  has(WIN, /fetch\('\/api\/error-report\/reply', \{\s*method: 'POST'/, 'reply');
  has(WIN, /M\.buildReplyPayload\(\{ reportId: selected\.id, text: replyText, steps: replySteps, isQuestion: isProgrammer && replyQ, attachments: attValues\(replyAtts\) \}\)/, 'גוף התגובה');
  has(WIN, /fetch\('\/api\/error-report\/sketch-decision'[\s\S]*?JSON\.stringify\(\{ replyId: reply\.id, decision, note:/, 'sketch-decision');
  has(WIN, /<iframe className="er-lbfr" title="סקיצה" sandbox="" src=\{`\/api\/error-report\/sketch\/\$\{lightbox\.sketchId\}`\}/, 'iframe sandbox');
  has(WIN, /fetch\('\/api\/agent\/fix-loop'\)/, 'GET fix-loop');
  has(WIN, /body: JSON\.stringify\(\{ enabled: !agentLoopEnabled \}\)/, 'PATCH enabled');
  has(WIN, /body: JSON\.stringify\(\{ deployEnabled: !deployEnabled \}\)/, 'PATCH deployEnabled');
  for (const k of ['error_report_handled_at_bottom', 'error_report_human_button_enabled', 'ai_screen_recording_enabled']) assert.ok(WIN.includes(k), k);
  has(WIN, /fetch\('\/api\/settings'\)/, 'settings');
});
await t('צירוף: סימון אלמנט (useElementPicker + captureElement), צילום מסך (captureViewport), קובץ (3MB), הסרטה (דרייב) והקלטת פעולות', () => {
  for (const s of ['useElementPicker(', 'captureElement(el)', 'captureViewport()', 'MAX_ATTACHMENT_FILES_TOTAL_BYTES', 'isAllowedAttachmentFile', 'ATTACHMENT_FILE_INPUT_ACCEPT', 'prepareScreenRecordingUpload(\'error-report\')', 'uploadScreenRecording(blob, prepared, \'error-report\')', '`gdrive:${fileId}`', 'actionRecorder.start()', 'formatActionSteps(actionRecorder.stop())', 'data-no-record="true"', 'לא נרשמו פעולות — נסה שוב']) assert.ok(WIN.includes(s), s);
  has(WIN, /\[אלמנט מסומן: \$\{described\.label\}\]/, 'סימון בתגובה מוסיף את תיאור האלמנט לטקסט');
});
await t('המתכנת רואה הכול, המדווח רק את שלו - נקבע בשרת (לא השתנה); החלון לא מסנן בעצמו', () => {
  has(ROUTE, /const whereClause = isProgrammer \? \{\} : \{ employeeId: employee\.id \};/, 'כלל הנראות בשרת');
  has(ROUTE, /hasPermission\(employee, 'feature:error_reports'\)/, 'הרשאת דיווח חדש');
  assert.ok(!/employeeId ===|\.filter\(\(r\) => r\.employeeId/.test(WIN), 'אין סינון לפי עובד בצד הלקוח');
});

console.log('העיצוב שאושר + הוראות הבעלים');
await t('אין תפריט ⋯: בלי .menu / er3-menu / role="menu" / אייקון more', () => {
  assert.ok(!/er3-menu|role="menu"|className="menu|n="more"|'more'/.test(UI), 'תפריט ⋯ חזר');
  assert.ok(!/er3-menu|\.menu\b/.test(CSS), 'CSS של תפריט');
  assert.ok(!SPRITE_SYMBOLS.some(([id]) => id === 'more'), 'אייקון more לא הותקן');
});
await t('כותרת השרשור: "טופל" (V) ו"ארכיון" ככפתורים עגולים כחולים של הפלטה (.tools .xlbtn.xlp) עם טולטיפ; גלויים תמיד', () => {
  has(PARTS, /className=\{`xlbtn xlp\$\{pressed \? ' on' : ''\}`\}[^>]*data-tip=\{tip\} aria-label=\{tip\}/, 'RoundBtn = .xlbtn.xlp עם data-tip');
  has(WIN, /<div className=\{`tools er3-acts/, 'בתוך .tools (הגודל העגול 36px של הפלטה)');
  has(WIN, /<RoundBtn act="handled" icon="check"[^>]*tip=\{r\.isHandled \? 'בטל סימון טופל' : 'סמן כטופל'\}/, 'V');
  has(WIN, /<RoundBtn act="archive" icon=\{archivedR \? 'undo' : 'archive'\} tip=\{archivedR \? 'שחזר מהארכיון' : 'העבר לארכיון'\}/, 'ארכיון');
  assert.ok(!/\.er3-acts[^{]*\{[^}]*opacity:0/.test(CSS), 'הכפתורים לא מוסתרים עד ריחוף');
});
await t('פעולות מתכנת (שאלה פתוחה, העתק פרטי מערכת, סוכן, פריסות) - רק במצב מתכנת', () => {
  has(WIN, /\{isProgrammer \? <RoundBtn act="question" icon="flag"[^>]*tip="סמן שיש שאלה פתוחה למדווח"/, 'שאלה פתוחה - מתכנת בלבד');
  has(WIN, /\{isProgrammer \? <RoundBtn act="copy" icon="copy" tip="העתק פרטי מערכת"/, 'העתקה - מתכנת בלבד');
  has(WIN, /\{isProgrammer \? \(\s*<div className="tools er3-acts" role="group" aria-label="הסוכן האוטומטי">/, 'סוכן/פריסות - מתכנת בלבד');
});
await t('המדווח לא רואה ולא שולח "שאלה פתוחה": אין תיבת סימון; isQuestion נשלח רק ממתכנת', () => {
  assert.ok(!/זו שאלה פתוחה|type="checkbox"/.test(UI), 'תיבת "זו שאלה פתוחה" חזרה');
  has(WIN, /isQuestion: isProgrammer && replyQ/, 'isQuestion רק ממתכנת');
  assert.ok(!/שאלה פתוחה/.test(WIN.replace(/סמן שיש שאלה פתוחה למדווח|הקלד תגובה \(שאלה פתוחה למדווח\)\.\.\.|\/\/.*$/gm, '')), 'שאלה פתוחה מוצגת למדווח');
});
await t('"אוף! אני צריך מענה אנושי!" בגוף השיחה (מתחת לתשובת הסוכן האחרונה), לא בכותרת ולא בתפריט', () => {
  const msgs = WIN.slice(WIN.indexOf('<div className="er3-msgs">'), WIN.indexOf('<div className="er-reply er3-reply">'));
  assert.ok(msgs.includes('אוף! אני צריך מענה אנושי!'), 'הכפתור לא בגוף השיחה');
  const code = WIN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal((code.match(/אוף! אני צריך מענה אנושי!/g) || []).length, 1, 'הכפתור מופיע יותר ממקום אחד');
  has(msgs, /humanAfter && i === reps\.length - 1/, 'מתחת לתגובה האחרונה');
  has(WIN, /const humanAfter = M\.showHumanButton\(r, \{ isProgrammer, humanButtonEnabled: settings\.humanButtonEnabled \}\)/, 'לפי הכללים');
  const head = WIN.slice(WIN.indexOf('<div className="er3-th">'), WIN.indexOf('<div className="er3-scroll"'));
  assert.ok(!head.includes('אוף!'), 'בכותרת');
});
await t('חמישה אייקונים בטופס ובתגובה (סימון, צילום, קובץ, הסרטה - לפי ai_screen_recording_enabled, הקלטת פעולות)', () => {
  for (const [k, ic] of [['pick', 'crosshair'], ['shot', 'camera'], ['file', 'clip'], ['video', 'video'], ['steps', 'cursor-rec']]) has(WIN, new RegExp(`\\{ k: '${k}', icon: '${ic}'`), `${k}/${ic}`);
  has(WIN, /\.\.\.\(settings\.recordingEnabled \? \[\{ k: 'video'/, 'הסרטה רק כשההגדרה פעילה');
  assert.equal((WIN.match(/acts=\{acts\('(new|reply)'\)\}/g) || []).length, 2, 'אותה שורה בטופס ובתגובה');
});
await t('האייקונים בתוך התיבה מופיעים רק בריחוף / מיקוד / נגיעה; כפתור השליחה תמיד גלוי', () => {
  has(CSS, /\.gm-ds\.gm-er \.er-cbar \.er-cb\{opacity:0;/, 'מוסתרים במנוחה');
  has(CSS, /\.er-composer:hover \.er-cbar \.er-cb,\.gm-ds\.gm-er \.er-cbar:focus-within \.er-cb,\.gm-ds\.gm-er \.er-composer\.reveal \.er-cb/, 'ריחוף / מיקוד / נגיעה');
  assert.ok(!/\.er-send\{[^}]*opacity:0/.test(CSS), 'השליחה מוסתרת');
  has(PARTS, /onPointerDown=\{\(e\) => \{ if \(e\.pointerType === 'touch' && onTouch\) onTouch\(\); \}\}/, 'נגיעה חושפת');
});
await t('בלי טקסטי עזר גלויים (טולטיפים בלבד)', () => {
  const visible = UI.replace(/\bh: '[^']*'/g, '').replace(/data-tip=\{?[`'"][^`'"]*[`'"]\}?/g, '').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const s of ['אין עדיין צרופות', 'עד 3MB בסך הכל', 'הסרטה ורישום פעולות לא כוללים', 'עזרו לנו לראות את התקלה', 'לחיצה על תמונה פותחת אותה בגודל מלא', 'וורד, אקסל, PDF']) assert.ok(!visible.includes(s), s);
});
await t('X תמיד ראשון בכותרת (קצה ימין ב-RTL) בכרטיס ובפאנל; "+ דיווח חדש" רק בפאנל, אחרון (שמאל)', () => {
  has(WIN, /<div className="er-hd">\s*\{xBtn\(close\)\}/, 'X ראשון בכרטיס');
  has(WIN, /<div className="er3-hd">\s*\{xBtn\(close\)\}/, 'X ראשון בפאנל');
  const card = WIN.slice(WIN.indexOf('const cardBody'), WIN.indexOf('// ----- panel: list'));
  assert.ok(!card.includes('er-newb'), '"+ דיווח חדש" בטופס הדיווח');
  has(WIN, /\{canNew \? <button type="button" className="btn primary er-newb"[^\n]*דיווח חדש<\/button> : null\}\s*<\/div>\s*<div className="er3-g">/, '"+ דיווח חדש" אחרון בכותרת הפאנל');
});
await t('שמות השולחים בזהב של הפלטה (טוקן, לא צבע חדש): --gm-gold-d על משטח בהיר, --gm-gold-300 על כהה', () => {
  has(CSS, /\.gm-ds\.gm-er \.er3-bh b\{[^}]*color:var\(--er-name\)/, 'שם בבועה');
  has(CSS, /\.gm-ds\.gm-er #dlg\.er-win\.er-light\{--er-name:var\(--gm-gold-d\)\}/, 'בהיר');
  has(CSS, /\.gm-ds\.gm-er #dlg\.er-win\{--er-name:var\(--gm-gold-300\)\}/, 'כהה');
});
await t('הצעדים שהוקלטו: בטופס רק "נרשמו N צעדים" + הסר (בלי השורות); בבועה - רק למתכנת, מקופל "צעדים שהוקלטו"', () => {
  assert.ok(!/<pre/.test(UI), 'שורות הצעדים מוצגות בטופס');
  has(WIN, /נרשמו \{M\.stepsCountLabel\(st\.split\('\\n'\)\.length\)\}<button type="button" className="btn ghost" onClick=\{onRemove\}>הסר<\/button>/, 'צ׳יפ + הסר');
  has(WIN, /const c = M\.bubbleContent\(body, isProgrammer\);/, 'הבועה עוברת דרך bubbleContent');
  has(WIN, /<summary>צעדים שהוקלטו \(\{M\.stepsCountLabel\(c\.steps\.length\)\}\)<\/summary>/, 'מקופל למתכנת');
});
await t('תאריך ושעה בבועה רק בטולטיפ; רשימה = כותרת + נקודה + זמן יחסי; צרופות נפתחות בחלון הכהה ויורדות', () => {
  has(WIN, /className=\{`er3-b\$\{cls \|\| ''\}`\} tabIndex=\{0\} data-tip=\{hebrewDateTime\(date\)\}/, 'טולטיפ תאריך');
  has(WIN, /<span className="er3-t">\{t\.text\}<\/span>\s*<span className="er3-ago">\{M\.relativeTime/, 'שורת רשימה');
  has(WIN, /className="dlg mailwin er-lb" id="dlg2"/, 'החלון הכהה #dlg2');
  has(WIN, /className="gm-ds gm-er dlg-dark"/, 'שורש dlg-dark');
  has(PARTS, /download=\{info\.name\}/, 'הורדה');
});
await t('גלילה דקה (6px, מעוגלת, מופיעה בריחוף); בנייד גיליון תחתון', () => {
  has(CSS, /::-webkit-scrollbar\{width:6px;height:6px\}/, '6px');
  has(CSS, /scrollbar-width:thin/, 'Firefox');
  has(CSS, /#scrim\.er-sheet #dlg\.mailwin\{[^}]*border-radius:24px 24px 0 0!important/, 'גיליון תחתון');
});
await t('הכפתור הצף: שקט כברירת מחדל, נחשף בריחוף/מיקוד; בנגיעה ראשונה רק נחשף', () => {
  has(LCSS, /\.er-fab\{[^}]*opacity:\.5/, 'שקט');
  has(LCSS, /\.er-fab:hover,\.gm-er-launch \.er-fab:focus-within,\.gm-er-launch \.er-fab\.reveal\{transform:translateX\(-14px\);opacity:1\}/, 'נחשף');
  has(BTN, /if \(touch && !fabReveal\)/, 'נגיעה ראשונה');
});

console.log('הרכבה בשתי המעטפות, CSS, אייקונים');
await t('המעטפת הישנה: <ErrorReportButton /> (icon-btn); A5: trigger עם #snErr; רכיב אחד, נטען בעצלות', () => {
  has(APPSHELL, /\{!hideErrorReporting && <ErrorReportButton \/>\}/, 'AppShell');
  has(A5, /<ErrorReportButton\s+trigger=\{\(\{ onOpen, unreadCount \}\) => \(\s*<button type="button" className="sn-ib" id="snErr"/, 'MenuA5Shell');
  has(BTN, /dynamic\(\(\) => import\('\.\/errorReport\/ErrorReportWindow'\), \{ ssr: false \}\)/, 'טעינה עצלה');
  assert.ok(!/components\.css/.test(BTN), 'הפלטה לא נטענת בכל דף במעטפת הישנה');
  has(BTN, /className="icon-btn"/, 'הכפתור הישן נשאר');
  has(WIN, /\{shell \? null : <MenuSprite \/>\}/, 'sprite רק כשאין מעטפת A5');
});
await t('CSS: כל כלל בהיקף .gm-ds.gm-er (חוץ מסמן הסימון על body ו-@keyframes)', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  const sels = [...rules.matchAll(/([^{}@]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => s && !s.startsWith('@'));
  assert.ok(sels.length > 150, `parsed only ${sels.length}`);
  const topSplit = (sel) => { const out = []; let d = 0; let cur = ''; for (const ch of sel) { if ('(['.includes(ch)) d++; else if (')]'.includes(ch)) d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
  for (const s of sels) for (const part of topSplit(s)) {
    const x = part.trim();
    assert.ok(/^\.gm-ds\.gm-er(?![\w-])/.test(x) || /^body\.gm-er-picking/.test(x), `לא בהיקף: ${x}`);
  }
  assert.ok(!/\.gm-home/.test(CSS), 'gm-home');
  has(CSS, /\.gm-ds\.gm-er\{display:contents\}/, 'השורש לא מצייר רקע/גובה של .gm-ds');
});
await t('אייקונים חדשים בפלטה ובספרייה המוטמעת (בלי more): camera, video, cursor-rec, archive, inbox, sparkles, crosshair, download', () => {
  const ids = new Set(SPRITE_SYMBOLS.map(([id]) => id));
  for (const id of ['camera', 'video', 'cursor-rec', 'archive', 'inbox', 'sparkles', 'crosshair', 'download']) assert.ok(ids.has(id), id);
  const used = new Set([...UI.matchAll(/<Ic n="([a-z0-9-]+)"/g)].map((m) => m[1]).concat([...UI.matchAll(/icon(?:=|: )['"]([a-z0-9-]+)['"]/g)].map((m) => m[1])));
  for (const id of used) assert.ok(ids.has(id), `icon ${id} missing from sprite`);
  const icons = JSON.parse(read('../design-system/icons.json')).icons;
  assert.deepEqual(icons.slice(-8).map((x) => [x.n, x.id]), [[72, 'camera'], [73, 'video'], [74, 'cursor-rec'], [75, 'archive'], [76, 'inbox'], [77, 'sparkles'], [78, 'crosshair'], [80, 'download']]);
  assert.ok(read('../design-system/sprite.svg').includes('79 סמלים'));
});

await t('עמדת לקוחות נעולה (body.hide-global-nav): globals.css מסתיר את הכפתור הצף ואת החלון (שניהם portal ל-body)', () => {
  const G = read('../app/globals.css');
  const m = /((?:body\.hide-global-nav [^,{]+,\s*)*body\.hide-global-nav [^,{]+)\{\s*display:\s*none\s*!important;?\s*\}/.exec(G);
  assert.ok(m, 'חסר כלל ההסתרה של hide-global-nav');
  const sels = m[1].split(',').map((x) => x.trim());
  assert.ok(sels.includes('body.hide-global-nav .gm-er-launch'), 'הכפתור הצף לא מוסתר בעמדת הלקוחות');
  assert.ok(sels.includes('body.hide-global-nav .gm-ds.gm-er'), 'החלון לא מוסתר בעמדת הלקוחות');
  has(BTN, /createPortal\([\s\S]*?className="gm-er-launch"/, 'הכפתור הצף הוא .gm-er-launch');
  has(WIN, /className="gm-ds gm-er dlg-dark"/, 'שורש החלון הוא .gm-ds.gm-er');
});

console.log('כותרת AI (מוכנה, כבויה עד DDL + הגדרה)');
const fakePrisma = (o = {}) => {
  const calls = [];
  return {
    calls,
    $executeRawUnsafe: async (sql, ...args) => { calls.push(['exec', sql, args]); if (o.missing) { const e = new Error('Raw query failed. Code: `42703`. Message: `column "aiTitle" of relation "ErrorReport" does not exist`'); e.code = 'P2010'; e.meta = { code: '42703' }; throw e; } return 1; },
    $queryRawUnsafe: async (sql, ...args) => { calls.push(['query', sql, args]); if (o.missing) { const e = new Error('column "aiTitle" does not exist'); e.code = 'P2010'; e.meta = { code: '42703' }; throw e; } return (o.rows || []); },
  };
};
await t('כבוי כברירת מחדל: בלי ההגדרה אין קריאה ל-Gemini ואין SQL', async () => {
  AI.resetAiTitleColumnState();
  let gen = 0;
  const prisma = fakePrisma();
  const r = await AI.generateAndStoreAiTitle('r1', 'הכפתור נתקע', { prisma, getSetting: async () => null, generate: async () => { gen++; return 'כותרת'; } });
  assert.equal(r, null); assert.equal(gen, 0); assert.equal(prisma.calls.length, 0);
  const list = [{ id: 'r1' }];
  assert.equal(await AI.attachAiTitles(list, { prisma, getSetting: async () => 'false' }), list);
  assert.equal(prisma.calls.length, 0);
  assert.equal(list[0].aiTitle, undefined);
});
await t('פעיל + עמודה קיימת: כותרת נוצרת מהתיאור בלבד (בלי צעדים) ונשמרת ב-SQL גולמי; GET מצרף aiTitle', async () => {
  AI.resetAiTitleColumnState();
  let prompt = '';
  const prisma = fakePrisma({ rows: [{ id: 'r1', aiTitle: 'כפתור שמירה תקוע' }] });
  const r = await AI.generateAndStoreAiTitle('r1', withSteps('לחצתי על שמירה והכפתור נתקע'), { prisma, getSetting: async () => 'true', generate: async (p) => { prompt = p; return '"כפתור שמירה תקוע."'; } });
  assert.equal(r, 'כפתור שמירה תקוע');
  assert.ok(prompt.includes('לחצתי על שמירה') && !prompt.includes('[00:02]'), 'הצעדים לא נשלחים ל-Gemini');
  assert.deepEqual(prisma.calls[0], ['exec', 'UPDATE "ErrorReport" SET "aiTitle" = $1 WHERE "id" = $2', ['כפתור שמירה תקוע', 'r1']]);
  const list = [{ id: 'r1' }, { id: 'r2' }];
  await AI.attachAiTitles(list, { prisma, getSetting: async () => 'true' });
  assert.equal(list[0].aiTitle, 'כפתור שמירה תקוע'); assert.equal(list[1].aiTitle, undefined);
});
await t('פעיל + עמודה חסרה (42703): לא נופל, מחזיר null, ונזכר - בלי שאילתה כושלת חוזרת', async () => {
  AI.resetAiTitleColumnState();
  const prisma = fakePrisma({ missing: true });
  const list = [{ id: 'r1' }];
  assert.equal(await AI.attachAiTitles(list, { prisma, getSetting: async () => 'true' }), list);
  assert.equal(prisma.calls.length, 1);
  assert.equal(AI.isAiTitleColumnKnownMissing(), true);
  await AI.attachAiTitles(list, { prisma, getSetting: async () => 'true' });
  const r = await AI.generateAndStoreAiTitle('r1', 'x', { prisma, getSetting: async () => 'true', generate: async () => 'כותרת' });
  assert.equal(r, null);
  assert.equal(prisma.calls.length, 1, 'נשאל שוב למרות שהעמודה חסרה');
  assert.equal(AI.isMissingColumnError({ code: 'P2021' }), false);
  AI.resetAiTitleColumnState();
});
await t('כשל Gemini / זמן קצוב = null (נשארת הכותרת החלופית); ה-prompt של דיווח שונה מזה של השיחה', async () => {
  AI.resetAiTitleColumnState();
  const prisma = fakePrisma();
  assert.equal(await AI.generateAndStoreAiTitle('r1', 'x', { prisma, getSetting: async () => 'true', generate: async () => { throw new Error('quota'); } }), null);
  assert.equal(prisma.calls.length, 0);
  assert.ok(buildReportTitlePrompt('הכפתור נתקע').includes('דיווח על תקלה'));
  assert.notEqual(buildReportTitlePrompt('a'), buildTitlePrompt('a'));
  assert.equal(await generateChatTitle('שאלה', async (p) => (p.includes('שיחה') ? 'כותרת שיחה' : 'אחר')), 'כותרת שיחה', 'ברירת המחדל לא השתנתה');
});
await t('בלי DDL: אין aiTitle ב-schema.prisma; SQL ממתין (ADD COLUMN IF NOT EXISTS); ה-route משתמש במודול; תיעוד ההפעלה קיים', () => {
  assert.ok(!/aiTitle/.test(SCHEMA), 'aiTitle נוסף לסכימה - כל שאילתה הייתה נופלת בלי העמודה');
  const sql = read('../prisma/migrations-pending/2026-10-04-error-report-ai-title.sql');
  has(sql, /ALTER TABLE "ErrorReport" ADD COLUMN IF NOT EXISTS "aiTitle" TEXT;/, 'SQL');
  assert.ok(!/DROP|ALTER COLUMN|DELETE FROM/i.test(sql.replace(/--.*$/gm, '')), 'SQL לא תוספתי');
  has(ROUTE, /await attachAiTitles\(reports, \{ prisma, getSetting: \(k\) => getCachedSettingValue\(k\) \}\)/, 'GET');
  has(ROUTE, /generateAndStoreAiTitle\(newReport\.id, userText, \{/, 'POST');
  has(ROUTE, /report: aiTitle \? \{ \.\.\.newReport, aiTitle \} : newReport/, 'תשובת POST');
  assert.equal(AI.AI_TITLE_SETTING_KEY, 'error_report_ai_title');
  assert.ok(existsSync(new URL('../docs/error-report-new-design-2026-10-04.md', import.meta.url)), 'docs');
});

console.log(`\n${passed} passed${process.exitCode ? ' — FAILURES above' : ''}`);
