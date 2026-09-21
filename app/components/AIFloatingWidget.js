'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import SettingQuickPanel from './SettingQuickPanel';
import useElementPicker, { ElementPickerOverlay } from './useElementPicker';
import useScreenRecorder from './useScreenRecorder';
import useActionRecorder from './useActionRecorder';
import { captureElement, captureViewport, dataUrlToParts } from '../../lib/clientCapture';
import { uploadScreenRecording, prepareScreenRecordingUpload } from '../../lib/uploadScreenRecording';
import { formatActionSteps } from '../../lib/actionRecorderCore';

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
  const [showTableModal, setShowTableModal] = useState(false);
  const [modalTableData, setModalTableData] = useState(null);
  const [openSettingKey, setOpenSettingKey] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);

  // צילום/הקלטה מצורפים להודעה הבאה - ר' תוכנית Phase 3/4.
  const [pendingImage, setPendingImage] = useState(null); // data URL
  // "הסרטת מסך": pendingRecordingUrl = תצוגה מקדימה מקומית (blob URL, לא נשלח לשרת);
  // pendingRecordingMeta = מה שנשלח בפועל ל-AI: fileId של הוידאו בדרייב (אם הועלה) + רשימת הצעדים (מאקרו).
  const [pendingRecordingUrl, setPendingRecordingUrl] = useState(null);
  const [pendingRecordingMeta, setPendingRecordingMeta] = useState(null);
  const [showCaptureMenu, setShowCaptureMenu] = useState(false);
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
        alert('העלאת ההסרטה נכשלה.');
      }
    } finally {
      setIsUploadingRecording(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
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

  const parseMessageToLinks = (text) => {
    if (!text) return null;
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
          const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...parsed] };
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
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
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
    if ((!input.trim() && !pendingImage && !pendingRecordingUrl) || loading) return;

    const userMsg = input.trim() || (pendingRecordingUrl ? 'מה קרה בהסרטה הזו?' : 'מה רואים בתמונה הזו?');
    const imageToSend = pendingImage ? dataUrlToParts(pendingImage) : null;
    const recordingToSend = pendingRecordingUrl;
    let recordingMetaToSend = pendingRecordingMeta;
    const stillUploading = Boolean(recordingToSend && isUploadingRecording && uploadPromiseRef.current);
    setInput('');
    setPendingImage(null);
    setPendingRecordingUrl(null);
    setPendingRecordingMeta(null);

    // ההודעה מופיעה מיד; אם הוידאו עוד עולה, מסמנים אותה "מעלה הסרטה" והבקשה ל-AI יוצאת רק אחרי שההעלאה הסתיימה
    const userMessage = { role: 'user', content: userMsg, attachedImage: pendingImage, attachedRecording: recordingToSend, uploadingRecording: stillUploading };
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
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ${currentContext}אתה עוזר וירטואלי עבור עובדי הגמ"ח. מותר לך לספק נתונים על לקוחות, הזמנות, פריטים ומלאי כדי לעזור בשירות לקוחות. אסור לך לחשוף מידע על עובדים אחרים, משמרות או הרשאות. אסור לך להציג סטטיסטיקות כלליות, סיכומי רווחים, דוחות או פילוחים ניהוליים מתקדמים (אם העובד מבקש סטטיסטיקות כאלו, אמור לו שזה זמין רק בממשק מנהל).`,
          image: imageToSend,
          recordingFileId: recordingMetaToSend?.fileId || null,
          recordingSteps: recordingMetaToSend?.stepsText || null,
        }),
      });

      const data = await res.json();

      const assistantMessage = res.ok
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
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
    if (await window.customConfirm('האם אתה בטוח שברצונך לנקות את חלון השיחה?')) {
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
          onClick={() => { setModalTableData(tableData); setShowTableModal(true); }}
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
      alert("הדפדפן שלך אינו תומך בהקלטת קול.");
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
      alert(messages[event.error] || 'אירעה שגיאה בהקלטת הקול. נסו שוב.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const loadSession = (session) => {
    if (messages.length > 1 && !chatSessions.find(s => s.id === session.id)) {
      // eslint-disable-next-line react-hooks/purity -- runs inside the loadSession click handler, never during render
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
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
          className="print-hide ai-widget-fab"
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
      <div className="print-hide card ai-widget-panel" style={{
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
        <div style={{
          backgroundColor: 'var(--primary-solid)',
          color: 'var(--text-on-primary)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg data-element-name="רכיב_AIFloatingWidget_4" className="icon" style={{ width: '20px', height: '20px' }}>
              <use href="#i-star" />
            </svg>
            <span style={{ fontWeight: 'bold' }}>עוזר AI</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button data-element-name="כפתור_AIFloatingWidget_5"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
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
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ color: 'var(--text-on-primary)' }}
              title={isExpanded ? 'הקטן' : 'הגדל'}
            >
              {isExpanded ? (
                <svg data-element-name="רכיב_AIFloatingWidget_10" className="icon" style={{ transform: 'rotate(180deg)' }}><use href="#i-expand" /></svg>
              ) : (
                <svg data-element-name="רכיב_AIFloatingWidget_11" className="icon"><use href="#i-expand" /></svg>
              )}
            </button>
            <button data-element-name="כפתור_AIFloatingWidget_12"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => setIsOpen(false)}
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
                      <span style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.9rem' }}>{session.date}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.messages.length > 1 ? session.messages[1].content : 'שיחה ריקה'}
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
                const { displayText, links: openLinks } = extractOpenLinks(afterSettings);
                return (
                  <div key={idx} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                    <button
                      type="button"
                      className={`bubble-copy-btn${copiedIdx === idx ? ' copied' : ''}`}
                      title="העתק"
                      onClick={() => copyBubbleText(idx, msg.content)}
                    >
                      <svg className="icon"><use href={`#${copiedIdx === idx ? 'i-check' : 'i-copy'}`} /></svg>
                    </button>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{parseMessageToLinks(displayText)}</div>
                    {msg.attachedImage && (
                      <img src={msg.attachedImage} alt="צילום מצורף" style={{ maxWidth: 180, maxHeight: 140, borderRadius: 6, marginTop: 6, display: 'block' }} />
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
        {(pendingImage || pendingRecordingUrl || isUploadingRecording) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            {pendingImage && (
              <div style={{ position: 'relative' }}>
                <img src={pendingImage} alt="צילום ממתין" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                <button type="button" onClick={() => setPendingImage(null)} style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 16, height: 16, borderRadius: '50%', background: 'var(--danger-solid)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>×</button>
              </div>
            )}
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
                  type="button"
                  onClick={() => setShowCaptureMenu((v) => !v)}
                  className="icon-btn"
                  title="צרף צילום/הסרטת מסך"
                >
                  <svg className="icon"><use href="#i-grid" /></svg>
                </button>
                {showCaptureMenu && (
                  <div style={{
                    position: 'absolute', bottom: '110%', insetInlineStart: 0,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-lg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
                    minWidth: 190, zIndex: 10,
                  }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={startElementCaptureForChat}>
                      <svg className="icon"><use href="#i-pin" /></svg>
                      צלם אזור באתר
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={captureFullScreenForChat}>
                      <svg className="icon"><use href="#i-grid" /></svg>
                      צלם את כל המסך
                    </button>
                    {recordingEnabled && (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={toggleRecording}>
                        <svg className="icon"><use href="#i-activity" /></svg>
                        הסרטת מסך
                      </button>
                    )}
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
        </form>
      </div>
      <ElementPickerOverlay isPicking={elementPicker.isPicking} hoverRect={elementPicker.hoverRect} />

      {/* Table Modal */}
      {showTableModal && modalTableData && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal" style={{ maxWidth: 900, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-grid" /></svg>
                נתונים ({modalTableData.length} שורות)
              </strong>
              <button data-element-name="כפתור_AIFloatingWidget_21"
                type="button"
                className="btn btn-ghost btn-icon-only btn-sm"
                onClick={() => setShowTableModal(false)}
              >
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div style={{ padding: '18px 22px', overflow: 'auto', flex: 1 }}>
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        {Object.keys(modalTableData[0]).map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modalTableData.map((row, i) => (
                        <tr key={i}>
                          {Object.keys(modalTableData[0]).map(h => (
                            <td key={h}>{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {openSettingKey && (
        <SettingQuickPanel settingKey={openSettingKey} onClose={() => setOpenSettingKey(null)} />
      )}
    </>
  );
}
