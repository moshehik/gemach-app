'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

function StatusSummary({ summary }) {
  const [isOpen, setIsOpen] = useState(false);

  const totalInactive = (summary?.inRepair || 0) + (summary?.notInUse || 0) + (summary?.warehouse || 0) + (summary?.reserve || 0);

  if (totalInactive === 0) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginRight: '8px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '4px',
          backgroundColor: isOpen ? '#e2e8f0' : 'transparent',
          color: '#64748b',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none'
        }}
        title="סטטוס פריטים שאינם בשימוש"
      >
        <span style={{ 
          display: 'inline-block', 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '4px',
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          zIndex: 50,
          width: 'max-content',
          minWidth: '150px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
            סה"כ לא פעילים: {totalInactive}
          </h4>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem', color: '#475569' }}>
            {summary.inRepair > 0 && <li style={{ margin: '4px 0' }}>בתיקון: {summary.inRepair}</li>}
            {summary.notInUse > 0 && <li style={{ margin: '4px 0' }}>לא בשימוש: {summary.notInUse}</li>}
            {summary.warehouse > 0 && <li style={{ margin: '4px 0' }}>במחסן: {summary.warehouse}</li>}
            {summary.reserve > 0 && <li style={{ margin: '4px 0' }}>ברזרבה: {summary.reserve}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function AlertOrdersModal({ orders, onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '24px',
        width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#0f172a' }}>הזמנות מעורבות</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        
        <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '16px' }}>
          ההזמנות הבאות חופפות בתאריכים אלו ויוצרות חריגת מלאי. לחץ על מספר הזמנה כדי לפתוח אותה ולטפל בבעיה.
        </p>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {orders.map(oid => (
            <Link 
              key={oid} 
              href={`/orders/${oid}`} 
              target="_blank"
              style={{
                display: 'block',
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#2563eb',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
            >
              הזמנה #{oid} ↗
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InventoryAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState(null);

  useEffect(() => {
    fetch('/api/inventory/alerts')
      .then(res => res.json())
      .then(data => {
        setAlerts(data.alerts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('he-IL');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#0f172a', margin: 0, fontSize: '2rem' }}>התראות ובדיקות מלאי</h1>
        <Link 
          href="/admin" 
          style={{ 
            textDecoration: 'none', color: '#64748b', backgroundColor: '#f1f5f9', 
            padding: '8px 16px', borderRadius: '8px', fontWeight: '500' 
          }}
        >
          חזרה לניהול
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>טוען נתונים, אנא המתן...</div>
      ) : alerts.length === 0 ? (
        <div style={{ 
          backgroundColor: '#ecfdf5', border: '1px solid #10b981', color: '#047857', 
          padding: '2rem', borderRadius: '12px', textAlign: 'center' 
        }}>
          <h2 style={{ margin: '0 0 8px 0' }}>המלאי תקין לחלוטין!</h2>
          <p style={{ margin: 0 }}>לא נמצאו חריגות בהזמנות העתידיות.</p>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', 
          overflow: 'hidden', border: '1px solid #e2e8f0' 
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '600' }}>דגם</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '600' }}>מידה</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '600' }}>תאריכי חריגה</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '600', textAlign: 'center' }}>במלאי</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '600', textAlign: 'center' }}>ביקוש</th>
                <th style={{ padding: '16px', color: '#475569', fontWeight: '600', textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                  <td style={{ padding: '16px', fontWeight: '500', color: '#0f172a' }}>{alert.dressName}</td>
                  <td style={{ padding: '16px', color: '#334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {alert.sizeText}
                      <StatusSummary summary={alert.statusSummary} />
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: '#b91c1c', fontWeight: '500' }}>
                    {formatDate(alert.fromDate)} 
                    {alert.fromDate !== alert.toDate && ` - ${formatDate(alert.toDate)}`}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center', color: '#0f172a', fontWeight: '500' }}>{alert.inStock}</td>
                  <td style={{ padding: '16px', textAlign: 'center', color: '#b91c1c', fontWeight: 'bold' }}>{alert.demanded}</td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button
                      onClick={() => setSelectedOrders(alert.orders)}
                      style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dc2626'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ef4444'}
                    >
                      צפה בהזמנות ({alert.orders.length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrders && (
        <AlertOrdersModal orders={selectedOrders} onClose={() => setSelectedOrders(null)} />
      )}
    </div>
  );
}
