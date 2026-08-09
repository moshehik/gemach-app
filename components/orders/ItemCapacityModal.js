'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { CapacityCalendar } from '@/components/CapacityCalendar';

export default function ItemCapacityModal({ item, order, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
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
         throw new Error('לא נמצא קוד פריט');
      }

      const params = new URLSearchParams({
        barcodePrefix: prefix,
        size: actualSize,
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0]
      });

      const res = await fetch(`/api/inventory/capacity?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת נתונים');

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
        setError('לא הוגדר תאריך אירוע להזמנה זו.');
        setResults(null);
      } else if (!hasIdentifier) {
        setError('לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).');
        setResults(null);
      } else if (!actualSize) {
        setError('לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.');
        setResults(null);
      } else {
        fetchCapacity(actualSize);
      }
    }
  }, [isOpen, item, order]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={onClose}>
      <div className="modal animate-fade-in" style={{ maxWidth: '760px', width: '95%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-calendar" /></svg>
            זמינות: {item.dressItem?.dress?.name || item.description || 'פריט'} ({item.sizeText || item.size || 'ללא מידה'})
          </strong>
          <button data-agy-id="itemcapacitymodal_button_1" type="button" onClick={onClose} className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" aria-label="סגירה">
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="hint" style={{ color: 'var(--text-2)', marginBottom: '4px' }}>
            <strong style={{ color: 'var(--text)' }}>תאריך אירוע:</strong> {new Date(order.eventDate).toLocaleDateString('he-IL')} · {getHebrewDateString(order.eventDate)}
          </p>
          <p className="hint" style={{ marginBottom: '18px' }}>(מוצג טווח של חודש לפני ואחרי)</p>

          {loading && (
            <div className="loading-inline"><span className="spinner" /> טוען נתוני תפוסה...</div>
          )}

          {error && (
            <div className="callout callout-danger">
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              <span>{error}</span>
            </div>
          )}

          {results && !loading && (
            <div className="animate-fade-in">
              {/* Summary Cards */}
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '18px' }}>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                  <div className="kpi-label">במלאי</div>
                  <div className="kpi-value" style={{ color: 'var(--info)' }}>{results.inStock}</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                  <div className="kpi-label">בתפוסה מתוכננת</div>
                  <div className="kpi-value" style={{ color: 'var(--danger)' }}>{results.occupiedCount}</div>
                </div>
                <div className="kpi-card" style={{ textAlign: 'center' }}>
                  <div className="kpi-label">רזרבה זמינה</div>
                  <div className="kpi-value" style={{ color: 'var(--primary-solid)' }}>{results.reserve}</div>
                </div>
              </div>

              {results.occupiedCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <div className="toggle-btn-group">
                    <button
                      data-agy-id="itemcapacitymodal_view_list_btn"
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={viewMode === 'list' ? 'on' : ''}
                    >
                      <svg className="icon"><use href="#i-list" /></svg> תצוגת רשימה
                    </button>
                    <button
                      data-agy-id="itemcapacitymodal_view_calendar_btn"
                      type="button"
                      onClick={() => setViewMode('calendar')}
                      className={viewMode === 'calendar' ? 'on' : ''}
                    >
                      <svg className="icon"><use href="#i-calendar" /></svg> תצוגת לוח
                    </button>
                  </div>
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
                <div className="table-wrap">
                  <div className="table-scroll">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>תאריך אירוע</th>
                          <th>שם לקוח</th>
                          <th>כמות בתפוסה</th>
                          <th>הזמנה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...results.occupiedOrders].sort((a,b) => new Date(a.eventDate) - new Date(b.eventDate)).map(occOrder => {
                          const isCurrent = occOrder.orderId === order.orderId;
                          return (
                            <tr key={occOrder.id} style={isCurrent ? { background: 'var(--primary-tint)' } : undefined}>
                              <td className={isCurrent ? 'cell-primary' : undefined}>
                                {new Date(occOrder.eventDate).toLocaleDateString('he-IL')} <span className="hint" style={{ color: 'var(--text-3)' }}>({getHebrewDateString(occOrder.eventDate)})</span>
                                {isCurrent && <span className="badge badge-primary" style={{ marginInlineStart: '8px' }}>הזמנה נוכחית</span>}
                              </td>
                              <td>{occOrder.customerName}</td>
                              <td><span className="badge badge-danger">{occOrder.quantity}</span></td>
                              <td>
                                <a
                                  href={`/orders/${occOrder.orderId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  צפה בהזמנה <svg className="icon"><use href="#i-link" /></svg>
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <svg className="icon"><use href="#i-calendar" /></svg>
                  <h4>אין הזמנות תפוסות בטווח התאריכים</h4>
                  <p>הפריט פנוי לחלוטין בתאריכים אלו.</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" onClick={onClose} className="btn btn-secondary">סגירה</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
