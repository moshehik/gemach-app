'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, PackageCheck, PackageOpen } from 'lucide-react';

export default function OrderRentalsManager({ items }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter out deleted items, but maybe we want to see them? Let's just show active items for rentals.
  const activeItems = (items || []).filter(item => !item.isDeleted);
  
  const rentedCount = activeItems.filter(item => item.isTaken && !item.isReturned).length;
  const returnedCount = activeItems.filter(item => item.isReturned).length;
  const totalCount = activeItems.length;

  const summaryText = `הושכרו: ${rentedCount} | הוחזרו: ${returnedCount} מתוך ${totalCount}`;

  const tableHeaderStyle = {
    padding: '1.2rem 1rem',
    textAlign: 'right',
    color: '#334155',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: '700',
    whiteSpace: 'nowrap'
  };

  return (
    <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflowX: 'auto', border: '1px solid #f1f5f9' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)} 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '1.5rem' : '0', borderBottom: isExpanded ? '2px solid #f1f5f9' : 'none', paddingBottom: isExpanded ? '1rem' : '0', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>השכרות והחזרות</h2>
          {!isExpanded && (
            <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#cbd5e1' }}>|</span> {summaryText}
            </span>
          )}
        </div>
        <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '50%', padding: '0.5rem', transition: 'all 0.2s' }}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {isExpanded && (
        <>
          {activeItems.length > 0 ? (
            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.95rem' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>תיאור דגם</th>
                    <th style={{ ...tableHeaderStyle, width: '150px' }}>מידה</th>
                    <th style={{ ...tableHeaderStyle, width: '150px' }}>ברקוד</th>
                    <th style={{ ...tableHeaderStyle, width: '150px' }}>תאריך לקיחה</th>
                    <th style={{ ...tableHeaderStyle, width: '150px' }}>תאריך החזרה</th>
                    <th style={{ ...tableHeaderStyle, width: '120px', textAlign: 'center' }}>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((item, index) => {
                    const isRented = item.isTaken && !item.isReturned;
                    const isReturned = item.isReturned;
                    
                    const rowStyle = {
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: isRented ? '#eff6ff' : isReturned ? '#f0fdf4' : 'white',
                      transition: 'all 0.2s'
                    };

                    const barcode = item.dressItem?.barcode || item.barcode || 'לא שויך ברקוד';
                    const takenDate = item.takenDate ? new Date(item.takenDate).toLocaleDateString('he-IL') : '-';
                    const returnDate = item.returnDate ? new Date(item.returnDate).toLocaleDateString('he-IL') : '-';
                    
                    return (
                      <tr key={item.id || index} style={rowStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isRented ? '#dbeafe' : isReturned ? '#dcfce7' : '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isRented ? '#eff6ff' : isReturned ? '#f0fdf4' : 'white'}>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                          {item.dressItem?.dress?.name || item.description || 'פריט כללי'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {item.sizeText || '-'}
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '1.05rem', color: '#475569' }}>
                          {barcode}
                        </td>
                        <td style={{ padding: '1rem', color: item.isTaken ? '#2563eb' : '#64748b' }}>
                          {takenDate}
                        </td>
                        <td style={{ padding: '1rem', color: item.isReturned ? '#16a34a' : '#64748b' }}>
                          {returnDate}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {isReturned ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dcfce7', color: '#16a34a', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                              <PackageCheck size={16} />
                              הוחזר
                            </span>
                          ) : isRented ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dbeafe', color: '#2563eb', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                              <PackageOpen size={16} />
                              בהשכרה
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', color: '#64748b', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                              ממתין
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem 0', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>אין פריטים להצגה בהשכרות והחזרות</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
