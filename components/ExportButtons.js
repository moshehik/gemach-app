'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, FileSpreadsheet, Download, Sparkles, X, Loader2, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExportButtons({ data = [], filename = 'export', columns = [], iconOnly = false, onFetchData = null }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hideAi, setHideAi] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setHideAi(document.body.classList.contains('hide-ai-features'));
    }
  }, []);
  
  const [exportLimit, setExportLimit] = useState(100);
  const [adminPin, setAdminPin] = useState('');
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const processDataForExport = (dataToProcess) => {
    return columns.length > 0 
      ? dataToProcess.map(item => {
          const row = {};
          columns.forEach(col => {
            row[col.label] = item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : '';
          });
          return row;
        })
      : dataToProcess;
  };

  const buildTableHtml = (dataToExport, useColumns = true) => {
    const withColumns = useColumns && columns.length > 0;
    const headers = withColumns ? columns.map(c => c.label) : Object.keys(dataToExport[0] || {});
    let tableHtml = '<table><thead><tr>';
    headers.forEach(header => {
      tableHtml += `<th>${header}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    dataToExport.forEach(item => {
      tableHtml += '<tr>';
      if (withColumns) {
        columns.forEach(col => {
          const cellValue = item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : '';
          tableHtml += `<td>${cellValue}</td>`;
        });
      } else {
        headers.forEach(header => {
          const cellValue = item[header] !== undefined && item[header] !== null ? item[header] : '';
          tableHtml += `<td>${cellValue}</td>`;
        });
      }
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    return tableHtml;
  };

  // Opens a popup with a self-contained, print-ready document (A4, repeating
  // table headers on every page, rows kept whole across page breaks) and
  // triggers the browser's print dialog.
  const openPrintDocument = (innerHtml) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('אנא אפשר חלונות קופצים (Popups) עבור אתר זה כדי להדפיס.');
      return false;
    }
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
        <head>
          <meta charset="utf-8" />
          <title>${filename}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: Arial, sans-serif; direction: rtl; margin: 0; padding: 10px; color: #000; background: #fff; }
            .doc-bsd { text-align: right; font-weight: bold; margin-bottom: 6px; font-size: 13px; }
            .doc-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 14px; }
            .doc-header h2 { margin: 0; font-size: 20px; }
            .doc-meta { font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: right; }
            th { background: #f2f2f2; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            tbody tr:nth-child(even) td { background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            h1, h2, h3 { break-after: avoid-page; page-break-after: avoid; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
          <div class="doc-bsd">בס"ד</div>
          <div class="doc-header">
            <h2>${filename}</h2>
            <span class="doc-meta">הופק בתאריך ${new Date().toLocaleString('he-IL')}</span>
          </div>
          ${innerHtml}
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    return true;
  };

  const getExportData = async () => {
    if (onFetchData) {
      setIsLoading(true);
      try {
        const fetchedData = await onFetchData(exportLimit);
        setIsLoading(false);
        return fetchedData;
      } catch (e) {
        setIsLoading(false);
        alert('שגיאה בשליפת הנתונים');
        return null;
      }
    }
    // If no fetch function, return existing data but sliced to the limit
    return data.slice(0, exportLimit);
  };

  const executeAction = async (action) => {
    const dataToExport = await getExportData();
    if (!dataToExport || dataToExport.length === 0) {
      if (!onFetchData) alert('אין נתונים לייצוא');
      return;
    }

    if (action === 'excel') {
      const exportData = columns.length > 0 ? processDataForExport(dataToExport) : dataToExport;
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      setIsModalOpen(false);
    } else if (action === 'pdf') {
      if (openPrintDocument(buildTableHtml(dataToExport))) {
        setIsModalOpen(false);
      }
    } else if (action === 'excel_ai' || action === 'pdf_ai') {
      const exportFormat = action === 'excel_ai' ? 'excel' : 'pdf';
      if (!aiPrompt.trim()) {
        alert('אנא פרט כיצד תרצה שה-AI יארגן את הנתונים.');
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch('/api/ai/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: processDataForExport(dataToExport), prompt: aiPrompt, columns: columns.map(c => c.label), format: exportFormat })
        });
        
        if (!response.ok) throw new Error('שגיאה ביצירת הדוח בשרת');
        
        const { processedData } = await response.json();
        
        if (exportFormat === 'excel') {
          const worksheet = XLSX.utils.json_to_sheet(processedData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
          XLSX.writeFile(workbook, `${filename}.xlsx`);
        } else {
          // processedData is either an HTML string from the AI, or (as a
          // fallback) still an array of row objects.
          const innerHtml = typeof processedData === 'string'
            ? processedData
            : buildTableHtml(processedData, false);
          if (!openPrintDocument(innerHtml)) {
            setIsLoading(false);
            return;
          }
        }
        
        setIsModalOpen(false);
        setAiPrompt('');
      } catch (error) {
        console.error(error);
        alert('אירעה שגיאה בעיבוד הנתונים מול ה-AI. נסה שוב.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleActionClick = (action) => {
    if (exportLimit > 200 && !isAdminVerified) {
      setPendingAction(action);
      setShowAdminPrompt(true);
    } else {
      executeAction(action);
    }
  };

  const handleAdminVerify = async () => {
    if (!adminPin) {
      alert('נא להזין סיסמת מנהל');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin, requiredLevel: 'מנהל' })
      });
      const data = await res.json();
      if (data.success) {
        setIsAdminVerified(true);
        setShowAdminPrompt(false);
        setAdminPin('');
        if (pendingAction) {
          executeAction(pendingAction);
        }
      } else {
        alert(data.error || 'סיסמה שגויה או שאין הרשאת מנהל');
      }
    } catch (e) {
      alert('שגיאה באימות מנהל');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        data-agy-id="export_open_modal_btn"
        onClick={() => setIsModalOpen(true)}
        className={iconOnly ? "btn-header-icon" : "btn btn-primary"}
        title="מערכת הורדה ל-XL ודוחות"
        style={iconOnly 
          ? {}
          : { padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        <FileDown size={iconOnly ? 20 : 18} />
        {!iconOnly && <span>ייצוא ודוחות</span>}
      </button>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div data-agy-id="export_modal_backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          paddingTop: '10vh', paddingBottom: '10vh'
        }}>
          <div data-agy-id="export_modal_container" style={{
            background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px',
            width: '90%', maxWidth: '500px', position: 'relative',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', direction: 'rtl',
            maxHeight: '80vh', overflowY: 'auto'
          }}>
            <button 
              data-agy-id="export_modal_close_btn"              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
            >
              <X size={24} />
            </button>
            
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
              <FileDown size={24} color="var(--primary-color)" />
              מערכת דוחות וייצוא נתונים
            </h2>

            {showAdminPrompt ? (
              <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffe69c', marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#664d03', marginTop: 0, marginBottom: '0.5rem' }}>נדרש אישור מנהל</h4>
                <p style={{ fontSize: '0.85rem', color: '#664d03', marginBottom: '1rem' }}>ייצוא של מעל 200 שורות דורש אימות מנהל. אנא הזן סיסמת מנהל:</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    data-agy-id="export_admin_pin_input"                    type="password" 
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="סיסמת מנהל"
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }}
                  />
                  <button 
                    data-agy-id="export_admin_verify_btn"                    type="button"
                    onClick={handleAdminVerify}
                    disabled={isLoading}
                    style={{ padding: '0.5rem 1rem', background: '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'אישור'}
                  </button>
                  <button 
                    data-agy-id="export_admin_cancel_btn"                    type="button"
                    onClick={() => { setShowAdminPrompt(false); setPendingAction(null); }}
                    style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
                  <label style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>כמות שורות לייצוא:</label>
                  <input 
                    data-agy-id="export_limit_input"                    type="number" 
                    min="1" 
                    value={exportLimit}
                    onChange={(e) => {
                       const val = parseInt(e.target.value);
                       setExportLimit(isNaN(val) ? 100 : val);
                       setIsAdminVerified(false); // Reset verification if limit changes
                    }}
                    style={{ width: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }}
                  />
                  {exportLimit > 200 && !isAdminVerified && (
                    <span style={{ fontSize: '0.8rem', color: '#dc3545' }}>(דורש מנהל)</span>
                  )}
                  {isAdminVerified && (
                    <span style={{ fontSize: '0.8rem', color: '#198754' }}>✓ אושר מנהל</span>
                  )}
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>דוח מיידי מהנתונים (לפי הסינון הקיים):</h3>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      data-agy-id="export_excel_btn"                      type="button"
                      onClick={() => handleActionClick('excel')}
                      className="btn btn-outline"
                      style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', background: '#f9f9f9' }}
                    >
                      <FileSpreadsheet size={24} color="#107c41" />
                      <span>ייצוא לאקסל</span>
                    </button>
                    <button 
                      data-agy-id="export_pdf_btn"                      type="button"
                      onClick={() => handleActionClick('pdf')}
                      className="btn btn-outline"
                      style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', background: '#f9f9f9' }}
                    >
                      <FileText size={24} color="#d32f2f" />
                      <span>ייצוא ל-PDF</span>
                    </button>
                  </div>
                </div>

                {!hideAi && (
                  <>
                    <hr className="ai-feature-element" style={{ borderTop: '1px solid #eee', marginBottom: '1.5rem' }} />

                    <div className="ai-feature-element">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                        <Sparkles size={18} color="#9c27b0" />
                        דוח מותאם אישית באמצעות AI
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        תאר כיצד תרצה לארגן את הנתונים, למשל: "סדר לפי מחיר וסכם לפי מידות", או "הצג רק דגמים במחיר מעל 100".
                      </p>
                      
                      <textarea
                        data-agy-id="export_ai_prompt_textarea"                    value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="הכנס את בקשתך לדוח..."
                        style={{ width: '100%', height: '80px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', marginBottom: '1rem', fontFamily: 'inherit', resize: 'none' }}
                        disabled={isLoading}
                      />
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                          data-agy-id="export_excel_ai_btn"                      type="button"
                          onClick={() => handleActionClick('excel_ai')}
                          disabled={isLoading}
                          style={{ flex: 1, padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', backgroundColor: '#9c27b0', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
                        >
                          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                          <span>אקסל (AI)</span>
                        </button>
                        <button 
                          data-agy-id="export_pdf_ai_btn"                      type="button"
                          onClick={() => handleActionClick('pdf_ai')}
                          disabled={isLoading}
                          style={{ flex: 1, padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', backgroundColor: '#7b1fa2', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
                        >
                          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                          <span>PDF (AI)</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

