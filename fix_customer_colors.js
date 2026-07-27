const fs = require('fs');
let content = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// For style block (no quotes)
content = content.replace(/background:\s*(?:white|#ffffff);/g, "background: var(--card-bg);");
content = content.replace(/background:\s*(?:#f8fafc|#f1f5f9);/g, "background: var(--element-bg);");
content = content.replace(/background:\s*#e2e8f0;/g, "background: var(--border-main);");
content = content.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.8\);/g, "background: var(--card-bg);");
content = content.replace(/color:\s*(?:#0f172a|#1e293b|#334155);/g, "color: var(--text-main);");
content = content.replace(/color:\s*(?:#64748b|#475569);/g, "color: var(--text-secondary);");
content = content.replace(/border:\s*1px solid (?:#e2e8f0|#f1f5f9|rgba\(0,0,0,0\.05\));/g, "border: 1px solid var(--border-main);");
content = content.replace(/border-bottom:\s*1px solid (?:#e2e8f0|#f1f5f9|rgba\(0,0,0,0\.05\));/g, "border-bottom: 1px solid var(--border-main);");

// For inline styles (single quotes)
content = content.replace(/background:\s*'(?:white|#ffffff)'/g, "background: 'var(--card-bg)'");
content = content.replace(/background:\s*'(?:#f8fafc|#f1f5f9)'/g, "background: 'var(--element-bg)'");
content = content.replace(/background:\s*'#e2e8f0'/g, "background: 'var(--border-main)'");
content = content.replace(/background:\s*'rgba\(255,255,255,0\.8\)'/g, "background: 'var(--card-bg)'");
content = content.replace(/color:\s*'(?:#0f172a|#1e293b|#334155)'/g, "color: 'var(--text-main)'");
content = content.replace(/color:\s*'(?:#64748b|#475569)'/g, "color: 'var(--text-secondary)'");
content = content.replace(/border:\s*'1px solid (?:#e2e8f0|#f1f5f9|rgba\(0,0,0,0\.05\))'/g, "border: '1px solid var(--border-main)'");
content = content.replace(/borderBottom:\s*'1px solid (?:#e2e8f0|#f1f5f9|rgba\(0,0,0,0\.05\))'/g, "borderBottom: '1px solid var(--border-main)'");
content = content.replace(/borderColor:\s*'(?:#e2e8f0|#f1f5f9)'/g, "borderColor: 'var(--border-main)'");

// Ensure btn/header-btn colors aren't injected back in manually if they are inline
content = content.replace(/style={{([^}]*?)color:\s*'var\(--primary-light-hover\)',\s*background:\s*'var\(--primary-color\)',?\s*([^}]*)}}/g, "style={{}}");

// Also replace hover colors inline - wait, there is onMouseOver that sets background back to '#ffffff'
content = content.replace(/e\.currentTarget\.style\.background\s*=\s*'(?:white|#ffffff)'/g, "e.currentTarget.style.background='var(--card-bg)'");
content = content.replace(/e\.currentTarget\.style\.background\s*=\s*'(?:#f8fafc|#f1f5f9)'/g, "e.currentTarget.style.background='var(--element-bg)'");
content = content.replace(/e\.currentTarget\.style\.background\s*=\s*'#e2e8f0'/g, "e.currentTarget.style.background='var(--border-main)'");
content = content.replace(/e\.currentTarget\.style\.color\s*=\s*'(?:#0f172a|#1e293b)'/g, "e.currentTarget.style.color='var(--text-main)'");
content = content.replace(/e\.currentTarget\.style\.color\s*=\s*'(?:#64748b|#475569)'/g, "e.currentTarget.style.color='var(--text-secondary)'");

fs.writeFileSync('app/customer-interface/page.js', content, 'utf8');
console.log('Fixed styles.');
