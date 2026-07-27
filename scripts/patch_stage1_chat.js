const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

const regexChatBlock = /\{aiMessages\.length > 1 && \([\s\S]*?<\/form>\s*<\/div>\s*\)\}/;

const newChatBlock = `{aiMessages.length > 1 && (
              <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)', color: '#1e293b', maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', padding: '8px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(168,85,247,0.3)' }}>
                      <Sparkles size={16} />
                    </div>
                    <span style={{ fontSize: '1.1rem', color: '#1e293b' }}>העוזר החכם</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }] }))} title="שיחה חדשה" style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => {e.currentTarget.style.background='#e2e8f0'; e.currentTarget.style.color='#3b82f6'; e.currentTarget.style.transform='rotate(90deg)';}} onMouseOut={e => {e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#64748b'; e.currentTarget.style.transform='rotate(0deg)';}}><Plus size={18} /></button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {aiMessages.slice(1).map((msg, idx) => {
                    let displayContent = msg.content;
                    let isoDateMatch = null;
                    if (typeof displayContent === 'string') {
                      const regex = /\\[DATE:(\\d{4}-\\d{2}-\\d{2})\\]/;
                      const match = displayContent.match(regex);
                      if (match) {
                        isoDateMatch = match[1];
                        displayContent = displayContent.replace(regex, '').trim();
                      }
                    }
                    
                    return (
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
                        <div>{displayContent}</div>
                        {msg.role === 'assistant' && isoDateMatch && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedDate(new Date(\`\${isoDateMatch}T12:00:00\`));
                              setStage(2);
                            }}
                            style={{ marginTop: '12px', background: '#f8fafc', color: '#ec4899', border: '1px solid #fce7f3', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(236,72,153,0.1)' }}
                            onMouseOver={e => { e.currentTarget.style.background = '#fdf2f8'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(236,72,153,0.2)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = '0 2px 5px rgba(236,72,153,0.1)'; }}
                          >
                            👉 הצג מלאי לתאריך {getHebrewDateString(new Date(\`\${isoDateMatch}T12:00:00\`))}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {aiLoading && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem', color: '#a855f7', fontSize: '0.9rem', alignSelf: 'flex-start', background: 'white', padding: '10px 16px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}><div className="animate-spin"><Loader2 size={16} /></div> <span>מקליד...</span></div>}
                
                <form onSubmit={handleAiSubmit} style={{ marginTop: '24px', display: 'flex', gap: '12px', background: '#f8fafc', padding: '8px', borderRadius: '999px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="מה תרצה לחפש?"
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '999px', border: 'none', outline: 'none', background: 'transparent', fontSize: '1.05rem', color: '#1e293b' }}
                  />
                  <button type="submit" disabled={aiLoading || !aiInput.trim()} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (aiLoading || !aiInput.trim()) ? 0.6 : 1, transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(168,85,247,0.4)' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                    <Send size={18} style={{ transform: 'rotate(-45deg)', marginLeft: '4px' }} />
                  </button>
                </form>
            </div>
          )}`;

if (regexChatBlock.test(code)) {
    code = code.replace(regexChatBlock, newChatBlock);
    
    // Now wrap the massive search bar so it only shows if chat is NOT open
    const massiveBarRegex = /<div style=\{\{ position: 'relative', display: 'flex', gap: '12px', alignItems: 'center' \}\}>\s*<form onSubmit=\{handleAiSubmit\}[\s\S]*?<\/form>\s*<\/div>/;
    
    const massiveBarMatch = code.match(massiveBarRegex);
    if (massiveBarMatch) {
        code = code.replace(massiveBarRegex, `{aiMessages.length <= 1 && (\n            ${massiveBarMatch[0]}\n          )}`);
        fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
        console.log('Stage 1 chat and massive search bar patched');
    } else {
        console.log('Massive bar regex failed');
    }
} else {
    console.log('Chat block regex failed');
}
