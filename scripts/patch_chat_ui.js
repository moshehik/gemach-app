const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const oldRegex = /\{isAiChatVisible && stage === 2 && \([\s\S]*?מקליד\.\.\.<\/div>\}\s*<form[\s\S]*?<\/form>\s*<\/div>\s*\)\}/;

const newChatCode = `{isAiChatVisible && stage === 2 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '24px', marginTop: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)', maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', padding: '8px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(168,85,247,0.3)' }}>
                      <Sparkles size={16} />
                    </div>
                    <span style={{ fontSize: '1.1rem', color: '#1e293b' }}>העוזר החכם</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }])} title="שיחה חדשה" style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => {e.currentTarget.style.background='#e2e8f0'; e.currentTarget.style.color='#3b82f6'; e.currentTarget.style.transform='rotate(90deg)';}} onMouseOut={e => {e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#64748b'; e.currentTarget.style.transform='rotate(0deg)';}}><Plus size={18} /></button>
                    <button onClick={() => setIsAiChatVisible(false)} title="סגור" style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', fontWeight: 'bold' }} onMouseOver={e => {e.currentTarget.style.background='#fecaca'; e.currentTarget.style.transform='scale(1.1)';}} onMouseOut={e => {e.currentTarget.style.background='#fee2e2'; e.currentTarget.style.transform='scale(1)';}}>X</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {aiMessages.slice(1).map((msg, idx) => (
                    <div key={idx} style={{ 
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'white',
                      color: msg.role === 'user' ? 'white' : '#1e293b',
                      padding: '14px 18px', 
                      borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                      maxWidth: '85%',
                      boxShadow: msg.role === 'user' ? '0 4px 15px rgba(168,85,247,0.3)' : '0 4px 15px rgba(0,0,0,0.04)',
                      border: msg.role === 'user' ? 'none' : '1px solid #f1f5f9',
                      lineHeight: '1.5'
                    }}>
                      <div>
                        {msg.content.replace(/\\[FILTER:(.*?)\\]/g, '').replace(/\\[DATE:\\d{4}-\\d{2}-\\d{2}\\]/g, '').trim()}
                      </div>
                      {(() => {
                        const match = msg.content.match(/\\[FILTER:(.*?)\\]/);
                        if (match && match[1]) {
                          return (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSearch(match[1].trim());
                                e.currentTarget.style.transform = 'scale(0.95)';
                                setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(1)'; }, 150);
                              }} 
                              style={{ marginTop: '12px', background: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : '#f8fafc', border: msg.role === 'user' ? '1px solid rgba(255,255,255,0.4)' : '1px solid #e2e8f0', color: msg.role === 'user' ? 'white' : '#3b82f6', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                              onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)'}
                              onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)'}
                            >
                              <Search size={14} style={{ marginRight: '6px', marginLeft: '6px' }} />
                              סנן דגמים: {match[1]}
                            </button>
                          )
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
                {aiLoading && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem', color: '#a855f7', fontSize: '0.9rem', alignSelf: 'flex-start', background: 'white', padding: '10px 16px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}><div className="animate-spin"><Loader2 size={16} /></div> <span>מקליד...</span></div>}
                
                <form onSubmit={handleAiSubmit} style={{ marginTop: '24px', display: 'flex', gap: '12px', background: '#f8fafc', padding: '8px', borderRadius: '999px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="מה תרצה לדעת?"
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '999px', border: 'none', outline: 'none', background: 'transparent', fontSize: '1.05rem', color: '#1e293b' }}
                  />
                  <button type="submit" disabled={aiLoading || !aiInput.trim()} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (aiLoading || !aiInput.trim()) ? 0.6 : 1, transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(168,85,247,0.4)' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                    <Send size={18} style={{ transform: 'rotate(-45deg)', marginLeft: '4px' }} />
                  </button>
                </form>
            </div>
          )}`;

if (oldRegex.test(code)) {
    code = code.replace(oldRegex, newChatCode);
    fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
    console.log('Chat UI modernized');
} else {
    console.log('Regex did not match.');
}
