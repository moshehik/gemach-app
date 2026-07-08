const fs = require('fs');
let content = fs.readFileSync('app/page.js', 'utf8');

// Add aiReplyInput state
const stateMarker = const [aiResponse, setAiResponse] = useState('');;
// Wait, aiResponse was replaced. I need to find const [aiMessages, setAiMessages] = useState([]);
const newMarker = const [aiMessages, setAiMessages] = useState([]);;
content = content.replace(newMarker, const [aiMessages, setAiMessages] = useState([]);\n  const [aiReplyInput, setAiReplyInput] = useState(''););

// Add the reply input at the end of the AI Response Area
const oldEnd =             {aiLoading && (
              <div style={{ alignSelf: 'flex-end', color: '#ec4899', fontStyle: 'italic', padding: '1rem' }}>
                <Loader2 className="animate-spin" size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                ה-AI מעבד נתונים...
              </div>
            )}
          </div>
        </div>
      )};

const newEnd =             {aiLoading && (
              <div style={{ alignSelf: 'flex-end', color: '#ec4899', fontStyle: 'italic', padding: '1rem' }}>
                <Loader2 className="animate-spin" size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                ה-AI מעבד נתונים...
              </div>
            )}
            
            <form onSubmit={(e) => { e.preventDefault(); if (aiReplyInput.trim()) { handleAiSearch(aiReplyInput); setAiReplyInput(''); } }} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #fbcfe8', paddingTop: '1rem' }}>
              <input 
                type="text" 
                placeholder="המשך שיחה (בקש סינונים נוספים, קיבוץ וכו')..." 
                value={aiReplyInput}
                onChange={(e) => setAiReplyInput(e.target.value)}
                disabled={aiLoading}
                style={{ flex: 1, padding: '0.75rem 1.25rem', borderRadius: '24px', border: '1px solid #fbcfe8', outline: 'none', background: 'white' }}
              />
              <button 
                type="submit" 
                disabled={aiLoading || !aiReplyInput.trim()}
                style={{ borderRadius: '24px', padding: '0.75rem 1.5rem', background: 'linear-gradient(45deg, #a855f7, #ec4899)', color: 'white', border: 'none', cursor: aiLoading || !aiReplyInput.trim() ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: (aiLoading || !aiReplyInput.trim()) ? 0.6 : 1 }}
              >
                שלח
              </button>
            </form>
          </div>
        </div>
      )};

content = content.replace(oldEnd, newEnd);

fs.writeFileSync('app/page.js', content, 'utf8');
