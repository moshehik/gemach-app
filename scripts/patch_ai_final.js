const fs = require('fs');
let code = fs.readFileSync('temp.js', 'utf8');

// 1. Add useEffect to clear chat on stage change
if (!code.includes('// Reset chat on stage change')) {
  code = code.replace(
    /const \[isAiChatVisible, setIsAiChatVisible\] = useState\(false\);/,
    `const [isAiChatVisible, setIsAiChatVisible] = useState(false);\n  useEffect(() => {\n    setIsAiChatVisible(false);\n    setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }]);\n  }, [stage]); // Reset chat on stage change`
  );
}

// 2. Fix the AI messages rendering and add the chat form
const oldChatRender = /\{isAiChatVisible && stage === 2 && \([\s\S]*?מקליד\.\.\.<\/div>\}\s*<\/div>\s*\)\}/;

const newChatRender = `{isAiChatVisible && stage === 2 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', marginTop: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between' }}>
                  <span><Sparkles size={18} /> העוזר החכם</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }])} title="שיחה חדשה" style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='#e2e8f0'} onMouseOut={e => e.currentTarget.style.background='#f1f5f9'}><Plus size={16} /></button>
                    <button onClick={() => setIsAiChatVisible(false)} title="סגור" style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', fontWeight: 'bold' }} onMouseOver={e => e.currentTarget.style.background='#fecaca'} onMouseOut={e => e.currentTarget.style.background='#fee2e2'}>X</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {aiMessages.slice(1).map((msg, idx) => (
                    <div key={idx} style={{ 
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.role === 'user' ? '#a855f7' : '#f8fafc',
                      color: msg.role === 'user' ? 'white' : '#1e293b',
                      padding: '10px 14px', borderRadius: '12px', maxWidth: '85%'
                    }}>
                      <div>
                        {msg.content.replace(/\\[FILTER:(.*?)\\]/g, '').replace(/\\[DATE:\\d{4}-\\d{2}-\\d{2}\\]/g, '').trim()}
                      </div>
                      {(() => {
                        const match = msg.content.match(/\\[FILTER:(.*?)\\]/);
                        if (match && match[1]) {
                          return (
                            <button 
                              onClick={() => setSearch(match[1])} 
                              style={{ marginTop: '8px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: msg.role === 'user' ? 'white' : '#3b82f6', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                              <Search size={14} style={{ marginRight: '6px', marginLeft: '6px' }} />
                              סנן: {match[1]}
                            </button>
                          )
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
                {aiLoading && <div style={{ textAlign: 'center', marginTop: '1rem', color: '#8b5cf6', fontSize: '0.9rem' }}>מקליד...</div>}
                
                <form onSubmit={handleAiSubmit} style={{ marginTop: '16px', display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="הקלד כאן..."
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', transition: 'all 0.2s' }}
                    onFocus={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#a855f7'; }}
                    onBlur={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  />
                  <button type="submit" disabled={aiLoading || !aiInput.trim()} style={{ background: '#a855f7', color: 'white', border: 'none', padding: '0 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', opacity: (aiLoading || !aiInput.trim()) ? 0.6 : 1, transition: 'all 0.2s' }}>
                    שלח
                  </button>
                </form>
            </div>
          )}`;

code = code.replace(oldChatRender, newChatRender);

fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
console.log('Chat box and stage isolation patched successfully');
