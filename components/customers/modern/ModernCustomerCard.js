'use client';

import React from 'react';
import Link from 'next/link';
import {
  X, IdCard, ClipboardList, CreditCard, RefreshCcw, History,
  User, Phone, Mail, MapPin, ArrowRight, Save, Undo2
} from 'lucide-react';

const TAB_META = {
  details: { title: 'פרטים אישיים' },
  orders: { title: 'הזמנות' },
  payments: { title: 'תשלומים' },
  refunds: { title: 'זיכויים ופרטי בנק' },
  history: { title: 'היסטוריה' }
};

/**
 * המעטפת של כרטיס הלקוח בעיצוב המודרני — פורט של אותה שיטת עיצוב כמו ModernOrderCard
 * (סיידבר זהב עם טאבים, טופ-בר כותרת, ותוכן טאב אחד בכל רגע). כל הטאבים נשארים
 * mounted (display:none) כדי לשמור על סטייט פנימי של הטפסים/הטבלאות.
 */
export default function ModernCustomerCard({ 
  customer, activeTab, onTabChange, onExit, tabContents,
  saving, onSave, hasUnsavedChanges, onCancelChanges, onSendEmail 
}) {
  const ordersCount = (customer.orders || []).length;

  const customerName = [customer.firstName, customer.lastName]
    .filter(n => n && String(n).toLowerCase() !== 'null')
    .join(' ') || 'לקוח ללא שם';
  const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` || '?';
  const address = [customer.street && `${customer.street} ${customer.houseNum || ''}`.trim(), customer.city].filter(Boolean).join(', ');

  const updatedLabel = customer.updatedAt
    ? `עודכן לאחרונה: ${new Date(customer.updatedAt).toLocaleDateString('he-IL')} · ${new Date(customer.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const meta = TAB_META[activeTab] || { title: '' };
  const hint = activeTab === 'details' ? updatedLabel : '';

  const tabs = [
    { id: 'details', label: 'פרטים אישיים', icon: IdCard },
    { id: 'orders', label: 'הזמנות', icon: ClipboardList, count: ordersCount },
    { id: 'payments', label: 'תשלומים', icon: CreditCard },
    { id: 'refunds', label: 'זיכויים ופרטי בנק', icon: RefreshCcw },
    { id: 'history', label: 'היסטוריה', icon: History }
  ];

  return (
    <div className="moc moc-page-overlay">
      <div className="moc-page-wrap">
        <div className="moc-top-strip">
          <div className="moc-breadcrumb">
            גמ"ח שמלות &raquo; <Link href="/customers">לקוחות</Link> &raquo; <strong>{customerName}</strong>
          </div>
        </div>

        <div className="moc-container">
          {/* ============ סיידבר ============ */}
          <aside className="moc-sidebar">
            <div>
              <div className="moc-sidebar-top-row">
                <button className="moc-icon-btn-ghost" title="סגור כרטיס וחזור" onClick={onExit}>
                  <X size={16} />
                </button>
                <div className="moc-order-id-group">
                  <span className="moc-order-num">לקוח #{customer.legacyId || customer.id}</span>
                  <span className="moc-v-divider" />
                  <span className="moc-badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                    <ClipboardList size={13} /> {ordersCount} הזמנות
                  </span>
                </div>
              </div>

              <div className="moc-sidebar-info-panel">
                <div className="moc-sip-row"><User size={15} /><strong>{customerName}</strong></div>
                {customer.phone1 && (
                  <div className="moc-sip-row"><Phone size={15} /><span style={{ direction: 'ltr' }}>{customer.phone1}</span></div>
                )}
                {customer.email && (
                  <div className="moc-sip-row"><Mail size={15} /><span style={{ direction: 'ltr' }}>{customer.email}</span></div>
                )}
                {address && (
                  <div className="moc-sip-row"><MapPin size={15} /><span>{address}</span></div>
                )}
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
            </div>
          </aside>

          {/* ============ תוכן ============ */}
          <main className="moc-content-area">
            <div className="moc-content-topbar">
              <div className="moc-topbar-title-block">
                <h2>{meta.title}</h2>
                {hint && <span className="moc-hint" title={hint}>{hint}</span>}
              </div>

              <div className="moc-topbar-actions">
                {onSave && (
                  <button
                    className="moc-icon-btn-soft primary"
                    title="שמור שינויים"
                    onClick={(e) => onSave(e)}
                    disabled={saving}
                  >
                    {saving ? <span className="moc-spinner" /> : <Save size={18} />}
                  </button>
                )}

                {onCancelChanges && (
                  <button
                    className="moc-icon-btn-soft warn"
                    title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'}
                    onClick={onCancelChanges}
                    disabled={!hasUnsavedChanges || saving}
                  >
                    <Undo2 size={18} />
                  </button>
                )}

                <div className="moc-topbar-sep" />

                {onSendEmail && (
                  <button 
                    className="moc-icon-btn-soft purple" 
                    title="שלח מייל ללקוח" 
                    onClick={onSendEmail}
                  >
                    <Mail size={18} />
                  </button>
                )}

                <button className="moc-icon-btn-soft exit" title="חזור" onClick={onExit}>
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
    </div>
  );
}
