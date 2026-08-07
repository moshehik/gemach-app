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
    <>
      <div className="page-head">
        <div>
          <h1>חישובים והתראות</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-head">
          <div className="card-title-row">
            <svg className="icon"><use href="#i-search" /></svg>
            <h2 style={{ fontSize: '15px', margin: 0 }}>סריקת פערים לפי טווח תאריכים</h2>
          </div>
        </div>
        <div className="card-pad">
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: '250px' }}>
              <label>תאריך התחלה (אירוע)</label>
              <HebrewDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: '250px' }}>
              <label>תאריך סיום (אירוע)</label>
              <HebrewDatePicker value={endDate} onChange={setEndDate} />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={handleSearch} disabled={loading}>
              <svg className="icon"><use href="#i-search" /></svg>
              {loading ? 'סורק...' : 'חפש פערים'}
            </button>
          </div>
        </div>
      </div>

      {hasSearched && (
        <>
          <h2 className="section-title">תוצאות הסריקה ({results.length} הזמנות דורשות עדכון)</h2>

          {results.length > 0 ? (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === results.length && results.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>הזמנה</th>
                      <th>לקוח</th>
                      <th>תאריך אירוע עברי</th>
                      <th>סכום ישן</th>
                      <th>סכום מתוקן</th>
                      <th>פער</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(row => (
                      <tr key={row.orderId}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.orderId)}
                            onChange={() => toggleSelect(row.orderId)}
                          />
                        </td>
                        <td className="cell-primary">{row.orderId}</td>
                        <td>{row.customerName}</td>
                        <td>{row.eventDateHebrew || '-'}</td>
                        <td>₪{row.oldAmount}</td>
                        <td style={{ fontWeight: 700, color: 'var(--info)' }}>₪{row.newAmount}</td>
                        <td style={{ fontWeight: 800, color: row.diff > 0 ? 'var(--danger)' : 'var(--success)', direction: 'ltr', textAlign: 'right' }}>
                          ₪{row.diff > 0 ? '+' : ''}{row.diff}
                        </td>
                        <td>
                          <a
                            href={`/orders/${row.orderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            <svg className="icon"><use href="#i-link" /></svg>
                            עיין בהזמנה
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="bulk-bar" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <strong>החלת שינויים</strong>
                  <div className="field" style={{ margin: 0, flex: 1, minWidth: '240px' }}>
                    <label>הערה מיוחדת לצירוף לשורות החיוב</label>
                    <input
                      type="text"
                      className="input"
                      value={customNote}
                      onChange={e => setCustomNote(e.target.value)}
                      placeholder="לדוגמה: תיקון חישוב מחירון"
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleApply}
                    disabled={applying || selectedIds.size === 0}
                  >
                    <svg className="icon"><use href="#i-check" /></svg>
                    {applying ? 'מחיל שינויים...' : `החל על ${selectedIds.size} הזמנות`}
                  </button>
                </div>

                <div className="table-foot">
                  <span>סה&quot;כ {results.length} הזמנות דורשות עדכון</span>
                </div>
              </div>

              <div className="callout callout-info" style={{ marginTop: '14px' }}>
                <svg className="icon"><use href="#i-info" /></svg>
                המערכת תריץ את מנוע התשלומים מחדש על ההזמנות הנבחרות ותעדכן את היתרות במסד הנתונים.
              </div>
            </>
          ) : (
            <div className="table-wrap">
              <div className="empty-state">
                <svg className="icon"><use href="#i-check-circle" /></svg>
                <h4>לא נמצאו פערים בטווח התאריכים הנבחר. כל ההזמנות תקינות ומעודכנות!</h4>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
