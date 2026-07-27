const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const oldButtonRegex = /<button\s*onClick=\{([^}]+)\}\s*style=\{\{([^}]+)\}\}>\s*<Search size=\{14\} style=\{\{ marginRight: '6px', marginLeft: '6px' \}\} \/>\s*סנן: \{match\[1\]\}\s*<\/button>/;

const newButton = `<button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSearch(match[1].trim());
                                // Flash effect to show it worked
                                e.currentTarget.style.transform = 'scale(0.95)';
                                setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(1)'; }, 150);
                              }} 
                              style={{ marginTop: '8px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: msg.role === 'user' ? 'white' : '#3b82f6', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}>
                              <Search size={14} style={{ marginRight: '6px', marginLeft: '6px' }} />
                              סנן: {match[1]}
                            </button>`;

if (oldButtonRegex.test(code)) {
    code = code.replace(oldButtonRegex, newButton);
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Filter button patched');
} else {
    console.log('Regex did not match. Trying alternate...');
    
    // Fallback: simple string replacement
    const fallbackSearch = `<button 
                              onClick={() => setSearch(match[1])}`;
    if (code.includes(fallbackSearch)) {
        code = code.replace(
            /<button \s*onClick=\{\(\) => setSearch\(match\[1\]\)\}/,
            `<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSearch(match[1].trim()); e.currentTarget.style.transform='scale(0.95)'; setTimeout(()=>e.currentTarget.style.transform='scale(1)',150); }}`
        );
        fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
        console.log('Filter button patched using fallback');
    } else {
        console.log('Fallback failed too.');
    }
}
