'use client';
// app/v3/pilot/customer/dialogs.js — גופי השכבות של כרטיס הלקוח (נפתחים רק דרך useLayers().open, §ד.1).
//
// ApproveBody  = אישור מנהל. **אותו חוזה בדיוק** כמו verifyPin (components/orders/modern/mocAuth.js) +
//   customAuthPrompt (app/components/PopupProvider.js): רשימת מאשרים = GET /api/employees מסונן לפי
//   employee.approvals[level], ברירת מחדל = העובד המחובר (GET /api/me) אם הוא ברשימה, סיסמה מלאה,
//   POST /api/auth/verify-pin {pin, employeeId, requiredLevel}. מחזיר {employeeId, pin} או null.
//   (REVIEW-1 B-1: לא קוד 4 ספרות.)
// EmailBody = חלון המייל. אותו payload בדיוק כמו ModernSendEmailModal → POST /api/send-email.
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { Btn, IconBtn, Field, Icon, Seg } from '@/app/v3/ui/components';
import { useStrings } from '@/app/v3/strings';

export function ApproveBody({ level, close, setBusy }) {
  const { t } = useStrings();
  const [all, setAll] = useState(null); // null = טוען
  const [me, setMe] = useState(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  const pwRef = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchSharedJson('/api/employees', { ttl: TTL.STATIC }).catch(() => []),
      fetchSharedJson('/api/me', { ttl: TTL.STATIC }).catch(() => null),
    ]).then(([emps, meData]) => {
      if (!alive) return;
      const pool = (Array.isArray(emps) ? emps : []).filter((e) => e.approvals && e.approvals[level]);
      const cur = meData && meData.success ? meData.employee : null;
      setAll(pool);
      setMe(cur);
      if (cur && pool.some((e) => e.id === cur.id)) setSel(String(cur.id));
    });
    return () => { alive = false; };
  }, [level]);

  const shown = useMemo(() => {
    const f = q.trim();
    return (all || []).filter((e) => !f || `${e.firstName} ${e.lastName}`.includes(f));
  }, [all, q]);

  const submit = async () => {
    if (!sel) { setErr(t('approve.pickFirst')); return; }
    if (!pw) { setErr(t('approve.typePassword')); pwRef.current?.focus(); return; }
    setChecking(true); setBusy(true); setErr('');
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pw, employeeId: sel, requiredLevel: level }),
      });
      const data = await res.json();
      if (!data.success) {
        setErr(data.error || t('approve.wrong'));
        setPw(''); pwRef.current?.focus();
        return;
      }
      close({ employeeId: sel, pin: pw });
    } catch {
      setErr(t('approve.network'));
    } finally {
      setChecking(false); setBusy(false);
    }
  };

  const none = all && all.length === 0;
  return (
    <form className="v3p-dlg" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <Field label={t('approve.who')} tip={t('approve.whoTip')} type="search" value={q} placeholder={t('approve.search')}
        autoComplete="off" disabled={none || checking} onChange={(e) => setQ(e.target.value)} />
      <div className="v3p-appr-list" role="listbox" aria-label={t('approve.who')}>
        {all === null && <div className="v3p-appr-note" role="status"><Icon name="loader" loop size="sm" />{t('approve.loading')}</div>}
        {none && <div className="v3p-appr-note"><Icon name="info" size="sm" />{t('approve.none')}</div>}
        {all && !none && !shown.length && <div className="v3p-appr-note"><Icon name="search" size="sm" />{t('approve.notFound')}</div>}
        {shown.map((e) => {
          const on = String(e.id) === sel;
          const name = `${e.firstName} ${e.lastName}`;
          return (
            <button key={e.id} type="button" role="option" aria-selected={on} className="v3p-appr" disabled={checking}
              onClick={() => { setSel(String(e.id)); setErr(''); pwRef.current?.focus(); }}>
              <span className="v3p-appr__av" aria-hidden="true">{(e.firstName || '?')[0]}</span>
              <span>{me && me.id === e.id ? t('approve.me', { name }) : name}{e.department?.name && <small>{e.department.name}</small>}</span>
              {on && <Icon name="check" size="sm" />}
            </button>
          );
        })}
      </div>
      <div className="v3p-pw">
        <Field label={t('approve.password')} type={show ? 'text' : 'password'} dir="ltr" autoComplete="new-password" value={pw}
          disabled={none || checking} ref={pwRef} data-autofocus="" onChange={(e) => { setPw(e.target.value); setErr(''); }} />
        <IconBtn icon="eye" variant="quiet" label={show ? t('approve.hide') : t('approve.show')} aria-pressed={show} onClick={() => setShow((v) => !v)} />
      </div>
      <p className="v3p-err" role="alert">{err}</p>
      <div className="v3p-dlg-actions">
        <Btn type="submit" variant="primary" icon="check" block loading={checking} disabled={none || !sel}>{checking ? t('approve.checking') : t('common.action.confirm')}</Btn>
        <Btn variant="quiet" block disabled={checking} onClick={() => close(null)}>{t('common.action.cancel')}</Btn>
      </div>
    </form>
  );
}

const fileToBase64 = (f) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.readAsDataURL(f);
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = reject;
});

/** draft = אובייקט ref של הכרטיס: הטיוטה נשמרת עד שיוצאים מהכרטיס (כמו היום; REVIEW-1 OQ-4). */
export function EmailBody({ customer, authResult, draft, close, setBusy, onSent, layers }) {
  const { t } = useStrings();
  const [subject, setSubject] = useState(draft.subject || '');
  const [body, setBody] = useState(draft.body || '');
  const [files, setFiles] = useState(draft.files || []);
  const [sendMode, setSendMode] = useState(draft.sendMode || 'email');
  const [driveFolderId, setDriveFolderId] = useState(draft.driveFolderId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // {links}

  useEffect(() => { Object.assign(draft, { subject, body, files, sendMode, driveFolderId }); }, [draft, subject, body, files, sendMode, driveFolderId]);

  const clearDraft = async () => {
    if ((subject || body || files.length) && !(await layers.confirm({ title: t('customer.mail.clearTitle'), sub: t('customer.mail.clearText'), confirmLabel: t('customer.mail.clear'), cancelLabel: t('customer.mail.keep') }))) return;
    setSubject(''); setBody(''); setFiles([]); setSendMode('email'); setDriveFolderId(''); setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) { setError(t('customer.mail.required')); return; }
    setLoading(true); setBusy(true); setError('');
    let ok = false;
    try {
      const attachments = [];
      for (const f of files) {
        attachments.push({ fileName: f.name, fileContent: await fileToBase64(f), mimeType: f.type || 'application/octet-stream', sizeBytes: f.size || null, dest: sendMode });
      }
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.email, subject, emailBody: body,
          username: authResult.employeeId, password: authResult.pin,
          customerId: customer.id,
          fileName: attachments[0]?.fileName || '', fileContent: attachments[0]?.fileContent || '',
          attachments, sendMode, driveFolderId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const links = Array.isArray(data.driveLinks) ? data.driveLinks : [];
        ok = true;
        setSent({ links });
        Object.assign(draft, { subject: '', body: '', files: [], sendMode: 'email', driveFolderId: '' });
        setTimeout(() => { setBusy(false); close('sent'); onSent?.(); }, 2400);
        return;
      }
      setError(data.message || t('customer.mail.failed'));
    } catch {
      setError(t('customer.mail.networkError'));
    } finally {
      setLoading(false);
      if (!ok) setBusy(false); // אחרי הצלחה השכבה נשארת נעולה עד הסגירה האוטומטית
    }
  };

  const pickedText = files.length ? t('customer.mail.pickedFiles', { n: files.length, names: files.map((f) => f.name).join(', ') }) : t('customer.mail.noFiles');
  return (
    <form className="v3p-dlg" onSubmit={handleSubmit} noValidate>
      <p className="v3-hint">{t('customer.mail.to')} <bdi dir="ltr">{customer.email}</bdi></p>
      {error && <div className="v3-banner v3-banner--alert" role="alert"><div className="v3-banner__main"><span className="v3-banner__ic"><Icon name="alert-circle" /></span><div className="v3-banner__msg"><b>{t('customer.mail.failed')}</b><span>{error}</span></div></div></div>}
      {sent && (
        <div className="v3-banner v3-banner--success" role="status"><div className="v3-banner__main"><span className="v3-banner__ic"><Icon name="check-circle" /></span>
          <div className="v3-banner__msg">
            <b>{sent.links.length ? t('customer.mail.sentDrive', { n: sent.links.length }) : t('customer.mail.sent')}</b>
            <span>{t('customer.mail.autoClose')}</span>
            {sent.links.length > 0 && (
              <ul className="v3p-links">
                {sent.links.map((l, i) => <li key={i}>{l.url ? <a href={l.url} target="_blank" rel="noreferrer"><Icon name="folder" size="sm" /><bdi>{l.fileName || l.url}</bdi></a> : <bdi>{l.fileName || ''}</bdi>}</li>)}
              </ul>
            )}
          </div></div></div>
      )}
      <Field label={t('customer.mail.subject')} required value={subject} disabled={loading || !!sent} data-autofocus="" onChange={(e) => setSubject(e.target.value)} />
      <Field as="textarea" label={t('customer.mail.body')} required rows={6} value={body} disabled={loading || !!sent} onChange={(e) => setBody(e.target.value)} />
      <div className="v3-field">
        <span className="v3-label">{t('customer.mail.files')}</span>
        <div className="v3p-files">
          <input id="v3p-mail-files" type="file" multiple disabled={loading || !!sent} onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])} />
          <label htmlFor="v3p-mail-files" className="v3-btn v3-btn--sm v3-btn--quiet"><Icon name="link" size="sm" />{t('customer.mail.pickFiles')}</label>
          <span className="v3-hint">{pickedText}</span>
        </div>
        <span className="v3-hint">{t('customer.mail.filesTip')}</span>
      </div>
      <div className="v3-field">
        <span className="v3-label" id="v3p-mail-dest">{t('customer.mail.dest')}</span>
        <Seg label={t('customer.mail.dest')} value={sendMode} onChange={setSendMode}
          options={[{ value: 'email', label: t('customer.mail.dest.email') }, { value: 'drive', label: t('customer.mail.dest.drive') }, { value: 'both', label: t('customer.mail.dest.both') }]} />
      </div>
      {sendMode !== 'email' && (
        <Field label={t('customer.mail.folder')} dir="ltr" value={driveFolderId} placeholder={t('customer.mail.folderPh')} hint={t('customer.mail.folderHint')}
          disabled={loading || !!sent} onChange={(e) => setDriveFolderId(e.target.value)} />
      )}
      <div className="v3p-dlg-actions v3p-dlg-actions--row">
        <Btn type="submit" variant="primary" icon="send" loading={loading} disabled={!!sent}>{loading ? t('customer.mail.sending') : t('customer.mail.send')}</Btn>
        <Btn variant="quiet" icon="x" disabled={loading || !!sent} onClick={clearDraft}>{t('customer.mail.clear')}</Btn>
        <Btn variant="quiet" disabled={loading || !!sent} onClick={() => close(null)}>{t('customer.mail.close')}</Btn>
      </div>
    </form>
  );
}
