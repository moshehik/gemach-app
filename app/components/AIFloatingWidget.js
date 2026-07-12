'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, X, MessageSquare, Maximize2, Minimize2, Trash2, Mic, History } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function AIFloatingWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [modalTableData, setModalTableData] = useState(null);
  
  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  
  const recognitionRef = useRef(null);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem('ai_employee_chat_sessions');
    let sessions = [];
    if (savedSessions) {
      try {
        sessions = JSON.parse(savedSessions);
        setChatSessions(sessions);
      } catch (e) {}
    }

    const saved = localStorage.getItem('ai_employee_chat');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed);
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

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai_employee_chat', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const startNewChat = () => {
    if (messages.length > 1) {
      // Save current to sessions before clearing
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem('ai_employee_chat_sessions', JSON.stringify(updatedSessions));
    }
    setMessages([{ role: 'assistant', content: 'שלום! אני עוזר ה-AI. כיצד אוכל לעזור לך למצוא נתונים במערכת?' }]);
    setShowHistory(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const historyContext = newMessages.map(m => ({ role: m.role, content: m.content }));
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMsg, 
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. אתה עוזר וירטואלי עבור עובדי הגמ"ח. מותר לך לספק נתונים על לקוחות, הזמנות, פריטים ומלאי כדי לעזור בשירות לקוחות. אסור לך לחשוף מידע על עובדים אחרים, משמרות או הרשאות. אסור לך להציג סטטיסטיקות כלליות, סיכומי רווחים, דוחות או פילוחים ניהוליים מתקדמים (אם העובד מבקש סטטיסטיקות כאלו, אמור לו שזה זמין רק בממשק מנהל).`
        }),
      });

      const data = await res.json();
      
      const assistantMessage = res.ok 
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'מצטער, חלה שגיאה בחיבור למערכת ה-AI.' };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת תקשורת עם השרת.' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (await window.customConfirm('האם אתה בטוח שברצונך לנקות את חלון השיחה?')) {
      startNewChat();
    }
  };

  const renderTable = (tableData) => {
    if (!tableData || tableData.length === 0) return null;
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button 
          type="button"
          onClick={() => { setModalTableData(tableData); setShowTableModal(true); }}
          style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          <span>📊</span> הצג טבלה
        </button>
      </div>
    );
  };

  const toggleListen = (e) => {
    if (e) e.preventDefault();
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("הדפדפן שלך אינו תומך בהקלטת קול.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'he-IL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  const loadSession = (session) => {
    if (messages.length > 1 && !chatSessions.find(s => s.id === session.id)) {
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem('ai_employee_chat_sessions', JSON.stringify(updatedSessions));
    }
    setMessages(session.messages);
    setShowHistory(false);
  };

  if (pathname === '/customer-interface') {
    return null;
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          left: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '30px',
          backgroundColor: 'var(--primary-color, #4338ca)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: 900,
          transition: 'transform 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        title="עוזר AI"
      >
        <Bot size={32} />
      </button>
    );
  }

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        width: isExpanded ? '600px' : '380px',
        height: isExpanded ? '80vh' : '550px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 40px)',
        backgroundColor: 'var(--card-bg)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 900,
        overflow: 'hidden',
        border: '1px solid var(--element-border)',
        transition: 'all 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'var(--primary-color, #4338ca)',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={20} />
            <span style={{ fontWeight: 'bold' }}>עוזר AI</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'none', border: 'none', color: showHistory ? '#fcd34d' : 'white', cursor: 'pointer', opacity: 0.9 }} title="היסטוריית שיחות">
              <History size={18} />
            </button>
            <button onClick={clearChat} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }} title="שיחה חדשה">
              <Trash2 size={18} />
            </button>
            <button onClick={() => setIsExpanded(!isExpanded)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }} title={isExpanded ? 'הקטן' : 'הגדל'}>
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }} title="סגור">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--element-bg)', position: 'relative' }}>
          {showHistory ? (
            <div style={{ padding: '10px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-main)', fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>היסטוריית שיחות</h3>
              {chatSessions.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '10px' }}>אין היסטוריית שיחות שמורה.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {chatSessions.map((session) => (
                    <div 
                      key={session.id} 
                      onClick={() => loadSession(session)}
                      style={{
                        padding: '12px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--element-border)',
                        borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px'
                      }}
                      onMouseOver={e => e.currentTarget.style.borderColor = '#6366f1'}
                      onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                    >
                      <span style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '0.9rem' }}>{session.date}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.messages.length > 1 ? session.messages[1].content : 'שיחה ריקה'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} style={{
                  alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                  backgroundColor: msg.role === 'user' ? 'var(--primary-color, #4338ca)' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1f2937',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  maxWidth: '85%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '0' : '12px',
                  fontSize: '0.95rem',
                  lineHeight: '1.4'
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  {msg.tableData && renderTable(msg.tableData)}
                </div>
              ))}
              {loading && (
                <div style={{
                  alignSelf: 'flex-end',
                  backgroundColor: 'var(--card-bg)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  borderBottomLeftRadius: '0',
                  fontStyle: 'italic',
                  color: '#6b7280',
                  fontSize: '0.9rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  מעבד נתונים...
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} style={{
          display: 'flex',
          padding: '12px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'var(--card-bg)',
          gap: '8px'
        }}>
          <button 
            type="button" 
            onClick={toggleListen}
            style={{
              background: isListening ? '#ef4444' : 'var(--element-bg)', 
              color: isListening ? 'white' : 'var(--text-main)', 
              border: 'none', borderRadius: '50%', width: '42px', height: '42px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
              animation: isListening ? 'pulse 1.5s infinite' : 'none'
            }}
            title="הקלט הודעה"
          >
            <Mic size={20} />
          </button>
          <input 
            type="text" 
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל שאלה..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '20px',
              border: '1px solid #d1d5db',
              outline: 'none',
              fontSize: '0.95rem',
              fontFamily: 'inherit'
            }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '21px',
              border: 'none',
              backgroundColor: 'var(--primary-color, #4338ca)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading ? 0.7 : 1
            }}>
            <MessageSquare size={18} />
          </button>
        </form>
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
          zIndex: 100000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            padding: '20px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>נתונים ({modalTableData.length} שורות)</h3>
              <button 
                onClick={() => setShowTableModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, borderRadius: '6px', border: '1px solid var(--element-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--element-bg)', zIndex: 1 }}>
                  <tr>
                    {Object.keys(modalTableData[0]).map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', color: 'var(--text-main)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalTableData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'var(--card-bg)' : 'var(--element-bg)' }}>
                      {Object.keys(modalTableData[0]).map(h => (
                        <td key={h} style={{ padding: '8px 12px', color: '#1f2937' }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
