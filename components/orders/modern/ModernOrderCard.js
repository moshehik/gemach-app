'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  X, Info, Package, RefreshCcw, CreditCard, History, User, Phone, Calendar,
  ScanLine, Wallet, PenTool, Check, Printer, Trash2, Save, Undo2, ArrowRight,
  FileText, ClipboardList, Mail, Clock, Lock, LockOpen, ShieldAlert
} from 'lucide-react';
import { calculateOrderStatus, getStatusColor } from '../../../lib/orderStatus';
import { getHebrewDateString } from '../../../lib/hebrewDate';

const TAB_META = {
  details: { title: 'פרטים כלליים' },
  items: { title: 'פירוט פריטים בהזמנה' },
  payments: { title: 'תשלומים' },
  history: { title: 'מידע והיסטוריה' }
};

/**
 * המעטפת של כרטיס ההזמנה בעיצוב המודרני: סיידבר זהב עם טאבים, טופ-בר פעולות,
 * ותוכן של טאב אחד בכל רגע. כל הטאבים נשארים mounted (display:none) כדי לשמור
 * על סטייט פנימי של המנהלים הקיימים.
 */
export default function ModernOrderCard({
  order,
  items,
  activeTab,
  onTabChange,
  totalRequired,
  totalPaid,
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
  onPrintButtonClick,
  printMenuOpen,
  onClosePrintMenu,
  onPrint,
  onSendEmail,
  onShowEmployees,
  onQuickScan,
  onWalletClick,
  layoutToggle,
  tabContents
}) {
  const [scanValue, setScanValue] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const printWrapRef = useRef(null);

  // סגירת תפריט ההדפסה בלחיצה מחוץ לו
  useEffect(() => {
    if (!printMenuOpen) return;
    const close = (e) => {
      if (printWrapRef.current && !printWrapRef.current.contains(e.target)) onClosePrintMenu();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [printMenuOpen, onClosePrintMenu]);

  const activeItems = (items || []).filter(i => !i.isDeleted);
  const debt = totalRequired - totalPaid;

  const orderStatus = calculateOrderStatus(order);
  const statusColor = getStatusColor(orderStatus);

  const customerName = order.customer
    ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ')
    : 'לא נבחר לקוח';

  const eventDateLabel = (order.isAbroad || order.isWeekdayEvent)
    ? (order.fromDate ? `${getHebrewDateString(order.fromDate)} — ${getHebrewDateString(order.toDate || order.returnDate)}` : 'אירוע חו"ל')
    : (order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'ללא תאריך אירוע'));

  const updatedLabel = order.updatedAt
    ? `עודכן: ${getHebrewDateString(order.updatedAt)} · ${new Date(order.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const meta = TAB_META[activeTab] || { title: '' };
  const hint = activeTab === 'details' ? updatedLabel : (meta.hint || '');

  const handleScanSubmit = (e) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    setScanValue('');
    onQuickScan(code);
  };

  const tabs = [
    { id: 'details', label: 'פרטים כלליים', icon: Info },
    { id: 'items', label: 'פריטים והשכרות', icon: Package, count: activeItems.length },
    { id: 'payments', label: 'תשלומים', icon: CreditCard },
    { id: 'history', label: 'מידע', icon: History }
  ];

  return (
    <div className="moc moc-page-overlay">
      <div className="moc-page-wrap">
      <div className="moc-top-strip">
        <div className="moc-breadcrumb">
          גמ"ח שמלות &raquo; <Link href="/orders">הזמנות</Link> &raquo; <strong>הזמנה #{order.orderId}</strong>
        </div>
      </div>

      <div className="moc-container" style={{ position: 'relative' }}>
        {/* ============ סיידבר ============ */}
        <aside className="moc-sidebar">
          <div>
            <div className="moc-sidebar-top-row">
              <button className="moc-icon-btn-ghost" title="סגור כרטיס וחזור" onClick={() => onExit()}>
                <X size={16} />
              </button>
              <div className="moc-order-id-group">
                <span className="moc-order-num">הזמנה #{order.orderId}</span>
                <span className="moc-v-divider" />
                <span className="moc-badge" style={{ background: statusColor.bg, color: statusColor.text }}>
                  <Clock size={13} /> {orderStatus}
                </span>
              </div>
            </div>

            <div className="moc-sidebar-info-panel">
              <div className="moc-sip-row"><User size={15} /><strong>{customerName}</strong></div>
              {order.customer?.phone1 && (
                <div className="moc-sip-row"><Phone size={15} /><span style={{ direction: 'ltr' }}>{order.customer.phone1}</span></div>
              )}
              <div className="moc-sip-row"><Calendar size={15} /><span>{eventDateLabel}</span></div>
            </div>
          </div>

          <div>
            <hr className="moc-sidebar-divider" />
            <nav className="moc-tab-nav">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={`moc-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                  >
                    <Icon size={17} /> {tab.label}
                    {tab.count !== undefined && <span className="moc-count">{tab.count}</span>}
                  </button>
                );
              })}
            </nav>

            <form className="moc-search-wrapper" style={{ marginTop: '16px' }} onSubmit={handleScanSubmit}>
              <ScanLine size={17} />
              <input
                type="text"
                className="moc-search-input"
                value={scanValue}
                onChange={e => setScanValue(e.target.value)}
                placeholder="סריקה מהירה — השכרה / החזרה"
              />
            </form>
          </div>
        </aside>

        {/* ============ תוכן ============ */}
        <main className="moc-content-area">
          <div className="moc-content-topbar">
            <div className="moc-topbar-title-block">
              <h2>{meta.title}</h2>
              {hint && <span className="moc-hint" title={hint}>{hint}</span>}
              {saveMessage && (
                <span className={`moc-save-msg ${saveMessage.includes('שגיאה') || saveMessage.includes('בוטלה') ? 'err' : 'ok'}`} title={saveMessage}>
                  {saveMessage}
                </span>
              )}
            </div>

            <div className="moc-topbar-actions">
              {/* נעילת הזמנה שתאריכה עבר — הכל גלוי, פעולות פריטים חסומות עד שחרור באישור מנהל */}
              {isPastEvent && (
                <button
                  className={`moc-icon-btn-soft ${isLocked ? 'lock-on' : 'lock-off'}`}
                  title={isLocked
                    ? 'הזמנה נעולה — תאריך האירוע עבר. ניתן להחזיר בלבד; השכרה ועריכה חסומות. לחץ לשחרור באישור מנהל'
                    : 'ההזמנה שוחררה לעריכה. לחץ לנעילה מחדש'}
                  onClick={async () => {
                    if (isLocked) {
                      setShowUnlockModal(true);
                    } else if (onLock) {
                      const msg = 'האם ברצונך לנעול מחדש את ההזמנה?';
                      const confirmed = window.customConfirm ? await window.customConfirm(msg) : window.confirm(msg);
                      if (confirmed) onLock();
                    }
                  }}
                >
                  {isLocked ? <Lock size={18} /> : <LockOpen size={18} />}
                </button>
              )}

              <button
                className={`moc-icon-btn-soft money ${debt > 0 ? 'debt' : debt < 0 ? 'credit' : ''}`}
                title={debt > 0 ? `יתרת חוב: ₪${debt.toLocaleString('he-IL')} — לחץ לתשלום בנדרים פלוס` : debt < 0 ? `יתרת זכות: ₪${Math.abs(debt).toLocaleString('he-IL')}` : 'שולם במלואו'}
                onClick={() => (onWalletClick ? onWalletClick() : onTabChange('payments'))}
              >
                <Wallet size={18} />
                {debt !== 0 && (
                  <span className="moc-amt-badge">₪{Math.abs(debt).toLocaleString('he-IL')}</span>
                )}
              </button>

              <div className="moc-topbar-sep" />

              <button
                className={`moc-icon-btn-soft sig ${order.hasSignedRegulations ? 'yes' : 'no'}`}
                title={order.hasSignedRegulations ? 'חתם על תקנון השכרה — לחץ לשינוי' : 'לא חתם על תקנון — לחץ לשינוי'}
                onClick={onToggleSignature}
              >
                <PenTool size={17} />
                <span className="moc-mini-badge">
                  {order.hasSignedRegulations ? <Check size={8} /> : <X size={8} />}
                </span>
              </button>

              <div style={{ position: 'relative' }} ref={printWrapRef}>
                <button className="moc-icon-btn-soft purple" title="הדפסה / מייל" onClick={onPrintButtonClick}>
                  <Printer size={18} />
                </button>
                {printMenuOpen && (
                  <div className="moc-dropdown-menu">
                    <div className="moc-dropdown-item" onClick={() => onPrint('order')}><FileText size={15} /> הזמנה</div>
                    <div className="moc-dropdown-item" onClick={() => onPrint('rental')}><ClipboardList size={15} /> השכרה</div>
                    <div className="moc-dropdown-item" onClick={() => onSendEmail('order')}><Mail size={15} /> מייל הזמנה</div>
                    <div className="moc-dropdown-item" onClick={() => onSendEmail('rental')}><Mail size={15} /> מייל השכרה</div>
                  </div>
                )}
              </div>

              <button className="moc-icon-btn-soft danger" title="מחיקת הזמנה" onClick={onDelete}>
                <Trash2 size={18} />
              </button>

              <div className="moc-topbar-sep" />

              {/* שני מצבים ברורים: שמירה רגילה מול שמירה שתעצור לבקשת אישור מנהל בגלל יתרת
                  חוב חדשה (ר' handleSave - הבדיקה totalRequired-totalPaid>0). needs-approval
                  משנה את גוון האייקון, מוסיף תג מגן ותג-סכום כדי שהמשתמש ידע מראש, בלי
                  לשנות שום דבר בלוגיקת האישור עצמה. */}
              <button
                className={`moc-icon-btn-soft primary save-btn ${debt > 0 ? 'needs-approval' : ''}`}
                title={debt > 0
                  ? `שמירה עם יתרת חוב של ₪${debt.toLocaleString('he-IL')} תדרוש אישור מנהל`
                  : 'שמור שינויים'}
                onClick={() => onSave()}
                disabled={saving}
              >
                {saving ? <span className="moc-spinner" /> : <Save size={18} />}
                {!saving && debt > 0 && (
                  <>
                    <span className="moc-mini-badge"><ShieldAlert size={9} /></span>
                    <span className="moc-amt-badge">₪{debt.toLocaleString('he-IL')}</span>
                  </>
                )}
              </button>

              <button
                className="moc-icon-btn-soft warn"
                title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'}
                onClick={onCancelChanges}
                disabled={!hasUnsavedChanges || saving}
              >
                <Undo2 size={18} />
              </button>

              <button className="moc-icon-btn-soft exit" title="שמירה וחזרה" onClick={() => onExit()}>
                <ArrowRight size={16} /> חזור
              </button>
            </div>
          </div>

          <div>
            {tabs.map(tab => (
              <section key={tab.id} className={`moc-content-section ${activeTab === tab.id ? 'active' : ''}`}>
                {tabContents[tab.id]}
              </section>
            ))}
          </div>
        </main>
      </div>
      </div>

      {/* מודל שחרור נעילה באישור מנהל */}
      {showUnlockModal && (
        <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !unlocking) setShowUnlockModal(false); }}>
          <div className="moc moc-modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="moc-modal-body" style={{ paddingTop: '28px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'var(--moc-danger-bg)', color: 'var(--moc-danger-text)' }}>
                <Lock size={26} />
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>הזמנה נעולה</h3>
              <p style={{ color: 'var(--moc-text-muted)', margin: 0, lineHeight: 1.7 }}>
                תאריך האירוע של הזמנה זו עבר, ולכן השכרה, עריכה ומחיקה של פריטים חסומות.
                <br />
                החזרה מהשכרה, תשלומים וזיכויים זמינים כרגיל.
                <br />
                <strong>שחרור מלא לעריכה דורש אישור מנהל.</strong>
              </p>
            </div>
            <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
              <button className="moc-btn moc-btn-outline" disabled={unlocking} onClick={() => setShowUnlockModal(false)}>ביטול</button>
              <button
                className="moc-btn moc-btn-gold"
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
                {unlocking ? <><span className="moc-spinner" /> מאמת...</> : <><LockOpen size={15} /> שחרר באישור מנהל</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
