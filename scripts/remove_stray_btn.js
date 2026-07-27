const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const regex = /\{aiMessages\.length > 1 && \(\s*<button\s*onClick=\{[^}]+\}\s*title="נקה צ'אט"[\s\S]*?<\/button>\s*\)\}/;

if (regex.test(code)) {
    code = code.replace(regex, '');
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Stray clear chat button removed');
} else {
    console.log('Regex failed');
}
