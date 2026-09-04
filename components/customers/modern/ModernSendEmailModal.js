'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function ModernSendEmailModal({ isOpen, onClose, customer, authResult }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [sendMode, setSendMode] = useState('email');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveLinks, setDriveLinks] = useState([]);
  const [sentOk, setSentOk] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || typeof document === 'undefined') return null;

  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.readAsDataURL(f);
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError('חובה למלא נושא ותוכן');
      return;
    }

    setLoading(true);
    setError('');
    setSentOk('');
    setDriveLinks([]);

    try {
      const attachments = [];
      for (const f of files) {
        attachments.push({
          fileName: f.name,
          fileContent: await fileToBase64(f),
          mimeType: f.type || 'application/octet-stream',
          sizeBytes: f.size || null,
          dest: sendMode
        });
      }
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.email,
          subject,
          emailBody: body,
          username: authResult.employeeId,
          password: authResult.pin,
          customerId: customer.id,
          fileName: attachments[0]?.fileName || '',
          fileContent: attachments[0]?.fileContent || '',
          attachments,
          sendMode,
          driveFolderId
        })
      });

      const data = await res.json();
      if (data.success) {
        const links = Array.isArray(data.driveLinks) ? data.driveLinks : [];
        setDriveLinks(links);
        setSentOk(links.length > 0 ? `המייל נשלח! ${links.length} קבצים בדרייב עם הרשאת הורדה מלאה.` : 'המייל נשלח בהצלחה!');
        setTimeout(() => {
          onClose();
          setSubject('');
          setBody('');
          setFiles([]);
          setSendMode('email');
          setDriveFolderId('');
          setSentOk('');
          setDriveLinks([]);
        }, 2400);
      } else {
        setError(data.message || 'שגיאה בשליחת המייל');
      }
    } catch (err) {
      console.error(err);
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: '500px', width: '100%', margin: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-mail" /></svg>
            שליחת מייל - {customer.firstName} {customer.lastName}
          </strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => !loading && onClose()}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div className="callout callout-danger">
                <svg className="icon"><use href="#i-alert-circle" /></svg>
                {error}
              </div>
            )}
            {sentOk && (
              <div className="callout callout-success">
                <svg className="icon"><use href="#i-check-circle" /></svg>
                {sentOk}
                {driveLinks.length > 0 && (
                  <ul style={{ paddingInlineStart: '18px', margin: '8px 0 0 0', fontSize: '0.82rem' }}>
                    {driveLinks.map((l, i) => (
                      <li key={i}>{l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.fileName || l.url}</a> : (l.fileName || '')}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="field" style={{ marginBottom: 0 }}>
              <label>נושא ההודעה</label>
              <input
                type="text"
                className="input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>תוכן</label>
              <textarea
                className="textarea"
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                required
                disabled={loading}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>קבצים מצורפים (ניתן לבחור כמה)</label>
              <input type="file" className="input" multiple onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])} disabled={loading} />
              {files.length > 0 && (
                <div className="hint" style={{ marginTop: '6px' }}>
                  {files.length} קבצים נבחרו: {files.map(f => f.name).join(', ')} - טבלת הוראות תצורף אוטומטית למייל.
                </div>
              )}
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>יעד הקבצים בהתאמה</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { v: 'email', label: 'צרופה למייל' },
                  { v: 'drive', label: 'דרייב + שיתוף' },
                  { v: 'both', label: 'גם וגם' }
                ].map(o => (
                  <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                    <input type="radio" name="modernSendMode" value={o.v} checked={sendMode === o.v} onChange={() => setSendMode(o.v)} disabled={loading} />
                    {o.label}
                  </label>
                ))}
              </div>
              {(sendMode === 'drive' || sendMode === 'both') && (
                <input type="text" className="input" value={driveFolderId} onChange={e => setDriveFolderId(e.target.value)} placeholder="מזהה תיקיית דרייב (רשות)" dir="ltr" disabled={loading} style={{ marginTop: '8px' }} />
              )}
              {(sendMode === 'drive' || sendMode === 'both') && (
                <div className="hint" style={{ marginTop: '6px' }}>הקבצים ישותפו עם הנמען בהרשאת הורדה מלאה.</div>
              )}
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>ביטול</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-check" /></svg>}
              {loading ? 'שולח...' : 'שלח'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
