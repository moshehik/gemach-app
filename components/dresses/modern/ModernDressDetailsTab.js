'use client';

import React, { useRef, useState } from 'react';
import {
  Shirt, Power, AlertTriangle, FileText, Edit2, Check, ExternalLink, RefreshCw,
  Trash2, Save, CheckCircle2, XCircle, Image as ImageIcon, Upload, Calendar
} from 'lucide-react';
import Link from 'next/link';
import HebrewDatePicker from '../../HebrewDatePicker';
import { getHebrewDateString } from '../../../lib/hebrewDate';

const fmtDate = (d) => {
  if (!d) return null;
  try {
    return `${new Date(d).toLocaleDateString('he-IL')} (${getHebrewDateString(d)})`;
  } catch (e) {
    return new Date(d).toLocaleDateString('he-IL');
  }
};

/**
 * טאב "פרטי דגם" — אותה שיטה בדיוק כמו ModernGeneralDetails בכרטיס ההזמנה:
 * שורות קומפקטיות (נושא אחד מתחת לשני), ואייקון עריכה שפותח edit-box בתוך השורה.
 */
export default function ModernDressDetailsTab({
  dress,
  onChange,
  isNewModel,
  useModelNames,
  showImages,
  categories,
  imageSrc,
  uploading,
  onImageUpload,
  onRemoveImage,
  onAutoCode,
  onMarkInactive,
  onReturnToActivity,
  onToggleInspection,
  onDelete,
  onRestore,
  onSave,
  saving
}) {
  const [editIdentity, setEditIdentity] = useState(isNewModel);
  const [editNotes, setEditNotes] = useState(false);
  const fileRef = useRef(null);

  const hasExitDate = !!dress.exitDateFromRepo;
  const subLine = [
    dress.priceCategory ? `קטגוריית מחיר: ${dress.priceCategory}` : 'ללא קטגוריית מחיר',
    dress.entryDateToRepo ? `נכנס למאגר: ${fmtDate(dress.entryDateToRepo)}` : null
  ].filter(Boolean).join(' · ');

  return (
    <div className={showImages ? 'moc-grid-detail' : ''}>
      {/* ===== תמונת הדגם ===== */}
      {showImages && (
        <div className="moc-card-panel moc-detail-card" style={{ padding: '16px' }}>
          <div className="moc-image-frame">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={dress.name || 'תמונת דגם'}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <>
                <ImageIcon size={38} />
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>אין תמונה</span>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onImageUpload}
          />

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              className="moc-btn moc-btn-gold moc-btn-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <><span className="moc-spinner" /> מעלה...</> : <><Upload size={14} /> {imageSrc ? 'החלף תמונה' : 'העלה תמונה'}</>}
            </button>
            {dress.imageUrl && (
              <button className="moc-btn moc-btn-outline moc-btn-icon" title="הסר תמונה" onClick={onRemoveImage}>
                <Trash2 size={15} />
              </button>
            )}
          </div>

          <p style={{ margin: '10px 0 0', fontSize: '0.76rem', color: 'var(--moc-text-muted)', lineHeight: 1.6 }}>
            כשאין תמונה מועלית, המערכת מחפשת אוטומטית קובץ בשם הקוד ({dress.barcodePrefix || '####'}.jpg) לפי הגדרת "שמות קבצים לתמונות".
          </p>
        </div>
      )}

      {/* ===== שורות קומפקטיות ===== */}
      <div className="moc-card-panel moc-detail-card" style={{ padding: '6px 20px 16px' }}>

        {/* זיהוי הדגם */}
        <div className="moc-compact-row">
          <div className="moc-avatar-chip"><Shirt size={17} /></div>
          <div className="moc-cr-main">
            <div className="moc-cr-title">
              {useModelNames ? (dress.name || 'ללא שם') : `דגם ${dress.barcodePrefix || '—'}`}
              {useModelNames && (
                <span style={{ color: 'var(--moc-text-muted)', fontWeight: 600, fontSize: '0.9rem' }}> · קוד {dress.barcodePrefix || '—'}</span>
              )}
            </div>
            <div className="moc-cr-sub" title={subLine}>{subLine}</div>
          </div>
          <div className="moc-cr-actions">
            <Link
              href="/dashboard/pricelist"
              target="_blank"
              className="moc-icon-btn-plain"
              style={{ textDecoration: 'none' }}
              title="מעבר למחירון הקטגוריה"
            >
              <ExternalLink size={16} />
            </Link>
            <button
              className="moc-icon-btn-plain"
              title={editIdentity ? 'סיים עריכה' : 'עריכת פרטי הדגם'}
              onClick={() => setEditIdentity(!editIdentity)}
            >
              {editIdentity ? <Check size={16} /> : <Edit2 size={16} />}
            </button>
          </div>
        </div>

        {editIdentity && (
          <div className="moc-edit-box">
            <div className="moc-grid-2">
              <div>
                <span className="moc-field-label">קוד דגם (קידומת ברקוד) {isNewModel && '*'}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={dress.barcodePrefix ?? ''}
                    disabled={!isNewModel}
                    title={isNewModel ? '' : 'לא ניתן לשנות קוד לדגם קיים — הוא מרכיב את ברקודי הפריטים'}
                    onChange={e => onChange({ barcodePrefix: e.target.value })}
                  />
                  {isNewModel && (
                    <button className="moc-btn moc-btn-outline moc-btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={onAutoCode}>
                      <RefreshCw size={13} /> קוד אוטומטי
                    </button>
                  )}
                </div>
                {!isNewModel && (
                  <p style={{ margin: '5px 0 0', fontSize: '0.74rem', color: 'var(--moc-text-muted)' }}>
                    הקוד ננעל לאחר יצירת הדגם — הוא מרכיב את ברקודי הפריטים.
                  </p>
                )}
              </div>

              {useModelNames && (
                <div>
                  <span className="moc-field-label">שם דגם *</span>
                  <input type="text" value={dress.name || ''} onChange={e => onChange({ name: e.target.value })} />
                </div>
              )}

              <div>
                <span className="moc-field-label">קטגוריית מחיר</span>
                <select value={dress.priceCategory || ''} onChange={e => onChange({ priceCategory: e.target.value })}>
                  <option value="">-- בחר קטגוריית מחיר --</option>
                  {(categories || []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <span className="moc-field-label">תאריך כניסה למאגר</span>
                <HebrewDatePicker
                  value={dress.entryDateToRepo}
                  onChange={(date) => onChange({ entryDateToRepo: date })}
                />
              </div>
            </div>
          </div>
        )}

        {/* סטטוס פעילות */}
        {!isNewModel && (
          <>
            <div className="moc-compact-row">
              <div className="moc-avatar-chip"><Power size={17} /></div>
              <div className="moc-cr-main">
                <div className="moc-cr-title">סטטוס: {hasExitDate ? 'לא פעיל' : 'פעיל'}</div>
                <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
                  {hasExitDate
                    ? 'הדגם הוצא מהמאגר — לא ניתן לבחור אותו בהזמנה חדשה'
                    : 'הדגם זמין להשכרה ומופיע בבחירת דגמים בהזמנה חדשה'}
                </div>
              </div>
              <div className="moc-cr-actions">
                <div className="moc-toggle-pair">
                  <button
                    className={`moc-opt ${!hasExitDate ? 'active' : ''}`}
                    onClick={() => { if (hasExitDate) onReturnToActivity(); }}
                  >
                    <CheckCircle2 size={14} /> פעיל
                  </button>
                  <button
                    className={`moc-opt ${hasExitDate ? 'active' : ''}`}
                    onClick={() => { if (!hasExitDate) onMarkInactive(); }}
                  >
                    <XCircle size={14} /> לא פעיל
                  </button>
                </div>
              </div>
            </div>

            {hasExitDate && (
              <div className="moc-status-note">
                <div>
                  <div className="moc-sn-label">
                    <XCircle size={15} /> סיבת לא-פעיל: {dress.inactiveReason || 'לא צוינה סיבה'}
                  </div>
                  <div className="moc-sn-sub">
                    <Calendar size={12} style={{ verticalAlign: '-2px' }} /> תאריך יציאה מהמאגר: {fmtDate(dress.exitDateFromRepo)}
                  </div>
                </div>
                <button className="moc-btn moc-btn-danger-soft moc-btn-sm" onClick={onMarkInactive}>
                  <Edit2 size={13} /> ערוך סיבה ותאריך
                </button>
              </div>
            )}

            {/* התראת בדיקה */}
            <div className="moc-compact-row">
              <div className="moc-avatar-chip"><AlertTriangle size={17} /></div>
              <div className="moc-cr-main">
                <div className="moc-cr-title">הצג בבדיקה (התראה)</div>
                <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
                  כשמסומן — הדגם יופיע בהתראות המלאי ובבחירת פריט תוצג אזהרה לעובד
                </div>
              </div>
              <div className="moc-cr-actions">
                <button
                  className={`moc-pill-toggle ${dress.inInspection ? 'on orange' : ''}`}
                  onClick={onToggleInspection}
                >
                  {dress.inInspection ? <><Check size={13} /> מופעל</> : 'כבוי'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* הערות */}
        <div className="moc-compact-row" style={{ alignItems: 'flex-start' }}>
          <div className="moc-avatar-chip"><FileText size={17} /></div>
          <div className="moc-cr-main">
            <div className="moc-cr-title">הערות לדגם</div>
            <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
              {dress.notes || 'אין הערות'}
            </div>
          </div>
          <div className="moc-cr-actions">
            <button
              className="moc-icon-btn-plain"
              title={editNotes ? 'סיים עריכה' : 'עריכת הערות'}
              onClick={() => setEditNotes(!editNotes)}
            >
              {editNotes ? <Check size={16} /> : <Edit2 size={16} />}
            </button>
          </div>
        </div>

        {editNotes && (
          <div className="moc-edit-box">
            <textarea
              rows={3}
              value={dress.notes || ''}
              onChange={e => onChange({ notes: e.target.value })}
              placeholder="הערות כלליות לגבי הדגם..."
            />
          </div>
        )}

        {/* שורת פעולות תחתונה */}
        <div className="moc-compact-row" style={{ paddingBottom: 0 }}>
          <div className="moc-cr-main">
            {!isNewModel && (
              <div className="moc-cr-sub" style={{ whiteSpace: 'normal' }}>
                מזהה במערכת הישנה (Access): <strong className="moc-mono" style={{ color: 'var(--moc-text-main)' }}>{dress.legacyId ?? '—'}</strong>
              </div>
            )}
          </div>
          <div className="moc-cr-actions">
            {!isNewModel && (
              dress.isDeleted ? (
                <button className="moc-btn moc-btn-outline moc-btn-sm" style={{ color: '#16a34a' }} onClick={onRestore}>
                  <RefreshCw size={14} /> שחזר דגם מחוק
                </button>
              ) : (
                <button className="moc-btn moc-btn-danger-soft moc-btn-sm" onClick={onDelete}>
                  <Trash2 size={14} /> מחק דגם
                </button>
              )
            )}
            <button className="moc-btn moc-btn-gold moc-btn-sm" onClick={() => onSave()} disabled={saving}>
              {saving ? <><span className="moc-spinner" /> שומר...</> : <><Save size={14} /> {isNewModel ? 'שמור וצור דגם' : 'שמור פרטי דגם'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
