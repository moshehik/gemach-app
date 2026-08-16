'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import ExportButtons from '../../components/ExportButtons';
import useDebounce from '@/hooks/useDebounce';

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/deliveries?date=${selectedDate}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setRows(data.data || []);
        setDeliveryDaysBefore(data.deliveryDaysBefore ?? null);
        setDeliveryDaysAfter(data.deliveryDaysAfter ?? null);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate]);

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
          (r.customerPhone || '').includes(term)
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
              { key: 'customerPhone', label: 'טלפון' },
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

      {/* סינון כיוון משלוח */}
      <div className="pill-tabs" style={{ marginBottom: '20px' }}>
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

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>לקוח</th>
                <th>הזמנה</th>
                <th>דגמים</th>
                <th>תאריך אירוע</th>
                <th>כיוון משלוח</th>
                <th>חיוב משלוח</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6"><div className="loading-inline"><span className="spinner" />טוען נתונים...</div></td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6">
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
                  </td>
                  <td className="cell-primary">
                    <Link href={`/orders/${row.orderId}`}>#{row.orderId}</Link>
                  </td>
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
