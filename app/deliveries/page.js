'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import HebrewDateRangePicker from '@/components/HebrewDateRangePicker';
import ExportButtons from '../../components/ExportButtons';
import useDebounce from '@/hooks/useDebounce';
import { getHebrewDateString, getHebrewWeekdayFullName } from '@/lib/hebrewDate';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDaysToIso = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 'YYYY-MM-DD' -> local Date (same construction as addDaysToIso, avoids the
// UTC-parse shift of `new Date(iso)`), for formatting the range-table day headers.
const isoToLocalDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// עקבי עם הפורמט שכבר קיים ב-board/page.js למודל "הזמנות ליום X (תאריך עברי)" -
// כותרת יום בטבלת טווח היא תאריך לוח-שנה תפעולי (לא תאריך אירוע של הזמנה ספציפית),
// ולכן מוצג לועזי+עברי יחד, כמו שם, ולא רק eventDateHebrew כמו בעמודת הטבלה הרגילה.
const formatRangeDayHeader = (iso) => {
  const date = isoToLocalDate(iso);
  return `${date.toLocaleDateString('he-IL')} (${getHebrewDateString(date)})`;
};

// יום היציאה/האיסוף המחושב (dispatchDates מ-/api/deliveries, רק כש-deliveries_select_by_event_date
// דולקת - התאריך שנבחר במסך הוא אז תאריך האירוע, ולכן יום היציאה/האיסוף כבר לא משתמע מהבחירה).
// עקבי עם כותרת הדפסת המשלוחן ("משלוח יוצא/נאסף <יום שבוע>", lib/deliveryCourier.js).
const formatDispatchHint = (direction, iso) => {
  const date = isoToLocalDate(iso);
  return `${direction === 'out' ? 'יוצא' : 'נאסף'} ${getHebrewWeekdayFullName(date)} ${date.toLocaleDateString('he-IL')}`;
};

// תוויות/צבעים/אייקונים לכל כיוון משלוח - עקבי עם שפת ה-badge/dot-badge של design-system.css.
// הלוך (יוצא ללקוח) מקבל גוון warning (כמו "הושכר"/"בקרוב" - "עוד לא אצלנו"), חזור (חוזר מהלקוח)
// מקבל גוון info (כמו "הוחזר חלקי" - "בדרך חזרה") - בחירה עיצובית, אין רפרנס מדויק לכיוונים האלו.
const DIRECTION_META = {
  out: { label: 'משלוח הלוך', badgeClass: 'badge-warning', description: 'משלוח הלוך' },
  return: { label: 'משלוח חזור', badgeClass: 'badge-info', description: 'משלוח חזור' },
};

export default function DeliveriesPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [directionFilter, setDirectionFilter] = useState('all'); // 'all' | 'out' | 'return'
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  // 18 - טבלת טווח (שבוע/שבועיים/חודש) + עבר, מותנה ב-delivery_table_range_enabled
  const [rangeMode, setRangeMode] = useState('day'); // day | week | 2weeks | month
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [rangeRows, setRangeRows] = useState({}); // date -> rows
  // deliveries_select_by_event_date - התאריך שנבחר הוא תאריך האירוע (ולא יום הוצאה/חזרה)
  const [byEventDate, setByEventDate] = useState(false);

  // הדפסת/שליחת נתונים למשלוחן + הדפסת נתונים לשקית (§C/§D/§E,
  // docs/deliveries-feature-plan-2026-09-16.md) - מודל בחירה נפרד מטבלת התצוגה
  // (תאריך/כיוון עצמאיים, לא קשורים לבחירה הנוכחית בעמוד).
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printAction, setPrintAction] = useState('courier-print'); // courier-print | courier-email | bag-label
  const [printDirection, setPrintDirection] = useState('both'); // out | return | both
  const [printFrom, setPrintFrom] = useState(selectedDate);
  const [printTo, setPrintTo] = useState(selectedDate);
  const [printBagDate, setPrintBagDate] = useState(selectedDate);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null); // { ok, message }

  const openPrintModal = (action) => {
    setPrintAction(action);
    setPrintFrom(selectedDate);
    setPrintTo(selectedDate);
    setPrintBagDate(selectedDate);
    setEmailResult(null);
    setShowPrintModal(true);
  };

  const submitPrintModal = async () => {
    if (printAction === 'bag-label') {
      window.open(`/print/delivery-bag?date=${printBagDate}`, '_blank');
      setShowPrintModal(false);
      return;
    }
    if (printAction === 'courier-print') {
      window.open(`/print/delivery-courier?direction=${printDirection}&from=${printFrom}&to=${printTo}`, '_blank');
      setShowPrintModal(false);
      return;
    }
    // courier-email
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/deliveries/courier-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: printDirection, fromDate: printFrom, toDate: printTo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחת המייל');
      setEmailResult({ ok: true, message: `נשלח בהצלחה ל-${data.sentTo}` });
    } catch (err) {
      setEmailResult({ ok: false, message: err.message || 'שגיאה בשליחת המייל' });
    } finally {
      setEmailSending(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(arr => {
      const v = Array.isArray(arr) ? arr.find(s => s.key === 'delivery_table_range_enabled')?.value : null;
      if (v === 'true') setRangeEnabled(true);
      if (Array.isArray(arr) && arr.find(s => s.key === 'deliveries_select_by_event_date')?.value === 'true') setByEventDate(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 18 - אם range מופעל ובחירת טווח, טוען כמה ימים (כולל עבר)
    const days = rangeEnabled && rangeMode !== 'day'
      ? (rangeMode === 'week' ? 7 : rangeMode === '2weeks' ? 14 : 30)
      : 1;
    const dates = [];
    for (let i = 0; i < days; i++) dates.push(addDaysToIso(selectedDate, i));
    Promise.all(dates.map(d => fetch(`/api/deliveries?date=${d}`, { cache: 'no-store' }).then(res => res.json()).then(data => ({ date: d, rows: data.data || [] })).catch(() => ({ date: d, rows: [] }))))
      .then(all => {
        if (cancelled) return;
        const map = {};
        for (const a of all) map[a.date] = a.rows;
        setRangeRows(map);
        setRows(map[selectedDate] || []);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate, rangeMode, rangeEnabled]);

  // סינון כיוון + חיפוש חופשי מתבצעים על התוצאה של יום אחד (מצומצמת מטבעה) - בלי צורך
  // בעוד קריאת שרת על כל הקלדה, בדומה לסינוני viewMode/search המקומיים בטאבים אחרים.
  const filteredRows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return rows
      .filter(r => directionFilter === 'all' || r.directions.includes(directionFilter))
      .filter(r => {
        if (!term) return true;
        return (
          String(r.orderId).includes(term) ||
          (r.customerName || '').toLowerCase().includes(term) ||
          (r.customerPhone || '').includes(term) ||
          (r.customerPhone2 || '').includes(term) ||
          (r.address || '').toLowerCase().includes(term)
        );
      });
  }, [rows, directionFilter, debouncedSearch]);

  const visibleDirections = (row) => directionFilter === 'all' ? row.directions : row.directions.filter(d => d === directionFilter);

  // §B (docs/deliveries-feature-plan-2026-09-16.md) - פילוח משלוחים לפי עיר, "פיצ'ר קטן
  // שיעזור" לפי הניסוח המקורי (בהשראת הסטטיסטיקות של ה-AI). בתצוגת טווח מסתכל על כל הימים
  // שנטענו (כמו טבלת הטווח עצמה - בלי חיפוש חופשי, שם ה-18/17 המקורי לא מסנן לפי חיפוש
  // בטבלת הטווח); ביום בודד מסתכל בדיוק על filteredRows (כולל חיפוש), עקבי עם הטבלה הראשית.
  const cityBreakdown = useMemo(() => {
    const sourceRows = (rangeEnabled && rangeMode !== 'day')
      ? Object.values(rangeRows).flat().filter(r => directionFilter === 'all' || r.directions.includes(directionFilter))
      : filteredRows;
    const counts = {};
    for (const r of sourceRows) {
      const city = (r.city || '').trim() || 'לא ידוע';
      counts[city] = (counts[city] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rangeEnabled, rangeMode, rangeRows, filteredRows, directionFilter]);

  // שורת טבלה משותפת לטבלה הראשית (יום נבחר) ולטבלאות לכל יום בתצוגת טווח (18) -
  // כדי שתצוגת הטווח תציג טבלה אמיתית לכל יום (כל העמודות), לא רק רשימת טקסט
  // מצומצמת (עד 8 שורות, בלי כתובת/דגמים/חיוב) כמו קודם.
  const renderDeliveryRow = (row) => (
    <tr key={row.orderId}>
      <td>
        <div className="cell-primary">{row.customerName}</div>
        {row.customerPhone && <div className="cell-muted" dir="ltr" style={{ textAlign: 'start' }}>{row.customerPhone}</div>}
        {row.customerPhone2 && <div className="cell-muted" dir="ltr" style={{ textAlign: 'start' }}>{row.customerPhone2}</div>}
      </td>
      <td className="cell-primary">
        <Link href={`/orders/${row.orderId}`}>#{row.orderId}</Link>
      </td>
      <td>{row.address || <span className="cell-muted">-</span>}</td>
      <td>{row.dressModelNames.length > 0 ? row.dressModelNames.join(', ') : <span className="cell-muted">-</span>}</td>
      <td><strong>{row.eventDateHebrew || '-'}</strong></td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibleDirections(row).map(d => (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
              <span className={`badge ${DIRECTION_META[d].badgeClass}`}>
                <svg className="icon"><use href="#i-box" /></svg>
                {DIRECTION_META[d].label}
              </span>
              {row.dispatchDates?.[d] && <span className="cell-muted">{formatDispatchHint(d, row.dispatchDates[d])}</span>}
            </div>
          ))}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibleDirections(row).map(d => (
            row.chargeExists[d] ? (
              <span key={d} className="badge badge-success">
                <svg className="icon"><use href="#i-check" /></svg>
                נוצר חיוב
              </span>
            ) : (
              <span key={d} className="hint" style={{ color: 'var(--text-3)' }}>טרם נוצר חיוב</span>
            )
          ))}
        </div>
      </td>
    </tr>
  );

  const goPrevDay = () => setSelectedDate(d => addDaysToIso(d, -1));
  const goNextDay = () => setSelectedDate(d => addDaysToIso(d, 1));
  const goToday = () => setSelectedDate(todayIso());

  const exportData = filteredRows.map(r => ({
    ...r,
    directionsLabel: visibleDirections(r).map(d => DIRECTION_META[d].label).join(' + '),
    dressModelsLabel: r.dressModelNames.join(' | '),
    dispatchLabel: r.dispatchDates ? visibleDirections(r).map(d => formatDispatchHint(d, r.dispatchDates[d])).join(' | ') : '',
    chargeStatusLabel: visibleDirections(r).map(d => `${DIRECTION_META[d].label}: ${r.chargeExists[d] ? 'נוצר חיוב' : 'טרם נוצר חיוב'}`).join(' | '),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>משלוחים</h1>
          <div className="page-desc">סה&quot;כ רשומות: {loading ? '...' : filteredRows.length}</div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={() => openPrintModal('courier-print')}>
            <svg className="icon"><use href="#i-printer" /></svg>
            הדפסת משלוחים
          </button>
          <ExportButtons
            data={exportData}
            filename="משלוחים"
            columns={[
              { key: 'orderId', label: 'קוד הזמנה' },
              { key: 'customerName', label: 'לקוח' },
              { key: 'customerPhone', label: 'טלפון 1' },
              { key: 'customerPhone2', label: 'טלפון 2' },
              { key: 'address', label: 'כתובת' },
              { key: 'eventDateHebrew', label: 'תאריך אירוע' },
              { key: 'dressModelsLabel', label: 'דגמים' },
              { key: 'directionsLabel', label: 'כיוון משלוח' },
              ...(byEventDate ? [{ key: 'dispatchLabel', label: 'יציאה/איסוף' }] : []),
              { key: 'chargeStatusLabel', label: 'סטטוס חיוב' },
            ]}
            iconOnly={true}
          />
        </div>
      </div>

      {/* ניווט תאריך: קודם/היום/הבא + בורר תאריך עברי מלא */}
      <div className="toolbar">
        <button type="button" className="btn btn-secondary btn-icon-only" onClick={goPrevDay} title="יום קודם">
          <svg className="icon"><use href="#i-chevron-end" /></svg>
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={goToday}>היום</button>
        <button type="button" className="btn btn-secondary btn-icon-only" onClick={goNextDay} title="יום הבא">
          <svg className="icon"><use href="#i-chevron-start" /></svg>
        </button>
        <div style={{ width: '260px' }}>
          <HebrewDatePicker value={selectedDate} onChange={setSelectedDate} />
        </div>
        {byEventDate && <span className="hint">מוצגים משלוחים להזמנות שתאריך האירוע שלהן הוא התאריך שנבחר</span>}
      </div>

      {/* סרגל חיפוש חופשי (הזמנה/לקוח/טלפון) */}
      <div className="toolbar">
        <div className="search-toolbar">
          <svg className="icon"><use href="#i-search" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש (הזמנה, לקוח, טלפון)..."
          />
          <div className="search-toolbar-actions">
            {search && (
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה חיפוש" onClick={() => setSearch('')}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* סינון כיוון משלוח + 18 טווח */}
      <div className="pill-tabs" style={{ marginBottom: '12px' }}>
        <button type="button" onClick={() => setDirectionFilter('all')} className={directionFilter === 'all' ? 'pill-tab active' : 'pill-tab'}>
          <svg className="icon"><use href="#i-list" /></svg> הכל
        </button>
        <button type="button" onClick={() => setDirectionFilter('out')} className={directionFilter === 'out' ? 'pill-tab active' : 'pill-tab'}>
          <svg className="icon"><use href="#i-box" /></svg> משלוח הלוך בלבד
        </button>
        <button type="button" onClick={() => setDirectionFilter('return')} className={directionFilter === 'return' ? 'pill-tab active' : 'pill-tab'}>
          <svg className="icon"><use href="#i-box" /></svg> משלוח חזור בלבד
        </button>
      </div>
      {rangeEnabled && (
        <div className="pill-tabs" style={{ marginBottom: '20px' }}>
          {[{ v: 'day', l: 'יום אחד' }, { v: 'week', l: 'שבוע' }, { v: '2weeks', l: 'שבועיים' }, { v: 'month', l: 'חודש' }].map(o => (
            <button key={o.v} type="button" onClick={() => setRangeMode(o.v)} className={rangeMode === o.v ? 'pill-tab active' : 'pill-tab'}>{o.l}</button>
          ))}
        </div>
      )}
      {/* §B - פילוח משלוחים לפי עיר, למשל "ירושלים: 3 · קרית ספר: 2 · ביתר: 5" */}
      {!loading && cityBreakdown.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '13px', color: 'var(--text-3)' }}>פילוח לפי ערים:</strong>
          {cityBreakdown.map(([city, count]) => (
            <span key={city} className="badge badge-neutral">{city}: {count}</span>
          ))}
        </div>
      )}

      {/* 18 - תצוגת טווח: טבלה מלאה (כל העמודות) לכל יום בטווח, כולל עבר */}
      {rangeEnabled && rangeMode !== 'day' && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>טבלת משלוחים לטווח ({rangeMode === 'week' ? 'שבוע' : rangeMode === '2weeks' ? 'שבועיים' : 'חודש'})</h3>
          {Object.keys(rangeRows).sort().map(d => {
            const dayRows = (rangeRows[d] || []).filter(r => directionFilter === 'all' || r.directions.includes(directionFilter));
            if (dayRows.length === 0) return null;
            return (
              <div key={d} className="card card-pad" style={{ marginBottom: 12 }}>
                <strong style={{ display: 'block', marginBottom: 8 }}>{byEventDate ? 'אירועים ב-' : ''}{formatRangeDayHeader(d)} - {dayRows.length} משלוחים</strong>
                <div className="table-wrap">
                  <div className="table-scroll">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>לקוח</th>
                          <th>הזמנה</th>
                          <th>כתובת</th>
                          <th>דגמים</th>
                          <th>תאריך אירוע</th>
                          <th>כיוון משלוח</th>
                          <th>חיוב משלוח</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRows.map(renderDeliveryRow)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>הזמנה</th>
                <th>כתובת</th>
                <th>דגמים</th>
                <th>תאריך אירוע</th>
                <th>כיוון משלוח</th>
                <th>חיוב משלוח</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7"><div className="loading-inline"><span className="spinner" />טוען נתונים...</div></td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <svg className="icon"><use href="#i-box" /></svg>
                      <h4>{byEventDate ? 'אין משלוחים לאירועים ביום זה' : 'אין משלוחים ליום זה'}</h4>
                      <p>{byEventDate ? 'לא נמצאו הזמנות עם משלוח שתאריך האירוע שלהן הוא התאריך שנבחר.' : 'לא נמצאו הזמנות עם משלוח הלוך או חזור בתאריך שנבחר.'}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.map(renderDeliveryRow)}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>סה&quot;כ רשומות: {loading ? '...' : filteredRows.length}</span>
        </div>
      </div>

      {/* מודל "הדפסת משלוחים" (§C/§D/§E) - 3 פעולות: הדפסה למשלוחן, שליחה במייל, הדפסת נתונים לשקית */}
      {showPrintModal && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget && !emailSending) setShowPrintModal(false); }}
        >
          <div className="modal" style={{ maxWidth: '480px', width: '100%', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>הדפסת משלוחים</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowPrintModal(false)} disabled={emailSending}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="pill-tabs" style={{ marginBottom: '16px' }}>
                <button type="button" className={`pill-tab${printAction === 'courier-print' ? ' active' : ''}`} onClick={() => { setPrintAction('courier-print'); setEmailResult(null); }}>הדפסה למשלוחן</button>
                <button type="button" className={`pill-tab${printAction === 'courier-email' ? ' active' : ''}`} onClick={() => { setPrintAction('courier-email'); setEmailResult(null); }}>שליחה במייל</button>
                <button type="button" className={`pill-tab${printAction === 'bag-label' ? ' active' : ''}`} onClick={() => { setPrintAction('bag-label'); setEmailResult(null); }}>הדפסת נתונים לשקית</button>
              </div>

              {printAction === 'bag-label' ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>{byEventDate ? 'תאריך אירוע (משלוחי הלוך בלבד)' : 'תאריך (משלוחי הלוך בלבד)'}</label>
                  <HebrewDatePicker value={printBagDate} onChange={setPrintBagDate} />
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>כיוון משלוח</label>
                    <div className="pill-tabs">
                      <button type="button" className={`pill-tab${printDirection === 'both' ? ' active' : ''}`} onClick={() => setPrintDirection('both')}>הלוך וחזור</button>
                      <button type="button" className={`pill-tab${printDirection === 'out' ? ' active' : ''}`} onClick={() => setPrintDirection('out')}>הלוך בלבד</button>
                      <button type="button" className={`pill-tab${printDirection === 'return' ? ' active' : ''}`} onClick={() => setPrintDirection('return')}>חזור בלבד</button>
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>{byEventDate ? 'טווח תאריכי אירוע' : 'טווח תאריכים'}</label>
                    <HebrewDateRangePicker startDate={printFrom} endDate={printTo} onChange={(start, end) => { setPrintFrom(start); setPrintTo(end); }} />
                  </div>
                </>
              )}

              {emailResult && (
                <p className="hint" style={{ marginTop: '12px', color: emailResult.ok ? 'var(--success)' : 'var(--danger)' }}>
                  {emailResult.message}
                </p>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPrintModal(false)} disabled={emailSending}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={submitPrintModal} disabled={emailSending}>
                {emailSending ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-check" /></svg>}
                {printAction === 'courier-email' ? (emailSending ? 'שולח...' : 'שליחה') : 'הדפסה'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
