'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X, Info, Package, RefreshCcw, CreditCard, History, User, Phone, Calendar,
  ScanLine, Wallet, PenTool, Check, Printer, Trash2, Save, Undo2, ArrowRight,
  FileText, ClipboardList, Mail, Users, Clock
} from 'lucide-react';
import { calculateOrderStatus, getStatusColor, calculatePaymentStatus, getPaymentStatusColor } from '../../../lib/orderStatus';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import modernOrderCss from './modernOrderStyles';

const TAB_META = {
  details: { title: 'פרטים כלליים' },
  items: { title: 'פירוט פריטים בהזמנה' },
  rentals: { title: 'השכרות והחזרות', hint: 'הרשימה מתעדכנת מיד לאחר כל סריקה' },
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
  onUnlock,
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
  layoutToggle,
  tabContents
}) {
  const [scanValue, setScanValue] = useState('');
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
  const paymentStatus = calculatePaymentStatus(totalRequired, totalPaid);
  const paymentColor = getPaymentStatusColor(paymentStatus);

  const customerName = order.customer
    ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ')
    : 'לא נבחר לקוח';

  const eventDateLabel = (order.isAbroad || order.isWeekdayEvent)
    ? (order.fromDate ? `${getHebrewDateString(order.fromDate)} — ${getHebrewDateString(order.toDate || order.returnDate)}` : 'אירוע חו"ל')
    : (order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'ללא תאריך אירוע'));

  const updatedLabel = order.updatedAt
    ? `עודכן לאחרונה: ${new Date(order.updatedAt).toLocaleDateString('he-IL')} ${new Date(order.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
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
    { id: 'items', label: 'פריטים', icon: Package, count: activeItems.length },
    { id: 'rentals', label: 'השכרות והחזרות', icon: RefreshCcw, count: activeItems.length },
    { id: 'payments', label: 'תשלומים', icon: CreditCard },
    { id: 'history', label: 'מידע', icon: History }
  ];

  return (
    <div className="moc">
      <style>{modernOrderCss}</style>

      <div className="moc-container" style={{ position: 'relative' }}>
        {isLocked && (
          <div className="moc-lock-overlay">
            <button
              onClick={onUnlock}
              style={{
                position: 'sticky', top: '90px', marginTop: '2rem', padding: '1rem 2.5rem',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none',
                borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)'
              }}
            >
              🔒 הזמנה נעולה - לחץ לשחרור בעזרת סיסמת מנהל
            </button>
          </div>
        )}

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
                <span className="moc-badge" style={{ background: paymentColor.bg, color: paymentColor.text }}>
                  {paymentStatus}
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
              {hint && <span className="moc-hint">{hint}</span>}
            </div>

            <div className="moc-topbar-actions">
              {saveMessage && (
                <span className={`moc-save-msg ${saveMessage.includes('שגיאה') ? 'err' : 'ok'}`}>{saveMessage}</span>
              )}

              {layoutToggle}

              <div className="moc-topbar-sep" />

              <button
                className={`moc-icon-btn-soft money ${debt > 0 ? 'debt' : debt < 0 ? 'credit' : ''}`}
                title={debt > 0 ? `יתרת חוב: ₪${debt.toLocaleString('he-IL')}` : debt < 0 ? `יתרת זכות: ₪${Math.abs(debt).toLocaleString('he-IL')}` : 'שולם במלואו'}
                onClick={() => onTabChange('payments')}
              >
                <Wallet size={18} />
                {debt !== 0 && (
                  <span className="moc-amt-badge">₪{Math.abs(debt).toLocaleString('he-IL')}</span>
                )}
              </button>

              <button
                className={`moc-icon-btn-soft sig ${order.hasSignedRegulations ? 'yes' : 'no'}`}
                title={order.hasSignedRegulations ? 'חתם על תקנון השכרה — לחץ לשינוי' : 'לא חתם על תקנון — לחץ לשינוי'}
                onClick={onToggleSignature}
                disabled={isLocked}
              >
                <PenTool size={17} />
                <span className="moc-mini-badge">
                  {order.hasSignedRegulations ? <Check size={8} /> : <X size={8} />}
                </span>
              </button>

              <button className="moc-icon-btn-soft orange" title="עובדים פעילים" onClick={onShowEmployees}>
                <Users size={18} />
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

              <button
                className="moc-icon-btn-soft primary"
                title={isLocked ? 'הזמנה נעולה' : 'שמור שינויים'}
                onClick={() => onSave()}
                disabled={saving || isLocked}
              >
                {saving
                  ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(181,149,47,0.3)', borderTop: '2px solid #b5952f', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  : <Save size={18} />}
              </button>

              <button
                className="moc-icon-btn-soft warn"
                title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'}
                onClick={onCancelChanges}
                disabled={!hasUnsavedChanges || saving || isLocked}
              >
                <Undo2 size={18} />
              </button>

              <button className="moc-icon-btn-soft exit" title="שמירה וחזרה" onClick={() => onExit()}>
                <ArrowRight size={16} /> חזור
              </button>
            </div>
          </div>

          <div style={isLocked ? { opacity: 0.7, pointerEvents: 'none' } : undefined}>
            {tabs.map(tab => (
              <section key={tab.id} className={`moc-content-section ${activeTab === tab.id ? 'active' : ''}`}>
                {tabContents[tab.id]}
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
