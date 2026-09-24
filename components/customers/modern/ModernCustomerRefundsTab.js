'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Btn, Chip, Field, Row, Rows, Table, Empty } from '@/app/v3/ui/components';

export default function ModernCustomerRefundsTab({ customer, onChange, onSubmit, saving, refunds = [] }) {
  const columns = [
    { key: 'createdAt', header: 'תאריך בקשה', render: (r) => <bdi>{new Date(r.createdAt).toLocaleDateString('he-IL')}</bdi> },
    {
      key: 'orderId',
      header: 'הזמנה',
      render: (r) => (r.orderId ? <Link href={`/orders/${r.orderId}`}><bdi>{r.orderId}</bdi></Link> : '-')
    },
    { key: 'amount', header: 'סכום', num: true, render: (r) => <bdi>₪{r.amount}</bdi> },
    {
      key: 'isExecuted',
      header: 'סטטוס',
      render: (r) => (r.isExecuted
        ? <Chip variant="done" icon="check">בוצע</Chip>
        : <Chip variant="gold" icon="clock">ממתין</Chip>)
    }
  ];

  return (
    <>
      <Card icon="wallet" title="פרטי בנק לזיכויים" tip="הפרטים משמשים להעברת כספים ללקוח כשיש זיכוי.">
        <form onSubmit={onSubmit} className="v3-stack">
          <Field label="שם הבנק" type="text" name="bankName" value={customer.bankName || ''} onChange={onChange} placeholder="למשל: לאומי" />
          <Field label="סניף" type="text" name="bankBranch" value={customer.bankBranch || ''} onChange={onChange} placeholder="מספר סניף" />
          <Field label="מספר חשבון" type="text" name="bankAccount" value={customer.bankAccount || ''} onChange={onChange} />
          <Field label="שם בעל החשבון" type="text" name="bankAccountName" value={customer.bankAccountName || ''} onChange={onChange} />
          <div className="v3-cluster">
            <Btn type="submit" variant="primary" icon="check" loading={saving}>
              {saving ? 'שומר...' : 'שמירת פרטי בנק'}
            </Btn>
          </div>
        </form>
      </Card>

      <Card icon="refresh" title="זיכויים" tip="החץ בכל שורה מציג את סיבת הזיכוי ואת תאריך הביצוע.">
        {refunds.length > 0 ? (
          <div className="v3-stack">
            <Table
              caption="היסטוריית זיכויים"
              columns={columns}
              rows={refunds}
              rowKey="id"
              renderExpanded={(r) => (
                <Rows>
                  <Row label="סיבה">{r.reason || '-'}</Row>
                  <Row label="ביצוע">
                    {r.isExecuted
                      ? <>בוצע ב-<bdi>{new Date(r.executionDate).toLocaleDateString('he-IL')}</bdi></>
                      : 'ממתין לביצוע'}
                  </Row>
                </Rows>
              )}
            />
            <span className="v3-faint">סה&quot;כ <bdi>{refunds.length}</bdi> זיכויים</span>
          </div>
        ) : (
          <Empty icon="refresh" title="אין זיכויים ללקוח הזה" />
        )}
      </Card>
    </>
  );
}
