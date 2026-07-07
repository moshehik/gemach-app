'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, List, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import HebrewDatePicker from './HebrewDatePicker';
import { HDate } from '@hebcal/core';
import { getHebrewDateString, HEBREW_DAYS } from '@/lib/hebrewDate';

export default function CapacitySearchModal({ isOpen, onClose }) {
  const [barcodePrefix, setBarcodePrefix] = useState('');
  const [size, setSize] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  
  const [sizes, setSizes] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/inventory/models');
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
        }
      } catch (err) {
        console.error('Error fetching models', err);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    if (!barcodePrefix) {
      setSizes([]);
      setSize('');
      return;
    }
    
    const fetchSizes = async () => {
      try {
        const res = await fetch(`/api/inventory/sizes?barcodePrefix=${barcodePrefix}`);
        if (res.ok) {
          const data = await res.json();
          setSizes(data.sizes || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSizes();
  }, [barcodePrefix]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!barcodePrefix || !size) {
      setError('יש להזין דגם ומידה');
      return;
    }

    let searchFrom = fromDate;
    let searchTo = toDate;
    
    if (!searchFrom) {
      searchFrom = new Date().toISOString().split('T')[0];
      setFromDate(searchFrom);
    }
    if (!searchTo) {
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      searchTo = d.toISOString().split('T')[0];
      setToDate(searchTo);
    }

    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        barcodePrefix,
        size,
        fromDate: searchFrom,
        toDate: searchTo
      });
      const res = await fetch(`/api/inventory/capacity?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בחיפוש');
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '5vh', paddingBottom: '5vh' }}>
      <div className="modal-content" style={{ width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', borderRadius: '12px', padding: '2rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>חיפוש הזמנות תפוסה</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} color="#666" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSearch} style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '2rem', 
          alignItems: 'end',
          backgroundColor: '#f8fafc',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>דגם</label>
            <select 
              className="form-select" 
              value={barcodePrefix} 
              onChange={e => {
                setBarcodePrefix(e.target.value);
                setSize('');
              }} 
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="">בחר דגם...</option>
              {models.map(m => (
                <option key={m.id || m.barcodePrefix} value={m.barcodePrefix}>
                  {m.name} ({m.barcodePrefix})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>מידה</label>
            <select 
              className="form-select" 
              value={size} 
              onChange={e => setSize(e.target.value)} 
              required
              disabled={!barcodePrefix || sizes.length === 0}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1', 
                backgroundColor: (!barcodePrefix || sizes.length === 0) ? '#e2e8f0' : '#fff' 
              }}
            >
              <option value="">{(!barcodePrefix) ? 'בחר דגם תחילה' : (sizes.length === 0 ? 'אין מידות לדגם' : 'בחר מידה...')}</option>
              {sizes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>מתאריך</label>
            <HebrewDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>עד תאריך</label>
            <HebrewDatePicker value={toDate} onChange={setToDate} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', width: '100%', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center' }} disabled={loading}>
            {loading ? 'מחפש...' : <><Search size={18} style={{ marginLeft: '0.5rem' }} /> חפש</>}
          </button>
        </form>

        {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

        {/* Results */}
        {results && (
          <div className="animate-fade-in">
            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ flex: 1, backgroundColor: '#f0f9ff', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#0284c7' }}>במלאי</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0369a1' }}>{results.inStock}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#fef2f2', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #fecaca' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626' }}>בתפוסה</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#b91c1c' }}>{results.occupiedCount}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#fdf4ff', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #fbcfe8' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#c026d3' }}>רזרבה</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#a21caf' }}>{results.reserve}</div>
              </div>
            </div>

            {/* View Toggle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setViewMode('list')}
                  style={{ 
                    padding: '0.5rem 1.5rem', 
                    border: 'none', 
                    borderRadius: '6px', 
                    background: viewMode === 'list' ? '#fff' : 'transparent',
                    boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    cursor: 'pointer', fontWeight: viewMode === 'list' ? 'bold' : 'normal'
                  }}
                >
                  <List size={18} /> תצוגת רשימה
                </button>
                <button 
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  style={{ 
                    padding: '0.5rem 1.5rem', 
                    border: 'none', 
                    borderRadius: '6px', 
                    background: viewMode === 'calendar' ? '#fff' : 'transparent',
                    boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    cursor: 'pointer', fontWeight: viewMode === 'calendar' ? 'bold' : 'normal'
                  }}
                >
                  <CalendarIcon size={18} /> תצוגת לוח
                </button>
              </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
              results.occupiedCount > 0 ? (
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', textAlign: 'right' }}>
                    <thead>
                      <tr>
                        <th>תאריך אירוע (לועזי)</th>
                        <th>תאריך אירוע (עברי)</th>
                        <th>שם לקוח</th>
                        <th>כמות בתפוסה</th>
                        <th>פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.occupiedOrders.map(order => (
                        <tr key={order.id}>
                          <td>{new Date(order.eventDate).toLocaleDateString('he-IL')}</td>
                          <td>{order.eventDateHebrew || 'לא צוין'}</td>
                          <td>{order.customerName}</td>
                          <td>{order.quantity}</td>
                          <td>
                            <button 
                              type="button"
                              onClick={() => window.open(`/orders/${order.orderId}`, '_blank')}
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <ExternalLink size={14} /> פתח
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <CalendarIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h3>אין הזמנות תפוסות בטווח התאריכים הנבחר</h3>
                  <p>הפריט פנוי לחלוטין בתאריכים אלו.</p>
                </div>
              )
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <CapacityCalendar 
                fromDate={fromDate || new Date().toISOString().split('T')[0]} 
                toDate={toDate || new Date().toISOString().split('T')[0]} 
                occupiedOrders={results.occupiedOrders} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CapacityCalendar({ fromDate, toDate, occupiedOrders }) {
  // Generate calendar months between fromDate and toDate
  const start = new HDate(new Date(fromDate));
  const end = new HDate(new Date(toDate));
  
  // We'll just display the month of fromDate for simplicity, or all months in range.
  // Let's generate a list of months to show
  const months = [];
  let curr = new HDate(1, start.getMonth(), start.getFullYear());
  while (curr.abs() <= end.abs() || (curr.getMonth() === end.getMonth() && curr.getFullYear() === end.getFullYear())) {
    months.push(new HDate(1, curr.getMonth(), curr.getFullYear()));
    if (curr.getMonth() === 13) {
      curr = new HDate(1, 1, curr.getFullYear() + 1); // Not quite right for Hebcal leap logic, but Hebcal has a better way
    } else {
      // Better way to add one month in Hebcal:
    }
    // Safer month iteration:
    const gregStart = curr.greg();
    gregStart.setDate(gregStart.getDate() + 30);
    curr = new HDate(gregStart);
    curr = new HDate(1, curr.getMonth(), curr.getFullYear());
  }

  // Deduplicate months
  const uniqueMonths = [];
  months.forEach(m => {
    if (!uniqueMonths.find(x => x.getMonth() === m.getMonth() && x.getFullYear() === m.getFullYear())) {
      uniqueMonths.push(m);
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {uniqueMonths.map((month, idx) => (
        <HebrewMonth 
          key={idx} 
          month={month} 
          occupiedOrders={occupiedOrders}
          fromDate={new Date(fromDate)}
          toDate={new Date(toDate)}
        />
      ))}
    </div>
  );
}

function HebrewMonth({ month, occupiedOrders, fromDate, toDate }) {
  const hMonthName = month.getMonthName('h');
  const hYear = month.getFullYear();
  const daysInMonth = HDate.daysInMonth(month.getMonth(), hYear);
  
  // Create grid
  const days = [];
  // Find day of week of 1st day (0 = Sun, 6 = Sat)
  const firstDay = month.greg().getDay();
  
  // padding
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const hd = new HDate(i, month.getMonth(), hYear);
    days.push(hd);
  }

  const isDayOccupied = (hd) => {
    const greg = hd.greg();
    // Reset time for fair comparison
    greg.setHours(0,0,0,0);
    
    // Calculate total quantity for this day
    let total = 0;
    occupiedOrders.forEach(order => {
      const start = new Date(order.eventDate);
      start.setHours(0,0,0,0);
      const end = order.returnDate ? new Date(order.returnDate) : new Date(order.eventDate);
      end.setHours(0,0,0,0);
      
      if (greg >= start && greg <= end) {
        total += order.quantity;
      }
    });
    return total;
  };

  const isDayInRange = (hd) => {
    const greg = hd.greg();
    greg.setHours(0,0,0,0);
    const s = new Date(fromDate); s.setHours(0,0,0,0);
    const e = new Date(toDate); e.setHours(0,0,0,0);
    return greg >= s && greg <= e;
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#f8fafc', padding: '1rem', textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0' }}>
        {hMonthName} {hYear}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: '#e2e8f0' }}>
        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(d => (
          <div key={d} style={{ padding: '0.5rem', textAlign: 'center', backgroundColor: '#fff', fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b' }}>
            {d}
          </div>
        ))}
        {days.map((hd, i) => {
          if (!hd) return <div key={`empty-${i}`} style={{ backgroundColor: '#f8fafc' }} />;
          
          const inRange = isDayInRange(hd);
          const occQty = isDayOccupied(hd);
          
          return (
            <div key={i} style={{ 
              backgroundColor: inRange ? (occQty > 0 ? '#fee2e2' : '#f0fdf4') : '#fff',
              padding: '0.5rem', 
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              opacity: inRange ? 1 : 0.5
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{hd.getDate()}</div>
              {occQty > 0 && (
                <div style={{ marginTop: 'auto', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>
                  {occQty} תפוס
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
