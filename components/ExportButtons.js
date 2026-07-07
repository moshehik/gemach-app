'use client';

import { useState } from 'react';
import { FileText, FileSpreadsheet, Download, Sparkles, X, Loader2, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExportButtons({ data = [], filename = 'export', columns = [], iconOnly = false }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleExcel = (dataToExport = data, customColumns = columns) => {
    if (!dataToExport || dataToExport.length === 0) {
      alert('אין נתונים לייצוא');
      return;
    }
    
    // If it's AI data, it might have its own keys, so we just export it directly if customColumns is empty
    const exportData = (customColumns.length > 0 && dataToExport === data) 
      ? processDataForExport(dataToExport) 
      : dataToExport;
      
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const handlePDF = (dataToExport = data, customColumns = columns) => {
    if (!dataToExport || dataToExport.length === 0) {
      alert('אין נתונים לייצוא');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('אנא אפשר חלונות קופצים (Popups) עבור אתר זה כדי להדפיס.');
      return;
    }
    
    // If it's AI generated data, we might not have the same columns, so extract headers from the first object
    const headers = (customColumns.length > 0 && dataToExport === data) 
      ? customColumns.map(c => c.label) 
      : Object.keys(dataToExport[0] || {});

    let tableHtml = '<table style="width:100%; border-collapse: collapse; font-family: Arial, sans-serif; direction: rtl; font-size: 14px;">';
    
    // Header
    tableHtml += '<thead><tr>';
    headers.forEach(header => {
      tableHtml += `<th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2; text-align: right;">${header}</th>`;
    });
    tableHtml += '</tr></thead>';
    
    // Body
    tableHtml += '<tbody>';
    dataToExport.forEach(item => {
      tableHtml += '<tr>';
      if (customColumns.length > 0 && dataToExport === data) {
        customColumns.forEach(col => {
          const cellValue = item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : '';
          tableHtml += `<td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cellValue}</td>`;
        });
      } else {
        headers.forEach(header => {
          const cellValue = item[header] !== undefined && item[header] !== null ? item[header] : '';
          tableHtml += `<td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cellValue}</td>`;
        });
      }
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    const html = `
      <html dir="rtl">
        <head>
          <title>${filename}</title>
          <style>
            @media print {
              @page { margin: 20px; }
            }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
          <h2 style="font-family: Arial, sans-serif; text-align: right;">${filename}</h2>
          ${tableHtml}
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleAIReport = async (exportFormat) => {
    if (!aiPrompt.trim()) {
      alert('אנא פרט כיצד תרצה שה-AI יארגן את הנתונים.');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: processDataForExport(data), prompt: aiPrompt, columns: columns.map(c => c.label) })
      });
      
      if (!response.ok) throw new Error('שגיאה ביצירת הדוח בשרת');
      
      const { processedData } = await response.json();
      
      if (exportFormat === 'excel') {
        handleExcel(processedData, []); // Empty columns because AI might change schema
      } else {
        handlePDF(processedData, []);
      }
      
      setIsModalOpen(false);
      setAiPrompt('');
    } catch (error) {
      console.error(error);
      alert('אירעה שגיאה בעיבוד הנתונים מול ה-AI. נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className={iconOnly ? "btn btn-outline" : "btn btn-primary"}
        title="מערכת הורדה ל-XL ודוחות"
        style={iconOnly 
          ? { padding: '0.6rem', borderRadius: '8px', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ddd', color: '#8b5cf6', backgroundColor: '#f3e8ff', cursor: 'pointer' }
          : { padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        <FileDown size={iconOnly ? 22 : 18} />
        {!iconOnly && <span>ייצוא ודוחות</span>}
      </button>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          paddingTop: '10vh', paddingBottom: '10vh'
        }}>
          <div style={{
            background: 'white', padding: '2rem', borderRadius: '12px',
            width: '90%', maxWidth: '500px', position: 'relative',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', direction: 'rtl',
            maxHeight: '80vh', overflowY: 'auto'
          }}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
            >
              <X size={24} />
            </button>
            
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#333' }}>
              <FileDown size={24} color="var(--primary-color)" />
              מערכת דוחות וייצוא נתונים
            </h2>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#555' }}>דוח מיידי מהנתונים הקיימים:</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => { handleExcel(); setIsModalOpen(false); }}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', background: '#f9f9f9' }}
                >
                  <FileSpreadsheet size={24} color="#107c41" />
                  <span>ייצוא לאקסל</span>
                </button>
                <button 
                  onClick={() => { handlePDF(); setIsModalOpen(false); }}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', background: '#f9f9f9' }}
                >
                  <FileText size={24} color="#d32f2f" />
                  <span>ייצוא ל-PDF</span>
                </button>
              </div>
            </div>

            <hr style={{ borderTop: '1px solid #eee', marginBottom: '1.5rem' }} />

            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', marginBottom: '0.5rem', color: '#555' }}>
                <Sparkles size={18} color="#9c27b0" />
                דוח מותאם אישית באמצעות AI
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: '1rem' }}>
                תאר כיצד תרצה לארגן את הנתונים, למשל: "סדר לפי מחיר וסכם לפי מידות", או "הצג רק דגמים במחיר מעל 100".
              </p>
              
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="הכנס את בקשתך לדוח..."
                style={{ width: '100%', height: '80px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '1rem', fontFamily: 'inherit', resize: 'none' }}
                disabled={isLoading}
              />
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => handleAIReport('excel')}
                  disabled={isLoading}
                  style={{ flex: 1, padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', backgroundColor: '#9c27b0', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  <span>אקסל (AI)</span>
                </button>
                <button 
                  onClick={() => handleAIReport('pdf')}
                  disabled={isLoading}
                  style={{ flex: 1, padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', borderRadius: '8px', backgroundColor: '#7b1fa2', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  <span>PDF (AI)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

