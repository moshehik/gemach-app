'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, X, MessageSquare, Maximize2, Minimize2, Trash2 } from 'lucide-react';
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
  
  const chatEndRef = useRef(null);

  useEffect(() => {
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
    setMessages([{ role: 'assistant', content: 'שלום! אני עוזר ה-AI. כיצד אוכל לעזור לך למצוא נתונים במערכת?' }]);
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

  const clearChat = () => {
    if (confirm('האם אתה בטוח שברצונך לנקות את חלון השיחה?')) {
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
          zIndex: 999,
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
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
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
            <button onClick={clearChat} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }} title="נקה שיחה">
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f9fafb' }}>
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
              backgroundColor: 'white',
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
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} style={{
          display: 'flex',
          padding: '12px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white',
          gap: '8px'
        }}>
          <input 
            type="text" 
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
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
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
            
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 1 }}>
                  <tr>
                    {Object.keys(modalTableData[0]).map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', color: '#374151' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalTableData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
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
