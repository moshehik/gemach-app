'use client';
// R21: הודעה פנימית מתמשכת (לא נעלמת לבד) למטה-שמאל הפיזי. נכנסת לאותו אזור צף של ה-Provider.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './notify.css';

/**
 * messages: [{id, sender, title, text, href}]
 * onHandle(id) = "סמן כטופל" | onRead(id) = "קראתי" | onOpen(msg)
 * ההתנהגות (handle/read) נשארת של ה-caller - לא מבצעים כאן קריאות רשת.
 */
export default function V3MessagesToast({ messages = [], onHandle, onRead, onOpen }) {
  const [host, setHost] = useState(null);
  useEffect(() => { setHost(document.getElementById('v3-toast-region')); }, []);
  if (!messages.length) return null;
  const body = messages.map((m) => (
    <div key={m.id} className="v3n-item v3n-item--msg is-on" role="status" aria-live="polite" aria-atomic="true">
      <span className="v3n-item__icon" aria-hidden="true">✉</span>
      <div className="v3n-item__body">
        {m.sender ? <span className="v3n-item__text">{m.sender}</span> : null}
        <strong className="v3n-item__title">{m.title}</strong>
        {m.text ? <span className="v3n-item__text v3n-clamp3">{m.text}</span> : null}
      </div>
      <div className="v3n-item__btns">
        {onHandle ? <button type="button" className="v3n-item__action" onClick={() => onHandle(m.id)}>סמן כטופל</button> : null}
        {onRead ? <button type="button" className="v3n-item__ghost" onClick={() => onRead(m.id)}>קראתי</button> : null}
        {(m.href || onOpen) ? <button type="button" className="v3n-item__ghost" aria-label={`פתח הודעה: ${m.title}`} onClick={() => (onOpen ? onOpen(m) : (window.location.href = m.href))}>פתח</button> : null}
      </div>
    </div>
  ));
  return host ? createPortal(body, host) : <div className="v3n-region v3n-region--solo">{body}</div>;
}
