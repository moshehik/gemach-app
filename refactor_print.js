const fs = require('fs');
let c = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// 1. Add handleCatalogPrint after handlePrint
const insertPoint = c.indexOf('  const handlePrint = () => {');
if (insertPoint !== -1) {
  // find the end of handlePrint
  const handlePrintEnd = c.indexOf('  };', insertPoint) + 4;
  
  const newFunc = `

  const handleCatalogPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("נא לאפשר חלונות קופצים (Pop-ups) כדי להדפיס");
      return;
    }

    const dateStr = getHebrewDateString(selectedDate);
    const filterText = search ? \` - סינון: \${search}\` : '';
    
    let tableRows = '';
    displayDresses.forEach(model => {
      const sizeMap = new Map();
      let totalItems = 0;
      let totalAvailable = 0;
      model.items?.forEach(item => {
        if (item.notInUse || item.isDeleted || item.isUnusable) return;
        const st = item.sizeText || 'כללי';
        if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
        const info = sizeMap.get(st);
        info.total += 1;
        totalItems += 1;
        if (item.quantity > 0) {
          info.available += 1;
          totalAvailable += 1;
        }
      });
      
      const sizesArray = Array.from(sizeMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]), undefined, {numeric: true}));
      let sizesHtml = sizesArray.map(([sName, sData]) => {
        const isAvail = sData.available > 0;
        return \`<span style="display:inline-block; margin:2px; padding:4px 8px; border-radius:6px; font-size:13px; border:1px solid \${isAvail ? '#86efac' : '#cbd5e1'}; background:\${isAvail ? '#dcfce7' : '#e2e8f0'}; color:\${isAvail ? '#166534' : '#475569'}; \${isAvail ? 'font-weight:bold;' : ''}">\${sName} (\${sData.available}/\${sData.total})</span>\`;
      }).join('');
      
      tableRows += \`
        <tr>
          <td style="font-weight:bold;">\${model.name || ''}</td>
          <td>\${model.barcodePrefix || model.id || ''}</td>
          <td style="font-weight:bold;">\${totalAvailable} מתוך \${totalItems}</td>
          <td>\${sizesHtml || 'אין מלאי'}</td>
        </tr>
      \`;
    });

    const html = \`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>דוח מלאי - \${dateStr}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 20px; margin: 0; background: white; }
          .report-header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
          .report-header h1 { margin: 0 0 10px 0; font-size: 26px; color: #0f172a; }
          .report-header p { margin: 0; font-size: 16px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 12px 16px; text-align: right; }
          th { background: #f8fafc; font-weight: bold; color: #334155; font-size: 15px; border-bottom: 2px solid #cbd5e1; }
          tr:nth-child(even) { background: #f8fafc; }
          .summary { font-size: 16px; font-weight: bold; margin-top: 20px; text-align: right; padding-top: 15px; border-top: 2px solid #e2e8f0; }
          @media print {
            body { padding: 0; }
            table { box-shadow: none; }
            th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>דוח זמינות דגמים - גמ"ח שמלות</h1>
          <p>תאריך אירוע מבוקש: \${dateStr} | סינון: \${search ? \`"\${search}"\` : 'ללא סינון'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">שם הדגם</th>
              <th style="width: 15%;">קידומת ברקוד</th>
              <th style="width: 15%;">זמינים / סה"כ</th>
              <th style="width: 45%;">פירוט מידות וזמינות</th>
            </tr>
          </thead>
          <tbody>
            \${tableRows}
          </tbody>
        </table>
        <div class="summary">
          סה"כ דגמים מוצגים: \${displayDresses.length}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    \`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };`;
  
  c = c.substring(0, handlePrintEnd) + newFunc + c.substring(handlePrintEnd);
} else {
  console.log("Could not find handlePrint");
}

// 2. Change onClick={() => window.print()} title="הדפסה" to onClick={handleCatalogPrint}
c = c.replace('onClick={() => window.print()} title="הדפסה"', 'onClick={handleCatalogPrint} title="הדפסה"');

// 3. Remove .print-report JSX section
const jsxStartStr = '              <div className="print-report">';
const jsxEndStr = '              </div>\n            </>\n          )}\n        </div>\n      )}';
const jsxStartIdx = c.indexOf(jsxStartStr);
if (jsxStartIdx !== -1) {
  const jsxEndIdx = c.indexOf(jsxEndStr, jsxStartIdx);
  if (jsxEndIdx !== -1) {
    c = c.substring(0, jsxStartIdx) + c.substring(jsxEndIdx);
  } else {
    console.log("JSX end not found");
  }
} else {
  console.log("JSX start not found");
}

// 4. Remove @media print CSS block
const cssStartRegex = /@media print \{\s*\.layout-container > div:not\(\.print-report\)/;
const cssMatch = c.match(cssStartRegex);
if (cssMatch) {
  const cssStartIdx = cssMatch.index;
  const cssEndIdx = c.indexOf('          }\n        </style>', cssStartIdx);
  if (cssEndIdx !== -1) {
    c = c.substring(0, cssStartIdx) + c.substring(cssEndIdx);
  } else {
    console.log("CSS end not found");
  }
} else {
  console.log("CSS start not found");
}

fs.writeFileSync('app/customer-interface/page.js', c);
console.log("Refactoring complete");
