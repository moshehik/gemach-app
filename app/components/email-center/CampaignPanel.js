'use client';

// טאב "דיוורים" (הבסיס - הבעלים ירחיב בהמשך): בחירת נמענים (רק מאשרי דיוור), נושא ותוכן בצורת "דברי דואר", תמונה בגוף המייל,
// צרופות, תצוגה מקדימה, מייל בדיקה לעצמי, ושליחה מיידית או מתוזמנת (תאריך בלוח העברי + שעה).
// הדפדפן מחזיק מזהי לקוחות בלבד (כתובות מייל מסוכות); הרשימה הסופית והסכמת הדיוור נבדקות שוב בשרת בכל שליחה.

import { useCallback, useEffect, useRef, useState } from 'react';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import HebrewDateRangePicker from '@/components/HebrewDateRangePicker';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { Ic, ConfirmDialog } from '../settings-sim/SettingsDialogs';
import MergeEditor, { VarPalette } from './MergeEditor';
import { api, sleep } from './emailCenterApi';

const MODES = [
  { id: 'all', label: 'כל מאשרי הדיוור' },
  { id: 'city', label: 'לפי עיר' },
  { id: 'event', label: 'לפי תאריך אירוע' },
  { id: 'manual', label: 'בחירה ידנית' },
];
const STATUS_LABEL = { draft: 'טיוטה', scheduled: 'מתוזמן', sending: 'בשליחה', done: 'הסתיים', cancelled: 'בוטל' };
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hebrewOf = (iso) => { try { return iso ? getHebrewDateString(new Date(`${iso}T12:00:00`)) : ''; } catch { return ''; } };
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export default function CampaignPanel({ campaignVars, dryRun, cronNote, schedulerConfigured, root, toast, setError }) {
  // --- תוכן ---
  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [image, setImage] = useState(null); // { url, attachmentId, fileName, size }
  const [imageAlt, setImageAlt] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [files, setFiles] = useState([]); // [{ attachmentId, fileName, size }]
  const [uploading, setUploading] = useState(false);
  // --- נמענים ---
  const [meta, setMeta] = useState(null);
  const [mode, setMode] = useState('all');
  const [cities, setCities] = useState([]);
  const [eventFrom, setEventFrom] = useState('');
  const [eventTo, setEventTo] = useState('');
  const [chosen, setChosen] = useState({}); // id -> recipient
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [rcpt, setRcpt] = useState({ recipients: [], total: 0, truncated: false, loading: false, error: '' });
  // --- תצוגה / שליחה ---
  const [prev, setPrev] = useState({ html: '', subject: '', error: '' });
  const [sendMode, setSendMode] = useState('now');
  const [schedDate, setSchedDate] = useState(todayIso());
  const [schedHour, setSchedHour] = useState('10');
  const [schedMin, setSchedMin] = useState('00');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { id, total, sent, failed, skipped }
  const [history, setHistory] = useState({ campaigns: [], quota: null });
  const bodyHandle = useRef(null);
  const activeHandle = useRef(null);
  const subjectRef = useRef(null);
  const headingRef = useRef(null);
  const reqPrev = useRef(0);
  const reqRcpt = useRef(0);
  const imgInput = useRef(null);
  const fileInput = useRef(null);

  const input = {
    subject, heading, bodyText, imageUrl: image ? image.url : '', imageAlt, buttonLabel, buttonUrl,
    attachments: files.map((f) => ({ attachmentId: f.attachmentId, fileName: f.fileName, size: f.size })),
  };

  const loadHistory = useCallback(async () => {
    const r = await api('/api/admin/email-center/campaign');
    if (r.ok) setHistory({ campaigns: r.data.campaigns || [], quota: r.data.quota ? r.data.quota.remaining : null });
  }, []);

  useEffect(() => {
    (async () => {
      const [m] = await Promise.all([api('/api/admin/email-center/campaign/recipients?meta=1'), loadHistory()]);
      if (m.ok) setMeta(m.data); else setError({ title: 'טעינת נתוני הנמענים נכשלה', text: m.error });
    })();
  }, [loadHistory, setError]);

  // --- רשימת נמענים (debounce) ---
  const filters = mode === 'city' ? { mode, cities } : mode === 'event' ? { mode, eventFrom, eventTo: eventTo || eventFrom } : mode === 'manual' ? { mode, customerIds: Object.keys(chosen) } : { mode };
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    const id = ++reqRcpt.current;
    setRcpt((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      const ready = mode === 'all' || (mode === 'city' && cities.length) || (mode === 'event' && eventFrom) || (mode === 'manual' && Object.keys(chosen).length);
      if (!ready) { if (id === reqRcpt.current) setRcpt({ recipients: [], total: 0, truncated: false, loading: false, error: '' }); return; }
      const r = await api('/api/admin/email-center/campaign/recipients', { method: 'POST', body: { filters: JSON.parse(filtersKey) } });
      if (id !== reqRcpt.current) return;
      setRcpt(r.ok ? { recipients: r.data.recipients, total: r.data.total, truncated: r.data.truncated, loading: false, error: '' } : { recipients: [], total: 0, truncated: false, loading: false, error: r.error });
    }, 300);
    return () => clearTimeout(t);
  }, [filtersKey]);

  // --- חיפוש ידני ---
  useEffect(() => {
    if (mode !== 'manual' || q.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(async () => {
      const r = await api(`/api/admin/email-center/campaign/recipients?q=${encodeURIComponent(q.trim())}`);
      setFound(r.ok ? r.data.results || [] : []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  // --- תצוגה מקדימה (debounce) ---
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    const id = ++reqPrev.current;
    const t = setTimeout(async () => {
      const r = await api('/api/admin/email-center/campaign/preview', { method: 'POST', body: { input: JSON.parse(inputKey) } });
      if (id !== reqPrev.current) return;
      setPrev(r.ok ? { html: r.data.html, subject: r.data.subject, error: '' } : { html: '', subject: '', error: r.error });
    }, 400);
    return () => clearTimeout(t);
  }, [inputKey]);

  const contentReady = subject.trim() && bodyText.trim();
  const dirty = !!(subject || bodyText || image || files.length);
  useEffect(() => {
    try { window.__gmDirty = dirty && !progress; } catch { /* */ }
    return () => { try { window.__gmDirty = false; } catch { /* */ } };
  }, [dirty, progress]);

  const insertVar = (key) => { const h = activeHandle.current || bodyHandle.current; if (h) h.insertVar(key); };

  // --- העלאות ---
  const upload = async (file, kind) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const r = await api('/api/admin/email-center/campaign/upload', { method: 'POST', form });
    setUploading(false);
    if (!r.ok) { setError({ title: 'ההעלאה נכשלה', text: r.error }); return; }
    if (kind === 'image') setImage({ url: r.data.url, attachmentId: r.data.attachmentId, fileName: r.data.fileName, size: r.data.size });
    else setFiles((f) => [...f, { attachmentId: r.data.attachmentId, fileName: r.data.fileName, size: r.data.size }].slice(0, 5));
  };

  const sendTest = async () => {
    setBusy(true);
    setError(null);
    const r = await api('/api/admin/email-center/campaign/test', { method: 'POST', body: { input } });
    setBusy(false);
    if (!r.ok) { setError({ title: 'מייל הבדיקה נכשל', text: r.error }); return; }
    toast('מייל בדיקה נשלח', dryRun ? 'מצב בדיקה: לא יצא בפועל' : `אל ${r.data.maskedTo} (הכתובת בכרטיס העובד שלך)`);
  };

  const scheduleInfo = () => {
    if (sendMode !== 'schedule') return null;
    return `${hebrewOf(schedDate)} בשעה ${schedHour}:${schedMin}`;
  };

  const startSend = async () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    const body = { input, filters, mode: sendMode, ...(sendMode === 'schedule' ? { scheduleDate: schedDate, scheduleTime: `${schedHour}:${schedMin}` } : {}) };
    const created = await api('/api/admin/email-center/campaign', { method: 'POST', body });
    if (!created.ok) { setBusy(false); setError({ title: 'יצירת הדיוור נכשלה', text: created.error }); return; }
    const { id, total, status } = created.data;
    if (status === 'scheduled') {
      setBusy(false);
      const exact = created.data.scheduler && created.data.scheduler.exact;
      toast('הדיוור תוזמן', `${total} נמענים · ${scheduleInfo()}${exact ? ' · שליחה מדויקת' : ' · יישלח בהרצה הקרובה אחרי המועד'}`);
      if (created.data.scheduler && created.data.scheduler.error) setError({ title: 'הרישום במתזמן המדויק נכשל', text: `${created.data.scheduler.error}. הדיוור נשמר ויישלח בהרצה הקרובה אחרי המועד (cron).` });
      loadHistory();
      return;
    }
    // שליחה מיידית בחתיכות קטנות (מגבלת זמן של פונקציה בשרת)
    setProgress({ id, total, sent: 0, failed: 0, skipped: 0 });
    let sent = 0; let failed = 0; let skipped = 0;
    for (let guard = 0; guard < 400; guard++) {
      const r = await api(`/api/admin/email-center/campaign/${id}`, { method: 'POST', body: { action: 'send' } });
      if (!r.ok && !r.data.sent) { setError({ title: 'השליחה נעצרה', text: r.error || r.data.error }); break; }
      sent += r.data.sent || 0; failed += r.data.failed || 0; skipped += r.data.skipped || 0;
      setProgress({ id, total, sent, failed, skipped });
      if (r.data.error && r.data.quotaExhausted) { setError({ title: 'מכסת השליחה היומית נגמרה', text: `${r.data.error}. נשלחו ${sent} מתוך ${total}.` }); break; }
      if (r.data.done) break;
      if (r.data.busy) await sleep(2500);
    }
    setBusy(false);
    toast('השליחה הסתיימה', `נשלחו ${sent}${failed ? ` · נכשלו ${failed}` : ''}${skipped ? ` · דולגו ${skipped} (ללא הסכמה)` : ''}`);
    loadHistory();
  };

  const cancel = async (id) => {
    const r = await api(`/api/admin/email-center/campaign/${id}`, { method: 'POST', body: { action: 'cancel' } });
    if (!r.ok) { setError({ title: 'הביטול נכשל', text: r.error }); return; }
    toast('הדיוור בוטל', 'מה שטרם נשלח לא יישלח');
    loadHistory();
  };

  const count = rcpt.total;
  const overQuota = history.quota !== null && history.quota !== undefined && count > history.quota;
  const canSend = contentReady && count > 0 && !rcpt.truncated && !rcpt.loading && !busy && !uploading;
  const toggleCity = (c) => setCities((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <>
      {dryRun ? <div className="ec-dry" role="status">מצב בדיקה (EMAIL_DRY_RUN): אף מייל לא יוצא בפועל - הכול נרשם בזיכרון השרת בלבד.</div> : null}
      <p className="ec-note" style={{ marginTop: 0 }}>
        הדיוור נשלח רק ללקוחות שאישרו קבלת דיוורים, וכל מייל כולל קישור אישי להסרה מהרשימה ופרטי השולח (סעיף 30א לחוק התקשורת). הכתובות אינן מוצגות כאן במלואן.
      </p>

      <div className="ec-grid">
        <div>
          {/* ---------------- נמענים ---------------- */}
          <section className="st-sec st-card" data-guide-id="emc.camp-who">
            <h2 className="adm-h"><span className="adm-hi"><Ic id="users" /></span>למי לשלוח</h2>
            <div className="card adm-rows"><div className="list" style={{ padding: 12 }}>
              <div className="sizes st-wide-btn" role="group" aria-label="סוג הבחירה">
                {MODES.map((m) => (
                  <button key={m.id} type="button" className={mode === m.id ? 'on' : ''} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                    <span className="ck" aria-hidden="true"><Ic id="check" plain /></span>{m.label}
                  </button>
                ))}
              </div>
              {meta ? <small className="ec-hint">{meta.consentTotal} לקוחות אישרו קבלת דיוורים (עם כתובת מייל תקינה).</small> : null}

              {mode === 'city' ? (
                <div className="sizes st-wide-btn" role="group" aria-label="ערים" style={{ marginTop: 10 }}>
                  {(meta ? meta.cities : []).map((c) => (
                    <button key={c.city} type="button" className={cities.includes(c.city) ? 'on' : ''} aria-pressed={cities.includes(c.city)} onClick={() => toggleCity(c.city)}>
                      <span className="ck" aria-hidden="true"><Ic id="check" plain /></span>{c.city} ({c.count})
                    </button>
                  ))}
                  {meta && !meta.cities.length ? <small className="ec-hint">אין ערים במאגר מאשרי הדיוור.</small> : null}
                </div>
              ) : null}

              {mode === 'event' ? (
                <div className="ec-field" style={{ marginTop: 10 }}>
                  <label>לקוחות שיש להם אירוע בטווח התאריכים (לוח עברי)</label>
                  <HebrewDateRangePicker startDate={eventFrom} endDate={eventTo} onChange={(s, e) => { setEventFrom(s || ''); setEventTo(e || ''); }} />
                  {eventFrom ? <small className="ec-hint">{hebrewOf(eventFrom)}{eventTo && eventTo !== eventFrom ? ` עד ${hebrewOf(eventTo)}` : ''}</small> : null}
                </div>
              ) : null}

              {mode === 'manual' ? (
                <div className="ec-field" style={{ marginTop: 10 }}>
                  <label htmlFor="ec-q">חיפוש לקוחה (שם או טלפון) - מוצגות רק מאשרות דיוור</label>
                  <input id="ec-q" className="inp" type="search" value={q} autoComplete="off" placeholder="לפחות 2 תווים" onChange={(e) => setQ(e.target.value)} />
                  <div className="ec-recip-list">
                    {found.filter((f) => !chosen[f.id]).map((f) => (
                      <button type="button" className="ec-pill" key={f.id} onClick={() => setChosen((c) => ({ ...c, [f.id]: f }))}><Ic id="plus" plain />{f.name}{f.city ? ` · ${f.city}` : ''}</button>
                    ))}
                    {q.trim().length >= 2 && !found.length ? <small className="ec-hint">לא נמצאו מאשרות דיוור מתאימות.</small> : null}
                  </div>
                  {Object.keys(chosen).length ? (
                    <div className="ec-recip-list" aria-label="נבחרו">
                      {Object.values(chosen).map((c) => (
                        <span className="ec-pill" key={c.id}>{c.name}<button type="button" className="ibtn" aria-label={`הסרת ${c.name}`} onClick={() => setChosen((cur) => { const n = { ...cur }; delete n[c.id]; return n; })}><Ic id="x" plain /></button></span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="ec-recips">
                {rcpt.error ? <div className="ec-bad" role="alert">{rcpt.error}</div> : null}
                <div><b>{rcpt.loading ? 'מחשב…' : `${count} נמענים`}</b>{meta ? <small className="faint"> (עד {meta.max} לדיוור)</small> : null}</div>
                {rcpt.truncated ? <div className="ec-bad">נבחרו יותר מדי נמענים - צמצמו את הבחירה (עד {meta ? meta.max : 500}).</div> : null}
                {overQuota ? <div className="ec-warn">מכסת המיילים היומית שנותרה בחשבון השליחה: {history.quota}. הנמענים העודפים יישלחו בהרצה הבאה (למחרת).</div> : null}
                {history.quota === null && !dryRun ? <small className="ec-hint">מכסת המיילים היומית של חשבון השליחה (Gmail: 100 ליום, משותפת לכל המערכת) לא ידועה כרגע.</small> : null}
                {rcpt.recipients.length ? (
                  <div className="ec-recip-list" aria-label="דוגמה לנמענים">
                    {rcpt.recipients.slice(0, 12).map((r) => <span className="ec-pill" key={r.id}>{r.name} <small className="faint" dir="ltr">{r.maskedEmail}</small></span>)}
                    {rcpt.recipients.length > 12 ? <small className="faint">ועוד {rcpt.recipients.length - 12}…</small> : null}
                  </div>
                ) : null}
              </div>
            </div></div>
          </section>

          {/* ---------------- תוכן ---------------- */}
          <section className="st-sec st-card" data-guide-id="emc.camp-content">
            <h2 className="adm-h"><span className="adm-hi"><Ic id="pencil" /></span>תוכן הדיוור</h2>
            <div className="card adm-rows"><div className="list" style={{ padding: 12 }}>
              <VarPalette vars={campaignVars} onInsert={insertVar} title="שדות אישיים לכל נמענת" />
              <div className="ec-field">
                <label>נושא</label>
                <MergeEditor ref={subjectRef} value={subject} vars={campaignVars} ariaLabel="נושא הדיוור" placeholder="למשל: מבצע לקראת החגים, {{firstName}}" onChange={setSubject} onFocusEditor={() => { activeHandle.current = subjectRef.current; }} />
              </div>
              <div className="ec-field">
                <label>כותרת בגוף המייל (רשות - ברירת מחדל: הנושא)</label>
                <MergeEditor ref={headingRef} value={heading} vars={campaignVars} ariaLabel="כותרת בגוף המייל" onChange={setHeading} onFocusEditor={() => { activeHandle.current = headingRef.current; }} />
              </div>
              <div className="ec-field">
                <label>תוכן</label>
                <MergeEditor ref={bodyHandle} value={bodyText} vars={campaignVars} multiline ariaLabel="תוכן הדיוור" placeholder="כתבו כאן את ההודעה…" onChange={setBodyText} onFocusEditor={() => { activeHandle.current = bodyHandle.current; }} />
                <small className="ec-hint">הדגשה: **טקסט**. קישור: [טקסט הקישור](https://…). שורה ריקה = רווח. אין HTML - כל תו מוצג כטקסט.</small>
              </div>

              <div className="ec-field">
                <label>תמונה בגוף המייל (רשות)</label>
                {image ? (
                  <div className="ec-files">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="ec-thumb" src={image.url} alt="התמונה שנבחרה" />
                    <div className="ec-file"><Ic id="file" plain />{image.fileName} · {kb(image.size)}<button type="button" className="ibtn" aria-label="הסרת התמונה" onClick={() => setImage(null)}><Ic id="trash" plain /></button></div>
                    <input className="inp" type="text" value={imageAlt} maxLength={120} placeholder="תיאור התמונה (למי שהתמונה לא נטענת אצלה)" aria-label="תיאור התמונה" onChange={(e) => setImageAlt(e.target.value)} />
                  </div>
                ) : (
                  <div className="ec-actions" style={{ margin: 0 }}>
                    <button type="button" className="btn ghost sm" disabled={uploading} onClick={() => imgInput.current && imgInput.current.click()}><Ic id="plus" />בחירת תמונה</button>
                    <small className="ec-hint">png / jpg / gif / webp, עד 4MB. התמונה מוקטנת ונשמרת בשרת האתר.</small>
                  </div>
                )}
                <input ref={imgInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; upload(f, 'image'); }} />
              </div>

              <div className="ec-row2">
                <div className="ec-field">
                  <label>כפתור (רשות) - כיתוב</label>
                  <input className="inp" type="text" value={buttonLabel} maxLength={40} aria-label="כיתוב הכפתור" onChange={(e) => setButtonLabel(e.target.value)} />
                </div>
                <div className="ec-field">
                  <label>קישור הכפתור</label>
                  <input className="inp" type="url" dir="ltr" value={buttonUrl} placeholder="https://…" aria-label="קישור הכפתור" onChange={(e) => setButtonUrl(e.target.value)} />
                </div>
              </div>

              <div className="ec-field">
                <label>קבצים מצורפים (רשות, עד 5)</label>
                <div className="ec-files">
                  {files.map((f) => (
                    <div className="ec-file" key={f.attachmentId}><Ic id="clip" plain />{f.fileName} · {kb(f.size)}<button type="button" className="ibtn" aria-label={`הסרת ${f.fileName}`} onClick={() => setFiles((cur) => cur.filter((x) => x.attachmentId !== f.attachmentId))}><Ic id="trash" plain /></button></div>
                  ))}
                </div>
                {files.length < 5 ? (
                  <div className="ec-actions" style={{ margin: 0 }}>
                    <button type="button" className="btn ghost sm" disabled={uploading} onClick={() => fileInput.current && fileInput.current.click()}><Ic id="plus" />צירוף קובץ</button>
                    <small className="ec-hint">pdf / word / excel / תמונה / טקסט, עד 3MB לקובץ.</small>
                  </div>
                ) : null}
                <input ref={fileInput} type="file" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; upload(f, 'file'); }} />
              </div>
            </div></div>
          </section>

          {/* ---------------- שליחה ---------------- */}
          <section className="st-sec st-card" data-guide-id="emc.camp-send">
            <h2 className="adm-h"><span className="adm-hi"><Ic id="send" /></span>שליחה</h2>
            <div className="card adm-rows"><div className="list" style={{ padding: 12 }}>
              <div className="seg pill" role="radiogroup" aria-label="מתי לשלוח" style={{ '--n': 2, '--i': sendMode === 'now' ? 0 : 1, maxWidth: 360 }}>
                <span className="pth" aria-hidden="true" />
                <button type="button" role="radio" aria-checked={sendMode === 'now'} className={sendMode === 'now' ? 'on' : undefined} onClick={() => setSendMode('now')}>שליחה מיידית</button>
                <button type="button" role="radio" aria-checked={sendMode === 'schedule'} className={sendMode === 'schedule' ? 'on' : undefined} onClick={() => setSendMode('schedule')}>שליחה מתוזמנת</button>
              </div>
              {sendMode === 'schedule' ? (
                <div className="ec-field" style={{ marginTop: 12 }}>
                  <label>תאריך (לוח עברי) ושעה</label>
                  <div className="ec-days" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <HebrewDatePicker value={schedDate} onChange={setSchedDate} />
                    <select className="inp" style={{ width: 90 }} value={schedHour} aria-label="שעה" onChange={(e) => setSchedHour(e.target.value)}>{HOURS.map((h) => <option key={h} value={h}>{h}</option>)}</select>
                    <span>:</span>
                    <select className="inp" style={{ width: 90 }} value={schedMin} aria-label="דקות" onChange={(e) => setSchedMin(e.target.value)}>{MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                  </div>
                  <small className="ec-hint">
                    מועד השליחה: {scheduleInfo()} (שעון ישראל).{' '}
                    {schedulerConfigured
                      ? 'הדיוור יישלח בדקה שנבחרה (מתזמן Apps Script, טריגר חד-פעמי לכל דיוור).'
                      : `המתזמן המדויק עדיין לא הופעל באתר הזה, ולכן הדיוור יישלח בהרצה הקרובה אחרי המועד. ${cronNote}`}
                  </small>
                </div>
              ) : null}
              <div className="ec-actions">
                <button type="button" className="btn ghost" data-guide-id="emc.camp-test" disabled={!contentReady || busy || uploading} onClick={sendTest}><Ic id="mail" />שליחת בדיקה לעצמי</button>
                <button type="button" className="btn primary lg" data-guide-id="emc.camp-go" disabled={!canSend} onClick={() => setConfirm(true)} data-element-name="כפתור_email_campaign_send"><Ic id="send" />{sendMode === 'schedule' ? 'תזמון הדיוור' : 'שליחת הדיוור'}</button>
              </div>
              {progress ? (
                <div role="status" aria-live="polite">
                  <div className="ec-progress"><i style={{ width: `${Math.min(100, Math.round(((progress.sent + progress.failed + progress.skipped) / Math.max(1, progress.total)) * 100))}%` }} /></div>
                  <small className="ec-hint">נשלחו {progress.sent} מתוך {progress.total}{progress.failed ? ` · נכשלו ${progress.failed}` : ''}{progress.skipped ? ` · דולגו ${progress.skipped} (הסכמה בוטלה)` : ''}{busy ? ' - נא לא לסגור את הדף' : ''}</small>
                </div>
              ) : null}
            </div></div>
          </section>

          {/* ---------------- היסטוריה ---------------- */}
          <section className="st-sec st-card" data-guide-id="emc.camp-history">
            <h2 className="adm-h"><span className="adm-hi"><Ic id="list" /></span>דיוורים אחרונים</h2>
            <div className="card adm-rows"><div className="list" style={{ padding: 12, overflowX: 'auto' }}>
              {history.campaigns.length ? (
                <table className="ec-hist">
                  <thead><tr><th>נושא</th><th>מצב</th><th>נמענים</th><th>נשלחו</th><th>מועד</th><th /></tr></thead>
                  <tbody>
                    {history.campaigns.map((c) => (
                      <tr key={c.id}>
                        <td>{c.subject}</td>
                        <td><span className="chip">{STATUS_LABEL[c.status] || c.status}</span>{c.status === 'scheduled' ? <small className="faint"> {c.exact ? 'שעה מדויקת' : 'בהרצת cron'}</small> : null}</td>
                        <td>{c.total}</td>
                        <td>{c.sent}{c.failed ? ` (נכשלו ${c.failed})` : ''}{c.skipped ? ` (דולגו ${c.skipped})` : ''}</td>
                        <td>{c.scheduledAt ? `${hebrewOf(c.scheduledAt.slice(0, 10))} ${new Date(c.scheduledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}` : hebrewOf(String(c.createdAt).slice(0, 10))}</td>
                        <td>{c.status === 'scheduled' || c.status === 'sending' ? <button type="button" className="btn ghost sm" onClick={() => cancel(c.id)}><Ic id="x" />ביטול</button> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <small className="ec-hint">עוד לא נשלחו דיוורים.</small>}
            </div></div>
          </section>
        </div>

        <aside className="ec-prev" aria-label="תצוגה מקדימה">
          <div className="ec-prev-subj"><b>נושא:</b>{prev.subject || '…'}</div>
          {prev.error && contentReady ? <div className="ec-prev-err" role="alert">{prev.error}</div> : null}
          <iframe className="ec-frame" title="תצוגה מקדימה של הדיוור" sandbox="" srcDoc={prev.html || '<p style="font-family:sans-serif;padding:16px">התצוגה תופיע אחרי מילוי נושא ותוכן</p>'} />
          <small className="ec-hint">התצוגה עם לקוחה לדוגמה (&quot;רחל כהן&quot;). קישור ההסרה בדוגמה אינו פעיל.</small>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        root={root}
        heading={sendMode === 'schedule' ? `לתזמן דיוור ל-${count} נמענים?` : `לשלוח דיוור ל-${count} נמענים?`}
        sub={sendMode === 'schedule' ? `הדיוור יישלח ${scheduleInfo()} (בהרצה הקרובה אחרי המועד). אפשר לבטל עד אז.` : 'השליחה מיידית ולא ניתן לבטל מה שכבר נשלח.'}
        okLabel={sendMode === 'schedule' ? 'תזמון' : 'שליחה'}
        okIcon="send"
        icon="send"
        destructive
        onYes={startSend}
        onNo={() => setConfirm(false)}
      />
    </>
  );
}
