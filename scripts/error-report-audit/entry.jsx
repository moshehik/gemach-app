// החלון האמיתי של "דיווח על שגיאות" (ErrorReportButton -> ErrorReportWindow + errorReport.css + כל ה-CSS הגלובלי של האתר) על דף מדומה,
// עם API מדומה (בלי DB, בלי שרת פיתוח). הנתונים = הנתונים של הסקיצה המאושרת (תצוגות-עיצוב/דיווח-שגיאות-סקיצות-2.html, seed()),
// בצורה של ErrorReport / ErrorReportReply כפי ש-GET /api/error-report מחזיר אותם.
// פרמטרים (?): shell=a5|legacy · role=manager|user|programmer · data=list|many|empty · rec=0|1 (ai_screen_recording_enabled)
//              post=ok|fail|slow|err · bottom=0|1 (error_report_handled_at_bottom) · human=0|1 (error_report_human_button_enabled)
import '../../app/globals.css';
import '../../app/design-overrides.css';
import '../../app/design-system.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ErrorReportButton from '../../app/components/ErrorReportButton.js';
import { A5ShellProvider } from '../../app/components/menu/A5ShellContext.js';
import { MenuSprite } from '../../app/components/menu/menuParts.js';

const P = new URLSearchParams(location.search);
const SHELL = P.get('shell') || 'a5';
const ROLE = P.get('role') || 'manager';
const DATA = P.get('data') || 'list';
const REC = P.get('rec') !== '0';
const POST = P.get('post') || 'ok';
const NOW = Date.now();
const ago = (m) => new Date(NOW - m * 60000).toISOString();
const PROG = ROLE === 'programmer';
const EMP = { firstName: 'שרה', lastName: 'כהן' };
const PROG_EMP = { firstName: 'יוסי', lastName: 'מתכנת' };
const STEPS = '1. [00:02] לחץ על שם פרטי (בדף הפרופיל שלי)\n2. [00:05] הקליד "שרה" ב-שם פרטי\n3. [00:09] לחץ על שמירת פרטים\n4. [00:10] לחץ על שמירת פרטים';
const withSteps = (t) => `${t}\n\n[הפעולות שבוצעו לפני התקלה:\n${STEPS}]`;
const SHOT = '/mock/shot.png';
const PDF = '/mock/doc.pdf?n=' + encodeURIComponent('דוח-שגיאה.pdf');
const TXT = '/mock/doc.txt?n=' + encodeURIComponent('לוג-שגיאה.txt');
let rid = 0;
const rp = (m, text, o = {}) => ({
  id: 'p' + (++rid), errorReportId: '', isProgrammer: o.prog !== false, employeeId: o.prog === false ? 'e1' : (o.bot ? null : 'p1'),
  employee: o.prog === false ? EMP : (o.bot ? null : PROG_EMP), text, isQuestion: !!o.q,
  attachmentUrls: o.atts ? JSON.stringify(o.atts) : null, hasSketch: !!o.sketch, sketchStatus: o.sketch || null, previewUrl: o.preview ? 'https://preview.example/fix' : null, createdAt: ago(m),
});
const mk = (id, aiTitle, text, m, o = {}) => ({
  id, employeeId: 'e1', employee: EMP, time: '', url: 'http://127.0.0.1/profile', title: o.page || 'הפרופיל שלי', queryParams: 'אין', lastButtons: JSON.stringify(['שמירת פרטים']),
  userText: text, attachmentUrls: o.atts ? JSON.stringify(o.atts) : null, status: o.archived ? 'ARCHIVED' : 'OPEN',
  isReadByUser: !o.unread, isReadByProgrammer: PROG ? !o.unread : true, isHandled: !!o.handled, needsHuman: !!o.human,
  createdAt: ago(m + 30), updatedAt: ago(m), replies: o.replies || [], ...(aiTitle ? { aiTitle } : {}),
});
function longThread() {
  const t = [];
  const P1 = ['קיבלתי, בודק את הנושא.', 'מצאתי חלק מהבעיה, ממשיך לחקור.', 'הכנתי תיקון ראשוני, אפשר לנסות?', 'התיקון עלה לגרסה זמנית.', 'שיפרתי את הטיפול בשגיאה.', 'סיימתי, אפשר לבדוק שוב.', 'עלה לאתר.'];
  const U1 = ['הפעם זה קרה גם בהזמנה אחרת.', 'ניסיתי עכשיו, עדיין תקוע.', 'עכשיו עובד, תודה.', 'ראיתי הודעה אדומה, מצרפת צילום.', 'בדקתי ועובד.', 'אפשר לסגור.', 'תודה רבה, הכול תקין.'];
  for (let i = 0; i < 14; i++) {
    const prog = i % 2 === 0;
    t.push(rp(7800 - i * 540, prog ? P1[(i / 2) | 0] : U1[((i - 1) / 2) | 0], { prog, bot: prog && i < 4, q: i === 4, atts: i === 3 ? [SHOT, SHOT] : (i === 7 ? [TXT] : null), preview: i === 6 }));
  }
  return mk('rL', 'שמירת הזמנה נכשלת עם הודעה אדומה', withSteps('בכל פעם שאני שומרת הזמנה עם שלוש שמלות מופיעה הודעה אדומה והדף קופא. קורה רק בהזמנות גדולות.'), 480, { page: 'כרטיס הזמנה', atts: [SHOT, SHOT, PDF], unread: true, replies: t });
}
function seed() {
  if (DATA === 'empty') return [];
  const R = [
    mk('r1', 'כפתור שמירת פרטים תקוע', withSteps('לחצתי על "שמירת פרטים" והכפתור נשאר תקוע, בלי שום הודעה. ניסיתי פעמיים.'), 22, { unread: true, atts: [SHOT, PDF], replies: [rp(22, 'מצאתי את הסיבה ותיקנתי. אפשר לבדוק בגרסה זמנית לפני שזה עולה לאתר.', { bot: true, preview: true })] }),
    mk('r2', 'הזמנות כפולות בלוח החודשי', 'בלוח החודשי ההזמנות של יום שישי מופיעות פעמיים.', 190, { page: 'לוח חודשי', atts: [SHOT], replies: [rp(220, 'הכנתי סקיצה של איך זה אמור להיראות. נא לאשר או לדחות.', { bot: true, sketch: 'PENDING' }), rp(190, 'באיזה דפדפן זה קורה לך? בנייד או במחשב?', { q: true })] }),
    mk('r3', 'תשלום לא נרשם אחרי אישור', 'התשלום לא נרשם אחרי שאישרתי, אבל הכסף ירד ללקוחה.', 1500, { page: 'כרטיס הזמנה', human: true, replies: [rp(1490, 'לא הצלחתי לשחזר את התקלה. אפשר לצרף תמונת מסך של הלקוחה?', { bot: true })] }),
    mk('r4', 'חיפוש טלפון עם מקף לא עובד', 'חיפוש לפי טלפון לא מוצא לקוחות עם מקף במספר.', 3000, { page: 'רשימת לקוחות', handled: true, replies: [rp(2900, 'תוקן. החיפוש מתעלם ממקפים.', { sketch: 'APPROVED' })] }),
    mk('r5', 'תמונת פרופיל לא נטענת', 'אחרי שמירה של תמונת פרופיל היא נעלמת עד שמרעננים את הדף.', 5800, { handled: true, replies: [rp(5700, 'תוקן ועלה לאתר.', { bot: true })] }),
    mk('r6', 'מידה חסרה בבדיקת מלאי', 'בבדיקת מלאי מידה 38 לא מופיעה לדגם שיש לנו.', 9000, { page: 'בדיקת מלאי' }),
    mk('r7', 'שעות משמרת חסרות ביום ראשון', 'שעות המשמרת לא מוצגות בלוז של יום ראשון.', 20000, { page: 'לוז יומי', handled: true }),
    mk('a1', 'כפתור ההדפסה לא פעיל', 'כפתור ההדפסה לא פעיל אחרי שמירה.', 60000, { archived: true, handled: true, page: 'הזמנה חדשה', replies: [rp(59900, 'תוקן ועלה לאתר.', { bot: true })] }),
    mk('a2', 'זיכוי לא מתעדכן בסיכום', 'סכום הזיכוי לא מתעדכן בסיכום ההזמנה.', 90000, { archived: true, handled: true }),
    longThread(),
  ];
  if (DATA === 'many') {
    const T = [['תאריך אירוע מוצג שגוי', 'התאריך העברי של האירוע מוצג יום אחד אחרי.'], ['מייל מהיר לא נשלח', 'לחצתי על שלח מייל והמסך קפא.'], ['חיפוש לקוח איטי', 'החיפוש בלקוחות לוקח יותר מ-10 שניות.'], ['טבלת שמלות נחתכת בנייד', 'בטלפון הטבלה נחתכת מצד שמאל.'], ['הלוז לא מתרענן', 'צריך לרענן ידנית כדי לראות שינויים.'], ['כרטיס עובד לא נפתח', 'לחיצה על שם עובד לא פותחת את הכרטיס.'], ['קוד כניסה לא מתקבל', 'הקוד הקצר לא מתקבל בעמדה בחנות.'], ['צבע כפתור משתנה בריחוף', 'הכפתור הזהוב נעלם כשעוברים עליו עם העכבר.'], ['מחיר לא מתעדכן אחרי החלפת דגם', 'החלפתי דגם והסכום נשאר כמו קודם.'], ['דף הבית נטען לאט', 'בבוקר דף הבית לוקח זמן להיטען.'], ['הודעה למנהל לא מגיעה', 'שלחתי הודעה למנהל ואין סימן שהיא התקבלה.'], ['לוח חודשי חסר ימים', 'בלוח החודשי חסרים הימים האחרונים של החודש.'], ['תיקון לא נשמר', 'סימנתי תיקון כבוצע וזה חזר למצב הקודם.'], ['שם לקוחה מוצג הפוך', 'שם עם גרשיים מוצג הפוך בהדפסה.'], ['הרשאות עובד שגויות', 'עובדת חדשה רואה מסכים שאסור לה.']];
    T.forEach((t, i) => R.push(mk('m' + i, t[0], t[1], 25000 + i * 2400, { handled: i % 3 === 0, replies: i % 2 ? [rp(24000 + i * 2400, 'בדקתי, מטפל בזה.', { bot: true })] : [] })));
  }
  if (P.get('agentlog') === '1') R.push(mk('log', null, 'יומן הסוכן האוטומטי', 5, { page: '🤖 יומן הסוכן האוטומטי (נא לא למחוק)' }));
  for (const r of R) { if (r.title === undefined) r.title = 'הפרופיל שלי'; for (const x of r.replies) x.errorReportId = r.id; }
  return R;
}
// שיתוף מסך מדומה (headless): קנבס מצויר במקום getDisplayMedia, כדי שההסרטה האמיתית (useScreenRecorder + MediaRecorder) תרוץ
if (navigator.mediaDevices) {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 100;
    const g = c.getContext('2d'); let k = 0;
    setInterval(() => { g.fillStyle = k++ % 2 ? '#0f2c52' : '#c9a227'; g.fillRect(0, 0, 160, 100); }, 100);
    return c.captureStream(10);
  };
}
const DB = { reports: seed(), fixLoop: { enabled: P.get('agent') === '1', deployEnabled: true } };
if (P.get('agentlog') === '1') { const l = DB.reports.find((r) => r.id === 'log'); l.title = '🤖 יומן הסוכן האוטומטי (נא לא למחוק)'; }
const sorted = () => [...DB.reports].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
window.__calls = [];
window.__db = DB;
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!u.startsWith('/api/')) return realFetch(url, opts);
  const method = (opts.method || 'GET').toUpperCase();
  let body = null;
  try { body = opts.body ? JSON.parse(opts.body) : null; } catch { body = opts.body; }
  window.__calls.push({ url: u, method, body });
  await new Promise((r) => setTimeout(r, 25));
  // הסרטת מסך (ר' lib/uploadScreenRecording.js): פתיחת העלאה + PUT לכתובת שהשרת החזיר (כאן מדומה, איטי כדי לראות "מעלה...")
  if (u === '/api/ai/recording/init') return j({ sessionUri: '/api/mock-drive-upload' });
  if (u === '/api/mock-drive-upload') { await new Promise((r) => setTimeout(r, 1500)); return j({ id: 'DRIVE123' }); }
  if (u.startsWith('/api/settings')) {
    return j([
      { key: 'ai_screen_recording_enabled', value: REC ? 'true' : 'false' },
      { key: 'error_report_handled_at_bottom', value: P.get('bottom') === '1' ? 'true' : 'false' },
      { key: 'error_report_human_button_enabled', value: P.get('human') === '0' ? 'false' : 'true' },
    ]);
  }
  if (u.startsWith('/api/agent/fix-loop')) {
    if (!PROG) return j({ success: false, error: 'אין הרשאה' }, 403);
    if (method === 'PATCH') Object.assign(DB.fixLoop, body);
    return j({ success: true, ...DB.fixLoop });
  }
  if (u === '/api/error-report/reply' && method === 'POST') {
    const r = DB.reports.find((x) => x.id === body.reportId);
    if (!r || !body.text) return j({ success: false, error: 'חסרים נתונים לשמירה' }, 400);
    const reply = { id: 'p' + (++rid), errorReportId: r.id, isProgrammer: PROG, employeeId: PROG ? 'p1' : 'e1', employee: PROG ? PROG_EMP : EMP, text: body.text, isQuestion: !!body.isQuestion, attachmentUrls: (body.attachments || []).length ? JSON.stringify(body.attachments.map((a, i) => (typeof a === 'string' && a.startsWith('gdrive:') ? a : SHOT + '?up=' + i))) : null, hasSketch: false, sketchStatus: null, previewUrl: null, createdAt: new Date().toISOString() };
    r.replies.push(reply); r.updatedAt = reply.createdAt; r.isReadByUser = !PROG; r.isReadByProgrammer = PROG; if (PROG) r.needsHuman = false;
    return j({ success: true, reply });
  }
  if (u === '/api/error-report/sketch-decision' && method === 'POST') {
    const r = DB.reports.find((x) => x.replies.some((y) => y.id === body.replyId));
    const rep = r && r.replies.find((y) => y.id === body.replyId);
    if (!rep || rep.sketchStatus !== 'PENDING') return j({ success: false, error: 'כבר התקבלה החלטה על הסקיצה הזו' }, 409);
    rep.sketchStatus = body.decision;
    const text = body.decision === 'APPROVED' ? '✅ הסקיצה אושרה - אפשר להתקדם עם התיקון.' : `❌ הסקיצה נדחתה.${body.note ? `\n${body.note}` : ''}`;
    const reply = { id: 'p' + (++rid), errorReportId: r.id, isProgrammer: PROG, employeeId: 'e1', employee: EMP, text, isQuestion: false, attachmentUrls: null, hasSketch: false, sketchStatus: null, previewUrl: null, createdAt: new Date().toISOString() };
    r.replies.push(reply);
    return j({ success: true, sketchStatus: body.decision, reply });
  }
  if (u.startsWith('/api/error-report')) {
    if (method === 'GET') {
      if (P.get('auth') === '0') return j({ success: false, error: 'לא מורשה' }, 401);
      const light = u.includes('light=1');
      const list = sorted().map((r) => (light ? { id: r.id, status: r.status, isReadByProgrammer: r.isReadByProgrammer, isReadByUser: r.isReadByUser } : JSON.parse(JSON.stringify(r))));
      return j({ success: true, reports: list, isProgrammer: PROG, isManager: ROLE !== 'user' });
    }
    if (method === 'POST') {
      if (ROLE === 'user') return j({ success: false, error: 'יצירת דיווח חדש מותרת למנהלים בלבד' }, 403);
      if (POST === 'fail') throw new TypeError('Failed to fetch');
      if (POST === 'slow') await new Promise((r) => setTimeout(r, 60000));
      if (POST === 'err') return j({ success: false, error: 'שגיאה בשליחת דיווח' }, 500);
      if (!body.userText) return j({ success: false, error: 'יש להזין תיאור שגיאה' }, 400);
      const r = mk('n' + (++rid), P.get('aititle') === '1' ? 'כפתור השמירה לא מגיב' : null, body.userText, 0, { atts: (body.attachments || []).length ? body.attachments.map(() => SHOT) : null });
      r.isReadByProgrammer = false; r.title = body.title; r.url = body.url;
      DB.reports.push(r);
      return j({ success: true, report: { ...r, replies: undefined, employee: undefined } });
    }
    if (method === 'PATCH') {
      const r = DB.reports.find((x) => x.id === body.reportId);
      if (!r) return j({ success: false, error: 'הדיווח לא נמצא' }, 404);
      for (const k of ['status', 'isHandled', 'isReadByUser', 'isReadByProgrammer', 'needsHuman']) if (body[k] !== undefined) r[k] = body[k];
      return j({ success: true, report: { ...r } });
    }
  }
  return j({});
};

function Page() {
  const trigger = ({ onOpen, unreadCount }) => (
    <button type="button" className="sn-ib" id="snErr" data-sn-err aria-haspopup="dialog" aria-label="דיווח על שגיאה" onClick={onOpen}>
      <svg className="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="1.8"><use href="#gmi-sn-bug" /></svg>
      {unreadCount > 0 && <span className="sn-badge">{unreadCount}</span>}
    </button>
  );
  const page = (
    <main className="er-mock-page">
      <h1>הפרופיל שלי</h1>
      <label htmlFor="firstName">שם פרטי</label>
      <input id="firstName" name="firstName" defaultValue="שרה" />
      <button type="button" id="pfSave" className="btn primary">שמירת פרטים</button>
      <button type="button" id="other">כפתור אחר</button>
    </main>
  );
  if (SHELL === 'legacy') {
    return (
      <>
        <div className="er-mock-bar legacy"><div className="topbar-icon-cluster"><ErrorReportButton /></div></div>
        {page}
      </>
    );
  }
  return (
    <A5ShellProvider value={{ menuTree: {} }}>
      <MenuSprite />
      <div className="er-mock-bar a5"><ErrorReportButton trigger={trigger} /></div>
      {page}
    </A5ShellProvider>
  );
}
createRoot(document.getElementById('root')).render(<Page />);
