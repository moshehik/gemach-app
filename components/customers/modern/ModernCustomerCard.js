'use client';

import React from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { V3Page, Card, Btn, Chip, Row, Rows, Tabs, Tip } from '@/app/v3/ui/components';

const TABS = [
  { id: 'details', label: 'פרטים אישיים', icon: 'id' },
  { id: 'orders', label: 'הזמנות', icon: 'bag', withCount: true },
  { id: 'payments', label: 'תשלומים', icon: 'card' },
  { id: 'refunds', label: 'זיכויים ובנק', icon: 'refresh' },
  { id: 'history', label: 'היסטוריה', icon: 'history' }
];

/**
 * מעטפת כרטיס הלקוח (תבנית כרטיס-פרט, סקיצה B): כרטיס מסגרת עם כותרת, שורות נתונים,
 * פעולות ולשוניות. כל הלשוניות נשארות mounted (ה-panel הלא-פעיל מוסתר בלבד) כדי לשמור
 * על state פנימי של הטפסים והטבלאות בכל לשונית.
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
    ? `${getHebrewDateString(customer.updatedAt)} · ${new Date(customer.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}` || '?';

  return (
    <V3Page>
      <Card variant="cust" as="header">
        <div className="v3-hero">
          <div className="v3-hero__ico" aria-hidden="true"><b>{initials}</b></div>
          <div className="v3-stack">
            <h1 className="v3-h1">{customerName}</h1>
            <div className="v3-cluster">
              <Chip variant="info" icon="id">לקוח <bdi>{customer.legacyId || customer.id}</bdi></Chip>
              <Chip icon="bag"><bdi>{ordersCount}</bdi> הזמנות</Chip>
              {customer.isBlocked && <Chip variant="attn" icon="alert-tri">חסום להזמנות</Chip>}
              <Tip>הכפתורים למטה שומרים או מבטלים שינויים בכל לשוניות הכרטיס.</Tip>
            </div>
          </div>
        </div>

        <Rows>
          {customer.phone1 && <Row label="טלפון" icon="phone"><bdi>{customer.phone1}</bdi></Row>}
          {customer.email && <Row label="דוא&quot;ל" icon="mail"><bdi>{customer.email}</bdi></Row>}
          {address && <Row label="כתובת" icon="pin">{address}</Row>}
          {updatedLabel && <Row label="עודכן לאחרונה" icon="clock"><bdi>{updatedLabel}</bdi></Row>}
        </Rows>

        <div className="v3-cluster">
          {onSave && (
            <Btn variant="primary" icon="check" title="שמירת שינויים" onClick={(e) => onSave(e)} loading={saving}>
              שמירת שינויים
            </Btn>
          )}
          {onCancelChanges && (
            <Btn icon="refresh" title={hasUnsavedChanges ? 'ביטול שינויים שלא נשמרו' : 'אין שינויים לביטול'} onClick={onCancelChanges} disabled={!hasUnsavedChanges || saving}>
              ביטול שינויים
            </Btn>
          )}
          {onSendEmail && (
            <Btn icon="mail" title="שליחת מייל ללקוח" onClick={onSendEmail}>
              שליחת מייל
            </Btn>
          )}
          <Btn variant="quiet" icon="back" title="חזור לרשימת הלקוחות" onClick={onExit}>
            חזרה
          </Btn>
        </div>
      </Card>

      <Tabs
        label="לשוניות כרטיס הלקוח"
        value={activeTab}
        onChange={onTabChange}
        items={TABS.map(tab => ({
          key: tab.id,
          label: tab.label,
          icon: tab.icon,
          ...(tab.withCount ? { count: ordersCount } : {})
        }))}
      />

      {TABS.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="v3-panel"
          style={activeTab === tab.id ? undefined : { display: 'none' }}
        >
          {tabContents[tab.id]}
        </div>
      ))}
    </V3Page>
  );
}
