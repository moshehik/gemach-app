'use client';

import React, { useState, useEffect } from 'react';
import { Maximize, ChevronRight, ChevronLeft, Download, AlertCircle } from 'lucide-react';
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

  const paginationControls = totalPages > 1 && (
    <div style={{ padding: '1rem 2rem', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
        מציג {(currentPage - 1) * itemsPerPage + 1} עד {Math.min(currentPage * itemsPerPage, data.length)} מתוך {data.length}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button 
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : 'white', color: currentPage === 1 ? '#94a3b8' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          <ChevronRight size={18} />
        </button>
        
        <span style={{ fontWeight: '500', color: '#0f172a', margin: '0 0.5rem' }}>
          עמוד {currentPage} מתוך {totalPages}
        </span>
        
        <button 
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', background: currentPage === totalPages ? '#f1f5f9' : 'white', color: currentPage === totalPages ? '#94a3b8' : '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
        >
          <ChevronLeft size={18} />
        </button>
      </div>
    </div>
  );

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '1.1rem' }}>טוען נתונים...</p>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', padding: '2rem' }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: '#1e293b', marginBottom: '1rem' }}>שגיאה</h2>
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '1rem 2rem', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Maximize size={24} color="#3b82f6" />
              תצוגת טבלה מלאה
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.9rem', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={query}>
              {query}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0.5rem 1rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: '600' }}>
              סה"כ רשומות: {data.length}
            </span>
            <button 
              onClick={downloadExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = '#059669'}
              onMouseOut={e => e.currentTarget.style.background = '#10b981'}
            >
              <Download size={18} />
              ייצוא
            </button>
          </div>
        </div>

        {/* Top Pagination */}
        {paginationControls}

        {/* Table Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.95rem' }}>
              <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                <tr>
                  {columns.map(col => (
                    <th key={col} style={{ padding: '1rem', color: '#475569', fontWeight: '600', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.length > 0 ? currentData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#f8fafc', transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#f8fafc'}>
                    {columns.map(col => (
                      <td key={col} style={{ padding: '0.875rem 1rem', color: '#334155', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(row[col])}>
                        {row[col] !== null ? String(row[col]) : <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.85em' }}>NULL</span>}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={columns.length || 1} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      אין נתונים להצגה
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Pagination */}
        {paginationControls}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}
