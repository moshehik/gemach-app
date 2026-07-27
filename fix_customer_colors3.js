const fs = require('fs');
let content = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// Container backgrounds
content = content.replace(/background:\s*'rgba\(255,\s*255,\s*255,\s*0\.95\)'/g, "background: 'var(--card-bg)'");
content = content.replace(/background:\s*'linear-gradient\(135deg,\s*rgba\(255,255,255,0\.9\)\s*0%,\s*rgba\(248,250,252,0\.9\)\s*100%\)'/g, "background: 'var(--card-bg)'");
content = content.replace(/background:\s*'rgba\(255,255,255,0\.6\)'/g, "background: 'var(--card-bg)'");
content = content.replace(/background:\s*'linear-gradient\(135deg,\s*rgba\(248,250,252,0\.9\),\s*rgba\(241,245,249,0\.9\)\)'/g, "background: 'var(--element-bg)'");

// Specific buttons with hardcoded hex colors
content = content.replace(/color:\s*'#ef4444',\s*background:\s*'#fee2e2'/g, "color: 'var(--danger-text)', background: 'var(--danger-bg)'");
content = content.replace(/color:\s*'#3b82f6',\s*background:\s*'#dbeafe'/g, "color: 'var(--primary-color)', background: 'var(--primary-light)'");
content = content.replace(/color:\s*'#10b981',\s*background:\s*'#d1fae5'/g, "color: 'var(--success-text)', background: 'var(--success-bg)'");
content = content.replace(/color:\s*'#8b5cf6',\s*background:\s*'#ede9fe'/g, "color: 'var(--accent-color)', background: 'var(--empty-bg)'");
content = content.replace(/color:\s*'#f59e0b',\s*background:\s*'#fef3c7'/g, "color: 'var(--warning-color, #f59e0b)', background: 'var(--banner-rentals-border)'");
content = content.replace(/color:\s*'#3b82f6',\s*background:\s*'#eff6ff'/g, "color: 'var(--primary-color)', background: 'var(--primary-light)'");
content = content.replace(/background:\s*'#fee2e2'/g, "background: 'var(--danger-bg)'");
content = content.replace(/color:\s*'#ef4444'/g, "color: 'var(--danger-text)'");

// JS mouse event styles
content = content.replace(/e\.currentTarget\.style\.background='#fecaca'/g, "e.currentTarget.style.background='var(--danger-text)'");
content = content.replace(/e\.currentTarget\.style\.background='#fee2e2'/g, "e.currentTarget.style.background='var(--danger-bg)'");
content = content.replace(/e\.currentTarget\.style\.color='#3b82f6'/g, "e.currentTarget.style.color='var(--primary-color)'");

fs.writeFileSync('app/customer-interface/page.js', content, 'utf8');
console.log('Fixed more hardcoded UI colors.');
