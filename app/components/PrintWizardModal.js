'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

const REPORT_TYPE_OPTIONS = [
  { value: 'alterations_pending', icon: 'i-clock', label: 'רשימת תיקונים (טרם בוצעו)' },
  { value: 'alterations_all', icon: 'i-check-circle', label: 'רשימת כל התיקונים (כולל בוצעו)' },
  { value: 'orders_no_alterations', icon: 'i-file', label: 'רשימת הזמנות ללא תיקונים' },
  { value: 'orders_all', icon: 'i-file', label: 'דוח הזמנות כללי (כל ההזמנות)' },
  { value: 'labels', icon: 'i-printer', label: 'הדפסת תוויות לתופרות (לתיקונים שטרם בוצעו)' },
];

const DATE_MODE_OPTIONS = [
  { value: 'current', label: 'הנתונים המוצגים כעת' },
  { value: 'today', label: 'אירועים להיום בלבד' },
  { value: 'custom', label: 'טווח מותאם אישית' },
];

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
    <div
      data-element-name="לחיץ_PrintWizardModal_1"
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      onClick={onClose}
    >
      <div
        data-element-name="לחיץ_PrintWizardModal_2"
        className="modal animate-fade-in"
        style={{ maxWidth: '560px', margin: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-printer" /></svg>
            אשף הדפסה
          </strong>
          <button
            data-element-name="כפתור_PrintWizardModal_3"
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon-only btn-sm"
            title="סגירה"
            aria-label="סגירה"
          >
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>סוג הדוח</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {REPORT_TYPE_OPTIONS.map(opt => (
                <div className="checkbox-row" key={opt.value}>
                  <input
                    data-element-name={`שדה_PrintWizardModal_${opt.value}`}
                    type="radio"
                    id={`printWizard-reportType-${opt.value}`}
                    name="printWizard-reportType"
                    value={opt.value}
                    checked={reportType === opt.value}
                    onChange={() => setReportType(opt.value)}
                  />
                  <label htmlFor={`printWizard-reportType-${opt.value}`}>
                    <svg className="icon" style={{ marginInlineEnd: '4px' }}><use href={`#${opt.icon}`} /></svg>
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="field" style={{ background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', padding: '14px', border: '1px solid var(--border)' }}>
            <label>טווח תאריכים</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {DATE_MODE_OPTIONS.map(opt => (
                <div className="checkbox-row" key={opt.value}>
                  <input
                    data-element-name={`שדה_PrintWizardModal_dateMode_${opt.value}`}
                    type="radio"
                    id={`printWizard-dateMode-${opt.value}`}
                    name="printWizard-dateMode"
                    value={opt.value}
                    checked={dateMode === opt.value}
                    onChange={() => setDateMode(opt.value)}
                  />
                  <label htmlFor={`printWizard-dateMode-${opt.value}`}>{opt.label}</label>
                </div>
              ))}
            </div>

            <div
              className="form-grid"
              style={{
                opacity: dateMode === 'custom' ? 1 : 0.5,
                pointerEvents: dateMode === 'custom' ? 'auto' : 'none',
                transition: 'opacity 0.2s',
              }}
            >
              <div className="field" style={{ marginBottom: 0 }}>
                <label>מתאריך</label>
                <HebrewDatePicker data-element-name="רכיב_PrintWizardModal_19" value={startDate} onChange={setStartDate} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>עד תאריך</label>
                <HebrewDatePicker data-element-name="רכיב_PrintWizardModal_20" value={endDate} onChange={setEndDate} />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button
            data-element-name="כפתור_PrintWizardModal_21"
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            ביטול
          </button>
          <button
            data-element-name="כפתור_PrintWizardModal_pdf"
            type="button"
            className="btn btn-ghost btn-icon-only"
            title="הורד כ-PDF"
            aria-label="הורד כ-PDF"
            disabled={isPreparing}
            onClick={() => handlePrint(true)}
          >
            <svg className="icon"><use href="#i-download" /></svg>
          </button>
          <button
            data-element-name="כפתור_PrintWizardModal_22"
            type="button"
            className="btn btn-ghost btn-icon-only"
            title="הכן להדפסה"
            aria-label="הכן להדפסה"
            disabled={isPreparing}
            onClick={() => handlePrint(false)}
          >
            <svg className="icon"><use href="#i-printer" /></svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
