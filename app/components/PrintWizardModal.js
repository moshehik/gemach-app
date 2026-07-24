'use client';

import { useState } from 'react';
import { Printer, Calendar as CalendarIcon, Clock, CheckCircle, FileText, X } from 'lucide-react';
import HebrewDatePicker from '../../components/HebrewDatePicker';

export default function PrintWizardModal({ onClose, defaultStartDate, defaultEndDate }) {
  const [dateMode, setDateMode] = useState('current'); // 'current', 'today', 'custom'
  const [startDate, setStartDate] = useState(defaultStartDate || '');
  const [endDate, setEndDate] = useState(defaultEndDate || '');
  const [reportType, setReportType] = useState('alterations_pending'); // 'alterations_pending', 'alterations_all', 'orders_no_alterations'

  const handlePrint = () => {
    let query = `?reportType=${reportType}&dateMode=${dateMode}`;
    
    if (dateMode === 'custom' || dateMode === 'current') {
      if (!startDate || !endDate) {
        alert('יש להזין תאריך התחלה וסיום.');
        return;
      }
      query += `&startDate=${startDate}&endDate=${endDate}`;
    }

    window.open(`/print/alterations${query}`, '_blank');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}>
      <div 
        className="modal-content animate-fade-in" 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px',
          width: '100%', maxWidth: '550px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          position: 'relative'
        }}
      >
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X size={24} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-color)', margin: '0 0 1.5rem 0' }}>
          <Printer size={28} /> אשף הדפסה
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)' }}>סוג הדוח</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'alterations_pending' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'alterations_pending' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input type="radio" name="reportType" value="alterations_pending" checked={reportType === 'alterations_pending'} onChange={() => setReportType('alterations_pending')} style={{ margin: 0 }} />
              <Clock size={18} color={reportType === 'alterations_pending' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'alterations_pending' ? 'bold' : 'normal' }}>רשימת תיקונים (טרם בוצעו)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'alterations_all' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'alterations_all' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input type="radio" name="reportType" value="alterations_all" checked={reportType === 'alterations_all'} onChange={() => setReportType('alterations_all')} style={{ margin: 0 }} />
              <CheckCircle size={18} color={reportType === 'alterations_all' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'alterations_all' ? 'bold' : 'normal' }}>רשימת כל התיקונים (כולל בוצעו)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'orders_no_alterations' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'orders_no_alterations' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input type="radio" name="reportType" value="orders_no_alterations" checked={reportType === 'orders_no_alterations'} onChange={() => setReportType('orders_no_alterations')} style={{ margin: 0 }} />
              <FileText size={18} color={reportType === 'orders_no_alterations' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'orders_no_alterations' ? 'bold' : 'normal' }}>רשימת הזמנות ללא תיקונים</span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-main)' }}>טווח תאריכים</label>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="radio" name="dateMode" value="current" checked={dateMode === 'current'} onChange={() => setDateMode('current')} />
              <span>הנתונים המוצגים כעת</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="radio" name="dateMode" value="today" checked={dateMode === 'today'} onChange={() => setDateMode('today')} />
              <span>אירועים להיום בלבד</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="radio" name="dateMode" value="custom" checked={dateMode === 'custom'} onChange={() => setDateMode('custom')} />
              <span>טווח מותאם אישית</span>
            </label>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '15px',
            opacity: dateMode === 'custom' ? 1 : 0.5,
            pointerEvents: dateMode === 'custom' ? 'auto' : 'none',
            transition: 'opacity 0.3s'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: '4px' }}>מתאריך:</label>
              <HebrewDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: '4px' }}>עד תאריך:</label>
              <HebrewDatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            className="btn btn-outline" 
            onClick={onClose}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}
          >
            ביטול
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handlePrint}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Printer size={18} /> הכן להדפסה
          </button>
        </div>
      </div>
    </div>
  );
}
