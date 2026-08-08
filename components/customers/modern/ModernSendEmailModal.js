'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function ModernSendEmailModal({ isOpen, onClose, customer, authResult }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError('חובה למלא נושא ותוכן');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.email,
          subject,
          emailBody: body,
          username: authResult.employeeId,
          password: authResult.pin,
          customerId: customer.id
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('המייל נשלח בהצלחה!');
        onClose();
        setSubject('');
        setBody('');
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
