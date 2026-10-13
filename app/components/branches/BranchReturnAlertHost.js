'use client';

// BranchReturnAlertHost - חלון ההתראה שקופץ בסריקת החזרה ("להעביר לסניף X" / "להחזיר לרזרבה", docs/branches-plan.md, שלב ד).
// בכוונה לא-חוסם ולא גונב מיקוד: הוא רק מוצג מעל הדף, והמיקוד נשאר בשדה הסריקה. Enter סוגר אותו ומיד אפשר לסרוק את הברקוד הבא:
//   - שדה הסריקה ריק: ה-Enter נבלע (לא שולח סריקה ריקה) והחלון נסגר;
//   - כבר הוקלד / נסרק ברקוד הבא (הסורק מקליד ספרות + Enter): ה-Enter נסגר החלון וגם עובר הלאה - הסריקה הבאה לא הולכת לאיבוד.
// Escape וכפתור "הבנתי" סוגרים גם הם. ההודעה כבר נרשמה בפעמון ההתראות בשרת (lib/returnBranchAdvice.js).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './quick-transfer.css';
import { RETURN_ADVICE_EVENT, installReturnAdviceInterceptor } from './returnAlert';

function scanFieldHasText() {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  if (!el) return false;
  const tag = el.tagName;
  return (tag === 'INPUT' || tag === 'TEXTAREA') && String(el.value || '').trim() !== '';
}

export default function BranchReturnAlertHost() {
  const [advices, setAdvices] = useState([]);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = advices.length > 0; }, [advices]);

  useEffect(() => {
    installReturnAdviceInterceptor();
    const onAdvice = (e) => {
      const list = (e.detail && e.detail.advices) || [];
      if (!list.length) return;
      setAdvices((cur) => [...cur, ...list.filter((a) => !cur.some((c) => c.barcode === a.barcode && c.kind === a.kind))]);
    };
    window.addEventListener(RETURN_ADVICE_EVENT, onAdvice);
    return () => window.removeEventListener(RETURN_ADVICE_EVENT, onAdvice);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!openRef.current) return;
      if (e.key === 'Enter') {
        const pending = scanFieldHasText();
        setAdvices([]);
        if (!pending && !(e.target && e.target.closest && e.target.closest('[data-br-alert]'))) { e.preventDefault(); e.stopPropagation(); }
      } else if (e.key === 'Escape') {
        setAdvices([]);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const close = useCallback(() => setAdvices([]), []);
  if (!advices.length || typeof document === 'undefined') return null;
  const node = (
    <div className="br-alert-wrap" dir="rtl">
      <div className="br-alert" role="alertdialog" aria-live="assertive" aria-label="התראת החזרה" data-br-alert data-kind={advices[0].kind}>
        {advices.map((a) => (
          <div key={`${a.kind}-${a.barcode}`} className={`br-alert-item br-${a.kind}`}>
            <b className="br-alert-title">{a.title}</b>
            <span className="br-alert-text">{a.text}</span>
          </div>
        ))}
        <div className="br-alert-foot">
          <span className="br-alert-hint">Enter להמשך סריקה</span>
          <button type="button" className="btn primary sm" onClick={close}>הבנתי</button>
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}
