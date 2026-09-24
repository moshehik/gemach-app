'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHebrewWeekdayFullName } from '@/lib/hebrewDate';
import PrintToolbar from '../PrintToolbar';

// 'YYYY-MM-DD' -> Date מקומי בחצות (בלי הזזת יום של new Date(iso) שמפורש כ-UTC)
const isoToLocalDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// תאריך אירוע לועזי לפי היום הישראלי (eventDate נשמר לרוב כ-...T21:00Z ליום הבא)
const formatEventGregorian = (eventDate) =>
  new Date(eventDate).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

// הדפסת "נתונים לשקית" (§E, docs/deliveries-feature-plan-2026-09-16.md) - דף A4 לרוחב
// לכל הזמנה עם משלוח הלוך בתאריך שנבחר, מיועד להידוק על שקית האריזה: שם פרטי, שם
// משפחה, כתובת ו-2 מספרי טלפון בפונט גדול. Query param יחיד: date=YYYY-MM-DD - רק
// משלוחי הלוך, בלי בחירת כיוון (המערכת מסננת אוטומטית).
// דיווח מייל 2026-09-18 (סעיף 3): בכל דף מוצגים גם תאריך האירוע (עברי+לועזי), שדה ידני
// "שקית ___ מתוך ___" (אין במערכת נתון של מספר שקיות להזמנה - קווים למילוי בכתב יד),
// והערות ההזמנה (Order.notes - "הערות כלליות להזמנה", אותו שדה שמודפס בדף ההזמנה).
// כשההגדרה deliveries_select_by_event_date דולקת, date הוא תאריך האירוע והדף מציין גם את
// יום היציאה המחושב (row.dispatchDates.out) - כמו הכותרת בהדפסת המשלוחן.
export default function PrintDeliveryBagPage() {
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || '';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectByEventDate, setSelectByEventDate] = useState(false);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('תאריך לא תקין');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/deliveries?date=${date}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setSelectByEventDate(!!data.selectByEventDate);
        setRows((data.data || []).filter(r => r.directions.includes('out')));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError('שגיאה בטעינת נתוני המשלוחים'); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    if (!loading && !error && rows.length > 0) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, error, rows]);

  return (
    <>
      <style>{`
        body { background-color: #fafafa !important; }
        nav.navbar, .global-sidebar-container, .topbar, .ai-floating-widget, [class*="sidebar"], [id*="sidebar"] {
          display: none !important;
        }
        .bag-label-page {
          background: #fff;
          width: 277mm;
          min-height: 190mm;
          margin: 20px auto;
          padding: 20mm;
          border: 1px solid #efefef;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          font-family: 'David Libre', 'Times New Roman', Georgia, serif;
          color: #222;
          direction: rtl;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }
        .bag-label-name { font-size: 46px; font-weight: 700; margin-bottom: 18px; }
        .bag-label-address { font-size: 30px; margin-bottom: 24px; }
        .bag-label-phones { font-size: 26px; display: flex; gap: 40px; }
        .bag-label-event { font-size: 26px; margin-top: 24px; }
        .bag-label-dispatch { font-size: 22px; margin-top: 6px; color: #444; }
        .bag-label-count { font-size: 30px; margin-top: 24px; display: flex; align-items: flex-end; gap: 12px; }
        .bag-label-blank { display: inline-block; width: 70px; border-bottom: 2px solid #222; height: 1.1em; }
        .bag-label-notes { font-size: 22px; margin-top: 24px; white-space: pre-wrap; line-height: 1.35; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
          .bag-label-page {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            min-height: 0 !important;
            height: calc(100vh - 20mm);
            margin: 0 !important;
            break-after: page;
            page-break-after: always;
          }
          .bag-label-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <PrintToolbar />
      {loading && <p style={{ padding: 20 }}>טוען נתונים...</p>}
      {!loading && error && <p style={{ padding: 20, color: '#c0392b' }}>{error}</p>}
      {!loading && !error && rows.length === 0 && <p style={{ padding: 20 }}>{selectByEventDate ? 'אין משלוחי הלוך לאירועים בתאריך זה.' : 'אין משלוחי הלוך בתאריך זה.'}</p>}
      {!loading && !error && rows.map(r => (
        <div className="bag-label-page" key={r.orderId}>
          <div className="bag-label-name">{r.customerFirstName} {r.customerLastName}</div>
          <div className="bag-label-address">{r.address || '-'}</div>
          <div className="bag-label-phones">
            {r.customerPhone && <span dir="ltr">{r.customerPhone}</span>}
            {r.customerPhone2 && <span dir="ltr">{r.customerPhone2}</span>}
          </div>
          <div className="bag-label-event">
            <strong>תאריך אירוע: </strong>
            {getHebrewWeekdayFullName(r.eventDate)} {r.eventDateHebrew || ''} ({formatEventGregorian(r.eventDate)})
          </div>
          {r.dispatchDates?.out && (
            <div className="bag-label-dispatch">
              משלוח יוצא: {getHebrewWeekdayFullName(isoToLocalDate(r.dispatchDates.out))} {isoToLocalDate(r.dispatchDates.out).toLocaleDateString('he-IL')}
            </div>
          )}
          <div className="bag-label-count">
            <span>שקית</span><span className="bag-label-blank" />
            <span>מתוך</span><span className="bag-label-blank" />
          </div>
          {r.notes && (
            <div className="bag-label-notes"><strong>הערות: </strong>{r.notes}</div>
          )}
        </div>
      ))}
    </>
  );
}
