const fs = require('fs');
const text = fs.readFileSync('app/globals.css', 'utf8');
let open = (text.match(/\{/g) || []).length;
let close = (text.match(/\}/g) || []).length;
console.log(`Open: ${open}, Close: ${close}`);
