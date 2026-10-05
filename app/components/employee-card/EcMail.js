'use client';

// EcMail - חלון "שליחת מייל" לעובד בכרטיס העובד החדש (SendEmailModal בישן -> חלון המייל של כרטיס ההזמנה, .mailwin). אותם שדות ואותו
// מטען ל-POST /api/send-email (lib/employeeCardA5.js buildSendEmailBody). EC-10: אין בלוק שם משתמש + סיסמה בתוך החלון - לחיצה על "שלח
// מייל" פותחת חלון אימות מנהל נפרד (שכבה 2, feature:customer_email_approval כמו בישן) ורק אחריו השליחה; username = מזהה המנהל שנבחר,
// password = הקוד שלו (כמו הישן). שגיאה בטוסט, החלון נשאר פתוח.
import { useRef, useState } from 'react';
import { normalizeEmail } from '@/lib/emailUtils';
import { buildSendEmailBody, SEND_MODES, EMAIL_RE, fmtSize } from '@/lib/employeeCardA5';
import { Dlg, Ic, NO_FILL, useEc } from './EcUi';

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = (e) => reject(e);
});

export default function EcMail({ employeeId, defaultTo, name, onClose }) {
  const ec = useEc();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ to: normalizeEmail(defaultTo) || defaultTo || '', cc: '', subject: '', body: '' });
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('email');
  const [folder, setFolder] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done
  const [links, setLinks] = useState([]);
  const dis = state !== 'idle';
  const valid = EMAIL_RE.test((form.to || '').trim()) && form.subject.trim() && form.body.trim();
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const close = () => { if (state !== 'sending') onClose(); };

  const send = async () => {
    if (!valid || state !== 'idle') return;
    const approval = await ec.approve({ message: 'אימות מנהל לשליחה', level: 'feature:customer_email_approval' });
    if (!approval) return;
    setState('sending');
    try {
      const prepared = [];
      for (const f of files) prepared.push({ fileName: f.name, fileContent: await toBase64(f), mimeType: f.type, sizeBytes: f.size });
      const res = await fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSendEmailBody({ form, files: prepared, sendMode: mode, driveFolderId: folder, employeeId, approval })),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setLinks(Array.isArray(data.driveLinks) ? data.driveLinks : []);
        setState('done');
        setTimeout(onClose, 2600);
      } else {
        ec.say(data.message || 'שגיאה בשליחת המייל', 'error');
        setState('idle');
      }
    } catch {
      ec.say('שגיאת תקשורת', 'error');
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <Dlg className="mailwin" labelledBy="mail-t" onClose={onClose} focusSel=".mx">
        <div className="mh"><span className="mico"><Ic id="mail" size="lg" /></span><h2 id="mail-t">שליחת מייל</h2></div>
        <div className="ec-mok">
          <div className="big-ck"><Ic id="check" size="lg" /></div>
          <b>המייל נשלח בהצלחה!</b>
          {links.length > 0 ? (
            <div className="ec-mhint" style={{ textAlign: 'start', width: '100%' }}>
              <b style={{ fontSize: 15 }}>קישורי דרייב (הרשאת הורדה מלאה):</b>
              <ul style={{ paddingInlineStart: 18, margin: '8px 0 0' }}>
                {links.map((l, i) => <li key={i}>{l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.fileName || l.url}</a> : (l.fileName || '')}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </Dlg>
    );
  }

  return (
    <Dlg className="mailwin" labelledBy="mail-t" onClose={close} focusSel="#m-sub">
      <div className="mh">
        <span className="mico"><Ic id="mail" size="lg" /></span>
        <h2 id="mail-t">שליחת מייל<small className="msub">אל {name}</small></h2>
        <button type="button" className="ibtn mx" data-ec="m-x" aria-label="סגירה" data-tip="סגור" onClick={close} disabled={state === 'sending'}><Ic id="x" size="sm" /></button>
      </div>
      <div className="ec-mrow">
        <div className="mfld"><label className="lbl" htmlFor="m-to">אל (To)</label><input className="inp" id="m-to" type="email" dir="ltr" value={form.to} onChange={set('to')} disabled={dis} {...NO_FILL} /></div>
        <div className="mfld"><label className="lbl" htmlFor="m-cc">עותק (CC)</label><input className="inp" id="m-cc" type="email" dir="ltr" value={form.cc} onChange={set('cc')} disabled={dis} {...NO_FILL} /></div>
      </div>
      <div className="mfld"><label className="lbl" htmlFor="m-sub">נושא</label><input className="inp" id="m-sub" type="text" value={form.subject} onChange={set('subject')} disabled={dis} {...NO_FILL} /></div>
      <div className="mfld"><label className="lbl" htmlFor="m-body">תוכן</label><textarea className="inp" id="m-body" rows={6} value={form.body} onChange={set('body')} disabled={dis} /></div>
      <div className="mfld">
        <span className="lbl"><Ic id="clip" size="sm" />קבצים מצורפים (ניתן לבחור כמה)</span>
        {files.length ? (
          <div className="ec-files">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="mfile on">
                <span className="mft"><Ic id="file" /></span>
                <span className="mfx"><b>{f.name}</b><small>{fmtSize(f.size)} · {mode === 'email' ? 'מצורף למייל' : mode === 'drive' ? 'נשמר בדרייב' : 'מייל + דרייב'}</small></span>
                <button type="button" className="mfe" data-ec="m-rm" aria-label="הסרת הקובץ" data-tip="הסר" disabled={dis} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><Ic id="x" size="sm" /></button>
              </div>
            ))}
            <div className="ec-mhint">טבלת הוראות מסודרת תצורף אוטומטית לגוף המייל דרך ה-GAS, כולל איך מורידים כל קובץ.</div>
          </div>
        ) : null}
        <button type="button" className="btn sm ec-addfile" data-ec="m-add" disabled={dis} onClick={() => fileRef.current && fileRef.current.click()}><Ic id="plus" size="sm" />בחירת קבצים</button>
        <input type="file" id="m-file" multiple hidden ref={fileRef} onChange={(e) => { const picked = Array.from(e.target.files || []); if (picked.length) setFiles((p) => [...p, ...picked]); e.target.value = ''; }} />
      </div>
      <div className="mfld">
        <span className="lbl">יעד הקבצים בהתאמה</span>
        <div className="methods ec-mode" role="radiogroup" aria-label="יעד הקבצים בהתאמה">
          {SEND_MODES.map(([v, l, icon]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} className={mode === v ? 'on' : ''} data-ec="m-mode" disabled={dis} onClick={() => setMode(v)}><Ic id={icon} size="lg" />{l}</button>
          ))}
        </div>
        {mode !== 'email' ? (
          <>
            <input className="inp" id="m-folder" type="text" dir="ltr" placeholder="מזהה תיקיית דרייב (רשות - אחרת ברירת המחדל מההגדרות)" value={folder} onChange={(e) => setFolder(e.target.value)} style={{ marginTop: 8 }} disabled={dis} {...NO_FILL} />
            <div className="ec-mhint" style={{ marginTop: 6 }}>הקבצים יועלו לדרייב וישותפו עם הנמען בהרשאת צפייה והורדה מלאה + קישור פתוח להורדה.</div>
          </>
        ) : null}
      </div>
      <div className="dbtns mact">
        <button type="button" className="btn primary lg" data-ec="m-send" id="m-send" disabled={!valid || state !== 'idle'} onClick={send}>
          {state === 'sending' ? <><span className="mspin" />שולח...</> : <><Ic id="mail" />שלח מייל</>}
        </button>
        <button type="button" className="btn ghost" data-ec="m-cancel" disabled={dis} onClick={close}><Ic id="x" size="sm" />ביטול</button>
      </div>
    </Dlg>
  );
}
