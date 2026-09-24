'use client';

import React, { useEffect, useState } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { Btn, IconBtn, Dialog, Row, Rows, Tag, Banner, Empty, Icon } from '@/app/v3/ui/components';

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return `${new Date(d).toLocaleDateString('he-IL')} (${getHebrewDateString(d)})`;
  } catch (e) {
    return new Date(d).toLocaleDateString('he-IL');
  }
};

/**
 * מודל "פרטי פריט" — נפתח מאייקון המידע בשורת הפריט, ומציג את היסטוריית
 * ההשכרות של אותו פריט פיזי.
 */
export default function ModernDressItemModal({ item, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!item?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/dresses/items/${item.id}/history`)
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת ההיסטוריה');
        return res.json();
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item?.id]);

  if (!item || typeof document === 'undefined') return null;

  const rentals = data?.rentals || [];

  return (
    <Dialog
      open
      onClose={onClose}
      variant="form"
      icon="info"
      title={<>פרטי פריט <bdi>{item.dressBarcode || 'ללא ברקוד'}</bdi></>}
      actions={<Btn variant="primary" onClick={onClose}>סגירה</Btn>}
    >
      <Rows>
        <Row label="מידה" icon="ruler"><bdi>{item.sizeText || '—'}</bdi></Row>
        <Row label="מס' סידורי" icon="tag"><bdi>{item.serialNumber ?? '—'}</bdi></Row>
        <Row label="סה&quot;כ השכרות" icon="history"><bdi>{rentals.length}</bdi></Row>
        <Row label="נכנס למאגר" icon="calendar"><bdi>{fmtDate(data?.entryDateToRepo || item.entryDateToRepo)}</bdi></Row>
        <Row label="מיקום" icon="pin">{item.location || '—'}</Row>
      </Rows>

      {item.notInUse && (
        <Banner
          kind="warning"
          icon="x-circle"
          title="הפריט מסומן כלא בשימוש"
          text={[
            item.notInUseSince ? `מאז ${fmtDate(item.notInUseSince)}` : null,
            item.notInUseReason ? `סיבה: ${item.notInUseReason}` : 'ללא סיבה'
          ].filter(Boolean).join(' · ')}
        />
      )}

      <h3 className="v3-h3">השכרות קודמות</h3>

      {loading ? (
        <div className="v3-cluster"><Icon name="loader" loop /> טוען</div>
      ) : error ? (
        <Banner kind="alert" title={error} />
      ) : rentals.length === 0 ? (
        <Empty icon="history" text="הפריט עדיין לא הושכר." />
      ) : (
        <div className="v3-table__wrap">
          <table className="v3-table">
            <caption className="v3-sr">השכרות הפריט</caption>
            <thead>
              <tr>
                <th scope="col">הזמנה</th>
                <th scope="col">לקוח</th>
                <th scope="col">אירוע</th>
                <th scope="col">מצב</th>
                <th scope="col"><span className="v3-sr">פתיחת ההזמנה</span></th>
              </tr>
            </thead>
            <tbody>
              {rentals.map((r, idx) => (
                <tr key={idx}>
                  <td><b><bdi>{r.orderId}</bdi></b></td>
                  <td>{r.customerName}</td>
                  <td><bdi>{r.eventDateHebrew || (r.eventDate ? getHebrewDateString(r.eventDate) : '—')}</bdi></td>
                  <td>
                    {!r.isReturned ? (
                      <Tag variant="attn" icon="clock">טרם הוחזר</Tag>
                    ) : r.returnedOk === false ? (
                      <Tag variant="attn" icon="alert-tri">הוחזר עם בעיה</Tag>
                    ) : (
                      <Tag variant="done" icon="check">הוחזר תקין</Tag>
                    )}
                  </td>
                  <td>
                    <IconBtn
                      icon="external-link"
                      label="פתיחת ההזמנה בלשונית חדשה"
                      title="פתיחת ההזמנה"
                      variant="quiet"
                      size="sm"
                      href={`/orders/${r.orderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
