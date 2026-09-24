'use client';

import React from 'react';
import { Card, Chip, Row, Rows, Table, Empty, Icon } from '@/app/v3/ui/components';

export default function ModernCustomerPaymentsTab({ payments = [], customer }) {
  const totalRequired = (customer?.orders || []).reduce((acc, order) => {
    const orderTotal = order.obligations?.length > 0
      ? order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0)
      : (order.totalAmount || 0);
    return acc + orderTotal;
  }, 0);

  const totalPayments = payments.filter(p => p.entryType !== 'refund').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalRefunds = payments.filter(p => p.entryType === 'refund').reduce((sum, p) => sum + (p.amount || 0), 0);

  // החוב הוא סך הכל לתשלום פחות מה ששולם בפועל. זיכויים ללקוח לא מקטינים את החוב אלא להפך (אם החזרנו כסף ללקוח, הוא שילם פחות בפועל).
  // לכן, התשלום האפקטיבי הוא (תשלומים - זיכויים).
  const effectivePaid = totalPayments - totalRefunds;
  const debt = totalRequired - effectivePaid;

  const debtIcon = debt > 0 ? 'alert-tri' : debt < 0 ? 'wallet' : 'check';
  const debtLabel = debt > 0 ? 'יתרת חוב' : debt < 0 ? 'יתרת זכות' : 'מאוזן';
  const debtClass = debt > 0 ? 'v3-status v3-status--debt' : debt < 0 ? 'v3-status v3-status--credit' : 'v3-status';

  const rows = payments.map(p => ({ ...p, _key: `${p.entryType}-${p.id}` }));

  const columns = [
    { key: 'paymentDate', header: 'תאריך', render: (p) => <bdi>{new Date(p.paymentDate).toLocaleDateString('he-IL')}</bdi> },
    {
      key: 'entryType',
      header: 'סוג',
      render: (p) => (p.entryType === 'refund'
        ? <Chip variant="attn" icon="refresh">זיכוי</Chip>
        : <Chip variant="done" icon="card">תשלום</Chip>)
    },
    {
      key: 'amount',
      header: 'סכום',
      num: true,
      render: (p) => <bdi>{p.entryType === 'refund' ? '-' : ''}₪{p.amount}</bdi>
    }
  ];

  return (
    <>
      <Card icon="coin" title="סיכום כספי" tip="יתרת החוב = סך החיובים פחות (תשלומים פחות זיכויים).">
        <div className="v3-stack">
          <div className="v3-status">
            <Icon name="coin" size="lg" />
            <div>
              <small>סך כל החיובים</small>
              <span className="v3-status__n"><bdi>₪{totalRequired.toLocaleString('he-IL')}</bdi></span>
            </div>
          </div>
          <div className="v3-status">
            <Icon name="wallet" size="lg" />
            <div>
              <small>סך כל התשלומים</small>
              <span className="v3-status__n"><bdi>₪{totalPayments.toLocaleString('he-IL')}</bdi></span>
            </div>
          </div>
          {totalRefunds > 0 && (
            <div className="v3-status">
              <Icon name="refresh" size="lg" />
              <div>
                <small>סך כל הזיכויים</small>
                <span className="v3-status__n"><bdi>₪{totalRefunds.toLocaleString('he-IL')}</bdi></span>
              </div>
            </div>
          )}
          <div className={debtClass}>
            <Icon name={debtIcon} size="lg" />
            <div>
              <small>{debtLabel}</small>
              <span className="v3-status__n"><bdi>₪{Math.abs(debt).toLocaleString('he-IL')}</bdi></span>
            </div>
            {debt !== 0 && <Chip variant={debt > 0 ? 'gold' : 'info'}>{debt > 0 ? 'חובה' : 'זכות'}</Chip>}
          </div>
        </div>
      </Card>

      <Card icon="receipt" title="תשלומים וזיכויים" tip="החץ בכל שורה מציג את ההזמנה, אופן התשלום וההערות.">
        {rows.length > 0 ? (
          <div className="v3-stack">
            <Table
              caption="היסטוריית תשלומים"
              columns={columns}
              rows={rows}
              rowKey="_key"
              renderExpanded={(p) => {
                const isRefund = p.entryType === 'refund';
                return (
                  <Rows>
                    <Row label="הזמנה מקושרת">{p.orderId ? <>הזמנה <bdi>{p.orderId}</bdi></> : '-'}</Row>
                    <Row label={isRefund ? 'סיבת הזיכוי' : 'אופן תשלום'}>{isRefund ? (p.reason || 'זיכוי') : p.paymentMethod}</Row>
                    <Row label={isRefund ? 'סטטוס' : 'הערות'}>
                      {isRefund ? (p.isExecuted ? 'בוצע' : 'ממתין לביצוע') : (p.notes || '-')}
                    </Row>
                  </Rows>
                );
              }}
            />
            <span className="v3-faint">סה&quot;כ <bdi>{payments.length}</bdi> רשומות</span>
          </div>
        ) : (
          <Empty icon="card" title="אין תשלומים ללקוח הזה" />
        )}
      </Card>
    </>
  );
}
