const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const errorRegex = /<\/form>\s*<\/div>\s*\)\}\s*\)\}/;

if (errorRegex.test(code)) {
    code = code.replace(errorRegex, '</form>\n                </div>\n              )}');
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Fixed syntax error line 980');
} else {
    console.log('Regex failed, trying explicit string replacement');
    const target = '                </div>\n          )}\n              )}';
    if (code.includes(target)) {
        code = code.replace(target, '                </div>\n              )}');
        fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
        console.log('Fixed syntax error using fallback');
    } else {
        console.log('Fallback failed');
    }
}
