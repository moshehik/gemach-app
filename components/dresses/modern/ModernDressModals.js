'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, XCircle, Upload, Check, Image as ImageIcon, Trash2 } from 'lucide-react';
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

  return (
    <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="moc moc-modal-box">
        <div className="moc-modal-body" style={{ paddingTop: '28px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px', background: 'var(--moc-danger-bg)', color: 'var(--moc-danger-text)'
          }}>
            <XCircle size={26} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>סימון הדגם כלא פעיל</h3>
          <p style={{ color: 'var(--moc-text-muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
            יש לציין סיבה ותאריך יציאה מהמאגר. הדגם לא יופיע יותר בבחירת דגמים להזמנה חדשה.
          </p>

          <div style={{ textAlign: 'right' }}>
            <span className="moc-field-label">תאריך יציאה מהמאגר</span>
            <div style={{ marginBottom: '12px' }}>
              <HebrewDatePicker value={exitDate} onChange={(date) => { setError(''); setExitDate(date); }} />
            </div>

            <span className="moc-field-label">סיבה</span>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="לדוגמה: הדגם התיישן, נתרם, הושמד..."
              autoFocus
            />

            {error && (
              <div style={{ color: 'var(--moc-danger-text)', fontWeight: 700, fontSize: '0.85rem', marginTop: '8px' }}>{error}</div>
            )}
          </div>
        </div>

        <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
          <button className="moc-btn moc-btn-outline" onClick={onClose}>ביטול</button>
          <button className="moc-btn moc-btn-gold" onClick={handleSave}><Check size={14} /> שמור סימון</button>
        </div>
      </div>
    </div>
  );
}

/**
 * מודל תמונת הדגם — העלאת קובץ או הזנת נתיב ידני.
 */
export function ModernDressImageModal({ dress, imageSrc, uploading, onUpload, onSetUrl, onRemove, onClose }) {
  const [url, setUrl] = useState(dress.imageUrl || '');
  const fileRef = useRef(null);

  // אחרי העלאה מוצלחת השדה מתעדכן לנתיב החדש
  useEffect(() => { setUrl(dress.imageUrl || ''); }, [dress.imageUrl]);

  return (
    <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="moc moc-modal-box">
        <div className="moc-modal-head">
          <h3>תמונת הדגם</h3>
          <button className="moc-close-x" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="moc-modal-body">
          <button
            className="moc-image-frame"
            style={{ height: '200px', width: '100%', cursor: 'pointer', marginBottom: '14px', padding: 0 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {imageSrc ? (
              <img src={imageSrc} alt="תצוגה מקדימה" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : uploading ? (
              <><span className="moc-spinner lg" /><span style={{ fontSize: '0.86rem', fontWeight: 600 }}>מעלה תמונה...</span></>
            ) : (
              <><ImageIcon size={30} /><span style={{ fontSize: '0.86rem', fontWeight: 600 }}>לחץ לבחירת קובץ תמונה</span></>
            )}
          </button>

          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onUpload} />

          <span className="moc-field-label">או הזן כתובת תמונה ידנית</span>
          <input
            type="text"
            dir="ltr"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={`/images/dresses/${dress.barcodePrefix || '1234'}.jpg`}
          />
        </div>

        <div className="moc-modal-foot">
          {dress.imageUrl && (
            <button className="moc-btn moc-btn-danger-soft" style={{ marginLeft: 'auto' }} onClick={onRemove}>
              <Trash2 size={14} /> הסר תמונה
            </button>
          )}
          <button className="moc-btn moc-btn-outline" onClick={onClose}>ביטול</button>
          <button className="moc-btn moc-btn-gold" onClick={() => { onSetUrl(url.trim() || null); onClose(); }}>
            <Upload size={14} /> שמור תמונה
          </button>
        </div>
      </div>
    </div>
  );
}
