'use client';

import React, { useState, useEffect } from 'react';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { CapacityCalendar } from '@/components/CapacityCalendar';
import { Dialog, Btn, Badge, Tag, Banner, Empty, Tip, Icon } from '@/app/v3/ui/components';
import './orderItemsV3.css';

export default function ItemCapacityModal({ item, order, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  // Dialog של v3 קורס אם הוא נטען כשהוא כבר open=true (ר' requests/orderitems.md REQ-1) — לכן פותחים אותו רק אחרי שהוא כבר מורכב
  const [dialogReady, setDialogReady] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [dateRange, setDateRange] = useState({ fromDate: null, toDate: null });

  async function fetchCapacity(actualSize) {
    setLoading(true);
    setError('');
    try {
      // Calculate a date range around the event date (e.g. 1 month before and after)
      const eventDate = new Date(order.eventDate);
      const fromDate = new Date(eventDate);
      fromDate.setMonth(fromDate.getMonth() - 1);
      const toDate = new Date(eventDate);
      toDate.setMonth(toDate.getMonth() + 1);
      setDateRange({ fromDate: fromDate.toISOString().split('T')[0], toDate: toDate.toISOString().split('T')[0] });

      let prefix = item.barcodePrefix || item.dressItem?.barcodePrefix || item.dressItem?.dress?.barcodePrefix;
      const actualModelId = item.dressModelId || item.dressItem?.dressModelId;

      if (!prefix && actualModelId) {
        // fetch models to get prefix
        const mRes = await fetch('/api/inventory/models');
        const mData = await mRes.json();
        const model = mData.models?.find(m => m.id === actualModelId);
        if (model) prefix = model.barcodePrefix;
      }
      if (!prefix) {
         throw new Error('לא נמצא קוד לפריט הזה');
      }

      const params = new URLSearchParams({
        barcodePrefix: prefix,
        size: actualSize,
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0]
      });

      const res = await fetch(`/api/inventory/capacity?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'לא הצלחנו לטעון את נתוני התפוסה');

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const hasIdentifier = item && (item.dressModelId || item.dressItem?.dressModelId || item.barcodePrefix || item.dressItem?.barcodePrefix || item.dressItem?.dress?.barcodePrefix);
    const actualSize = item?.sizeText || item?.size;

    if (isOpen) {
      if (!order.eventDate) {
        setError('להזמנה אין תאריך אירוע, ולכן אי אפשר לבדוק תפוסה.');
        setResults(null);
      } else if (!hasIdentifier) {
        setError('זה פריט כללי בלי דגם, ואי אפשר לבדוק לו תפוסה.');
        setResults(null);
      } else if (!actualSize) {
        setError('לפריט אין מידה, ולכן אי אפשר לבדוק תפוסה.');
        setResults(null);
      } else {
        fetchCapacity(actualSize);
      }
    }
  }, [isOpen, item, order]);

  useEffect(() => { if (mounted) setDialogReady(true); }, [mounted]);

  if (!isOpen || !mounted) return null;

  const itemTitle = item.dressItem?.dress?.name || item.description || 'פריט';
  const itemSize = item.sizeText || item.size || 'ללא מידה';

  return (
    <Dialog
      open={isOpen && dialogReady}
      onClose={onClose}
      variant="sheet"
      icon="calendar"
      title="בדיקת תפוסה"
      sub={<>{itemTitle} · מידה <bdi>{itemSize}</bdi></>}
      actions={<Btn data-agy-id="itemcapacitymodal_button_1" variant="secondary" icon="x" onClick={onClose}>סגירה</Btn>}
    >
      <div className="oi-sec">
        <div className="v3-row__body">
          <span className="v3-row__label">
            תאריך האירוע
            <Tip>מוצג טווח של חודש לפני האירוע ועד חודש אחריו.</Tip>
          </span>
          <div className="v3-row__value">
            <bdi>{new Date(order.eventDate).toLocaleDateString('he-IL')}</bdi> · {getHebrewDateString(order.eventDate)}
          </div>
        </div>

        {loading && (
          <div className="oi-hist__msg" aria-busy="true"><span className="v3-spin" aria-hidden="true" />בודקים תפוסה...</div>
        )}

        {error && <Banner kind="alert" text={error} />}

        {results && !loading && (
          <>
            <div className="oi-kpis">
              <div className="oi-kpi"><small>במלאי</small><b><bdi>{results.inStock}</bdi></b></div>
              <div className="oi-kpi"><small>תפוסים</small><b><bdi>{results.occupiedCount}</bdi></b></div>
              <div className="oi-kpi"><small>פנויים</small><b><bdi>{results.reserve}</bdi></b></div>
            </div>

            {results.occupiedCount > 0 && (
              <div className="v3-seg" role="group" aria-label="אופן התצוגה">
                <button
                  data-agy-id="itemcapacitymodal_view_list_btn"
                  type="button"
                  className="v3-seg__btn"
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                >
                  <Icon name="list" />רשימה
                </button>
                <button
                  data-agy-id="itemcapacitymodal_view_calendar_btn"
                  type="button"
                  className="v3-seg__btn"
                  aria-pressed={viewMode === 'calendar'}
                  onClick={() => setViewMode('calendar')}
                >
                  <Icon name="calendar" />לוח שנה
                </button>
              </div>
            )}

            {viewMode === 'calendar' && results.occupiedCount > 0 && dateRange.fromDate && (
              <CapacityCalendar
                fromDate={dateRange.fromDate}
                toDate={dateRange.toDate}
                occupiedOrders={results.occupiedOrders}
              />
            )}

            {viewMode === 'list' && (results.occupiedCount > 0 ? (
              <div className="v3-table__wrap">
                <table className="v3-table">
                  <thead>
                    <tr>
                      <th>אירוע</th>
                      <th>לקוח</th>
                      <th>כמות</th>
                      <th><span className="v3-sr">פתיחת ההזמנה</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...results.occupiedOrders].sort((a,b) => new Date(a.eventDate) - new Date(b.eventDate)).map(occOrder => {
                      const isCurrent = occOrder.orderId === order.orderId;
                      return (
                        <tr key={occOrder.id} className={isCurrent ? 'oi-cur' : undefined}>
                          <td>
                            <bdi>{new Date(occOrder.eventDate).toLocaleDateString('he-IL')}</bdi>
                            <div className="oi-note">{getHebrewDateString(occOrder.eventDate)}</div>
                            {isCurrent && <Tag variant="done" icon="check">ההזמנה הזו</Tag>}
                          </td>
                          <td>{occOrder.customerName}</td>
                          <td><Badge variant="neutral">{occOrder.quantity}</Badge></td>
                          <td>
                            <Btn
                              size="sm"
                              href={`/orders/${occOrder.orderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              iconEnd="external-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              להזמנה
                            </Btn>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="calendar" title="אין תפוסה בטווח" text="הפריט פנוי לגמרי בתאריכים האלה." />
            ))}
          </>
        )}
      </div>
    </Dialog>
  );
}
