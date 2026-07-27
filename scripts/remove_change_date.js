const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const regex = /<div style=\{\{ display: 'flex', alignItems: 'center', gap: '16px' \}\}>\s*\{\/\* Embedded Calendar Mini \*\/\}\s*<div style=\{\{ background: 'linear-gradient\([\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

if (regex.test(code)) {
    code = code.replace(regex, '');
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Removed change date button.');
} else {
    console.log('Regex did not match.');
}
