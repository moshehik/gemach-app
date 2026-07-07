'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PrintAlterationsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reportType = searchParams.get('reportType') || 'alterations_pending';
  const dateMode = searchParams.get('dateMode') || 'today';
  let startDate = searchParams.get('startDate');
  let endDate = searchParams.get('endDate');

  if (dateMode === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    startDate = todayStr;
    endDate = todayStr;
  }

  useEffect(() => {
    fetchData();
    // Auto trigger print when loaded
    const timer = setTimeout(() => {
      if (!loading && !error) {
        window.print();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [loading, error]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let showOnlyPending = reportType === 'alterations_pending';
      let hideNoAlterations = reportType === 'orders_no_alterations';

      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&hideNoAlterations=${hideNoAlterations}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  const getReportTitle = () => {
    if (reportType === 'orders_no_alterations') return 'רשימת הזמנות ללא תיקונים';
    if (reportType === 'alterations_all') return 'כל התיקונים';
    return 'רשימת תיקונים לביצוע';
  };

  return (
    <div className="print-container" style={{ padding: '20px', direction: 'rtl' }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Hide the layout nav inside print */
          nav {
            display: none !important;
          }
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .print-table th, .print-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: right;
          font-size: 14px;
        }
        .print-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          -webkit-print-color-adjust: exact;
        }
        .print-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
      `}</style>

      <div className="print-header">
        <h1>{getReportTitle()}</h1>
        <h3>
          {dateMode === 'today' ? `תאריך: ${new Date().toLocaleDateString('he-IL')}` : `מתאריך: ${formatDate(startDate)} | עד תאריך: ${formatDate(endDate)}`}
        </h3>
      </div>

      {loading ? (
        <div>טוען נתונים להדפסה...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>תאריך אירוע</th>
              <th>לקוח</th>
              <th>דגם שמלה</th>
              <th>מידה</th>
              {reportType !== 'orders_no_alterations' && (
                <>
                  <th>צוואר</th>
                  <th>שרוול</th>
                  <th>אורך</th>
                  <th>פירוט</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={reportType === 'orders_no_alterations' ? 4 : 8} style={{ textAlign: 'center' }}>לא נמצאו רשומות</td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item.id}>
                  <td>{formatDate(item.order?.eventDate)}</td>
                  <td>{item.order?.customer?.firstName} {item.order?.customer?.lastName}</td>
                  <td>{item.dressItem?.dress?.name || item.dressItem?.dressName}</td>
                  <td>{item.sizeText || item.size}</td>
                  {reportType !== 'orders_no_alterations' && (
                    <>
                      <td>{item.neckAlteration > 0 ? `הצרה ${item.neckAlteration}` : ''}</td>
                      <td>{item.sleeveAlteration > 0 ? `הארכה ${item.sleeveAlteration}` : ''}</td>
                      <td>{item.lengthAlteration ? item.lengthAlteration : ''}</td>
                      <td>{item.alterationDetails || ''}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
