'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function FullViewPage() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState('');
  const itemsPerPage = 100;

  useEffect(() => {
    const fetchQueryData = async () => {
      const savedQuery = sessionStorage.getItem('fullViewQuery');
      if (!savedQuery) {
        setError('לא נמצאה שאילתה פעילה. אנא חזור למסך הקודם והרץ שאילתה מחדש.');
        setLoading(false);
        return;
      }
      setQuery(savedQuery);

      try {
        const response = await fetch('/api/admin/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: savedQuery })
        });

        if (response.ok) {
          const result = await response.json();
          setData(result);
          if (result.length > 0) {
            setColumns(Object.keys(result[0]));
          }
        } else {
          const errText = await response.text();
          setError(`שגיאה בהרצת השאילתה: ${errText}`);
        }
      } catch (err) {
        setError(`שגיאת תקשורת: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchQueryData();
  }, []);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const currentData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderPaginationControls = (position) => {
    if (totalPages <= 1) return null;
    return (
      <div className={`table-foot${position === 'top' ? ' table-foot-top' : ''}`}>
        <span>
          מציג {(currentPage - 1) * itemsPerPage + 1} עד {Math.min(currentPage * itemsPerPage, data.length)} מתוך {data.length}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-icon-only btn-sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <svg className="icon"><use href="#i-chevron-end" /></svg>
          </button>

          <span>עמוד {currentPage} מתוך {totalPages}</span>

          <button
            type="button"
            className="btn btn-secondary btn-icon-only btn-sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <svg className="icon"><use href="#i-chevron-start" /></svg>
          </button>
        </div>
      </div>
    );
  };

  const downloadExcel = async () => {
    if (data.length === 0) return;

    const authResult = await window.customAuthPrompt("הזן קוד מנהל/מתכנת לאישור ייצוא לאקסל:", "מנהל");
    if (!authResult) return;

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: authResult.pin,
          employeeId: authResult.employeeId,
          requiredLevel: 'מנהל'
        })
      });
      const authData = await res.json();
      if (!authData.success) {
        alert(authData.error || 'קוד מנהל שגוי או הרשאה לא מספקת.');
        return;
      }
    } catch (err) {
      alert('שגיאה באימות קוד מנהל.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "נתונים");
    XLSX.writeFile(wb, 'query_full_results.xlsx');
  };

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner lg" />
        <p>טוען נתונים...</p>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>
              <svg className="icon" style={{ color: 'var(--danger)' }}><use href="#i-alert-circle" /></svg>
              שגיאה
            </h1>
          </div>
        </div>
        <div className="callout callout-danger">
          <svg className="icon"><use href="#i-alert-circle" /></svg>
          <span>{error}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <svg className="icon" style={{ color: 'var(--primary-solid)' }}><use href="#i-expand" /></svg>
            תצוגת טבלה מלאה
          </h1>
          <div className="page-desc" style={{ maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={query}>
            {query}
          </div>
        </div>
        <div className="page-actions">
          <span className="badge badge-primary">סה"כ רשומות: {data.length}</span>
          <button type="button" className="btn btn-primary" onClick={downloadExcel}>
            <svg className="icon"><use href="#i-download" /></svg>
            ייצוא
          </button>
        </div>
      </div>

      <div className="table-wrap">
        {renderPaginationControls('top')}

        <table className="data">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.length > 0 ? currentData.map((row, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col} style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(row[col])}>
                    {row[col] !== null ? String(row[col]) : <span className="hint" style={{ fontStyle: 'italic' }}>NULL</span>}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length || 1}>
                  <div className="empty-state">
                    <svg className="icon"><use href="#i-database" /></svg>
                    <h4>אין נתונים להצגה</h4>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {renderPaginationControls('bottom')}
      </div>
    </>
  );
}
