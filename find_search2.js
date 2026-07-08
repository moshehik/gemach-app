const fs = require('fs');
const lines = fs.readFileSync('app/page.js', 'utf8').split('\n');
const startIndex = lines.findIndex((l, i) => i > 150 && l.includes('searchResults'));
console.log(lines.slice(startIndex - 5, startIndex + 100).join('\n'));
