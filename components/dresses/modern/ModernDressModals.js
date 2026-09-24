'use client';

import { useState } from 'react';
import HebrewDatePicker from '../../HebrewDatePicker';
import { Dialog, Btn, Field, Icon } from '@/app/v3/ui/components';

/**
 * מודל "סימון כלא פעיל" — סיבה + תאריך יציאה מהמאגר.
 * מוצג גם כשעורכים סיבה קיימת.
 * חלונית עם קלט => Dialog variant="form" (בהיר בלבד, R19). ההורה מציג/מסתיר אותה, לכן open תמיד true.
 */
export function ModernInactiveReasonModal({ dress, onClose, onSave }) {
  const [reason, setReason] = useState(dress.inactiveReason || '');
  const [exitDate, setExitDate] = useState(dress.exitDateFromRepo || new Date().toISOString());
  const [error, setError] = useState('');

  const handleSave = () => {
    if (dress.entryDateToRepo && exitDate && new Date(exitDate) < new Date(dress.entryDateToRepo)) {
      setError('תאריך היציאה לא יכול להיות לפני תאריך הכניסה למאגר');
      return;
    }
    onSave({ exitDateFromRepo: exitDate, inactiveReason: reason.trim() || null });
  };

  return (
    <Dialog
      open
      variant="form"
      icon="x-circle"
      badgeKind="tilt"
      title="להוציא את הדגם מהפעילות?"
      sub="הדגם לא יופיע יותר בבחירת דגמים בהזמנה חדשה."
      onClose={onClose}
      initialFocus="#dress-inactive-reason"
      actions={
        <>
          <Btn variant="primary" icon="check" onClick={handleSave}>שמירה</Btn>
          <Btn variant="quiet" onClick={onClose}>ביטול</Btn>
        </>
      }
    >
      <div className="v3-stack">
        <div className="v3-field">
          <span className="v3-label" id="dress-inactive-exitdate-label">תאריך יציאה מהמאגר</span>
          <div role="group" aria-labelledby="dress-inactive-exitdate-label">
            <HebrewDatePicker value={exitDate} onChange={(date) => { setError(''); setExitDate(date); }} />
          </div>
        </div>

        <Field label="סיבה" as="textarea" id="dress-inactive-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="לדוגמה: התיישן, נתרם, נמכר..." />

        {error && (
          <div className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{error}</div>
        )}
      </div>
    </Dialog>
  );
}
