'use client';

// "מייל מהיר" (העיצוב: mailOpen / mail-sheet-css - גיליון תחתון בשתי עמודות, כהה). החוזה מול השרת זהה לכרטיס הישן
// (ModernSendEmailModal): POST /api/send-email { to, subject, emailBody, username, password, customerId, fileName, fileContent,
// attachments[], sendMode, driveFolderId } - נבנה ב-buildMailPayload. ההבדלים מהישן (מאושרים): הנושא ממולא מראש "כרטיס לקוח · שם"
// (mailpre), אישור המנהל נשאל בלחיצה על "שלח" ולא לפני פתיחת החלון (העיצוב), ו"דפים לצירוף" - רק מסמכים שקיימים במערכת היום
// (כרטיס לקוחה / דף חשבון / סיכומי הזמנות, PDF מדף ההדפסה דרך POST /api/pdf). "תקנון חתום" ו"קבלות" לא קיימים ולא מוצגים.
// קבצים נוספים + יעד (צרופה / דרייב / גם וגם) + תיקיית דרייב - כמו בישן (mailfiles).

import { useEffect, useRef, useState } from 'react';
import CcIcon from './CcIcon';
import { DlgBtn, DlgButtons, DlgHead, NO_FILL } from './CcUi';
import { buildMailPayload, displayName, mailDocuments, mailSubjectFor } from './customerCardLogic';
import CcApprovalDialog from './CcApproval';

const DESTS = [['email', 'צרופה למייל'], ['drive', 'דרייב + שיתוף'], ['both', 'גם וגם']];
const fileToBase64 = (f) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.readAsDataURL(f);
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = reject;
});
const plural = (n) => (n === 0 ? 'ללא קבצים' : n === 1 ? 'קובץ אחד' : `${n} קבצים`);

function DiscardMailDialog({ close }) {
  return (
    <>
      <DlgHead id="disc-t" title="לזרוק את המייל?" sub="השינויים לא יישמרו" badge="trash" />
      <DlgButtons>
        <DlgBtn kind="primary" icon="trash" act="disc-yes" autoFocus onClick={() => close(true)}>כן, סגור</DlgBtn>
        <DlgBtn kind="ghost" icon="pencil" act="disc-no" onClick={() => close(false)}>המשך עריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}
DiscardMailDialog.ccLayer = 2;

export default function CcMailSheet({ customer, ui, guard, onSent, close, fetchImpl, pdfImpl }) {
  const [subject, setSubject] = useState(() => mailSubjectFor(customer));
  const [body, setBody] = useState('');
  const [docs, setDocs] = useState([]); // מזהי מסמכים שנבחרו
  const [files, setFiles] = useState([]); // File[]
  const [sendMode, setSendMode] = useState('email');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const dirty = useRef(false);
  const fileRef = useRef(null);
  const bodyRef = useRef(null);
  const all = mailDocuments(customer);
  const busy = state !== 'idle';
  const valid = !!customer.email && subject.trim() && body.trim();

  const tryClose = async () => {
    if (busy) return;
    if (!dirty.current) { close(false); return; }
    const yes = await ui.openDialog(DiscardMailDialog, {}, { layer: 2, labelledBy: 'disc-t' });
    if (yes) close(false); else if (bodyRef.current) bodyRef.current.focus();
  };
  useEffect(() => { if (guard) guard.current = tryClose; });

  // גובה תיבת התוכן גדל עם הטקסט (כמו בעיצוב)
  useEffect(() => { const ta = bodyRef.current; if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.scrollHeight, 150)}px`; } }, [body]);

  const toggleDoc = (id) => { if (busy) return; dirty.current = true; setDocs((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id])); };

  const send = async () => {
    if (!valid || busy) { if (!subject.trim() || !body.trim()) setError('חובה למלא נושא ותוכן'); return; }
    setError('');
    const auth = await ui.openDialog(CcApprovalDialog, { level: 'feature:customer_email_approval', reason: 'שליחת מייל מהיר ללקוחה', customerId: customer.id }, { layer: 2, className: 'apprwin', labelledBy: 'cc-appr-t' });
    if (!auth) return;
    setState('sending');
    try {
      const attachments = [];
      if (docs.length) {
        const fetchPdfBase64 = pdfImpl || (await import('@/app/lib/pdfClient')).fetchPdfBase64;
        for (const id of docs) {
          const d = all.find((x) => x.id === id);
          if (!d) continue;
          const b64 = await fetchPdfBase64({ path: d.path, filename: d.file });
          attachments.push({ fileName: `${d.file}.pdf`, fileContent: b64, mimeType: 'application/pdf', sizeBytes: Math.round((b64.length * 3) / 4) });
        }
      }
      for (const f of files) {
        attachments.push({ fileName: f.name, fileContent: await fileToBase64(f), mimeType: f.type || 'application/octet-stream', sizeBytes: f.size || null });
      }
      const payload = buildMailPayload({ customer, subject, body, attachments, sendMode, driveFolderId, auth });
      const res = await (fetchImpl || fetch)('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!data.success) { setState('idle'); setError(data.message || 'שגיאה בשליחת המייל'); return; }
      setState('done');
      const links = Array.isArray(data.driveLinks) ? data.driveLinks : [];
      setTimeout(() => {
        close(true);
        onSent && onSent({ to: customer.email, count: attachments.length, links, approver: auth.employeeName });
      }, 750);
    } catch (e) {
      setState('idle');
      setError(e && e.message ? e.message : 'שגיאת תקשורת');
    }
  };

  const destIdx = Math.max(0, DESTS.findIndex(([v]) => v === sendMode));
  return (
    <>
      <div className="mh">
        <span className="mico" aria-hidden="true"><CcIcon name="mail" size="lg" anim={false} /></span>
        <h2 id="mail-t">מייל מהיר<small className="msub">אל {displayName(customer)} · {customer.email ? <bdi dir="ltr">{customer.email}</bdi> : <span className="missv"><CcIcon name="alert" size="sm" />חסר מייל</span>}</small></h2>
        <button type="button" className="ibtn mx" data-act="mail-x" aria-label="סגירה" data-tip="סגור" onClick={tryClose}><CcIcon name="x" size="sm" /></button>
      </div>
      {error ? <div className="amsg cc-mailerr" role="alert"><CcIcon name="alert" size="sm" />{error}</div> : null}
      <div className="fx-2col">
        <div className="fx-stack">
          <div className="mfld"><label className="lbl" htmlFor="m-sub">נושא</label><input className="inp" id="m-sub" value={subject} disabled={busy} data-autofocus="true" onChange={(e) => { dirty.current = true; setSubject(e.target.value); }} {...NO_FILL} /></div>
          <div className="mfld"><label className="lbl" htmlFor="m-body">תוכן</label><textarea className="inp" id="m-body" ref={bodyRef} rows={9} placeholder="כתבו כאן את ההודעה ללקוחה…" value={body} disabled={busy} onChange={(e) => { dirty.current = true; setBody(e.target.value); }} {...NO_FILL} /></div>
        </div>
        <div className="fx-stack">
          <div className="mfld">
            <span className="lbl"><CcIcon name="clip" size="sm" />דפים לצירוף</span>
            <div className="mfiles">
              {all.map((d) => {
                const on = docs.includes(d.id);
                return (
                  <div key={d.id} className={`mfile${on ? ' on' : ''}`} role="checkbox" aria-checked={on} tabIndex={0} data-act="mail-file" data-id={d.id}
                    onClick={(e) => { if (e.target.closest && e.target.closest('.mfe')) return; toggleDoc(d.id); }}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleDoc(d.id); } }}>
                    <span className="mft"><CcIcon name="file" /></span>
                    <span className="mfx"><b>{d.name}</b><small /></span>
                    <button type="button" className="mfe" data-act="mail-prev" data-tip="תצוגה" aria-label="תצוגה מקדימה" onClick={() => window.open(d.preview, '_blank', 'noopener')}><CcIcon name="eye" size="sm" /></button>
                    <span className="mfk"><CcIcon name="check" size="sm" /></span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mfld">
            <span className="lbl"><CcIcon name="clip" size="sm" />קבצים נוספים</span>
            <div className="mfiles">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="mfile on cc-xfile">
                  <span className="mft"><CcIcon name="file" /></span>
                  <span className="mfx"><b>{f.name}</b><small>{f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : ''}</small></span>
                  <button type="button" className="mfe" data-act="mail-rm" data-tip="הסרה" aria-label={`הסרת ${f.name}`} disabled={busy} onClick={() => { dirty.current = true; setFiles((l) => l.filter((_, j) => j !== i)); }}><CcIcon name="x" size="sm" /></button>
                </div>
              ))}
            </div>
            <div><button type="button" className="btn sm cc-addfile" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><CcIcon name="plus" size="sm" />הוספת קובץ</button></div>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { const l = e.target.files ? Array.from(e.target.files) : []; if (l.length) { dirty.current = true; setFiles((prev) => [...prev, ...l]); } e.target.value = ''; }} />
          </div>
            <div className="mfld">
              <span className="lbl" id="cc-dest-l">יעד הקבצים</span>
              <div className="seg pill" role="radiogroup" aria-labelledby="cc-dest-l" style={{ '--n': 3, '--i': destIdx }}>
                <span className="pth" aria-hidden="true" />
                {DESTS.map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={sendMode === v} className={sendMode === v ? 'on' : ''} disabled={busy} onClick={() => setSendMode(v)}>{l}</button>
                ))}
              </div>
              {sendMode !== 'email' ? (
                <>
                  <label className="lbl cc-drive-l" htmlFor="m-drive">מזהה תיקיית דרייב</label>
                  <input className="inp cc-drive" id="m-drive" dir="ltr" placeholder="מזהה תיקייה (רשות)" value={driveFolderId} disabled={busy} onChange={(e) => setDriveFolderId(e.target.value)} {...NO_FILL} />
                  <div className="faint sm">הקבצים ישותפו עם הנמען בהרשאת הורדה מלאה.</div>
                </>
              ) : null}
              {(docs.length + files.length) > 0 ? <div className="faint sm">{plural(docs.length + files.length)} · טבלת הוראות תצורף אוטומטית למייל.</div> : null}
            </div>
        </div>
      </div>
      <div className="dbtns mact fx-actions">
        <button type="button" className="btn primary lg" data-act="mail-send" id="m-send" disabled={!valid || busy} onClick={send}>
          {state === 'sending' ? <><span className="mspin" aria-hidden="true" />שולח…</> : state === 'done' ? <><CcIcon name="check" />נשלח</> : <><CcIcon name="send" />שלח מייל</>}
        </button>
        <button type="button" className="btn ghost" data-act="mail-cancel" disabled={busy} onClick={tryClose}><CcIcon name="x" size="sm" />ביטול</button>
      </div>
    </>
  );
}
