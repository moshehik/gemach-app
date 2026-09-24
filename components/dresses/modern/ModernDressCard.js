'use client';

import React from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { Btn, Chip, Tabs, Banner } from '@/app/v3/ui/components';

const TABS = [
  { id: 'details', label: 'פרטי הדגם', icon: 'id' },
  { id: 'items', label: 'מלאי', icon: 'box', withCount: true },
  { id: 'rentals', label: 'השכרות', icon: 'refresh' },
  { id: 'history', label: 'יומן', icon: 'history' }
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
    ? `עודכן ${getHebrewDateString(dress.updatedAt)} · ${new Date(dress.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  const isErrorMsg = saveMessage && (saveMessage.includes('שגיאה') || saveMessage.includes('בוטל'));

  return (
    <>
      <header className="v3-pagehead">
        <div className="v3-pagehead__title">
          <h1 className="v3-h1">{modelTitle}{dress.name ? ` — ${dress.name}` : ''}</h1>
        </div>
        <div className="v3-pagehead__tools">
          <Btn variant="quiet" icon="arrow-end" onClick={onExit}>חזרה לקטלוג</Btn>
        </div>
      </header>

      <div className="v3-cluster">
        {dress.isDeleted ? (
          <Chip variant="attn" icon="trash">מחוק</Chip>
        ) : isInactive ? (
          <Chip variant="attn" icon="x-circle">לא פעיל</Chip>
        ) : (
          <Chip variant="done" icon="check-circle">פעיל</Chip>
        )}
        {dress.inInspection && (
          <Chip variant="attn" icon="alert-tri">בבדיקה</Chip>
        )}
        {attentionCount > 0 && (
          <Chip variant="attn" icon="alert-tri" title="מעבר לפריטים הדורשים טיפול" onClick={() => onTabChange('items', 'attention')}>
            <bdi>{attentionCount}</bdi> פריטים דורשים טיפול
          </Chip>
        )}
      </div>

      <p className="v3-muted">
        קוד <bdi>{dress.barcodePrefix || '—'}</bdi>
        {' · '}{dress.priceCategory ? <>קטגוריית מחיר: {dress.priceCategory}</> : 'ללא קטגוריית מחיר'}
        {' · '}<bdi>{activeItems.length}</bdi> פריטים, <bdi>{availableItems.length}</bdi> זמינים
        {updatedLabel && <>{' · '}<bdi>{updatedLabel}</bdi></>}
      </p>

      <div className="v3-cluster">
        <Btn variant="primary" icon="check" loading={saving} onClick={() => onSave()}>שמירה</Btn>
        <Btn icon="refresh" onClick={onCancelChanges} disabled={!hasUnsavedChanges || saving} title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'}>ביטול שינויים</Btn>
        <Btn size="sm" icon="printer" onClick={() => onPrint('card')}>הדפסת כרטיס</Btn>
        <Btn size="sm" icon="download" onClick={() => onPrint('export')}>ייצוא פריטים ל-CSV</Btn>
        {dress.isDeleted ? (
          <Btn size="sm" icon="refresh" onClick={onRestore}>שחזור הדגם</Btn>
        ) : (
          <Btn size="sm" variant="danger" icon="trash" onClick={onDelete}>מחיקת הדגם</Btn>
        )}
      </div>

      {saveMessage && (
        <Banner kind={isErrorMsg ? 'alert' : 'success'} title={saveMessage} />
      )}

      <Tabs
        label="חלקי כרטיס הדגם"
        value={activeTab}
        onChange={(id) => onTabChange(id)}
        items={TABS.map(tab => ({ key: tab.id, label: tab.label, icon: tab.icon, count: tab.withCount ? activeItems.length : undefined }))}
      />

      {TABS.map(tab => (
        <div key={tab.id} role="tabpanel" aria-labelledby={`tab-${tab.id}`} hidden={activeTab !== tab.id} className="v3-stack">
          {tabContents[tab.id]}
        </div>
      ))}
    </>
  );
}
