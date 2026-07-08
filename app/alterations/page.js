'use client';

import { useState, useEffect } from 'react';
import { Calendar, CalendarPlus } from 'lucide-react';
import PrintWizardModal from '../components/PrintWizardModal';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function AlterationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination & Search
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 60;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  // Print Wizard state
  const [isPrintWizardOpen, setIsPrintWizardOpen] = useState(false);

  useEffect(() => {
    fetchAlterations();
  }, [startDate, endDate, showOnlyPending, page, search]);

  const fetchAlterations = async () => {
    try {
      setLoading(true);
      setError('');
      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&page=${page}&limit=${limit}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (search) url += `&search=${search}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch alterations');
      const data = await res.json();
      setItems(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markDone = async (orderItemId) => {
    if (!(await window.customConfirm('האם לאשר ביצוע תיקון?'))) return;
    try {
      const res = await fetch('/api/alterations/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId })
      });
      if (!res.ok) throw new Error('Failed to mark as done');
      
      // Remove from list if showOnlyPending is true, else update state
      if (showOnlyPending) {
        setItems(items.filter(item => item.id !== orderItemId));
      } else {
        setItems(items.map(item => item.id === orderItemId ? { ...item, alterationDone: true } : item));
      }
    } catch (err) {
      alert('שגיאה בעדכון התיקון: ' + err.message);
    }
  };

  const markAllDone = async () => {
    if (!startDate) {
      alert('יש לבחור תאריך כדי לסמן את כל התיקונים כבוצעו לאותו יום.');
      return;
    }
    if (!(await window.customConfirm(`בטוח שבוצעו כל התיקונים לתאריך ${startDate}?`))) return;
    
    try {
      const res = await fetch('/api/alterations/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: startDate })
      });
      if (!res.ok) throw new Error('Failed to mark all as done');
      fetchAlterations();
    } catch (err) {
      alert('שגיאה בעדכון: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  const setQuickDate = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const dateStr = d.toISOString().split('T')[0];
    setStartDate(dateStr);
    setEndDate(dateStr);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <main className="container animate-fade-in" style={{ padding: '2rem 1rem', minHeight: '80vh' }}>
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        marginBottom: '2rem', padding: '1.5rem', background: 'var(--card-bg)', 
        backdropFilter: 'blur(10px)', borderRadius: '16px', border: 'var(--glass-border)', 
        boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap', gap: '1rem' 
      }}>
        <h1 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>✂️</span> ניהול תפירות ותיקונים
        </h1>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-outline"
            onClick={() => setIsPrintWizardOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>🖨️</span> אשף הדפסה
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => alert('מקרא צבעים:\nאדום - טרם בוצע תיקון\nירוק - התיקון בוצע')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>ℹ️</span> מקרא
          </button>
        </div>
      </div>

      <div className="dress-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap', overflow: 'visible', zIndex: 10 }}>
        <div style={{ flex: '1', display: 'flex', gap: '15px', minWidth: '350px' }}>
          <div style={{ flex: '1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: '500', color: 'var(--text-main)', margin: 0 }}>מתאריך:</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setQuickDate(0)}>
                  <Calendar size={14} /> היום
                </button>
                <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setQuickDate(1)}>
                  <CalendarPlus size={14} /> מחר
                </button>
              </div>
            </div>
            <HebrewDatePicker 
              value={startDate} 
              onChange={date => setStartDate(date)} 
            />
          </div>
          <div style={{ flex: '1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-main)' }}>עד תאריך:</label>
            <HebrewDatePicker 
              value={endDate} 
              onChange={date => setEndDate(date)} 
            />
          </div>
        </div>
        
        <div style={{ flex: '1.5', display: 'flex', gap: '15px', minWidth: '350px', alignItems: 'center', height: '50px' }}>
          <label style={{ flex: '1', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0.5rem 1rem', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '30px', border: '1px solid var(--border-color)', transition: 'all 0.3s ease', height: '100%' }}>
            <input 
              type="checkbox" 
              checked={showOnlyPending} 
              onChange={e => setShowOnlyPending(e.target.checked)} 
              style={{ marginLeft: '12px', transform: 'scale(1.2)' }}
            />
            <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>רק ממתינים לתיקון</span>
          </label>
          
          <button 
            className="btn btn-primary" 
            style={{ flex: '1', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            onClick={markAllDone} 
            disabled={!startDate}
          >
            <span>✔️</span> סמן הכל כבוצע ליום המוגדר
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '500px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                placeholder="חיפוש (מספר הזמנה, שם לקוח, דגם שמלה)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 1rem', 
                  borderRadius: '24px', 
                  border: '1px solid #ddd',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  outline: 'none',
                  fontSize: '1rem'
                }}
              />
              {searchInput && (
                <button 
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '1.2rem', padding: '0' }}
                  title="נקה חיפוש"
                >
                  &times;
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ borderRadius: '24px', padding: '0.75rem 1.5rem' }}>
              חיפוש
            </button>
          </form>
        </div>
        <div style={{ color: 'var(--text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>סה"כ רשומות: {totalCount}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'fadeIn 1.5s infinite alternate' }}>⏳</div>
          <h2>טוען נתונים...</h2>
        </div>
      ) : error ? (
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center', color: '#e53935', borderRight: '5px solid #e53935' }}>
          <h3>שגיאה בטעינת נתונים</h3>
          <p>{error}</p>
        </div>
      ) : (
        <div className="dress-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(212, 175, 55, 0.1)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>תאריך אירוע</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>לקוח</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>דגם שמלה</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>מידה</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>צוואר</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>שרוול</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>אורך</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>פירוט נוסף</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>סטטוס</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👗</div>
                      <p style={{ fontSize: '1.2rem' }}>לא נמצאו תיקונים העונים לחתך החיפוש</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr 
                      key={item.id} 
                      style={{ 
                        borderBottom: '1px solid #eee',
                        background: item.alterationDone ? 'rgba(67, 160, 71, 0.05)' : (index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'),
                        transition: 'background 0.3s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = item.alterationDone ? 'rgba(67, 160, 71, 0.05)' : (index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)')}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div>{item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-')}</div>
                        {item.order?.eventDate && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(item.order.eventDate)}</div>}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{item.order?.customer?.firstName} {item.order?.customer?.lastName}</td>
                      <td style={{ padding: '1rem', color: 'var(--primary-color)' }}>{item.dressItem?.dress?.name || item.dressItem?.dressName}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: 'var(--bg-color)', border: '1px solid #ddd', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '500' }}>
                          {item.sizeText || item.size}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>{item.neckAlteration > 0 ? `הצרה ${item.neckAlteration}` : '-'}</td>
                      <td style={{ padding: '1rem' }}>{item.sleeveAlteration > 0 ? `הארכה ${item.sleeveAlteration}` : '-'}</td>
                      <td style={{ padding: '1rem' }}>{item.lengthAlteration ? item.lengthAlteration : '-'}</td>
                      <td style={{ padding: '1rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.alterationDetails}>
                        {item.alterationDetails || '-'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '0.4rem 1rem',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          background: item.alterationDone ? 'rgba(67, 160, 71, 0.1)' : 'rgba(229, 57, 53, 0.1)',
                          color: item.alterationDone ? '#2e7d32' : '#c62828',
                          border: `1px solid ${item.alterationDone ? 'rgba(67, 160, 71, 0.2)' : 'rgba(229, 57, 53, 0.2)'}`
                        }}>
                          {item.alterationDone ? '✓ בוצע' : '⏳ ממתין'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {!item.alterationDone && (
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => markDone(item.id)}
                          >
                            סמן שבוצע
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem 0' }}>
                <button 
                  className="btn btn-outline"
                  disabled={page >= totalPages} 
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  הבא &gt;
                </button>
                <span style={{ fontWeight: '500' }}>עמוד {page} מתוך {totalPages}</span>
                <button 
                  className="btn btn-outline"
                  disabled={page <= 1} 
                  onClick={() => setPage(p => p - 1)}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  &lt; קודם
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isPrintWizardOpen && (
        <PrintWizardModal 
          onClose={() => setIsPrintWizardOpen(false)} 
          defaultStartDate={startDate}
          defaultEndDate={endDate}
        />
      )}
    </main>
  );
}
