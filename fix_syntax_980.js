const fs = require('fs');
let c = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const startIdx = c.indexOf('tr:nth-child(even) { background: #f8fafc; }');
const endIdx = c.indexOf('{/* Stage 1: Search & Date Selection */}');

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `tr:nth-child(even) { background: #f8fafc; }
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
  };

  return (
    <div className="layout-container" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', direction: 'rtl' }}>
      <style dangerouslySetInnerHTML={{ __html: \`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          background: linear-gradient(to right, #2563eb, #8b5cf6, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          animation: float 6s ease-in-out infinite;
        }
        
        .header-btn:hover { transform: scale(1.05); }
        .header-btn:active { transform: scale(0.95); }
        
        .model-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .model-card:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
        }
        
        .size-badge {
          transition: all 0.2s ease;
        }
        .size-badge:hover {
          transform: translateY(-2px);
          filter: brightness(0.95);
        }
      \`}} />
      
      `;

  c = c.substring(0, startIdx) + replacement + c.substring(endIdx);
  fs.writeFileSync('app/customer-interface/page.js', c);
  console.log("Restored missing code with indexOf!");
} else {
  console.log("Not found.");
}
