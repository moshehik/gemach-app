const fs = require('fs');
const content = fs.readFileSync('app/page.js', 'utf8');
fs.writeFileSync('page_dump.js', content, 'utf8');
