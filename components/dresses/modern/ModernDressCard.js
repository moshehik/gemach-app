'use client';

import React from 'react';

const TABS = [
  { id: 'details', label: 'פרטי דגם', icon: 'i-id' },
  { id: 'items', label: 'פריטים ומלאי', icon: 'i-box', withCount: true },
  { id: 'rentals', label: 'השכרות', icon: 'i-refresh' },
  { id: 'history', label: 'מידע', icon: 'i-history' }
];

/**
 * המעטפת של כרטיס הדגם: page-head (כותרת, badges, פעולות), טאבים, ותוכן טאב אחד
 * בכל רגע (כל הטאבים נשארים mounted, כדי לשמור סטייט פנימי של טבלאות/סינונים).
 */
export default function ModernDressCard({
  dress,
  items,
  activeTab,
  onTabChange,
  saving,
  saveMessage,
  hasUnsavedChanges,
  onSave,
  onCancelChanges,
  onDelete,
  onRestore,
  onExit,
  onPrint,
  tabContents
}) {
  const activeItems = (items || []).filter(i => !i.isDeleted);
  const availableItems = activeItems.filter(i => !i.inRepair && !i.notInUse);
  const attentionCount = activeItems.filter(i => i.inRepair || i.notInUse).length;

  // "לא פעיל" נגזר גם מתאריך יציאה מפורש וגם ממצב שבו לא נותר אף פריט זמין —
  // בדיוק כמו הצביעה בקטלוג הראשי, כדי ששתי המסכים יספרו אותו סיפור.
  const hasExitDate = !!dress.exitDateFromRepo;
  const isInactive = hasExitDate || (activeItems.length > 0 && availableItems.length === 0);

  const modelTitle = `דגם ${dress.barcodePrefix || '—'}`;
  const updatedLabel = dress.updatedAt
    ? `עודכן ${new Date(dress.updatedAt).toLocaleDateString('he-IL')} · ${new Date(dress.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  const descParts = [
    `קוד ${dress.barcodePrefix || '—'}`,
    dress.priceCategory ? `קטגוריית מחיר: ${dress.priceCategory}` : 'ללא קטגוריית מחיר',
    `${activeItems.length} פריטים`,
    `${availableItems.length} זמינים`,
    updatedLabel
  ].filter(Boolean);

  const isErrorMsg = saveMessage && (saveMessage.includes('שגיאה') || saveMessage.includes('בוטל'));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{modelTitle}{dress.name ? ` — ${dress.name}` : ''}</h1>
          <div className="page-desc">{descParts.join(' · ')}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {dress.isDeleted ? (
              <span className="badge badge-danger"><svg className="icon"><use href="#i-trash" /></svg>מחוק</span>
            ) : isInactive ? (
              <span className="badge badge-warning"><svg className="icon"><use href="#i-x-circle" /></svg>לא פעיל</span>
            ) : (
              <span className="badge badge-success"><svg className="icon"><use href="#i-check-circle" /></svg>פעיל</span>
            )}
            {dress.inInspection && (
              <span className="badge badge-warning"><svg className="icon"><use href="#i-alert-tri" /></svg>בבדיקה (התראה)</span>
            )}
            {attentionCount > 0 && (
              <button
                type="button"
                className="badge badge-warning"
                style={{ border: 'none', cursor: 'pointer' }}
                title="מעבר לפריטים הדורשים טיפול"
                onClick={() => onTabChange('items', 'attention')}
              >
                <svg className="icon"><use href="#i-alert-tri" /></svg>{attentionCount} פריטים דורשים טיפול
              </button>
            )}
          </div>
        </div>

        <div className="page-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPrint('card')}>
            <svg className="icon"><use href="#i-printer" /></svg>הדפסת כרטיס שמלה
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPrint('export')}>
            <svg className="icon"><use href="#i-download" /></svg>ייצוא פריטים (CSV)
          </button>
          {dress.isDeleted ? (
            <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--success)' }} onClick={onRestore}>
              <svg className="icon"><use href="#i-refresh" /></svg>שחזור דגם
            </button>
          ) : (
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={onDelete}>
              <svg className="icon"><use href="#i-trash" /></svg>מחיקת דגם
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onCancelChanges} disabled={!hasUnsavedChanges || saving} title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'}>
            <svg className="icon"><use href="#i-refresh" /></svg>ביטול שינויים
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave()} disabled={saving}>
            {saving ? <span className="spinner" /> : <svg className="icon"><use href="#i-check" /></svg>}שמור שינויים
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            <svg className="icon"><use href="#i-arrow-end" /></svg>חזור לרשימה
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`callout ${isErrorMsg ? 'callout-danger' : 'callout-success'}`} style={{ marginBottom: '18px' }}>
          <svg className="icon"><use href={isErrorMsg ? '#i-alert-circle' : '#i-check-circle'} /></svg>
          {saveMessage}
        </div>
      )}

      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            style={{
              appearance: 'none', WebkitAppearance: 'none', background: 'none', font: 'inherit',
              borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none'
            }}
            onClick={() => onTabChange(tab.id)}
          >
            <svg className="icon"><use href={`#${tab.icon}`} /></svg>
            {tab.label}{tab.withCount ? ` (${activeItems.length})` : ''}
          </button>
        ))}
      </div>

      {TABS.map(tab => (
        <div key={tab.id} className={`tab-panel${activeTab === tab.id ? ' active' : ''}`}>
          {tabContents[tab.id]}
        </div>
      ))}
    </>
  );
}
