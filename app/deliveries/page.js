'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import ExportButtons from '../../components/ExportButtons';
import useDebounce from '@/hooks/useDebounce';
import { getHebrewDateString } from '@/lib/hebrewDate';

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
  const [deliveryDaysBefore, setDeliveryDaysBefore] = useState(null);
  const [deliveryDaysAfter, setDeliveryDaysAfter] = useState(null);
  // 18 - טבלת טווח (שבוע/שבועיים/חודש) + עבר, מותנה ב-delivery_table_range_enabled
  const [rangeMode, setRangeMode] = useState('day'); // day | week | 2weeks | month
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [rangeRows, setRangeRows] = useState({}); // date -> rows

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(arr => {
      const v = Array.isArray(arr) ? arr.find(s => s.key === 'delivery_table_range_enabled')?.value : null;
      if (v === 'true') setRangeEnabled(true);
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
    Promise.all(dates.map(d => fetch(`/api/deliveries?date=${d}`, { cache: 'no-store' }).then(res => res.json()).then(data => ({ date: d, rows: data.data || [], before: data.deliveryDaysBefore, after: data.deliveryDaysAfter })).catch(() => ({ date: d, rows: [] }))))
      .then(all => {
        if (cancelled) return;
        const map = {};
        for (const a of all) map[a.date] = a.rows;
        setRangeRows(map);
        setRows(map[selectedDate] || []);
        const first = all[0];
        setDeliveryDaysBefore(first?.before ?? null);
        setDeliveryDaysAfter(first?.after ?? null);
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

  const goPrevDay = () => setSelectedDate(d => addDaysToIso(d, -1));
  const goNextDay = () => setSelectedDate(d => addDaysToIso(d, 1));
  const goToday = () => setSelectedDate(todayIso());

  const exportData = filteredRows.map(r => ({
    ...r,
    directionsLabel: visibleDirections(r).map(d => DIRECTION_META[d].label).join(' + '),
    dressModelsLabel: r.dressModelNames.join(' | '),
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
              { key: 'chargeStatusLabel', label: 'סטטוס חיוב' },
            ]}
            iconOnly={true}
          />
        </div>
      </div>

      {(deliveryDaysBefore !== null || deliveryDaysAfter !== null) && (
        <div className="callout callout-info" style={{ marginBottom: '16px' }}>
          <svg className="icon"><use href="#i-info" /></svg>
          <span>
            משלוח הלוך יוצא {deliveryDaysBefore} {deliveryDaysBefore === 1 ? 'יום' : 'ימים'} לפני תאריך האירוע, ומשלוח חזור נאסף {deliveryDaysAfter} {deliveryDaysAfter === 1 ? 'יום' : 'ימים'} אחריו (ניתן לשנות בהגדרות מערכת, קטגוריית &quot;משלוחים&quot;).
          </span>
        </div>
      )}

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
      {/* 18 - תצוגת טווח: טבלה לכל יום (כולל עבר) */}
      {rangeEnabled && rangeMode !== 'day' && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>טבלת משלוחים לטווח ({rangeMode === 'week' ? 'שבוע' : rangeMode === '2weeks' ? 'שבועיים' : 'חודש'})</h3>
          {Object.keys(rangeRows).sort().map(d => {
            const dayRows = (rangeRows[d] || []).filter(r => directionFilter === 'all' || r.directions.includes(directionFilter));
            return (
              <div key={d} style={{ marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <strong>{formatRangeDayHeader(d)}</strong> - {dayRows.length} משלוחים
                {dayRows.slice(0, 8).map(r => (
                  <div key={r.orderId} style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    #{r.orderId} {r.customerName} ({r.directions.map(x => DIRECTION_META[x]?.label || x).join('+')})
                  </div>
                ))}
                {dayRows.length > 8 && <div className="hint">+{dayRows.length - 8} נוספים (ראה טבלה למטה ליום הנבחר)</div>}
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
                      <h4>אין משלוחים ליום זה</h4>
                      <p>לא נמצאו הזמנות עם משלוח הלוך או חזור בתאריך שנבחר.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.map(row => (
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
                        <span key={d} className={`badge ${DIRECTION_META[d].badgeClass}`}>
                          <svg className="icon"><use href="#i-box" /></svg>
                          {DIRECTION_META[d].label}
                        </span>
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
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>סה&quot;כ רשומות: {loading ? '...' : filteredRows.length}</span>
        </div>
      </div>
    </>
  );
}
