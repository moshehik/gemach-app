'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { utils, writeFile } from 'xlsx'; // Assuming xlsx is installed, if not we'll write a simple CSV export

export default function DataExplorerPage() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState([]);
  const [queryColumns, setQueryColumns] = useState([]);
  const [queryError, setQueryError] = useState('');
  
  const [loading, setLoading] = useState(false);

  // Fetch all tables on mount
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await fetch('/api/admin/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations'" })
        });
        
        if (response.ok) {
          const data = await response.json();
          setTables(data.map(row => row.name));
        } else {
          console.error("Failed to fetch tables");
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchTables();
  }, []);

  // Fetch table data when a table is selected
  useEffect(() => {
    if (!selectedTable) return;
    
    const fetchTableData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `SELECT * FROM "${selectedTable}" LIMIT 500` })
        });
        
        if (response.ok) {
          const data = await response.json();
          setTableData(data);
          if (data.length > 0) {
            setTableColumns(Object.keys(data[0]));
          } else {
            setTableColumns([]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTableData();
  }, [selectedTable]);

  const runCustomQuery = async () => {
    if (!customQuery.trim()) return;
    
    setLoading(true);
    setQueryError('');
    setQueryResult([]);
    setQueryColumns([]);
    
    try {
      const response = await fetch('/api/admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: customQuery })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setQueryError(data.error || 'שגיאה בביצוע השאילתה');
      } else {
        setQueryResult(data);
        if (data.length > 0) {
          setQueryColumns(Object.keys(data[0]));
        }
      }
    } catch (err) {
      setQueryError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    // Create CSV string manually to avoid depending on xlsx if not installed
    const keys = Object.keys(data[0]);
    const csvContent = [
      keys.join(','), // Header row
      ...data.map(row => 
        keys.map(k => {
          let val = row[k];
          if (val === null || val === undefined) val = '';
          const str = String(val).replace(/"/g, '""'); // Escape quotes
          return `"${str}"`;
        }).join(',')
      )
    ].join('\n');
    
    // Add BOM for Excel Hebrew support
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExport = async (table, mode) => {
    if (!table) return;

    if (mode === 'all') {
      const pin = window.prompt("הזן קוד מנהל לאישור הורדה מלאה:");
      if (!pin) return;

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin, requiredLevel: 'מנהל' })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'קוד מנהל שגוי או הרשאה לא מספקת.');
          return;
        }
      } catch (err) {
        alert('שגיאה באימות קוד מנהל.');
        return;
      }
    }

    setLoading(true);
    try {
      let query = '';
      if (mode === '5000') {
        query = `SELECT * FROM "${table}" ORDER BY rowid DESC LIMIT 5000`;
      } else {
        query = `SELECT * FROM "${table}"`;
      }

      const response = await fetch('/api/admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (response.ok) {
        const data = await response.json();
        downloadCSV(data, `${table}_${mode === 'all' ? 'מלא' : mode}`);
      } else {
        alert('שגיאה בהורדת הנתונים');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="container animate-fade-in" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>סייר נתונים ושאילתות</h1>
        <Link href="/admin">
          <button className="btn btn-outline">חזור לניהול</button>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Table Explorer Section */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>סייר טבלאות</h2>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>בחר טבלה:</label>
              <select 
                className="form-control" 
                value={selectedTable} 
                onChange={e => setSelectedTable(e.target.value)}
              >
                <option value="">-- בחר טבלה --</option>
                {tables.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            
            <button 
              className="btn btn-outline" 
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, '5000')}
              title="הורד 5000 אחרונים"
            >
              הורד 5,000 אחרונים
            </button>
            <button 
              className="btn btn-primary" 
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, 'all')}
              title="הורד הכל מלא ל-Excel/CSV"
            >
              הורד הכל מלא
            </button>
          </div>
          
          {loading && selectedTable && <div style={{ padding: '1rem', textAlign: 'center' }}>טוען נתונים...</div>}
          
          {selectedTable && !loading && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                מציג עד 500 רשומות אחרונות מתוך <strong>{selectedTable}</strong>
              </p>
              
              <div style={{ overflowX: 'auto', maxHeight: '400px', border: '1px solid #eee', borderRadius: '8px' }}>
                {tableData.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                      <tr>
                        {tableColumns.map(col => (
                          <th key={col} style={{ padding: '0.75rem', borderBottom: '2px solid #ddd' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          {tableColumns.map(col => (
                            <td key={col} style={{ padding: '0.75rem' }}>
                              {row[col] !== null ? String(row[col]) : <span style={{ color: '#ccc' }}>NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>אין נתונים בטבלה זו</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Custom SQL Query Section */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>הרצת שאילתת SQL</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>הזן שאילתה (SQLite):</label>
            <textarea 
              className="form-control" 
              style={{ width: '100%', minHeight: '120px', direction: 'ltr', fontFamily: 'monospace' }}
              placeholder="SELECT * FROM Customer WHERE id > 100"
              value={customQuery}
              onChange={e => setCustomQuery(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={runCustomQuery}
              disabled={loading || !customQuery.trim()}
            >
              {loading ? 'מריץ...' : 'הרץ שאילתה'}
            </button>
            
            <button 
              className="btn btn-outline" 
              disabled={queryResult.length === 0}
              onClick={() => downloadCSV(queryResult, 'query_results')}
            >
              הורד תוצאות
            </button>
          </div>
          
          {queryError && (
            <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem', direction: 'ltr', textAlign: 'left' }}>
              <strong>Error:</strong> {queryError}
            </div>
          )}
          
          {queryResult.length > 0 && !queryError && (
             <div style={{ marginTop: '1rem' }}>
             <p style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
               נמצאו <strong>{queryResult.length}</strong> רשומות
             </p>
             
             <div style={{ overflowX: 'auto', maxHeight: '300px', border: '1px solid #eee', borderRadius: '8px' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                 <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                   <tr>
                     {queryColumns.map(col => (
                       <th key={col} style={{ padding: '0.75rem', borderBottom: '2px solid #ddd' }}>{col}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {queryResult.map((row, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                       {queryColumns.map(col => (
                         <td key={col} style={{ padding: '0.75rem' }}>
                           {row[col] !== null ? String(row[col]) : <span style={{ color: '#ccc' }}>NULL</span>}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
          )}
        </div>
      </div>
    </div>
  );
}
