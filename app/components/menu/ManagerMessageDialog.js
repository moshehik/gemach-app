'use client';

// "הודעה למנהל" - חלון קטן (פלטה: חלון 18/20 div.dlg + חלון 9/10 .scrim, שדה 6/39 textarea.inp, לחצן 41/44 btn.primary).
// אותו POST בדיוק כמו הטופס בדף ההודעות (app/messages/page.js handleSendManagementNote):
//   POST /api/notifications { receiverId: 'all', title: 'הודעה להנהלה', content, category: 'management' }
// השרת מסרב כש-management_messages !== 'true', והשורה בכלל לא מוצגת בתפריט במצב כזה.

import { useEffect, useRef, useState } from 'react';

const DRAFT = { text: '' }; // טיוטה בזיכרון בלבד (כמו drafts בעיצוב) - לא נכתבת לדיסק

export default function ManagerMessageDialog({ open, onClose, onSent }) {
  const [text, setText] = useState(DRAFT.text);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const taRef = useRef(null);
  const scrimRef = useRef(null);
  const backRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    backRef.current = document.activeElement;
    setText(DRAFT.text);
    setError('');
    const t = setTimeout(() => { if (taRef.current) taRef.current.focus(); }, 30);
    return () => {
      clearTimeout(t);
      const b = backRef.current;
      if (b && b.focus && document.contains(b)) b.focus();
    };
  }, [open]);

  const close = (sent) => {
    if (!sent) DRAFT.text = text;
    onClose();
  };

  const send = async () => {
    const content = text.trim();
    if (content.length < 3 || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: 'all', title: 'הודעה להנהלה', content, category: 'management' }),
      });
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (res.ok && data && data.success) {
        DRAFT.text = '';
        setText('');
        onClose();
        if (onSent) onSent();
      } else {
        setError((data && data.error) || 'שגיאה בשליחת ההודעה');
      }
    } catch (e) {
      setError('שגיאת תקשורת');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
    if (e.key !== 'Tab') return;
    const f = [...scrimRef.current.querySelectorAll('button:not([disabled]),textarea')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      ref={scrimRef}
      className={`scrim${open ? ' on' : ''}`}
      id="sndScrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}
      onKeyDown={onKeyDown}
      aria-hidden={open ? undefined : 'true'}
    >
      <div className="dlg" id="sndDlg" role="dialog" aria-modal="true" aria-labelledby="sndT">
        <h2 id="sndT">הודעה למנהל</h2>
        <label className="lbl" htmlFor="sndTx">ההודעה</label>
        <textarea
          ref={taRef}
          id="sndTx"
          className="inp"
          value={text}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          onChange={(e) => setText(e.target.value)}
        />
        {error ? <div className="sn-msg err" role="alert">{error}</div> : null}
        <div className="dbtns">
          <button type="button" className="btn primary lg block" disabled={text.trim().length < 3 || sending} onClick={send}>
            {sending ? 'שולחים…' : 'שליחה למנהל'}
          </button>
          <button type="button" className="btn ghost block" onClick={() => close(false)}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
