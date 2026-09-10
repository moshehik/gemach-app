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
  // בקשות c5032b47/ed6c69bc: פירוט מלא (עמוד נפרד לכל הזמנה, ר' /print/order) של
  // ההזמנות שדורשות הכנה לפי תאריך - לא רשימה מרוכזת כמו שאר סוגי הדוח למעלה.
  { value: 'order_prep_by_date', icon: 'i-printer', label: 'פירוט הזמנות להכנה (עמוד נפרד לכל הזמנה, לפי תאריך)' },
];

const DATE_MODE_OPTIONS = [
  { value: 'current', label: 'הנתונים המוצגים כעת' },
  { value: 'today', label: 'אירועים להיום בלבד' },
  { value: 'custom', label: 'טווח מותאם אישית' },
];

// אפשרויות בחירת תאריך ייעודיות ל"פירוט הזמנות להכנה" - שונה במכוון מ-DATE_MODE_OPTIONS
// למעלה: כאן "היום" הוא ברירת המחדל (לא רק אחת האפשרויות) ומשמעות התאריך היא "תאריך
// ההכנה" (getPrintPrepDate) ולא תאריך האירוע עצמו, אז לא נכון לערבב בין שתי הרשימות.
const PREP_DATE_MODE_OPTIONS = [
  { value: 'prep_today', label: 'הכנות להיום' },
  { value: 'single', label: 'תאריך אחר' },
  { value: 'custom', label: 'טווח תאריכים' },
];

export default function PrintWizardModal({ onClose, defaultStartDate, defaultEndDate, defaultReportType, getCurrentOrderIds }) {
  const [dateMode, setDateMode] = useState(defaultReportType === 'order_prep_by_date' ? 'prep_today' : 'current');
  const [startDate, setStartDate] = useState(defaultStartDate || '');
  const [endDate, setEndDate] = useState(defaultEndDate || '');
  const [reportType, setReportType] = useState(defaultReportType || 'alterations_pending'); // 'alterations_pending', 'alterations_all', 'orders_no_alterations', 'orders_all', 'order_prep_by_date'
  const [mounted, setMounted] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // מעבר בין "פירוט הזמנות להכנה" לשאר סוגי הדוח (או ההפך) תוך כדי שהמודל פתוח -
  // dateMode של קבוצה אחת לא תקין בקבוצה השנייה (ר' ההערה מעל PREP_DATE_MODE_OPTIONS),
  // אז מאפסים לברירת המחדל המתאימה כשעוברים בין הקבוצות.
  useEffect(() => {
    const isPrepType = reportType === 'order_prep_by_date';
    const prepModeValues = PREP_DATE_MODE_OPTIONS.map(o => o.value);
    if (isPrepType && !prepModeValues.includes(dateMode)) {
      setDateMode('prep_today');
    } else if (!isPrepType && prepModeValues.includes(dateMode)) {
      setDateMode('current');
    }
  }, [reportType]);

  // "פירוט הזמנות להכנה" (order_prep_by_date) לא מתאים לנתיב /print/alterations
  // שהתאריכים למעלה בנויים בשבילו - הוא בכלל מדפיס עמוד מלא לכל הזמנה בנפרד
  // (/print/order, כבר תומך בהדפסה מרוכזת + מיון משלוחים קודם, ר' app/print/order/page.js),
  // אז קודם צריך לפתור אילו מספרי הזמנה מתאימים (GET /api/orders/print-prep) ורק
  // אחר כך לפתוח את חלון ההדפסה עם הרשימה - בלי קשר ללוגיקת handlePrint הרגילה למטה.
  const handlePrepPrint = async () => {
    let query;
    if (dateMode === 'single') {
      if (!startDate) {
        alert('יש לבחור תאריך.');
        return;
      }
      // mode=event: מדפיס את כל ההזמנות שהאירוע שלהן חל בתאריך הזה עצמו -
      // לא הזמנות שההכנה שלהן יוצאת לתאריך הזה (ר' דיווח df17fb16).
      query = `date=${startDate}&mode=event`;
    } else if (dateMode === 'custom') {
      if (!startDate || !endDate) {
        alert('יש להזין תאריך התחלה וסיום.');
        return;
      }
      query = `from=${startDate}&to=${endDate}&mode=event`;
    } else {
      // 'prep_today' - תואם את הפורמט (en-CA = YYYY-MM-DD) שכבר משמש לקיבוץ הזמנות
      // לפי תאריך ב-app/board/page.js.
      query = `date=${new Date().toLocaleDateString('en-CA')}`;
    }

    setIsPreparing(true);
    try {
      const res = await fetch(`/api/orders/print-prep?${query}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליפת הזמנות להכנה');
      if (!data.orderIds || data.orderIds.length === 0) {
        alert('לא נמצאו הזמנות התואמות לתאריך/טווח שנבחר.');
        return;
      }
      window.open(`/print/order?orderId=${data.orderIds.join(',')}&type=order`, '_blank');
      onClose();
    } catch (err) {
      console.error(err);
      alert('שגיאה בהכנת ההדפסה: ' + (err.message || 'שגיאה לא ידועה'));
    } finally {
      setIsPreparing(false);
    }
  };

  const handlePrint = async (downloadPdf = false) => {
    if (reportType === 'order_prep_by_date') {
      await handlePrepPrint();
      return;
    }
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

          {reportType === 'order_prep_by_date' ? (
            <div className="field" style={{ background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', padding: '14px', border: '1px solid var(--border)' }}>
              <label>{dateMode === 'prep_today' ? 'תאריך ההכנה' : 'תאריך האירוע'}</label>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {PREP_DATE_MODE_OPTIONS.map(opt => (
                  <div className="checkbox-row" key={opt.value}>
                    <input
                      data-element-name={`שדה_PrintWizardModal_prepDateMode_${opt.value}`}
                      type="radio"
                      id={`printWizard-prepDateMode-${opt.value}`}
                      name="printWizard-prepDateMode"
                      value={opt.value}
                      checked={dateMode === opt.value}
                      onChange={() => setDateMode(opt.value)}
                    />
                    <label htmlFor={`printWizard-prepDateMode-${opt.value}`}>{opt.label}</label>
                  </div>
                ))}
              </div>

              {dateMode === 'prep_today' && (
                <div className="hint">
                  יודפסו כל ההזמנות שהאירוע שלהן חל כך שיש להתחיל להכין את השמלות היום
                  (3 ימי עסקים לפני האירוע, מדלג על שישי/שבת/חג).
                </div>
              )}
              {dateMode === 'single' && (
                <>
                  <div className="field" style={{ marginBottom: '12px' }}>
                    <label>תאריך</label>
                    <HebrewDatePicker value={startDate} onChange={setStartDate} />
                  </div>
                  <div className="hint">
                    יודפסו כל ההזמנות שהאירוע שלהן חל בתאריך שנבחר (ללא קשר למועד ההכנה שלהן).
                  </div>
                </>
              )}
              {dateMode === 'custom' && (
                <>
                  <div className="form-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>מתאריך</label>
                      <HebrewDatePicker value={startDate} onChange={setStartDate} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>עד תאריך</label>
                      <HebrewDatePicker value={endDate} onChange={setEndDate} />
                    </div>
                  </div>
                  <div className="hint">
                    יודפסו כל ההזמנות שהאירוע שלהן חל בטווח שנבחר (ללא קשר למועד ההכנה שלהן).
                  </div>
                </>
              )}
            </div>
          ) : (
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
          )}
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
          {reportType !== 'order_prep_by_date' && (
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
          )}
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
