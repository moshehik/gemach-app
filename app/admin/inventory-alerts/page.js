'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

function StatusSummary({ summary }) {
  const [isOpen, setIsOpen] = useState(false);

  const totalInactive = (summary?.inRepair || 0) + (summary?.notInUse || 0) + (summary?.warehouse || 0) + (summary?.reserve || 0);

  if (totalInactive === 0) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-ghost btn-icon-only btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        style={{ backgroundColor: isOpen ? 'var(--surface-alt)' : 'transparent' }}
        title="סטטוס פריטים שאינם בשימוש"
      >
        <svg className="icon" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <use href="#i-chevron-down" />
        </svg>
      </button>

      {isOpen && (
        <div className="card card-pad" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 50, width: 'max-content', minWidth: '170px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12.5px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
            סה&quot;כ לא פעילים: {totalInactive}
          </h4>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '12.5px', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {summary.inRepair > 0 && <li>בתיקון: {summary.inRepair}</li>}
            {summary.notInUse > 0 && <li>לא בשימוש: {summary.notInUse}</li>}
            {summary.warehouse > 0 && <li>במחסן: {summary.warehouse}</li>}
            {summary.reserve > 0 && <li>ברזרבה: {summary.reserve}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function AlertOrdersModal({ orders, onClose }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: '400px', width: '90%', margin: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-alert-circle" /></svg>
            הזמנות מעורבות
          </strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={onClose}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div className="modal-body">
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-2)' }}>
            ההזמנות הבאות חופפות בתאריכים אלו ויוצרות חריגת מלאי. לחץ על מספר הזמנה כדי לפתוח אותה ולטפל בבעיה.
          </p>

          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orders.map(oid => (
              <Link
                key={oid}
                href={`/orders/${oid}`}
                target="_blank"
                className="list-card"
                style={{ textDecoration: 'none', color: 'var(--primary-solid)' }}
              >
                <div style={{ flex: 1, fontWeight: 700 }}>הזמנה #{oid}</div>
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// מיון בצד הלקוח: הרשימה כולה כבר בזיכרון (אין pagination בשרת), אותו דפוס
// כמו ה-SortIcon/מיון הגנרי ב-components/dresses/modern/ModernDressItemsTab.js.
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

export default function InventoryAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState(null);
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  const handleSort = (key) => setSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

  useEffect(() => {
    fetch('/api/inventory/alerts')
      .then(res => res.json())
      .then(data => {
        setAlerts(data.alerts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('he-IL', { dateStyle: 'long', calendar: 'hebrew' });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>התראות ובדיקות מלאי</h1>
          <div className="page-desc">דגמים שהביקוש בהם חורג מהמלאי הפנוי</div>
        </div>
        <div className="page-actions">
          <Link href="/admin" className="btn btn-secondary">
            <svg className="icon"><use href="#i-chevron-end" /></svg>
            חזרה לניהול
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <span className="spinner lg" />
          טוען נתונים, אנא המתן...
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <svg className="icon"><use href="#i-check-circle" /></svg>
          <h4>המלאי תקין לחלוטין!</h4>
          <p>לא נמצאו חריגות בהזמנות העתידיות.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className={sort.key === 'dressName' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('dressName')}>דגם <SortIcon sort={sort} colKey="dressName" /></th>
                <th className={sort.key === 'sizeText' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('sizeText')}>מידה <SortIcon sort={sort} colKey="sizeText" /></th>
                <th className={sort.key === 'fromDate' ? 'sortable sort-active' : 'sortable'} onClick={() => handleSort('fromDate')}>תאריכי חריגה <SortIcon sort={sort} colKey="fromDate" /></th>
                <th className={sort.key === 'inStock' ? 'sortable sort-active' : 'sortable'} style={{ textAlign: 'center' }} onClick={() => handleSort('inStock')}>במלאי <SortIcon sort={sort} colKey="inStock" /></th>
                <th className={sort.key === 'demanded' ? 'sortable sort-active' : 'sortable'} style={{ textAlign: 'center' }} onClick={() => handleSort('demanded')}>ביקוש <SortIcon sort={sort} colKey="demanded" /></th>
                <th style={{ textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {sortRows(alerts, sort, (a, key) => a[key]).map((alert, idx) => (
                <tr key={idx}>
                  <td className="cell-primary">
                    {alert.modelId ? (
                      <a href={`/dashboard/dresses/${alert.modelId}`} title="פתח כרטיס דגם" style={{ color: 'var(--primary-solid)', textDecoration: 'none', fontWeight: 700 }}>
                        {alert.dressName}
                      </a>
                    ) : alert.dressName}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {alert.sizeText}
                      <StatusSummary summary={alert.statusSummary} />
                    </div>
                  </td>
                  <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    {formatDate(alert.fromDate)}
                    {alert.fromDate !== alert.toDate && ` - ${formatDate(alert.toDate)}`}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{alert.inStock}</td>
                  <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 800 }}>{alert.demanded}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setSelectedOrders(alert.orders)}>
                      <svg className="icon"><use href="#i-alert-tri" /></svg>
                      צפה בהזמנות ({alert.orders.length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="table-foot">
            <span>סה&quot;כ דגמים בחריגה: {alerts.length}</span>
          </div>
        </div>
      )}

      {selectedOrders && (
        <AlertOrdersModal orders={selectedOrders} onClose={() => setSelectedOrders(null)} />
      )}
    </>
  );
}
