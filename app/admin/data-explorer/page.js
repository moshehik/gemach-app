'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { utils, writeFile } from 'xlsx'; // Assuming xlsx is installed, if not we'll write a simple CSV export

const tableTranslations = {
  Customer: "לקוחות",
  AuditLog: "יומן אירועים",
  Employee: "עובדים",
  Shift: "משמרות עובדים",
  DressModel: "דגמי שמלות",
  DressItem: "פריטי שמלות (מלאי)",
  Order: "הזמנות",
  Payment: "תשלומים",
  PaymentObligation: "חיובים וזיכויים",
  OrderItem: "פריטי הזמנה",
  PriceList: "מחירון",
  SystemSetting: "הגדרות מערכת",
  PriceRule: "חוקי תמחור",
  PageVisitLog: "יומן כניסות",
  EmailLog: "יומן אימיילים"
};

const sqlSuggestions = [
  { text: 'SELECT ', hebrew: 'בחר נתונים' },
  { text: 'FROM ', hebrew: 'מתוך טבלה' },
  { text: 'WHERE ', hebrew: 'תנאי סינון' },
  { text: 'HAVING ', hebrew: 'תנאי סינון על קבוצה' },
  { text: 'GROUP BY ', hebrew: 'קיבוץ לפי' },
  { text: 'ORDER BY ', hebrew: 'מיון לפי' },
  { text: 'DESC', hebrew: 'סדר יורד' },
  { text: 'ASC', hebrew: 'סדר עולה' },
  { text: 'LIMIT ', hebrew: 'הגבלת תוצאות' },
  { text: 'JOIN ', hebrew: 'צירוף טבלאות' },
  { text: 'LEFT JOIN ', hebrew: 'צירוף שמאלי' },
  { text: 'INNER JOIN ', hebrew: 'צירוף פנימי' },
  { text: 'AS ', hebrew: 'כינוי (Alias)' },
  { text: 'AND ', hebrew: 'וגם' },
  { text: 'OR ', hebrew: 'או' },
  { text: 'NOT ', hebrew: 'לא' },
  { text: 'IN ()', hebrew: 'בתוך רשימה' },
  { text: 'IS NULL', hebrew: 'ריק / ללא ערך' },
  { text: 'COUNT()', hebrew: 'ספירה' },
  { text: 'SUM()', hebrew: 'סכום' },
];
export default function DataExplorerPage() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState([]);
  const [queryColumns, setQueryColumns] = useState([]);
  const [queryError, setQueryError] = useState('');
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState('');

  const [showLogModal, setShowLogModal] = useState(false);
  const [queryLogs, setQueryLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [loading, setLoading] = useState(false);
  const [initialError, setInitialError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = React.useRef(null);
  
  // Fetch all tables on mount
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setInitialError('');
        const response = await fetch('/api/admin/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ query: "SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema' AND tablename != '_prisma_migrations' ORDER BY name" })
        });
        
        if (response.ok) {
          const data = await response.json();
          let parsedData = data;
          if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch(e){}
          }
          if (Array.isArray(parsedData)) {
            setTables(parsedData.map(row => row.name || row.tablename || Object.values(row)[0]));
          } else {
            console.error("Data is not an array:", parsedData);
            setInitialError('הנתונים שהתקבלו מהשרת אינם תקינים.');
            setTables([]);
          }
        } else {
          console.error("Failed to fetch tables, status:", response.status);
          const errData = await response.text();
          console.error("Error response:", errData);
          setInitialError(`שגיאה בטעינת הטבלאות: ${response.status}`);
        }
      } catch (err) {
        console.error("Fetch tables error:", err);
        setInitialError(`שגיאת תקשורת: ${err.message}`);
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
        // Fetch columns explicitly so we have them even if table is empty
        const colRes = await fetch('/api/admin/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `SELECT column_name FROM information_schema.columns WHERE table_name = '${selectedTable}' ORDER BY ordinal_position` })
        });
        if (colRes.ok) {
           const colData = await colRes.json();
           const parsedCols = typeof colData === 'string' ? JSON.parse(colData) : colData;
           if (Array.isArray(parsedCols) && parsedCols.length > 0) {
              setTableColumns(parsedCols.map(c => c.column_name));
           } else {
              setTableColumns([]);
           }
        }

        const response = await fetch('/api/admin/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `SELECT * FROM "${selectedTable}" LIMIT 500` })
        });
        
        if (response.ok) {
          const data = await response.json();
          setTableData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTableData();
  }, [selectedTable]);

  const generateAiQuery = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    setAiError('');
    try {
      const res = await fetch('/api/admin/ai-sql-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const data = await res.json();
      if (res.ok && data.sql) {
        setCustomQuery(data.sql);
        // Add visual flash effect
        if (textareaRef.current) {
          textareaRef.current.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.3)';
          setTimeout(() => { if(textareaRef.current) textareaRef.current.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }, 1000);
        }
      } else {
        setAiError(data.error || 'שגיאה ביצירת שאילתה');
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/query-log');
      const data = await res.json();
      if (res.ok) {
        setQueryLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

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

  const insertToQuery = (text) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newQuery = customQuery.substring(0, start) + text + customQuery.substring(end);
      setCustomQuery(newQuery);
      setTimeout(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + text.length;
      }, 0);
    } else {
      setCustomQuery(prev => prev + ' ' + text);
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

  const downloadExcel = (data, filename) => {
    if (!data || data.length === 0) return;
    try {
      const worksheet = utils.json_to_sheet(data);
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Data");
      writeFile(workbook, `${filename}.xlsx`);
    } catch (e) {
      console.error("Excel generation failed, falling back to CSV", e);
      downloadCSV(data, filename);
    }
  };

  const handleDownloadExport = async (table, mode, format = 'csv') => {
    if (!table) return;

    if (mode === 'all') {
      const authResult = await window.customAuthPrompt("הזן קוד מנהל/מתכנת לאישור הורדה מלאה:", "מנהל");
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
        query = `SELECT * FROM "${table}" LIMIT 5000`; // Removed ORDER BY id DESC to prevent syntax errors
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
        if (format === 'excel') {
          downloadExcel(data, `${table}_${mode === 'all' ? 'מלא' : mode}`);
        } else {
          downloadCSV(data, `${table}_${mode === 'all' ? 'מלא' : mode}`);
        }
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

    <div className="container animate-fade-in" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '1400px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2.5rem',
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '1.5rem 2rem',
        borderRadius: '16px',
        color: 'white',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700', letterSpacing: '-0.025em' }}>סייר נתונים ושאילתות</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8, fontSize: '0.95rem' }}>ניהול מתקדם של מסד הנתונים, ייצוא נתונים והרצת שאילתות מותאמות אישית</p>
        </div>
        <Link href="/admin">
          <button className="btn" style={{ 
            background: 'rgba(255,255,255,0.2)', 
            color: 'white', 
            border: '1px solid rgba(255,255,255,0.3)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
            padding: '0.5rem 1.5rem',
            borderRadius: '8px',
            fontWeight: '600'
          }}>חזור לניהול</button>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
        {/* Table Explorer Section */}
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '2rem', 
          borderRadius: '16px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h2 style={{ 
            marginBottom: '1.5rem', 
            paddingBottom: '1rem',
            borderBottom: '2px solid #f1f5f9',
            color: '#0f172a',
            fontSize: '1.4rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.2em' }}>📊</span> סייר טבלאות
          </h2>

          {initialError && (
            <div style={{ 
              padding: '1rem', 
              background: '#fef2f2', 
              color: '#991b1b', 
              borderRadius: '8px', 
              marginBottom: '1.5rem', 
              border: '1px solid #fecaca',
              boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)'
            }}>
              <strong>⚠️ שגיאה:</strong> {initialError}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.9rem' }}>בחר טבלה לבדיקה:</label>
              <select 
                className="form-control" 
                value={selectedTable} 
                onChange={e => setSelectedTable(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: '500',
                  color: '#0f172a',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- בחר טבלה מתוך הרשימה --</option>
                {tables.map(t => (
                  <option key={t} value={t}>{tableTranslations[t] ? `${t} - ${tableTranslations[t]}` : t}</option>
                ))}
              </select>
            </div>
            
            <button 
              className="btn" 
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, '5000')}
              title="הורד 5000 אחרונים"
              style={{
                background: selectedTable ? '#f8fafc' : '#f1f5f9',
                color: selectedTable ? '#334155' : '#94a3b8',
                border: `1px solid ${selectedTable ? '#cbd5e1' : '#e2e8f0'}`,
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: '500',
                transition: 'all 0.2s',
                cursor: selectedTable ? 'pointer' : 'not-allowed'
              }}
            >
              📥 הורד 5,000 אחרונים
            </button>
            <button 
              className="btn btn-primary" 
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, 'all', 'csv')}
              title="הורד הכל מלא ל-CSV"
              style={{
                background: selectedTable ? '#2563eb' : '#93c5fd',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: '600',
                color: 'white',
                boxShadow: selectedTable ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : 'none',
                cursor: selectedTable ? 'pointer' : 'not-allowed'
              }}
            >
              🚀 הורד הכל מלא ל-CSV
            </button>
            <button 
              className="btn btn-primary" 
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, 'all', 'excel')}
              title="הורד הכל מלא ל-Excel"
              style={{
                background: selectedTable ? '#16a34a' : '#86efac',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: '600',
                color: 'white',
                boxShadow: selectedTable ? '0 4px 6px -1px rgba(22, 163, 74, 0.2)' : 'none',
                cursor: selectedTable ? 'pointer' : 'not-allowed'
              }}
            >
              📊 הורד הכל ל-Excel
            </button>
          </div>
          
          {loading && selectedTable && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              טוען נתונים מהשרת...
            </div>
          )}

          {selectedTable && tableColumns.length > 0 && !loading && (
            <div style={{ 
              marginBottom: '1.5rem', 
              padding: '1rem', 
              background: '#f8fafc', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  שדות הטבלה: 
                  <span 
                    style={{ background: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                    title="לחץ להעתקת שם הטבלה לשאילתה"
                    onClick={() => {
                      navigator.clipboard.writeText(`"${selectedTable}"`);
                      insertToQuery(`"${selectedTable}"`);
                    }}
                  >
                    {selectedTable}
                  </span>
                  ({tableColumns.length})
                </span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(tableColumns.join(', '));
                    alert('השדות הועתקו ללוח!');
                  }}
                  title="העתק שדות"
                  style={{ 
                    background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#3b82f6', fontSize: '0.85rem', fontWeight: '500', padding: '0.2rem 0.5rem', borderRadius: '4px' 
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#eff6ff'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  העתק רשימה
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {tableColumns.map(col => (
                  <span key={col} style={{ background: 'var(--card-bg)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => {
                      navigator.clipboard.writeText(`"${col}"`);
                      insertToQuery(`"${col}"`);
                      const msg = document.createElement('div');
                      msg.textContent = 'הועתק ללוח ולשאילתה!';
                      msg.style.position = 'fixed'; msg.style.bottom = '20px'; msg.style.left = '50%'; msg.style.transform = 'translateX(-50%)'; msg.style.background = 'rgba(0,0,0,0.8)'; msg.style.color = 'white'; msg.style.padding = '0.5rem 1rem'; msg.style.borderRadius = '20px'; msg.style.zIndex = '9999';
                      document.body.appendChild(msg);
                      setTimeout(() => msg.remove(), 1500);
                    }}
                    title="לחץ להעתקת השדה"
                    onMouseOver={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'var(--input-bg)'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {selectedTable && !loading && (
            <div style={{ marginTop: '0.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>מציג עד <strong>500</strong> רשומות אחרונות</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600' }}>
                    טבלה: {selectedTable}
                  </span>
                  <button 
                    onClick={() => {
                      sessionStorage.setItem('fullViewQuery', `SELECT * FROM "${selectedTable}"`);
                      window.open('/admin/data-explorer/full-view', '_blank');
                    }}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.4rem', 
                      background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', 
                      padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', 
                      fontWeight: '500', transition: 'all 0.2s', fontSize: '0.8rem'
                    }}
                    title="פתיחה בתצוגת מסך מלא"
                    onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                    טבלה מלאה
                  </button>
                </div>
              </div>
              
              <div style={{ 
                flex: 1,
                overflowX: 'auto', 
                overflowY: 'auto',
                maxHeight: '450px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px',
                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.03)',
                background: '#fafafa'
              }}>
                {tableData.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                      <tr>
                        {tableColumns.map(col => (
                          <th key={col} style={{ padding: '1rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'var(--card-bg)' : '#f8fafc', transition: 'background 0.1s' }} className="hover:bg-slate-50">
                          {tableColumns.map(col => (
                            <td key={col} style={{ padding: '0.75rem', color: '#334155', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(row[col])}>
                              {row[col] !== null ? String(row[col]) : <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.85em' }}>NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '3rem', opacity: 0.2 }}>📭</span>
                    אין נתונים בטבלה זו
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Custom SQL Query Section */}
        <div style={{ 
          background: 'var(--card-bg)', 
          padding: '2rem', 
          borderRadius: '16px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #f1f5f9' }}>
            <h2 style={{ 
              color: '#0f172a',
              fontSize: '1.4rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: 0
            }}>
              <span style={{ fontSize: '1.2em' }}>⌨️</span> הרצת שאילתת SQL מותאמת
            </h2>
            <button 
              className="btn"
              onClick={() => { setShowLogModal(true); fetchLogs(); }}
              style={{
                background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '8px', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: '500'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              היסטוריית שאילתות
            </button>
          </div>

          <div style={{ background: 'linear-gradient(to right, #eff6ff, #f8fafc)', padding: '1.5rem', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e3a8a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ✨ עוזר שאילתות AI
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#3b82f6', marginBottom: '1rem' }}>תאר במילים מה תרצה לשלוף או לעדכן, וה-AI יכתוב את השאילתה עבורך.</p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input 
                  type="text" 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="לדוגמה: מחק את כל תיעודי הכניסה הישנים משנת 2024..."
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white' }}
                  onKeyDown={e => { if (e.key === 'Enter') generateAiQuery(); }}
                />
                {aiError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>{aiError}</div>}
              </div>
              <button 
                onClick={generateAiQuery}
                disabled={isGeneratingAi || !aiPrompt.trim()}
                style={{
                  background: isGeneratingAi || !aiPrompt.trim() ? '#93c5fd' : '#2563eb',
                  color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '600', cursor: isGeneratingAi || !aiPrompt.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.2s', whiteSpace: 'nowrap'
                }}
              >
                {isGeneratingAi ? 'מייצר שאילתה...' : 'צור שאילתה'}
              </button>
            </div>
          </div>
          
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1e293b' }}>
              הזן שאילתה (PostgreSQL):
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '0.5rem', fontWeight: 'normal' }}>(לחץ Ctrl+Space להשלמה אוטומטית)</span>
            </label>
            <textarea 
              ref={textareaRef}
              className="form-control" 
              style={{ 
                width: '100%', 
                minHeight: '150px', 
                direction: 'ltr', 
                fontFamily: 'monospace',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}
              placeholder='SELECT * FROM "Customer" WHERE id > 100'
              value={customQuery}
              onChange={e => setCustomQuery(e.target.value)}
              onKeyDown={e => {
                if (e.ctrlKey && e.code === 'Space') {
                  e.preventDefault();
                  setShowSuggestions(true);
                } else if (showSuggestions && e.code === 'Escape') {
                  setShowSuggestions(false);
                }
              }}
              onClick={() => showSuggestions && setShowSuggestions(false)}
            />
            {showSuggestions && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% - 4px)',
                right: '1rem',
                background: 'var(--card-bg)',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                zIndex: 50,
                maxHeight: '200px',
                overflowY: 'auto',
                minWidth: '250px',
                padding: '0.5rem 0'
              }}>
                <div style={{ padding: '0.25rem 1rem', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', marginBottom: '0.25rem' }}>הצעות להשלמה:</div>
                {sqlSuggestions.map((s, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      padding: '0.5rem 1rem', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      transition: 'background 0.1s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseOut={e => e.currentTarget.style.background = 'var(--input-bg)'}
                    onClick={() => {
                      const ta = textareaRef.current;
                      if (ta) {
                        const start = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const newQuery = customQuery.substring(0, start) + s.text + customQuery.substring(end);
                        setCustomQuery(newQuery);
                        setShowSuggestions(false);
                        setTimeout(() => {
                          ta.focus();
                          ta.selectionStart = ta.selectionEnd = start + s.text.length;
                        }, 0);
                      }
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#2563eb', fontFamily: 'monospace' }}>{s.text}</span>
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{s.hebrew}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={runCustomQuery}
              disabled={loading || !customQuery.trim()}
              style={{
                background: (loading || !customQuery.trim()) ? '#93c5fd' : '#2563eb',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                color: 'white',
                boxShadow: (loading || !customQuery.trim()) ? 'none' : '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
                cursor: (loading || !customQuery.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'מריץ...' : '▶️ הרץ שאילתה'}
            </button>
            
            <button 
              className="btn" 
              disabled={queryResult.length === 0}
              onClick={() => downloadCSV(queryResult, 'query_results')}
              style={{
                background: queryResult.length === 0 ? '#f1f5f9' : '#f8fafc',
                color: queryResult.length === 0 ? '#94a3b8' : '#334155',
                border: `1px solid ${queryResult.length === 0 ? '#e2e8f0' : '#cbd5e1'}`,
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: '500',
                transition: 'all 0.2s',
                cursor: queryResult.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              📥 הורד תוצאות CSV
            </button>

            <button 
              className="btn" 
              disabled={queryResult.length === 0}
              onClick={() => downloadExcel(queryResult, 'query_results')}
              style={{
                background: queryResult.length === 0 ? '#f1f5f9' : '#f0fdf4',
                color: queryResult.length === 0 ? '#94a3b8' : '#16a34a',
                border: `1px solid ${queryResult.length === 0 ? '#e2e8f0' : '#bbf7d0'}`,
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: '500',
                transition: 'all 0.2s',
                cursor: queryResult.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              📊 הורד תוצאות Excel
            </button>
          </div>
          
          {queryError && (
            <div style={{ 
              padding: '1rem', 
              background: '#fef2f2', 
              color: '#991b1b', 
              borderRadius: '8px', 
              marginBottom: '1rem', 
              direction: 'ltr', 
              textAlign: 'left',
              border: '1px solid #fecaca',
              boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)'
            }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>⚠️ Query Error:</strong> {queryError}
            </div>
          )}
          
          {queryResult.length > 0 && !queryError && (
             <div style={{ marginTop: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
             <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span>נמצאו <strong>{queryResult.length}</strong> רשומות</span>
               <button 
                 onClick={() => {
                   sessionStorage.setItem('fullViewQuery', customQuery);
                   window.open('/admin/data-explorer/full-view', '_blank');
                 }}
                 style={{ 
                   display: 'flex', alignItems: 'center', gap: '0.4rem', 
                   background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', 
                   padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', 
                   fontWeight: '500', transition: 'all 0.2s' 
                 }}
                 title="פתיחה בתצוגת מסך מלא"
                 onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; }}
                 onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}
               >
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                 טבלה מלאה
               </button>
             </div>
             
             <div style={{ 
                flex: 1,
                overflowX: 'auto', 
                overflowY: 'auto',
                maxHeight: '400px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px',
                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.03)',
                background: '#fafafa'
             }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                 <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                   <tr>
                     {queryColumns.map(col => (
                       <th key={col} style={{ padding: '1rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>{col}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {queryResult.map((row, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'var(--card-bg)' : '#f8fafc', transition: 'background 0.1s' }} className="hover:bg-slate-50">
                       {queryColumns.map(col => (
                         <td key={col} style={{ padding: '0.75rem', color: '#334155', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(row[col])}>
                           {row[col] !== null ? String(row[col]) : <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.85em' }}>NULL</span>}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             <style dangerouslySetInnerHTML={{__html: `
               @keyframes spin { 100% { transform: rotate(360deg); } }
               ::-webkit-scrollbar { width: 8px; height: 8px; }
               ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
               ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
               ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
             `}} />
           </div>
          )}
        </div>
      </div>

      {/* Query History Modal */}
      {showLogModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                היסטוריית שאילתות
              </h3>
              <button onClick={() => setShowLogModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>טוען היסטוריה...</div>
              ) : queryLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>אין היסטוריית שאילתות.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {queryLogs.map(log => (
                    <div key={log.id} style={{ 
                      background: 'white', 
                      borderRadius: '8px', 
                      padding: '1rem', 
                      border: `1px solid ${log.success ? '#e2e8f0' : '#fecaca'}`,
                      borderRight: `4px solid ${log.success ? '#10b981' : '#ef4444'}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                        <span>{new Date(log.executedAt).toLocaleString('he-IL')}</span>
                        <span style={{ color: log.success ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                          {log.success ? 'הצלחה' : 'שגיאה'}
                        </span>
                      </div>
                      <pre style={{ 
                        margin: '0.5rem 0', padding: '0.75rem', background: '#1e293b', color: '#e2e8f0', borderRadius: '6px', overflowX: 'auto', direction: 'ltr', fontSize: '0.85rem'
                      }}>{log.query}</pre>
                      {!log.success && log.errorMsg && (
                        <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem', direction: 'ltr', textAlign: 'left' }}>
                          Error: {log.errorMsg}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button 
                          className="btn"
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                          onClick={() => {
                            setCustomQuery(log.query);
                            setShowLogModal(false);
                            if (textareaRef.current) textareaRef.current.focus();
                          }}
                        >העתק לעורך</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
