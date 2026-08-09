'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

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
          textareaRef.current.style.boxShadow = '0 0 0 4px var(--primary-tint-2)';
          setTimeout(() => { if(textareaRef.current) textareaRef.current.style.boxShadow = ''; }, 1000);
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

  const downloadExcel = async (data, filename) => {
    if (!data || data.length === 0) return;
    try {
      // xlsx (~900KB) נטען דינמית רק בלחיצה על הייצוא — לא חלק מה-bundle של הדף
      const { utils, writeFile } = await import('xlsx');
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
    <>
      <div className="page-head">
        <div>
          <h1>סייר נתונים ושאילתות</h1>
          <div className="page-desc">ניהול מתקדם של מסד הנתונים, ייצוא נתונים והרצת שאילתות מותאמות אישית</div>
        </div>
        <div className="page-actions">
          <Link href="/admin" className="btn btn-secondary">
            <svg className="icon"><use href="#i-chevron-end" /></svg>
            חזור לניהול
          </Link>
        </div>
      </div>

      <div className="two-col">
        {/* Table Explorer Section */}
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <svg className="icon"><use href="#i-database" /></svg>
            סייר טבלאות
          </h2>

          {initialError && (
            <div className="callout callout-danger" style={{ marginBottom: '18px' }}>
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              <span><strong>שגיאה:</strong> {initialError}</span>
            </div>
          )}

          <div className="form-grid" style={{ alignItems: 'end', marginBottom: '18px' }}>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="dataExplorerTableSelect">בחר טבלה לבדיקה:</label>
              <select
                id="dataExplorerTableSelect"
                className="select"
                value={selectedTable}
                onChange={e => setSelectedTable(e.target.value)}
              >
                <option value="">-- בחר טבלה מתוך הרשימה --</option>
                {tables.map(t => (
                  <option key={t} value={t}>{tableTranslations[t] ? `${t} - ${tableTranslations[t]}` : t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="toolbar" style={{ marginBottom: '18px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, '5000')}
              title="הורד 5000 אחרונים"
            >
              <svg className="icon"><use href="#i-download" /></svg>
              הורד 5,000 אחרונים
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, 'all', 'csv')}
              title="הורד הכל מלא ל-CSV"
            >
              <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-lock" /></svg>
              <svg className="icon"><use href="#i-download" /></svg>
              הורד הכל מלא ל-CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!selectedTable}
              onClick={() => handleDownloadExport(selectedTable, 'all', 'excel')}
              title="הורד הכל מלא ל-Excel"
            >
              <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-lock" /></svg>
              <svg className="icon"><use href="#i-file" /></svg>
              הורד הכל ל-Excel
            </button>
          </div>

          {loading && selectedTable && (
            <div className="loading-inline">
              <span className="spinner" />
              טוען נתונים מהשרת...
            </div>
          )}

          {selectedTable && tableColumns.length > 0 && !loading && (
            <div className="card card-pad" style={{ background: 'var(--surface-alt)', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  שדות הטבלה:
                  <span
                    className="badge badge-info"
                    style={{ cursor: 'pointer' }}
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
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(tableColumns.join(', '));
                    alert('השדות הועתקו ללוח!');
                  }}
                  title="העתק שדות"
                >
                  <svg className="icon"><use href="#i-file" /></svg>
                  העתק רשימה
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {tableColumns.map(col => (
                  <span
                    key={col}
                    className="badge badge-neutral"
                    style={{ cursor: 'pointer' }}
                    title="לחץ להעתקת השדה"
                    onClick={() => {
                      navigator.clipboard.writeText(`"${col}"`);
                      insertToQuery(`"${col}"`);
                      const msg = document.createElement('div');
                      msg.textContent = 'הועתק ללוח ולשאילתה!';
                      msg.style.position = 'fixed'; msg.style.bottom = '20px'; msg.style.left = '50%'; msg.style.transform = 'translateX(-50%)'; msg.style.background = 'var(--text)'; msg.style.color = 'var(--surface)'; msg.style.padding = '0.5rem 1rem'; msg.style.borderRadius = '20px'; msg.style.zIndex = '9999';
                      document.body.appendChild(msg);
                      setTimeout(() => msg.remove(), 1500);
                    }}
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedTable && !loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="table-wrap" style={{ maxHeight: '450px', overflow: 'auto' }}>
                <div className="table-scroll">
                  {tableData.length > 0 ? (
                    <table className="data">
                      <thead>
                        <tr>
                          {tableColumns.map(col => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, i) => (
                          <tr key={i}>
                            {tableColumns.map(col => (
                              <td key={col} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(row[col])}>
                                {row[col] !== null ? String(row[col]) : <span className="hint" style={{ fontStyle: 'italic' }}>NULL</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-state">
                      <svg className="icon"><use href="#i-database" /></svg>
                      <h4>אין נתונים בטבלה זו</h4>
                    </div>
                  )}
                </div>
              </div>
              <div className="table-foot">
                <span>מציג עד <strong>500</strong> רשומות אחרונות</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-info">טבלה: {selectedTable}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      sessionStorage.setItem('fullViewQuery', `SELECT * FROM "${selectedTable}"`);
                      window.open('/admin/data-explorer/full-view', '_blank');
                    }}
                    title="פתיחה בתצוגת מסך מלא"
                  >
                    <svg className="icon"><use href="#i-expand" /></svg>
                    טבלה מלאה
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Custom SQL Query Section */}
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <svg className="icon"><use href="#i-list" /></svg>
              הרצת שאילתת SQL מותאמת
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setShowLogModal(true); fetchLogs(); }}
            >
              <svg className="icon"><use href="#i-history" /></svg>
              היסטוריית שאילתות
            </button>
          </div>

          <div className="card card-pad" style={{ background: 'var(--accent-tint)', marginBottom: '18px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0', color: 'var(--accent-solid)', fontSize: '14.5px' }}>
              <svg className="icon"><use href="#i-star" /></svg>
              עוזר שאילתות AI
            </h3>
            <p className="hint" style={{ color: 'var(--text-2)', margin: '0 0 12px 0' }}>תאר במילים מה תרצה לשלוף או לעדכן, וה-AI יכתוב את השאילתה עבורך.</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
                <input
                  type="text"
                  className="input"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="לדוגמה: מחק את כל תיעודי הכניסה הישנים משנת 2024..."
                  onKeyDown={e => { if (e.key === 'Enter') generateAiQuery(); }}
                />
                {aiError && <div className="error-text">{aiError}</div>}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={generateAiQuery}
                disabled={isGeneratingAi || !aiPrompt.trim()}
              >
                {isGeneratingAi ? 'מייצר שאילתה...' : 'צור שאילתה'}
              </button>
            </div>
          </div>

          <div className="field" style={{ position: 'relative' }}>
            <label htmlFor="dataExplorerSqlQuery">
              הזן שאילתה (PostgreSQL):
              <span className="hint" style={{ marginInlineStart: '0.5rem', fontWeight: '400' }}>(לחץ Ctrl+Space להשלמה אוטומטית)</span>
            </label>
            <textarea
              id="dataExplorerSqlQuery"
              ref={textareaRef}
              className="textarea"
              style={{ minHeight: '150px', direction: 'ltr', textAlign: 'left', fontFamily: 'Consolas, Monaco, monospace' }}
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
              <div className="combobox-results">
                <div className="hint" style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>הצעות להשלמה:</div>
                {sqlSuggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="combobox-option"
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
                    <span style={{ fontFamily: 'Consolas, Monaco, monospace', fontWeight: '700', color: 'var(--primary-solid)' }}>{s.text}</span>
                    <span className="meta">{s.hebrew}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="toolbar" style={{ marginBottom: '18px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={runCustomQuery}
              disabled={loading || !customQuery.trim()}
            >
              <svg className="icon"><use href="#i-play" /></svg>
              {loading ? 'מריץ...' : 'הרץ שאילתה'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={queryResult.length === 0}
              onClick={() => downloadCSV(queryResult, 'query_results')}
            >
              <svg className="icon"><use href="#i-download" /></svg>
              הורד תוצאות CSV
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={queryResult.length === 0}
              onClick={() => downloadExcel(queryResult, 'query_results')}
            >
              <svg className="icon"><use href="#i-file" /></svg>
              הורד תוצאות Excel
            </button>
          </div>

          {queryError && (
            <div className="callout callout-danger" style={{ marginBottom: '16px', direction: 'ltr', textAlign: 'left' }}>
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              <span><strong>Query Error:</strong> {queryError}</span>
            </div>
          )}

          {queryResult.length > 0 && !queryError && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="table-wrap" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <div className="table-scroll">
                  <table className="data">
                    <thead>
                      <tr>
                        {queryColumns.map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.map((row, i) => (
                        <tr key={i}>
                          {queryColumns.map(col => (
                            <td key={col} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(row[col])}>
                              {row[col] !== null ? String(row[col]) : <span className="hint" style={{ fontStyle: 'italic' }}>NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="table-foot">
                <span>נמצאו <strong>{queryResult.length}</strong> רשומות</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    sessionStorage.setItem('fullViewQuery', customQuery);
                    window.open('/admin/data-explorer/full-view', '_blank');
                  }}
                  title="פתיחה בתצוגת מסך מלא"
                >
                  <svg className="icon"><use href="#i-expand" /></svg>
                  טבלה מלאה
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Query History Modal */}
      {showLogModal && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLogModal(false)}>
          <div className="modal" style={{ maxWidth: '800px', width: '90%', margin: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-history" /></svg>
                היסטוריית שאילתות
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowLogModal(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              {loadingLogs ? (
                <div className="loading-inline">
                  <span className="spinner" />
                  טוען היסטוריה...
                </div>
              ) : queryLogs.length === 0 ? (
                <div className="empty-state">
                  <svg className="icon"><use href="#i-history" /></svg>
                  <h4>אין היסטוריית שאילתות.</h4>
                </div>
              ) : (
                <div className="table-wrap" style={{ marginBottom: 0 }}>
                  {queryLogs.map(log => (
                    <div key={log.id} className="select-row" style={{ alignItems: 'flex-start' }}>
                      <svg className="icon" style={{ color: log.success ? 'var(--text-3)' : 'var(--danger)', marginTop: '2px' }}>
                        <use href={log.success ? '#i-check-circle' : '#i-x-circle'} />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <div className="hint" style={{ marginBottom: '4px' }}>{new Date(log.executedAt).toLocaleString('he-IL')}</div>
                        <div style={{ fontFamily: 'Consolas, Monaco, monospace', direction: 'ltr', textAlign: 'left', fontSize: '12.5px' }}>{log.query}</div>
                        {!log.success && log.errorMsg && (
                          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem', direction: 'ltr', textAlign: 'left' }}>
                            Error: {log.errorMsg}
                          </div>
                        )}
                      </div>
                      <span className={`badge ${log.success ? 'badge-success' : 'badge-danger'}`}>
                        {log.success ? 'הצלחה' : 'שגיאה'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setCustomQuery(log.query);
                          setShowLogModal(false);
                          if (textareaRef.current) textareaRef.current.focus();
                        }}
                      >
                        <svg className="icon"><use href="#i-edit" /></svg>
                        העתק לעורך
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
