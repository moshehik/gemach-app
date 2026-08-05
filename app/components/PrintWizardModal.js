'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Calendar as CalendarIcon, Clock, CheckCircle, FileText, X, FileDown } from 'lucide-react';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import { downloadPdf as downloadGeneratedPdf } from '../lib/pdfClient';

// Mirrors getReportTitle() in app/print/alterations/page.js - kept as a small local copy
// here since it's only used to name the downloaded file, not to render anything.
const REPORT_FILENAMES = {
  orders_all: 'דוח הזמנות כללי',
  orders_no_alterations: 'רשימת הזמנות ללא תיקונים',
  alterations_all: 'כל התיקונים',
  labels: 'תוויות לתופרות',
  alterations_pending: 'רשימת תיקונים לביצוע',
};

export default function PrintWizardModal({ onClose, defaultStartDate, defaultEndDate, defaultReportType, getCurrentOrderIds }) {
  const [dateMode, setDateMode] = useState('current'); // 'current', 'today', 'custom'
  const [startDate, setStartDate] = useState(defaultStartDate || '');
  const [endDate, setEndDate] = useState(defaultEndDate || '');
  const [reportType, setReportType] = useState(defaultReportType || 'alterations_pending'); // 'alterations_pending', 'alterations_all', 'orders_no_alterations', 'orders_all'
  const [mounted, setMounted] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = async (downloadPdf = false) => {
    let query = `?reportType=${reportType}&dateMode=${dateMode}`;

    if (dateMode === 'custom') {
      if (!startDate || !endDate) {
        alert('יש להזין תאריך התחלה וסיום.');
        return;
      }
      query += `&startDate=${startDate}&endDate=${endDate}`;
    } else if (dateMode === 'current') {
      if (getCurrentOrderIds) {
        // Reflect exactly what's currently filtered/shown (search, status,
        // advanced filters) rather than just an optional date range.
        setIsPreparing(true);
        let orderIds;
        try {
          orderIds = await getCurrentOrderIds();
        } finally {
          setIsPreparing(false);
        }
        if (!orderIds || orderIds.length === 0) {
          alert('לא נמצאו רשומות התואמות לסינון הנוכחי.');
          return;
        }
        query += `&orderIds=${orderIds.join(',')}`;
      } else {
        if (startDate) query += `&startDate=${startDate}`;
        if (endDate) query += `&endDate=${endDate}`;
      }
    }

    if (downloadPdf) {
      query += `&downloadPdf=true`;
      // Real server-side PDF (Puppeteer, see app/api/pdf/route.js) instead of the old
      // hidden-iframe + html2pdf.js hack: the route navigates to /print/alterations itself
      // (forwarding this browser's auth cookie) and returns a real, paginated PDF with
      // selectable text, which we just hand to the browser's normal download flow.
      setIsPreparing(true);
      try {
        await downloadGeneratedPdf(
          { path: `/print/alterations${query}` },
          `${REPORT_FILENAMES[reportType] || 'דוח'}.pdf`
        );
      } catch (err) {
        console.error(err);
        alert('אירעה שגיאה ביצירת ה-PDF: ' + (err.message || 'שגיאה לא ידועה'));
      } finally {
        setIsPreparing(false);
      }
      onClose();
      return;
    }

    window.open(`/print/alterations${query}`, '_blank');
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div data-element-name="לחיץ_PrintWizardModal_1" className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999
    }}>
      <div data-element-name="לחיץ_PrintWizardModal_2" 
        className="modal-content animate-fade-in" 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px',
          width: '100%', maxWidth: '550px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          position: 'relative'
        }}
      >
        <button data-element-name="כפתור_PrintWizardModal_3" 
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X data-element-name="רכיב_PrintWizardModal_4" size={24} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-color)', margin: '0 0 1.5rem 0' }}>
          <Printer data-element-name="רכיב_PrintWizardModal_5" size={28} /> אשף הדפסה
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)' }}>סוג הדוח</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'alterations_pending' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'alterations_pending' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input data-element-name="שדה_PrintWizardModal_6" type="radio" name="reportType" value="alterations_pending" checked={reportType === 'alterations_pending'} onChange={() => setReportType('alterations_pending')} style={{ margin: 0 }} />
              <Clock data-element-name="רכיב_PrintWizardModal_7" size={18} color={reportType === 'alterations_pending' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'alterations_pending' ? 'bold' : 'normal' }}>רשימת תיקונים (טרם בוצעו)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'alterations_all' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'alterations_all' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input data-element-name="שדה_PrintWizardModal_8" type="radio" name="reportType" value="alterations_all" checked={reportType === 'alterations_all'} onChange={() => setReportType('alterations_all')} style={{ margin: 0 }} />
              <CheckCircle data-element-name="רכיב_PrintWizardModal_9" size={18} color={reportType === 'alterations_all' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'alterations_all' ? 'bold' : 'normal' }}>רשימת כל התיקונים (כולל בוצעו)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'orders_no_alterations' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'orders_no_alterations' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input data-element-name="שדה_PrintWizardModal_10" type="radio" name="reportType" value="orders_no_alterations" checked={reportType === 'orders_no_alterations'} onChange={() => setReportType('orders_no_alterations')} style={{ margin: 0 }} />
              <FileText data-element-name="רכיב_PrintWizardModal_11" size={18} color={reportType === 'orders_no_alterations' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'orders_no_alterations' ? 'bold' : 'normal' }}>רשימת הזמנות ללא תיקונים</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'orders_all' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'orders_all' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input data-element-name="שדה_PrintWizardModal_12" type="radio" name="reportType" value="orders_all" checked={reportType === 'orders_all'} onChange={() => setReportType('orders_all')} style={{ margin: 0 }} />
              <FileText data-element-name="רכיב_PrintWizardModal_13" size={18} color={reportType === 'orders_all' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'orders_all' ? 'bold' : 'normal' }}>דוח הזמנות כללי (כל ההזמנות)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', border: reportType === 'labels' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', background: reportType === 'labels' ? 'rgba(212,175,55,0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input data-element-name="שדה_PrintWizardModal_14" type="radio" name="reportType" value="labels" checked={reportType === 'labels'} onChange={() => setReportType('labels')} style={{ margin: 0 }} />
              <Printer data-element-name="רכיב_PrintWizardModal_15" size={18} color={reportType === 'labels' ? 'var(--primary-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: reportType === 'labels' ? 'bold' : 'normal' }}>הדפסת תוויות לתופרות (לתיקונים שטרם בוצעו)</span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-main)' }}>טווח תאריכים</label>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input data-element-name="שדה_PrintWizardModal_16" type="radio" name="dateMode" value="current" checked={dateMode === 'current'} onChange={() => setDateMode('current')} />
              <span>הנתונים המוצגים כעת</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input data-element-name="שדה_PrintWizardModal_17" type="radio" name="dateMode" value="today" checked={dateMode === 'today'} onChange={() => setDateMode('today')} />
              <span>אירועים להיום בלבד</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input data-element-name="שדה_PrintWizardModal_18" type="radio" name="dateMode" value="custom" checked={dateMode === 'custom'} onChange={() => setDateMode('custom')} />
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
              <HebrewDatePicker data-element-name="רכיב_PrintWizardModal_19" value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.9em', color: 'var(--text-muted)', marginBottom: '4px' }}>עד תאריך:</label>
              <HebrewDatePicker data-element-name="רכיב_PrintWizardModal_20" value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button data-element-name="כפתור_PrintWizardModal_21" 
            className="btn btn-outline" 
            onClick={onClose}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}
          >
            ביטול
          </button>
          <button data-element-name="כפתור_PrintWizardModal_pdf"
            title="הורד כ-PDF"
            aria-label="הורד כ-PDF"
            disabled={isPreparing}
            onClick={() => handlePrint(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: isPreparing ? 'wait' : 'pointer',
              color: 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              borderRadius: '50%',
              transition: 'all 0.2s',
              opacity: isPreparing ? 0.6 : 1
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <FileDown data-element-name="רכיב_PrintWizardModal_pdf_icon" size={22} />
          </button>
          <button data-element-name="כפתור_PrintWizardModal_22"
            title="הכן להדפסה"
            aria-label="הכן להדפסה"
            disabled={isPreparing}
            onClick={() => handlePrint(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: isPreparing ? 'wait' : 'pointer',
              color: 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              borderRadius: '50%',
              transition: 'all 0.2s',
              opacity: isPreparing ? 0.6 : 1
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Printer data-element-name="רכיב_PrintWizardModal_23" size={24} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
