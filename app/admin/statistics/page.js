'use client';

import { useEffect, useState } from 'react';
import {
  getDailyStatistics,
  getStatisticsByModel,
  getStatisticsBySize,
  getSeamstressWork,
  getPaymentStatistics,
  getDressConsumptionStats,
  getMaxConcurrentEmployees,
  getOrderSummaryStats,
  getAlterationsSetting
} from './actions';

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [enableAlterations, setEnableAlterations] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      const [orders, maxEmp, altSetting] = await Promise.all([
        getOrderSummaryStats(),
        getMaxConcurrentEmployees(),
        getAlterationsSetting()
      ]);
      setSummaryData({ orders, maxEmp });
      setEnableAlterations(altSetting);
    }
    loadSummary();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      let result = null;
      switch (activeTab) {
        case 'daily':
          result = await getDailyStatistics(startDate || null, endDate || null);
          break;
        case 'model':
          result = await getStatisticsByModel(startDate || null, endDate || null);
          break;
        case 'size':
          result = await getStatisticsBySize(startDate || null, endDate || null);
          break;
        case 'seamstress':
          result = await getSeamstressWork(startDate || null, endDate || null);
          break;
        case 'payments':
          result = await getPaymentStatistics(startDate || null, endDate || null);
          break;
        case 'inventory':
          result = await getDressConsumptionStats(startDate || null, endDate || null);
          break;
      }
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const tabs = [
    { id: 'daily', label: 'יומי (הזמנות)', icon: 'i-calendar' },
    { id: 'inventory', label: 'חריגות וספירת מלאי', icon: 'i-box' },
    { id: 'model', label: 'לפי דגם', icon: 'i-tag' },
    { id: 'size', label: 'לפי מידה', icon: 'i-category' },
    ...(enableAlterations ? [{ id: 'seamstress', label: 'עומס תופרות', icon: 'i-scissors' }] : []),
    { id: 'payments', label: 'חובות ותשלומים', icon: 'i-wallet' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>מרכז נתונים ופילוח</h1>
        </div>
        <div className="page-actions">
          <a href="/migration_report.html" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-icon-only" title="דוח הגירת נתונים מאקסס">
            <svg className="icon"><use href="#i-download" /></svg>
          </a>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-pad" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, width: '200px' }}>
            <label htmlFor="admin-statistics-start-date">מתאריך אירוע / התחלה</label>
            <input id="admin-statistics-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
          </div>
          <div className="field" style={{ marginBottom: 0, width: '200px' }}>
            <label htmlFor="admin-statistics-end-date">עד תאריך אירוע / סיום</label>
            <input id="admin-statistics-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" />
          </div>
          <button type="button" onClick={fetchData} className="btn btn-primary">
            החל סינון
          </button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button
            type="button"
            key={t.id}
            className={activeTab === t.id ? 'tab active' : 'tab'}
            style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }}
            onClick={() => setActiveTab(t.id)}
          >
            <svg className="icon"><use href={`#${t.icon}`} /></svg>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading">
          <span className="spinner lg" />
          טוען נתונים...
        </div>
      ) : (
        <>
          {activeTab === 'daily' && <DailyTable data={data} />}
          {activeTab === 'model' && <ModelSizeTable data={data} type="דגם" showAlterations={enableAlterations} />}
          {activeTab === 'size' && <ModelSizeTable data={data} type="מידה" showAlterations={enableAlterations} />}
          {activeTab === 'seamstress' && <SeamstressTable data={data} />}
          {activeTab === 'payments' && <PaymentsTable data={data} />}
          {activeTab === 'inventory' && <InventoryTable data={data} />}
        </>
      )}

      {summaryData && (
        <>
          <h2 className="section-title">מידע כללי נוסף</h2>
          <div className="card" style={{ maxWidth: '340px' }}>
            <div className="card-head">
              <div className="card-title-row">
                <svg className="icon"><use href="#i-user-check" /></svg>
                <h3>שיא עובדים בו-זמנית בחנות</h3>
              </div>
            </div>
            <div className="card-pad">
              <div className="kpi-value">{summaryData.maxEmp?.maxEmployees || 0} עובדים</div>
              <div className="hint" style={{ color: 'var(--text-3)', marginTop: '6px' }}>
                זמן השיא: {summaryData.maxEmp?.peakTime ? new Date(summaryData.maxEmp.peakTime).toLocaleString('he-IL') : 'אין נתונים'}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// מיון בצד הלקוח לכל טבלאות הסטטיסטיקה שבעמוד זה (הנתונים לכל טווח תאריכים כבר
// נטענים במלואם, בלי pagination בשרת) - אותו דפוס כמו ה-SortIcon/מיון הגנרי
// ב-components/dresses/modern/ModernDressItemsTab.js.
const compareSortValues = (av, bv) => {
  const an = Number(av);
  const bn = Number(bv);
  if (av != null && bv != null && av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn)) return an - bn;
  return String(av ?? '').localeCompare(String(bv ?? ''), 'he');
};

const sortRows = (rows, sort, getValue) => {
  if (!sort.key) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    const cmp = compareSortValues(getValue(a, sort.key), getValue(b, sort.key));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
  return copy;
};

const SortIcon = ({ sort, colKey }) => {
  if (sort.key !== colKey) return <svg className="icon"><use href="#i-sort" /></svg>;
  return (
    <svg className="icon" style={{ opacity: 1, color: 'var(--primary-solid)', transform: sort.direction === 'desc' ? 'rotate(180deg)' : 'none' }}>
      <use href="#i-chevron-down" />
    </svg>
  );
};

function useLocalSort() {
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  const handleSort = (key) => setSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  return [sort, handleSort];
}

function DailyTable({ data }) {
  const [sort, handleSort] = useLocalSort();
  if (!data || data.length === 0) return <EmptyState />;
  const rows = sortRows(data, sort, (r, key) => r[key]);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className={sort.key === 'date' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('date')}>תאריך <SortIcon sort={sort} colKey="date" /></th>
            <th className={sort.key === 'newOrders' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('newOrders')}>הזמנות שבוצעו <SortIcon sort={sort} colKey="newOrders" /></th>
            <th className={sort.key === 'revenue' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('revenue')}>הכנסות (שולמו) <SortIcon sort={sort} colKey="revenue" /></th>
            <th className={sort.key === 'itemsRented' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('itemsRented')}>פריטים הושכרו <SortIcon sort={sort} colKey="itemsRented" /></th>
            <th className={sort.key === 'itemsReturned' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('itemsReturned')}>פריטים הוחזרו <SortIcon sort={sort} colKey="itemsReturned" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.date}>
              <td className="cell-primary">{new Date(r.date).toLocaleDateString('he-IL')}</td>
              <td>{r.newOrders}</td>
              <td style={{ color: 'var(--success)', fontWeight: 700 }}>₪{r.revenue.toLocaleString()}</td>
              <td>{r.itemsRented}</td>
              <td>{r.itemsReturned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelSizeTable({ data, type, showAlterations }) {
  const [sort, handleSort] = useLocalSort();
  if (!data || data.length === 0) return <EmptyState />;
  const getValue = (r, key) => key === 'primary' ? (r.name ?? r.size) : r[key];
  const rows = sortRows(data, sort, getValue);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className={sort.key === 'primary' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('primary')}>{type} <SortIcon sort={sort} colKey="primary" /></th>
            <th className={sort.key === 'count' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('count')}>כמות השכרות סה&quot;כ <SortIcon sort={sort} colKey="count" /></th>
            {showAlterations && (
              <>
                <th className={sort.key === 'neck' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('neck')}>תיקוני צוואר <SortIcon sort={sort} colKey="neck" /></th>
                <th className={sort.key === 'length' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('length')}>תיקוני אורך <SortIcon sort={sort} colKey="length" /></th>
                <th className={sort.key === 'sleeve' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('sleeve')}>תיקוני שרוול <SortIcon sort={sort} colKey="sleeve" /></th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              <td className="cell-primary">{r.name || r.size}</td>
              <td className="cell-primary" style={{ color: 'var(--primary)' }}>{r.count}</td>
              {showAlterations && (
                <>
                  <td>{r.neck}</td>
                  <td>{r.length}</td>
                  <td>{r.sleeve}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeamstressTable({ data }) {
  const [sort, handleSort] = useLocalSort();
  if (!data || data.length === 0) return <EmptyState />;
  const rows = sortRows(data, sort, (r, key) => r[key]);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className={sort.key === 'date' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('date')}>תאריך אירוע (יעד) <SortIcon sort={sort} colKey="date" /></th>
            <th className={sort.key === 'itemsCount' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('itemsCount')}>מספר פריטים לתיקון <SortIcon sort={sort} colKey="itemsCount" /></th>
            <th className={sort.key === 'neck' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('neck')}>תיקוני צוואר <SortIcon sort={sort} colKey="neck" /></th>
            <th className={sort.key === 'length' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('length')}>תיקוני אורך <SortIcon sort={sort} colKey="length" /></th>
            <th className={sort.key === 'sleeve' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('sleeve')}>תיקוני שרוול <SortIcon sort={sort} colKey="sleeve" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.date}-${i}`}>
              <td className="cell-primary">{new Date(r.date).toLocaleDateString('he-IL')}</td>
              <td style={{ fontWeight: 700, color: 'var(--warning)' }}>{r.itemsCount}</td>
              <td>{r.neck}</td>
              <td>{r.length}</td>
              <td>{r.sleeve}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({ data }) {
  const [sort, handleSort] = useLocalSort();
  if (!data || data.length === 0) return <EmptyState />;
  const rows = sortRows(data, sort, (r, key) => r[key]);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className={sort.key === 'orderId' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('orderId')}>מספר הזמנה <SortIcon sort={sort} colKey="orderId" /></th>
            <th className={sort.key === 'customerName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('customerName')}>לקוח <SortIcon sort={sort} colKey="customerName" /></th>
            <th className={sort.key === 'orderDate' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('orderDate')}>תאריך הזמנה <SortIcon sort={sort} colKey="orderDate" /></th>
            <th className={sort.key === 'expectedTotal' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('expectedTotal')}>סך הכל חויב <SortIcon sort={sort} colKey="expectedTotal" /></th>
            <th className={sort.key === 'actualPaid' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('actualPaid')}>סך הכל שולם <SortIcon sort={sort} colKey="actualPaid" /></th>
            <th className={sort.key === 'debt' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('debt')}>יתרת חובה <SortIcon sort={sort} colKey="debt" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.orderId} className={r.debt > 0 ? 'row-flag' : ''}>
              <td className="cell-primary">{r.orderId}</td>
              <td>{r.customerName}</td>
              <td className="cell-muted">{r.orderDate ? new Date(r.orderDate).toLocaleDateString('he-IL') : ''}</td>
              <td>₪{r.expectedTotal.toLocaleString()}</td>
              <td style={{ color: 'var(--success)' }}>₪{r.actualPaid.toLocaleString()}</td>
              <td
                className={r.debt > 0 ? '' : 'cell-muted'}
                style={r.debt > 0 ? { fontWeight: 700, color: 'var(--danger)' } : undefined}
              >
                ₪{r.debt.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTable({ data }) {
  const [sort, handleSort] = useLocalSort();
  if (!data || data.length === 0) return <EmptyState />;
  const rows = sortRows(data, sort, (r, key) => r[key]);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className={sort.key === 'modelName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('modelName')}>דגם השמלה <SortIcon sort={sort} colKey="modelName" /></th>
            <th className={sort.key === 'sizeText' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('sizeText')}>מידה <SortIcon sort={sort} colKey="sizeText" /></th>
            <th className={sort.key === 'totalStock' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('totalStock')}>סה&quot;כ במלאי הפיזי <SortIcon sort={sort} colKey="totalStock" /></th>
            <th className={sort.key === 'maxRented' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('maxRented')}>שיא השכרות חופפות <SortIcon sort={sort} colKey="maxRented" /></th>
            <th>תאריכי שיא</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className={r.hasShortage ? 'row-flag' : ''}>
              <td className="cell-primary">{r.modelName}</td>
              <td>{r.sizeText}</td>
              <td>{r.totalStock}</td>
              <td style={{ fontWeight: 700, color: r.hasShortage ? 'var(--danger)' : 'var(--success)' }}>
                {r.maxRented}
              </td>
              <td className="cell-muted">
                {r.peakDates ? r.peakDates.split(', ').map(d => d ? new Date(d).toLocaleDateString('he-IL') : '').join(', ') : ''}
              </td>
              <td>
                {r.hasShortage ? (
                  <span className="badge badge-danger">
                    <svg className="icon"><use href="#i-alert-circle" /></svg>
                    חוסר במלאי!
                  </span>
                ) : (
                  <span className="badge badge-success">
                    <svg className="icon"><use href="#i-check" /></svg>
                    תקין
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="table-wrap">
      <div className="empty-state">
        <svg className="icon"><use href="#i-search" /></svg>
        <p>אין נתונים להצגה בטווח התאריכים הנבחר.</p>
      </div>
    </div>
  );
}
