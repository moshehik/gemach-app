'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateOrderStatus } from '../../../lib/orderStatus';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import OrderPrintMenu from '../OrderPrintMenu';

// מיפוי סטטוס טקסטואלי (calculateOrderStatus ב-lib/orderStatus.js, משותף לכמה עמודים) אל
// מחלקת ה-badge של מערכת העיצוב "אריג" — אותו מיפוי כמו בעמוד רשימת ההזמנות (app/orders/page.js).
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'הוחזר':
    case 'הוחזר חלקי':
      return 'badge-success';
    case 'הושכר':
    case 'הושכר חלקי':
      return 'badge-info';
    case 'בקרוב':
      return 'badge-warning';
    case 'עבר':
    case 'מחוק':
    case 'טיוטה':
    default:
      return 'badge-neutral';
  }
};

const TABS = [
  { id: 'details', label: 'פרטים כלליים', icon: 'i-user' },
  { id: 'items', label: 'פריטים והשכרות', icon: 'i-bag', withCount: true },
  { id: 'payments', label: 'תשלומים', icon: 'i-card' },
  { id: 'history', label: 'מידע', icon: 'i-history' }
];

/**
 * המעטפת של כרטיס ההזמנה בעיצוב "אריג": page-head עם פעולות, כרטיס סיכום
 * (לקוח + סטטוס + אירוע + סריקה מהירה), לשוניות ותוכן טאב אחד בכל רגע.
 * כל הטאבים נשארים mounted (tab-panel לא-active מוסתר ב-CSS בלבד) כדי לשמור
 * על סטייט פנימי של המנהלים הקיימים (פריטים/תשלומים).
 */
export default function ModernOrderCard({
  order,
  items,
  activeTab,
  onTabChange,
  totalRequired,
  totalPaid,
  openedDebt,
  saving,
  saveMessage,
  hasUnsavedChanges,
  isLocked,
  isPastEvent,
  onUnlock,
  onLock,
  onSave,
  onCancelChanges,
  onDelete,
  onExit,
  onToggleSignature,
  onOrderUpdate,
  onQuickScan,
  onWalletClick,
  tabContents,
  // draft_orders_show_as_deleted (SystemSetting) - see lib/orderStatus.js calculateOrderStatus;
  // when on, an autosaved-but-never-finished order shows this badge as "מחוק" instead of "טיוטה".
  draftsAsDeleted = false
}) {
  const [scanValue, setScanValue] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const activeItems = (items || []).filter(i => !i.isDeleted);
  const debt = totalRequired - totalPaid;
  // שמירה לא תבקש אישור מנהל אם החוב זהה לזה שהיה כשהכרטיס נטען (ר' handleSave בעמוד) - התג
  // מציג את אותה הבחנה כדי לא להבהיל על אישור שלא באמת ידרש בלחיצה על שמירה.
  const debtUnchangedSinceOpen = openedDebt !== undefined && openedDebt !== null
    && Math.round(debt * 100) === Math.round(openedDebt * 100);
  const saveNeedsApproval = debt > 0 && !debtUnchangedSinceOpen;

  const orderStatus = calculateOrderStatus(order, { draftsAsDeleted });

  const customer = order.customer;
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') : 'לא נבחר לקוח';
  const initials = customer ? (`${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` || '?') : '?';

  const eventDateLabel = (order.isAbroad || order.isWeekdayEvent)
    ? (order.fromDate ? `${getHebrewDateString(order.fromDate)} — ${getHebrewDateString(order.toDate || order.returnDate)}` : 'אירוע חו"ל')
    : (order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'ללא תאריך אירוע'));

  const updatedLabel = order.updatedAt
    ? `עודכן: ${new Date(order.updatedAt).toLocaleDateString('he-IL')} · ${new Date(order.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const isErrorMsg = saveMessage && (saveMessage.includes('שגיאה') || saveMessage.includes('בוטלה'));

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    setScanValue('');
    onQuickScan(code);
  };

  const handleLockClick = async () => {
    if (isLocked) {
      setShowUnlockModal(true);
    } else if (onLock) {
      const msg = 'האם ברצונך לנעול מחדש את ההזמנה?';
      const confirmed = window.customConfirm ? await window.customConfirm(msg) : window.confirm(msg);
      if (confirmed) onLock();
    }
  };

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>הזמנה #{order.orderId}</h1>
          {/* תג עם טקסט ולא אייקון בודד — איקס עירום ליד הכותרת נראה כמו כפתור סגירה
              ולא מסביר את עצמו; התג מקביל לזה שבטאב "פרטים כלליים" */}
          <button
            type="button"
            className={`badge ${order.hasSignedRegulations ? 'badge-success' : 'badge-warning'}`}
            style={{ border: 'none', cursor: 'pointer' }}
            onClick={onToggleSignature}
            title={order.hasSignedRegulations ? 'חתם על תקנון השכרה — לחץ לשינוי' : 'לא חתם על תקנון — לחץ לשינוי'}
          >
            <svg className="icon"><use href={order.hasSignedRegulations ? '#i-check-circle' : '#i-x-circle'} /></svg>
            {order.hasSignedRegulations ? 'חתם על תקנון' : 'לא חתם על תקנון'}
          </button>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className={debt > 0 ? 'btn btn-danger-ghost' : debt < 0 ? 'btn btn-secondary' : 'btn btn-secondary btn-icon-only'}
            style={debt < 0 ? { color: 'var(--success)' } : undefined}
            title={debt > 0
              ? `יתרת חוב: ₪${debt.toLocaleString('he-IL')} — לחץ למעבר לתשלומים`
              : debt < 0 ? `יתרת זכות: ₪${Math.abs(debt).toLocaleString('he-IL')}` : 'שולם במלואו'}
            onClick={() => (onWalletClick ? onWalletClick() : onTabChange('payments'))}
          >
            <svg className="icon"><use href="#i-wallet" /></svg>
            {debt !== 0 && `₪${Math.abs(debt).toLocaleString('he-IL')}`}
          </button>

          {isPastEvent && (
            <button
              type="button"
              className={isLocked ? 'btn btn-danger-ghost btn-icon-only' : 'btn btn-secondary btn-icon-only'}
              title={isLocked
                ? 'הזמנה נעולה — תאריך האירוע עבר. ניתן להחזיר בלבד; השכרה ועריכה חסומות. לחץ לשחרור באישור מנהל'
                : 'ההזמנה שוחררה לעריכה. לחץ לנעילה מחדש'}
              onClick={handleLockClick}
            >
              <svg className="icon"><use href="#i-lock" /></svg>
            </button>
          )}

          <OrderPrintMenu
            order={order}
            onOrderUpdate={onOrderUpdate}
            triggerClassName="btn btn-secondary btn-icon-only"
            triggerTitle="הדפסה / מייל"
          />

          <button type="button" className="btn btn-ghost btn-icon-only" style={{ color: 'var(--danger)' }} title="מחיקת הזמנה" onClick={onDelete}>
            <svg className="icon"><use href="#i-trash" /></svg>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-icon-only"
            title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'}
            onClick={onCancelChanges}
            disabled={!hasUnsavedChanges || saving}
          >
            <svg className="icon"><use href="#i-refresh" /></svg>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            title={saveNeedsApproval ? `שמירה עם יתרת חוב של ₪${debt.toLocaleString('he-IL')} תדרוש אישור מנהל` : 'שמור שינויים'}
            onClick={() => onSave()}
            disabled={saving}
          >
            {saving ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-check" /></svg>}
            שמור שינויים
            {!saving && saveNeedsApproval && (
              <span className="badge badge-danger" style={{ marginInlineStart: '4px' }}>
                <svg className="icon" style={{ width: '10px', height: '10px' }}><use href="#i-shield" /></svg>
                ₪{debt.toLocaleString('he-IL')}
              </span>
            )}
          </button>

          <button type="button" className="btn btn-ghost" title="שמירה וחזרה לרשימת ההזמנות" onClick={() => onExit()}>
            <svg className="icon"><use href="#i-arrow-end" /></svg>
            חזור
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`callout ${isErrorMsg ? 'callout-danger' : 'callout-success'}`} style={{ marginBottom: '18px' }}>
          <svg className="icon"><use href={isErrorMsg ? '#i-alert-circle' : '#i-check-circle'} /></svg>
          {saveMessage}
        </div>
      )}

      {/* כרטיס סיכום: לקוח, סטטוס, אירוע, סריקה מהירה */}
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div className="avatar lg">{initials}</div>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '16px' }}>{customerName}</strong>
            <span className={`badge ${getStatusBadgeClass(orderStatus)}`}>
              <svg className="icon"><use href="#i-clock" /></svg>
              {orderStatus}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '5px', fontSize: '13px', color: 'var(--text-2)' }}>
            {customer?.phone1 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg className="icon" style={{ width: '13px', height: '13px', color: 'var(--text-3)' }}><use href="#i-phone" /></svg>
                <span style={{ direction: 'ltr' }}>{customer.phone1}</span>
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg className="icon" style={{ width: '13px', height: '13px', color: 'var(--text-3)' }}><use href="#i-calendar" /></svg>
              {eventDateLabel}
            </span>
            {updatedLabel && <span style={{ color: 'var(--text-3)' }}>{updatedLabel}</span>}
          </div>
        </div>
        <div style={{ maxWidth: '270px', width: '100%' }}>
          <form className="input-icon-wrap" style={{ width: '100%' }} onSubmit={handleScanSubmit}>
            <svg className="icon"><use href="#i-tag" /></svg>
            <input
              type="text"
              className="input"
              value={scanValue}
              onChange={e => setScanValue(e.target.value)}
              placeholder="סריקה מהירה — השכרה / החזרה"
            />
          </form>
          {/* השדה מתאפס ונשאר בפוקוס אחרי כל סריקה (handleScanSubmit) - אפשר
              לסרוק ברקוד אחרי ברקוד ברצף בלי ללחוץ בכל פריט בנפרד על "השכרה". */}
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
            אפשר לסרוק כאן ברקוד אחרי ברקוד ברצף — כל שמלה תושכר/תוחזר אוטומטית בלי לפתוח אותה בנפרד למטה
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }}
            onClick={() => onTabChange(tab.id)}
          >
            <svg className="icon"><use href={`#${tab.icon}`} /></svg>
            {tab.label}
            {tab.withCount && <span className="badge badge-neutral" style={{ marginInlineStart: '4px' }}>{activeItems.length}</span>}
          </button>
        ))}
      </div>

      {TABS.map(tab => (
        <div key={tab.id} className={`tab-panel${activeTab === tab.id ? ' active' : ''}`}>
          {tabContents[tab.id]}
        </div>
      ))}

      {/* מודל אישור שחרור נעילה (הזמנה שתאריך האירוע שלה עבר) */}
      {showUnlockModal && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget && !unlocking) setShowUnlockModal(false); }}
        >
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon-circle" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>
              <svg className="icon"><use href="#i-lock" /></svg>
            </div>
            <h3>הזמנה נעולה</h3>
            <p>
              תאריך האירוע של הזמנה זו עבר, ולכן השכרה, עריכה ומחיקה של פריטים חסומות.
              <br />
              החזרה מהשכרה, תשלומים וזיכויים זמינים כרגיל.
              <br />
              <strong>שחרור מלא לעריכה דורש אישור מנהל.</strong>
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" disabled={unlocking} onClick={() => setShowUnlockModal(false)}>ביטול</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={unlocking}
                onClick={async () => {
                  setUnlocking(true);
                  try {
                    await onUnlock();
                  } finally {
                    setUnlocking(false);
                    setShowUnlockModal(false);
                  }
                }}
              >
                {unlocking ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-lock" /></svg>}
                {unlocking ? 'מאמת...' : 'שחרר באישור מנהל'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
