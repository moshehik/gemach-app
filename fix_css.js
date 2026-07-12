const fs = require('fs');
let content = fs.readFileSync('app/globals.css', 'utf8');
content = content.replace(/\\\\/g, '\\');
fs.writeFileSync('app/globals.css', content);
console.log('Done!');
