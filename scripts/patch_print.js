const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const printCSS = `
        /* --- PRINT STYLES --- */
        @media print {
          @page { margin: 1cm; }
          body { background: white !important; font-family: Arial, sans-serif !important; }
          
          /* Hide interactive/unnecessary elements */
          nav, aside, .header-btn, form, input, button, 
          .ai-search-container, [onClick], 
          div[style*="maxHeight: '300px'"], 
          div[style*="maxHeight: '400px'"] { 
            display: none !important; 
          }
          
          /* Show elements that might have onClick but we need to see them */
          .dress-card { display: block !important; page-break-inside: avoid; margin-bottom: 20px; box-shadow: none !important; border: 1px solid #ccc !important; }
          
          /* Un-hide the main grid */
          .modern-grid { 
            display: grid !important; 
            grid-template-columns: repeat(3, 1fr) !important; 
            gap: 15px !important; 
            zoom: 1 !important; 
          }
          
          /* Fix typography for print */
          h1, h2, h3 { color: black !important; background: none !important; -webkit-text-fill-color: black !important; text-shadow: none !important; }
          
          .size-pill { border: 1px solid #ccc !important; background: white !important; color: black !important; }
          .size-pill.available { border: 2px solid #22c55e !important; color: #166534 !important; background: #f0fdf4 !important; font-weight: bold; }
          
          /* General cleanup */
          * { box-shadow: none !important; text-shadow: none !important; }
        }
`;

if (!code.includes('/* --- PRINT STYLES --- */')) {
  code = code.replace(
    /<\/style>/,
    printCSS + '\n      </style>'
  );
  fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
  console.log('Print styles added');
} else {
  console.log('Print styles already exist');
}
