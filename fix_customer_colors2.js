const fs = require('fs');
let content = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// The main layout background gradient
content = content.replace(/background:\s*'linear-gradient\(135deg,\s*#f8fafc\s*0%,\s*#e2e8f0\s*100%\)'/g, "background: 'var(--bg-color)'");
content = content.replace(/background:\s*'rgba\(255,\s*255,\s*255,\s*0\.85\)'/g, "background: 'var(--card-bg)'");
content = content.replace(/background:\s*'rgba\(255,\s*255,\s*255,\s*0\.7\)'/g, "background: 'var(--card-bg)'");
content = content.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.7\);/g, "background: var(--card-bg);");

// Also there was an inline style for the search input background which I think missed the regex
content = content.replace(/background:\s*'rgba\(255,255,255,0\.8\)'/g, "background: 'var(--input-bg)'");

// For strings returning HTML inside print functions, let's leave them alone or replace them safely
// But wait, there is a span in the AI chat returning HTML:
content = content.replace(/background:\s*\$\{isAvail\s*\?\s*'#dcfce7'\s*:\s*'#e2e8f0'\}/g, "background:");
content = content.replace(/border:\s*1px\s*solid\s*\$\{isAvail\s*\?\s*'#86efac'\s*:\s*'#cbd5e1'\}/g, "border:1px solid ");
content = content.replace(/color:\s*\$\{isAvail\s*\?\s*'#166534'\s*:\s*'#475569'\}/g, "color:");

// There's a #ffffff I missed in AI loading state
content = content.replace(/background:\s*'#3b82f6',\s*color:\s*'#ffffff'/g, "background: 'var(--primary-color)', color: 'var(--btn-primary-text, white)'");
content = content.replace(/background:\s*'#ffffff'/g, "background: 'var(--card-bg)'");
content = content.replace(/color:\s*'#ffffff'/g, "color: 'var(--card-bg)'");

fs.writeFileSync('app/customer-interface/page.js', content, 'utf8');
console.log('Fixed more styles.');
