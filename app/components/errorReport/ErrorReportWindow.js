'use client';

// חלון "דיווח על שגיאות" - העיצוב שאושר ב-4.10.2026 (עיצוב B: כרטיס צף מעוגן לאייקון + פאנל "פניות שלי" מינימלי;
// בנייד: גיליון תחתון). המקור: תצוגות-עיצוב/דיווח-שגיאות-סקיצות-2.html + scratch/error-report-sketches-NOTES.md
// (סבבים 1-4) + הוראות הבעלים מ-4.10.2026: בלי תפריט ⋯ (במקומו כפתורים עגולים כחולים של הפלטה עם טולטיפ; פעולות
// מתכנת רק למתכנת), "אוף! אני צריך מענה אנושי!" בתוך גוף השיחה, שמות השולחים בזהב, שורות הצעדים שהוקלטו לא מוצגות
// למדווח (רק למתכנת, מקופלות).
// נטען בעצלות (next/dynamic) מ-ErrorReportButton.js רק כשפותחים את החלון - ה-CSS של הפלטה לא נכנס לכל דף במעטפת הישנה.
// החוזה מול השרת זהה לחלון הישן - ר' docs/error-report-new-design-2026-10-04.md ו-scripts/test_error_report_ui.mjs.
import '@/design-system/components.css';
import './errorReport.css';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { fetchSharedJson, fetchFreshJson, TTL } from '../../../lib/apiCache';
import { captureElement, captureViewport } from '../../../lib/clientCapture';
import useElementPicker, { describeElement } from '../useElementPicker';
import useActionRecorder from '../useActionRecorder';
import useScreenRecorder from '../useScreenRecorder';
import { uploadScreenRecording, prepareScreenRecordingUpload } from '../../../lib/uploadScreenRecording';
import { ATTACHMENT_FILE_INPUT_ACCEPT, MAX_ATTACHMENT_FILES_TOTAL_BYTES, isAllowedAttachmentFile } from '../../../lib/attachmentFileTypes';
import { formatActionSteps } from '../../../lib/actionRecorderCore';
import { MenuSprite } from '../menu/menuParts';
import { useA5Shell } from '../menu/A5ShellContext';
import * as M from './erModel';
import { AttChip, Composer, Ic, RoundBtn, Spin, Thumb } from './erParts';
import PageVariantToggle from '../variant/PageVariantToggle';

const NARROW_PX = 640; // גיליון תחתון
const SPLIT_PX = 900; // פאנל: רשימה + שרשור זה לצד זה
const CARD_W = 392;
const REPORTS_LIST_MAX_AGE_MS = 60 * 1000; // הרשימה המלאה במטמון המשותף (fetchFreshJson) - ראה fetchReports
const TOAST_MS = { info: 2600, other: 6500 };
const hebrewDateTime = (d) => `${getHebrewDateString(d)} ${new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
const isTouch = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover:none)').matches;
const readDataUrl = (f) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(f);
});
// צרופה ממתינה פנימית: { id, k: 'el'|'shot'|'file'|'vid', value } - value בפורמט שהשרת מקבל (data URL / gdrive:<id> / {name,size,dataUrl})
let attSeq = 0;
const mkAtt = (k, value) => ({ id: `a${++attSeq}`, k, value });
const attValues = (list) => list.map((a) => a.value);

export default function ErrorReportWindow({ command, perms, onOpenChange, onData }) {
  const shell = useA5Shell();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  const narrow = vw <= NARROW_PX;
  const split = vw > SPLIT_PX;

  // ---- פתיחה / מצב ----
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('card'); // 'card' (טופס דיווח) | 'panel' (פניות שלי)
  const [hidden, setHidden] = useState(false); // מוסתר זמנית: צילום מסך, הקלטה, סימון בנייד
  const anchorRef = useRef(null);
  const [popPos, setPopPos] = useState(null);

  // ---- נתונים ----
  const [reports, setReports] = useState([]);
  const [isProgrammer, setIsProgrammer] = useState(!!perms?.isProgrammer);
  const [isManager, setIsManager] = useState(!!(perms?.isManager ?? perms?.isProgrammer));
  const [settings, setSettings] = useState({ handledAtBottom: true, humanButtonEnabled: true, recordingEnabled: false });
  const authFailedRef = useRef(false);
  const fetchSeqRef = useRef(0);

  // ---- טופס דיווח חדש ----
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const [failMsg, setFailMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState([]); // { selector, text, label, el, attId }
  const [newAtts, setNewAtts] = useState([]);
  const [steps, setSteps] = useState('');
  const textRef = useRef(null);

  // ---- תגובה בשרשור ----
  const [replyText, setReplyText] = useState('');
  const [replyAtts, setReplyAtts] = useState([]);
  const [replySteps, setReplySteps] = useState('');
  const [replyQ, setReplyQ] = useState(false); // מתכנת בלבד: "סמן שיש שאלה פתוחה למדווח" (ErrorReportReply.isQuestion)
  const [replying, setReplying] = useState(false);
  const replyRef = useRef(null);
  const [skReject, setSkReject] = useState(null);
  const [skNote, setSkNote] = useState('');
  const [skBusy, setSkBusy] = useState(false);
  const [requestingHuman, setRequestingHuman] = useState(false);

  // ---- פאנל ----
  const [archTab, setArchTab] = useState(false);
  const [selId, setSelId] = useState(null);
  const [threadOnly, setThreadOnly] = useState(false); // ברוחב צר: מוצג השרשור במקום הרשימה
  const [q, setQ] = useState('');
  const [fresh, setFresh] = useState(null);
  const scrollRef = useRef(null);
  const listRef = useRef(null);
  const listScroll = useRef({ list: 0, archive: 0 });
  const toBottomRef = useRef(false);

  // ---- שונות ----
  const [lightbox, setLightbox] = useState(null); // { info } | { sketchId }
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [reveal, setReveal] = useState(false);
  const [flash, setFlash] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [recording, setRecording] = useState(null); // { mode: 'steps'|'video', ctx }
  const [stepCount, setStepCount] = useState(0);
  const [pickCtx, setPickCtx] = useState(null);
  const pickCtxRef = useRef('new');
  const pickingRef = useRef(false);
  const fileInputRef = useRef(null);
  const fileCtxRef = useRef('new');
  const [recordingCtx, setRecordingCtx] = useState('new'); // לאיזה הקשר שייכת ההסרטה שעולה כרגע (טופס / תגובה)

  // ---- מתכנת: הסוכן האוטומטי ופריסות (app/api/agent/fix-loop) ----
  const [agentLoopEnabled, setAgentLoopEnabled] = useState(false);
  const [agentLoopBusy, setAgentLoopBusy] = useState(false);
  const [deployEnabled, setDeployEnabled] = useState(true);
  const [deployBusy, setDeployBusy] = useState(false);

  const canNew = isManager || isProgrammer;
  // ההרשאות מהבדיקה הקלה של הכפתור (לפני שהקריאה המלאה חזרה)
  useEffect(() => {
    if (!perms || !perms.known) return;
    setIsProgrammer(!!perms.isProgrammer);
    setIsManager(!!(perms.isManager ?? perms.isProgrammer));
  }, [perms]);

  // ===================================================================== toast
  const showToast = useCallback((message, type = 'info') => {
    const kind = type === 'error' ? 'charge' : type === 'success' ? 'credit' : 'info';
    const icon = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info';
    clearTimeout(toastTimer.current);
    setToast({ n: Date.now(), kind, icon, message });
    toastTimer.current = setTimeout(() => setToast(null), kind === 'info' ? TOAST_MS.info : TOAST_MS.other);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ===================================================================== data
  // הפאנל פתוח: קריאה מלאה (רשימה, תגובות, צרופות). הבדיקה התקופתית הקלה (?light=1) נשארה ב-ErrorReportButton.js.
  const fetchReports = useCallback(async () => {
    if (authFailedRef.current) return null;
    const seq = ++fetchSeqRef.current;
    try {
      // CPU 5.10.2026: הרשימה המלאה (עד ~270KB) נשמרת במטמון המשותף ל-60 שנ' - פתיחה/סגירה חוזרת של החלון לא פונה לשרת (70% מהקריאות חזרו
      // תוך דקה). כל כתיבה לדיווחים (שליחה, תגובה, ארכוב, סימון נקרא, החלטה על סקיצה) מבטלת אותה אוטומטית (lib/apiCache.js),
      // וכך גם שינוי במונה "לא נקראו" בבדיקה הקלה (ErrorReportButton). הבדיקה הקלה (?light=1) לא עוברת כאן.
      let data;
      try {
        data = await fetchFreshJson('/api/error-report', { maxAge: REPORTS_LIST_MAX_AGE_MS });
      } catch (e) {
        const m = (e && e.message) || '';
        if (m.includes('HTTP 401')) { authFailedRef.current = true; return null; }
        if (/^HTTP \d+/.test(m)) return null;
        throw e;
      }
      if (seq !== fetchSeqRef.current) return null;
      if (data.success) {
        const list = [...(data.reports || [])]; // עותק: הרשימה במטמון משותפת ואסור שתשתנה במקום
        const prog = data.isProgrammer || false;
        setReports(list);
        setIsProgrammer(prog);
        setIsManager(data.isManager ?? data.isProgrammer ?? false);
        onData && onData(list, prog);
        return list;
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
    return null;
  }, [onData]);

  useEffect(() => {
    // /api/settings משותף (מטמון apiCache, 5 דק') - לפני כן כל טעינת דף משכה את כל ההגדרות (~66KB) שוב רק בשביל מפתח אחד.
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const s = data.find((x) => x.key === 'error_report_handled_at_bottom');
        const h = data.find((x) => x.key === 'error_report_human_button_enabled');
        const rec = data.find((x) => x.key === 'ai_screen_recording_enabled');
        setSettings({ handledAtBottom: s ? s.value !== 'false' : true, humanButtonEnabled: h ? h.value !== 'false' : true, recordingEnabled: rec?.value === 'true' });
      })
      .catch(() => {});
  }, []);

  const fetchAgentLoopStatus = useCallback(async () => {
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
  }, []);
  useEffect(() => { if (isProgrammer) fetchAgentLoopStatus(); }, [isProgrammer, fetchAgentLoopStatus]);

  // ===================================================================== open / close
  const close = useCallback(() => {
    setOpen(false);
    setHidden(false);
    setReveal(false);
    setLightbox(null);
    const a = anchorRef.current;
    if (a && a.isConnected && typeof a.focus === 'function') a.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!command) return;
    if (command.type === 'close') { close(); return; }
    anchorRef.current = command.anchor || anchorRef.current;
    setMode(command.mode || 'card');
    setHidden(false);
    setOpen(true);
    fetchReports();
  }, [command]);

  useEffect(() => { onOpenChange && onOpenChange(open); }, [open, onOpenChange]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // מיקוד תיבת הטקסט בפתיחת הטופס (במחשב)
  useEffect(() => {
    if (open && mode === 'card' && canNew && !narrow && !hidden) {
      const t = setTimeout(() => textRef.current && textRef.current.focus({ preventScroll: true }), 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, mode, canNew, narrow, hidden]);

  // ===================================================================== card placement (desktop)
  const placePop = useCallback(() => {
    const w = Math.min(CARD_W, window.innerWidth - 16);
    const a = anchorRef.current;
    const isFab = !!(a && a.closest && a.closest('#erFab'));
    if (isFab) {
      const r = a.getBoundingClientRect();
      const left = Math.max(8, window.innerWidth - w - 14);
      const fabTop = r.top;
      setPopPos({ w, left, bottom: Math.round(window.innerHeight - fabTop + 14), ax: Math.round(r.left + r.width / 2 - left), up: true, maxH: Math.max(240, Math.round(fabTop - 64 - 30)) });
      return;
    }
    let r = a && a.isConnected ? a.getBoundingClientRect() : null;
    if (!r || !r.width) r = { left: window.innerWidth - 60, width: 40, bottom: 56 };
    let left = Math.round(r.left + r.width / 2 - w / 2);
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    setPopPos({ w, left, top: Math.round(r.bottom + 12), ax: Math.round(r.left + r.width / 2 - left), up: false, navB: Math.round(r.bottom) });
  }, []);
  useLayoutEffect(() => {
    if (!open || mode !== 'card' || narrow) return undefined;
    placePop();
    window.addEventListener('resize', placePop);
    window.addEventListener('scroll', placePop, { passive: true });
    return () => { window.removeEventListener('resize', placePop); window.removeEventListener('scroll', placePop); };
  }, [open, mode, narrow, placePop, vw]);

  // ===================================================================== tooltip (.pl-tt, טולטיפ המערכת)
  const showTip = useCallback((el) => {
    const tt = ttRef.current;
    if (!tt || !el) return;
    tt.textContent = el.getAttribute('data-tip');
    tt.classList.add('on');
    const r = el.getBoundingClientRect();
    const w = tt.offsetWidth;
    const h = tt.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(10, Math.min(window.innerWidth - w - 10, x));
    let y = r.top - h - 10;
    if (y < 8) y = r.bottom + 10;
    tt.style.left = `${x}px`;
    tt.style.top = `${y}px`;
  }, []);
  useEffect(() => {
    const root = rootRef.current;
    const tt = ttRef.current;
    if (!root || !tt) return undefined;
    let cur = null;
    let touchAt = 0;
    const hide = () => { tt.classList.remove('on'); cur = null; };
    // הלחיצה שהדפדפן מייצר אחרי נגיעה לא מסתירה את התאריך שהנגיעה בבועה הציגה
    const hideOnClick = () => { if (Date.now() - touchAt > 700) hide(); };
    const over = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t !== cur) { cur = t; showTip(t); } else if (!t && cur) hide(); };
    // אחרי נגיעה הדפדפן מייצר אירועי עכבר מדומים (mouseover/mouseout) - הם לא מסתירים את מה שהנגיעה הציגה
    const out = (e) => { if (Date.now() - touchAt < 1800) return; if (e.target.closest && e.target.closest('[data-tip]')) hide(); };
    const fin = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) { cur = t; showTip(t); } };
    // נגיעה בבועה מציגה את התאריך והשעה (במחשב: ריחוף / מיקוד)
    const touch = (e) => {
      const b = e.target.closest && e.target.closest('.er3-b');
      if (b && !e.target.closest('[data-tip]:not(.er3-b)')) { touchAt = Date.now(); cur = b; showTip(b); setTimeout(hide, 1800); }
    };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseout', out);
    root.addEventListener('focusin', fin);
    root.addEventListener('focusout', out);
    root.addEventListener('click', hideOnClick, true);
    root.addEventListener('touchstart', touch, { passive: true });
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', fin);
      root.removeEventListener('focusout', out);
      root.removeEventListener('click', hideOnClick, true);
      root.removeEventListener('touchstart', touch);
      window.removeEventListener('scroll', hide);
    };
  }, [showTip]);

  // אחרי צירוף (סימון / צילום / קובץ / הקלטה) - המיקוד חוזר לתיבת הטקסט (במחשב), כמו בסקיצה
  const refocus = (ctx) => {
    if (typeof window === 'undefined' || window.innerWidth <= NARROW_PX) return;
    setTimeout(() => { const t = ctx === 'reply' ? replyRef.current : textRef.current; if (t) t.focus({ preventScroll: true }); }, 60);
  };

  // ===================================================================== element picker
  const handlePicked = useCallback(async (el) => {
    pickingRef.current = false;
    setPickCtx(null);
    const described = describeElement(el);
    const capture = await captureElement(el);
    const att = capture ? mkAtt('el', capture.dataUrl) : null;
    if (pickCtxRef.current === 'reply') {
      if (described) setReplyText((prev) => `${prev ? prev + ' ' : ''}[אלמנט מסומן: ${described.label}]`);
      if (att) setReplyAtts((prev) => [...prev, att]);
    } else {
      if (described) setPicked((prev) => [...prev, { ...described, el, attId: att ? att.id : null }]);
      if (att) setNewAtts((prev) => [...prev, att]);
      setBad(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 1900);
    }
    setHidden(false);
    setOpen(true);
    refocus(pickCtxRef.current);
  }, []);
  // ה-Esc של מצב הסימון נתפס קודם (capture) - משחררים את הדגל רק אחרי שהאירוע סיים, כדי שה-Esc לא יסגור גם את החלון
  const onPickCancel = useCallback(() => { setTimeout(() => { pickingRef.current = false; }, 0); setPickCtx(null); setHidden(false); }, []);
  const picker = useElementPicker(handlePicked, { ignore: '.gm-er', onCancel: onPickCancel });
  const startPicking = (ctx) => {
    if (picker.isPicking) { picker.cancelPicking(); onPickCancel(); return; }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    pickCtxRef.current = ctx;
    pickingRef.current = true;
    setPickCtx(ctx);
    // בנייד הגיליון מכסה את העמוד - מוסתר עד שמסמנים; במחשב הכרטיס נשאר פתוח
    if (narrow || mode === 'panel') setHidden(true);
    picker.startPicking();
  };
  useEffect(() => {
    if (picker.isPicking) document.body.classList.add('gm-er-picking');
    else document.body.classList.remove('gm-er-picking');
    return () => document.body.classList.remove('gm-er-picking');
  }, [picker.isPicking]);

  // ===================================================================== screenshot
  const captureFullScreen = async (ctx) => {
    setHidden(true);
    // לתת לחלון להיעלם לפני הצילום, כדי שהוא לא ייכנס לתמונה עצמה
    await new Promise((resolve) => setTimeout(resolve, 150));
    const capture = await captureViewport();
    setHidden(false);
    if (!capture) { showToast('צילום המסך נכשל', 'error'); return; }
    const att = mkAtt('shot', capture.dataUrl);
    if (ctx === 'reply') setReplyAtts((prev) => [...prev, att]);
    else setNewAtts((prev) => [...prev, att]);
    refocus(ctx);
  };

  // ===================================================================== files (אותן בדיקות: סוג מותר, עד 3MB בסך הכל)
  const openFilePicker = (ctx) => { fileCtxRef.current = ctx; fileInputRef.current && fileInputRef.current.click(); };
  const handleFilesChosen = async (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    if (!chosen.length) return;
    const ctx = fileCtxRef.current;
    const current = attValues(ctx === 'reply' ? replyAtts : newAtts);
    const checked = M.validateFiles(chosen, current, { isAllowed: isAllowedAttachmentFile, maxBytes: MAX_ATTACHMENT_FILES_TOTAL_BYTES });
    const added = [];
    for (const c of checked) {
      if (!c.ok) { showToast(c.error, 'error'); continue; }
      const dataUrl = await readDataUrl(c.file);
      if (!dataUrl) { showToast(`קריאת "${c.file.name}" נכשלה`, 'error'); continue; }
      added.push(mkAtt('file', { name: c.file.name, size: c.file.size, dataUrl }));
    }
    if (!added.length) return;
    if (ctx === 'reply') setReplyAtts((prev) => [...prev, ...added]);
    else setNewAtts((prev) => [...prev, ...added]);
    refocus(ctx);
  };

  // ===================================================================== recording (פעולות / הסרטת מסך)
  const actionRecorder = useActionRecorder();
  const screenRecorder = useScreenRecorder();
  const setStepsFor = (ctx, t) => (ctx === 'reply' ? setReplySteps(t) : setSteps(t));
  const addAttFor = (ctx, att) => (ctx === 'reply' ? setReplyAtts((p) => [...p, att]) : setNewAtts((p) => [...p, att]));

  const startStepsRecording = (ctx) => {
    setRecordingCtx(ctx);
    setHidden(true);
    setStepCount(0);
    setRecording({ mode: 'steps', ctx });
    actionRecorder.start();
  };
  const finishStepsRecording = () => {
    const ctx = recording ? recording.ctx : 'new';
    const t = formatActionSteps(actionRecorder.stop());
    setRecording(null);
    setStepsFor(ctx, t);
    setHidden(false);
    setOpen(true);
    if (!t) showToast('לא נרשמו פעולות — נסה שוב', 'info');
    refocus(ctx);
  };
  const startVideoRecording = async (ctx) => {
    setRecordingCtx(ctx);
    setHidden(true);
    setStepCount(0);
    setRecording({ mode: 'video', ctx });
    actionRecorder.start();
    // פותחים את ההעלאה לדרייב כבר עכשיו - הפנייה לגשר איטית, וכך היא רצה בזמן ההסרטה
    const prepared = prepareScreenRecordingUpload('error-report');
    prepared.catch(() => {});
    const blob = await screenRecorder.start();
    const t = formatActionSteps(actionRecorder.stop());
    setRecording(null);
    setHidden(false);
    setOpen(true);
    if (t) setStepsFor(ctx, t);
    if (!blob) { showToast(t ? 'ההסרטה נעצרה — הפעולות נשמרו, בלי וידאו' : 'ההסרטה בוטלה', 'info'); return; }
    setVideoUploading(true);
    try {
      const fileId = await uploadScreenRecording(blob, prepared, 'error-report');
      addAttFor(ctx, mkAtt('vid', `gdrive:${fileId}`));
    } catch (err) {
      if (err.code !== 'DRIVE_NOT_CONFIGURED') console.error('Failed to upload screen recording:', err);
      showToast(t ? 'העלאת הוידאו נכשלה — הפעולות נשמרו' : 'העלאת ההסרטה נכשלה', 'error');
    } finally {
      setVideoUploading(false);
    }
  };
  const finishRecording = () => {
    if (recording && recording.mode === 'video') screenRecorder.stop();
    else finishStepsRecording();
  };
  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setStepCount(actionRecorder.getCount()), 400);
    return () => clearInterval(id);
  }, [recording, actionRecorder]);

  // ===================================================================== send (POST /api/error-report)
  const handleSubmit = async () => {
    if (!canNew) { showToast('יצירת דיווח חדש מותרת למנהלים בלבד', 'error'); return; }
    if (!text.trim()) {
      setBad(true);
      showToast('יש להזין תיאור שגיאה', 'error');
      textRef.current && textRef.current.focus();
      return;
    }
    if (videoUploading) { showToast('ההסרטה עדיין עולה — נא להמתין רגע', 'info'); return; }
    setBad(false);
    setFailMsg('');
    setSending(true);
    // המיקוד נשאר בתיבת הטקסט בזמן השליחה (ואחרי כשל - כדי לתקן ולשלוח שוב), כמו בסקיצה
    if (!narrow && textRef.current) textRef.current.focus({ preventScroll: true });
    showToast('שולח דיווח למתכנת, אנא המתן...', 'info');
    const payload = M.buildReportPayload({
      userText: text,
      pickedElements: picked,
      recordedSteps: steps,
      attachments: attValues(newAtts),
      href: window.location.href,
      search: window.location.search,
      docTitle: document.title,
      time: getHebrewDateString(new Date()) + ' ' + new Date().toLocaleTimeString('he-IL'),
      lastButtons: window.__lastButtons || [],
    });
    try {
      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('הדיווח נשלח בהצלחה למתכנת! תודה.', 'success');
        setText('');
        setPicked([]);
        setNewAtts([]);
        setSteps('');
        const newId = data.report && data.report.id;
        // הדיווח החדש מוצג מיד (נבחר בפאנל); הקריאה המלאה שאחריו משלימה שם/תגובות
        if (newId) setReports((prev) => (prev.some((r) => r.id === newId) ? prev : [{ replies: [], ...data.report }, ...prev]));
        setFresh(newId || null);
        setArchTab(false);
        setQ('');
        setThreadOnly(false);
        setSelId(split && newId ? newId : null);
        setMode('panel');
        fetchReports();
      } else {
        const msg = data.error || 'שגיאה בשליחת דיווח';
        setFailMsg(msg);
        showToast(msg, 'error');
      }
    } catch {
      setFailMsg('שגיאת תקשורת. הדיווח לא נשלח, אפשר לנסות שוב.');
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSending(false);
    }
  };

  // ===================================================================== thread actions
  const selected = useMemo(() => reports.find((r) => r.id === selId) || null, [reports, selId]);
  const patchSelected = (id, fn) => setReports((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));

  const openThread = async (report) => {
    setSelId(report.id);
    setThreadOnly(true);
    setReplyText('');
    setReplyAtts([]);
    setReplySteps('');
    setReplyQ(false);
    setSkReject(null);
    toBottomRef.current = (report.replies || []).length > 4;
    const needMarkRead = M.isUnread(report, isProgrammer);
    if (needMarkRead) {
      setReports((prev) => prev.map((r) => (r.id === report.id ? {
        ...r,
        isReadByProgrammer: isProgrammer ? true : r.isReadByProgrammer,
        isReadByUser: !isProgrammer ? true : r.isReadByUser,
      } : r)));
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
      } catch { /* הסימון נשמר בפעם הבאה */ }
    }
  };
  // אחרי שינוי מקומי (נקרא) - המונה על האייקון מתעדכן
  useEffect(() => { if (reports.length || open) onData && onData(reports, isProgrammer, true); }, [reports]);

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return;
    if (videoUploading) { showToast('ההסרטה עדיין עולה — נא להמתין רגע', 'info'); return; }
    setReplying(true);
    try {
      const res = await fetch('/api/error-report/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(M.buildReplyPayload({ reportId: selected.id, text: replyText, steps: replySteps, isQuestion: isProgrammer && replyQ, attachments: attValues(replyAtts) })),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReplyText('');
        setReplyQ(false);
        setReplyAtts([]);
        setReplySteps('');
        patchSelected(selected.id, (r) => ({ ...r, replies: [...(r.replies || []), data.reply] }));
        toBottomRef.current = true;
        fetchReports();
      } else {
        showToast(data.error || 'שגיאה בשליחת תגובה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setReplying(false);
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
        patchSelected(report.id, (r) => ({ ...r, status }));
        if (selId === report.id) { setSelId(null); setThreadOnly(false); }
        showToast(status === 'ARCHIVED' ? 'הדיווח הועבר לארכיון' : 'הדיווח שוחזר מהארכיון', 'success');
      } else {
        showToast(data.error || 'שגיאה בעדכון הדיווח', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    }
  };

  // "טופל" - עצמאי לגמרי מהעברה לארכיון
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
        patchSelected(report.id, (r) => ({ ...r, isHandled: newHandled }));
        showToast(newHandled ? 'הפנייה סומנה כטופלה' : 'סימון "טופל" הוסר', 'success');
      } else {
        showToast(data.error || 'שגיאה בעדכון הדיווח', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    }
  };

  const requestHumanReply = async () => {
    if (!selected || requestingHuman) return;
    setRequestingHuman(true);
    try {
      const res = await fetch('/api/error-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selected.id, needsHuman: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        patchSelected(selected.id, (r) => ({ ...r, needsHuman: true }));
        showToast('הבקשה נשלחה - התמיכה תענה לך בעצמה בקרוב', 'success');
      } else {
        showToast(data.error || 'שגיאה בשליחת הבקשה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setRequestingHuman(false);
    }
  };

  const copyDetails = (report) => {
    const details = M.systemDetailsText(report, getHebrewDateString);
    navigator.clipboard.writeText(details).then(() => showToast('הפרטים הועתקו ללוח!', 'success')).catch(() => showToast('ההעתקה נכשלה', 'error'));
  };

  const decideSketch = async (reply, decision) => {
    setSkBusy(true);
    try {
      const res = await fetch('/api/error-report/sketch-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyId: reply.id, decision, note: decision === 'REJECTED' ? skNote : '' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        patchSelected(selected.id, (r) => ({
          ...r,
          replies: [...(r.replies || []).map((x) => (x.id === reply.id ? { ...x, sketchStatus: decision } : x)), ...(data.reply ? [data.reply] : [])],
        }));
        setSkReject(null);
        setSkNote('');
        toBottomRef.current = true;
        fetchReports();
      } else {
        showToast(data.error || 'שגיאה בשמירת ההחלטה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSkBusy(false);
    }
  };

  const toggleAgentLoop = async () => {
    if (agentLoopBusy) return;
    setAgentLoopBusy(true);
    try {
      const res = await fetch('/api/agent/fix-loop', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !agentLoopEnabled }) });
      const data = await res.json();
      if (res.ok && data.success) {
        setAgentLoopEnabled(data.enabled);
        showToast(data.enabled ? 'הסוכן האוטומטי הופעל - יבדוק דיווחים פתוחים כל כמה דקות' : 'הסוכן האוטומטי כובה');
      } else showToast(data.error || 'שגיאה בעדכון מצב הסוכן', 'error');
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
    try {
      const res = await fetch('/api/agent/fix-loop', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deployEnabled: !deployEnabled }) });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeployEnabled(data.deployEnabled);
        showToast(data.deployEnabled ? 'הסוכן מורשה לפרוס תיקונים (לפתוח ענף+PR) בוורסל' : 'פריסות מהסוכן כבויות - הוא ימשיך לענות ולחקור, בלי לפתוח ענף/PR');
      } else showToast(data.error || 'שגיאה בעדכון מצב הפריסה', 'error');
    } catch (err) {
      console.error('Error toggling agent deploy flag:', err);
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setDeployBusy(false);
    }
  };

  // ===================================================================== keyboard
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (pickingRef.current || recording) return;
      if (lightbox) { e.preventDefault(); setLightbox(null); return; }
      e.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, lightbox, recording, close]);

  // ===================================================================== list derivations
  const openGroups = useMemo(() => M.groupOpenReports(reports, { isProgrammer, handledAtBottom: settings.handledAtBottom }), [reports, isProgrammer, settings.handledAtBottom]);
  const archived = useMemo(() => M.archivedReports(reports), [reports]);
  const baseRows = archTab ? archived : [...openGroups.top, ...openGroups.others];
  const rows = M.filterBySearch(baseRows, q);
  const waiting = M.waitingCount(reports, isProgrammer);

  // ברוחב מלא נבחר אוטומטית שרשור (הראשון שדורש תשומת לב, אחרת הראשון) - בלי לסמן אותו "נקרא"
  useEffect(() => {
    if (!open || mode !== 'panel') return;
    const inList = selId && rows.some((r) => r.id === selId);
    if (!inList && split && rows.length) {
      const pick = rows.find((r) => M.needsAttention(r, isProgrammer)) || rows[0];
      setSelId(pick.id);
    } else if (!inList && selId && !rows.length) setSelId(null);
  }, [open, mode, split, rows, selId, isProgrammer]);

  // שרשור ארוך נפתח בתחתית; אחרי תגובה - גלילה לתחתית
  useLayoutEffect(() => {
    if (toBottomRef.current && scrollRef.current) {
      toBottomRef.current = false;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });
  // מיקום הגלילה ברשימה נשמר לכל לשונית
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listScroll.current[archTab ? 'archive' : 'list'] || 0;
  }, [archTab, mode]);

  // גובה תיבת התגובה: 2 שורות, גדלה עד 150px
  useLayoutEffect(() => {
    const t = replyRef.current;
    if (!t) return;
    t.style.height = 'auto';
    const h = t.scrollHeight;
    if (h < 20) { t.style.height = ''; return; }
    t.style.height = `${Math.min(h + 1, 150)}px`;
  }, [replyText, selId, mode, open]);

  // ===================================================================== marks on the page (picked elements)
  const [marks, setMarks] = useState([]);
  const showMarks = open && !hidden && mode === 'card' && picked.length > 0;
  useEffect(() => {
    if (!showMarks) { setMarks([]); return undefined; }
    let raf = 0;
    const tick = () => {
      setMarks(picked.map((p) => {
        if (!p.el || !p.el.isConnected) return null;
        const r = p.el.getBoundingClientRect();
        return { left: r.left - 4, top: r.top - 4, width: r.width + 8, height: r.height + 8 };
      }));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [showMarks, picked]);

  // ===================================================================== render helpers
  const acts = (ctx) => {
    const rpl = ctx === 'reply';
    const list = rpl ? replyAtts : newAtts;
    const st = rpl ? replySteps : steps;
    const pickN = rpl ? list.filter((a) => a.k === 'el').length : picked.length;
    const cnt = (k) => list.filter((a) => a.k === k).length;
    return [
      { k: 'pick', icon: 'crosshair', t: pickN ? 'אלמנט נוסף' : 'סימון אלמנט', h: 'הצבעה על המקום הבעייתי בעמוד', count: pickN, on: pickCtx === ctx, onClick: () => startPicking(ctx) },
      { k: 'shot', icon: 'camera', t: 'צילום מסך', h: 'תמונה של כל המסך', count: cnt('shot'), onClick: () => captureFullScreen(ctx) },
      { k: 'file', icon: 'clip', t: 'קובץ מהמחשב', h: 'וורד, אקסל, PDF, טקסט או תמונה - עד 3MB בסך הכל', count: cnt('file'), onClick: () => openFilePicker(ctx) },
      ...(settings.recordingEnabled ? [{ k: 'video', icon: 'video', t: videoUploading ? 'מעלה...' : 'הסרטת מסך', h: 'וידאו + הפעולות שלך', count: cnt('vid'), disabled: videoUploading, spin: videoUploading, onClick: () => startVideoRecording(ctx) }] : []),
      { k: 'steps', icon: 'cursor-rec', t: st ? 'פעולות מחדש' : 'הקלטת פעולות', h: 'רישום הלחיצות וההקלדות, בלי וידאו ובלי שיתוף מסך', count: st ? st.split('\n').length : 0, onClick: () => startStepsRecording(ctx) },
    ];
  };
  const removeAtt = (ctx, att) => {
    if (ctx === 'reply') { setReplyAtts((p) => p.filter((a) => a.id !== att.id)); return; }
    setNewAtts((p) => p.filter((a) => a.id !== att.id));
    if (att.k === 'el') setPicked((p) => p.filter((x) => x.attId !== att.id));
  };
  const removePicked = (i) => {
    const p = picked[i];
    setPicked((prev) => prev.filter((_, j) => j !== i));
    if (p && p.attId) setNewAtts((prev) => prev.filter((a) => a.id !== p.attId));
  };
  const thumbs = (ctx, list) => {
    const up = videoUploading && recordingCtx === ctx;
    if (!list.length && !up) return null;
    return (
      <div className="er-thumbs">
        {list.map((a, i) => {
          const info = M.pendingInfo(a.value, i);
          return <Thumb key={a.id} info={info} onOpen={() => setLightbox({ info })} onRemove={() => removeAtt(ctx, a)} />;
        })}
        {up ? <Thumb info={{ kind: 'video', label: 'הסרטת מסך', name: '', src: '' }} uploading /> : null}
      </div>
    );
  };
  // צעדים שהוקלטו (בטופס/בתגובה): רק "נרשמו N צעדים" + הסר. שורות הצעדים עצמן לא מוצגות למשתמש (החלטת הבעלים 4.10.2026).
  const stepsChip = (st, onRemove) => (st ? (
    <div className="er-stp-b">
      <div className="er-stp-h"><Ic n="check" />נרשמו {M.stepsCountLabel(st.split('\n').length)}<button type="button" className="btn ghost" onClick={onRemove}>הסר</button></div>
    </div>
  ) : null);

  const sendBtn = sending ? (
    <button type="button" className="er-send" disabled aria-label="שולח"><Spin /></button>
  ) : videoUploading ? (
    <button type="button" className="er-send" disabled aria-label="מעלה הסרטה" data-tip="מעלה הסרטה..."><Spin /></button>
  ) : (
    <button type="button" className="er-send" data-act="send" data-ico="send" aria-label="שליחה למתכנת" data-tip="שליחה למתכנת" onClick={handleSubmit}><Ic n="send" inBtn /></button>
  );

  const xBtn = (onClick) => (
    <button type="button" className="ibtn er-sm er-x0" data-ico="x" aria-label="סגירה" data-tip="סגור" onClick={onClick}><Ic n="x" cls="sm" inBtn /></button>
  );

  // ----- card (new report) -----
  const cardBody = () => (
    <>
      <div className="er-hd">
        {xBtn(close)}
        <span style={{ flex: 1 }} />
        {/* "חזרה לתצוגה הישנה" (4.10.2026): רק להנהלה ראשית / מתכנת; הטולטיפ - הטולטיפ של החלון (data-tip) */}
        <PageVariantToggle screen="error_report" placement="window" systemTip />
        <button type="button" className="btn ghost er-inb" data-ico="inbox" onClick={() => { setMode('panel'); setThreadOnly(false); setSelId(null); setQ(''); setArchTab(false); fetchReports(); }}>
          <Ic n="inbox" cls="sm" inBtn />פניות שלי{waiting ? <span className="mbadge" aria-label={`${waiting} ממתינות לך`}>{waiting}</span> : null}
        </button>
      </div>
      <div className="er-scroll">
        {canNew ? (
          <>
            <div>
              <Composer
                id="erTx" rows={3} label="מה קרה?" placeholder="מה ניסית לעשות, ומה קרה בפועל?" required
                value={text} textareaRef={textRef} bad={bad} reveal={reveal} onTouch={() => setReveal(true)}
                onChange={(e) => { setText(e.target.value); if (bad && e.target.value.trim()) setBad(false); if (failMsg) setFailMsg(''); }}
                acts={acts('new')} send={sendBtn}
              />
              {bad ? <div className="merr" role="alert"><Ic n="alert" />יש להזין תיאור שגיאה</div> : failMsg ? <div className="merr" role="alert"><Ic n="alert" />{failMsg}</div> : null}
            </div>
            {(picked.length || newAtts.length || steps || (videoUploading && recordingCtx === 'new')) ? (
              <div className="er-att">
                <div className="er-ah">מצורף לדיווח</div>
                {picked.length ? (
                  <div className="er-ech-row">
                    {picked.map((p, i) => (
                      <span className="er-ech" key={`${p.attId || ''}-${i}`}>
                        <span className="er-n">{i + 1}</span>
                        <span className="er-l"><bdi dir="ltr">{p.selector}</bdi>{p.text ? ` — "${p.text}"` : ''}</span>
                        <button type="button" data-ico="x" aria-label="הסר סימון זה" data-tip="הסר סימון זה" onClick={() => removePicked(i)}><Ic n="x" inBtn /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {thumbs('new', newAtts)}
                {stepsChip(steps, () => setSteps(''))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="er-deny">
            <div className="ashield"><Ic n="shield" cls="lg" /></div>
            <b style={{ fontSize: 18 }}>יצירת דיווח חדש מותרת למנהלים בלבד</b>
            <p className="er-note" style={{ fontSize: 15 }}>פנה למנהל/הנהלה ראשית כדי לדווח על תקלה.</p>
          </div>
        )}
      </div>
    </>
  );

  // ----- panel: list -----
  const rowEl = (r) => {
    const t = M.displayTitle(r);
    const unread = M.isUnread(r, isProgrammer);
    return (
      <div key={r.id} className={`er3-r${unread ? ' unread' : ''}${selId === r.id && (split || threadOnly) ? ' sel' : ''}${fresh === r.id ? ' fresh' : ''}`}
        role="button" tabIndex={0} data-id={r.id}
        onClick={() => openThread(r)}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openThread(r); } }}>
        {unread ? <span className="er-dot" aria-label="לא נקרא" /> : <span className="er3-ds" />}
        <span className="er3-t">{t.text}</span>
        <span className="er3-ago">{M.relativeTime(r.updatedAt || r.createdAt)}</span>
      </div>
    );
  };
  const listBody = () => {
    const top = rows.filter((r) => openGroups.top.includes(r));
    const rest = rows.filter((r) => !openGroups.top.includes(r));
    let body;
    if (!baseRows.length) body = <div className="er3-empty"><Ic n={archTab ? 'archive' : 'inbox'} /><p>{archTab ? 'אין דיווחים בארכיון' : 'אין דיווחים קיימים'}</p></div>;
    else if (!rows.length) body = <div className="er3-empty"><p>לא נמצאו תוצאות ל־&quot;{q}&quot;</p></div>;
    else if (archTab) body = rows.map(rowEl);
    else body = <>{top.map(rowEl)}{top.length && rest.length ? <hr className="er3-hr" /> : null}{rest.map(rowEl)}</>;
    return (
      <>
        {baseRows.length > M.SEARCH_MIN_ROWS ? (
          <div className="er3-s"><Ic n="search" cls="sm" /><input type="text" id="erQ" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בפניות" autoComplete="off" data-lpignore="true" aria-label="חיפוש בפניות" /></div>
        ) : null}
        <div className="er3-rows">{body}</div>
        {(archived.length || archTab) ? (
          <button type="button" className="er3-lnk" onClick={() => { setQ(''); setArchTab(!archTab); setSelId(null); setThreadOnly(false); }}>
            {archTab ? 'חזרה לפניות' : `ארכיון (${archived.length})`}
          </button>
        ) : null}
      </>
    );
  };

  // ----- panel: thread -----
  const bubble = (key, { who, date, text: body, cls, extra }) => {
    const c = M.bubbleContent(body, isProgrammer);
    return (
      <div key={key} className={`er3-b${cls || ''}`} tabIndex={0} data-tip={hebrewDateTime(date)}>
        <div className="er3-bh"><b>{who}</b></div>
        <p>{c.body}</p>
        {c.steps.length ? (
          <details className="er3-steps">
            <summary>צעדים שהוקלטו ({M.stepsCountLabel(c.steps.length)})</summary>
            <div className="er3-stph">{M.REPORT_STEPS_HEADER}</div>
            <ol>{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </details>
        ) : null}
        {extra}
      </div>
    );
  };
  const chips = (json) => {
    const list = M.parseAttachments(json);
    return list.length ? <div className="er3-chips">{list.map((info, i) => <AttChip key={i} info={info} onOpen={() => setLightbox({ info })} />)}</div> : null;
  };
  const sketchBlock = (rep) => {
    const st = rep.sketchStatus;
    const view = <a href="#" onClick={(e) => { e.preventDefault(); setLightbox({ sketchId: rep.id }); }}>צפה בסקיצה</a>;
    if (st === 'APPROVED' || st === 'REJECTED') return <div className="er3-sk">{view}<span className="er3-q">{st === 'APPROVED' ? 'אושרה' : 'נדחתה'}</span></div>;
    if (st !== 'PENDING') return <div className="er3-sk">{view}</div>;
    if (skReject === rep.id) {
      return (
        <div className="er3-sk col">
          <textarea className="inp" id="erSkNote" rows={2} placeholder="מה לשנות בסקיצה? (אופציונלי)" value={skNote} onChange={(e) => setSkNote(e.target.value)} />
          <div className="er3-sa">
            <button type="button" className="btn danger sm" disabled={skBusy} onClick={() => decideSketch(rep, 'REJECTED')}>שלח דחייה</button>
            <button type="button" className="er3-lnk" disabled={skBusy} onClick={() => setSkReject(null)}>ביטול</button>
          </div>
        </div>
      );
    }
    return (
      <div className="er3-sk">
        {view}
        <span className="er3-sa">
          <button type="button" className="btn primary sm" disabled={skBusy} onClick={() => decideSketch(rep, 'APPROVED')}>אשר</button>
          <button type="button" className="btn ghost sm" disabled={skBusy} onClick={() => { setSkReject(rep.id); setSkNote(''); }}>דחה</button>
        </span>
      </div>
    );
  };
  const threadBody = (r) => {
    const t = M.displayTitle(r);
    const quiet = M.quietLine(r, isProgrammer);
    const reps = r.replies || [];
    const humanAfter = M.showHumanButton(r, { isProgrammer, humanButtonEnabled: settings.humanButtonEnabled });
    const archivedR = r.status === 'ARCHIVED';
    return (
      <>
        <div className="er3-th">
          <button type="button" className="ibtn er-sm er3-back" data-ico="back" aria-label="חזרה לרשימה" data-tip="חזרה לרשימה" onClick={() => setThreadOnly(false)}><Ic n="back" cls="sm" inBtn /></button>
          <div className="er3-tt">
            <h3>{t.text}{t.ai ? <span className="er3-ai" data-tip="נוצרה אוטומטית" aria-label="נוצרה אוטומטית"><Ic n="sparkles" cls="sm" /></span> : null}</h3>
            {quiet ? <small>{quiet}</small> : null}
          </div>
          <div className={`tools er3-acts${isProgrammer ? ' many' : ''}`} role="group" aria-label="פעולות על הפנייה">
            <RoundBtn act="handled" icon="check" pressed={!!r.isHandled} tip={r.isHandled ? 'בטל סימון טופל' : 'סמן כטופל'} onClick={() => toggleHandled(r)} />
            <RoundBtn act="archive" icon={archivedR ? 'undo' : 'archive'} tip={archivedR ? 'שחזר מהארכיון' : 'העבר לארכיון'} onClick={() => setReportStatus(r, archivedR ? 'OPEN' : 'ARCHIVED')} />
            {isProgrammer ? <RoundBtn act="question" icon="flag" pressed={replyQ} tip="סמן שיש שאלה פתוחה למדווח" onClick={() => setReplyQ((v) => !v)} /> : null}
            {isProgrammer ? <RoundBtn act="copy" icon="copy" tip="העתק פרטי מערכת" onClick={() => copyDetails(r)} /> : null}
          </div>
        </div>
        <div className="er3-scroll" ref={scrollRef}>
          <div className="er3-msgs">
            {bubble('report', { who: M.senderName(null, r), date: r.createdAt, text: r.userText, cls: ' me0', extra: chips(r.attachmentUrls) })}
            {reps.map((rep, i) => {
              const extra = (
                <>
                  {chips(rep.attachmentUrls)}
                  {rep.hasSketch ? sketchBlock(rep) : null}
                  {rep.previewUrl ? <a className="er3-pv" href={rep.previewUrl} target="_blank" rel="noopener noreferrer"><Ic n="ext" cls="sm" />בדיקה בגרסה זמנית</a> : null}
                </>
              );
              const cls = `${rep.isProgrammer ? ' prog' : ''}${M.isMine(rep, isProgrammer) ? ' mine' : ''}`;
              return (
                <Fragment key={rep.id}>
                  {bubble(rep.id, { who: M.senderName(rep, r), date: rep.createdAt, text: rep.text, cls, extra })}
                  {humanAfter && i === reps.length - 1 ? (
                    <div className="er3-hum">
                      <button type="button" className="btn ghost er-human" data-ico="alert" disabled={requestingHuman} onClick={requestHumanReply}>
                        <Ic n="alert" cls="sm" inBtn />אוף! אני צריך מענה אנושי!
                      </button>
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </div>
        <div className="er-reply er3-reply">
          <Composer
            id="erRt" rows={2} label="תגובה" reply textareaRef={replyRef}
            placeholder={isProgrammer && replyQ ? 'הקלד תגובה (שאלה פתוחה למדווח)...' : 'הקלד תגובה...'}
            value={replyText} reveal={reveal} onTouch={() => setReveal(true)}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
            acts={acts('reply')}
            send={<button type="button" className="er-send" data-act="r-send" data-ico="send" aria-label="שליחה" data-tip="שליחה" disabled={replying || videoUploading} onClick={handleReply}>{replying ? <Spin /> : <Ic n="send" inBtn />}</button>}
          />
          {thumbs('reply', replyAtts)}
          {stepsChip(replySteps, () => setReplySteps(''))}
        </div>
      </>
    );
  };

  const panelBody = () => {
    const showThread = !!selected && (split || threadOnly);
    return (
      <>
        <div className="er3-hd">
          {xBtn(close)}
          <h2 id="mail-t">פניות שלי</h2>
          {isProgrammer ? (
            <div className="tools er3-acts" role="group" aria-label="הסוכן האוטומטי">
              <RoundBtn act="agent" icon="sparkle" pressed={agentLoopEnabled} disabled={agentLoopBusy}
                tip={agentLoopEnabled ? 'סוכן תיקון אוטומטי פעיל - בודק דיווחים פתוחים כל כמה דקות ופותח PR לתיקונים. לחצו לכיבוי.' : 'הפעלת סוכן תיקון אוטומטי - יבדוק דיווחים פתוחים כל כמה דקות, יתקן קוד ויפתח PR לאישור.'}
                onClick={toggleAgentLoop} />
              {agentLoopEnabled ? (
                <RoundBtn act="deploy" icon="send" pressed={deployEnabled} disabled={deployBusy}
                  tip={deployEnabled ? 'הסוכן מורשה לפרוס תיקונים (לפתוח ענף+PR) בוורסל. לחצו לכיבוי - הוא ימשיך לענות ולחקור, בלי לפרוס.' : 'פריסות מהסוכן כבויות - הוא עדיין עונה ובודק דיווחים, אבל לא פותח ענף/PR. לחצו להפעלה.'}
                  onClick={toggleDeploy} />
              ) : null}
            </div>
          ) : null}
          <PageVariantToggle screen="error_report" placement="window" systemTip />
          {canNew ? <button type="button" className="btn primary er-newb" data-ico="plus" onClick={() => { setMode('card'); setThreadOnly(false); }}><Ic n="plus" cls="sm" inBtn />דיווח חדש</button> : null}
        </div>
        <div className="er3-g">
          <div className={`er3-l${showThread && !split ? ' off' : ''}`} ref={listRef} onScroll={(e) => { listScroll.current[archTab ? 'archive' : 'list'] = e.currentTarget.scrollTop; }}>
            {listBody()}
          </div>
          <div className={`er3-rr${!showThread && !split ? ' off' : ''}`}>{selected && showThread ? threadBody(selected) : null}</div>
        </div>
      </>
    );
  };

  // ----- lightbox (#dlg2 כהה של המערכת) -----
  const lightboxEl = () => {
    if (!lightbox) return null;
    let title;
    let view;
    let dl = null;
    if (lightbox.sketchId) {
      title = 'סקיצה להדגמה';
      view = <iframe className="er-lbfr" title="סקיצה" sandbox="" src={`/api/error-report/sketch/${lightbox.sketchId}`} />;
    } else {
      const i = lightbox.info;
      title = i.label;
      dl = <a className="btn primary er-lbd" href={i.src} download={i.name} target="_blank" rel="noopener noreferrer"><Ic n="download" cls="sm" />הורדה</a>;
      if (i.kind === 'image') view = <LbImage src={i.src} name={i.name} />;
      else if (i.kind === 'video') view = <video className="er-lbimg" src={i.src} controls preload="metadata" />;
      else view = <div className="er-lbfile"><Ic n="clip" cls="lg" /><b>{i.name}</b></div>;
    }
    return (
      <div className="scrim on" id="scrim2" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
        <div className="dlg mailwin er-lb" id="dlg2" role="dialog" aria-modal="true" aria-labelledby="er-lbt" tabIndex={-1} ref={(n) => { if (n && !n.contains(document.activeElement)) n.focus({ preventScroll: true }); }}>
          <div className="mh">
            <button type="button" className="ibtn mx" data-ico="x" aria-label="סגירה" data-tip="סגור" onClick={() => setLightbox(null)}><Ic n="x" cls="sm" inBtn /></button>
            <h2 id="er-lbt">{title}</h2>
            {dl}
          </div>
          <div className="er-lbv">{view}</div>
        </div>
      </div>
    );
  };

  // ===================================================================== root
  const visible = open && !hidden;
  const cardWin = (
    <div className={`dlg mailwin er-win er-d4 er-light${mode === 'panel' ? ' er3-big' : ''}`} id="dlg" role="dialog"
      aria-modal={narrow || mode === 'panel' ? 'true' : 'false'}
      {...(mode === 'panel' ? { 'aria-labelledby': 'mail-t' } : { 'aria-label': 'דיווח על שגיאות' })}
      style={mode === 'card' && !narrow && popPos && popPos.maxH ? { maxHeight: `min(${popPos.maxH}px,680px)` } : undefined}>
      {/* פונקציות העזר של התצוגה רק יוצרות מטפלי אירועים (שקוראים refs בלחיצה) - שום ref לא נקרא בזמן הרינדור */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {mode === 'panel' ? panelBody() : cardBody()}
    </div>
  );
  const popStyle = popPos ? {
    width: popPos.w, left: popPos.left, top: popPos.up ? 'auto' : popPos.top, bottom: popPos.up ? popPos.bottom : 'auto', '--ax': `${popPos.ax}px`,
    ...(popPos.navB ? { '--er-nav-b': `${popPos.navB}px` } : {}),
  } : undefined;

  const rec = recording ? (
    <div className="er-rec on" id="erRec" role="status" data-no-record="true">
      <span className="rd" />
      <b>{recording.mode === 'video' ? 'מסריט את המסך' : 'רושם את הפעולות שלך'} · {M.stepsCountLabel(stepCount)}{recording.mode === 'video' ? ` · ${screenRecorder.seconds}/${screenRecorder.maxSeconds} שנ'` : ''}</b>
      <small>שחזר את התקלה, ואז לחץ &quot;סיום&quot;</small>
      <button type="button" className="btn primary" data-no-record="true" onClick={finishRecording}>סיום</button>
    </div>
  ) : null;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="gm-ds gm-er dlg-dark" dir="rtl" ref={rootRef}>
      {shell ? null : <MenuSprite />}
      <input ref={fileInputRef} id="erFile" type="file" multiple accept={ATTACHMENT_FILE_INPUT_ACCEPT} onChange={handleFilesChosen} style={{ display: 'none' }} />
      <div id="erLayer" aria-hidden="true">
        {picker.isPicking && picker.hoverRect ? (
          <div className="er-hov" style={{ left: picker.hoverRect.left, top: picker.hoverRect.top, width: picker.hoverRect.width, height: picker.hoverRect.height }} />
        ) : null}
        {marks.map((m, i) => (m ? <div key={i} className={`er-mark${flash ? ' flash' : ''}`} style={m}><i>{i + 1}</i></div> : null))}
      </div>
      {visible && mode === 'card' && !narrow ? (
        <div id="erPop" className={`on${popPos && popPos.up ? ' up' : ''}`} style={popStyle}>{cardWin}</div>
      ) : null}
      {visible && mode === 'card' && narrow ? (
        <div className="scrim on er-sheet" id="scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>{cardWin}</div>
      ) : null}
      {visible && mode === 'panel' ? (
        <div id="erBig" className="on" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>{cardWin}</div>
      ) : null}
      {picker.isPicking ? <div className={`er-pill on${!narrow && visible ? ' bottom' : ''}`} id="erPill" role="status">לחץ על האלמנט הרצוי בעמוד לסימונו · Esc לביטול</div> : null}
      {rec}
      {lightboxEl()}
      {toast ? (
        <div id="toast" className={`${toast.kind} on pulse`} role="status" aria-live="polite" key={toast.n} style={{ '--tdur': `${toast.kind === 'info' ? TOAST_MS.info : TOAST_MS.other}ms` }}>
          <button type="button" className="tclose" data-ico="x" data-tip="סגור" aria-label="סגירה" onClick={() => setToast(null)}><Ic n="x" cls="sm" inBtn /></button>
          <div className="tb"><Ic n={toast.icon} cls="lg" /></div>
          <div><b>{toast.message}</b><small /></div>
        </div>
      ) : null}
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>,
    document.body,
  );
}

function LbImage({ src, name }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className="er-lbfile"><Ic n="alert" cls="lg" /><b>הקובץ אינו זמין יותר</b></div>;
  return <img className="er-lbimg" src={src} alt={name} onError={() => setBroken(true)} />;
}
