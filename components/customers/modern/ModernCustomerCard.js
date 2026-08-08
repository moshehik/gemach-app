'use client';

import React from 'react';

const TABS = [
  { id: 'details', label: 'פרטים אישיים', icon: 'i-id' },
  { id: 'orders', label: 'הזמנות', icon: 'i-bag', withCount: true },
  { id: 'payments', label: 'תשלומים', icon: 'i-card' },
  { id: 'refunds', label: 'זיכויים ופרטי בנק', icon: 'i-refresh' },
  { id: 'history', label: 'היסטוריה', icon: 'i-history' }
];

/**
 * המעטפת של כרטיס הלקוח: כותרת עמוד עם פעולות, כרטיס תקציר (אווטאר + פרטי קשר),
 * ולשוניות בעיצוב מערכת העיצוב "אריג" (page-head / card / tabs / tab-panel).
 * כל הטאבים נשארים mounted (tab-panel לא-active מוסתר ב-CSS בלבד) כדי לשמור על
 * סטייט פנימי של הטפסים/הטבלאות בכל טאב.
 */
export default function ModernCustomerCard({
  customer, activeTab, onTabChange, onExit, tabContents,
  saving, onSave, hasUnsavedChanges, onCancelChanges, onSendEmail
}) {
  const ordersCount = (customer.orders || []).length;

  const customerName = [customer.firstName, customer.lastName]
    .filter(n => n && String(n).toLowerCase() !== 'null')
    .join(' ') || 'לקוח ללא שם';
  const address = [customer.street && `${customer.street} ${customer.houseNum || ''}`.trim(), customer.city].filter(Boolean).join(', ');

  const updatedLabel = customer.updatedAt
    ? `עודכן לאחרונה: ${new Date(customer.updatedAt).toLocaleDateString('he-IL')} · ${new Date(customer.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` || '?';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{customerName}</h1>
          <div className="page-desc">
            לקוח #{customer.legacyId || customer.id} · {ordersCount} הזמנות
            {updatedLabel && ` · ${updatedLabel}`}
          </div>
        </div>
        <div className="page-actions">
          {onSave && (
            <button type="button" className="btn btn-primary" title="שמירת שינויים" onClick={(e) => onSave(e)} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-check" /></svg>}
              שמירת שינויים
            </button>
          )}
          {onCancelChanges && (
            <button type="button" className="btn btn-secondary" title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'} onClick={onCancelChanges} disabled={!hasUnsavedChanges || saving}>
              <svg className="icon"><use href="#i-refresh" /></svg>
              ביטול שינויים
            </button>
          )}
          {onSendEmail && (
            <button type="button" className="btn btn-secondary" title="שליחת מייל ללקוח" onClick={onSendEmail}>
              <svg className="icon"><use href="#i-mail" /></svg>
              שליחת מייל
            </button>
          )}
          <button type="button" className="btn btn-ghost" title="חזור לרשימת הלקוחות" onClick={onExit}>
            <svg className="icon"><use href="#i-arrow-end" /></svg>
            חזור
          </button>
        </div>
      </div>

      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div className="avatar lg">{initials}</div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800 }}>{customerName}</div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '6px', color: 'var(--text-2)', fontSize: '13px' }}>
            {customer.phone1 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg className="icon"><use href="#i-phone" /></svg><span style={{ direction: 'ltr' }}>{customer.phone1}</span>
              </span>
            )}
            {customer.email && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg className="icon"><use href="#i-mail" /></svg><span style={{ direction: 'ltr' }}>{customer.email}</span>
              </span>
            )}
            {address && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg className="icon"><use href="#i-pin" /></svg>{address}
              </span>
            )}
          </div>
        </div>
        <span className="badge badge-primary"><svg className="icon"><use href="#i-bag" /></svg>{ordersCount} הזמנות</span>
      </div>

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
            {tab.label}
            {tab.withCount && <span className="badge badge-neutral">{ordersCount}</span>}
          </button>
        ))}
      </div>

      {TABS.map(tab => (
        <div key={tab.id} className={`tab-panel ${activeTab === tab.id ? 'active' : ''}`}>
          {tabContents[tab.id]}
        </div>
      ))}
    </>
  );
}
