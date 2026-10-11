'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import SettingQuickPanel from './SettingQuickPanel';
import { fetchSharedJson, TTL } from '../../lib/apiCache';
import { CopyChip, splitCopyable, renderCopyable } from './CopyableText';
import useElementPicker, { ElementPickerOverlay } from './useElementPicker';
import useScreenRecorder from './useScreenRecorder';
import useActionRecorder from './useActionRecorder';
import { captureElement, captureViewport, dataUrlToParts } from '../../lib/clientCapture';
import { uploadScreenRecording, prepareScreenRecordingUpload } from '../../lib/uploadScreenRecording';
import { formatActionSteps } from '../../lib/actionRecorderCore';
import { useUiVariant } from './UiVariantContext';
import { useAiDialogs } from './ai-widget/AiDialogs';
import { AI_FILE_INPUT_ACCEPT, validateAiFiles, isAiImageName } from '../../lib/aiAttachmentTypes';

// תפריט צץ שנסגר בלחיצה/מיקוד מחוץ אליו (וגם מחוץ לכפתור שפותח אותו, שמטפל בפתיחה/סגירה בעצמו - אחרת הסגירה
// והלחיצה על הכפתור מתחרות ויוצרות הבהוב) ובמקש Escape (המיקוד חוזר לכפתור). המאזינים מחוברים רק בזמן שהתפריט פתוח.
// pointerdown בשלב ה-capture: נסגר גם כשהדף שמאחור או אזור השיחה עוצרים את האירוע. שאר סגירות (בחירת פריט, סגירת החלונית, מעבר דף) - אצל הקורא.
function useDismissOnOutside(open, onDismiss, menuRef, toggleRef) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });
  useEffect(() => {
    if (!open) return undefined;
    const isInside = (target) => Boolean(
      (menuRef.current && menuRef.current.contains(target)) || (toggleRef.current && toggleRef.current.contains(target))
    );
    const onOutside = (e) => { if (!isInside(e.target)) onDismissRef.current(); };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onDismissRef.current();
      if (toggleRef.current) toggleRef.current.focus();
    };
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('focusin', onOutside, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('focusin', onOutside, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, menuRef, toggleRef]);
}

const readFileAsDataUrl = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(file);
});
// גודל בבתים של תוכן base64 (מתוך data URL) - לספירת הגבלת הגודל הכוללת
const dataUrlBytes = (dataUrl) => {
  const b64 = String(dataUrl || '').split(',')[1] || '';
  return Math.floor((b64.length * 3) / 4);
};
let pendingFileSeq = 0;

// מפריד תגיות [OPEN_SETTING:key] שה-AI מוסיף (app/api/ai/route.js, ACTION:
// SETTINGS_GUIDE) מתוך טקסט התשובה - מחזיר את הטקסט לתצוגה בלי התגיות, ואת
// רשימת המפתחות שיש להציג עבורם כפתור "פתח הגדרה".
function extractOpenSettingKeys(content) {
  if (typeof content !== 'string') return { displayText: content, keys: [] };
  const keys = [];
  const tagRegex = /\[OPEN_SETTING:([a-zA-Z0-9_]+)\]/g;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  const displayText = content.replace(tagRegex, '').trim();
  return { displayText, keys };
}

// תא בטבלת הנתונים: חותמת זמן גולמית מהמסד ("2026-10-07T10:55:33.912Z") מוצגת כתאריך ושעה לפי שעון ישראל, "07/10/2026 13:55".
// חצות בישראל (כך נשמרים תאריכי אירוע: 21:00/22:00 UTC) = תאריך בלבד; "YYYY-MM-DD" = תאריך בלבד. כל ערך אחר נשאר כמו שהוא.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const IL_PARTS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function formatTableCell(value) {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; }
  if (!ISO_DATETIME_RE.test(v)) return value;
  const dt = new Date(v);
  if (isNaN(dt.getTime())) return value;
  const p = Object.fromEntries(IL_PARTS.formatToParts(dt).map((x) => [x.type, x.value]));
  const date = `${p.day}/${p.month}/${p.year}`;
  return p.hour === '00' && p.minute === '00' ? date : `${date} ${p.hour}:${p.minute}`;
}

// מפריד התגית [FILTER:term] שה-AI מוסיף בסוף תשובה על דגם / צבע / מידה / ברקוד (app/api/ai/route.js, "SMART FILTERING"). במסך
// הלקוח התגית הופכת לכפתור סינון; כאן אין רשימה לסנן, ולכן היא לא מוצגת כטקסט גולמי (8.10.2026) אלא הופכת לכפתור שמריץ את
// המונח בחיפוש של דף הבית (/?q=, שני דפי הבית תומכים בו).
function extractFilterTerm(content) {
  if (typeof content !== 'string') return { displayText: content, term: '' };
  const tagRegex = /\[FILTER:([^\]]*)\]/g;
  let term = '';
  let match;
  while ((match = tagRegex.exec(content)) !== null) term = match[1].trim();
  return { displayText: content.replace(tagRegex, '').trim(), term };
}

// מפריד תגיות [OPEN_LINK:route|תווית] שה-AI מוסיף (app/api/ai/route.js, ACTION:
// HOWTO_GUIDE) - מקביל ל-extractOpenSettingKeys אבל לניווט ישיר לעמוד, לא לפתיחת
// פאנל עריכת הגדרה.
function extractOpenLinks(content) {
  if (typeof content !== 'string') return { displayText: content, links: [] };
  const links = [];
  const tagRegex = /\[OPEN_LINK:([^\]|]+)\|([^\]]+)\]/g;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    links.push({ route: match[1].trim(), label: match[2].trim() });
  }
  const displayText = content.replace(tagRegex, '').trim();
  return { displayText, links };
}

export default function AIFloatingWidget({ hideAIFeatures = false, employeeId = null }) {
  // במעטפת החדשה (A5) הכפתור והחלונית בכחול-זהב של האתר (class ai-a5, globals.css) במקום צבע הערכה הישנה (--primary-solid).
  const a5Class = useUiVariant('shell') === 'a5' ? ' ai-a5' : '';
  const pathname = usePathname();
  // ממותג לפי עובד/ת - בלי זה, מחשב משותף (עמדת גמ"ח) מציג לעובדת הבאה שמתחברת
  // את היסטוריית הצ'אט של הקודמת, כי localStorage הוא ברמת הדפדפן ולא נוקה בהתנתקות.
  const chatKey = `ai_employee_chat_${employeeId || 'guest'}`;
  const sessionsKey = `ai_employee_chat_sessions_${employeeId || 'guest'}`;
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const aiDlg = useAiDialogs(); // חלוניות קופצות בעיצוב הכהה החדש (הודעה / אישור / טבלה) - במקום alert / customConfirm / מודאל לבן
  const [openSettingKey, setOpenSettingKey] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  // כותרת השיחה = `title` שהשרת מצרף לתשובה הראשונה (נשמר על הודעת ה-assistant, ולכן גם ב-localStorage ובמסד, בלי שדה חדש)
  const chatTitle = (msgs) => ((msgs || []).find((m) => m && m.title) || {}).title || '';

  // צילום/הקלטה מצורפים להודעה הבאה - ר' תוכנית Phase 3/4.
  const [pendingImage, setPendingImage] = useState(null); // data URL
  // "הסרטת מסך": pendingRecordingUrl = תצוגה מקדימה מקומית (blob URL, לא נשלח לשרת);
  // pendingRecordingMeta = מה שנשלח בפועל ל-AI: fileId של הוידאו בדרייב (אם הועלה) + רשימת הצעדים (מאקרו).
  const [pendingRecordingUrl, setPendingRecordingUrl] = useState(null);
  const [pendingRecordingMeta, setPendingRecordingMeta] = useState(null);
  const [showCaptureMenu, setShowCaptureMenu] = useState(false);
  // קבצים מהמחשב (תמונה/PDF/טקסט) שצורפו להודעה הבאה: { id, name, size, dataUrl } - נשלחים ל-AI יחד עם השאלה
  const [pendingFiles, setPendingFiles] = useState([]);
  const captureMenuRef = useRef(null);
  const captureToggleRef = useRef(null);
  const fileInputRef = useRef(null);
  useDismissOnOutside(showCaptureMenu, () => setShowCaptureMenu(false), captureMenuRef, captureToggleRef);
  // מעבר בין דפים סוגר את התפריט (התאמת state בזמן רינדור - הדפוס המומלץ של React לאיפוס state לפי prop)
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setShowCaptureMenu(false);
  }
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);

  const uploadPromiseRef = useRef(null);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  const handleWidgetElementPicked = async (el) => {
    setIsOpen(true);
    const capture = await captureElement(el);
    if (capture) setPendingImage(capture.dataUrl);
  };
  const elementPicker = useElementPicker(handleWidgetElementPicked);

  const captureFullScreenForChat = async () => {
    setShowCaptureMenu(false);
    setIsOpen(false);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const capture = await captureViewport();
    setIsOpen(true);
    if (capture) setPendingImage(capture.dataUrl);
  };

  const closeWidget = () => {
    setShowCaptureMenu(false);
    setIsOpen(false);
  };

  const openFilePicker = () => {
    setShowCaptureMenu(false);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  // אותן בדיקות כמו בדיווח תקלה (סיומת מותרת, סה"כ עד 3MB) - ר' lib/aiAttachmentTypes.js, שמצמצם לסוגים שהעוזר באמת קורא
  const handleFilesChosen = async (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    if (!chosen.length) return;
    const currentBytes = pendingFiles.reduce((sum, f) => sum + f.size, 0) + (pendingImage ? dataUrlBytes(pendingImage) : 0);
    const checked = validateAiFiles(chosen, { currentBytes, currentCount: pendingFiles.length });
    const errors = [];
    const added = [];
    for (const c of checked) {
      if (!c.ok) { errors.push(c.error); continue; }
      const dataUrl = await readFileAsDataUrl(c.file);
      if (!dataUrl) { errors.push(`קריאת "${c.file.name}" נכשלה`); continue; }
      added.push({ id: `f${++pendingFileSeq}`, name: c.file.name, size: c.file.size, dataUrl });
    }
    if (added.length) setPendingFiles((prev) => [...prev, ...added]);
    if (errors.length) aiDlg.notify(errors.join('\n'), { title: 'צירוף קובץ' });
  };

  const startElementCaptureForChat = () => {
    setShowCaptureMenu(false);
    setIsOpen(false);
    elementPicker.startPicking();
  };

  const screenRecorder = useScreenRecorder();
  const actionRecorder = useActionRecorder();

  // הסרטת מסך = וידאו (עולה ישר לדרייב) + רשימת פעולות שנרשמה במקביל (לחיצות/הקלדות/ניווט),
  // שנשלחת ל-Gemini כטקסט. אם הדרייב לא מוגדר או שההעלאה נכשלה — ממשיכים עם רשימת הפעולות בלבד.
  const toggleRecording = async () => {
    setShowCaptureMenu(false);
    if (screenRecorder.isRecording) {
      screenRecorder.stop();
      return;
    }
    setIsOpen(false);
    actionRecorder.start();
    // פותחים את ההעלאה לדרייב כבר עכשיו — הפנייה לגשר איטית, וכך היא רצה בזמן ההסרטה
    const prepared = prepareScreenRecordingUpload();
    prepared.catch(() => {});
    const blob = await screenRecorder.start();
    const steps = actionRecorder.stop();
    setIsOpen(true);
    if (!blob) return;
    const stepsText = formatActionSteps(steps);
    setPendingRecordingUrl(URL.createObjectURL(blob));
    setPendingRecordingMeta({ fileId: null, stepsText });
    setIsUploadingRecording(true);
    // שומרים את ההבטחה: אם המשתמש שולח את ההודעה לפני שההעלאה הסתיימה, sendMessage ממתין לה
    // (אחרת נשלחה שאלה בלי הוידאו ובלי הצעדים, והתשובה הייתה "אינני מסוגל לצפות בסרטונים")
    const uploading = uploadScreenRecording(blob, prepared);
    uploadPromiseRef.current = uploading.then((fileId) => fileId, () => null);
    try {
      const fileId = await uploading;
      setPendingRecordingMeta({ fileId, stepsText });
    } catch (e) {
      if (e.code !== 'DRIVE_NOT_CONFIGURED') console.error('Failed to upload screen recording:', e);
      if (!stepsText) {
        setPendingRecordingUrl(null);
        setPendingRecordingMeta(null);
        aiDlg.notify('העלאת ההסרטה נכשלה.', { title: 'הסרטת המסך' });
      }
    } finally {
      setIsUploadingRecording(false);
    }
  };

  useEffect(() => {
    // /api/settings משותף (מטמון apiCache, 5 דק') - לפני כן כל טעינת דף משכה את כל ההגדרות (~66KB) שוב רק בשביל מפתח אחד.
    // קריאת אתחול: נשמרת ב-sessionStorage של הלשונית לפי רשימת המותרים (lib/apiCachePersist.js), בלי קשר למי שקורא ראשון
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const s = data.find((x) => x.key === 'ai_screen_recording_enabled');
        setRecordingEnabled(s?.value === 'true');
      })
      .catch(() => {});
  }, []);

  // ניווט באותה כרטיסייה (SPA, ללא רענון מלא) בלחיצה רגילה - שומר על ctrl/cmd/shift/
  // middle-click כדי שמשתמש שרוצה בכוונה לפתוח בכרטיסייה חדשה עדיין יוכל (כמו Next Link).
  const navigateInApp = (e, href) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push(href);
  };

  // אימייל/טלפון מפוצלים קודם לתגיות העתקה; רק הטקסט שביניהם עובר זיהוי קישורי הזמנה/לקוח
  // (אחרת "לקוח abc@x.com" היה נתפס כקישור ללקוח "abc").
  const parseMessageToLinks = (text) => {
    if (!text) return null;
    return splitCopyable(text).map((seg, s) =>
      seg.token
        ? <CopyChip key={s} value={seg.text.trim()} />
        : <span key={s}>{parseLinksOnly(seg.text)}</span>
    );
  };

  const parseLinksOnly = (text) => {
    const parts = text.split(/(הזמנה\s*\d+|לקוח\s*[\w-]+)/g);
    return parts.map((part, i) => {
      let match = part.match(/הזמנה\s*(\d+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/orders/${match[1]}`}
            onClick={(e) => navigateInApp(e, `/orders/${match[1]}`)}
            className="chip"
            style={{ background: 'var(--primary-solid)', color: 'var(--text-on-primary)', border: 'none', fontWeight: 'bold', margin: '0 4px' }}
          >
            {part}
          </a>
        );
      }
      match = part.match(/לקוח\s*([\w-]+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/customers/${match[1]}`}
            onClick={(e) => navigateInApp(e, `/customers/${match[1]}`)}
            className="chip"
            style={{ background: 'var(--primary-solid)', color: 'var(--text-on-primary)', border: 'none', fontWeight: 'bold', margin: '0 4px' }}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const [copiedIdx, setCopiedIdx] = useState(null);
  const copyBubbleText = async (idx, text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {
      // clipboard permission denied or unavailable — silently ignore
    }
  };

  useEffect(() => {
    const savedSessions = localStorage.getItem(sessionsKey);
    let sessions = [];
    if (savedSessions) {
      try {
        sessions = JSON.parse(savedSessions);
      } catch (e) {}
    }

    const saved = localStorage.getItem(chatKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 1) {
          const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), title: chatTitle(parsed), messages: [...parsed] };
          sessions = [newSession, ...sessions].slice(0, 10);
          localStorage.setItem(sessionsKey, JSON.stringify(sessions));
        }
      } catch (e) {}
    }

    setChatSessions(sessions);
    setMessages([{ role: 'assistant', content: 'שלום! אני עוזר ה-AI. כיצד אוכל לעזור לך למצוא נתונים במערכת?' }]);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const startNewChat = () => {
    if (messages.length > 1) {
      // Save current to sessions before clearing
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), title: chatTitle(messages), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem(sessionsKey, JSON.stringify(updatedSessions));
    }
    setMessages([{ role: 'assistant', content: 'שלום! אני עוזר ה-AI. כיצד אוכל לעזור לך למצוא נתונים במערכת?' }]);
    setActiveSessionId(null);
    setShowHistory(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !pendingImage && !pendingRecordingUrl && pendingFiles.length === 0) || loading) return;

    const userMsg = input.trim() || (pendingRecordingUrl ? 'מה קרה בהסרטה הזו?' : (!pendingImage && pendingFiles.length ? 'מה יש בקובץ המצורף?' : 'מה רואים בתמונה הזו?'));
    const imageToSend = pendingImage ? dataUrlToParts(pendingImage) : null;
    const filesToSend = pendingFiles;
    const recordingToSend = pendingRecordingUrl;
    let recordingMetaToSend = pendingRecordingMeta;
    const stillUploading = Boolean(recordingToSend && isUploadingRecording && uploadPromiseRef.current);
    setInput('');
    setPendingImage(null);
    setPendingFiles([]);
    setPendingRecordingUrl(null);
    setPendingRecordingMeta(null);

    // ההודעה מופיעה מיד; אם הוידאו עוד עולה, מסמנים אותה "מעלה הסרטה" והבקשה ל-AI יוצאת רק אחרי שההעלאה הסתיימה
    const userMessage = { role: 'user', content: userMsg, attachedImage: pendingImage, attachedFiles: filesToSend.map((f) => ({ name: f.name })), attachedRecording: recordingToSend, uploadingRecording: stillUploading };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setLoading(true);

    try {
      if (stillUploading) {
        const fileId = await uploadPromiseRef.current;
        recordingMetaToSend = { ...(recordingMetaToSend || {}), fileId: fileId || null };
        // מסירים את סימון ההעלאה מההודעה (newMessages הוא המקור שממנו נבנית ההיסטוריה שנשמרת)
        userMessage.uploadingRecording = false;
        setMessages(prev => prev.map(m => (m === userMessage ? { ...m, uploadingRecording: false } : m)));
        // ההעלאה נכשלה ואין גם רשימת פעולות - אין מה לשלוח ל-AI (בלי זה הוא עונה "אינני מסוגל לצפות בסרטונים")
        if (!fileId && !recordingMetaToSend?.stepsText) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'העלאת ההסרטה נכשלה, ולכן לא שלחתי את השאלה. נסה להסריט שוב.' }]);
          return;
        }
      }
      // Cap the history sent to the AI to the most recent exchanges - a chat window left
      // open for hours/days (messages never auto-expire, see the mount effect above) was
      // sending its entire, possibly stale, history as context on every new question,
      // which could lead the model to answer with old context (e.g. a date from an old
      // question) instead of the new one (reported: an answer about "yesterday's orders"
      // from an old exchange resurfacing as the reply to an unrelated new question).
      const AI_HISTORY_MAX_MESSAGES = 10;
      const historyContext = newMessages.slice(-AI_HISTORY_MAX_MESSAGES).map(m => ({ role: m.role, content: m.content }));

      let currentContext = '';
      if (pathname.includes('/orders/')) {
        const orderIdMatch = pathname.match(/\/orders\/(\d+|-)/);
        if (orderIdMatch) currentContext = `הלקוח נמצא כעת במסך כרטיס הזמנה מס' ${orderIdMatch[1]}. `;
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          history: historyContext,
          // השאלה הראשונה בשיחה (קיימת רק הודעת הפתיחה של ה-AI): השרת מצרף לתשובה כותרת לשיחה
          firstQuestion: messages.filter((m) => m.role === 'assistant').length <= 1 && !imageToSend && !recordingMetaToSend && filesToSend.length === 0,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ${currentContext}אתה עוזר וירטואלי עבור עובדי הגמ"ח. מותר לך לספק נתונים על לקוחות, הזמנות, פריטים ומלאי כדי לעזור בשירות לקוחות. אסור לך לחשוף מידע על עובדים אחרים, משמרות או הרשאות. אסור לך להציג סטטיסטיקות כלליות, סיכומי רווחים, דוחות או פילוחים ניהוליים מתקדמים (אם העובד מבקש סטטיסטיקות כאלו, אמור לו שזה זמין רק בממשק מנהל).`,
          image: imageToSend,
          files: filesToSend.length ? filesToSend.map((f) => ({ name: f.name, data: f.dataUrl.split(',')[1] || '' })) : undefined,
          recordingFileId: recordingMetaToSend?.fileId || null,
          recordingSteps: recordingMetaToSend?.stepsText || null,
        }),
      });

      const data = await res.json();

      const assistantMessage = res.ok
        ? { role: 'assistant', content: data.response, tableData: data.data, ...(data.title ? { title: String(data.title).slice(0, 60) } : {}) }
        : { role: 'assistant', content: 'מצטער, חלה שגיאה בחיבור למערכת ה-AI.' };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Sync to DB
      try {
        let currentContext = 'כללי';
        if (pathname.includes('/orders/')) currentContext = 'הזמנות';
        else if (pathname.includes('/customers/')) currentContext = 'לקוחות';
        else if (pathname.includes('/employees/')) currentContext = 'עובדים';
        else if (pathname.includes('/dashboard')) currentContext = 'דשבורד';

        const syncRes = await fetch('/api/ai/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            context: currentContext,
            messages: finalMessages
          })
        });
        const syncData = await syncRes.json();
        if (syncData.success && syncData.session && !activeSessionId) {
          setActiveSessionId(syncData.session.id);
        }
      } catch (err) {
        console.warn('Failed to sync session:', err?.message || err);
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת תקשורת עם השרת.' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (await aiDlg.confirm('האם אתה בטוח שברצונך לנקות את חלון השיחה?', { title: 'ניקוי השיחה', ok: 'נקה' })) {
      startNewChat();
    }
  };

  const renderTable = (tableData) => {
    if (!tableData || tableData.length === 0) return null;
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button data-element-name="כפתור_AIFloatingWidget_1"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => aiDlg.showTable(tableData, { render: (v) => renderCopyable(formatTableCell(v)), onNavigate: navigateInApp })}
        >
          <svg className="icon"><use href="#i-grid" /></svg>
          הצג טבלה
        </button>
      </div>
    );
  };

  const toggleListen = (e) => {
    if (e) e.preventDefault();
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      aiDlg.notify("הדפדפן שלך אינו תומך בהקלטת קול.", { title: 'הקלטת קול' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'he-IL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      // ללא הודעה כאן הכפתור פשוט "לא עושה כלום" מבחינת המשתמש - למשל כשהרשאת
      // המיקרופון נדחתה בעבר, recognition.start() נכשל מיד בלי onstart בכלל.
      const messages = {
        'not-allowed': 'לא ניתנה הרשאת מיקרופון. יש לאשר גישה למיקרופון בהגדרות הדפדפן ולנסות שוב.',
        'permission-denied': 'לא ניתנה הרשאת מיקרופון. יש לאשר גישה למיקרופון בהגדרות הדפדפן ולנסות שוב.',
        'no-speech': 'לא זוהה דיבור. נסו שוב ודברו בסמוך למיקרופון.',
        'audio-capture': 'לא נמצא מיקרופון זמין במחשב זה.',
        'network': 'שגיאת רשת בזיהוי הקול. נסו שוב.',
      };
      aiDlg.notify(messages[event.error] || 'אירעה שגיאה בהקלטת הקול. נסו שוב.', { title: 'הקלטת קול' });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const loadSession = (session) => {
    if (messages.length > 1 && !chatSessions.find(s => s.id === session.id)) {
      // eslint-disable-next-line react-hooks/purity -- runs inside the loadSession click handler, never during render
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), title: chatTitle(messages), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem(sessionsKey, JSON.stringify(updatedSessions));
    }
    setMessages(session.messages);
    setShowHistory(false);
  };

  if (pathname === '/customer-interface' || hideAIFeatures) {
    return null;
  }

  if (!isOpen) {
    // הכפתור מוסתר בכוונה בזמן איתור/צילום/הקלטה (setIsOpen(false) ב-Phase 3/4)
    // כדי שהוא לא ייכנס לצילום עצמו - אבל שכבת האיתור/הצילום עצמה חייבת עדיין
    // להיות מוצגת, אחרת אין למשתמש שום משוב חזותי בזמן שהחלונית סגורה.
    return (
      <>
        <button data-element-name="כפתור_AIFloatingWidget_2"
          type="button"
          className={`print-hide ai-widget-fab${a5Class}`}
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            insetInlineStart: '20px',
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--primary-solid)',
            color: 'var(--text-on-primary)',
            border: 'none',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 900,
            transition: 'transform 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          title="עוזר AI"
        >
          <svg data-element-name="רכיב_AIFloatingWidget_3" className="icon" style={{ width: '22px', height: '22px' }}>
            <use href="#i-star" />
          </svg>
        </button>
        <ElementPickerOverlay isPicking={elementPicker.isPicking} hoverRect={elementPicker.hoverRect} />
      </>
    );
  }

  return (
    <>
      <div className={`print-hide card ai-widget-panel${a5Class}`} style={{
        position: 'fixed',
        bottom: '20px',
        insetInlineStart: 'calc(var(--sidebar-current-w) + 20px)',
        width: isExpanded ? '600px' : '380px',
        height: isExpanded ? '80vh' : '550px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 900,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        transition: 'all 0.3s ease'
      }}>
        {/* Header */}
        <div className="ai-widget-head" style={{
          backgroundColor: 'var(--primary-solid)',
          color: 'var(--text-on-primary)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <svg data-element-name="רכיב_AIFloatingWidget_4" className="icon" style={{ width: '20px', height: '20px' }}>
              <use href="#i-star" />
            </svg>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', flex: 'none' }}>עוזר AI</span>
            {chatTitle(messages) ? <span data-testid="ai-chat-title" style={{ opacity: 0.85, fontSize: '0.85rem', flex: '0 1 auto', minWidth: 0, maxWidth: '170px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {chatTitle(messages)}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: '4px', flex: 'none' }}>
            <button data-element-name="כפתור_AIFloatingWidget_5"
              type="button"
              className={`btn btn-ghost btn-icon-only btn-sm${showHistory ? ' is-on' : ''}`}
              onClick={() => setShowHistory(!showHistory)}
              style={{ color: showHistory ? 'var(--accent)' : 'var(--text-on-primary)' }}
              title="היסטוריית שיחות"
            >
              <svg data-element-name="רכיב_AIFloatingWidget_6" className="icon"><use href="#i-history" /></svg>
            </button>
            <button data-element-name="כפתור_AIFloatingWidget_7"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={clearChat}
              style={{ color: 'var(--text-on-primary)' }}
              title="שיחה חדשה"
            >
              <svg data-element-name="רכיב_AIFloatingWidget_8" className="icon"><use href="#i-plus" /></svg>
            </button>
            <button data-element-name="כפתור_AIFloatingWidget_9"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => { setShowCaptureMenu(false); setIsExpanded(!isExpanded); }}
              style={{ color: 'var(--text-on-primary)' }}
              title={isExpanded ? 'הקטן' : 'הגדל'}
            >
              {isExpanded ? (
                <svg data-element-name="רכיב_AIFloatingWidget_10" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>
              ) : (
                <svg data-element-name="רכיב_AIFloatingWidget_11" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
              )}
            </button>
            <button data-element-name="כפתור_AIFloatingWidget_12"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={closeWidget}
              style={{ color: 'var(--text-on-primary)' }}
              title="סגור"
            >
              <svg data-element-name="רכיב_AIFloatingWidget_13" className="icon"><use href="#i-x" /></svg>
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: 'var(--surface-alt)', position: 'relative' }}>
          {showHistory ? (
            <div style={{ padding: '10px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text)', fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>היסטוריית שיחות</h3>
              {messages.length > 1 && (
                <div data-element-name="לחיץ_AIFloatingWidget_14"
                  onClick={() => setShowHistory(false)}
                  className="list-card"
                  style={{
                    background: 'var(--success-tint)', borderColor: 'var(--success)',
                    cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch', gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '0.9rem' }}>שיחה נוכחית (פעילה)</span>
                  <span style={{ color: 'var(--success)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {messages[1].content}
                  </span>
                </div>
              )}
              {chatSessions.length === 0 && messages.length <= 1 ? (
                <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', marginTop: '10px' }}>אין היסטוריית שיחות שמורה.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {chatSessions.map((session) => (
                    <div data-element-name="לחיץ_AIFloatingWidget_15"
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className="list-card"
                      style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.9rem' }}>{session.title || chatTitle(session.messages) || session.date}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(session.title || chatTitle(session.messages)) ? session.date : (session.messages.length > 1 ? session.messages[1].content : 'שיחה ריקה')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="chat-thread">
              {messages.map((msg, idx) => {
                const { displayText: afterSettings, keys: openSettingKeys } = extractOpenSettingKeys(msg.content);
                const { displayText: afterLinks, links: openLinks } = extractOpenLinks(afterSettings);
                const { displayText, term: filterTerm } = extractFilterTerm(afterLinks);
                return (
                  <div key={idx} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                    <button
                      type="button"
                      className={`bubble-copy-btn${copiedIdx === idx ? ' copied' : ''}`}
                      title="העתק"
                      onClick={() => copyBubbleText(idx, displayText)}
                    >
                      <svg className="icon"><use href={`#${copiedIdx === idx ? 'i-check' : 'i-copy'}`} /></svg>
                    </button>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{parseMessageToLinks(displayText)}</div>
                    {msg.attachedImage && (
                      <img src={msg.attachedImage} alt="צילום מצורף" style={{ maxWidth: 180, maxHeight: 140, borderRadius: 6, marginTop: 6, display: 'block' }} />
                    )}
                    {Array.isArray(msg.attachedFiles) && msg.attachedFiles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {msg.attachedFiles.map((f, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, maxWidth: '100%' }}>
                            <svg className="icon" style={{ width: 14, height: 14, flex: 'none' }}><use href="#i-upload" /></svg>
                            <bdi style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</bdi>
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.attachedRecording && (
                      <video src={msg.attachedRecording} controls style={{ maxWidth: 220, maxHeight: 160, borderRadius: 6, marginTop: 6, display: 'block' }} />
                    )}
                    {msg.uploadingRecording && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12.5, opacity: 0.9 }}>
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        מעלה את ההסרטה ברקע - השאלה תישלח ל-AI מיד אחרי שההעלאה תסתיים
                      </div>
                    )}
                    {msg.tableData && renderTable(msg.tableData)}
                    {openSettingKeys.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {openSettingKeys.map(key => (
                          <button
                            key={key}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setOpenSettingKey(key)}
                          >
                            <svg className="icon"><use href="#i-settings" /></svg>
                            פתח הגדרה
                          </button>
                        ))}
                      </div>
                    )}
                    {filterTerm && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        <a
                          href={`/?q=${encodeURIComponent(filterTerm)}`}
                          onClick={(e) => navigateInApp(e, `/?q=${encodeURIComponent(filterTerm)}`)}
                          className="btn btn-secondary btn-sm"
                        >
                          <svg className="icon"><use href="#i-search" /></svg>
                          חפש "{filterTerm}" בחיפוש
                        </a>
                      </div>
                    )}
                    {openLinks.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {openLinks.map((link, i) => (
                          <a
                            key={i}
                            href={link.route}
                            onClick={(e) => navigateInApp(e, link.route)}
                            className="btn btn-secondary btn-sm"
                          >
                            <svg className="icon"><use href="#i-chevron-start" /></svg>
                            {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {loading && (
                <div className="bubble assistant" style={{ padding: 0 }}>
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* תצוגה ממתינה - תמונה/הקלטת מסך שצורפו ועדיין לא נשלחו */}
        {(pendingImage || pendingRecordingUrl || isUploadingRecording || pendingFiles.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            {pendingImage && (
              <div style={{ position: 'relative' }}>
                <img src={pendingImage} alt="צילום ממתין" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                <button type="button" onClick={() => setPendingImage(null)} style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger-solid)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>×</button>
              </div>
            )}
            {pendingFiles.map((f) => (
              <div key={f.id} style={{ position: 'relative' }} title={f.name}>
                {isAiImageName(f.name) ? (
                  <img src={f.dataUrl} alt={f.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' }}>
                    <svg className="icon" style={{ width: 16, height: 16 }}><use href="#i-file" /></svg>
                    <bdi style={{ fontSize: 9, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</bdi>
                  </div>
                )}
                <button type="button" aria-label={`הסר את ${f.name}`} onClick={() => setPendingFiles((prev) => prev.filter((x) => x.id !== f.id))} style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger-solid)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>×</button>
              </div>
            ))}
            {isUploadingRecording && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
            {pendingRecordingUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg className="icon" style={{ width: 16, height: 16 }}><use href="#i-check" /></svg>
                <span style={{ fontSize: 12.5 }}>הסרטת המסך מוכנה לשליחה</span>
                <button type="button" onClick={() => { setPendingRecordingUrl(null); setPendingRecordingMeta(null); }} className="btn btn-ghost btn-icon-only btn-sm">
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={sendMessage} style={{
          display: 'flex',
          padding: '12px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          gap: '8px',
          position: 'relative'
        }}>
          {screenRecorder.isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'var(--danger-tint)', borderRadius: 'var(--radius-full)', padding: '0 14px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger-solid)', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>מסריט מסך... {screenRecorder.seconds}/{screenRecorder.maxSeconds} שנ'</span>
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginInlineStart: 'auto' }} onClick={() => screenRecorder.stop()}>עצור</button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <button data-element-name="כפתור_AIFloatingWidget_22"
                  ref={captureToggleRef}
                  type="button"
                  onClick={() => setShowCaptureMenu((v) => !v)}
                  className="icon-btn"
                  title="צרף צילום/הסרטת מסך/קובץ"
                  aria-haspopup="menu"
                  aria-expanded={showCaptureMenu}
                  aria-controls={showCaptureMenu ? 'ai-capture-menu' : undefined}
                >
                  <svg className="icon"><use href="#i-grid" /></svg>
                </button>
                {showCaptureMenu && (
                  <div ref={captureMenuRef} id="ai-capture-menu" role="menu" style={{
                    position: 'absolute', bottom: '110%', insetInlineStart: 0,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-lg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
                    minWidth: 190, zIndex: 10,
                  }}>
                    <button type="button" role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={startElementCaptureForChat}>
                      <svg className="icon"><use href="#i-pin" /></svg>
                      צלם אזור באתר
                    </button>
                    <button type="button" role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={captureFullScreenForChat}>
                      <svg className="icon"><use href="#i-grid" /></svg>
                      צלם את כל המסך
                    </button>
                    {recordingEnabled && (
                      <button type="button" role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={toggleRecording}>
                        <svg className="icon"><use href="#i-activity" /></svg>
                        הסרטת מסך
                      </button>
                    )}
                    <button type="button" role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={openFilePicker} title="תמונה, PDF, טקסט או CSV - עד 3MB בסך הכל">
                      <svg className="icon"><use href="#i-upload" /></svg>
                      העלאת קובץ
                    </button>
                  </div>
                )}
              </div>
              <button data-element-name="כפתור_AIFloatingWidget_16"
                type="button"
                onClick={toggleListen}
                className="icon-btn"
                style={{
                  background: isListening ? 'var(--danger-solid)' : 'var(--surface-alt)',
                  color: isListening ? 'var(--text-on-primary)' : 'var(--text)',
                  borderColor: isListening ? 'var(--danger-solid)' : 'var(--border)',
                  animation: isListening ? 'pulse 1.5s infinite' : 'none'
                }}
                title="הקלט הודעה"
              >
                <svg data-element-name="רכיב_AIFloatingWidget_17" className="icon"><use href="#i-mic" /></svg>
              </button>
              <input data-element-name="שדה_AIFloatingWidget_18"
                type="text"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="שאל שאלה..."
                className="input"
                style={{ flex: 1, borderRadius: 'var(--radius-full)' }}
              />
              <button data-element-name="כפתור_AIFloatingWidget_19"
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-icon-only"
                style={{ borderRadius: '50%' }}
              >
                <svg data-element-name="רכיב_AIFloatingWidget_20" className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            </>
          )}
          <input ref={fileInputRef} type="file" multiple accept={AI_FILE_INPUT_ACCEPT} onChange={handleFilesChosen} style={{ display: 'none' }} />
        </form>
      </div>
      <ElementPickerOverlay isPicking={elementPicker.isPicking} hoverRect={elementPicker.hoverRect} />

      {aiDlg.host}

      {openSettingKey && (
        <SettingQuickPanel settingKey={openSettingKey} onClose={() => setOpenSettingKey(null)} dark askApproval={aiDlg.approve} />
      )}
    </>
  );
}
