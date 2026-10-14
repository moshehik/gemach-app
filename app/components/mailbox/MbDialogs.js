'use client';

// חלונות תיבת המייל בעיצוב הפלטה: קריאת הודעה (MbRead) וכתיבה / תשובה / העברה (MbCompose) - שניהם `.dlg.mailwin` (חלון המייל של כרטיס
// ההזמנה, כמו EcMail / OcMailSheet) על ה-Dlg הכהה של ערכת הרשימות. בלי window.confirm: אישורים דרך a5.confirm. הלוגיקה: mailboxLogic.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNoFill } from '@/lib/autofillGuard';
import { Dlg, Ic, hDateFull, timeHM, useA5 } from '../a5-list';
import { API, api, attachmentUrl, post } from './mailboxApi';
import {
  MAX_ATT_BYTES, addAddress, addrList, composeDraft, fmtBytes, frameDoc, hasAddress, hasRemoteImages, normAddr,
} from './mailboxLogic';

const toBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = reject;
  r.readAsDataURL(file);
});

function Who({ a }) {
  const n = normAddr(a);
  if (!n) return null;
  return n.name ? <><bdi>{n.name}</bdi> <bdi dir="ltr" className="mbx-addr">&lt;{n.address}&gt;</bdi></> : <bdi dir="ltr" className="mbx-addr">{n.address}</bdi>;
}
const WhoList = ({ list }) => addrList(list).map((a, i) => <span key={i}>{i > 0 ? ', ' : ''}<Who a={a} /></span>);

/* ---------------------------------- קריאה ---------------------------------- */

export function MbRead({ folder, folderObj, uid, onClose, onChanged, onOpened, onCompose, isTrash }) {
  const a5 = useA5();
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState('');
  const [showImages, setShowImages] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setMsg(null); setError(''); setShowImages(false);
    api(`${API}?action=message&folder=${encodeURIComponent(folder)}&uid=${uid}`)
      .then((d) => { if (live) { setMsg(d.message); onOpened(uid); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [folder, uid]);

  const flagged = !!(msg && (msg.flags || []).includes('\\Flagged'));
  const flag = async (flagName, on) => {
    setBusy(true);
    try {
      await post({ action: 'flags', folder, uid, ...(on ? { addFlags: [flagName] } : { removeFlags: [flagName] }) });
      if (flagName === '\\Flagged') setMsg((m) => ({ ...m, flags: on ? [...(m.flags || []), flagName] : (m.flags || []).filter((f) => f !== flagName) }));
      else { onChanged(); onClose(); a5.say('סומן כלא נקרא', 'ok'); return; }
      onChanged();
    } catch (e) { a5.say('הפעולה נכשלה', 'error', e.message); }
    setBusy(false);
  };
  const remove = async () => {
    const ok = await a5.confirm({
      title: isTrash ? 'למחוק את ההודעה לצמיתות?' : 'להעביר את ההודעה לאשפה?',
      sub: isTrash ? 'אי אפשר לשחזר הודעה שנמחקה מהאשפה' : 'אפשר לשחזר אותה מתיקיית האשפה',
      okLabel: isTrash ? 'מחיקה לצמיתות' : 'העברה לאשפה', icon: 'trash',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await post({ action: 'delete', folder, uid });
      a5.say(isTrash ? 'ההודעה נמחקה' : 'ההודעה הועברה לאשפה', 'ok');
      onChanged(); onClose();
    } catch (e) { a5.say('המחיקה נכשלה', 'error', e.message); setBusy(false); }
  };

  const files = msg ? (msg.attachments || []).filter((x) => x && (!x.inline || x.filename)) : [];
  const date = msg && msg.date ? `${hDateFull(msg.date)} · ${timeHM(msg.date)}` : '';
  const row = (k, v) => <div className="mbx-mr"><small>{k}</small><b>{v}</b></div>;

  return (
    <Dlg className="mailwin mbx-read" labelledBy="mbx-read-t" onClose={onClose} focusSel=".mx">
      <div className="mh">
        <span className="mico"><Ic id="mail" size="lg" /></span>
        <h2 id="mbx-read-t">{msg ? (msg.subject || '(ללא נושא)') : 'הודעה'}</h2>
        <button type="button" className="ibtn mx" aria-label="סגירה" data-tip="סגור" onClick={onClose}><Ic id="x" size="sm" /></button>
      </div>
      {!msg && !error ? <div className="mbx-load"><span className="mspin" />טוען הודעה…</div> : null}
      {error ? <div className="mbx-err" role="alert"><Ic id="alert" size="sm" />{error}</div> : null}
      {msg ? (
        <>
          <div className="mto mbx-meta">
            {row('מאת', <Who a={msg.from} />)}
            {row('אל', <WhoList list={msg.to} />)}
            {addrList(msg.cc).length ? row('עותק', <WhoList list={msg.cc} />) : null}
            {date ? row('נשלח', date) : null}
          </div>
          {files.length ? (
            <div className="mfld">
              <span className="lbl"><Ic id="clip" size="sm" />{files.length === 1 ? 'קובץ מצורף' : 'קבצים מצורפים'}</span>
              <div className="mfiles">
                {files.map((f) => (
                  <a key={f.id} className="mfile on mbx-att" href={attachmentUrl(folder, uid, f)}>
                    <span className="mft"><Ic id="file" /></span>
                    <span className="mfx"><b><bdi>{f.filename || 'קובץ'}</bdi></b><small>{fmtBytes(f.sizeBytes)}</small></span>
                    <span className="mfe" aria-hidden="true"><Ic id="download" size="sm" /></span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mbx-body">
            {msg.body && msg.body.html ? (
              <>
                {!showImages && hasRemoteImages(msg.body.html) ? (
                  <div className="mbx-imgbar"><Ic id="eye" size="sm" />תמונות מרוחקות נחסמו כדי לא לחשוף שפתחת את המייל.
                    <button type="button" className="btn sm" onClick={() => setShowImages(true)}>הצג תמונות</button></div>
                ) : null}
                <iframe title="תוכן ההודעה" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={frameDoc(msg.body.html, showImages)} />
              </>
            ) : <pre className="mbx-plain">{(msg.body && msg.body.text) || '(ההודעה ריקה)'}</pre>}
          </div>
          <div className="mbx-acts">
            <button type="button" className="btn primary" disabled={busy} onClick={() => onCompose('reply', msg)}><Ic id="back" size="sm" />השב</button>
            <button type="button" className="btn" disabled={busy} onClick={() => onCompose('replyAll', msg)}><Ic id="users" size="sm" />השב לכולם</button>
            <button type="button" className="btn" disabled={busy} onClick={() => onCompose('forward', msg)}><Ic id="redo" size="sm" />העבר</button>
            <button type="button" className="btn" disabled={busy} onClick={() => flag('\\Flagged', !flagged)}><Ic id="bookmark" size="sm" />{flagged ? 'הסר סימון' : 'סמן'}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => flag('\\Seen', false)}><Ic id="mail" size="sm" />סמן כלא נקרא</button>
            <button type="button" className="btn" disabled={busy} onClick={remove}><Ic id="trash" size="sm" />{isTrash ? 'מחק לצמיתות' : 'מחק'}</button>
          </div>
        </>
      ) : null}
    </Dlg>
  );
}

/* ---------------------------------- כתיבה ---------------------------------- */

const TARGETS = [['to', 'אל'], ['cc', 'עותק'], ['bcc', 'עותק מוסתר']];

// בוחר לקוחות: חיפוש לפי שם / טלפון / מייל (/api/admin/mailbox?action=customers); לחיצה מוסיפה את הכתובת לשדה שנבחר.
function CustomerPicker({ nf, fields, onAdd }) {
  const [q, setQ] = useState('');
  const [target, setTarget] = useState('to');
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows([]); setState('idle'); return undefined; }
    const my = ++seq.current;
    setState('loading');
    const t = setTimeout(async () => {
      try {
        const d = await api(`${API}?action=customers&q=${encodeURIComponent(term)}`);
        if (my === seq.current) { setRows(d.customers || []); setState('done'); setError(''); }
      } catch (e) { if (my === seq.current) { setError(e.message); setState('error'); } }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mbx-picker">
      <div className="mfld">
        <label className="lbl" htmlFor="mbx-pick-q"><Ic id="search" size="sm" />חיפוש לקוח (שם, טלפון או מייל)</label>
        <input className="inp" id="mbx-pick-q" type="text" {...nf('search')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="methods mbx-target" role="radiogroup" aria-label="להוסיף לשדה">
        {TARGETS.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={target === k} className={target === k ? 'on' : ''} onClick={() => setTarget(k)}>{l}</button>
        ))}
      </div>
      <div className="mfiles mbx-results">
        {state === 'idle' ? <div className="mbx-hint">הקלד לפחות 2 תווים</div> : null}
        {state === 'loading' && !rows.length ? <div className="mbx-hint"><span className="mspin" /> מחפש…</div> : null}
        {state === 'error' ? <div className="mbx-err" role="alert"><Ic id="alert" size="sm" />{error}</div> : null}
        {state === 'done' && !rows.length ? <div className="mbx-hint">לא נמצאו לקוחות עם מייל</div> : null}
        {rows.map((c) => {
          const added = hasAddress(fields[target], c.email);
          return (
            <button type="button" key={c.id} className={`mfile${added ? ' on' : ''}`} disabled={added} onClick={() => onAdd(target, c.email)}>
              <span className="mft"><Ic id="user" /></span>
              <span className="mfx"><b><bdi>{c.name}</bdi></b><small><bdi dir="ltr">{c.email}</bdi>{[c.phone, c.city].filter(Boolean).length ? ` · ${[c.phone, c.city].filter(Boolean).join(' · ')}` : ''}</small></span>
              <span className="mfk"><Ic id="check" /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MbCompose({ draft, me, onClose, onSent }) {
  const nf = useNoFill();
  const a5 = useA5();
  const fileRef = useRef(null);
  const bodyRef = useRef(null);
  const [f, setF] = useState(() => ({ ...draft }));
  const [showBcc, setShowBcc] = useState(!!draft.bcc);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const total = useMemo(() => f.files.reduce((s, x) => s + x.size, 0), [f.files]);
  const set = (k) => (e) => { setErr(''); setF((s) => ({ ...s, [k]: e.target.value })); };
  const title = { new: 'מייל חדש', reply: 'תשובה', replyAll: 'תשובה לכולם', forward: 'העברה' }[f.kind] || 'מייל חדש';
  const close = () => { if (!busy) onClose(); };

  // הגדלה אוטומטית של שדה התוכן (בפלטה #m-body הוא בלי גלילה)
  useEffect(() => {
    const el = bodyRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight + 2, 460)}px`; }
  }, [f.text]);

  const addRecipient = (field, email) => {
    setF((s) => ({ ...s, [field]: addAddress(s[field], email) }));
    if (field === 'bcc') setShowBcc(true);
  };

  const addFiles = async (list) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    if (total + picked.reduce((s, x) => s + x.size, 0) > MAX_ATT_BYTES) { setErr(`הקבצים גדולים מדי (מקסימום ${fmtBytes(MAX_ATT_BYTES)} ביחד)`); return; }
    try {
      const read = await Promise.all(picked.map(async (file) => ({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, content: await toBase64(file) })));
      setF((s) => ({ ...s, files: [...s.files, ...read] }));
      setErr('');
    } catch { setErr('קריאת הקובץ נכשלה'); }
  };

  const send = async () => {
    if (busy) return;
    if (!f.text.trim()) {
      const ok = await a5.confirm({ title: 'לשלוח מייל בלי תוכן?', sub: 'במייל יש רק נושא. מיילים ריקים נוטים להגיע לספאם.', okLabel: 'שליחה', icon: 'check', cancelLabel: 'חזרה לעריכה' });
      if (!ok) return;
    }
    setBusy(true); setErr('');
    try {
      await post({
        action: 'send', to: f.to, cc: f.cc, bcc: f.bcc, subject: f.subject, text: f.text,
        attachments: f.files.map(({ filename, contentType, content }) => ({ filename, contentType, content })),
        ...(f.replyTo ? { replyTo: f.replyTo } : {}), ...(f.forwardOf ? { forwardOf: f.forwardOf } : {}),
      });
      onSent();
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <Dlg className="mailwin mbx-compose" labelledBy="mbx-compose-t" onClose={close} focusSel="#mbx-to">
      <div className="mh">
        <span className="mico"><Ic id="mail" size="lg" /></span>
        <h2 id="mbx-compose-t">{title}{me ? <small className="msub">מ-<bdi dir="ltr">{me}</bdi></small> : null}</h2>
        <button type="button" className="ibtn mx" aria-label="סגירה" data-tip="סגור" onClick={close} disabled={busy}><Ic id="x" size="sm" /></button>
      </div>
      <div className="mfld">
        <label className="lbl" htmlFor="mbx-to">אל</label>
        <input className="inp" id="mbx-to" type="text" dir="ltr" {...nf('email')} value={f.to} onChange={set('to')} disabled={busy} placeholder="name@example.com, ..." />
        <button type="button" className="btn sm mbx-pickbtn" aria-expanded={picker} onClick={() => setPicker((v) => !v)}><Ic id="users" size="sm" />בחירה מרשימת הלקוחות</button>
      </div>
      {picker ? <CustomerPicker nf={nf} fields={f} onAdd={addRecipient} /> : null}
      <div className="mbx-two">
        <div className="mfld"><label className="lbl" htmlFor="mbx-cc">עותק</label><input className="inp" id="mbx-cc" type="text" dir="ltr" {...nf('email')} value={f.cc} onChange={set('cc')} disabled={busy} /></div>
        {showBcc
          ? <div className="mfld"><label className="lbl" htmlFor="mbx-bcc">עותק מוסתר</label><input className="inp" id="mbx-bcc" type="text" dir="ltr" {...nf('email')} value={f.bcc} onChange={set('bcc')} disabled={busy} /></div>
          : <div className="mfld mbx-bccbtn"><button type="button" className="btn sm" onClick={() => setShowBcc(true)}><Ic id="plus" size="sm" />עותק מוסתר</button></div>}
      </div>
      <div className="mfld"><label className="lbl" htmlFor="mbx-subj">נושא</label><input className="inp" id="mbx-subj" type="text" {...nf('subject')} value={f.subject} onChange={set('subject')} disabled={busy} /></div>
      <div className="mfld"><label className="lbl" htmlFor="m-body">תוכן</label><textarea className="inp" id="m-body" ref={bodyRef} rows={6} dir="auto" value={f.text} onChange={set('text')} disabled={busy} /></div>
      <div className="mfld">
        <span className="lbl"><Ic id="clip" size="sm" />קבצים מצורפים</span>
        {f.files.length ? (
          <div className="mfiles">
            {f.files.map((x, i) => (
              <div key={`${x.filename}-${i}`} className="mfile on">
                <span className="mft"><Ic id="file" /></span>
                <span className="mfx"><b><bdi>{x.filename}</bdi></b><small>{fmtBytes(x.size)}</small></span>
                <button type="button" className="mfe" aria-label={`הסרת ${x.filename}`} data-tip="הסר" disabled={busy} onClick={() => setF((s) => ({ ...s, files: s.files.filter((_, j) => j !== i) }))}><Ic id="x" size="sm" /></button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mfh">
          <button type="button" className="btn sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}><Ic id="plus" size="sm" />בחירת קבצים</button>
          <span className="mtot">{total > 0 ? `${fmtBytes(total)} מתוך ${fmtBytes(MAX_ATT_BYTES)}` : `עד ${fmtBytes(MAX_ATT_BYTES)} ביחד`}</span>
        </div>
        <input type="file" multiple hidden ref={fileRef} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {err ? <div className="mbx-err" role="alert"><Ic id="alert" size="sm" />{err}</div> : null}
      <div className="dbtns mact">
        <button type="button" className="btn primary lg" id="m-send" disabled={busy || !f.to.trim()} onClick={send}>
          {busy ? <><span className="mspin" />שולח...</> : <><Ic id="send" />שלח מייל</>}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={close}><Ic id="x" size="sm" />ביטול</button>
      </div>
    </Dlg>
  );
}

export { composeDraft };
