const fs = require('fs');
const file = 'app/customer-interface/page.js';
let code = fs.readFileSync(file, 'utf8');

const targetRegex = /<div style=\{\{ position: 'relative', flex: '1 1 280px' \}\}>\s*<form onSubmit=\{handleAiSubmit\} style=\{\{ margin: 0, width: '100%' \}\}>\s*<Sparkles size=\{20\} color="#a855f7" style=\{\{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY\(-50%\)' \}\} \/>\s*<input\s*type="text"\s*placeholder="שאל את ה-AI\.\.\."\s*value=\{aiInput\}\s*onChange=\{e => setAiInput\(e\.target\.value\)\}\s*disabled=\{aiLoading\}\s*style=\{\{.*?\}\}\s*onFocus=\{\{.*?\}\}\s*onBlur=\{\{.*?\}\}\s*\/>\s*<\/form>\s*<\/div>/s;

const newContent = `{isAiChatVisible ? (
                <div style={{ position: 'relative', flex: '1 1 280px', display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => setIsAiChatVisible(false)} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', color: '#a855f7', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s' }}>
                    <Sparkles size={20} />
                    העוזר החכם פעיל - לחץ לסגירה
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', flex: '1 1 280px' }}>
                  <form onSubmit={handleAiSubmit} style={{ margin: 0, width: '100%' }}>
                    <Sparkles size={20} color="#a855f7" style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text" 
                      placeholder="שאל את ה-AI..."
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      disabled={aiLoading}
                      style={{ width: '100%', padding: '16px 48px 16px 20px', borderRadius: '16px', border: '2px solid transparent', background: 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(241,245,249,0.9))', fontSize: '1.05rem', outline: 'none', transition: 'all 0.3s' }}
                      onFocus={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(168,85,247,0.1)'; }}
                      onBlur={e => { if(!aiInput) { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(241,245,249,0.9))'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; } }}
                    />
                  </form>
                </div>
              )}`;

const newCode = code.replace(
  /<div style=\{\{ position: 'relative', flex: '1 1 280px' \}\}>\s*<form onSubmit=\{handleAiSubmit\}[\s\S]*?<\/form>\s*<\/div>/,
  newContent
);

fs.writeFileSync(file, newCode, 'utf8');
console.log('AI Input toggle patched');
