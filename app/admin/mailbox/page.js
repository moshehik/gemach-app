'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNoFill } from '@/lib/autofillGuard';
import './mailbox.css';

// תיבת מייל (/admin/mailbox): תיבת הדואר של האתר (Hostinger) - נכנסים, נשלחו, קריאה, תשובה והעברה וכתיבת מייל חדש.
// כל הקריאות עוברות דרך /api/admin/mailbox (הטוקן נשאר בשרת). גוף HTML מוצג בתוך iframe מוגבל (sandbox, בלי סקריפטים)
// ותמונות מרוחקות חסומות עד לחיצה (מעקב). השער: app/admin/layout.js + הנהלה ראשית בשרת.
// השער לשדות סיסמה/כתובת: useNoFill (מונע מילוי אוטומטי של הדפדפן).

const API = '/api/admin/mailbox';
const FOLDER_LABEL = { INBOX: 'נכנסים', 'INBOX.Sent': 'נשלחו', 'INBOX.Drafts': 'טיוטות', 'INBOX.Trash': 'אשפה', 'INBOX.Spam': 'ספאם', 'INBOX.Junk': 'ספאם', 'INBOX.Archive': 'ארכיון' };
const SPECIAL_LABEL = { '\\Sent': 'נשלחו', '\\Drafts': 'טיוטות', '\\Trash': 'אשפה', '\\Junk': 'ספאם', '\\Archive': 'ארכיון' };
const MAX_ATT_BYTES = 3 * 1024 * 1024;
const TZ = 'Asia/Jerusalem';

const folderLabel = (f) => (f.path === 'INBOX' ? 'נכנסים' : SPECIAL_LABEL[f.specialUse] || FOLDER_LABEL[f.path] || f.name);
const addrText = (a) => (a ? (a.name && a.name !== a.address ? `${a.name} <${a.address}>` : a.address) : '');
const addrShort = (a) => (a ? a.name || a.address : '');
function Addr({ a }) {
  if (!a) return null;
  return a.name && a.name !== a.address
    ? <><bdi>{a.name}</bdi> <bdi dir="ltr">&lt;{a.address}&gt;</bdi></>
    : <bdi dir="ltr">{a.address}</bdi>;
}
function AddrList({ list }) {
  return (list || []).map((a, i) => <span key={i}>{i > 0 && ', '}<Addr a={a} /></span>);
}
const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

function fmtDate(iso, full) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x) => x.toLocaleDateString('en-CA', { timeZone: TZ });
  if (full) return d.toLocaleString('he-IL', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
  if (day(d) === day(new Date())) return d.toLocaleTimeString('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('he-IL', { timeZone: TZ, day: 'numeric', month: 'short' });
}

async function api(path, init) {
  const res = await fetch(path, { cache: 'no-store', ...init });
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new Error((data && data.error) || `שגיאה (${res.status})`);
  return data;
}
const post = (body) => api(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function frameDoc(html, showImages) {
  const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: cid:${showImages ? ' https: http:' : ''}`;
  return `<!doctype html><html dir="auto"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.55;margin:14px;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}

export default function MailboxPage() {
  const nf = useNoFill();
  const [status, setStatus] = useState(null); // null = טוען | { enabled, address, folders, quota }
  const [loadError, setLoadError] = useState('');
  const [folder, setFolder] = useState('INBOX');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState({ data: [], pagination: null });
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [sel, setSel] = useState(null); // { folder, uid }
  const [msg, setMsg] = useState(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [showImages, setShowImages] = useState(false);
  const [view, setView] = useState('list'); // מובייל: folders | list | read
  const [compose, setCompose] = useState(null);
  const [toast, setToast] = useState('');
  const reqId = useRef(0);

  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 3500); };

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api(`${API}?action=status`));
      setLoadError('');
    } catch (e) { setLoadError(e.message); }
  }, []);

  const loadList = useCallback(async (silent) => {
    const my = ++reqId.current;
    if (!silent) setListLoading(true);
    try {
      const qs = new URLSearchParams({ action: 'messages', folder, page: String(page), ...(query ? { q: query } : {}) });
      const data = await api(`${API}?${qs}`);
      if (my === reqId.current) { setList(data); setListError(''); }
    } catch (e) { if (my === reqId.current) setListError(e.message); }
    finally { if (my === reqId.current) setListLoading(false); }
  }, [folder, page, query]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status && status.enabled) loadList(false); }, [status && status.enabled, loadList]);
  useEffect(() => {
    if (!status || !status.enabled) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') { loadList(true); loadStatus(); } }, 60000);
    return () => clearInterval(t);
  }, [status && status.enabled, loadList, loadStatus]);

  async function openMessage(m) {
    setSel({ folder, uid: m.uid });
    setMsg(null); setMsgError(''); setShowImages(false); setMsgLoading(true); setView('read');
    try {
      const data = await api(`${API}?action=message&folder=${encodeURIComponent(folder)}&uid=${m.uid}`);
      setMsg(data.message);
      setList((l) => ({ ...l, data: l.data.map((x) => (x.uid === m.uid ? { ...x, unseen: false, flags: [...new Set([...(x.flags || []), '\\Seen'])] } : x)) }));
      loadStatus();
    } catch (e) { setMsgError(e.message); }
    finally { setMsgLoading(false); }
  }

  async function act(action, extra, okText) {
    try {
      await post({ action, folder: sel.folder, uid: sel.uid, ...extra });
      if (okText) flash(okText);
      return true;
    } catch (e) { flash(`שגיאה: ${e.message}`); return false; }
  }

  async function toggleFlag(flag, on) {
    if (!sel || !msg) return;
    if (await act('flags', on ? { addFlags: [flag] } : { removeFlags: [flag] })) {
      const apply = (x) => { const s = new Set(x.flags || []); if (on) s.add(flag); else s.delete(flag); const flags = [...s]; return { ...x, flags, unseen: !flags.includes('\\Seen') }; };
      setMsg((m) => apply(m));
      setList((l) => ({ ...l, data: l.data.map((x) => (x.uid === sel.uid ? apply(x) : x)) }));
      loadStatus();
    }
  }

  async function removeMsg() {
    if (!sel) return;
    const inTrash = (status.folders.find((f) => f.path === sel.folder) || {}).specialUse === '\\Trash';
    if (inTrash && !window.confirm('למחוק את ההודעה לצמיתות?')) return;
    if (await act('delete', {}, inTrash ? 'נמחק לצמיתות' : 'הועבר לאשפה')) {
      setSel(null); setMsg(null); setView('list'); loadList(true); loadStatus();
    }
  }

  function openCompose(kind) {
    const me = (status && status.address) || '';
    if (kind === 'new' || !msg) { setCompose({ kind: 'new', to: '', cc: '', bcc: '', subject: '', text: '', files: [] }); return; }
    const from = msg.from && msg.from.address;
    const when = fmtDate(msg.date, true);
    const quoted = `\n\n\nב-${when}, ${addrText(msg.from)} כתב/ה:\n${String((msg.body && msg.body.text) || '').split('\n').map((l) => `> ${l}`).join('\n')}`;
    const ref = { uid: sel.uid, folder: sel.folder };
    if (kind === 'forward') {
      setCompose({ kind, to: '', cc: '', bcc: '', subject: /^(fwd?|הועבר):/i.test(msg.subject || '') ? msg.subject : `Fwd: ${msg.subject || ''}`, text: quoted, files: [], forwardOf: ref });
      return;
    }
    const others = kind === 'replyAll' ? [...(msg.to || []), ...(msg.cc || [])].map((a) => a.address).filter((a) => a && a.toLowerCase() !== me.toLowerCase() && a !== from) : [];
    setCompose({ kind, to: from || '', cc: others.join(', '), bcc: '', subject: /^re:/i.test(msg.subject || '') ? msg.subject : `Re: ${msg.subject || ''}`, text: quoted, files: [], replyTo: ref });
  }

  const folders = (status && status.folders) || [];
  const curFolderObj = folders.find((f) => f.path === folder);
  const totalPages = list.pagination && list.pagination.totalPages ? list.pagination.totalPages : 1;

  if (loadError && !status) {
    return (
      <div className="mb-root"><div className="page-head"><div><h1>תיבת מייל</h1></div></div>
        <div className="card card-pad"><div className="mb-error">{loadError}</div><button className="btn btn-sm" onClick={loadStatus}>נסה שוב</button></div></div>
    );
  }
  if (!status) return <div className="mb-root"><div className="page-head"><div><h1>תיבת מייל</h1></div></div><div className="card card-pad">טוען...</div></div>;
  if (!status.enabled) {
    return (
      <div className="mb-root"><div className="page-head"><div><h1>תיבת מייל</h1></div></div>
        <div className="card card-pad">תיבת הדואר לא מחוברת באתר הזה. החיבור מוגדר במשתני הסביבה של הפרויקט (HOSTINGER_MAIL_TOKEN ו-HOSTINGER_MAILBOX_ID).</div></div>
    );
  }

  const q2 = status.quota && status.quota.supported ? status.quota : null;

  return (
    <div className="mb-root">
      <div className="page-head">
        <div>
          <h1>תיבת מייל</h1>
          <div className="page-desc">{status.address ? <bdi dir="ltr">{status.address}</bdi> : 'תיבת הדואר של האתר'} · מיילים נכנסים, יוצאים וכתיבה</div>
        </div>
      </div>
      {toast && <div className="card card-pad" role="status">{toast}</div>}

      <div className="mb-shell" data-view={view}>
        <aside className="mb-col mb-side" aria-label="תיקיות">
          <button className="btn btn-primary mb-compose" onClick={() => openCompose('new')}>✉ מייל חדש</button>
          {folders.map((f) => (
            <button key={f.path} className={`mb-folder${f.path === folder ? ' is-active' : ''}`} onClick={() => { setFolder(f.path); setPage(1); setQuery(''); setQ(''); setSel(null); setMsg(null); setView('list'); }}>
              <span>{folderLabel(f)}</span>
              {f.unreadCount > 0 && <span className="mb-count">{f.unreadCount}</span>}
            </button>
          ))}
          {q2 && q2.totalLimit > 0 && (
            <div className="mb-quota">
              נפח: {fmtBytes(q2.totalUsage)} מתוך {fmtBytes(q2.totalLimit)}
              <div className="mb-quota-bar"><i style={{ width: `${Math.min(100, q2.totalPercentage || 0)}%` }} /></div>
            </div>
          )}
        </aside>

        <section className="mb-col mb-list-col" aria-label="הודעות">
          <form className="mb-listhead" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
            <button type="button" className="btn btn-sm mb-back" onClick={() => setView('folders')}>תיקיות</button>
            <input className="input" {...nf('search')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בנושא, שולח או תוכן" aria-label="חיפוש" />
            <button className="btn btn-sm" type="submit">חפש</button>
            <button className="btn btn-sm" type="button" onClick={() => { loadList(false); loadStatus(); }} title="רענון" aria-label="רענון">↻</button>
          </form>
          <div className="mb-list">
            {listError && <div className="mb-empty mb-error">{listError}</div>}
            {!listError && listLoading && !list.data.length && <div className="mb-empty">טוען...</div>}
            {!listError && !listLoading && !list.data.length && <div className="mb-empty">{query ? 'לא נמצאו הודעות' : 'התיקייה ריקה'}</div>}
            {list.data.map((m) => {
              const outgoing = curFolderObj && (curFolderObj.specialUse === '\\Sent' || curFolderObj.specialUse === '\\Drafts');
              const who = outgoing ? (m.to || []).map(addrShort).join(', ') : addrShort(m.from);
              return (
                <button key={m.uid} className={`mb-row${m.unseen ? ' is-unread' : ''}${sel && sel.uid === m.uid && sel.folder === folder ? ' is-active' : ''}`} onClick={() => openMessage(m)}>
                  <div className="mb-row-top">
                    <span className="mb-from">{(m.flags || []).includes('\\Flagged') && <span className="mb-star">★ </span>}{who || '(ללא)'}</span>
                    <span className="mb-date">{(m.attachments || []).length > 0 && '📎 '}{fmtDate(m.date)}</span>
                  </div>
                  <div className="mb-subj">{m.subject || '(ללא נושא)'}</div>
                </button>
              );
            })}
          </div>
          <div className="mb-pager">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>הקודם</button>
            <span>עמוד {page} מתוך {totalPages}{list.pagination && list.pagination.total != null ? ` · ${list.pagination.total} הודעות` : ''}</span>
            <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>הבא</button>
          </div>
        </section>

        <section className="mb-col mb-read" aria-label="קריאת הודעה">
          {!sel && <div className="mb-empty">בחר הודעה לקריאה</div>}
          {sel && msgLoading && <div className="mb-empty">טוען הודעה...</div>}
          {sel && msgError && <div className="mb-empty mb-error">{msgError}</div>}
          {sel && msg && (
            <>
              <div className="mb-read-head">
                <button className="btn btn-sm mb-back" onClick={() => setView('list')}>חזרה</button>
                <h2>{msg.subject || '(ללא נושא)'}</h2>
                <div className="mb-meta">
                  <div>מאת: <Addr a={msg.from} /></div>
                  <div>אל: <AddrList list={msg.to} /></div>
                  {(msg.cc || []).length > 0 && <div>עותק: <AddrList list={msg.cc} /></div>}
                  <div>{fmtDate(msg.date, true)}</div>
                </div>
                <div className="mb-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => openCompose('reply')}>↩ השב</button>
                  <button className="btn btn-sm" onClick={() => openCompose('replyAll')}>השב לכולם</button>
                  <button className="btn btn-sm" onClick={() => openCompose('forward')}>העבר</button>
                  <button className="btn btn-sm" onClick={() => toggleFlag('\\Flagged', !(msg.flags || []).includes('\\Flagged'))}>{(msg.flags || []).includes('\\Flagged') ? '★ הסר כוכב' : '☆ כוכב'}</button>
                  <button className="btn btn-sm" onClick={() => toggleFlag('\\Seen', false)}>סמן כלא נקרא</button>
                  <button className="btn btn-sm" onClick={removeMsg}>מחק</button>
                </div>
              </div>
              {(msg.attachments || []).filter((a) => !a.inline || a.filename).length > 0 && (
                <div className="mb-atts">
                  {msg.attachments.filter((a) => !a.inline || a.filename).map((a) => (
                    <a key={a.id} className="mb-att" href={`${API}?action=attachment&folder=${encodeURIComponent(sel.folder)}&uid=${sel.uid}&id=${encodeURIComponent(a.id)}&name=${encodeURIComponent(a.filename || 'attachment')}`}>
                      📎 <bdi>{a.filename || 'קובץ'}</bdi> <small>({fmtBytes(a.sizeBytes || 0)})</small>
                    </a>
                  ))}
                </div>
              )}
              <div className="mb-body">
                {msg.body && msg.body.html ? (
                  <>
                    {!showImages && /<img[^>]+src=["']?https?:/i.test(msg.body.html) && (
                      <div className="mb-imgbar">תמונות מרוחקות נחסמו. <button className="btn btn-sm" onClick={() => setShowImages(true)}>הצג תמונות</button></div>
                    )}
                    <iframe title="תוכן ההודעה" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={frameDoc(msg.body.html, showImages)} />
                  </>
                ) : (
                  <pre className="mb-plain">{(msg.body && msg.body.text) || '(ההודעה ריקה)'}</pre>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {compose && <ComposeModal state={compose} nf={nf} onClose={() => setCompose(null)} onSent={() => { setCompose(null); flash('המייל נשלח'); loadList(true); loadStatus(); }} />}
    </div>
  );
}

function ComposeModal({ state, nf, onClose, onSent }) {
  const [f, setF] = useState(state);
  const [showBcc, setShowBcc] = useState(!!state.bcc);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [picker, setPicker] = useState(false);
  const total = useMemo(() => f.files.reduce((s, x) => s + x.size, 0), [f.files]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const title = { new: 'מייל חדש', reply: 'תשובה', replyAll: 'תשובה לכולם', forward: 'העברה' }[f.kind];

  function addFiles(list) {
    const files = Array.from(list || []);
    setErr('');
    Promise.all(files.map((file) => new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, content: String(r.result).split(',')[1] || '' });
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    }))).then((read) => {
      setF((s) => {
        const next = [...s.files, ...read.filter(Boolean)];
        if (next.reduce((n, x) => n + x.size, 0) > MAX_ATT_BYTES) { setErr(`הקבצים גדולים מדי (מקסימום ${fmtBytes(MAX_ATT_BYTES)} ביחד)`); return s; }
        return { ...s, files: next };
      });
    });
  }

  // הוספת כתובות (מהבוחר) לשדה אל / עותק / עותק מוסתר, בלי כפילויות
  function addRecipient(field, email) {
    setF((s) => {
      const cur = String(s[field] || '').split(/[,;\s]+/).filter(Boolean);
      if (cur.some((x) => x.toLowerCase() === email.toLowerCase())) return s;
      return { ...s, [field]: [...cur, email].join(', ') };
    });
    if (field === 'bcc') setShowBcc(true);
  }

  async function send() {
    setBusy(true); setErr('');
    try {
      await post({
        action: 'send', to: f.to, cc: f.cc, bcc: f.bcc, subject: f.subject, text: f.text,
        attachments: f.files.map(({ filename, contentType, content }) => ({ filename, contentType, content })),
        ...(f.replyTo ? { replyTo: f.replyTo } : {}), ...(f.forwardOf ? { forwardOf: f.forwardOf } : {}),
      });
      onSent();
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="mb-modal-bg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mb-modal">
        <h3>{title}</h3>
        <div><button type="button" className="btn btn-sm" onClick={() => setPicker((v) => !v)} aria-expanded={picker}>👥 בחר מרשימת הלקוחות</button></div>
        {picker && <CustomerPicker nf={nf} fields={f} onAdd={addRecipient} />}
        <div className="mb-fieldrow"><label htmlFor="mb-to">אל</label><input id="mb-to" className="input" dir="ltr" {...nf('email')} value={f.to} onChange={set('to')} placeholder="name@example.com, ..." /></div>
        <div className="mb-fieldrow"><label htmlFor="mb-cc">עותק</label><input id="mb-cc" className="input" dir="ltr" {...nf('email')} value={f.cc} onChange={set('cc')} /></div>
        {showBcc
          ? <div className="mb-fieldrow"><label htmlFor="mb-bcc">עותק מוסתר</label><input id="mb-bcc" className="input" dir="ltr" {...nf('email')} value={f.bcc} onChange={set('bcc')} /></div>
          : <div><button type="button" className="btn btn-sm" onClick={() => setShowBcc(true)}>הוסף עותק מוסתר</button></div>}
        <div className="mb-fieldrow"><label htmlFor="mb-subj">נושא</label><input id="mb-subj" className="input" {...nf('subject')} value={f.subject} onChange={set('subject')} /></div>
        <textarea className="input" dir="auto" value={f.text} onChange={set('text')} aria-label="תוכן המייל" autoFocus />
        {f.files.length > 0 && (
          <div className="mb-atts" style={{ padding: 0, border: 0 }}>
            {f.files.map((x, i) => (
              <span key={i} className="mb-att">📎 <bdi>{x.filename}</bdi> <small>({fmtBytes(x.size)})</small>
                <button type="button" className="btn btn-sm" aria-label={`הסר ${x.filename}`} onClick={() => setF((s) => ({ ...s, files: s.files.filter((_, j) => j !== i) }))}>✕</button></span>
            ))}
          </div>
        )}
        {err && <div className="mb-error" role="alert">{err}</div>}
        <div className="mb-modal-foot">
          <button className="btn btn-primary" disabled={busy || !f.to.trim()} onClick={send}>{busy ? 'שולח...' : 'שלח'}</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            📎 צרף קובץ
            <input type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <small>{total > 0 ? `${fmtBytes(total)} מתוך ${fmtBytes(MAX_ATT_BYTES)}` : `עד ${fmtBytes(MAX_ATT_BYTES)} לקבצים`}</small>
          <button className="btn" style={{ marginInlineStart: 'auto' }} disabled={busy} onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

const FIELD_LABEL = { to: 'אל', cc: 'עותק', bcc: 'עותק מוסתר' };

// בוחר לקוחות לנמענים: חיפוש לפי שם / טלפון / מייל (/api/admin/mailbox?action=customers), לחיצה מוסיפה את הכתובת לשדה שנבחר.
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
        const data = await api(`${API}?action=customers&q=${encodeURIComponent(term)}`);
        if (my === seq.current) { setRows(data.customers || []); setState('done'); setError(''); }
      } catch (e) { if (my === seq.current) { setError(e.message); setState('error'); } }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const has = (email) => String(fields[target] || '').split(/[,;\s]+/).some((x) => x.toLowerCase() === email.toLowerCase());

  return (
    <div className="mb-picker">
      <div className="mb-picker-head">
        <input className="input" {...nf('search')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="שם, טלפון או מייל של לקוח" aria-label="חיפוש לקוח" autoFocus />
        <select className="input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="להוסיף לשדה">
          {Object.entries(FIELD_LABEL).map(([k, v]) => <option key={k} value={k}>להוסיף ל{v}</option>)}
        </select>
      </div>
      <div className="mb-picker-list">
        {state === 'idle' && <div className="mb-empty">הקלד לפחות 2 תווים</div>}
        {state === 'loading' && !rows.length && <div className="mb-empty">מחפש...</div>}
        {state === 'error' && <div className="mb-empty mb-error">{error}</div>}
        {state === 'done' && !rows.length && <div className="mb-empty">לא נמצאו לקוחות עם מייל</div>}
        {rows.map((c) => {
          const added = has(c.email);
          return (
            <button type="button" key={c.id} className={`mb-pick-row${added ? ' is-added' : ''}`} onClick={() => onAdd(target, c.email)} disabled={added}>
              <span><strong>{c.name}</strong>{(c.phone || c.city) && <small> · {[c.phone, c.city].filter(Boolean).join(' · ')}</small>}</span>
              <bdi dir="ltr" className="mb-pick-mail">{added ? '✓ ' : '+ '}{c.email}</bdi>
            </button>
          );
        })}
      </div>
    </div>
  );
}
