'use client';

import { useState } from 'react';

export default function PrintWizardModal({ onClose, defaultStartDate, defaultEndDate }) {
  const [dateMode, setDateMode] = useState('today'); // 'today', 'custom'
  const [startDate, setStartDate] = useState(defaultStartDate || '');
  const [endDate, setEndDate] = useState(defaultEndDate || '');
  const [reportType, setReportType] = useState('alterations_pending'); // 'alterations_pending', 'alterations_all', 'orders_no_alterations'

  const handlePrint = () => {
    // Construct the print URL based on selections
    let query = `?reportType=${reportType}&dateMode=${dateMode}`;
    
    if (dateMode === 'custom') {
      if (!startDate || !endDate) {
        alert('יש להזין תאריך התחלה וסיום עבור טווח מותאם אישית.');
        return;
      }
      query += `&startDate=${startDate}&endDate=${endDate}`;
    }

    // Open print view in new tab
    window.open(`/print/alterations${query}`, '_blank');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <h2 style={{ borderBottom: '2px solid var(--primary-color)', paddingBottom: '10px', marginBottom: '20px' }}>
          🖨️ אשף הדפסה
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '10px' }}>סוג הדוח</h3>
          <select 
            className="form-input" 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="alterations_pending">רשימת תיקונים (טרם בוצעו)</option>
            <option value="alterations_all">רשימת כל התיקונים (כולל בוצעו)</option>
            <option value="orders_no_alterations">רשימת הזמנות ללא תיקונים</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '10px' }}>תאריכים</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="dateMode" 
                value="today" 
                checked={dateMode === 'today'} 
                onChange={() => setDateMode('today')}
                style={{ marginLeft: '8px' }}
              />
              תיקונים להיום
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="dateMode" 
                value="custom" 
                checked={dateMode === 'custom'} 
                onChange={() => setDateMode('custom')}
                style={{ marginLeft: '8px' }}
              />
              מותאם אישית (טווח תאריכים)
            </label>
          </div>

          {dateMode === 'custom' && (
            <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9em', color: '#555' }}>מתאריך:</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9em', color: '#555' }}>עד תאריך:</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
          <button className="action-button secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="action-button primary" onClick={handlePrint}>
            הכן להדפסה 🖨️
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 12px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
