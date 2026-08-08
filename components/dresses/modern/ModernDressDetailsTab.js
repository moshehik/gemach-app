'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '../../HebrewDatePicker';
import UploadZone from '../../../app/components/UploadZone';
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
 * טאב "פרטי דגם" — זהות הדגם, תמונה, סטטוס פעילות/בדיקה והערות.
 * כל השדות ערוכים ישירות (ללא מצב "עריכה" נפרד) — כמו שאר מסכי הטופס במערכת.
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
  const fileRef = useRef(null);
  const hasExitDate = !!dress.exitDateFromRepo;

  return (
    <>
      <div className={showImages ? 'two-col' : undefined}>
        {showImages && (
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <h3>תמונת הדגם</h3>

            {imageSrc ? (
              <>
                <div style={{
                  borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)',
                  background: 'var(--surface-alt)', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <img
                    src={imageSrc}
                    alt={dress.name || 'תמונת דגם'}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? <><span className="spinner" /> מעלה...</> : <><svg className="icon"><use href="#i-upload" /></svg>החלף תמונה</>}
                  </button>
                  <button type="button" className="btn btn-danger-ghost btn-icon-only btn-sm" title="הסר תמונה" onClick={onRemoveImage}>
                    <svg className="icon"><use href="#i-trash" /></svg>
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(f); e.target.value = ''; }}
                />
              </>
            ) : (
              <UploadZone
                id="dress-detail-image"
                accept="image/*"
                onFileSelect={onImageUpload}
                disabled={uploading}
                label={uploading ? 'מעלה תמונה...' : 'אין תמונה — לחץ להעלאה'}
                hint="PNG או JPG"
              />
            )}

            <div className="field" style={{ marginTop: '12px', marginBottom: 0, textAlign: 'right' }}>
              <label htmlFor="dress-detail-image-url">או הזן כתובת תמונה ידנית</label>
              <input
                id="dress-detail-image-url"
                className="input"
                type="text"
                dir="ltr"
                value={dress.imageUrl || ''}
                onChange={(e) => onChange({ imageUrl: e.target.value || null })}
                placeholder={`/images/dresses/${dress.barcodePrefix || '1234'}.jpg`}
              />
            </div>

            <p className="hint" style={{ marginTop: '12px', color: 'var(--text-3)', lineHeight: 1.7 }}>
              כשאין תמונה מועלית, המערכת מחפשת אוטומטית קובץ בשם הקוד ({dress.barcodePrefix || '####'}.jpg) לפי הגדרת &quot;שמות קבצים לתמונות&quot;.
            </p>
          </div>
        )}

        <div className="card card-pad">
          <h3>זיהוי הדגם</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="dress-detail-code">קוד דגם (קידומת ברקוד) {isNewModel && '*'}</label>
              <input
                id="dress-detail-code"
                className="input"
                type="number"
                value={dress.barcodePrefix ?? ''}
                disabled={!isNewModel}
                title={isNewModel ? '' : 'לא ניתן לשנות קוד לדגם קיים — הוא מרכיב את ברקודי הפריטים'}
                onChange={(e) => onChange({ barcodePrefix: e.target.value })}
              />
              {isNewModel ? (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '6px' }} onClick={onAutoCode}>
                  <svg className="icon"><use href="#i-refresh" /></svg>קוד אוטומטי
                </button>
              ) : (
                <span className="hint">הקוד ננעל לאחר יצירת הדגם — הוא מרכיב את ברקודי הפריטים.</span>
              )}
            </div>

            {useModelNames && (
              <div className="field">
                <label htmlFor="dress-detail-name">שם דגם *</label>
                <input
                  id="dress-detail-name"
                  className="input"
                  type="text"
                  value={dress.name || ''}
                  onChange={(e) => onChange({ name: e.target.value })}
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="dress-detail-category">קטגוריית מחיר</label>
              <select
                id="dress-detail-category"
                className="select"
                value={dress.priceCategory || ''}
                onChange={(e) => onChange({ priceCategory: e.target.value })}
              >
                <option value="">-- בחר קטגוריית מחיר --</option>
                {(categories || []).map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="dress-detail-entrydate">תאריך כניסה למאגר</label>
              <HebrewDatePicker value={dress.entryDateToRepo} onChange={(date) => onChange({ entryDateToRepo: date })} />
            </div>
          </div>

          <Link href="/dashboard/pricelist" target="_blank" className="btn btn-ghost btn-sm">
            <svg className="icon"><use href="#i-link" /></svg>מעבר למחירון הקטגוריה
          </Link>
        </div>
      </div>

      {!isNewModel && (
        <div className="card card-pad" style={{ marginTop: '16px' }}>
          <h3>סטטוס פעילות ובדיקה</h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{hasExitDate ? 'הדגם לא פעיל' : 'הדגם פעיל'}</div>
              <div className="hint" style={{ color: 'var(--text-3)' }}>
                {hasExitDate
                  ? 'הדגם הוצא מהמאגר — לא ניתן לבחור אותו בהזמנה חדשה'
                  : 'הדגם זמין להשכרה ומופיע בבחירת דגמים בהזמנה חדשה'}
              </div>
            </div>
            <div className="toggle-btn-group">
              <button type="button" className={!hasExitDate ? 'on' : undefined} onClick={() => { if (hasExitDate) onReturnToActivity(); }}>
                <svg className="icon"><use href="#i-check-circle" /></svg>פעיל
              </button>
              <button type="button" className={hasExitDate ? 'off' : undefined} onClick={() => { if (!hasExitDate) onMarkInactive(); }}>
                <svg className="icon"><use href="#i-x-circle" /></svg>לא פעיל
              </button>
            </div>
          </div>

          {hasExitDate && (
            <div className="callout callout-danger" style={{ marginTop: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <svg className="icon"><use href="#i-x-circle" /></svg>
                <div>
                  <div style={{ fontWeight: 700 }}>סיבת לא-פעיל: {dress.inactiveReason || 'לא צוינה סיבה'}</div>
                  <div style={{ fontSize: '11.5px', marginTop: '2px', opacity: 0.85 }}>
                    תאריך יציאה מהמאגר: {fmtDate(dress.exitDateFromRepo)}
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onMarkInactive}>
                <svg className="icon"><use href="#i-edit" /></svg>ערוך סיבה ותאריך
              </button>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap',
            marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)'
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>הצג בבדיקה (התראה)</div>
              <div className="hint" style={{ color: 'var(--text-3)' }}>
                כשמסומן — הדגם יופיע בהתראות המלאי ובבחירת פריט תוצג אזהרה לעובד
              </div>
            </div>
            <div
              className={`switch${dress.inInspection ? ' on' : ''}`}
              role="switch"
              aria-checked={!!dress.inInspection}
              tabIndex={0}
              title={dress.inInspection ? 'הצג בבדיקה — מופעל. לחץ לכיבוי' : 'הצג בבדיקה — כבוי. לחץ להפעלה'}
              onClick={onToggleInspection}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleInspection(); } }}
            />
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: '16px' }}>
        <h3>הערות לדגם</h3>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="dress-detail-notes" className="sr-only">הערות לדגם</label>
          <textarea
            id="dress-detail-notes"
            className="textarea"
            rows={3}
            value={dress.notes || ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="הערות כלליות לגבי הדגם..."
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginTop: '18px' }}>
        <div className="hint" style={{ color: 'var(--text-3)' }}>
          {!isNewModel && <>מזהה במערכת הישנה (Access): <strong style={{ color: 'var(--text)' }}>{dress.legacyId ?? '—'}</strong></>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isNewModel && (
            dress.isDeleted ? (
              <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--success)' }} onClick={onRestore}>
                <svg className="icon"><use href="#i-refresh" /></svg>שחזר דגם מחוק
              </button>
            ) : (
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={onDelete}>
                <svg className="icon"><use href="#i-trash" /></svg>מחק דגם
              </button>
            )
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave()} disabled={saving}>
            {saving ? <><span className="spinner" />שומר...</> : <><svg className="icon"><use href="#i-check" /></svg>{isNewModel ? 'שמור וצור דגם' : 'שמור פרטי דגם'}</>}
          </button>
        </div>
      </div>
    </>
  );
}
