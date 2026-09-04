'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { normalizeEmail } from '@/lib/emailUtils';

export default function SendEmailModal({ isOpen, onClose, defaultTo, customerId, employeeId }) {
  const [formData, setFormData] = useState({
    to: normalizeEmail(defaultTo) || defaultTo || '',
    cc: '',
    subject: '',
    body: '',
    username: '',
    password: ''
  });
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  // יעד שליחה בהתאמה: email = צרופה למייל, drive = העלאה לדרייב+שיתוף, both = גם וגם
  const [sendMode, setSendMode] = useState('email');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [driveLinks, setDriveLinks] = useState([]);

  useEffect(() => {
    if (defaultTo) {
      setFormData(prev => ({ ...prev, to: normalizeEmail(defaultTo) || defaultTo }));
    }
  }, [defaultTo]);

  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        // Filter by manager (1) or programmer (2)
        const filtered = data.filter(emp => emp.roleId === 1 || emp.roleId === 2);
        setAdmins(filtered);
      })
      .catch(console.error);
  }, []);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const picked = Array.from(e.target.files);
      setFiles(picked);
      setFile(picked[0] || null);
    } else {
      setFiles([]);
      setFile(null);
    }
  };

  const removePickedFile = (idx) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setFile(next[0] || null);
      return next;
    });
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setDriveLinks([]);

    try {
      const attachments = [];
      // תאימות לאחור: שולחים גם fileName/fileContent בודד (הראשון) וגם מערך מלא
      let firstFileName = '';
      let firstFileContent = '';

      for (const f of files) {
        const base64 = await convertFileToBase64(f);
        if (!firstFileContent) {
          firstFileContent = base64;
          firstFileName = f.name;
        }
        attachments.push({
          fileName: f.name,
          fileContent: base64,
          mimeType: f.type || 'application/octet-stream',
          sizeBytes: f.size || null,
          dest: sendMode
        });
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          emailBody: formData.body,
          fileName: firstFileName,
          fileContent: firstFileContent,
          attachments,
          sendMode,
          driveFolderId,
          customerId,
          employeeId
        })
      });

      const data = await res.json();
      if (data.success) {
        const links = Array.isArray(data.driveLinks) ? data.driveLinks : [];
        setDriveLinks(links);
        setSuccess(
          links.length > 0
            ? `המייל נשלח בהצלחה! ${links.length} קבצים הועלו לדרייב עם הרשאת הורדה מלאה.`
            : 'המייל נשלח בהצלחה!'
        );
        setTimeout(() => {
          onClose();
          setSuccess('');
          setDriveLinks([]);
          setFormData(prev => ({ ...prev, subject: '', body: '', cc: '', username: '', password: '' }));
          setFile(null);
          setFiles([]);
          setSendMode('email');
          setDriveFolderId('');
        }, 2600);
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
            שליחת מייל
          </strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => !loading && onClose()}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        {success ? (
          <div className="modal-body">
            <div className="callout callout-success">
              <svg className="icon"><use href="#i-check-circle" /></svg>
              {success}
            </div>
            {driveLinks.length > 0 && (
              <div style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                <strong>קישורי דרייב (הרשאת הורדה מלאה):</strong>
                <ul style={{ paddingInlineStart: '18px', margin: '8px 0 0 0' }}>
                  {driveLinks.map((l, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>
                      {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.fileName || l.url}</a> : (l.fileName || '')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div className="callout callout-danger">
                  <svg className="icon"><use href="#i-alert-circle" /></svg>
                  {error}
                </div>
              )}

              <div className="field" style={{ marginBottom: 0 }}>
                <label>אל (To)</label>
                <input type="email" name="to" className="input" value={formData.to} onChange={handleChange} required dir="ltr" disabled={loading} />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>עותק (CC)</label>
                <input type="email" name="cc" className="input" value={formData.cc} onChange={handleChange} dir="ltr" disabled={loading} />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>נושא</label>
                <input type="text" name="subject" className="input" value={formData.subject} onChange={handleChange} required disabled={loading} />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>תוכן</label>
                <textarea name="body" className="textarea" value={formData.body} onChange={handleChange} rows={6} required disabled={loading} />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>קבצים מצורפים (ניתן לבחור כמה)</label>
                <input type="file" className="input" multiple onChange={handleFileChange} disabled={loading} />
                {files.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.82rem', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface)', color: 'var(--text-2)' }}>
                          <th style={{ textAlign: 'right', padding: '6px 10px' }}>#</th>
                          <th style={{ textAlign: 'right', padding: '6px 10px' }}>שם הקובץ</th>
                          <th style={{ textAlign: 'right', padding: '6px 10px' }}>גודל</th>
                          <th style={{ textAlign: 'right', padding: '6px 10px' }}>יעד</th>
                          <th style={{ padding: '6px 10px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {files.map((f, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 10px', color: 'var(--text-3)' }}>{i + 1}</td>
                            <td style={{ padding: '6px 10px', fontWeight: 600 }}>{f.name}</td>
                            <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{f.size > 1048576 ? `${(f.size / 1048576).toFixed(2)} MB` : f.size > 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${f.size} B`}</td>
                            <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{sendMode === 'email' ? 'מצורף למייל' : sendMode === 'drive' ? 'נשמר בדרייב' : 'מייל + דרייב'}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePickedFile(i)} disabled={loading}>הסר</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="hint" style={{ padding: '8px 10px' }}>טבלת הוראות מסודרת תצורף אוטומטית לגוף המייל דרך ה-GAS, כולל איך מורידים כל קובץ.</div>
                  </div>
                )}
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>יעד הקבצים בהתאמה</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { v: 'email', label: 'צרופה למייל' },
                    { v: 'drive', label: 'העלאה לדרייב + שיתוף' },
                    { v: 'both', label: 'גם וגם' }
                  ].map(o => (
                    <label key={o.v} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', background: sendMode === o.v ? 'var(--primary-tint)' : 'transparent', fontSize: '0.85rem', fontWeight: 600 }}>
                      <input type="radio" name="sendMode" value={o.v} checked={sendMode === o.v} onChange={() => setSendMode(o.v)} disabled={loading} />
                      {o.label}
                    </label>
                  ))}
                </div>
                {(sendMode === 'drive' || sendMode === 'both') && (
                  <>
                    <input type="text" className="input" value={driveFolderId} onChange={e => setDriveFolderId(e.target.value)} placeholder="מזהה תיקיית דרייב (רשות - אחרת ברירת המחדל מההגדרות)" dir="ltr" disabled={loading} style={{ marginTop: '8px' }} />
                    <div className="hint" style={{ marginTop: '6px' }}>הקבצים יועלו לדרייב וישותפו עם הנמען בהרשאת צפייה והורדה מלאה + קישור פתוח להורדה.</div>
                  </>
                )}
              </div>

              <div style={{ background: 'var(--surface-alt)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontWeight: 700, color: 'var(--text-2)' }}>
                  <svg className="icon"><use href="#i-lock" /></svg>
                  אימות מנהל לשליחה
                </div>

                <div className="field" style={{ marginBottom: '12px' }}>
                  <label>שם משתמש (מנהל)</label>
                  <select name="username" className="select" value={formData.username} onChange={handleChange} required disabled={loading}>
                    <option value="">-- בחר מנהל/מתכנת --</option>
                    {admins.map(admin => (
                      <option key={admin.id} value={admin.id}>{admin.firstName} {admin.lastName || ''}</option>
                    ))}
                  </select>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>סיסמה</label>
                  <input type="password" name="password" className="input" value={formData.password} onChange={handleChange} required disabled={loading} />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>ביטול</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-mail" /></svg>}
                {loading ? 'שולח...' : 'שלח מייל'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
