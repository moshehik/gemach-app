'use client';

// PinDialog - חלון כהה לאישור פעולה הרסנית בקוד מנהל (מחיקת רשומות מהיסטוריית השאילתות). מחליף את customAuthPrompt (חלון בהיר) של הדף הישן.
// הקוד נשלח רק לבקשת המחיקה (DELETE /api/history, אותו חוזה כמו בדף הישן: username = העובד המחובר, password = הקוד) ולא נשמר ולא נרשם בשום מקום.
// onDone(pin) מחזיר הבטחה: שגיאה (מחרוזת) נשארת בחלון להקלדה מחדש; הצלחה סוגרת (ההורה).
import { useState } from 'react';
import { Dlg, DlgBadge, Ic } from '../a5-list';

export default function PinDialog({ title, sub, okLabel = 'מחיקה', icon = 'trash', onDone, onCancel }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!pin || busy) return;
    setBusy(true); setErr('');
    try {
      const msg = await onDone(pin);
      if (msg) { setErr(msg); setPin(''); }
    } finally { setBusy(false); }
  };
  return (
    <Dlg labelledBy="a5-pin-t" onClose={busy ? undefined : onCancel} focusSel="input">
      <DlgBadge icon={icon} />
      <h2 id="a5-pin-t">{title}</h2>
      {sub ? <div className="sub">{sub}</div> : null}
      <div className="mfld">
        <label className="lbl" htmlFor="a5-pin-in"><Ic id="lock" size="sm" />קוד מנהל</label>
        <input
          id="a5-pin-in" className="inp" type="password" autoComplete="new-password" spellCheck={false} value={pin} disabled={busy}
          onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
        {err ? <div className="sub" role="alert" aria-live="assertive">{err}</div> : null}
      </div>
      <div className="dbtns" style={{ marginTop: 24 }}>
        <button type="button" className="btn primary lg block" disabled={!pin || busy} onClick={submit}><Ic id={icon} />{busy ? 'מוחק…' : okLabel}</button>
        <button type="button" className="btn ghost block" disabled={busy} onClick={onCancel}><Ic id="back" size="sm" />חזרה</button>
      </div>
    </Dlg>
  );
}
