const fs = require('fs');
const file = 'app/customer-interface/page.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Add isAiChatVisible state
code = code.replace(
  /const \[aiLoading, setAiLoading\] = useState\(false\);/,
  `const [aiLoading, setAiLoading] = useState(false);\n  const [isAiChatVisible, setIsAiChatVisible] = useState(false);`
);

// 2. Add setIsAiChatVisible(true) to handleAiSubmit
code = code.replace(
  /setAiLoading\(true\);/,
  `setIsAiChatVisible(true);\n    setAiLoading(true);`
);

// 3. Update the context string in handleAiSubmit
const oldContext = 'context: `התאריך היום הוא: ${new Date().toLocaleDateString(\'he-IL\')}. ענה אך ורק לשאלות שקשורות להזמנות, מלאי, מחירים ותיקונים עבור לקוחות. אסור לך בשום אופן למסור מידע ניהולי (כמו סטטיסטיקות, רווחים, הכנסות, נתוני עובדים או מידע על לקוחות אחרים). אם הלקוח שואל שאלות לא קשורות או מבקש מידע חסוי, התנצל בנימוס ואמור שאין לך הרשאה לספק מידע זה ושהנך כאן רק לעזור בכל הקשור להזמנות השמלות של הלקוח.`';

const newContext = 'context: `התאריך היום הוא: ${new Date().toLocaleDateString(\'he-IL\')}. ענה אך ורק לשאלות שקשורות להזמנות, מלאי, מחירים ותיקונים עבור לקוחות. אסור לך בשום אופן למסור מידע ניהולי (כמו סטטיסטיקות, רווחים, הכנסות, נתוני עובדים או מידע על לקוחות אחרים). אם הלקוח שואל שאלות לא קשורות או מבקש מידע חסוי, התנצל בנימוס ואמור שאין לך הרשאה לספק מידע זה ושהנך כאן רק לעזור בכל הקשור להזמנות השמלות של הלקוח.\\nטיפ חכם: אם אתה ממליץ על דגם מסוים או מידה מסוימת, באפשרותך להוסיף בסוף התשובה שלך את התגית [FILTER:term] כאשר term הוא מילת החיפוש (למשל [FILTER:תחרה] או [FILTER:42]). המערכת תהפוך את זה לכפתור סינון עבור הלקוח.`';

code = code.replace(oldContext, newContext);

// 4. Import Plus from lucide-react
if (!code.includes(', Plus')) {
  code = code.replace(/import \{ (.*?) \} from 'lucide-react';/, "import { $1, Plus } from 'lucide-react';");
}

// 5. Replace chat container condition and rendering
const oldChatRenderStart = /{aiMessages\.length > 1 && stage === 2 && \(\s*<div style=\{\{ background: 'white', padding: '20px', borderRadius: '16px', marginTop: '16px'/;
const newChatRenderStart = `{isAiChatVisible && stage === 2 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', marginTop: '16px'`;
code = code.replace(oldChatRenderStart, newChatRenderStart);

// 6. Replace Chat header
const oldHeaderRegex = /<div style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*'8px',\s*marginBottom:\s*'16px',\s*borderBottom:\s*'1px solid #f1f5f9',\s*paddingBottom:\s*'12px',\s*color:\s*'#8b5cf6',\s*fontWeight:\s*'bold',\s*justifyContent:\s*'space-between'\s*\}\}>\s*<span><Sparkles size=\{18\} \/> העוזר החכם<\/span>\s*<button onClick=\{\(\) => setAiMessages\(\[\{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך\?' \}\]\)\} style=\{\{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' \}\}>נקה צ'אט<\/button>\s*<\/div>/;

const newChatHeader = `<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between' }}>
                  <span><Sparkles size={18} /> העוזר החכם</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }])} title="שיחה חדשה" style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background='#e2e8f0'} onMouseOut={e => e.currentTarget.style.background='#f1f5f9'}><Plus size={16} /></button>
                    <button onClick={() => setIsAiChatVisible(false)} title="סגור" style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'all 0.2s', fontWeight: 'bold' }} onMouseOver={e => e.currentTarget.style.background='#fecaca'} onMouseOut={e => e.currentTarget.style.background='#fee2e2'}>X</button>
                  </div>
                </div>`;
code = code.replace(oldHeaderRegex, newChatHeader);

// 7. Replace Message content mapping
const oldMsgRegex = /<div>\{msg\.content\.replace\(\/\\\[DATE:\\\\d\{4\}-\\\\d\{2\}-\\\\d\{2\}\\\]\/g, ''\)\.trim\(\)\}<\/div>/g;
const newMsgBody = `<div>
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
                      })()}`;
code = code.replace(oldMsgRegex, newMsgBody);

// 8. Add input row to the bottom of the chat box
const oldChatEndRegex = /\{aiLoading && <div style=\{\{ textAlign: 'center', marginTop: '1rem', color: '#8b5cf6', fontSize: '0\.9rem' \}\}>מקליד\.\.\.<\/div>\}\s*<\/div>\s*\)\}/;

const newChatEnd = `{aiLoading && <div style={{ textAlign: 'center', marginTop: '1rem', color: '#8b5cf6', fontSize: '0.9rem' }}>מקליד...</div>}
                
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
code = code.replace(oldChatEndRegex, newChatEnd);

fs.writeFileSync(file, code, 'utf8');
console.log('Patch complete.');
