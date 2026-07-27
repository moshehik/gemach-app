const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

code = code.replace(
  /\.ai-search-container, \[onClick\],/,
  `.ai-search-container,`
);

fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
console.log('Fixed dangerous onClick print rule');
