const fs = require('fs');
const file = 'app/customer-interface/page.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /\.sizes-row \{\s*display: flex;\s*gap: 8px;\s*flex-wrap: wrap;\s*\}/,
  `.sizes-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }`
);

code = code.replace(
  /\.size-pill \{\s*padding: 4px 12px;\s*border-radius: 12px;\s*font-size: 0\.85rem;\s*font-weight: 600;\s*background: #f1f5f9;\s*color: #64748b;\s*\}/,
  `.size-pill {
          padding: 6px 4px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 700;
          background: #f1f5f9;
          color: #64748b;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }`
);

fs.writeFileSync(file, code, 'utf8');
console.log('Sizes row CSS updated for 3-column grid');
