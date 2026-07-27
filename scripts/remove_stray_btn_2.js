const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const buttonRegex = /\{aiMessages\.length > 1 && \(\s*<button\s*onClick=\{[^}]+\}\s*title="נקה צ'אט"[\s\S]*?<\/button>\s*\)\}/;

if (buttonRegex.test(code)) {
    code = code.replace(buttonRegex, '');
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Stray button removed successfully');
} else {
    // If it fails, maybe the title has weird characters? 
    // Let's use a broader regex looking for the height: '64px' which is unique to that button
    const fallbackRegex = /\{aiMessages\.length > 1 && \(\s*<button[\s\S]*?height:\s*'64px'[\s\S]*?<\/button>\s*\)\}/;
    if (fallbackRegex.test(code)) {
        code = code.replace(fallbackRegex, '');
        fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
        console.log('Stray button removed via fallback regex');
    } else {
        console.log('Both regexes failed');
    }
}
