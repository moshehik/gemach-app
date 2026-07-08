'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { getHebrewDateString } from '@/lib/hebrewDate';

export default function ItemCapacityModal({ item, order, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && item && item.dressModelId && item.sizeText && order.eventDate) {
      fetchCapacity();
    }
  }, [isOpen, item, order]);

  const fetchCapacity = async () => {
    setLoading(true);
    setError('');
    try {
      // Calculate a date range around the event date (e.g. 1 month before and after)
      const eventDate = new Date(order.eventDate);
      const fromDate = new Date(eventDate);
      fromDate.setMonth(fromDate.getMonth() - 1);
      const toDate = new Date(eventDate);
      toDate.setMonth(toDate.getMonth() + 1);

      const params = new URLSearchParams({
        barcodePrefix: item.dressItem?.dress?.barcodePrefix || item.dressModelId, // Fallback if barcodePrefix is missing, maybe we need to fetch barcode prefix by model id, wait API takes barcodePrefix. Let's see if item has barcode prefix.
        size: item.sizeText,
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0]
      });

      // We need barcodePrefix for the API. Let's get it.
      let prefix = item.dressItem?.dress?.barcodePrefix;
      if (!prefix) {
        // fetch models to get prefix
        const mRes = await fetch('/api/inventory/models');
        const mData = await mRes.json();
        const model = mData.models?.find(m => m.id === item.dressModelId);
        if (model) prefix = model.barcodePrefix;
      }
      if (!prefix) {
         throw new Error('לא נמצא קוד פריט');
      }
      params.set('barcodePrefix', prefix);

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-content animate-fade-in" style={{ width: '95%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', borderRadius: '16px', padding: '0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', direction: 'rtl' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', borderBottom: '1px solid #e2e8f0', borderTopRightRadius: '16px', borderTopLeftRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarIcon size={24} />
            </div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: 'bold' }}>
              זמינות: {item.dressItem?.dress?.name || item.description || 'פריט'} ({item.sizeText})
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem', color: '#475569', fontSize: '1.1rem' }}>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>תאריך אירוע:</strong> {new Date(order.eventDate).toLocaleDateString('he-IL')} {getHebrewDateString(order.eventDate)}</p>
                <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.8 }}>(מוצג טווח של חודש לפני ואחרי)</p>
            </div>

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ marginTop: '1rem', color: '#64748b' }}>טוען נתוני תפוסה...</p>
                </div>
            )}
            
            {error && <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

            {results && !loading && (
            <div className="animate-fade-in">
                {/* Summary Cards */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ flex: 1, backgroundColor: '#f0f9ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #bae6fd', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#0284c7', fontSize: '1.1rem' }}>במלאי</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#0369a1' }}>{results.inStock}</div>
                </div>
                <div style={{ flex: 1, backgroundColor: '#fef2f2', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #fecaca', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626', fontSize: '1.1rem' }}>בתפוסה מתוכננת</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#b91c1c' }}>{results.occupiedCount}</div>
                </div>
                <div style={{ flex: 1, backgroundColor: '#fdf4ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #fbcfe8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#c026d3', fontSize: '1.1rem' }}>רזרבה זמינה</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#a21caf' }}>{results.reserve}</div>
                </div>
                </div>

                {results.occupiedCount > 0 ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '1rem', color: '#475569', fontWeight: '600' }}>תאריך אירוע</th>
                        <th style={{ padding: '1rem', color: '#475569', fontWeight: '600' }}>שם לקוח</th>
                        <th style={{ padding: '1rem', color: '#475569', fontWeight: '600' }}>כמות בתפוסה</th>
                        <th style={{ padding: '1rem', color: '#475569', fontWeight: '600' }}>הזמנה</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.occupiedOrders.map(occOrder => (
                        <tr key={occOrder.id} style={{ borderBottom: '1px solid #f1f5f9', background: occOrder.orderId === order.orderId ? '#eff6ff' : 'transparent', transition: 'background-color 0.2s' }}>
                            <td style={{ padding: '1rem', fontWeight: occOrder.orderId === order.orderId ? 'bold' : 'normal' }}>
                                {new Date(occOrder.eventDate).toLocaleDateString('he-IL')}
                                {occOrder.orderId === order.orderId && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', background: '#3b82f6', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '12px' }}>הזמנה נוכחית</span>}
                            </td>
                            <td style={{ padding: '1rem' }}>{occOrder.customerName}</td>
                            <td style={{ padding: '1rem' }}>
                                <span style={{ background: '#fee2e2', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '8px', fontWeight: 'bold' }}>{occOrder.quantity}</span>
                            </td>
                            <td style={{ padding: '1rem' }}>
                            <a 
                                href={`/orders/${occOrder.orderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', background: '#f1f5f9', color: '#3b82f6', borderRadius: '8px', fontWeight: '600', transition: 'all 0.2s', border: '1px solid #e2e8f0' }}
                                onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                                onMouseOut={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                            >
                                צפה בהזמנה <ExternalLink size={16} />
                            </a>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <CalendarIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>אין הזמנות תפוסות בטווח התאריכים</h3>
                    <p style={{ margin: 0 }}>הפריט פנוי לחלוטין בתאריכים אלו.</p>
                </div>
                )}
            </div>
            )}
        </div>
      </div>
    </div>
  );
}
