'use client';

import { useState } from 'react';
import HebrewDatePicker from '../../../components/HebrewDatePicker';

export default function RecalculationsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [customNote, setCustomNote] = useState('תיקון חישוב מחירון');
  const [applying, setApplying] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('יש לבחור טווח תאריכים');
      return;
    }
    
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/admin/recalculations?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data.data || []);
        // Select all by default
        setSelectedIds(new Set((data.data || []).map(r => r.orderId)));
      } else {
        alert(data.error || 'שגיאה בשליפת נתונים');
      }
    } catch (e) {
      alert('שגיאה בתקשורת עם השרת');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (orderId) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(results.map(r => r.orderId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      alert('לא נבחרו הזמנות לעדכון');
      return;
    }
    
    if (!(await window.customConfirm(`האם אתה בטוח שברצונך להחיל את השינויים על ${selectedIds.size} הזמנות? פעולה זו תעדכן את מסד הנתונים.`))) {
      return;
    }

    setApplying(true);
    try {
      const res = await fetch('/api/admin/recalculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedIds),
          customNote
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`השינויים הוחלו בהצלחה על ${data.appliedCount} הזמנות!`);
        // Remove applied ones from the list
        setResults(prev => prev.filter(r => !data.successIds.includes(r.orderId)));
        setSelectedIds(new Set());
      } else {
        alert(data.error || 'שגיאה בהחלת השינויים');
      }
    } catch (e) {
      alert('שגיאה בתקשורת עם השרת');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="container" style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>חישובים והתראות</h1>
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>סריקת פערים לפי טווח תאריכים</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>תאריך התחלה (אירוע)</label>
            <HebrewDatePicker value={startDate} onChange={setStartDate} />
          </div>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>תאריך סיום (אירוע)</label>
            <HebrewDatePicker value={endDate} onChange={setEndDate} />
          </div>
          <div style={{ marginBottom: '5px' }}>
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? 'סורק...' : 'חפש פערים'}
            </button>
          </div>
        </div>
      </div>

      {hasSearched && (
        <div className="card" style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>
            תוצאות הסריקה ({results.length} הזמנות דורשות עדכון)
          </h2>
          
          {results.length > 0 ? (
            <>
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table className="table" style={{ width: '100%', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '10px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.size === results.length && results.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th style={{ padding: '10px' }}>הזמנה</th>
                      <th style={{ padding: '10px' }}>לקוח</th>
                      <th style={{ padding: '10px' }}>תאריך אירוע עברי</th>
                      <th style={{ padding: '10px' }}>סכום ישן</th>
                      <th style={{ padding: '10px' }}>סכום מתוקן</th>
                      <th style={{ padding: '10px' }}>פער</th>
                      <th style={{ padding: '10px' }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(row => (
                      <tr key={row.orderId} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(row.orderId)}
                            onChange={() => toggleSelect(row.orderId)}
                          />
                        </td>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{row.orderId}</td>
                        <td style={{ padding: '10px' }}>{row.customerName}</td>
                        <td style={{ padding: '10px' }}>{row.eventDateHebrew || '-'}</td>
                        <td style={{ padding: '10px', color: '#666' }}>₪{row.oldAmount}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: '#0056b3' }}>₪{row.newAmount}</td>
                        <td style={{ padding: '10px', fontWeight: 'bold', color: row.diff > 0 ? 'red' : 'green', direction: 'ltr', textAlign: 'right' }}>
                          ₪{row.diff > 0 ? '+' : ''}{row.diff}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <a 
                            href={`/orders/${row.orderId}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: '0.9rem', textDecoration: 'none' }}
                          >
                            עיין בהזמנה
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>החלת שינויים</h3>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, maxWidth: '400px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>הערה מיוחדת לצירוף לשורות החיוב</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={customNote}
                      onChange={e => setCustomNote(e.target.value)}
                      placeholder="לדוגמה: תיקון חישוב מחירון"
                    />
                  </div>
                  <div>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleApply} 
                      disabled={applying || selectedIds.size === 0}
                      style={{ background: 'var(--primary-color)', color: 'white', fontWeight: 'bold' }}
                    >
                      {applying ? 'מחיל שינויים...' : `החל על ${selectedIds.size} הזמנות`}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '10px' }}>
                  המערכת תריץ את מנוע התשלומים מחדש על ההזמנות הנבחרות ותעדכן את היתרות במסד הנתונים.
                </p>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
              לא נמצאו פערים בטווח התאריכים הנבחר. כל ההזמנות תקינות ומעודכנות!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
