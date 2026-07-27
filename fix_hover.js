const fs = require('fs');
let content = fs.readFileSync('app/customer-interface/page.js', 'utf8');
content = content.replace(/color:\s*'var\(--primary-light-hover\)'/g, "color: 'var(--btn-primary-text, white)'");
fs.writeFileSync('app/customer-interface/page.js', content, 'utf8');
