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
  getOrderSummaryStats
} from './actions';

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

  useEffect(() => {
    async function loadSummary() {
      const [orders, maxEmp] = await Promise.all([
        getOrderSummaryStats(),
        getMaxConcurrentEmployees()
      ]);
      setSummaryData({ orders, maxEmp });
    }
    loadSummary();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

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

  const tabs = [
    { id: 'daily', label: 'יומי (הזמנות)' },
    { id: 'inventory', label: 'חריגות וספירת מלאי' },
    { id: 'model', label: 'לפי דגם' },
    { id: 'size', label: 'לפי מידה' },
    { id: 'seamstress', label: 'עומס תופרות' },
    { id: 'payments', label: 'חובות ותשלומים' },
  ];

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem', paddingBottom: '5rem' }}>
      <style>{`
        .stats-table { width: 100%; border-collapse: collapse; }
        .stats-table th { background-color: var(--primary-color, #1e40af); color: white; padding: 1rem; text-align: right; }
        .stats-table td { padding: 1rem; border-bottom: 1px solid #eee; text-align: right; }
        .stats-table tr:hover { background-color: #f8fafc; }
      `}</style>
      
      <h1 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', fontSize: '2rem', fontWeight: 'bold' }}>
        מרכז נתונים ופילוח
      </h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-color)' }}>מתאריך אירוע / התחלה</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" style={{ width: '200px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-color)' }}>עד תאריך אירוע / סיום</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" style={{ width: '200px' }} />
        </div>
        <button onClick={fetchData} className="btn-primary" style={{ height: '42px', padding: '0 2rem' }}>
          החל סינון
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === t.id ? 'bold' : 'normal',
              backgroundColor: activeTab === t.id ? 'var(--primary-color, #1e40af)' : '#e2e8f0',
              color: activeTab === t.id ? 'white' : '#475569',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>טוען נתונים...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {activeTab === 'daily' && <DailyTable data={data} />}
            {activeTab === 'model' && <ModelSizeTable data={data} type="דגם" />}
            {activeTab === 'size' && <ModelSizeTable data={data} type="מידה" />}
            {activeTab === 'seamstress' && <SeamstressTable data={data} />}
            {activeTab === 'payments' && <PaymentsTable data={data} />}
            {activeTab === 'inventory' && <InventoryTable data={data} />}
          </div>
        )}
      </div>

      {summaryData && (
         <div style={{ marginTop: '4rem' }}>
            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '0.5rem', color: 'var(--text-color)' }}>מידע כללי נוסף</h3>
            <div className="dress-card" style={{ padding: '2rem', marginTop: '1rem', background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', display: 'inline-block', minWidth: '300px' }}>
              <h4 style={{ margin: 0, color: 'var(--text-color)' }}>שיא עובדים בו-זמנית בחנות</h4>
              <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)' }}>
                זמן השיא: {summaryData.maxEmp?.peakTime ? new Date(summaryData.maxEmp.peakTime).toLocaleString('he-IL') : 'אין נתונים'}
              </p>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: '#475569', marginTop: '1rem' }}>
                {summaryData.maxEmp?.maxEmployees || 0} עובדים
              </div>
            </div>
         </div>
      )}
    </div>
  );
}

function DailyTable({ data }) {
  if (!data || data.length === 0) return <EmptyState />;
  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>תאריך</th>
          <th>הזמנות שבוצעו</th>
          <th>הכנסות (שולמו)</th>
          <th>פריטים הושכרו</th>
          <th>פריטים הוחזרו</th>
        </tr>
      </thead>
      <tbody>
        {data.map(r => (
          <tr key={r.date}>
            <td style={{ fontWeight: 'bold' }}>{new Date(r.date).toLocaleDateString('he-IL')}</td>
            <td>{r.newOrders}</td>
            <td style={{ color: 'var(--primary-color, #1e40af)', fontWeight: 'bold' }}>₪{r.revenue.toLocaleString()}</td>
            <td>{r.itemsRented}</td>
            <td>{r.itemsReturned}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ModelSizeTable({ data, type }) {
  if (!data || data.length === 0) return <EmptyState />;
  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>{type}</th>
          <th>כמות השכרות סה"כ</th>
          <th>תיקוני צוואר</th>
          <th>תיקוני אורך</th>
          <th>תיקוני שרוול</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r, idx) => (
          <tr key={idx}>
            <td style={{ fontWeight: 'bold' }}>{r.name || r.size}</td>
            <td style={{ fontWeight: 'bold', color: 'var(--primary-color, #1e40af)' }}>{r.count}</td>
            <td>{r.neck}</td>
            <td>{r.length}</td>
            <td>{r.sleeve}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SeamstressTable({ data }) {
  if (!data || data.length === 0) return <EmptyState />;
  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>תאריך אירוע (יעד)</th>
          <th>מספר פריטים לתיקון</th>
          <th>תיקוני צוואר</th>
          <th>תיקוני אורך</th>
          <th>תיקוני שרוול</th>
        </tr>
      </thead>
      <tbody>
        {data.map(r => (
          <tr key={r.date}>
            <td style={{ fontWeight: 'bold' }}>{new Date(r.date).toLocaleDateString('he-IL')}</td>
            <td style={{ fontWeight: 'bold', color: '#b45309' }}>{r.itemsCount}</td>
            <td>{r.neck}</td>
            <td>{r.length}</td>
            <td>{r.sleeve}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentsTable({ data }) {
  if (!data || data.length === 0) return <EmptyState />;
  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>מספר הזמנה</th>
          <th>לקוח</th>
          <th>תאריך הזמנה</th>
          <th>סך הכל חויב</th>
          <th>סך הכל שולם</th>
          <th>יתרת חובה</th>
        </tr>
      </thead>
      <tbody>
        {data.map(r => (
          <tr key={r.orderId} style={{ backgroundColor: r.debt > 0 ? '#fef2f2' : 'white' }}>
            <td style={{ fontWeight: 'bold' }}>{r.orderId}</td>
            <td>{r.customerName}</td>
            <td>{r.orderDate ? new Date(r.orderDate).toLocaleDateString('he-IL') : ''}</td>
            <td>₪{r.expectedTotal.toLocaleString()}</td>
            <td style={{ color: '#166534' }}>₪{r.actualPaid.toLocaleString()}</td>
            <td style={{ color: r.debt > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: r.debt > 0 ? 'bold' : 'normal' }}>
              ₪{r.debt.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InventoryTable({ data }) {
  if (!data || data.length === 0) return <EmptyState />;
  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th>דגם השמלה</th>
          <th>מידה</th>
          <th>סה"כ במלאי הפיזי</th>
          <th>שיא השכרות חופפות</th>
          <th>תאריכי שיא</th>
          <th>סטטוס</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r, idx) => (
          <tr key={idx} style={{ backgroundColor: r.hasShortage ? '#fef2f2' : 'white' }}>
            <td style={{ fontWeight: 'bold' }}>{r.modelName}</td>
            <td>{r.sizeText}</td>
            <td style={{ fontSize: '1.1rem' }}>{r.totalStock}</td>
            <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: r.hasShortage ? '#dc2626' : '#166534' }}>
              {r.maxRented}
            </td>
            <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {r.peakDates.split(', ').map(d => d ? new Date(d).toLocaleDateString('he-IL') : '').join(', ')}
            </td>
            <td>
              {r.hasShortage ? (
                <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>חוסר במלאי!</span>
              ) : (
                <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>תקין</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyState() {
  return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>אין נתונים להצגה בטווח התאריכים הנבחר.</div>;
}
