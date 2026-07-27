const fs = require('fs');
let content = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// Replace any remaining #e2e8f0 and #cbd5e1 with var(--border-main)
content = content.replace(/#e2e8f0/g, "var(--border-main)");
content = content.replace(/#cbd5e1/g, "var(--border-main)");

fs.writeFileSync('app/customer-interface/page.js', content, 'utf8');
console.log('Fixed #e2e8f0 and #cbd5e1.');
