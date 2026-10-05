'use client';

// כפתור "דיווח על שגיאות" - הנקודה האחת שבה שתי המעטפות מרכיבות את החלון:
//   * app/components/AppShell.js (המעטפת הישנה): <ErrorReportButton /> - כפתור icon-btn בסרגל העליון, כמו קודם.
//   * app/components/menu/MenuA5Shell.js (A5): <ErrorReportButton trigger={({ onOpen, unreadCount }) => ...} /> - אייקון החרק (#snErr).
// החלון עצמו (עיצוב B שאושר 4.10.2026: כרטיס צף + פאנל "פניות שלי", בנייד גיליון תחתון) נמצא ב-errorReport/ErrorReportWindow.js
// ונטען בעצלות בפתיחה הראשונה. כאן נשארים רק: הכפתור, הכפתור הצף השקט בשולי המסך, הבדיקה התקופתית הקלה של "לא נקראו"
// (?light=1 כל 120 שנ', רק כשהחלון סגור והטאב גלוי) ורישום 5 הלחצנים האחרונים (lastButtons שנשלח בדיווח).
// החלון הישן (1441 שורות, עד 4.10.2026) שוחזר כ-LegacyErrorReportButton.js ומוצג לפי מסך "ישן / חדש" error_report (ר' למטה).
import './errorReport/launcher.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { unreadCount as countUnread } from './errorReport/erModel';
import { useUiVariant } from './UiVariantContext';
import LegacyErrorReportFrame from './variant/LegacyErrorReportFrame';

const ErrorReportWindow = dynamic(() => import('./errorReport/ErrorReportWindow'), { ssr: false });

// אייקון החרק של הפלטה (אייקון 68, i-sn-bug) מוטבע כאן - הכפתור הצף מוצג גם לפני שה-sprite של החלון נטען
function BugIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8.5 7.5a3.5 3.5 0 0 1 7 0" />
      <path d="M7 9.5h10v5a5 5 0 0 1-10 0z" />
      <path d="M12 9.5v10M3.5 13H7M17 13h3.5M4.5 7.5 7.5 10M19.5 7.5 16.5 10M4.5 19l3-2.5M19.5 19l-3-2.5" />
    </svg>
  );
}

// trigger (אופציונלי): פונקציה ({ onOpen, unreadCount }) => JSX שמחליפה את כפתור ה-icon-btn הישן. משמש את
// המעטפת החדשה (app/components/menu/MenuA5Shell.js); בלעדיו הכפתור הישן מרונדר בדיוק כמו קודם.
// "ישן / חדש" (4.10.2026, lib/uiVariantScreens.js מסך 'error_report'): בגרסה הישנה - החלון הקודם (LegacyErrorReportButton.js =
// c944cb95:app/components/ErrorReportButton.js כפי שהוא, אותו API של trigger), עטוף ב-LegacyErrorReportFrame שמוסיף את אייקון
// "מעבר לתצוגה החדשה" כשהחלון הישן פתוח. ההכרעה: useUiVariant (עקיפה אישית > ui_variant_error_report > תפקיד: מתכנת חדש, השאר ישן).
export default function ErrorReportButton({ trigger } = {}) {
  const variant = useUiVariant('error_report');
  if (variant === 'legacy') return <LegacyErrorReportFrame trigger={trigger} />;
  return <ErrorReportButtonNew trigger={trigger} />;
}

function ErrorReportButtonNew({ trigger } = {}) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [command, setCommand] = useState(null);
  const [unread, setUnread] = useState(0);
  const [perms, setPerms] = useState({ known: false, isProgrammer: false, isManager: false });
  const [authFailed, setAuthFailed] = useState(false);
  const [fabReveal, setFabReveal] = useState(false);
  const fabTimer = useRef(null);
  // אין משתמש מחובר (עמדת לקוחות, דפי הדפסה) - הבקשה תמיד תחזיר 401, אז אחרי הפעם הראשונה מפסיקים לגמרי
  const authFailedRef = useRef(false);
  const fetchSeqRef = useRef(0);

  // { light: true } - הבדיקה ברקע (פאנל סגור): רק השדות הדרושים למונה "לא נקראו" (docs/neon-quota-error-report-poll-2026-09-17.md).
  // הקריאה המלאה (רשימה, תגובות, צרופות) נעשית בחלון עצמו כשהוא פתוח, ומעדכנת כאן את המונה דרך onData.
  const fetchLight = useCallback(async () => {
    if (authFailedRef.current) return;
    const seq = ++fetchSeqRef.current;
    try {
      const res = await fetch('/api/error-report?light=1');
      if (res.status === 401) {
        authFailedRef.current = true;
        setAuthFailed(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        // תוצאה ישנה לא דורסת קריאה מלאה שחזרה אחריה
        if (seq !== fetchSeqRef.current) return;
        if (data.success) {
          const prog = data.isProgrammer || false;
          setUnread(countUnread(data.reports || [], prog));
          setPerms({ known: true, isProgrammer: prog, isManager: data.isManager ?? data.isProgrammer ?? false });
        }
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  }, []);

  const onData = useCallback((list, prog) => {
    ++fetchSeqRef.current;
    setUnread(countUnread(list || [], prog));
  }, []);

  useEffect(() => {
    let intervalId;
    // טאב ברקע / ממוזער לא בודק בכלל; כשחוזרים אליו - בדיקה מיידית. 120 שנ' (מכסות Vercel/Neon, ר' docs/vercel-resource-audit-2026-09-20.md).
    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => fetchLight(), 120000);
    };
    const stop = () => {
      clearInterval(intervalId);
      intervalId = undefined;
    };
    const handleVisibility = () => {
      if (!mounted || isOpen) return;
      if (document.hidden) stop();
      else {
        fetchLight();
        start();
      }
    };
    if (mounted && !isOpen && !document.hidden) start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mounted, isOpen, fetchLight]);

  useEffect(() => {
    setMounted(true);
    fetchLight();
    // 5 הלחצנים האחרונים שנלחצו בעמוד - נשלחים בדיווח (lastButtons) כמו קודם
    const handleGlobalClick = (e) => {
      let target = e.target;
      while (target && target !== document.body) {
        if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button' || (target.tagName === 'A' && (target.classList?.contains('btn') || target.classList?.contains('button')))) {
          let btnText = target.innerText || target.textContent || target.title || target.getAttribute('aria-label') || 'כפתור ללא טקסט';
          btnText = btnText.trim().substring(0, 50).replace(/\n/g, ' ');
          if (btnText) {
            window.__lastButtons = window.__lastButtons || [];
            window.__lastButtons.push(btnText);
            if (window.__lastButtons.length > 5) window.__lastButtons.shift();
          }
          break;
        }
        target = target.parentElement;
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      clearTimeout(fabTimer.current);
    };
  }, [fetchLight]);

  const toggle = (e, mode) => {
    const anchor = e && e.currentTarget ? e.currentTarget : null;
    setLoaded(true);
    setCommand((prev) => ({ n: (prev ? prev.n : 0) + 1, type: isOpen ? 'close' : 'open', anchor, mode }));
  };

  // הכפתור הצף: שקט כברירת מחדל (סרגל דק בשולי המסך), נחשף בריחוף / מיקוד; במגע - נגיעה ראשונה חושפת, השנייה פותחת
  const onFab = (e) => {
    const touch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover:none)').matches;
    if (touch && !fabReveal) {
      setFabReveal(true);
      clearTimeout(fabTimer.current);
      fabTimer.current = setTimeout(() => setFabReveal(false), 4000);
      return;
    }
    toggle(e);
  };

  return (
    <>
      {typeof trigger === 'function' ? trigger({
        onOpen: (e) => toggle(e),
        unreadCount: unread,
      }) : (
        <button
          type="button"
          className="icon-btn"
          onClick={(e) => toggle(e)}
          title="מערכת דיווחי שגיאות"
          aria-haspopup="dialog"
          aria-expanded={isOpen ? 'true' : 'false'}
        >
          <svg className="icon"><use href="#i-alert-circle" /></svg>
          {unread > 0 && <span className="dot" />}
        </button>
      )}

      {/* רק אחרי שהבדיקה הקלה אישרה משתמש מחובר (perms.known) - בלי הבזק של הכפתור בדפים בלי משתמש (401) */}
      {mounted && perms.known && !authFailed && createPortal(
        <div className="gm-er-launch" dir="rtl">
          <div className={`er-fab${isOpen ? ' hide' : ''}${fabReveal ? ' reveal' : ''}`} id="erFab">
            <span className="er-tip">דיווח על שגיאה</span>
            <button type="button" className="er-fab-b" aria-label="דיווח על שגיאה" aria-haspopup="dialog" onClick={onFab}>
              <BugIcon />
              {unread > 0 && <span className="er-ndot" />}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {loaded && mounted ? (
        <ErrorReportWindow command={command} perms={perms} onOpenChange={setIsOpen} onData={onData} />
      ) : null}
    </>
  );
}
