'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';

export default function ExportButtons({ data = [], filename = 'export', columns = [], iconOnly = false, onFetchData = null }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hideAi, setHideAi] = useState(false);
  // שתי לשוניות בפופאפ הייצוא: "רגיל" (כמות שורות + אקסל/PDF) מול "AI" (חיפוש/ארגון
  // עם AI). הלשונית השנייה קיימת רק כש-AI פעיל במערכת (ראו hideAi למטה) — כשה-AI כבוי
  // אין טעם בלשוניות בכלל ומוצגות רק אפשרויות הייצוא הרגילות, בלי UI של לשוניות.
  // סגנון הלשוניות מבוסס על app/components/ErrorReportButton.js (.tabs/.tab).
  const [activeTab, setActiveTab] = useState('regular');

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
  // triggers the browser's print dialog. This HTML is a standalone printed
  // document rendered in its own window, not part of the app UI — it
  // intentionally uses static print-safe colors instead of app theme
  // variables (per project convention for print surfaces).
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
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={iconOnly ? "btn btn-secondary btn-icon-only" : "btn btn-primary"}
        title="מערכת הורדה ל-XL ודוחות"
      >
        <svg className="icon"><use href="#i-download" /></svg>
        {!iconOnly && <span>ייצוא ודוחות</span>}
      </button>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          data-agy-id="export_modal_backdrop"
          className="modal-backdrop"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            paddingBlockStart: '10vh', paddingBlockEnd: '10vh'
          }}
        >
          <div
            data-agy-id="export_modal_container"
            className="modal animate-fade-in"
            style={{ width: '90%', maxWidth: '500px', margin: 0, maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-download" /></svg>
                מערכת דוחות וייצוא נתונים
              </strong>
              <button
                data-agy-id="export_modal_close_btn"
                type="button"
                className="btn btn-ghost btn-icon-only btn-sm"
                onClick={() => setIsModalOpen(false)}
                title="סגירה"
              >
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div className="modal-body">
              {showAdminPrompt ? (
                <div className="callout callout-warning" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <h4 style={{ margin: '0 0 6px' }}>נדרש אישור מנהל</h4>
                  <p style={{ margin: '0 0 12px' }}>ייצוא של מעל 200 שורות דורש אימות מנהל. אנא הזן סיסמת מנהל:</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      data-agy-id="export_admin_pin_input"
                      className="input"
                      type="password"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      placeholder="סיסמת מנהל"
                      style={{ flex: 1 }}
                    />
                    <button
                      data-agy-id="export_admin_verify_btn"
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAdminVerify}
                      disabled={isLoading}
                    >
                      {isLoading ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} /> : 'אישור'}
                    </button>
                    <button
                      data-agy-id="export_admin_cancel_btn"
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setShowAdminPrompt(false); setPendingAction(null); }}
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* לשוניות רגיל/AI (item 34) — מוצגות רק כש-AI פעיל במערכת; כשהוא כבוי
                     (hideAi) אין UI של לשוניות בכלל ומוצגות רק אפשרויות הייצוא הרגילות. */}
                  {!hideAi && (
                    <div className="tabs" style={{ marginBottom: '20px' }}>
                      <button type="button" className={`tab${activeTab === 'regular' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('regular')}>
                        רגיל
                      </button>
                      <button type="button" className={`tab ai-feature-element${activeTab === 'ai' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('ai')}>
                        <svg className="icon"><use href="#i-star" /></svg>
                        AI
                      </button>
                    </div>
                  )}

                  {(hideAi || activeTab === 'regular') && (
                    <>
                      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-alt)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                        <label htmlFor="export-limit-input" style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-2)' }}>כמות שורות לייצוא:</label>
                        <input
                          data-agy-id="export_limit_input"
                          id="export-limit-input"
                          className="input"
                          type="number"
                          min="1"
                          value={exportLimit}
                          onChange={(e) => {
                             const val = parseInt(e.target.value);
                             setExportLimit(isNaN(val) ? 100 : val);
                             setIsAdminVerified(false); // Reset verification if limit changes
                          }}
                          style={{ width: '80px' }}
                        />
                        {exportLimit > 200 && !isAdminVerified && (
                          <span className="badge badge-danger">דורש מנהל</span>
                        )}
                        {isAdminVerified && (
                          <span className="badge badge-success">
                            <svg className="icon"><use href="#i-check" /></svg>
                            אושר מנהל
                          </span>
                        )}
                      </div>

                      <div style={{ marginBottom: hideAi ? 0 : '2rem' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-2)' }}>דוח מיידי מהנתונים (לפי הסינון הקיים):</h3>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button
                            data-agy-id="export_excel_btn"
                            type="button"
                            onClick={() => handleActionClick('excel')}
                            className="btn btn-secondary"
                            style={{ flex: 1, flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }}
                          >
                            <svg className="icon" style={{ width: '24px', height: '24px', color: 'var(--success)' }}><use href="#i-file" /></svg>
                            <span>ייצוא לאקסל</span>
                          </button>
                          <button
                            data-agy-id="export_pdf_btn"
                            type="button"
                            onClick={() => handleActionClick('pdf')}
                            className="btn btn-secondary"
                            style={{ flex: 1, flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }}
                          >
                            <svg className="icon" style={{ width: '24px', height: '24px', color: 'var(--danger)' }}><use href="#i-file" /></svg>
                            <span>ייצוא ל-PDF</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {!hideAi && activeTab === 'ai' && (
                    <div className="ai-feature-element">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-2)' }}>
                        <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>
                        דוח מותאם אישית באמצעות AI
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1rem' }}>
                        תאר כיצד תרצה לארגן את הנתונים, למשל: "סדר לפי מחיר וסכם לפי מידות", או "הצג רק דגמים במחיר מעל 100".
                      </p>

                      <textarea
                        data-agy-id="export_ai_prompt_textarea"
                        className="textarea"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="הכנס את בקשתך לדוח..."
                        style={{ height: '80px', resize: 'none', marginBottom: '1rem' }}
                        disabled={isLoading}
                      />

                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                          data-agy-id="export_excel_ai_btn"
                          type="button"
                          onClick={() => handleActionClick('excel_ai')}
                          disabled={isLoading}
                          className="btn"
                          style={{ flex: 1, backgroundColor: 'var(--accent-solid)', color: 'var(--text-on-primary)', border: 'none' }}
                        >
                          {isLoading ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-star" /></svg>}
                          <span>אקסל (AI)</span>
                        </button>
                        <button
                          data-agy-id="export_pdf_ai_btn"
                          type="button"
                          onClick={() => handleActionClick('pdf_ai')}
                          disabled={isLoading}
                          className="btn"
                          style={{ flex: 1, backgroundColor: 'var(--accent-solid)', color: 'var(--text-on-primary)', border: 'none' }}
                        >
                          {isLoading ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-star" /></svg>}
                          <span>PDF (AI)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
