const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// Update CSS
code = code.replace(
  /\.size-pill \{\s*padding: 6px 4px;\s*border-radius: 10px;\s*font-size: 0\.85rem;\s*font-weight: 700;\s*background: #f1f5f9;\s*color: #64748b;\s*text-align: center;\s*white-space: nowrap;\s*overflow: hidden;\s*text-overflow: ellipsis;\s*\}/,
  `.size-pill {
          padding: 6px 4px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 700;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          overflow: hidden;
        }`
);

// Update JSX
const oldJsxRegex = /<div key=\{sName\} className=\{`size-pill \$\{sData\.available > 0 \? 'available' : ''\}`\} title=\{`\$\{sData\.available\} .*? \$\{sData\.total\}`\}>\s*.*? \{sName\} \(\{sData\.available\}\)\s*<\/div>/;

const newJsx = `<div key={sName} className={\`size-pill \${sData.available > 0 ? 'available' : ''}\`} title={\`\${sData.available} מתוך \${sData.total}\`}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>• {sName}</span>
                              <span style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>({sData.available})</span>
                            </div>`;

code = code.replace(oldJsxRegex, newJsx);

fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
console.log('Size pill patched');
