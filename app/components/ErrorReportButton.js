'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { captureElement, captureViewport } from '../../lib/clientCapture';
import useElementPicker, { describeElement, ElementPickerOverlay } from './useElementPicker';
import useActionRecorder from './useActionRecorder';
import useScreenRecorder from './useScreenRecorder';
import { uploadScreenRecording, prepareScreenRecordingUpload } from '../../lib/uploadScreenRecording';
import { formatActionSteps, appendStepsToReport, splitReportSteps, stepsCountLabel } from '../../lib/actionRecorderCore';

// כותרת קבועה לזיהוי שרשור "יומן הסוכן האוטומטי" (ר' scripts/agent-log-report.js -
// חייבת להישאר זהה בשני המקומות, אין שדה ייעודי בסכימה בכוונה כדי לא לדרוש migration).
const AGENT_LOG_TITLE = '🤖 יומן הסוכן האוטומטי (נא לא למחוק)';

// attachmentUrls מאוחסן כמערך JSON של כתובות (צילומי מסך/אלמנטים) — מוצג כגלריה עם כותרת
// וספירה. כתובת שנשברה (למשל צילום ישן מחנות ה-Blob שנמחקה) מוצגת כתיבה ברורה במקום
// אייקון תמונה שבורה.
function AttachmentThumb({ url, index }) {
  const [broken, setBroken] = useState(false);
  const driveId = url.startsWith('gdrive:') ? url.slice(7) : null;
  const isVideo = Boolean(driveId) || /\.(webm|mp4)$/i.test(url);
  const box = { width: 96, height: 96, borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 };
  if (broken) {
    return (
      <div title="הקובץ אינו זמין יותר" style={{ ...box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--surface-alt)', color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 6 }}>
        <svg className="icon" style={{ width: 18, height: 18 }}><use href="#i-alert-circle" /></svg>
        הקובץ אינו זמין יותר
      </div>
    );
  }
  if (driveId) {
    // הסרטת מסך שנשמרה בדרייב (ר' lib/driveBridgeServer.js) — מושמעת דרך השרת, כי הקובץ פרטי
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <video src={`/api/recordings/${driveId}`} controls preload="metadata" onError={() => setBroken(true)} style={{ width: 260, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', background: '#000' }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>הסרטת מסך</span>
      </div>
    );
  }
  if (isVideo) {
    return <video src={url} controls onError={() => setBroken(true)} style={{ ...box, width: 170, objectFit: 'cover' }} />;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title="לחץ לפתיחה בגודל מלא" style={{ display: 'block', flexShrink: 0 }}>
      <img src={url} alt={`צילום מצורף ${index + 1}`} onError={() => setBroken(true)} style={{ ...box, objectFit: 'cover', display: 'block' }} />
    </a>
  );
}

function AttachmentGallery({ attachmentUrls }) {
  let urls = [];
  try {
    urls = attachmentUrls ? JSON.parse(attachmentUrls) : [];
  } catch (e) {
    return null;
  }
  if (!Array.isArray(urls) || urls.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>
        <svg className="icon" style={{ width: 13, height: 13 }}><use href="#i-grid" /></svg>
        צרופות ({urls.length}) · לחיצה על תמונה פותחת אותה בגודל מלא
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {urls.map((url, idx) => <AttachmentThumb key={idx} url={url} index={idx} />)}
      </div>
    </div>
  );
}

// טקסט הדיווח, כשהפעולות שהמשתמש הקליט (ר' useActionRecorder) מוצגות כרשימה מקופלת
// ממוספרת במקום שורות גולמיות בתוך הטקסט.
function ReportText({ text }) {
  const { body, steps } = splitReportSteps(text);
  return (
    <>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{body}</p>
      {steps.length > 0 && (
        <details style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-alt)' }}>
          <summary style={{ cursor: 'pointer', padding: '8px 12px', fontWeight: 600, fontSize: 13 }}>
            הפעולות שבוצעו לפני התקלה ({stepsCountLabel(steps.length)})
          </summary>
          <ol style={{ margin: 0, padding: '4px 30px 10px', fontSize: 12.5, lineHeight: 1.7 }}>
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </details>
      )}
    </>
  );
}

export default function ErrorReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'archive' or 'new' or 'thread'
  const [userText, setUserText] = useState('');
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [reports, setReports] = useState([]);
  const [isProgrammer, setIsProgrammer] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // error_report_handled_at_bottom (הגדרות > תצוגה) - פניות שסומנו "טופל" יורדות
  // לתחתית רשימת הפתוחות, כדי שפניות חדשות/לא-מטופלות יבלטו למעלה. ברירת מחדל
  // true כשהשורה עוד לא נוצרה ב-DB.
  const [handledAtBottom, setHandledAtBottom] = useState(true);
  // error_report_human_button_enabled (הגדרות > תצוגה) - האם להציג בכלל את כפתור
  // "אוף! אני צריך מענה אנושי!" בתוך שרשור. ברירת מחדל true כשהשורה עוד לא נוצרה ב-DB.
  const [humanButtonEnabled, setHumanButtonEnabled] = useState(true);
  const [isRequestingHuman, setIsRequestingHuman] = useState(false);

  const [selectedReport, setSelectedReport] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyIsQuestion, setReplyIsQuestion] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  // סוכן תיקון אוטומטי - אייקון למתכנת בלבד, מפעיל/מכבה את ה-workflow ב-GitHub
  // Actions שבודק דיווחים פתוחים כל 5 דק' ומתקן קוד (ר' .github/workflows/claude-fix-reports.yml).
  const [agentLoopEnabled, setAgentLoopEnabled] = useState(false);
  const [agentLoopBusy, setAgentLoopBusy] = useState(false);
  // דגל נפרד (2026-09-23): האם מותר לסוכן לפתוח ענף+PR (=פריסת Vercel אוטומטית לכל
  // push). כשכבוי - הסוכן ממשיך לרוץ ולהשיב בשרשורים כרגיל, פשוט לא נוגע ב-git.
  // ברירת מחדל true עד שנטען המצב האמיתי מהשרת, כדי לא להבהב "כבוי" לרגע.
  const [deployEnabled, setDeployEnabled] = useState(true);
  const [deployBusy, setDeployBusy] = useState(false);

  // שימור מיקום הגלילה ברשימת הפניות/ארכיון: כשפותחים פנייה (thread) וחוזרים
  // חזרה, הרשימה נטענת/מוצגת מחדש ובלי זה הגלילה הייתה קופצת לראש בכל פעם.
  const listScrollRef = useRef(null);
  const scrollPositions = useRef({ list: 0, archive: 0 });

  // סימון אלמנט בעמוד — "מצב איתור" (useElementPicker.js, משותף גם עם
  // AIFloatingWidget): כל קליק בעמוד נחסם ונאסף כתיאור האלמנט + צילום קרופ שלו,
  // במקום להפעיל את הפעולה האמיתית שלו.
  const [pickedElements, setPickedElements] = useState([]);
  // תמונות ממתינות לצירוף - גם קרופ של אלמנט שסומן וגם "צלם את כל המסך".
  // מופרד לפי הקשר ('new'/'reply') כמו pickingContextRef.
  const [newAttachments, setNewAttachments] = useState([]);
  const [replyAttachments, setReplyAttachments] = useState([]);

  // "הקלט את הפעולות שלי" — מקליט פעולות (לחיצות/הקלדות/ניווט) בלי וידאו ובלי הרשאת שיתוף מסך.
  // המודל נסגר, המשתמש משחזר את התקלה, ולוחץ "סיום" בסרגל הצף; הצעדים מתווספים לדיווח.
  const actionRecorder = useActionRecorder();
  const [isRecordingSteps, setIsRecordingSteps] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [recordedSteps, setRecordedSteps] = useState('');
  // 'new' = טופס דיווח חדש (pickedElements, כמו קודם), 'reply' = תגובה בתוך
  // שרשור קיים (מוסיף ישירות לטקסט התגובה) - כדי שאיתור אלמנטים יעבוד גם
  // כשעונים על דיווח פתוח, לא רק בהודעה הראשונה.
  const pickingContextRef = useRef('new');

  const handleElementPicked = async (el) => {
    const described = describeElement(el);
    const capture = await captureElement(el);
    if (pickingContextRef.current === 'reply') {
      if (described) setReplyText(prev => `${prev ? prev + ' ' : ''}[אלמנט מסומן: ${described.label}]`);
      if (capture) setReplyAttachments(prev => [...prev, capture.dataUrl]);
      setIsOpen(true);
      setActiveTab('thread');
    } else {
      if (described) setPickedElements(prev => [...prev, described]);
      if (capture) setNewAttachments(prev => [...prev, capture.dataUrl]);
      setIsOpen(true);
      setActiveTab('new');
    }
  };
  const picker = useElementPicker(handleElementPicked);

  // "הסרטת מסך" (וידאו + פעולות) — זמינה כשההגדרה ai_screen_recording_enabled פעילה. הוידאו עולה ישר לדרייב
  // ונשמר בדיווח כמזהה "gdrive:<fileId>"; הפעולות נכתבות לטקסט הדיווח. "הקלט את הפעולות שלי" — בלי וידאו.
  const screenRecorder = useScreenRecorder();
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [recordingMode, setRecordingMode] = useState('steps'); // 'steps' | 'video'
  const [videoUploading, setVideoUploading] = useState(false);
  const [replySteps, setReplySteps] = useState('');

  const setStepsFor = (context, text) => (context === 'reply' ? setReplySteps(text) : setRecordedSteps(text));
  const addAttachmentFor = (context, value) => (context === 'reply' ? setReplyAttachments(prev => [...prev, value]) : setNewAttachments(prev => [...prev, value]));

  const startStepsRecording = (context = 'new') => {
    pickingContextRef.current = context;
    setIsOpen(false);
    setStepCount(0);
    setRecordingMode('steps');
    setIsRecordingSteps(true);
    actionRecorder.start();
  };

  const finishStepsRecording = () => {
    const context = pickingContextRef.current;
    const text = formatActionSteps(actionRecorder.stop());
    setIsRecordingSteps(false);
    setStepsFor(context, text);
    setIsOpen(true);
    setActiveTab(context === 'reply' ? 'thread' : 'new');
    if (!text) showToast('לא נרשמו פעולות — נסה שוב', 'info');
  };

  const startVideoRecording = async (context = 'new') => {
    pickingContextRef.current = context;
    setIsOpen(false);
    setStepCount(0);
    setRecordingMode('video');
    setIsRecordingSteps(true);
    actionRecorder.start();
    // פותחים את ההעלאה לדרייב כבר עכשיו — הפנייה לגשר איטית, וכך היא רצה בזמן ההסרטה
    const prepared = prepareScreenRecordingUpload('error-report');
    prepared.catch(() => {});
    const blob = await screenRecorder.start();
    const text = formatActionSteps(actionRecorder.stop());
    setIsRecordingSteps(false);
    setIsOpen(true);
    setActiveTab(context === 'reply' ? 'thread' : 'new');
    if (text) setStepsFor(context, text);
    if (!blob) {
      showToast(text ? 'ההסרטה נעצרה — הפעולות נשמרו, בלי וידאו' : 'ההסרטה בוטלה', 'info');
      return;
    }
    setVideoUploading(true);
    try {
      const fileId = await uploadScreenRecording(blob, prepared, 'error-report');
      addAttachmentFor(context, `gdrive:${fileId}`);
    } catch (err) {
      if (err.code !== 'DRIVE_NOT_CONFIGURED') console.error('Failed to upload screen recording:', err);
      showToast(text ? 'העלאת הוידאו נכשלה — הפעולות נשמרו' : 'העלאת ההסרטה נכשלה', 'error');
    } finally {
      setVideoUploading(false);
    }
  };

  // סיום מהסרגל הצף: בהסרטת מסך עוצרים את ההקלטה (ההמשך רץ ב-startVideoRecording), אחרת מסיימים רישום פעולות
  const finishRecording = () => {
    if (recordingMode === 'video') screenRecorder.stop();
    else finishStepsRecording();
  };

  useEffect(() => {
    if (!isRecordingSteps) return undefined;
    const id = setInterval(() => setStepCount(actionRecorder.getCount()), 400);
    return () => clearInterval(id);
  }, [isRecordingSteps, actionRecorder]);

  const captureFullScreen = async (context = 'new') => {
    pickingContextRef.current = context;
    setIsOpen(false);
    // לתת למודל לסיים להיסגר לפני הצילום, כדי שהוא לא ייכנס לתמונה עצמה.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const capture = await captureViewport();
    setIsOpen(true);
    setActiveTab(context === 'reply' ? 'thread' : 'new');
    if (!capture) {
      showToast('צילום המסך נכשל', 'error');
      return;
    }
    if (context === 'reply') setReplyAttachments(prev => [...prev, capture.dataUrl]);
    else setNewAttachments(prev => [...prev, capture.dataUrl]);
  };

  // אין משתמש מחובר (עמדת לקוחות, דפי הדפסה) - הבקשה תמיד תחזיר 401, אז אחרי
  // הפעם הראשונה מפסיקים לגמרי כדי לא להציף את הקונסול כל 30 שניות.
  const authFailedRef = useRef(false);
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    let intervalId;
    // Background/minimized tabs polled forever at 30s - pause while hidden so an
    // idle tab doesn't keep hitting the API all day, and catch up immediately
    // when the tab regains focus instead of waiting for the next tick.
    const start = () => {
      if (intervalId) return;
      // הפאנל סגור בזמן הטיק הזה (start נקרא רק מתוך התנאי !isOpen למטה) - מספיק
      // fetch קליל, ר' ההערה על ?light=1 ליד fetchReports.
      // 120 שנ' (היה 30): כל טיק הוא invocation מלא + שאילתת DB גם ב-light, ועל תוכנית Free
      // (מכסת invocations ב-Vercel + 5GB תעבורה ב-Neon) עם כמה טאבים פתוחים זה הצטבר. ר' docs/vercel-resource-audit-2026-09-20.md.
      intervalId = setInterval(() => fetchReports({ light: true }), 120000);
    };
    const stop = () => {
      clearInterval(intervalId);
      intervalId = undefined;
    };
    const handleVisibility = () => {
      if (!mounted || isOpen) return;
      if (document.hidden) {
        stop();
      } else {
        fetchReports({ light: true });
        start();
      }
    };
    if (mounted && !isOpen && !document.hidden) start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mounted, isOpen]);

  useEffect(() => {
    setMounted(true);
    // הפאנל סגור בטעינה הראשונית - רק מונה/נקודה אדומה, ר' ההערה ליד fetchReports.
    fetchReports({ light: true });

    const handleGlobalClick = (e) => {
      let target = e.target;
      while (target && target !== document.body) {
        if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button' || (target.tagName === 'A' && (target.classList?.contains('btn') || target.classList?.contains('button')))) {
          let btnText = target.innerText || target.textContent || target.title || target.getAttribute('aria-label') || 'כפתור ללא טקסט';
          btnText = btnText.trim().substring(0, 50).replace(/\n/g, ' ');
          if (btnText) {
            window.__lastButtons = window.__lastButtons || [];
            window.__lastButtons.push(btnText);
            if (window.__lastButtons.length > 5) {
              window.__lastButtons.shift();
            }
          }
          break;
        }
        target = target.parentElement;
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    if (isOpen && (activeTab === 'list' || activeTab === 'archive')) {
      fetchReports();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isProgrammer) fetchAgentLoopStatus();
  }, [isProgrammer]);

  // משחזר את מיקום הגלילה שנשמר לכל טאב (רשימה/ארכיון) בכל פעם שחוזרים אליו -
  // למשל אחרי סגירת פנייה בודדת (thread) וחזרה לרשימה.
  useEffect(() => {
    if ((activeTab === 'list' || activeTab === 'archive') && listScrollRef.current) {
      listScrollRef.current.scrollTop = scrollPositions.current[activeTab] || 0;
    }
  }, [activeTab]);

  const startPicking = (context = 'new') => {
    pickingContextRef.current = context;
    setIsOpen(false);
    picker.startPicking();
  };

  // { light: true } - שימוש בבדיקת הרקע כל 30 שנ' (טאב פתוח, פאנל סגור) בלבד:
  // מביא רק את השדות הדרושים לחישוב unreadCount/הנקודה האדומה, לא את כל הדיווחים
  // עם כל התגובות המקוננות - זו הייתה כמות תעבורת הנתונים הדומיננטית מול נאון
  // (ר' תיעוד docs/neon-quota-error-report-poll-2026-09-17.md). כל קריאה שקורית
  // בזמן שהפאנל *פתוח* (פתיחה, רענון ידני, תגובה, סימון טופל וכו') נשארת מלאה
  // כרגיל - שם באמת צריך title/userText/attachmentUrls/replies לרשימה ולחיפוש.
  async function fetchReports({ light = false } = {}) {
    if (authFailedRef.current) return;
    // תוצאה של בקשה ישנה לא דורסת בקשה שהתחילה אחריה: קריאת ה-light שנשלחת בטעינה עלולה להסתיים אחרי הקריאה המלאה
    // של פתיחת הפאנל, ואז הרשימה מתרוקנת לשורות בלי שם/תאריך/טקסט (נראה בסביבת פיתוח איטית).
    const seq = ++fetchSeqRef.current;
    try {
      const res = await fetch(light ? '/api/error-report?light=1' : '/api/error-report');
      if (res.status === 401) {
        authFailedRef.current = true;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (seq !== fetchSeqRef.current) return;
        if (data.success) {
          setReports(data.reports || []);
          setIsProgrammer(data.isProgrammer || false);
          setIsManager(data.isManager ?? data.isProgrammer ?? false);
        }
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  }

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const s = data.find(x => x.key === 'error_report_handled_at_bottom');
        if (s) setHandledAtBottom(s.value !== 'false');
        const h = data.find(x => x.key === 'error_report_human_button_enabled');
        if (h) setHumanButtonEnabled(h.value !== 'false');
        const rec = data.find(x => x.key === 'ai_screen_recording_enabled');
        setRecordingEnabled(rec?.value === 'true');
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isManager && !isProgrammer) {
      showToast('יצירת דיווח חדש מותרת למנהלים בלבד', 'error');
      return;
    }
    if (!userText.trim()) {
      showToast('יש להזין תיאור שגיאה', 'error');
      return;
    }
    if (videoUploading) {
      showToast('ההסרטה עדיין עולה — נא להמתין רגע', 'info');
      return;
    }

    showToast('שולח דיווח למתכנת, אנא המתן...', 'info');

    const fullText = pickedElements.length > 0
      ? `${userText}\n\n[אלמנטים מסומנים:\n${pickedElements.map((el, i) => `${i + 1}. ${el.label}`).join('\n')}]`
      : userText;
    const reportText = appendStepsToReport(fullText, recordedSteps);

    const payload = {
      userText: reportText,
      url: window.location.href,
      title: document.title,
      time: getHebrewDateString(new Date()) + ' ' + new Date().toLocaleTimeString('he-IL'),
      queryParams: window.location.search || 'אין',
      lastButtons: window.__lastButtons || [],
      attachments: newAttachments,
    };

    try {
      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('הדיווח נשלח בהצלחה למתכנת! תודה.', 'success');
        setUserText('');
        setPickedElements([]);
        setNewAttachments([]);
        setRecordedSteps('');
        setActiveTab('list');
        fetchReports();
      } else {
        showToast(data.error || 'שגיאה בשליחת דיווח', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedReport) return;
    if (videoUploading) {
      showToast('ההסרטה עדיין עולה — נא להמתין רגע', 'info');
      return;
    }

    setIsReplying(true);
    try {
      const res = await fetch('/api/error-report/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport.id, text: appendStepsToReport(replyText, replySteps), isQuestion: replyIsQuestion, attachments: replyAttachments }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReplyText('');
        setReplyIsQuestion(false);
        setReplyAttachments([]);
        setReplySteps('');
        setSelectedReport(prev => ({ ...prev, replies: [...prev.replies, data.reply] }));
        fetchReports();
      } else {
        showToast(data.error || 'שגיאה בשליחת תגובה', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  const setReportStatus = async (report, status) => {
    try {
      const res = await fetch('/api/error-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReports(prev => prev.map(r => r.id === report.id ? { ...r, status } : r));
        if (selectedReport?.id === report.id) {
          setSelectedReport(prev => ({ ...prev, status }));
        }
        showToast(status === 'ARCHIVED' ? 'הדיווח הועבר לארכיון' : 'הדיווח שוחזר מהארכיון', 'success');
      } else {
        showToast(data.error || 'שגיאה בעדכון הדיווח', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    }
  };

  // מסמן/מבטל סימון "טופל" - עצמאי לגמרי מהעברה לארכיון, נועד רק להבחין
  // ויזואלית ברשימה בין פניות שכבר טופלו לכאלה שעדיין לא, כדי למנוע פתיחות
  // חוזרות ונשנות של פניות שכבר נענו.
  const toggleHandled = async (report) => {
    const newHandled = !report.isHandled;
    try {
      const res = await fetch('/api/error-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, isHandled: newHandled }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReports(prev => prev.map(r => r.id === report.id ? { ...r, isHandled: newHandled } : r));
        if (selectedReport?.id === report.id) {
          setSelectedReport(prev => ({ ...prev, isHandled: newHandled }));
        }
        showToast(newHandled ? 'הפנייה סומנה כטופלה' : 'סימון "טופל" הוסר', 'success');
      } else {
        showToast(data.error || 'שגיאה בעדכון הדיווח', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    }
  };

  const copyDetails = (report) => {
    const details = `
מאת: ${report.employee ? report.employee.firstName + ' ' + report.employee.lastName : 'לא ידוע'}
זמן: ${report.time || (getHebrewDateString(report.createdAt) + ' ' + new Date(report.createdAt).toLocaleTimeString('he-IL'))}
חלון/דף: ${report.title || 'לא צוין'}
כתובת URL: ${report.url || 'לא צוין'}
שאילתות/פרמטרים: ${report.queryParams || 'אין'}
תיאור התקלה:
${report.userText}

לחצנים אחרונים:
${report.lastButtons ? (Array.isArray(JSON.parse(report.lastButtons)) ? JSON.parse(report.lastButtons).map((b, i) => `${i + 1}. ${b}`).join('\n') : report.lastButtons) : 'אין מידע'}
    `.trim();

    navigator.clipboard.writeText(details).then(() => {
      showToast('הפרטים הועתקו ללוח!', 'success');
    });
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  async function fetchAgentLoopStatus() {
    try {
      const res = await fetch('/api/agent/fix-loop');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setAgentLoopEnabled(!!data.enabled);
        setDeployEnabled(data.deployEnabled !== false);
      }
    } catch (err) {
      console.error('Error fetching agent loop status:', err);
    }
  }

  const toggleAgentLoop = async () => {
    if (agentLoopBusy) return;
    setAgentLoopBusy(true);
    const next = !agentLoopEnabled;
    try {
      const res = await fetch('/api/agent/fix-loop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAgentLoopEnabled(data.enabled);
        showToast(data.enabled
          ? 'הסוכן האוטומטי הופעל - יבדוק דיווחים פתוחים כל כמה דקות'
          : 'הסוכן האוטומטי כובה');
      } else {
        showToast(data.error || 'שגיאה בעדכון מצב הסוכן', 'error');
      }
    } catch (err) {
      console.error('Error toggling agent loop:', err);
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setAgentLoopBusy(false);
    }
  };

  const toggleDeploy = async () => {
    if (deployBusy) return;
    setDeployBusy(true);
    const next = !deployEnabled;
    try {
      const res = await fetch('/api/agent/fix-loop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deployEnabled: next }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeployEnabled(data.deployEnabled);
        showToast(data.deployEnabled
          ? 'הסוכן מורשה לפרוס תיקונים (לפתוח ענף+PR) בוורסל'
          : 'פריסות מהסוכן כבויות - הוא ימשיך לענות ולחקור, בלי לפתוח ענף/PR');
      } else {
        showToast(data.error || 'שגיאה בעדכון מצב הפריסה', 'error');
      }
    } catch (err) {
      console.error('Error toggling agent deploy flag:', err);
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setDeployBusy(false);
    }
  };

  const openThread = async (report) => {
    setSelectedReport(report);
    setActiveTab('thread');
    const needMarkRead = (isProgrammer && !report.isReadByProgrammer) || (!isProgrammer && !report.isReadByUser);
    if (needMarkRead) {
      setReports(prev => prev.map(r => r.id === report.id ? {
        ...r,
        isReadByProgrammer: isProgrammer ? true : r.isReadByProgrammer,
        isReadByUser: !isProgrammer ? true : r.isReadByUser,
      } : r));
      // Persist read status to DB so next fetch doesn't revert
      try {
        await fetch('/api/error-report', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId: report.id,
            isReadByProgrammer: isProgrammer ? true : undefined,
            isReadByUser: !isProgrammer ? true : undefined,
          }),
        });
      } catch {}
    }
  };

  // תגובת "תמיכה" מהסוכן האוטומטי (scripts/error-report-reply.js) לעולם לא מגדירה
  // employeeId - רק תגובה אמיתית שמתכנת מקליד בעצמו ב-UI (POST /api/error-report/reply)
  // כן. זה מה שמבחין בין השניים כדי להציג את כפתור "מענה אנושי" רק אחרי תגובת בוט.
  const isBotReply = (reply) => !!reply?.isProgrammer && !reply?.employeeId;

  const requestHumanReply = async () => {
    if (!selectedReport || isRequestingHuman) return;
    setIsRequestingHuman(true);
    try {
      const res = await fetch('/api/error-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedReport.id, needsHuman: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedReport(prev => ({ ...prev, needsHuman: true }));
        setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, needsHuman: true } : r));
        showToast('הבקשה נשלחה - התמיכה תענה לך בעצמה בקרוב', 'success');
      } else {
        showToast(data.error || 'שגיאה בשליחת הבקשה', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setIsRequestingHuman(false);
    }
  };

  // "ממתין לתשובה" - התגובה האחרונה בשרשור מסומנת isQuestion (ר' --question ב-
  // scripts/error-report-reply.js): מישהו שאל שאלה פתוחה והצד השני עדיין לא ענה.
  // נגזר מהתגובה האחרונה של כל דיווח בנפרד - לא גלובלי - כך ששרשורים מקבילים לא
  // "מדביקים" סטטוס זה לזה.
  const isAwaitingReply = (report) => {
    const replies = report.replies || [];
    if (replies.length === 0) return false;
    return !!replies[replies.length - 1].isQuestion;
  };

  const unreadCount = reports.filter(r => r.status !== 'ARCHIVED' && ((isProgrammer && !r.isReadByProgrammer) || (!isProgrammer && !r.isReadByUser))).length;
  const openReportsRaw = reports.filter(r => r.status !== 'ARCHIVED');
  // מיון יציב (Array.prototype.sort הוא stable) - רק דוחף "טופל" לסוף, לא משנה
  // סדר בתוך כל קבוצה.
  const sortedOpenReports = handledAtBottom
    ? [...openReportsRaw].sort((a, b) => (a.isHandled === b.isHandled ? 0 : a.isHandled ? 1 : -1))
    : openReportsRaw;
  // "יומן הסוכן האוטומטי" תמיד ראשון ברשימה (מנותק ממיון "טופל"/זמן עדכון) - זה
  // שרשור-על קבוע, לא דיווח-תקלה, וקל לפספס אותו בין דיווחים אחרים.
  const openReports = [
    ...sortedOpenReports.filter(r => r.title === AGENT_LOG_TITLE),
    ...sortedOpenReports.filter(r => r.title !== AGENT_LOG_TITLE),
  ];
  // מיון לפי createdAt קבוע, לא לפי סדר ה-API (updatedAt desc) - אחרת עצם פתיחת/קריאת
  // פנייה בארכיון (מסמנת isReadByProgrammer, מרעננת updatedAt) מזיזה אותה לראש הרשימה
  // בפעם הבאה שהיא נטענת מחדש, וכל הרשימה "קופצת" מתחת למיקום הגלילה השמור.
  const archivedReports = reports
    .filter(r => r.status === 'ARCHIVED')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // חיפוש בפניות - כמו במייל, מחפש בטקסט, בשם המדווח, בכותרת ובתגובות
  const filterBySearch = (list) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(r => {
      const inMain = (r.userText || '').toLowerCase().includes(q)
        || (r.title || '').toLowerCase().includes(q)
        || (r.url || '').toLowerCase().includes(q)
        || `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.toLowerCase().includes(q);
      const inReplies = (r.replies || []).some(rep => (rep.text || '').toLowerCase().includes(q));
      return inMain || inReplies;
    });
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        onClick={() => { setIsOpen(true); setActiveTab('list'); fetchReports(); }}
        title="מערכת דיווחי שגיאות"
      >
        <svg className="icon"><use href="#i-alert-circle" /></svg>
        {unreadCount > 0 && <span className="dot" />}
      </button>

      {isOpen && mounted && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
          <div className="modal" style={{ maxWidth: 600, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              {activeTab === 'new' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חזרה לרשימה" onClick={() => setActiveTab('list')}>
                    <svg className="icon"><use href="#i-chevron-end" /></svg>
                  </button>
                  <strong>דיווח על תקלה חדשה</strong>
                </div>
              ) : (
                <strong><svg className="icon"><use href="#i-info" /></svg> מערכת תמיכה ושגיאות</strong>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {isProgrammer && (
                  <button
                    type="button"
                    className={`btn btn-icon-only btn-sm ${agentLoopEnabled ? 'btn-primary' : 'btn-secondary'}`}
                    title={agentLoopEnabled
                      ? 'סוכן תיקון אוטומטי פעיל - בודק דיווחים פתוחים כל כמה דקות ופותח PR לתיקונים. לחצו לכיבוי.'
                      : 'הפעלת סוכן תיקון אוטומטי - יבדוק דיווחים פתוחים כל כמה דקות, יתקן קוד ויפתח PR לאישור.'}
                    disabled={agentLoopBusy}
                    onClick={toggleAgentLoop}
                  >
                    <svg className="icon"><use href="#i-activity" /></svg>
                  </button>
                )}
                {isProgrammer && agentLoopEnabled && (
                  <button
                    type="button"
                    className={`btn btn-icon-only btn-sm ${deployEnabled ? 'btn-primary' : 'btn-secondary'}`}
                    title={deployEnabled
                      ? 'הסוכן מורשה לפרוס תיקונים (לפתוח ענף+PR) בוורסל. לחצו לכיבוי - הוא ימשיך לענות ולחקור, בלי לפרוס.'
                      : 'פריסות מהסוכן כבויות - הוא עדיין עונה ובודק דיווחים, אבל לא פותח ענף/PR (כדי לא לצרוך את מכסת הפריסות היומית בוורסל). לחצו להפעלה.'}
                    disabled={deployBusy}
                    onClick={toggleDeploy}
                  >
                    <svg className="icon"><use href="#i-upload" /></svg>
                  </button>
                )}
                {activeTab === 'list' && (
                  <button type="button" className="btn btn-secondary btn-icon-only btn-sm" title="רענן" onClick={fetchReports}>
                    <svg className="icon"><use href="#i-refresh" /></svg>
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setIsOpen(false)}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              </div>
            </div>

            {activeTab !== 'thread' && activeTab !== 'new' && (
              <>
                <div className="tabs" style={{ margin: '0 22px' }}>
                  <button type="button" className={`tab${activeTab === 'list' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('list')}>
                    פניות שלי {isProgrammer ? '(כל הדיווחים)' : ''}
                  </button>
                  <button type="button" className={`tab${activeTab === 'archive' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('archive')}>
                    <svg className="icon" style={{ width: 13, height: 13, verticalAlign: -2, marginInlineEnd: 4 }}><use href="#i-archive" /></svg>
                    ארכיון {archivedReports.length > 0 ? `(${archivedReports.length})` : ''}
                  </button>
                  {(isManager || isProgrammer) && (
                    <button type="button" className="btn btn-primary btn-sm" style={{ marginInlineStart: 'auto', alignSelf: 'center', marginBottom: 4, flexShrink: 0 }} onClick={() => setActiveTab('new')}>
                      <svg className="icon"><use href="#i-plus" /></svg>
                      דיווח חדש
                    </button>
                  )}
                </div>
                {(activeTab === 'list' || activeTab === 'archive') && (
                  <div style={{ padding: '10px 22px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <svg className="icon" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)', pointerEvents: 'none' }}><use href="#i-search" /></svg>
                      <input
                        type="text"
                        className="input"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="חיפוש בפניות (טקסט, שם, תגובות)..."
                        style={{ width: '100%', paddingInlineStart: 30, fontSize: 13 }}
                      />
                    </div>
                    {searchQuery && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearchQuery('')}>נקה</button>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'thread' && selectedReport && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActiveTab(selectedReport.status === 'ARCHIVED' ? 'archive' : 'list'); fetchReports(); }}>חזור לרשימה</button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleHandled(selectedReport)}
                    >
                      <svg className="icon"><use href="#i-check-circle" /></svg>
                      {selectedReport.isHandled ? 'בטל סימון "טופל"' : 'סמן כטופל'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReportStatus(selectedReport, selectedReport.status === 'ARCHIVED' ? 'OPEN' : 'ARCHIVED')}
                    >
                      <svg className="icon"><use href={selectedReport.status === 'ARCHIVED' ? '#i-refresh' : '#i-archive'} /></svg>
                      {selectedReport.status === 'ARCHIVED' ? 'שחזור מהארכיון' : 'העברה לארכיון'}
                    </button>
                    {isProgrammer && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyDetails(selectedReport)}>
                        <svg className="icon"><use href="#i-link" /></svg>
                        העתק פרטי מערכת
                      </button>
                    )}
                  </div>
                </div>

                {selectedReport.title === AGENT_LOG_TITLE && (
                  <div style={{ padding: '10px 22px', background: 'var(--primary-tint)', fontWeight: 700, fontSize: 13.5, borderBottom: '1px solid var(--border)' }}>
                    {selectedReport.title}
                  </div>
                )}

                {isAwaitingReply(selectedReport) && (
                  <div style={{ padding: '8px 22px', background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))', fontWeight: 600, fontSize: 12.5, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg className="icon" style={{ width: 14, height: 14 }}><use href="#i-clock" /></svg>
                    ממתין לתשובה - נשאלה שאלה פתוחה ועדיין אין תגובה חדשה
                  </div>
                )}

                {selectedReport.needsHuman && (
                  <div style={{ padding: '8px 22px', background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #c0392b)', fontWeight: 600, fontSize: 12.5, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg className="icon" style={{ width: 14, height: 14 }}><use href="#i-alert-circle" /></svg>
                    {isProgrammer ? 'המדווח/ת ביקש/ה מענה אנושי ישיר - יש לענות בעצמכם' : 'הבקשה למענה אנושי נשלחה - התמיכה תענה לך בעצמה'}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="card card-pad" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-3)', fontSize: 12.5 }}>
                      <svg className="icon"><use href="#i-user" /></svg>
                      <strong>{selectedReport.employee ? selectedReport.employee.firstName + ' ' + selectedReport.employee.lastName : 'משתמש'}</strong>
                      <span>{getHebrewDateString(selectedReport.createdAt)} {new Date(selectedReport.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <ReportText text={selectedReport.userText} />
                    <AttachmentGallery attachmentUrls={selectedReport.attachmentUrls} />
                  </div>

                  {selectedReport.replies && selectedReport.replies.map(reply => {
                    const isMe = (isProgrammer && reply.isProgrammer) || (!isProgrammer && !reply.isProgrammer);
                    return (
                      <div
                        key={reply.id}
                        className="card card-pad"
                        style={{
                          background: reply.isProgrammer ? 'var(--primary-tint)' : 'var(--surface)',
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: reply.isProgrammer ? 'var(--primary-solid)' : 'var(--text-3)', fontSize: 12.5 }}>
                          <svg className="icon"><use href="#i-user" /></svg>
                          <strong>{reply.isProgrammer ? 'מתכנת מערכת' : (reply.employee ? reply.employee.firstName + ' ' + reply.employee.lastName : 'משתמש')}</strong>
                          <span>{getHebrewDateString(reply.createdAt)} {new Date(reply.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                          {reply.isQuestion && (
                            <span
                              className="badge"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))' }}
                            >
                              <svg className="icon" style={{ width: 11, height: 11 }}><use href="#i-clock" /></svg>
                              שאלה פתוחה
                            </span>
                          )}
                        </div>
                        <ReportText text={reply.text} />
                        <AttachmentGallery attachmentUrls={reply.attachmentUrls} />
                        {reply.previewUrl && (
                          <a
                            href={reply.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <svg className="icon"><use href="#i-link" /></svg>
                            בדיקה בגרסה זמנית
                          </a>
                        )}
                      </div>
                    );
                  })}

                  {!isProgrammer && humanButtonEnabled && !selectedReport.needsHuman
                    && selectedReport.replies?.length > 0
                    && isBotReply(selectedReport.replies[selectedReport.replies.length - 1]) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                      disabled={isRequestingHuman}
                      onClick={requestHumanReply}
                    >
                      <svg className="icon"><use href="#i-alert-circle" /></svg>
                      אוף! אני צריך מענה אנושי!
                    </button>
                  )}
                </div>

                <form onSubmit={handleReply} style={{ padding: '10px 16px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-3)', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={replyIsQuestion}
                      onChange={e => setReplyIsQuestion(e.target.checked)}
                    />
                    זו שאלה פתוחה - ממתינה לתשובה (לא רק עדכון/סיכום)
                  </label>
                  {replyAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {replyAttachments.map((src, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          {src.startsWith('gdrive:')
                            ? <div style={{ width: 60, height: 60, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}><svg className="icon" style={{ width: 16, height: 16 }}><use href="#i-activity" /></svg>הסרטת מסך</div>
                            : <img src={src} alt="צילום מצורף" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />}
                          <button
                            type="button"
                            onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                            style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger-solid)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: 1 }}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {replySteps && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-alt)' }}>
                      <svg className="icon" style={{ width: 14, height: 14 }}><use href="#i-check" /></svg>
                      נרשמו {stepsCountLabel(replySteps.split('\n').length)} — יצורפו לתגובה
                      <button type="button" className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }} onClick={() => setReplySteps('')}>הסר</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon-only"
                      title={recordingEnabled ? 'הסרטת מסך (וידאו + פעולות) וצירוף לתגובה' : 'הקלט את הפעולות שלי וצרף לתגובה'}
                      disabled={videoUploading}
                      onClick={() => (recordingEnabled ? startVideoRecording('reply') : startStepsRecording('reply'))}
                    >
                      <svg className="icon"><use href="#i-activity" /></svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon-only"
                      title="סמן אלמנט בעמוד וצרף לתגובה"
                      onClick={() => startPicking('reply')}
                    >
                      <svg className="icon"><use href="#i-pin" /></svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon-only"
                      title="צלם את כל המסך וצרף לתגובה"
                      onClick={() => captureFullScreen('reply')}
                    >
                      <svg className="icon"><use href="#i-grid" /></svg>
                    </button>
                    <input
                      type="text"
                      className="input"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="הקלד תגובה..."
                      required
                    />
                    <button type="submit" className="btn btn-primary btn-icon-only" disabled={isReplying || videoUploading}>
                      <svg className="icon"><use href="#i-arrow-end" /></svg>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {(activeTab === 'list' || activeTab === 'archive') && (() => {
              const baseList = activeTab === 'archive' ? archivedReports : openReports;
              const displayList = filterBySearch(baseList);
              const isSearchActive = searchQuery.trim().length > 0;
              return (
              <div
                ref={listScrollRef}
                onScroll={(e) => { scrollPositions.current[activeTab] = e.currentTarget.scrollTop; }}
                style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {baseList.length === 0 ? (
                  <div className="empty-state">
                    <svg className="icon"><use href={activeTab === 'archive' ? '#i-archive' : '#i-message'} /></svg>
                    <p>{activeTab === 'archive' ? 'אין דיווחים בארכיון' : 'אין דיווחים קיימים'}</p>
                  </div>
                ) : displayList.length === 0 ? (
                  <div className="empty-state">
                    <svg className="icon"><use href="#i-search" /></svg>
                    <p>לא נמצאו תוצאות ל־"{searchQuery}"</p>
                  </div>
                ) : (
                  displayList.map(report => {
                    const isAgentLog = report.title === AGENT_LOG_TITLE;
                    const isUnread = (isProgrammer && !report.isReadByProgrammer) || (!isProgrammer && !report.isReadByUser);
                    const awaitingReply = isAwaitingReply(report);
                    // "טופל"/"ממתין לתשובה" נצבעים רק אם אין התראת "לא נקרא" פעילה - הודעה
                    // חדשה תמיד גוברת חזותית. "ממתין לתשובה" (שאלה פתוחה אחרונה בשרשור, ר'
                    // isAwaitingReply) גובר על "טופל" - שרשור לא יכול להיות באמת "טופל" כשיש
                    // בו שאלה פתוחה שעוד לא נענתה. יומן הסוכן מקבל צבע קבוע משלו, בנפרד
                    // מדיווחי-תקלה רגילים.
                    const rowBackground = isAgentLog
                      ? 'var(--primary-tint)'
                      : report.needsHuman
                        ? 'var(--danger-bg, #fef2f2)'
                        : isUnread
                          ? 'var(--primary-tint)'
                          : awaitingReply
                            ? 'var(--warning-tint)'
                            : (report.isHandled ? 'var(--success-tint)' : 'var(--surface)');
                    return (
                      <div
                        key={report.id}
                        className="list-card"
                        onClick={() => openThread(report)}
                        style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch', background: rowBackground, border: isAgentLog ? '1px solid var(--primary-tint-2)' : undefined }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isUnread && <span className="dot-badge" />}
                            {isAgentLog ? report.title : (report.employee ? report.employee.firstName + ' ' + report.employee.lastName : 'משתמש')}
                            {report.needsHuman && (
                              <span
                                className="badge"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger, #c0392b)' }}
                                title={isProgrammer ? 'המדווח/ת ביקש/ה מענה אנושי ישיר' : 'הבקשה למענה אנושי נשלחה'}
                              >
                                <svg className="icon" style={{ width: 11, height: 11 }}><use href="#i-alert-circle" /></svg>
                                מענה אנושי
                              </span>
                            )}
                            {!isUnread && !report.needsHuman && awaitingReply && (
                              <span
                                className="badge"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))' }}
                                title={`ממתין לתשובה מ${isProgrammer ? 'המדווח/ת' : 'התמיכה'} - נשאלה שאלה פתוחה`}
                              >
                                <svg className="icon" style={{ width: 11, height: 11 }}><use href="#i-clock" /></svg>
                                ממתין לתשובה
                              </span>
                            )}
                            {!isUnread && !report.needsHuman && !awaitingReply && report.isHandled && (
                              <span
                                className="badge badge-success"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                                title="פנייה זו סומנה כטופלה"
                              >
                                <svg className="icon" style={{ width: 11, height: 11 }}><use href="#i-check-circle" /></svg>
                                טופל
                              </span>
                            )}
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              {getHebrewDateString(report.updatedAt)} {new Date(report.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon-only btn-sm"
                              title={report.isHandled ? 'בטל סימון "טופל"' : 'סמן כטופל'}
                              onClick={(e) => { e.stopPropagation(); toggleHandled(report); }}
                            >
                              <svg className="icon"><use href="#i-check-circle" /></svg>
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon-only btn-sm"
                              title={activeTab === 'archive' ? 'שחזור מהארכיון' : 'העברה לארכיון'}
                              onClick={(e) => { e.stopPropagation(); setReportStatus(report, activeTab === 'archive' ? 'OPEN' : 'ARCHIVED'); }}
                            >
                              <svg className="icon"><use href={activeTab === 'archive' ? '#i-refresh' : '#i-archive'} /></svg>
                            </button>
                          </div>
                        </div>
                        <p style={{ margin: '0 0 8px', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{splitReportSteps(report.userText).body}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
                          <svg className="icon"><use href="#i-message" /></svg>
                          <span>{report.replies?.length || 0} תגובות</span>
                          {isProgrammer && <span>· מסך: {report.title || 'לא ידוע'}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ); })()}

            {activeTab === 'new' && (
              (!isManager && !isProgrammer) ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <svg className="icon" style={{ width: 36, height: 36, color: 'var(--text-3)' }}><use href="#i-shield" /></svg>
                  <p style={{ margin: 0, fontWeight: 600 }}>יצירת דיווח חדש מותרת למנהלים בלבד</p>
                  <p style={{ margin: 0, fontSize: 13 }}>פנה למנהל/הנהלה ראשית כדי לדווח על תקלה.</p>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>חזור לרשימה</button>
                </div>
              ) : (
              <form onSubmit={handleSubmit} style={{ padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflowY: 'auto' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 700 }}>מה קרה?</label>
                  <textarea
                    className="textarea"
                    value={userText}
                    onChange={e => setUserText(e.target.value)}
                    placeholder="מה ניסית לעשות, ומה קרה בפועל? לדוגמה: לחצתי על שמירה, הופיעה שגיאה אדומה והדף קפא"
                    style={{ height: 120 }}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>עזרו לנו לראות את התקלה <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(לא חובה)</span></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { key: 'pick', icon: '#i-pin', title: pickedElements.length > 0 ? 'אלמנט נוסף' : 'סימון אלמנט', hint: 'הצבעה על המקום הבעייתי בעמוד', onClick: () => startPicking('new') },
                      { key: 'shot', icon: '#i-grid', title: 'צילום מסך', hint: 'תמונה של כל המסך', onClick: () => captureFullScreen('new') },
                      ...(recordingEnabled ? [{ key: 'video', icon: '#i-camera', title: videoUploading ? 'מעלה...' : 'הסרטת מסך', hint: 'וידאו + הפעולות שלך', onClick: () => startVideoRecording('new'), disabled: videoUploading, spinning: videoUploading }] : []),
                      { key: 'steps', icon: '#i-activity', title: recordedSteps ? 'פעולות מחדש' : 'הקלטת פעולות', hint: 'רישום הלחיצות וההקלדות, בלי וידאו ובלי שיתוף מסך', onClick: () => startStepsRecording('new') },
                    ].map(t => (
                      <button
                        key={t.key}
                        type="button"
                        title={t.hint}
                        onClick={t.onClick}
                        disabled={t.disabled}
                        style={{
                          flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px', textAlign: 'center',
                          cursor: t.disabled ? 'default' : 'pointer', opacity: t.disabled && !t.spinning ? 0.6 : 1,
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-tint)', color: 'var(--primary-solid)', flexShrink: 0 }}>
                          {t.spinning
                            ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                            : <svg className="icon" style={{ width: 16, height: 16 }}><use href={t.icon} /></svg>}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.25 }}>{t.title}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>הסרטה ורישום פעולות לא כוללים סיסמאות ופרטי אשראי.</div>
                </div>

                {(pickedElements.length > 0 || newAttachments.length > 0 || recordedSteps) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-2)' }}>מצורף לדיווח</div>

                    {pickedElements.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {pickedElements.map((el, idx) => (
                          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '3px 10px 3px 4px', borderRadius: 999, background: 'var(--primary-tint)', border: '1px solid var(--primary-tint-2)', fontSize: 12.5 }}>
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" style={{ width: 22, height: 22, minWidth: 22 }} onClick={() => setPickedElements(prev => prev.filter((_, i) => i !== idx))} title="הסר סימון זה">
                              <svg className="icon" style={{ width: 12, height: 12 }}><use href="#i-x" /></svg>
                            </button>
                            <span style={{ fontWeight: 700, color: 'var(--primary-solid)' }}>{idx + 1}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.label}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {newAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {newAttachments.map((src, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            {src.startsWith('gdrive:')
                              ? <div style={{ width: 64, height: 64, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 10.5, color: 'var(--text-3)', textAlign: 'center' }}><svg className="icon" style={{ width: 18, height: 18 }}><use href="#i-camera" /></svg>הסרטת מסך</div>
                              : <img src={src} alt="צילום מצורף" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />}
                            <button
                              type="button"
                              onClick={() => setNewAttachments(prev => prev.filter((_, i) => i !== idx))}
                              style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger-solid)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: 1 }}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {recordedSteps && (
                      <details style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                        <summary style={{ cursor: 'pointer', padding: '6px 10px', fontWeight: 600, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <svg className="icon" style={{ width: 14, height: 14 }}><use href="#i-check" /></svg>
                          נרשמו {stepsCountLabel(recordedSteps.split('\n').length)}
                          <button type="button" className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }} onClick={(ev) => { ev.preventDefault(); setRecordedSteps(''); }}>הסר</button>
                        </summary>
                        <pre style={{ margin: 0, padding: '4px 12px 10px', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', maxHeight: 140, overflowY: 'auto' }}>{recordedSteps}</pre>
                      </details>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'auto', paddingTop: 4 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('list'); setPickedElements([]); setNewAttachments([]); setRecordedSteps(''); }}>ביטול</button>
                  <button type="submit" className="btn btn-primary" disabled={videoUploading}>
                    <svg className="icon"><use href="#i-arrow-end" /></svg>
                    {videoUploading ? 'מעלה הסרטה...' : 'שליחה למתכנת'}
                  </button>
                </div>
              </form>
              )
            )}
          </div>
        </div>,
        document.body
      )}

      <ElementPickerOverlay isPicking={picker.isPicking} hoverRect={picker.hoverRect} />

      {isRecordingSteps && mounted && createPortal(
        <div data-no-record="true" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999998,
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px 10px 10px',
          background: 'var(--surface)', border: '1px solid var(--danger-solid)', borderRadius: 999,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger-solid)', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {recordingMode === 'video' ? 'מסריט את המסך' : 'רושם את הפעולות שלך'} · {stepsCountLabel(stepCount)}{recordingMode === 'video' ? ` · ${screenRecorder.seconds}/${screenRecorder.maxSeconds} שנ'` : ''}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>שחזר את התקלה, ואז לחץ "סיום"</span>
          <button type="button" data-no-record="true" className="btn btn-primary btn-sm" onClick={finishRecording}>סיום</button>
        </div>,
        document.body
      )}

      {toast && mounted && createPortal(
        <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999999 }}>
          {toast.message}
        </div>,
        document.body
      )}
    </>
  );
}
