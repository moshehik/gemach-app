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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
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

    try {
      let fileContent = '';
      let fileName = '';

      if (file) {
        fileContent = await convertFileToBase64(file);
        fileName = file.name;
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          emailBody: formData.body,
          fileName,
          fileContent,
          customerId,
          employeeId
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('המייל נשלח בהצלחה!');
        setTimeout(() => {
          onClose();
          setSuccess('');
          setFormData(prev => ({ ...prev, subject: '', body: '', cc: '', username: '', password: '' }));
          setFile(null);
        }, 2000);
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
                <label>קובץ מצורף</label>
                <input type="file" className="input" onChange={handleFileChange} disabled={loading} />
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
