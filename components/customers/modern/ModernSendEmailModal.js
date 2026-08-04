'use client';

import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

export default function ModernSendEmailModal({ isOpen, onClose, customer, authResult }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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

  return (
    <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="moc moc-modal-box wide" style={{ maxWidth: '500px' }}>
        <div className="moc-modal-head">
          <h3>שליחת מייל - {customer.firstName} {customer.lastName}</h3>
          <button className="moc-close-x" onClick={() => !loading && onClose()}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="moc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && <div style={{ color: 'var(--moc-danger-text)', background: 'var(--moc-danger-bg)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>{error}</div>}
            
            <div>
              <span className="moc-field-label">נושא ההודעה</span>
              <input 
                type="text" 
                value={subject} 
                onChange={e => setSubject(e.target.value)} 
                required 
                disabled={loading}
              />
            </div>
            
            <div>
              <span className="moc-field-label">תוכן</span>
              <textarea 
                value={body} 
                onChange={e => setBody(e.target.value)} 
                rows={6} 
                style={{ resize: 'vertical' }}
                required
                disabled={loading}
              />
            </div>
          </div>
          <div className="moc-modal-foot">
            <button type="button" className="moc-btn moc-btn-outline" onClick={onClose} disabled={loading}>ביטול</button>
            <button type="submit" className="moc-btn moc-btn-gold" disabled={loading}>
              {loading ? <span className="moc-spinner" /> : <Send size={15} />} {loading ? 'שולח...' : 'שלח'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
