'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import HebrewDatePicker from '../../HebrewDatePicker';

/**
 * מודל "סימון כלא פעיל" — סיבה + תאריך יציאה מהמאגר.
 * מוצג גם כשעורכים סיבה קיימת.
 */
export function ModernInactiveReasonModal({ dress, onClose, onSave }) {
  const [reason, setReason] = useState(dress.inactiveReason || '');
  const [exitDate, setExitDate] = useState(dress.exitDateFromRepo || new Date().toISOString());
  const [error, setError] = useState('');

  const handleSave = () => {
    if (dress.entryDateToRepo && exitDate && new Date(exitDate) < new Date(dress.entryDateToRepo)) {
      setError('תאריך היציאה לא יכול להיות קודם לתאריך הכניסה למאגר');
      return;
    }
    onSave({ exitDateFromRepo: exitDate, inactiveReason: reason.trim() || null });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-circle" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>
          <svg className="icon"><use href="#i-x-circle" /></svg>
        </div>
        <h3>סימון הדגם כלא פעיל</h3>
        <p>יש לציין סיבה ותאריך יציאה מהמאגר. הדגם לא יופיע יותר בבחירת דגמים להזמנה חדשה.</p>

        <div style={{ textAlign: 'right' }}>
          <div className="field">
            <label htmlFor="dress-inactive-exitdate">תאריך יציאה מהמאגר</label>
            <HebrewDatePicker value={exitDate} onChange={(date) => { setError(''); setExitDate(date); }} />
          </div>

          <div className="field">
            <label htmlFor="dress-inactive-reason">סיבה</label>
            <textarea
              id="dress-inactive-reason"
              className="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: הדגם התיישן, נתרם, הושמד..."
              autoFocus
            />
          </div>

          {error && (
            <div className="field">
              <span className="error-text"><svg className="icon"><use href="#i-alert-circle" /></svg>{error}</span>
            </div>
          )}
        </div>

        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>ביטול</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            <svg className="icon"><use href="#i-check" /></svg> שמור סימון
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
