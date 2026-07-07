'use client';

import { useState, useEffect, useRef } from 'react';

export default function AIPage() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [modalTableData, setModalTableData] = useState(null);
  
  const chatEndRef = useRef(null);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai_chat_threads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setThreads(parsed);
          setActiveThreadId(parsed[0].id);
        } else {
          startNewChat();
        }
      } catch (e) {
        startNewChat();
      }
    } else {
      startNewChat();
    }
  }, []);

  // Save to local storage when threads change
  useEffect(() => {
    if (threads.length > 0) {
      localStorage.setItem('ai_chat_threads', JSON.stringify(threads));
    }
  }, [threads]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threads, activeThreadId]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    const newThread = {
      id: newId,
      title: 'שיחה חדשה',
      messages: [{ role: 'assistant', content: 'שלום! אני מערכת ה-AI של הגמ"ח. כיצד אוכל לעזור לך היום?' }]
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newId);
  };

  const activeThread = threads.find(t => t.id === activeThreadId) || { messages: [] };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessageContent = input.trim();
    setInput('');
    
    const currentThreadId = activeThreadId;
    const currentThread = threads.find(t => t.id === currentThreadId);
    if (!currentThread) return;

    const userMessage = { role: 'user', content: userMessageContent };
    
    // Update thread with user message
    setThreads(prev => prev.map(t => {
      if (t.id === currentThreadId) {
        // Auto-title on first user message
        const title = t.messages.length === 1 ? userMessageContent.slice(0, 30) + '...' : t.title;
        return { ...t, title, messages: [...t.messages, userMessage] };
      }
      return t;
    }));
    
    setLoading(true);

    try {
      const historyContext = currentThread.messages.map(m => ({ role: m.role, content: m.content }));
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMessageContent, 
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. אתה נמצא בממשק המנהל, ענה על כל שאלה סטטיסטית, פיננסית או ניהולית שהמנהל מבקש, כולל נתונים מדויקים מהמסד.`
        }),
      });

      const data = await res.json();
      
      const assistantMessage = res.ok 
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'מצטער, חלה שגיאה בחיבור למערכת ה-AI.' };

      // Append strictly to the thread that initiated the request
      setThreads(prev => prev.map(t => {
        if (t.id === currentThreadId) {
          return { ...t, messages: [...t.messages, assistantMessage] };
        }
        return t;
      }));

    } catch (error) {
      setThreads(prev => prev.map(t => {
        if (t.id === currentThreadId) {
          return { ...t, messages: [...t.messages, { role: 'assistant', content: 'שגיאת תקשורת עם השרת.' }] };
        }
        return t;
      }));
    } finally {
      setLoading(false);
    }
  };

  const deleteThread = (e, id) => {
    e.stopPropagation();
    const newThreads = threads.filter(t => t.id !== id);
    setThreads(newThreads);
    if (activeThreadId === id) {
      setActiveThreadId(newThreads.length > 0 ? newThreads[0].id : null);
      if (newThreads.length === 0) startNewChat();
    }
  };

  const renderTable = (tableData) => {
    if (!tableData || tableData.length === 0) return null;
    
    return (
      <div style={{ marginTop: '1rem' }}>
        <button 
          type="button"
          onClick={() => { setModalTableData(tableData); setShowTableModal(true); }}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#047857'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#059669'}
        >
          <span style={{ fontSize: '1.2rem' }}>📊</span> תצוגת נתונים
        </button>
      </div>
    );
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '1000px' }}>
      <h1 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--primary-color)' }}>עוזר AI למנהל</h1>
      
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        flexDirection: 'row',
        height: '70vh',
        overflow: 'hidden'
      }}>
        
        {/* Sidebar */}
        <div style={{
          width: '250px',
          backgroundColor: '#f8f9fa',
          borderLeft: '1px solid #eee',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
            <button 
              onClick={startNewChat}
              style={{
                width: '100%',
                padding: '0.8rem',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span>+</span> שיחה חדשה
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {threads.map(t => (
              <div 
                key={t.id}
                onClick={() => setActiveThreadId(t.id)}
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: activeThreadId === t.id ? '#e9ecef' : 'transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background-color 0.2s'
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', flex: 1 }}>
                  {t.title}
                </span>
                <button 
                  onClick={(e) => deleteThread(e, t.id)}
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: '0 5px' }}
                  title="מחק שיחה"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeThread.messages.map((msg, idx) => (
              <div key={idx} style={{
                alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                backgroundColor: msg.role === 'user' ? 'var(--primary-color)' : '#f1f1f1',
                color: msg.role === 'user' ? 'white' : 'var(--text-color)',
                padding: '1rem',
                borderRadius: '12px',
                maxWidth: '85%',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '0' : '12px'
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                {msg.tableData && renderTable(msg.tableData)}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-end',
                backgroundColor: '#f1f1f1',
                padding: '1rem',
                borderRadius: '12px',
                borderBottomLeftRadius: '0',
                fontStyle: 'italic',
                color: 'var(--text-muted)'
              }}>
                המערכת מעבדת את הנתונים...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={sendMessage} style={{
            display: 'flex',
            padding: '1rem',
            borderTop: '1px solid #eee',
            backgroundColor: '#fafafa',
            gap: '1rem'
          }}>
            <button 
              type="submit" 
              disabled={loading || !activeThreadId}
              style={{
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'background-color 0.2s',
                opacity: (loading || !activeThreadId) ? 0.7 : 1
              }}>
              שלח
            </button>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="שאל אותי על סטטיסטיקות או מידע מהמערכת (לדוגמה: כמה הזמנות יש בשנת 2024?)..."
              disabled={!activeThreadId}
              style={{
                flex: 1,
                padding: '0.8rem 1rem',
                borderRadius: '8px',
                border: '1px solid #ddd',
                outline: 'none',
                fontSize: '1rem'
              }}
            />
          </form>
        </div>
      </div>

      {/* Table Modal */}
      {showTableModal && modalTableData && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '2rem',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>תצוגת נתונים ({modalTableData.length} שורות)</h2>
              <button 
                onClick={() => setShowTableModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '2rem',
                  cursor: 'pointer',
                  color: '#666',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, borderRadius: '8px', border: '1px solid #eee' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--primary-color)', color: 'white', zIndex: 1 }}>
                  <tr>
                    {Object.keys(modalTableData[0]).map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalTableData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                      {Object.keys(modalTableData[0]).map(h => (
                        <td key={h} style={{ padding: '10px 16px' }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
